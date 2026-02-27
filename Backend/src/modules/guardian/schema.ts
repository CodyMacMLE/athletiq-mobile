export const guardianSchema = `#graphql
  # ---- Types ----
  type GuardianLink {
    id: ID!
    guardian: User!
    athlete: User!
    organization: Organization!
    createdAt: String!
  }

  # ---- Queries ----
  extend type Query {
    myGuardians(organizationId: ID!): [GuardianLink!]!
    myLinkedAthletes(organizationId: ID!): [GuardianLink!]!
    athleteGuardians(userId: ID!, organizationId: ID!): [GuardianLink!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    inviteGuardian(email: String!, organizationId: ID!, athleteId: ID): Invite!
    removeGuardian(guardianLinkId: ID!): Boolean!
  }
`;
