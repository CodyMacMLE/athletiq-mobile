export const typeDefs = `#graphql
  # ============================================
  # Enums
  # ============================================

  enum TeamRole {
    MEMBER
    CAPTAIN
    COACH
    ADMIN
  }

  enum EventType {
    PRACTICE
    EVENT
    MEETING
    REST
  }

  enum AttendanceStatus {
    ON_TIME
    LATE
    ABSENT
    EXCUSED
  }

  enum ExcuseRequestStatus {
    PENDING
    APPROVED
    DENIED
  }

  enum TimeRange {
    WEEK
    MONTH
    ALL
  }

  # ============================================
  # Types
  # ============================================

  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    phone: String
    address: String
    city: String
    country: String
    image: String
    createdAt: String!
    updatedAt: String!
    memberships: [TeamMember!]!
    checkIns: [CheckIn!]!
  }

  type Organization {
    id: ID!
    name: String!
    image: String
    createdAt: String!
    updatedAt: String!
    teams: [Team!]!
    events: [Event!]!
    memberCount: Int!
  }

  type Team {
    id: ID!
    name: String!
    organization: Organization!
    members: [TeamMember!]!
    events: [Event!]!
    memberCount: Int!
    attendancePercent(timeRange: TimeRange): Float!
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

  type Event {
    id: ID!
    title: String!
    type: EventType!
    date: String!
    startTime: String!
    endTime: String!
    location: String
    description: String
    organization: Organization!
    team: Team
    checkIns: [CheckIn!]!
    createdAt: String!
    updatedAt: String!
  }

  type CheckIn {
    id: ID!
    user: User!
    event: Event!
    status: AttendanceStatus!
    checkInTime: String
    checkOutTime: String
    hoursLogged: Float
    createdAt: String!
    updatedAt: String!
  }

  type ExcuseRequest {
    id: ID!
    user: User!
    event: Event!
    reason: String!
    status: ExcuseRequestStatus!
    createdAt: String!
    updatedAt: String!
  }

  # ============================================
  # Analytics Types
  # ============================================

  type UserStats {
    hoursLogged: Float!
    hoursRequired: Float!
    attendancePercent: Float!
    teamRank: Int!
    teamSize: Int!
    orgRank: Int!
    orgSize: Int!
    currentStreak: Int!
    bestStreak: Int!
  }

  type LeaderboardEntry {
    user: User!
    attendancePercent: Float!
    hoursLogged: Float!
    hoursRequired: Float!
    rank: Int!
  }

  type TeamRanking {
    team: Team!
    attendancePercent: Float!
    rank: Int!
  }

  type RecentActivity {
    id: ID!
    user: User!
    type: String!
    time: String!
    date: String!
  }

  # ============================================
  # Input Types
  # ============================================

  input CreateUserInput {
    email: String!
    firstName: String!
    lastName: String!
    phone: String
    address: String
    city: String
    country: String
    image: String
  }

  input UpdateUserInput {
    firstName: String
    lastName: String
    phone: String
    address: String
    city: String
    country: String
    image: String
  }

  input CreateOrganizationInput {
    name: String!
    image: String
  }

  input CreateTeamInput {
    name: String!
    organizationId: ID!
  }

  input AddTeamMemberInput {
    userId: ID!
    teamId: ID!
    role: TeamRole
    hoursRequired: Float
  }

  input CreateEventInput {
    title: String!
    type: EventType!
    date: String!
    startTime: String!
    endTime: String!
    location: String
    description: String
    organizationId: ID!
    teamId: ID
  }

  input CheckInInput {
    userId: ID!
    eventId: ID!
  }

  input CheckOutInput {
    checkInId: ID!
  }

  input CreateExcuseRequestInput {
    userId: ID!
    eventId: ID!
    reason: String!
  }

  input UpdateExcuseRequestInput {
    id: ID!
    status: ExcuseRequestStatus!
  }

  # ============================================
  # Queries
  # ============================================

  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users: [User!]!

    # Organization queries
    organization(id: ID!): Organization
    organizations: [Organization!]!
    myOrganizations: [Organization!]!

    # Team queries
    team(id: ID!): Team
    teams(organizationId: ID!): [Team!]!

    # Event queries
    event(id: ID!): Event
    events(organizationId: ID!, startDate: String, endDate: String): [Event!]!
    upcomingEvents(organizationId: ID!, limit: Int): [Event!]!

    # Check-in queries
    checkIn(id: ID!): CheckIn
    checkInHistory(userId: ID!, limit: Int): [CheckIn!]!
    eventAttendance(eventId: ID!): [CheckIn!]!

    # Excuse queries
    excuseRequest(id: ID!): ExcuseRequest
    myExcuseRequests(userId: ID!): [ExcuseRequest!]!
    pendingExcuseRequests(organizationId: ID!): [ExcuseRequest!]!

    # Analytics queries
    userStats(userId: ID!, organizationId: ID!, timeRange: TimeRange): UserStats!
    teamLeaderboard(teamId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    organizationLeaderboard(organizationId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    teamRankings(organizationId: ID!, timeRange: TimeRange): [TeamRanking!]!
    recentActivity(organizationId: ID!, limit: Int): [RecentActivity!]!
  }

  # ============================================
  # Mutations
  # ============================================

  type Mutation {
    # User mutations
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!

    # Organization mutations
    createOrganization(input: CreateOrganizationInput!): Organization!
    updateOrganization(id: ID!, name: String, image: String): Organization!
    deleteOrganization(id: ID!): Boolean!

    # Team mutations
    createTeam(input: CreateTeamInput!): Team!
    updateTeam(id: ID!, name: String): Team!
    deleteTeam(id: ID!): Boolean!
    addTeamMember(input: AddTeamMemberInput!): TeamMember!
    removeTeamMember(userId: ID!, teamId: ID!): Boolean!
    updateTeamMemberRole(userId: ID!, teamId: ID!, role: TeamRole!): TeamMember!

    # Event mutations
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, title: String, type: EventType, date: String, startTime: String, endTime: String, location: String, description: String): Event!
    deleteEvent(id: ID!): Boolean!

    # Check-in mutations
    checkIn(input: CheckInInput!): CheckIn!
    checkOut(input: CheckOutInput!): CheckIn!
    markAbsent(userId: ID!, eventId: ID!): CheckIn!

    # Excuse mutations
    createExcuseRequest(input: CreateExcuseRequestInput!): ExcuseRequest!
    updateExcuseRequest(input: UpdateExcuseRequestInput!): ExcuseRequest!
    cancelExcuseRequest(id: ID!): Boolean!
  }
`;
