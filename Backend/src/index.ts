import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { prisma } from "./db.js";
import { startAbsentMarkerCron, stopAbsentMarkerCron } from "./cron/absentMarker.js";
import { startAutoCheckoutCron, stopAutoCheckoutCron } from "./cron/autoCheckout.js";
import { startEventReminderCron, stopEventReminderCron } from "./cron/eventReminders.js";
import { startEmailReportCron, stopEmailReportCron } from "./cron/emailReportScheduler.js";
import { startScheduledAnnouncementCron, stopScheduledAnnouncementCron } from "./cron/scheduledAnnouncements.js";

interface Context {
  userId?: string;
}

// Verify Cognito ID tokens (signature + expiry + issuer + audience)
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "us-east-2_jHLnfwOqy",
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID || "3e0jmpi1vpsbkntof8h6u7eov0",
});

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
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  await server.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({ origin: true }),
    express.json(),
    apiLimiter,
    playgroundAuth,
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Playground API key bypass — allows testing in Apollo Studio without a Cognito JWT.
        // Only works when PLAYGROUND_API_KEY is set in the environment.
        const apiKey = req.headers["x-api-key"];
        const playgroundApiKey = process.env.PLAYGROUND_API_KEY;
        if (apiKey && playgroundApiKey && apiKey === playgroundApiKey) {
          const email = process.env.PLAYGROUND_USER_EMAIL;
          if (!email) throw new Error("PLAYGROUND_USER_EMAIL is not set");
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) throw new Error(`No user found for PLAYGROUND_USER_EMAIL: ${email}`);
          console.log(`[playground] authenticated as ${email} (${user.id})`);
          return { userId: user.id };
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return {};
        }

        const token = authHeader.slice(7);

        let payload: Record<string, unknown>;
        try {
          payload = await cognitoVerifier.verify(token) as Record<string, unknown>;
        } catch {
          // Token invalid, expired, or tampered — treat as unauthenticated
          return {};
        }

        if (typeof payload.email !== "string") return {};

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

        return { userId: user.id };
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
