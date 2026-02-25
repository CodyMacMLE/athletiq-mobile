"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client/react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Smartphone } from "lucide-react";
import {
  cognitoSignUp,
  cognitoSignIn,
  cognitoConfirmSignUp,
  cognitoResendSignUpCode,
  cognitoSignOut,
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

export default function AcceptInvitePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>}>
      <AcceptInvitePage />
    </Suspense>
  );
}

function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [acceptInvite] = useMutation<any>(ACCEPT_INVITE);
  const [createUser] = useMutation<any>(CREATE_USER);

  const { data, loading: inviteLoading, error: inviteError } = useQuery<any>(GET_INVITE, {
    variables: { token: token || "" },
    skip: !token,
  });

  const invite: InviteData | null = data?.invite || null;

  const [view, setView] = useState<"loading" | "preview" | "signin" | "register" | "confirm" | "accepted" | "wrong-user" | "error">("loading");
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

    if (new Date(isNaN(Number(invite.expiresAt)) ? invite.expiresAt : Number(invite.expiresAt)) < new Date()) {
      setError("This invite has expired.");
      setView("error");
      return;
    }

    // If already authenticated, check email match
    if (isAuthenticated && user) {
      if (user.email.toLowerCase() === invite.email.toLowerCase()) {
        // Correct user — auto-accept
        handleAccept();
      } else {
        // Wrong user signed in
        setView("wrong-user");
      }
      return;
    }

    // Show preview with sign-in/register options
    setView("preview");
  }, [token, inviteLoading, authLoading, inviteError, invite, isAuthenticated, user]);

  const handleAccept = async () => {
    if (!token || !invite) return;
    setProcessing(true);
    setStep("Accepting invite...");
    try {
      await acceptInvite({ variables: { token } });
      setAcceptedOrgName(invite.organization.name);
      setAcceptedRole(invite.role);
      setView("accepted");
      setTimeout(() => {
        window.location.href = "/account";
      }, 1500);
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

      // Ensure user record exists in DB (no-op if already exists)
      setStep("Setting up account...");
      try {
        await createUser({
          variables: {
            input: {
              email: signInEmail,
              firstName: signInEmail.split("@")[0],
              lastName: signInEmail.split("@")[0],
            },
          },
        });
      } catch {
        // User may already exist — that's fine
      }

      setStep("Accepting invite...");
      await acceptInvite({ variables: { token } });
      setAcceptedOrgName(invite?.organization.name || "");
      setAcceptedRole(invite?.role || "ATHLETE");
      setView("accepted");
      setTimeout(() => {
        window.location.href = "/account";
      }, 1500);
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
        // If user was already confirmed (e.g. retrying after a DB setup failure), proceed
        const alreadyConfirmed = confirmResult.error?.includes("Current status is CONFIRMED");
        if (!alreadyConfirmed) {
          setError(confirmResult.error || "Invalid confirmation code.");
          setProcessing(false);
          return;
        }
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
    setAcceptedOrgName(invite?.organization.name || "");
    setAcceptedRole(invite?.role || "ATHLETE");
    setView("accepted");
    setTimeout(() => {
      window.location.href = "/account";
    }, 1500);
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

  const handleSignOutAndContinue = async () => {
    await cognitoSignOut();
    window.location.reload();
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

  // Accepted — brief redirect screen
  if (view === "accepted") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in!</h1>
          <p className="text-gray-400">
            You&apos;ve joined <span className="text-white font-medium">{acceptedOrgName}</span> as
            a <span className="text-purple-400 font-medium">{acceptedRole.charAt(0) + acceptedRole.slice(1).toLowerCase()}</span>.
          </p>
          <p className="text-gray-500 text-sm mt-2">Redirecting to your profile...</p>
        </div>
      </div>
    );
  }

  // Wrong user signed in
  if (view === "wrong-user") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-xl border border-yellow-600/50 p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Wrong Account</h1>
            <p className="text-gray-400 mb-4">
              This invite was sent to{" "}
              <span className="text-white font-medium">{invite?.email}</span>, but you&apos;re
              currently signed in as{" "}
              <span className="text-white font-medium">{user?.email}</span>.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Sign out and continue to use the correct account.
            </p>
            <button
              onClick={handleSignOutAndContinue}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Sign Out & Continue
            </button>
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

  // Mobile-only roles (athlete/guardian) — show app download message
  const isMobileRole = invite && (invite.role === "ATHLETE" || invite.role === "GUARDIAN");
  if (isMobileRole) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <Smartphone className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Download the App</h1>
            <p className="text-gray-400 mb-2">
              This invitation is for the <span className="text-white font-medium">Athletiq mobile app</span>.
            </p>
            <p className="text-gray-400 mb-6">
              Download the app and create an account using{" "}
              <span className="text-white font-medium">{invite.email}</span> — your
              invitation will be accepted automatically when you sign in.
            </p>
            <div className="space-y-3">
              <div className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg text-sm">
                App Store — Coming Soon
              </div>
              <div className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg text-sm">
                Google Play — Coming Soon
              </div>
            </div>
          </div>
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
