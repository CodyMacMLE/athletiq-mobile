export const eventsSchema = `#graphql
  # ---- Enums ----
  enum EventType {
    PRACTICE
    EVENT
    MEETING
    REST
  }

  enum RecurrenceFrequency {
    DAILY
    WEEKLY
    BIWEEKLY
    MONTHLY
  }

  # ---- Types ----
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
    organizationId: ID!
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

  type EventsCount {
    PRACTICE: Int!
    MEETING: Int!
    EVENT: Int!
  }

  # ---- Inputs ----
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

  # ---- Queries ----
  extend type Query {
    event(id: ID!): Event
    events(organizationId: ID!, type: EventType, teamId: ID, startDate: String, endDate: String, limit: Int, offset: Int): [Event!]!
    eventsCount(organizationId: ID!, teamId: ID): EventsCount!
    upcomingEvents(organizationId: ID!, teamId: ID, limit: Int): [Event!]!
    recurringEvent(id: ID!): RecurringEvent
    recurringEvents(organizationId: ID!): [RecurringEvent!]!
    venue(id: ID!): Venue
    organizationVenues(organizationId: ID!): [Venue!]!
    exportCalendar(organizationId: ID!, teamId: ID, startDate: String, endDate: String): String!
  }

  # ---- Mutations ----
  extend type Mutation {
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, title: String, type: EventType, date: String, endDate: String, startTime: String, endTime: String, location: String, description: String, venueId: ID): Event!
    deleteEvent(id: ID!): Boolean!
    createRecurringEvent(input: CreateRecurringEventInput!): RecurringEvent!
    deleteRecurringEvent(id: ID!, futureOnly: Boolean): Boolean!
    addAthleteToEvent(eventId: ID!, userId: ID!): Event!
    removeAthleteFromEvent(eventId: ID!, userId: ID!): Event!
    excludeAthleteFromEvent(eventId: ID!, userId: ID!): Event!
    unexcludeAthleteFromEvent(eventId: ID!, userId: ID!): Event!
    addAthleteToRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    removeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    excludeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    unexcludeAthleteFromRecurringEvent(recurringEventId: ID!, userId: ID!): RecurringEvent!
    createVenue(input: CreateVenueInput!): Venue!
    updateVenue(id: ID!, input: UpdateVenueInput!): Venue!
    deleteVenue(id: ID!): Boolean!
  }
`;
