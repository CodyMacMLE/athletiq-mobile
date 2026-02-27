export const organizationsSchema = `#graphql
  # ---- Enums ----
  enum OrgRole {
    OWNER
    ADMIN
    MANAGER
    COACH
    ATHLETE
    GUARDIAN
  }

  enum InviteStatus {
    PENDING
    ACCEPTED
    EXPIRED
  }

  # ---- Types ----
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
    payrollConfig: PayrollConfig
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

  type OrganizationMember {
    id: ID!
    user: User!
    organization: Organization!
    role: OrgRole!
    athleteStatus: AthleteStatus!
    hourlyRate: Float
    salaryAmount: Float
    joinedAt: String!
    customRole: CustomRole
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

  # ---- Inputs ----
  input CreateOrganizationInput {
    name: String!
    image: String
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

  input CreateOrgSeasonInput {
    name: String!
    startMonth: Int!
    endMonth: Int!
    organizationId: ID!
  }

  # ---- Queries ----
  extend type Query {
    organization(id: ID!): Organization
    organizations: [Organization!]!
    myOrganizations: [Organization!]!
    orgSeasons(organizationId: ID!): [OrgSeason!]!
    invite(token: String!): Invite
    myPendingInvites: [Invite!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    createOrganization(input: CreateOrganizationInput!): Organization!
    updateOrganization(id: ID!, name: String, image: String): Organization!
    deleteOrganization(id: ID!): Boolean!
    addOrgMember(input: AddOrgMemberInput!): OrganizationMember!
    updateOrgMemberRole(userId: ID!, organizationId: ID!, role: OrgRole!): OrganizationMember!
    removeOrgMember(userId: ID!, organizationId: ID!): Boolean!
    leaveOrganization(organizationId: ID!): Boolean!
    transferOwnership(organizationId: ID!, newOwnerId: ID!): Boolean!
    createOrgSeason(input: CreateOrgSeasonInput!): OrgSeason!
    updateOrgSeason(id: ID!, name: String, startMonth: Int, endMonth: Int): OrgSeason!
    deleteOrgSeason(id: ID!): Boolean!
    createInvite(input: CreateInviteInput!): Invite!
    acceptInvite(token: String!): OrganizationMember!
    cancelInvite(id: ID!): Boolean!
    resendInvite(id: ID!): Invite!
  }
`;
