"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, Smartphone } from "lucide-react";
import {
  cognitoSignUp,
  cognitoSignIn,
  cognitoConfirmSignUp,
  cognitoResendSignUpCode,
} from "@/lib/cognito";
import { useAuth } from "@/contexts/AuthContext";
import { GET_INVITE, CREATE_USER, ACCEPT_INVITE } from "@/lib/graphql";

type InviteData = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expiresAt: string;
  organization: {
    id: string;
    name: string;
  };
};

const ADMIN_ROLES = ["COACH", "MANAGER", "OWNER"];

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { isAuthenticated, isLoading: authLoading, user, refetch: refetchAuth } = useAuth();

  const [acceptInvite] = useMutation(ACCEPT_INVITE);
  const [createUser] = useMutation(CREATE_USER);

  const { data, loading: inviteLoading, error: inviteError } = useQuery(GET_INVITE, {
    variables: { token: token || "" },
    skip: !token,
  });

  const invite: InviteData | null = data?.invite || null;

  const [view, setView] = useState<"loading" | "preview" | "signin" | "register" | "confirm" | "accepted" | "app-confirmed" | "error">("loading");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState("");
  const [acceptedOrgName, setAcceptedOrgName] = useState("");
  const [acceptedRole, setAcceptedRole] = useState("");

  // Sign-in form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Register form
  const [regForm, setRegForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Confirmation
  const [confirmationCode, setConfirmationCode] = useState("");
  const [resending, setResending] = useState(false);

  // Determine initial view based on auth state and invite data
  useEffect(() => {
    if (!token) {
      setError("No invite token provided.");
      setView("error");
      return;
    }
    if (inviteLoading || authLoading) return;

    if (inviteError) {
      setError("Failed to load invite.");
      setView("error");
      return;
    }

    if (!invite) {
      setError("Invite not found or is no longer valid.");
      setView("error");
      return;
    }

    if (invite.status !== "PENDING") {
      setError("This invite has already been used.");
      setView("error");
      return;
    }

    if (new Date(Number(invite.expiresAt)) < new Date()) {
      setError("This invite has expired.");
      setView("error");
      return;
    }

    // If already authenticated, auto-accept
    if (isAuthenticated && user) {
      handleAccept();
      return;
    }

    // Show preview with sign-in/register options
    setView("preview");
  }, [token, inviteLoading, authLoading, inviteError, invite, isAuthenticated, user]);

  const redirectAfterAccept = (role: string) => {
    if (ADMIN_ROLES.includes(role)) {
      // Full page navigation to ensure the dashboard's AuthProvider initializes fresh
      window.location.href = "/dashboard";
    } else {
      // ATHLETE / GUARDIAN — show app download confirmation
      setView("app-confirmed");
    }
  };

  const handleAccept = async () => {
    if (!token || !invite) return;
    setProcessing(true);
    setStep("Accepting invite...");
    try {
      await acceptInvite({ variables: { token } });
      setAcceptedOrgName(invite.organization.name);
      setAcceptedRole(invite.role);
      if (ADMIN_ROLES.includes(invite.role)) {
        setView("accepted");
        setTimeout(() => redirectAfterAccept(invite.role), 1500);
      } else {
        redirectAfterAccept(invite.role);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to accept invite.");
      setView("error");
    } finally {
      setProcessing(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setProcessing(true);
    setStep("Signing in...");
    try {
      const result = await cognitoSignIn(signInEmail, signInPassword);
      if (!result.success) {
        setError(result.error || "Sign in failed.");
        setProcessing(false);
        return;
      }

      // After sign-in, create user record if needed, then accept
      setStep("Setting up account...");
      try {
        await createUser({
          variables: {
            input: {
              email: signInEmail,
              firstName: signInEmail.split("@")[0],
              lastName: "",
            },
          },
        });
      } catch {
        // User may already exist — that's fine
      }

      setStep("Accepting invite...");
      await acceptInvite({ variables: { token } });
      const role = invite?.role || "ATHLETE";
      setAcceptedOrgName(invite?.organization.name || "");
      setAcceptedRole(role);
      if (ADMIN_ROLES.includes(role)) {
        setView("accepted");
        setTimeout(() => redirectAfterAccept(role), 1500);
      } else {
        redirectAfterAccept(role);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to accept invite.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (regForm.password !== regForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (regForm.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setProcessing(true);
    setStep("Creating account...");
    try {
      const signUpResult = await cognitoSignUp(regForm.email, regForm.password);
      if (!signUpResult.success) {
        const err = signUpResult.error || "";
        if (err.includes("already exists") || err.includes("UsernameExistsException")) {
          // Already have Cognito account — switch to sign in view
          setError("An account with this email already exists. Please sign in instead.");
          setProcessing(false);
          setView("signin");
          setSignInEmail(regForm.email);
          return;
        }
        setError(err || "Failed to create account.");
        setProcessing(false);
        return;
      }

      // Need email confirmation
      setProcessing(false);
      setView("confirm");
    } catch (err: any) {
      setError(err?.message || "An error occurred.");
      setProcessing(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setProcessing(true);

    try {
      setStep("Verifying email...");
      const confirmResult = await cognitoConfirmSignUp(regForm.email, confirmationCode);
      if (!confirmResult.success) {
        setError(confirmResult.error || "Invalid confirmation code.");
        setProcessing(false);
        return;
      }

      setStep("Signing in...");
      const signInResult = await cognitoSignIn(regForm.email, regForm.password);
      if (!signInResult.success) {
        setError(signInResult.error || "Failed to sign in.");
        setProcessing(false);
        return;
      }

      await finishAccept();
    } catch (err: any) {
      setError(err?.message || "An error occurred.");
      setProcessing(false);
    }
  };

  const finishAccept = async () => {
    setStep("Setting up your profile...");
    try {
      await createUser({
        variables: {
          input: {
            email: regForm.email,
            firstName: regForm.firstName,
            lastName: regForm.lastName,
          },
        },
      });
    } catch {
      // User may already exist
    }

    setStep("Accepting invite...");
    await acceptInvite({ variables: { token } });
    const role = invite?.role || "ATHLETE";
    setAcceptedOrgName(invite?.organization.name || "");
    setAcceptedRole(role);
    if (ADMIN_ROLES.includes(role)) {
      setView("accepted");
      setTimeout(() => redirectAfterAccept(role), 1500);
    } else {
      redirectAfterAccept(role);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    const result = await cognitoResendSignUpCode(regForm.email);
    if (!result.success) {
      setError(result.error || "Failed to resend code.");
    }
    setResending(false);
  };

  const roleName = invite ? invite.role.charAt(0) + invite.role.slice(1).toLowerCase() : "";

  // Loading state
  if (view === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Admin accepted — brief redirect screen
  if (view === "accepted") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in!</h1>
          <p className="text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Athlete/Guardian accepted — app download confirmation
  if (view === "app-confirmed") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in!</h1>
            <p className="text-gray-400 mb-6">
              You&apos;ve joined <span className="text-white font-medium">{acceptedOrgName}</span> as
              a <span className="text-purple-400 font-medium">{acceptedRole.charAt(0) + acceptedRole.slice(1).toLowerCase()}</span>.
            </p>

            <div className="bg-gray-700/50 rounded-xl p-6 mb-6">
              <Smartphone className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-white mb-2">Get the App</h2>
              <p className="text-gray-400 text-sm mb-4">
                Download Athletiq on your phone to check in to events, track hours, and stay connected with your team.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-600 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                >
                  App Store — Coming Soon
                </button>
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-600 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
                >
                  Google Play — Coming Soon
                </button>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Continue to web dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (view === "error") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Confirmation code view
  if (view === "confirm") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
            <p className="text-gray-400 text-sm mb-6">
              We sent a confirmation code to{" "}
              <span className="text-white font-medium">{regForm.email}</span>.
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
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm tracking-widest text-center text-lg"
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
                disabled={processing}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {step}
                  </>
                ) : (
                  "Verify & Accept Invite"
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

  // Preview / Sign-in / Register views
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Invite Preview Card */}
        {invite && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
            <p className="text-gray-400 text-sm mb-1">You&apos;ve been invited to join</p>
            <h1 className="text-2xl font-bold text-white mb-2">{invite.organization.name}</h1>
            <p className="text-gray-400 text-sm">
              as a <span className="text-purple-400 font-medium">{roleName}</span>
            </p>
          </div>
        )}

        {/* Sign In / Register Toggle */}
        {view === "preview" || view === "signin" || view === "register" ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => { setView("signin"); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view !== "register"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setView("register"); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  view === "register"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                Create Account
              </button>
            </div>

            {view !== "register" ? (
              /* Sign In Form */
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Your password"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {step}
                    </>
                  ) : (
                    "Sign In & Accept"
                  )}
                </button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.firstName}
                      onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={regForm.lastName}
                      onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
                  disabled={processing}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {step}
                    </>
                  ) : (
                    "Create Account & Accept"
                  )}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
