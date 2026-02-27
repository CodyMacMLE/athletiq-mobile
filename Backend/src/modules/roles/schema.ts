export const rolesSchema = `#graphql
  # ---- Types ----
  type CustomRole {
    id: ID!
    name: String!
    description: String
    canEditEvents: Boolean!
    canApproveExcuses: Boolean!
    canViewAnalytics: Boolean!
    canManageMembers: Boolean!
    canManageTeams: Boolean!
    canManagePayments: Boolean!
  }

  # ---- Queries ----
  extend type Query {
    customRoles(organizationId: ID!): [CustomRole!]!
  }

  # ---- Mutations ----
  extend type Mutation {
    createCustomRole(organizationId: ID!, name: String!, description: String, canEditEvents: Boolean, canApproveExcuses: Boolean, canViewAnalytics: Boolean, canManageMembers: Boolean, canManageTeams: Boolean, canManagePayments: Boolean): CustomRole!
    updateCustomRole(id: ID!, name: String, description: String, canEditEvents: Boolean, canApproveExcuses: Boolean, canViewAnalytics: Boolean, canManageMembers: Boolean, canManageTeams: Boolean, canManagePayments: Boolean): CustomRole!
    deleteCustomRole(id: ID!): Boolean!
    assignCustomRole(memberId: ID!, customRoleId: ID): OrganizationMember!
  }
`;
