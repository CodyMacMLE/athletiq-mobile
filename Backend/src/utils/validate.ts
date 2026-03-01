import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

const shortStr = (max = 100) =>
  z.string().min(1, "Must not be empty").max(max, `Must be ${max} chars or fewer`).trim();

const optionalShortStr = (max = 100) =>
  z.string().max(max, `Must be ${max} chars or fewer`).trim().optional();

const longStr = (max = 2000) =>
  z.string().max(max, `Must be ${max} chars or fewer`).trim().optional();

const emailSchema = z.string().email("Must be a valid email address").trim().toLowerCase();

const optionalEmail = z.string().email("Must be a valid email address").trim().toLowerCase().optional();

// ─── validate() ───────────────────────────────────────────────────────────────

/**
 * Parse and validate `data` against `schema`.
 * Throws a plain Error with a human-readable message on failure
 * so it surfaces cleanly as a GraphQL error to the client.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Zod v4: ZodError extends $ZodError which has .issues; use type assertion to access it.
    const err = result.error as unknown as { issues?: Array<{ message: string }>; toString?(): string };
    const issues = err.issues ?? [];
    const message = issues.length > 0
      ? issues.map((i) => i.message).join("; ")
      : String(result.error);
    throw new Error(`Validation error: ${message}`);
  }
  return result.data;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const createUserInputSchema = z.object({
  email: emailSchema,
  firstName: shortStr(100),
  lastName: shortStr(100),
  phone: optionalShortStr(30),
  address: optionalShortStr(200),
  city: optionalShortStr(100),
  country: optionalShortStr(100),
  image: optionalShortStr(500),
});

export const updateUserInputSchema = z.object({
  firstName: optionalShortStr(100),
  lastName: optionalShortStr(100),
  dateOfBirth: optionalShortStr(20),
  phone: optionalShortStr(30),
  address: optionalShortStr(200),
  city: optionalShortStr(100),
  country: optionalShortStr(100),
  bio: z.string().max(500, "Bio must be 500 chars or fewer").trim().optional(),
  image: optionalShortStr(500),
});

// ─── Organization ─────────────────────────────────────────────────────────────

export const createOrganizationInputSchema = z.object({
  name: shortStr(100),
  description: longStr(500),
  sport: optionalShortStr(50),
  city: optionalShortStr(100),
  country: optionalShortStr(100),
  logo: optionalShortStr(500),
});

// ─── Event ────────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  "PRACTICE", "GAME", "MEETING", "TOURNAMENT", "SCRIMMAGE", "OTHER",
  "practice", "game", "meeting", "tournament", "scrimmage", "other",
] as const;

export const createEventInputSchema = z.object({
  title: shortStr(200),
  description: longStr(1000),
  date: shortStr(20),
  startTime: shortStr(20),
  endTime: shortStr(20),
  type: z.enum(EVENT_TYPES, { message: "Invalid event type" }),
  organizationId: shortStr(50),
  teamId: optionalShortStr(50),
  location: optionalShortStr(200),
  venueId: optionalShortStr(50),
  notes: longStr(2000),
});

export const updateEventInputSchema = createEventInputSchema.partial().omit({ organizationId: true });

// ─── Excuse Request ───────────────────────────────────────────────────────────

export const createExcuseRequestInputSchema = z.object({
  eventId: shortStr(50),
  reason: shortStr(1000),
});

// ─── Emergency Contact ────────────────────────────────────────────────────────

export const createEmergencyContactInputSchema = z.object({
  name: shortStr(100),
  relationship: shortStr(50),
  phone: shortStr(30),
  email: optionalEmail,
  isPrimary: z.boolean().optional(),
});

export const updateEmergencyContactInputSchema = createEmergencyContactInputSchema.partial();

// ─── Medical Info ─────────────────────────────────────────────────────────────

export const upsertMedicalInfoInputSchema = z.object({
  conditions: z.array(z.string().max(200)).max(50).optional(),
  allergies: z.array(z.string().max(200)).max(50).optional(),
  medications: z.array(z.string().max(200)).max(50).optional(),
  insuranceProvider: optionalShortStr(100),
  insurancePolicyNumber: optionalShortStr(50),
  insuranceGroupNumber: optionalShortStr(50),
  notes: longStr(2000),
});

// ─── Custom Role ──────────────────────────────────────────────────────────────

export const createCustomRoleInputSchema = z.object({
  name: shortStr(50),
  description: z.string().max(500, "Must be 500 chars or fewer").trim().optional(),
  canEditEvents: z.boolean().optional(),
  canApproveExcuses: z.boolean().optional(),
  canViewAnalytics: z.boolean().optional(),
  canManageMembers: z.boolean().optional(),
  canManageTeams: z.boolean().optional(),
  canManagePayments: z.boolean().optional(),
});

export const updateCustomRoleInputSchema = createCustomRoleInputSchema.partial();

// ─── Team Challenge ───────────────────────────────────────────────────────────

export const createTeamChallengeInputSchema = z.object({
  teamId: shortStr(50),
  organizationId: shortStr(50),
  title: shortStr(200),
  description: longStr(1000),
  targetPercent: z
    .number()
    .min(0, "Target percent must be at least 0")
    .max(100, "Target percent must be at most 100"),
  startDate: shortStr(20),
  endDate: shortStr(20),
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

export const submitFeedbackInputSchema = z.object({
  message: shortStr(2000),
  category: optionalShortStr(50),
});

// ─── Payments (#27) ───────────────────────────────────────────────────────────

const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
const PAYMENT_METHODS = ["STRIPE", "CASH", "CHECK", "BANK_TRANSFER", "OTHER"] as const;

export const createInvoiceInputSchema = z.object({
  organizationId: shortStr(50),
  userId: shortStr(50),
  title: shortStr(200),
  description: longStr(1000),
  amountCents: z.number().int("Amount must be a whole number of cents").min(1, "Amount must be at least 1 cent").max(100_000_00, "Amount exceeds maximum"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("usd"),
  dueDate: optionalShortStr(20),
});

export const updateInvoiceInputSchema = z.object({
  title: optionalShortStr(200),
  description: longStr(1000),
  amountCents: z.number().int().min(1).max(100_000_00).optional(),
  dueDate: optionalShortStr(20),
  status: z.enum(INVOICE_STATUSES).optional(),
});

export const recordPaymentInputSchema = z.object({
  invoiceId: shortStr(50),
  amountCents: z.number().int("Amount must be a whole number of cents").min(1, "Amount must be at least 1 cent").max(100_000_00, "Amount exceeds maximum"),
  method: z.enum(PAYMENT_METHODS, { message: "Invalid payment method" }).optional(),
  note: longStr(500),
  paidAt: optionalShortStr(30),
});
