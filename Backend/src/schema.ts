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

  enum OrgRole {
    OWNER
    MANAGER
    COACH
    ATHLETE
    GUARDIAN
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

  enum RecurrenceFrequency {
    DAILY
    WEEKLY
    BIWEEKLY
    MONTHLY
  }

  enum InviteStatus {
    PENDING
    ACCEPTED
    EXPIRED
  }

  enum NfcCheckInAction {
    CHECKED_IN
    CHECKED_OUT
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
    organizationMemberships: [OrganizationMember!]!
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
    members: [OrganizationMember!]!
    invites: [Invite!]!
    nfcTags: [NfcTag!]!
    memberCount: Int!
  }

  type Team {
    id: ID!
    name: String!
    season: String!
    sport: String
    color: String
    description: String
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

  type OrganizationMember {
    id: ID!
    user: User!
    organization: Organization!
    role: OrgRole!
    joinedAt: String!
  }

  type Event {
    id: ID!
    title: String!
    type: EventType!
    date: String!
    endDate: String
    startTime: String!
    endTime: String!
    location: String
    description: String
    organization: Organization!
    team: Team
    participatingTeams: [Team!]!
    checkIns: [CheckIn!]!
    recurringEvent: RecurringEvent
    createdAt: String!
    updatedAt: String!
  }

  type RecurringEvent {
    id: ID!
    title: String!
    type: EventType!
    startTime: String!
    endTime: String!
    location: String
    description: String
    frequency: RecurrenceFrequency!
    daysOfWeek: [Int!]!
    startDate: String!
    endDate: String!
    organization: Organization!
    team: Team
    events: [Event!]!
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
    note: String
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

  type Invite {
    id: ID!
    email: String!
    organization: Organization!
    role: OrgRole!
    teamIds: [String!]!
    token: String!
    status: InviteStatus!
    createdAt: String!
    expiresAt: String!
  }

  type NfcTag {
    id: ID!
    token: String!
    name: String!
    organization: Organization!
    isActive: Boolean!
    createdBy: String!
    createdAt: String!
  }

  type NfcCheckInResult {
    checkIn: CheckIn!
    action: NfcCheckInAction!
    event: Event!
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

  type AttendanceInsights {
    totalExpected: Int!
    onTimeCount: Int!
    lateCount: Int!
    absentCount: Int!
    excusedCount: Int!
    attendanceRate: Float!
    eventCount: Int!
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
    season: String!
    sport: String
    color: String
    description: String
    organizationId: ID!
  }

  input AddTeamMemberInput {
    userId: ID!
    teamId: ID!
    role: TeamRole
    hoursRequired: Float
  }

  input AddOrgMemberInput {
    userId: ID!
    organizationId: ID!
    role: OrgRole
  }

  input CreateInviteInput {
    email: String!
    organizationId: ID!
    role: OrgRole
    teamIds: [ID!]
  }

  input RegisterNfcTagInput {
    token: String!
    name: String!
    organizationId: ID!
  }

  input CreateEventInput {
    title: String!
    type: EventType!
    date: String!
    endDate: String
    startTime: String!
    endTime: String!
    location: String
    description: String
    organizationId: ID!
    teamId: ID
    participatingTeamIds: [ID!]
  }

  input CreateRecurringEventInput {
    title: String!
    type: EventType!
    startTime: String!
    endTime: String!
    location: String
    description: String
    frequency: RecurrenceFrequency!
    daysOfWeek: [Int!]
    startDate: String!
    endDate: String!
    organizationId: ID!
    teamId: ID
  }

  input CheckInInput {
    userId: ID!
    eventId: ID!
  }

  input AdminCheckInInput {
    userId: ID!
    eventId: ID!
    status: AttendanceStatus!
    note: String
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
    eventUncheckedAthletes(eventId: ID!): [User!]!

    # Excuse queries
    excuseRequest(id: ID!): ExcuseRequest
    myExcuseRequests(userId: ID!): [ExcuseRequest!]!
    pendingExcuseRequests(organizationId: ID!): [ExcuseRequest!]!

    # Recurring event queries
    recurringEvent(id: ID!): RecurringEvent
    recurringEvents(organizationId: ID!): [RecurringEvent!]!

    # NFC queries
    organizationNfcTags(organizationId: ID!): [NfcTag!]!

    # Invite queries
    invite(token: String!): Invite

    # Attendance log queries
    attendanceLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    absentExcusedLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    allAttendanceRecords(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    attendanceInsights(organizationId: ID!, timeRange: TimeRange): AttendanceInsights!

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

    # Organization member mutations
    addOrgMember(input: AddOrgMemberInput!): OrganizationMember!
    updateOrgMemberRole(userId: ID!, organizationId: ID!, role: OrgRole!): OrganizationMember!
    removeOrgMember(userId: ID!, organizationId: ID!): Boolean!
    leaveOrganization(organizationId: ID!): Boolean!
    transferOwnership(organizationId: ID!, newOwnerId: ID!): Boolean!

    # Team mutations
    createTeam(input: CreateTeamInput!): Team!
    updateTeam(id: ID!, name: String, season: String, sport: String, color: String, description: String): Team!
    deleteTeam(id: ID!): Boolean!
    addTeamMember(input: AddTeamMemberInput!): TeamMember!
    removeTeamMember(userId: ID!, teamId: ID!): Boolean!
    updateTeamMemberRole(userId: ID!, teamId: ID!, role: TeamRole!): TeamMember!

    # Event mutations
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, title: String, type: EventType, date: String, startTime: String, endTime: String, location: String, description: String): Event!
    deleteEvent(id: ID!): Boolean!

    # Recurring event mutations
    createRecurringEvent(input: CreateRecurringEventInput!): RecurringEvent!
    deleteRecurringEvent(id: ID!): Boolean!

    # Check-in mutations
    markAbsentForPastEvents(organizationId: ID!): Int!
    checkIn(input: CheckInInput!): CheckIn!
    checkOut(input: CheckOutInput!): CheckIn!
    markAbsent(userId: ID!, eventId: ID!): CheckIn!
    adminCheckIn(input: AdminCheckInInput!): CheckIn!

    # Invite mutations
    createInvite(input: CreateInviteInput!): Invite!
    acceptInvite(token: String!): OrganizationMember!
    cancelInvite(id: ID!): Boolean!
    resendInvite(id: ID!): Invite!

    # NFC mutations
    registerNfcTag(input: RegisterNfcTagInput!): NfcTag!
    deactivateNfcTag(id: ID!): NfcTag!
    nfcCheckIn(token: String!): NfcCheckInResult!

    # Excuse mutations
    createExcuseRequest(input: CreateExcuseRequestInput!): ExcuseRequest!
    updateExcuseRequest(input: UpdateExcuseRequestInput!): ExcuseRequest!
    cancelExcuseRequest(id: ID!): Boolean!
  }
`;
