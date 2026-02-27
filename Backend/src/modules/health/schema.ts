export const healthSchema = `#graphql
  # ---- Enums ----
  enum AdminHealthAccess {
    ADMINS_ONLY
    MANAGERS_AND_ADMINS
  }

  enum CoachHealthAccess {
    ORG_WIDE
    TEAM_ONLY
  }

  enum AthleteStatus {
    ACTIVE
    SUSPENDED
    QUIT
    RETIRED
  }

  # ---- Types ----
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

  # ---- Inputs ----
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

  # ---- Queries ----
  extend type Query {
    athleteStatusHistory(userId: ID!, organizationId: ID!): [AthleteStatusRecord!]!
    gymnasticsProfile(userId: ID!, organizationId: ID!): GymnasticsProfile
  }

  # ---- Mutations ----
  extend type Mutation {
    updateAthleteStatus(userId: ID!, organizationId: ID!, status: AthleteStatus!, note: String): OrganizationMember!
    upsertGymnasticsProfile(userId: ID!, organizationId: ID!, level: String, discipline: String, apparatus: [String!], notes: String): GymnasticsProfile!
    createEmergencyContact(input: CreateEmergencyContactInput!): EmergencyContact!
    updateEmergencyContact(id: ID!, input: UpdateEmergencyContactInput!): EmergencyContact!
    deleteEmergencyContact(id: ID!): Boolean!
    upsertMedicalInfo(input: UpsertMedicalInfoInput!): MedicalInfo!
    updateOrganizationSettings(id: ID!, adminHealthAccess: AdminHealthAccess, coachHealthAccess: CoachHealthAccess, allowCoachHourEdit: Boolean, reportFrequencies: [String!]): Organization!
  }
`;
