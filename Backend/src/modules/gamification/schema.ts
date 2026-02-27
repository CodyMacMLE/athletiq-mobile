export const gamificationSchema = `#graphql
  # ---- Types ----
  type Badge {
    id: String!
    name: String!
    description: String!
    category: String!
    icon: String!
    earned: Boolean!
    earnedAt: String
    isNew: Boolean!
    progress: Float!
    threshold: Float!
  }

  type TeamChallenge {
    id: ID!
    title: String!
    description: String
    targetPercent: Float!
    startDate: String!
    endDate: String!
    currentPercent: Float!
    completedAt: String
    createdBy: User!
    team: Team!
    createdAt: String!
    updatedAt: String!
  }

  type AthleteRecognition {
    id: ID!
    user: User!
    team: Team!
    nominatedBy: User!
    period: String!
    periodType: String!
    note: String
    createdAt: String!
  }

  type UserBadges {
    badges: [Badge!]!
    totalEarned: Int!
  }

  # ---- Queries ----
  extend type Query {
    getUserBadges(userId: ID!, organizationId: ID!): UserBadges!
    teamChallenges(teamId: ID!): [TeamChallenge!]!
    teamRecognitions(teamId: ID!, limit: Int): [AthleteRecognition!]!
    recentRecognitions(organizationId: ID!, limit: Int): [AthleteRecognition!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    createTeamChallenge(teamId: ID!, organizationId: ID!, title: String!, description: String, targetPercent: Float!, startDate: String!, endDate: String!): TeamChallenge!
    deleteTeamChallenge(id: ID!): Boolean!
    createAthleteRecognition(userId: ID!, teamId: ID!, organizationId: ID!, periodType: String!, note: String): AthleteRecognition!
    deleteAthleteRecognition(id: ID!): Boolean!
  }
`;
