import Stripe from "stripe";
import { prisma } from "../../db.js";
import { requireAuth, requireOrgAdmin, requireCoachOrAbove } from "../../utils/permissions.js";
import {
  validate,
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
  recordPaymentInputSchema,
} from "../../utils/validate.js";
import { sendInvoiceEmail, sendPaymentReminderEmail } from "../../email.js";
import { toISO } from "../../utils/time.js";
import { logger } from "../../utils/logger.js";

// Platform Stripe client — used for Connect account management and split charges.
// The same secret key doubles as the platform key when Connect is enabled.
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" })
  : null;

const PLATFORM_FEE_PERCENT = 0.02; // 2% platform fee

// ─── helpers ──────────────────────────────────────────────────────────────────

function withPaymentTotals(invoice: any) {
  const totalPaidCents = (invoice.payments ?? []).reduce(
    (sum: number, p: any) => sum + p.amountCents,
    0
  );
  return {
    ...invoice,
    totalPaidCents,
    balanceCents: Math.max(0, invoice.amountCents - totalPaidCents),
  };
}

const INVOICE_INCLUDE = {
  user: true,
  creator: true,
  payments: { include: { user: true, recorder: true }, orderBy: { paidAt: "desc" as const } },
};

// ─── resolvers ────────────────────────────────────────────────────────────────

