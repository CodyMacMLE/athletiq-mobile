export const teamsSchema = `#graphql
  # ---- Enums ----
  enum TeamRole {
    MEMBER
    CAPTAIN
    COACH
    ADMIN
  }

  enum TimeRange {
    WEEK
    MONTH
    ALL
  }

  # ---- Types ----
  type Team {
    id: ID!
    name: String!
    season: String
    sport: String
    color: String
    description: String
    organization: Organization!
    orgSeason: OrgSeason
    seasonYear: Int
    members: [TeamMember!]!
    events: [Event!]!
    recurringEvents: [RecurringEvent!]!
    memberCount: Int!
    attendancePercent(timeRange: TimeRange): Float!
    sortOrder: Int!
    archivedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type TeamMember {
    id: ID!
    user: User!
    team: Team!
    role: TeamRole!
    hoursRequired: Float!
    hoursLogged(timeRange: TimeRange): Float!
    attendancePercent(timeRange: TimeRange): Float!
    joinedAt: String!
  }

  # ---- Inputs ----
  input CreateTeamInput {
    name: String!
    season: String
    sport: String
    color: String
    description: String
    organizationId: ID!
    orgSeasonId: ID
    seasonYear: Int
  }

  input AddTeamMemberInput {
    userId: ID!
    teamId: ID!
    role: TeamRole
    hoursRequired: Float
  }

  # ---- Queries ----
  extend type Query {
    team(id: ID!): Team
    teams(organizationId: ID!, includeArchived: Boolean): [Team!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    createTeam(input: CreateTeamInput!): Team!
    updateTeam(id: ID!, name: String, season: String, sport: String, color: String, description: String, orgSeasonId: ID, seasonYear: Int): Team!
    deleteTeam(id: ID!, hardDelete: Boolean): Boolean!
    restoreTeam(id: ID!): Team!
    reorderTeams(organizationId: ID!, teamIds: [ID!]!): Boolean!
    addTeamMember(input: AddTeamMemberInput!): TeamMember!
    removeTeamMember(userId: ID!, teamId: ID!): Boolean!
    updateTeamMemberRole(userId: ID!, teamId: ID!, role: TeamRole!): TeamMember!
  }
`;
