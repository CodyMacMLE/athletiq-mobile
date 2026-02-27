export const mediaSchema = `#graphql
  # ---- Enums ----
  enum NfcCheckInAction {
    CHECKED_IN
    CHECKED_OUT
  }

  # ---- Types ----
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

  # ---- Inputs ----
  input AdHocNfcCheckInInput {
    token: String!
    teamId: ID!
    startTime: String!
    endTime: String!
    note: String
  }

  input RegisterNfcTagInput {
    token: String!
    name: String!
    organizationId: ID!
  }

  # ---- Queries ----
  extend type Query {
    organizationNfcTags(organizationId: ID!): [NfcTag!]!
    pendingAdHocCheckIns(organizationId: ID!): [CheckIn!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    registerNfcTag(input: RegisterNfcTagInput!): NfcTag!
    deactivateNfcTag(id: ID!): NfcTag!
    nfcCheckIn(token: String!, forUserId: ID, teamId: ID): NfcCheckInResult!
    adHocNfcCheckIn(input: AdHocNfcCheckInInput!): NfcCheckInResult!
    approveAdHocCheckIn(checkInId: ID!): CheckIn!
    denyAdHocCheckIn(checkInId: ID!): Boolean!
    generateUploadUrl(fileType: String!): UploadUrl!
  }
`;
