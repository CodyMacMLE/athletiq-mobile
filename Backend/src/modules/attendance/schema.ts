export const attendanceSchema = `#graphql
  # ---- Enums ----
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

  enum RsvpStatus {
    GOING
    NOT_GOING
    MAYBE
  }

  # ---- Types ----
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

  type ExcuseRequestPage {
    items: [ExcuseRequest!]!
    total: Int!
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

  # ---- Inputs ----
  input CheckInInput {
    userId: ID!
    eventId: ID!
  }

  input CheckOutInput {
    checkInId: ID!
  }

  input AdminCheckInInput {
    userId: ID!
    eventId: ID!
    status: AttendanceStatus!
    note: String
    checkInTime: String
    checkOutTime: String
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

  input UpsertRsvpInput {
    userId: ID!
    eventId: ID!
    status: RsvpStatus!
    note: String
  }

  # ---- Queries ----
  extend type Query {
    checkIn(id: ID!): CheckIn
    checkInHistory(userId: ID!, teamId: ID, limit: Int): [CheckIn!]!
    eventAttendance(eventId: ID!): [CheckIn!]!
    eventUncheckedAthletes(eventId: ID!): [User!]!
    excuseRequest(id: ID!): ExcuseRequest
    myExcuseRequests(userId: ID!): [ExcuseRequest!]!
    pendingExcuseRequests(organizationId: ID!): [ExcuseRequest!]!
    orgExcuseRequests(organizationId: ID!, status: String, requesterType: String, search: String, sortBy: String, sortDir: String, limit: Int, offset: Int): ExcuseRequestPage!
    myRsvps(userId: ID!): [EventRsvp!]!
    activeCheckIn(userId: ID): CheckIn
  }

  # ---- Mutations ----
  extend type Mutation {
    checkIn(input: CheckInInput!): CheckIn!
    checkOut(input: CheckOutInput!): CheckIn!
    adminCheckIn(input: AdminCheckInInput!): CheckIn!
    deleteCheckIn(userId: ID!, eventId: ID!): Boolean!
    markAbsent(userId: ID!, eventId: ID!): CheckIn!
    markAbsentForPastEvents(organizationId: ID!): Int!
    createExcuseRequest(input: CreateExcuseRequestInput!): ExcuseRequest!
    updateExcuseRequest(input: UpdateExcuseRequestInput!): ExcuseRequest!
    cancelExcuseRequest(id: ID!): Boolean!
    upsertRsvp(input: UpsertRsvpInput!): EventRsvp!
    deleteRsvp(userId: ID!, eventId: ID!): Boolean!
    updateCheckInTimes(checkInId: ID!, checkInTime: String, checkOutTime: String): CheckIn!
  }
`;
