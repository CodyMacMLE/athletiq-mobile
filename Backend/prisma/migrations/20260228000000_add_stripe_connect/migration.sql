-- AlterTable: add Stripe Connect fields to Organization
ALTER TABLE "Organization" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeAccountEnabled" BOOLEAN NOT NULL DEFAULT false;
