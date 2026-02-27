export const analyticsSchema = `#graphql
  # ---- Types ----
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
    eventTitle: String
    eventType: String
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

  type AttendanceTrendPoint {
    weekStart: String!
    attendancePercent: Float!
    hoursLogged: Float!
    hoursRequired: Float!
    eventsCount: Int!
  }

  type CoachHoursEntry {
    event: Event!
    checkIn: CheckIn
    hoursLogged: Float!
  }

  type AppliedDeduction {
    name: String!
    type: String!
    value: Float!
    amount: Float!
  }

  type CoachMonthlyHours {
    userId: ID!
    user: User!
    totalHours: Float!
    totalPay: Float
    grossPay: Float
    netPay: Float
    hourlyRate: Float
    salaryAmount: Float
    appliedDeductions: [AppliedDeduction!]!
    entries: [CoachHoursEntry!]!
  }

  type PayrollDeduction {
    id: ID!
    name: String!
    type: String!
    value: Float!
  }

  type PayrollConfig {
    payPeriod: String
    defaultHourlyRate: Float
    deductions: [PayrollDeduction!]!
  }

  type OrgCoachHoursSummary {
    coaches: [CoachMonthlyHours!]!
    month: Int!
    year: Int!
  }

  # ---- Inputs ----
  input PayrollDeductionInput {
    id: String
    name: String!
    type: String!
    value: Float!
  }

  # ---- Queries ----
  extend type Query {
    userStats(userId: ID!, organizationId: ID!, teamId: ID, timeRange: TimeRange): UserStats!
    teamLeaderboard(teamId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    organizationLeaderboard(organizationId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    teamRankings(organizationId: ID!, timeRange: TimeRange): [TeamRanking!]!
    attendanceTrends(organizationId: ID!, teamId: ID): [AttendanceTrendPoint!]!
    recentActivity(organizationId: ID!, teamId: ID, limit: Int): [RecentActivity!]!
    attendanceLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    absentExcusedLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    allAttendanceRecords(organizationId: ID!, search: String, status: AttendanceStatus, teamId: ID, userId: ID, startDate: String, endDate: String, sortField: String, sortDir: String, limit: Int, offset: Int): [CheckIn!]!
    attendanceRecordsCount(organizationId: ID!, search: String, status: AttendanceStatus, teamId: ID, userId: ID, startDate: String, endDate: String): Int!
    attendanceInsights(organizationId: ID!, teamId: ID, timeRange: TimeRange): AttendanceInsights!
    teamAttendanceRecords(teamId: ID!, limit: Int, offset: Int): [CheckIn!]!
    coachMyHours(organizationId: ID, month: Int!, year: Int!): CoachMonthlyHours!
    orgCoachHours(organizationId: ID!, month: Int!, year: Int!): OrgCoachHoursSummary!
  }

  # ---- Mutations ----
  extend type Mutation {
    updateCoachHourlyRate(organizationId: ID!, userId: ID!, hourlyRate: Float): OrganizationMember!
    updateCoachPayRate(organizationId: ID!, userId: ID!, hourlyRate: Float, salaryAmount: Float): OrganizationMember!
    updatePayrollConfig(organizationId: ID!, payPeriod: String, defaultHourlyRate: Float, deductions: [PayrollDeductionInput!]): Organization!
  }
`;
