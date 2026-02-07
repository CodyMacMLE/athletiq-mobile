import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import cors from "cors";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { prisma } from "./db.js";

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

async function main() {
  const app = express();

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
  });

  await server.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({ origin: true }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
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

        return { userId: user.id };
      },
    })
  );

  app.listen(4000, () => {
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
