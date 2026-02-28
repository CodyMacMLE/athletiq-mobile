import { ApolloServer } from "@apollo/server";
import type { GraphQLFormattedError } from "graphql";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import depthLimit from "graphql-depth-limit";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { prisma } from "./db.js";
import { createLoaders, Loaders } from "./utils/dataLoaders.js";
import { startAbsentMarkerCron, stopAbsentMarkerCron } from "./cron/absentMarker.js";
import { startAutoCheckoutCron, stopAutoCheckoutCron } from "./cron/autoCheckout.js";
import { startEventReminderCron, stopEventReminderCron } from "./cron/eventReminders.js";
import { startEmailReportCron, stopEmailReportCron } from "./cron/emailReportScheduler.js";
import { startScheduledAnnouncementCron, stopScheduledAnnouncementCron } from "./cron/scheduledAnnouncements.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

// Verify Cognito ID tokens (signature + expiry + issuer + audience)
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "us-east-2_jHLnfwOqy",
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID || "3e0jmpi1vpsbkntof8h6u7eov0",
});

const isProd = process.env.NODE_ENV === "production";

// ─── CORS allowlist ────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:4000",
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : []),
];

// Rate limiter — 120 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errors: [{ message: "Too many requests, please try again later." }] },
});

// Basic Auth middleware — only applies to GET requests (playground page load).
// POST requests (actual GraphQL queries) skip this and use Cognito JWT instead.
function playgroundAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (req.method !== "GET") return next();

  const playgroundPassword = process.env.PLAYGROUND_PASSWORD;
  if (!playgroundPassword) {
    res.status(403).send("Playground is disabled (PLAYGROUND_PASSWORD not set)");
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="GraphQL Playground"');
    res.status(401).send("Authentication required");
    return;
  }

  const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
  const colonIndex = credentials.indexOf(":");
  const username = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);

  const validUsername = process.env.PLAYGROUND_USERNAME || "admin";
  if (username !== validUsername || password !== playgroundPassword) {
    res.setHeader("WWW-Authenticate", 'Basic realm="GraphQL Playground"');
    res.status(401).send("Invalid credentials");
    return;
  }

  next();
}

async function main() {
  const app = express();

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    // Disable introspection in production to avoid leaking schema to attackers
    introspection: !isProd,
    // Mask internal error details in production (no stack traces in responses)
    formatError: (formattedError: GraphQLFormattedError, error: unknown) => {
      if (isProd) {
        // Preserve validation errors and explicit user-facing errors
        if (formattedError.extensions?.code === "GRAPHQL_VALIDATION_FAILED") {
          return formattedError;
        }
        if (
          formattedError.message.startsWith("Validation error:") ||
          formattedError.message.startsWith("Authentication required") ||
          formattedError.message.startsWith("Not authorized") ||
          formattedError.message.startsWith("Cannot delete") ||
          formattedError.message.startsWith("You must ")
        ) {
          return { message: formattedError.message };
        }
        return { message: "Internal server error" };
      }
      return formattedError;
    },
    validationRules: [
      // Prevent deeply nested queries that cause exponential DB load
      depthLimit(10),
    ],
    plugins: [
      ...(!isProd ? [ApolloServerPluginLandingPageLocalDefault({ embed: true })] : []),
    ],
  });

  await server.start();

  // Helmet — HTTP security headers (CSP, HSTS, X-Frame-Options, MIME sniff prevention, etc.)
  // Disable contentSecurityPolicy for the GraphQL playground iframe to load correctly in dev.
  app.use(helmet({ contentSecurityPolicy: isProd }));

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    }),
    express.json(),
    apiLimiter,
    playgroundAuth,
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Playground API key bypass — allows testing in Apollo Studio without a Cognito JWT.
        // Only works when PLAYGROUND_API_KEY is set in the environment.
        const apiKey = req.headers["x-api-key"];
        const playgroundApiKey = process.env.PLAYGROUND_API_KEY;
        const loaders = createLoaders();

        if (apiKey && playgroundApiKey && apiKey === playgroundApiKey) {
          const email = process.env.PLAYGROUND_USER_EMAIL;
          if (!email) throw new Error("PLAYGROUND_USER_EMAIL is not set");
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) throw new Error(`No user found for PLAYGROUND_USER_EMAIL: ${email}`);
          console.log(`[playground] authenticated as ${email} (${user.id})`);
          return { userId: user.id, loaders };
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return { loaders };
        }

        const token = authHeader.slice(7);

        let payload: Record<string, unknown>;
        try {
          payload = await cognitoVerifier.verify(token) as Record<string, unknown>;
        } catch {
          // Token invalid, expired, or tampered — treat as unauthenticated
          return { loaders };
        }

        if (typeof payload.email !== "string") return { loaders };

        let user = await prisma.user.findUnique({ where: { email: payload.email } });

        // Auto-create DB record for authenticated Cognito users
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: payload.email,
              firstName: (payload.given_name as string) || payload.email.split("@")[0],
              lastName: (payload.family_name as string) || "",
            },
          });
        }

        return { userId: user.id, loaders };
      },
    })
  );

  app.listen(4000, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
    startAbsentMarkerCron();
    startAutoCheckoutCron();
    startEventReminderCron();
    startEmailReportCron();
    startScheduledAnnouncementCron();
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  stopAbsentMarkerCron();
  stopAutoCheckoutCron();
  stopEventReminderCron();
  stopEmailReportCron();
  stopScheduledAnnouncementCron();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  stopAbsentMarkerCron();
  stopAutoCheckoutCron();
  stopEventReminderCron();
  stopEmailReportCron();
  stopScheduledAnnouncementCron();
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
