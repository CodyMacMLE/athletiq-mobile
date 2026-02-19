import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import cors from "cors";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { prisma } from "./db.js";
import { startAbsentMarkerCron, stopAbsentMarkerCron } from "./cron/absentMarker.js";
import { startEventReminderCron, stopEventReminderCron } from "./cron/eventReminders.js";
import { startEmailReportCron, stopEmailReportCron } from "./cron/emailReportScheduler.js";

interface Context {
  userId?: string;
}

// Decode a JWT payload without verification (extracts claims only)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

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
    playgroundAuth,
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Playground API key bypass — allows testing in Apollo Studio without a Cognito JWT.
        // Only works when PLAYGROUND_API_KEY is set in the environment.
        const apiKey = req.headers["x-api-key"];
        const playgroundApiKey = process.env.PLAYGROUND_API_KEY;
        if (apiKey && playgroundApiKey && apiKey === playgroundApiKey) {
          const email = process.env.PLAYGROUND_USER_EMAIL;
          if (email) {
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) return { userId: user.id };
          }
        }

        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return {};
        }

        const token = authHeader.slice(7);
        const payload = decodeJwtPayload(token);
        if (!payload || typeof payload.email !== "string") {
          return {};
        }

        let user = await prisma.user.findUnique({
          where: { email: payload.email },
        });

        // Auto-create DB record for authenticated Cognito users (handles
        // cases where registration DB setup failed but Cognito account exists)
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: payload.email,
              firstName: (payload.given_name as string) || payload.email.toString().split("@")[0],
              lastName: (payload.family_name as string) || "",
            },
          });
        }

        return { userId: user.id, cognitoUsername: payload.sub as string };
      },
    })
  );

  app.listen(4000, "0.0.0.0", () => {
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
    startAbsentMarkerCron();
    startEventReminderCron();
    startEmailReportCron();
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  stopAbsentMarkerCron();
  stopEventReminderCron();
  stopEmailReportCron();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  stopAbsentMarkerCron();
  stopEventReminderCron();
  stopEmailReportCron();
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
