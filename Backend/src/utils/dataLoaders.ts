import DataLoader from "dataloader";
import { prisma } from "../db.js";

/**
 * Per-request DataLoaders to batch and cache DB lookups, preventing N+1 queries.
 * Call createLoaders() once per GraphQL request and attach to Apollo context.
 */

function createByIdLoader<T extends { id: string }>(
  batchFn: (ids: readonly string[]) => Promise<T[]>
) {
  return new DataLoader<string, T | null>(async (ids) => {
    const items = await batchFn(ids);
    const map = new Map(items.map((item) => [item.id, item]));
    return ids.map((id) => map.get(id) ?? null);
  });
}

export function createLoaders() {
  return {
    user: createByIdLoader((ids) =>
      prisma.user.findMany({ where: { id: { in: [...ids] } } })
    ),

    // Team loader includes orgSeason so TeamMember field resolvers can use
    // season date ranges without a separate query.
    team: createByIdLoader((ids) =>
      prisma.team.findMany({
        where: { id: { in: [...ids] } },
        include: { orgSeason: true },
      })
    ),

    organization: createByIdLoader((ids) =>
      prisma.organization.findMany({ where: { id: { in: [...ids] } } })
    ),

    venue: createByIdLoader((ids) =>
      prisma.venue.findMany({ where: { id: { in: [...ids] } } })
    ),

    event: createByIdLoader((ids) =>
      prisma.event.findMany({ where: { id: { in: [...ids] } } })
    ),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
