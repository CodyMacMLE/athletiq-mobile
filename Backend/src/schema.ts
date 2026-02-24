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
    ADMIN
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

  enum RsvpStatus {
    GOING
    NOT_GOING
    MAYBE
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

  enum FeedbackCategory {
    BUG
    FEATURE
    QUESTION
    OTHER
  }

  enum NfcCheckInAction {
    CHECKED_IN
    CHECKED_OUT
  }

  enum Platform {
    IOS
    ANDROID
    WEB
  }

  enum AnnouncementTarget {
    ALL_TEAMS
    SPECIFIC_TEAMS
    SPECIFIC_USERS
    CUSTOM
    EVENT_DAY
  }

  enum ReportFrequency {
    WEEKLY
    MONTHLY
    QUARTERLY
    BIANNUALLY
  }

  enum NotificationType {
    EVENT_REMINDER
    ANNOUNCEMENT
    EXCUSE_STATUS
    ATTENDANCE_MILESTONE
    EMAIL_REPORT
    GUARDIAN_INVITE
  }

  enum NotificationChannel {
    EMAIL
    PUSH
    SMS
  }

  enum DeliveryStatus {
    PENDING
    SENT
    FAILED
    SKIPPED
  }

  enum AdminHealthAccess {
    ADMINS_ONLY
    MANAGERS_AND_ADMINS
  }

  enum CoachHealthAccess {
    ORG_WIDE
    TEAM_ONLY
  }

  # ============================================
  # Types
  # ============================================

  type EmergencyContact {
    id: ID!
    userId: String!
    organizationId: String!
    name: String!
    relationship: String!
    phone: String!
    email: String
    isPrimary: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type MedicalInfo {
    id: ID!
    userId: String!
    organizationId: String!
    conditions: String
    allergies: String
    medications: String
    insuranceProvider: String
    insurancePolicyNumber: String
    insuranceGroupNumber: String
    notes: String
    updatedAt: String!
  }

  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    dateOfBirth: String
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
    emergencyContacts(organizationId: ID!): [EmergencyContact!]!
    medicalInfo(organizationId: ID!): MedicalInfo
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
    seasons: [OrgSeason!]!
    memberCount: Int!
    adminHealthAccess: AdminHealthAccess!
    coachHealthAccess: CoachHealthAccess!
    allowCoachHourEdit: Boolean!
    reportFrequencies: [String!]!
  }

  type OrgSeason {
    id: ID!
    name: String!
    startMonth: Int!
    endMonth: Int!
    organizationId: ID!
    createdAt: String!
    updatedAt: String!
  }

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

  enum AthleteStatus {
    ACTIVE
    SUSPENDED
    QUIT
    RETIRED
  }

  type OrganizationMember {
    id: ID!
    user: User!
    organization: Organization!
    role: OrgRole!
    athleteStatus: AthleteStatus!
    hourlyRate: Float
    joinedAt: String!
  }

  type AthleteStatusRecord {
    id: ID!
    status: AthleteStatus!
    note: String
    changedByUser: User!
    createdAt: String!
  }

  type GymnasticsProfile {
    id: ID!
    userId: ID!
    organizationId: ID!
    level: String
    discipline: String
    apparatus: [String!]!
    notes: String
    updatedAt: String!
  }

  type Venue {
    id: ID!
    name: String!
    address: String
    city: String
    state: String
    country: String
    notes: String
    organizationId: ID!
    createdAt: String!
    updatedAt: String!
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
    venue: Venue
    participatingTeams: [Team!]!
    checkIns: [CheckIn!]!
    rsvps: [EventRsvp!]!
    recurringEvent: RecurringEvent
    includedAthletes: [User!]!
    excludedAthletes: [User!]!
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
    venue: Venue
    events: [Event!]!
    includedAthletes: [User!]!
    excludedAthletes: [User!]!
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
    isAdHoc: Boolean!
    approved: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type ExcuseRequest {
    id: ID!
    user: User!
    event: Event!
    reason: String!
    status: ExcuseRequestStatus!
    attemptCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type EventRsvp {
    id: ID!
    userId: ID!
    eventId: ID!
    status: RsvpStatus!
    note: String
    createdAt: String!
    updatedAt: String!
    user: User!
    event: Event!
  }

  type Invite {
    id: ID!
    email: String!
    organization: Organization!
    role: OrgRole!
    teamIds: [String!]!
    athleteId: String
    token: String!
    status: InviteStatus!
    createdAt: String!
    expiresAt: String!
  }

  type GuardianLink {
    id: ID!
    guardian: User!
    athlete: User!
    organization: Organization!
    createdAt: String!
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

  type UploadUrl {
    uploadUrl: String!
    publicUrl: String!
  }

  type DeviceToken {
    id: ID!
    userId: ID!
    token: String!
    platform: Platform!
    endpoint: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type NotificationPreferences {
    id: ID!
    userId: ID!
    emailEnabled: Boolean!
    pushEnabled: Boolean!
    smsEnabled: Boolean!
    eventRemindersEnabled: Boolean!
    eventReminderMinutes: Int!
    announcementsEnabled: Boolean!
    excuseStatusEnabled: Boolean!
    milestonesEnabled: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Announcement {
    id: ID!
    title: String!
    message: String!
    organizationId: ID!
    organization: Organization!
    createdBy: ID!
    creator: User!
    targetType: AnnouncementTarget!
    teamIds: [ID!]!
    userIds: [ID!]!
    eventDate: String
    scheduledFor: String
    sentAt: String
    createdAt: String!
    updatedAt: String!
  }

  type EmailReportConfig {
    id: ID!
    userId: ID!
    user: User!
    organizationId: ID!
    organization: Organization!
    frequency: ReportFrequency!
    enabled: Boolean!
    lastSentAt: String
    createdAt: String!
    updatedAt: String!
  }

  type NotificationDelivery {
    id: ID!
    userId: ID!
    user: User!
    type: NotificationType!
    channel: NotificationChannel!
    title: String!
    message: String!
    metadata: String
    status: DeliveryStatus!
    errorMessage: String
    sentAt: String
    readAt: String
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

  type CoachHoursEntry {
    event: Event!
    checkIn: CheckIn
    hoursLogged: Float!
  }

  type CoachMonthlyHours {
    userId: ID!
    user: User!
    totalHours: Float!
    totalPay: Float
    hourlyRate: Float
    entries: [CoachHoursEntry!]!
  }

  type OrgCoachHoursSummary {
    coaches: [CoachMonthlyHours!]!
    month: Int!
    year: Int!
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

  type EventsCount {
    PRACTICE: Int!
    MEETING: Int!
    EVENT: Int!
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
    dateOfBirth: String
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

  input CreateOrgSeasonInput {
    name: String!
    startMonth: Int!
    endMonth: Int!
    organizationId: ID!
  }

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

  input AdHocNfcCheckInInput {
    token: String!
    teamId: ID!
    startTime: String!
    endTime: String!
    note: String
  }

  input CreateVenueInput {
    name: String!
    address: String
    city: String
    state: String
    country: String
    notes: String
    organizationId: ID!
  }

  input UpdateVenueInput {
    name: String
    address: String
    city: String
    state: String
    country: String
    notes: String
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
    venueId: ID
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
    venueId: ID
    includedUserIds: [ID!]
    excludedUserIds: [ID!]
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
    checkInTime: String
    checkOutTime: String
  }

  input CheckOutInput {
    checkInId: ID!
  }

  input SubmitFeedbackInput {
    category: FeedbackCategory!
    message: String!
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

  input RegisterDeviceTokenInput {
    token: String!
    platform: Platform!
  }

  input UpdateNotificationPreferencesInput {
    emailEnabled: Boolean
    pushEnabled: Boolean
    smsEnabled: Boolean
    eventRemindersEnabled: Boolean
    eventReminderMinutes: Int
    announcementsEnabled: Boolean
    excuseStatusEnabled: Boolean
    milestonesEnabled: Boolean
  }

  input CreateAnnouncementInput {
    title: String!
    message: String!
    organizationId: ID!
    targetType: AnnouncementTarget!
    teamIds: [ID!]
    userIds: [ID!]
    eventDate: String
    scheduledFor: String
  }

  input CreateEmailReportConfigInput {
    organizationId: ID!
    frequency: ReportFrequency!
  }

  input UpsertRsvpInput {
    userId: ID!
    eventId: ID!
    status: RsvpStatus!
    note: String
  }

  input CreateEmergencyContactInput {
    userId: ID!
    organizationId: ID!
    name: String!
    relationship: String!
    phone: String!
    email: String
    isPrimary: Boolean
  }

  input UpdateEmergencyContactInput {
    name: String
    relationship: String
    phone: String
    email: String
    isPrimary: Boolean
  }

  input UpsertMedicalInfoInput {
    userId: ID!
    organizationId: ID!
    conditions: String
    allergies: String
    medications: String
    insuranceProvider: String
    insurancePolicyNumber: String
    insuranceGroupNumber: String
    notes: String
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
    teams(organizationId: ID!, includeArchived: Boolean): [Team!]!

    # Season queries
    orgSeasons(organizationId: ID!): [OrgSeason!]!

    # Event queries
    event(id: ID!): Event
    events(organizationId: ID!, type: EventType, teamId: ID, startDate: String, endDate: String, limit: Int, offset: Int): [Event!]!
    eventsCount(organizationId: ID!, teamId: ID): EventsCount!
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

    # RSVP queries
    myRsvps(userId: ID!): [EventRsvp!]!

    # Venue queries
    venue(id: ID!): Venue
    organizationVenues(organizationId: ID!): [Venue!]!

    # Calendar export
    exportCalendar(organizationId: ID!, teamId: ID, startDate: String, endDate: String): String!

    # Recurring event queries
    recurringEvent(id: ID!): RecurringEvent
    recurringEvents(organizationId: ID!): [RecurringEvent!]!

    # NFC queries
    organizationNfcTags(organizationId: ID!): [NfcTag!]!
    pendingAdHocCheckIns(organizationId: ID!): [CheckIn!]!
    activeCheckIn(userId: ID): CheckIn

    # Invite queries
    invite(token: String!): Invite
    myPendingInvites: [Invite!]!

    # Guardian queries
    myGuardians(organizationId: ID!): [GuardianLink!]!
    myLinkedAthletes(organizationId: ID!): [GuardianLink!]!
    athleteGuardians(userId: ID!, organizationId: ID!): [GuardianLink!]!

    # Athlete status & profile queries
    athleteStatusHistory(userId: ID!, organizationId: ID!): [AthleteStatusRecord!]!
    gymnasticsProfile(userId: ID!, organizationId: ID!): GymnasticsProfile

    # Attendance log queries
    attendanceLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    absentExcusedLog(organizationId: ID!, limit: Int, offset: Int): [CheckIn!]!
    allAttendanceRecords(organizationId: ID!, search: String, status: AttendanceStatus, teamId: ID, userId: ID, startDate: String, endDate: String, sortField: String, sortDir: String, limit: Int, offset: Int): [CheckIn!]!
    attendanceRecordsCount(organizationId: ID!, search: String, status: AttendanceStatus, teamId: ID, userId: ID, startDate: String, endDate: String): Int!
    attendanceInsights(organizationId: ID!, teamId: ID, timeRange: TimeRange): AttendanceInsights!
    teamAttendanceRecords(teamId: ID!, limit: Int, offset: Int): [CheckIn!]!

    # Analytics queries
    userStats(userId: ID!, organizationId: ID!, teamId: ID, timeRange: TimeRange): UserStats!
    teamLeaderboard(teamId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    organizationLeaderboard(organizationId: ID!, timeRange: TimeRange, limit: Int): [LeaderboardEntry!]!
    teamRankings(organizationId: ID!, timeRange: TimeRange): [TeamRanking!]!
    recentActivity(organizationId: ID!, limit: Int): [RecentActivity!]!

    # Coach hours / payroll queries
    coachMyHours(organizationId: ID!, month: Int!, year: Int!): CoachMonthlyHours!
    orgCoachHours(organizationId: ID!, month: Int!, year: Int!): OrgCoachHoursSummary!

    # Notification queries
    myNotificationPreferences: NotificationPreferences
    myDeviceTokens: [DeviceToken!]!
    myEmailReportConfigs: [EmailReportConfig!]!
    organizationAnnouncements(organizationId: ID!, limit: Int): [Announcement!]!
    notificationHistory(limit: Int): [NotificationDelivery!]!
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

    # Athlete status & profile mutations
    updateAthleteStatus(userId: ID!, organizationId: ID!, status: AthleteStatus!, note: String): OrganizationMember!
    upsertGymnasticsProfile(userId: ID!, organizationId: ID!, level: String, discipline: String, apparatus: [String!], notes: String): GymnasticsProfile!

    # Season mutations
    createOrgSeason(input: CreateOrgSeasonInput!): OrgSeason!
    updateOrgSeason(id: ID!, name: String, startMonth: Int, endMonth: Int): OrgSeason!
    deleteOrgSeason(id: ID!): Boolean!

    # Team mutations
    createTeam(input: CreateTeamInput!): Team!
    updateTeam(id: ID!, name: String, season: String, sport: String, color: String, description: String, orgSeasonId: ID, seasonYear: Int): Team!
    deleteTeam(id: ID!, hardDelete: Boolean): Boolean!
    restoreTeam(id: ID!): Team!
    addTeamMember(input: AddTeamMemberInput!): TeamMember!
    removeTeamMember(userId: ID!, teamId: ID!): Boolean!
    updateTeamMemberRole(userId: ID!, teamId: ID!, role: TeamRole!): TeamMember!

    # Venue mutations
    createVenue(input: CreateVenueInput!): Venue!
    updateVenue(id: ID!, input: UpdateVenueInput!): Venue!
    deleteVenue(id: ID!): Boolean!

    # Event mutations
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, title: String, type: EventType, date: String, endDate: String, startTime: String, endTime: String, location: String, description: String, venueId: ID): Event!
    deleteEvent(id: ID!): Boolean!
    addAthleteToEvent(eventId: ID!, userId: ID!): Event!
    removeAthleteFromEvent(eventId: ID!, userId: ID!): Event!
    excludeAthleteFromEvent(eventId: ID!, userId: ID!): Event!
    unexcludeAthleteFromEvent(eventId: ID!, userId: ID!): Event!

    # Recurring event mutations
    createRecurringEvent(input: CreateRecurringEventInput!): RecurringEvent!
    deleteRecurringEvent(id: ID!, futureOnly: Boolean): Boolean!
    addAthleteToRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    removeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    excludeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    unexcludeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!

    # Check-in mutations
    markAbsentForPastEvents(organizationId: ID!): Int!
    checkIn(input: CheckInInput!): CheckIn!
    checkOut(input: CheckOutInput!): CheckIn!
    markAbsent(userId: ID!, eventId: ID!): CheckIn!
    adminCheckIn(input: AdminCheckInInput!): CheckIn!
    deleteCheckIn(userId: ID!, eventId: ID!): Boolean!

    # Invite mutations
    createInvite(input: CreateInviteInput!): Invite!
    acceptInvite(token: String!): OrganizationMember!
    cancelInvite(id: ID!): Boolean!
    resendInvite(id: ID!): Invite!

    # Guardian mutations
    inviteGuardian(email: String!, organizationId: ID!, athleteId: ID): Invite!
    removeGuardian(guardianLinkId: ID!): Boolean!

    # NFC mutations
    registerNfcTag(input: RegisterNfcTagInput!): NfcTag!
    deactivateNfcTag(id: ID!): NfcTag!
    nfcCheckIn(token: String!, forUserId: ID): NfcCheckInResult!
    adHocNfcCheckIn(input: AdHocNfcCheckInInput!): NfcCheckInResult!
    approveAdHocCheckIn(checkInId: ID!): CheckIn!
    denyAdHocCheckIn(checkInId: ID!): Boolean!

    # Upload mutations
    generateUploadUrl(fileType: String!): UploadUrl!

    # Feedback mutations
    submitFeedback(input: SubmitFeedbackInput!): Boolean!

    # Excuse mutations
    createExcuseRequest(input: CreateExcuseRequestInput!): ExcuseRequest!
    updateExcuseRequest(input: UpdateExcuseRequestInput!): ExcuseRequest!
    cancelExcuseRequest(id: ID!): Boolean!

    # RSVP mutations
    upsertRsvp(input: UpsertRsvpInput!): EventRsvp!
    deleteRsvp(userId: ID!, eventId: ID!): Boolean!

    # Notification read mutations
    markNotificationRead(id: ID!): NotificationDelivery!
    markAllNotificationsRead: Int!

    # Account mutations
    deleteMyAccount: Boolean!

    # Notification mutations
    registerDeviceToken(input: RegisterDeviceTokenInput!): DeviceToken!
    unregisterDeviceToken(tokenId: ID!): Boolean!
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): NotificationPreferences!
    createAnnouncement(input: CreateAnnouncementInput!): Announcement!
    sendAnnouncement(id: ID!): Boolean!
    deleteAnnouncement(id: ID!): Boolean!
    createEmailReportConfig(input: CreateEmailReportConfigInput!): EmailReportConfig!
    updateEmailReportConfig(id: ID!, frequency: ReportFrequency, enabled: Boolean): EmailReportConfig!
    deleteEmailReportConfig(id: ID!): Boolean!
    sendTestReport(configId: ID!): Boolean!

    # Coach hours / payroll mutations
    updateCoachHourlyRate(organizationId: ID!, userId: ID!, hourlyRate: Float): OrganizationMember!

    # Health & Safety mutations
    createEmergencyContact(input: CreateEmergencyContactInput!): EmergencyContact!
    updateEmergencyContact(id: ID!, input: UpdateEmergencyContactInput!): EmergencyContact!
    deleteEmergencyContact(id: ID!): Boolean!
    upsertMedicalInfo(input: UpsertMedicalInfoInput!): MedicalInfo!
    updateOrganizationSettings(id: ID!, adminHealthAccess: AdminHealthAccess, coachHealthAccess: CoachHealthAccess, allowCoachHourEdit: Boolean, reportFrequencies: [String!]): Organization!
    updateCheckInTimes(checkInId: ID!, checkInTime: String, checkOutTime: String): CheckIn!
  }
`;
