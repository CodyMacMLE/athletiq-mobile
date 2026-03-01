export const paymentsSchema = `#graphql
  # ---- Types ----

  type Invoice {
    id: ID!
    organizationId: ID!
    userId: ID!
    user: User!
    title: String!
    description: String
    amountCents: Int!
    currency: String!
    dueDate: String
    status: InvoiceStatus!
    stripeInvoiceId: String
    sentAt: String
    paidAt: String
    creator: User!
    payments: [Payment!]!
    totalPaidCents: Int!
    balanceCents: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Payment {
    id: ID!
    invoiceId: ID!
    organizationId: ID!
    userId: ID!
    user: User!
    amountCents: Int!
    currency: String!
    method: PaymentMethod!
    stripePaymentIntentId: String
    note: String
    paidAt: String!
    recorder: User!
    createdAt: String!
  }

  type OrgBalanceSummary {
    totalOutstandingCents: Int!
    totalPaidCents: Int!
    overdueCount: Int!
    draftCount: Int!
    sentCount: Int!
  }

  type StripePaymentIntentResult {
    clientSecret: String!
    paymentIntentId: String!
  }

  enum InvoiceStatus {
    DRAFT
    SENT
    PAID
    OVERDUE
    CANCELLED
  }

  enum PaymentMethod {
    STRIPE
    CASH
    CHECK
    BANK_TRANSFER
    OTHER
  }

  # ---- Queries ----
  extend type Query {
    orgInvoices(organizationId: ID!, status: InvoiceStatus, userId: ID): [Invoice!]!
    memberInvoices(userId: ID!, organizationId: ID!): [Invoice!]!
    invoice(id: ID!): Invoice
    orgBalanceSummary(organizationId: ID!): OrgBalanceSummary!
  }

  # ---- Mutations ----
  extend type Mutation {
    createInvoice(organizationId: ID!, userId: ID!, title: String!, description: String, amountCents: Int!, currency: String, dueDate: String): Invoice!
    updateInvoice(id: ID!, title: String, description: String, amountCents: Int, dueDate: String, status: InvoiceStatus): Invoice!
    deleteInvoice(id: ID!): Boolean!
    sendInvoice(id: ID!): Invoice!
    recordPayment(invoiceId: ID!, amountCents: Int!, method: PaymentMethod, note: String, paidAt: String): Payment!
    createStripePaymentIntent(invoiceId: ID!): StripePaymentIntentResult!
    sendPaymentReminder(invoiceId: ID!): Boolean!
  }
`;