export const paymentsResolvers = {
  Query: {
    orgInvoices: async (
      _: unknown,
      {
        organizationId,
        status,
        userId,
      }: { organizationId: string; status?: string; userId?: string },
      context: { userId?: string }
    ) => {
      await requireCoachOrAbove(context, organizationId);
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          ...(status && { status: status as any }),
          ...(userId && { userId }),
        },
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      return invoices.map(withPaymentTotals);
    },

    memberInvoices: async (
      _: unknown,
      { userId, organizationId }: { userId: string; organizationId: string },
      context: { userId?: string }
    ) => {
      const callerId = requireAuth(context);
      // Members can only view their own invoices; coaches/admins can view any
      if (callerId !== userId) {
        await requireCoachOrAbove(context, organizationId);
      }
      const invoices = await prisma.invoice.findMany({
        where: { userId, organizationId },
        include: INVOICE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      return invoices.map(withPaymentTotals);
    },

    invoice: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      const callerId = requireAuth(context);
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: INVOICE_INCLUDE,
      });
      if (!invoice) return null;
      // Must be the recipient or a coach/admin
      if (invoice.userId !== callerId) {
        await requireCoachOrAbove(context, invoice.organizationId);
      }
      return withPaymentTotals(invoice);
    },

    stripeConnectStatus: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      await requireOrgAdmin(context, organizationId);
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { stripeAccountId: true, stripeAccountEnabled: true },
      });

      if (!org.stripeAccountId) {
        return { connected: false, enabled: false, accountId: null, dashboardUrl: null };
      }

      // Fetch a fresh Express dashboard login link when fully enabled
      let dashboardUrl: string | null = null;
      if (org.stripeAccountEnabled && stripeClient) {
        try {
          const loginLink = await stripeClient.accounts.createLoginLink(org.stripeAccountId);
          dashboardUrl = loginLink.url;
        } catch {
          // Non-fatal — just omit the dashboard link
        }
      }

      return {
        connected: true,
        enabled: org.stripeAccountEnabled,
        accountId: org.stripeAccountId,
        dashboardUrl,
      };
    },

    orgBalanceSummary: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      await requireCoachOrAbove(context, organizationId);

      const [outstanding, overdueCount, draftCount, sentCount, paidInvoices] =
        await Promise.all([
          prisma.invoice.findMany({
            where: { organizationId, status: { in: ["SENT", "OVERDUE"] } },
            include: { payments: { select: { amountCents: true } } },
          }),
          prisma.invoice.count({ where: { organizationId, status: "OVERDUE" } }),
          prisma.invoice.count({ where: { organizationId, status: "DRAFT" } }),
          prisma.invoice.count({ where: { organizationId, status: "SENT" } }),
          prisma.invoice.findMany({
            where: { organizationId, status: "PAID" },
            include: { payments: { select: { amountCents: true } } },
          }),
        ]);

      const totalOutstandingCents = outstanding.reduce((sum, inv) => {
        const paid = inv.payments.reduce((s, p) => s + p.amountCents, 0);
        return sum + Math.max(0, inv.amountCents - paid);
      }, 0);

      const totalPaidCents = paidInvoices.reduce((sum, inv) => {
        return sum + inv.payments.reduce((s, p) => s + p.amountCents, 0);
      }, 0);

      return { totalOutstandingCents, totalPaidCents, overdueCount, draftCount, sentCount };
    },
  },

  Mutation: {
    createInvoice: async (
      _: unknown,
      {
        organizationId, userId, title, description, amountCents, currency, dueDate,
      }: {
        organizationId: string; userId: string; title: string; description?: string;
        amountCents: number; currency?: string; dueDate?: string;
      },
      context: { userId?: string }
    ) => {
      const createdBy = requireAuth(context);
      await requireCoachOrAbove(context, organizationId);
      validate(createInvoiceInputSchema, { organizationId, userId, title, description, amountCents, currency, dueDate });

      const invoice = await prisma.invoice.create({
        data: {
          organizationId,
          userId,
          title,
          ...(description !== undefined && { description }),
          amountCents,
          currency: currency ?? "usd",
          ...(dueDate && { dueDate: new Date(dueDate) }),
          createdBy,
        },
        include: INVOICE_INCLUDE,
      });
      return withPaymentTotals(invoice);
    },

    updateInvoice: async (
      _: unknown,
      {
        id, title, description, amountCents, dueDate, status,
      }: {
        id: string; title?: string; description?: string; amountCents?: number;
        dueDate?: string; status?: string;
      },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      const existing = await prisma.invoice.findUniqueOrThrow({ where: { id } });
      await requireCoachOrAbove(context, existing.organizationId);
      validate(updateInvoiceInputSchema, { title, description, amountCents, dueDate, status });

      const invoice = await prisma.invoice.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(amountCents !== undefined && { amountCents }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(status !== undefined && { status: status as any }),
        },
        include: INVOICE_INCLUDE,
      });
      return withPaymentTotals(invoice);
    },

    deleteInvoice: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      const existing = await prisma.invoice.findUniqueOrThrow({ where: { id } });
      await requireOrgAdmin(context, existing.organizationId);
      await prisma.invoice.delete({ where: { id } });
      return true;
    },

    sendInvoice: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      const existing = await prisma.invoice.findUniqueOrThrow({
        where: { id },
        include: { user: true, creator: true },
      });
      await requireCoachOrAbove(context, existing.organizationId);

      // Fire-and-forget email — don't let email failure block the mutation
      sendInvoiceEmail({
        to: existing.user.email,
        recipientName: `${existing.user.firstName} ${existing.user.lastName}`,
        senderName: `${existing.creator.firstName} ${existing.creator.lastName}`,
        invoiceTitle: existing.title,
        amountCents: existing.amountCents,
        currency: existing.currency,
        dueDate: existing.dueDate ? toISO(existing.dueDate) : undefined,
      }).catch((err) => logger.warn({ err, invoiceId: id }, "Failed to send invoice email"));

      const invoice = await prisma.invoice.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date() },
        include: INVOICE_INCLUDE,
      });
      return withPaymentTotals(invoice);
    },

    recordPayment: async (
      _: unknown,
      {
        invoiceId, amountCents, method, note, paidAt,
      }: {
        invoiceId: string; amountCents: number; method?: string; note?: string; paidAt?: string;
      },
      context: { userId?: string }
    ) => {
      const recordedBy = requireAuth(context);
      validate(recordPaymentInputSchema, { invoiceId, amountCents, method, note, paidAt });

      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { payments: { select: { amountCents: true } } },
      });
      await requireCoachOrAbove(context, invoice.organizationId);

      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            invoiceId,
            organizationId: invoice.organizationId,
            userId: invoice.userId,
            amountCents,
            currency: invoice.currency,
            method: (method as any) ?? "OTHER",
            ...(note !== undefined && { note }),
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            recordedBy,
          },
          include: { user: true, recorder: true },
        });

        // Auto-mark invoice as PAID when balance reaches zero
        const totalPaid = invoice.payments.reduce((s, p) => s + p.amountCents, 0) + amountCents;
        if (totalPaid >= invoice.amountCents) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: "PAID", paidAt: new Date() },
          });
        }

        return p;
      });

      return payment;
    },

    createStripePaymentIntent: async (
      _: unknown,
      { invoiceId }: { invoiceId: string },
      context: { userId?: string }
    ) => {
      const callerId = requireAuth(context);

      if (!stripeClient) {
        throw new Error("Stripe is not configured on this server");
      }

      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { payments: { select: { amountCents: true } } },
      });

      // Only the invoice recipient or admins can initiate payment
      if (invoice.userId !== callerId) {
        await requireCoachOrAbove(context, invoice.organizationId);
      }

      const totalPaid = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
      const remaining = invoice.amountCents - totalPaid;

      if (remaining <= 0) {
        throw new Error("Invoice is already fully paid");
      }

      // Check if the org has a connected Stripe account — required for Stripe payments
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: invoice.organizationId },
        select: { stripeAccountId: true, stripeAccountEnabled: true },
      });

      if (!org.stripeAccountId || !org.stripeAccountEnabled) {
        throw new Error(
          "This organization has not connected a Stripe account. " +
          "An admin must complete Stripe onboarding in Settings before accepting card payments."
        );
      }

      // Create the PaymentIntent on the connected account.
      // application_fee_amount goes to the platform (AthletiQ); the rest goes to the org.
      const applicationFee = Math.round(remaining * PLATFORM_FEE_PERCENT);

      const intent = await stripeClient.paymentIntents.create(
        {
          amount: remaining,
          currency: invoice.currency,
          application_fee_amount: applicationFee,
          metadata: { invoiceId, organizationId: invoice.organizationId, userId: invoice.userId },
        },
        { stripeAccount: org.stripeAccountId }
      );

      // Store the payment intent ID on the invoice for webhook reconciliation
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { stripeInvoiceId: intent.id },
      });

      return { clientSecret: intent.client_secret!, paymentIntentId: intent.id };
    },

    sendPaymentReminder: async (
      _: unknown,
      { invoiceId }: { invoiceId: string },
      context: { userId?: string }
    ) => {
      requireAuth(context);
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { user: true, payments: { select: { amountCents: true } } },
      });
      await requireCoachOrAbove(context, invoice.organizationId);

      const totalPaid = invoice.payments.reduce((s, p) => s + p.amountCents, 0);
      const remaining = invoice.amountCents - totalPaid;

      sendPaymentReminderEmail({
        to: invoice.user.email,
        recipientName: `${invoice.user.firstName} ${invoice.user.lastName}`,
        invoiceTitle: invoice.title,
        amountCents: remaining,
        currency: invoice.currency,
        dueDate: invoice.dueDate ? toISO(invoice.dueDate) : undefined,
      }).catch((err) => logger.warn({ err, invoiceId }, "Failed to send payment reminder email"));

      return true;
    },

    // ── Stripe Connect ──────────────────────────────────────────────────────

    createStripeConnectLink: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      await requireOrgAdmin(context, organizationId);

      if (!stripeClient) {
        throw new Error("Stripe is not configured on this server");
      }

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { stripeAccountId: true },
      });

      // Create an Express account if this org doesn't have one yet
      let accountId = org.stripeAccountId;
      if (!accountId) {
        const account = await stripeClient.accounts.create({
          type: "express",
          metadata: { organizationId },
        });
        accountId = account.id;
        await prisma.organization.update({
          where: { id: organizationId },
          data: { stripeAccountId: accountId, stripeAccountEnabled: false },
        });
      }

      const appUrl = process.env.APP_URL ?? "https://athletiq.fitness";
      const accountLink = await stripeClient.accountLinks.create({
        account: accountId,
        refresh_url: `${appUrl}/settings?stripe_connect=refresh`,
        return_url: `${appUrl}/settings?stripe_connect=success`,
        type: "account_onboarding",
      });

      return accountLink.url;
    },

    disconnectStripeAccount: async (
      _: unknown,
      { organizationId }: { organizationId: string },
      context: { userId?: string }
    ) => {
      await requireOrgAdmin(context, organizationId);

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { stripeAccountId: true },
      });

      if (!org.stripeAccountId) return true;

      // Deauthorize the connected account from the platform
      if (stripeClient) {
        try {
          await stripeClient.oauth?.deauthorize({
            client_id: process.env.STRIPE_CLIENT_ID ?? "",
            stripe_user_id: org.stripeAccountId,
          });
        } catch (err) {
          // Non-fatal — account may already be disconnected on Stripe's side
          logger.warn({ err, organizationId }, "Stripe deauthorize failed — clearing local state anyway");
        }
      }

      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeAccountId: null, stripeAccountEnabled: false },
      });

      return true;
    },
  },
};
