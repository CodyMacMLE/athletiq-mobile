export const usersSchema = `#graphql
  # ---- Types ----
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

  # ---- Inputs ----
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

  # ---- Queries ----
  extend type Query {
    me: User
    user(id: ID!): User
    users: [User!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
    deleteMyAccount: Boolean!
  }
`;
