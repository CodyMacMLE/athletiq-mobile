"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cognitoSignUp, cognitoSignIn, cognitoConfirmSignUp, cognitoResendSignUpCode } from "@/lib/cognito";
import { useAuth } from "@/contexts/AuthContext";
import {
  CREATE_USER,
  CREATE_ORGANIZATION,
} from "@/lib/graphql";

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);
  const [form, setForm] = useState({
    organizationName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [resending, setResending] = useState(false);

  const [createUser] = useMutation(CREATE_USER);
  const [createOrganization] = useMutation(CREATE_ORGANIZATION);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create Cognito account
      setStep("Creating account...");
      const signUpResult = await cognitoSignUp(form.email, form.password);
      if (!signUpResult.success) {
        const err = signUpResult.error || "";
        // If user already exists in Cognito, try signing in directly
        // to finish DB setup that may have failed previously
        if (err.includes("already exists") || err.includes("UsernameExistsException")) {
          setStep("Signing in...");
          const signInResult = await cognitoSignIn(form.email, form.password);
          if (!signInResult.success) {
            setError(signInResult.error || "Account exists. Please sign in from the dashboard.");
            setLoading(false);
            return;
          }
          await setupDatabaseRecords();
          return;
        }
        setError(err || "Failed to create account.");
        setLoading(false);
        return;
      }

      // Show confirmation code input
      setLoading(false);
      setNeedsConfirmation(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(
        `${message} If this persists, please contact support.`
      );
      setLoading(false);
    }
  };

  const setupDatabaseRecords = async () => {
    try {
      // Create user record
      setStep("Setting up your profile...");
      const { data: userData } = await createUser({
        variables: {
          input: {
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
          },
        },
      });
      const userId = userData.createUser.id;

      // Create organization
      setStep("Creating organization...");
      const { data: orgData } = await createOrganization({
        variables: {
          input: {
            name: form.organizationName,
          },
        },
      });
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(
        `Setup failed: ${message}. Your account was created — you can sign in and create your organization from the profile page.`
      );
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    const result = await cognitoResendSignUpCode(form.email);
    if (!result.success) {
      setError(result.error || "Failed to resend code.");
    }
    setResending(false);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Confirm sign-up with code from email
      setStep("Verifying email...");
      const confirmResult = await cognitoConfirmSignUp(form.email, confirmationCode);
      if (!confirmResult.success) {
        // If user was already confirmed (e.g. retrying after a DB setup failure), proceed
        const alreadyConfirmed = confirmResult.error?.includes("Current status is CONFIRMED");
        if (!alreadyConfirmed) {
          setError(confirmResult.error || "Invalid confirmation code.");
          setLoading(false);
          return;
        }
      }

      // Sign in
      setStep("Signing in...");
      const signInResult = await cognitoSignIn(form.email, form.password);
      if (!signInResult.success) {
        setError(signInResult.error || "Failed to sign in.");
        setLoading(false);
        return;
      }

      // Create DB records and redirect
      await setupDatabaseRecords();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(
        `${message} If this persists, please contact support.`
      );
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => {
              setNeedsConfirmation(false);
              setConfirmationCode("");
              setError("");
            }}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to registration
          </button>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              We sent a confirmation code to{" "}
              <span className="text-white font-medium">{form.email}</span>.
              Enter it below to continue.
            </p>

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmation Code
                </label>
                <input
                  type="text"
                  required
                  value={confirmationCode}
                  onChange={(e) => {
                    setConfirmationCode(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm tracking-widest text-center text-lg"
                  placeholder="123456"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {step}
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Didn&apos;t receive the code?{" "}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend code"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Register Your Organization
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Create an account and set up your organization to get started.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                name="organizationName"
                required
                value={form.organizationName}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="Acme Athletics"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={form.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={form.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                value={form.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="Re-enter your password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {step}
                </>
              ) : (
                "Create Organization"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              href="/dashboard"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
