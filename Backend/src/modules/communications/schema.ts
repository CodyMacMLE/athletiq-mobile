export const communicationsSchema = `#graphql
  # ---- Enums ----
  enum FeedbackCategory {
    BUG
    FEATURE
    QUESTION
    OTHER
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

  # ---- Types ----
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

  # ---- Inputs ----
  input SubmitFeedbackInput {
    category: FeedbackCategory!
    message: String!
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

  # ---- Queries ----
  extend type Query {
    myNotificationPreferences: NotificationPreferences
    myDeviceTokens: [DeviceToken!]!
    myEmailReportConfigs: [EmailReportConfig!]!
    organizationAnnouncements(organizationId: ID!, limit: Int): [Announcement!]!
    notificationHistory(limit: Int): [NotificationDelivery!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    submitFeedback(input: SubmitFeedbackInput!): Boolean!
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
    markNotificationRead(id: ID!): NotificationDelivery!
    markAllNotificationsRead: Int!
  }
`;
