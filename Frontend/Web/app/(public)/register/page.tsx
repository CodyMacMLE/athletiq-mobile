"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cognitoSignUp, cognitoSignIn, cognitoConfirmSignUp, cognitoResendSignUpCode } from "@/lib/cognito";
import { useAuth } from "@/contexts/AuthContext";
import { CREATE_USER, CREATE_ORGANIZATION } from "@/lib/graphql";

const inputClass =
  "w-full px-4 py-3 bg-white/8 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent";
const labelClass = "block text-xs font-medium text-white/55 mb-1.5";

const gradientStyle = {
  background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)",
};

export default function RegisterPage() {
  const router = useRouter();
  const { } = useAuth();

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

  const [createUser] = useMutation<any>(CREATE_USER);
  const [createOrganization] = useMutation<any>(CREATE_ORGANIZATION);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      setStep("Creating account...");
      const signUpResult = await cognitoSignUp(form.email, form.password);
      if (!signUpResult.success) {
        const err = signUpResult.error || "";
        if (err.includes("already exists") || err.includes("UsernameExistsException")) {
          setStep("Signing in...");
          const signInResult = await cognitoSignIn(form.email, form.password);
          if (!signInResult.success) {
            setError(signInResult.error || "Account exists. Please sign in instead.");
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
      setLoading(false);
      setNeedsConfirmation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  const setupDatabaseRecords = async () => {
    try {
      setStep("Setting up your profile...");
      await createUser({
        variables: { input: { email: form.email, firstName: form.firstName, lastName: form.lastName } },
      });
      setStep("Creating organization...");
      await createOrganization({ variables: { input: { name: form.organizationName } } });
      router.push("/dashboard");
    } catch (err) {
      setError(
        `Setup failed: ${err instanceof Error ? err.message : "Unknown error"}. Your account was created — sign in and create your organization from your account page.`
      );
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    const result = await cognitoResendSignUpCode(form.email);
    if (!result.success) setError(result.error || "Failed to resend code.");
    setResending(false);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setStep("Verifying email...");
      const confirmResult = await cognitoConfirmSignUp(form.email, confirmationCode);
      if (!confirmResult.success) {
        const alreadyConfirmed = confirmResult.error?.includes("Current status is CONFIRMED");
        if (!alreadyConfirmed) {
          setError(confirmResult.error || "Invalid confirmation code.");
          setLoading(false);
          return;
        }
      }
      setStep("Signing in...");
      const signInResult = await cognitoSignIn(form.email, form.password);
      if (!signInResult.success) {
        setError(signInResult.error || "Failed to sign in.");
        setLoading(false);
        return;
      }
      await setupDatabaseRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={gradientStyle}>
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => { setNeedsConfirmation(false); setConfirmationCode(""); setError(""); }}
            className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to registration
          </button>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
            <p className="text-white/45 text-sm mb-6">
              We sent a confirmation code to{" "}
              <span className="text-white font-medium">{form.email}</span>. Enter it below to continue.
            </p>

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className={labelClass}>Confirmation Code</label>
                <input
                  type="text"
                  required
                  value={confirmationCode}
                  onChange={(e) => { setConfirmationCode(e.target.value); setError(""); }}
                  className={`${inputClass} tracking-widest text-center text-lg`}
                  placeholder="123456"
                  autoFocus
                />
              </div>

              {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">{error}</div>}

              <button type="submit" disabled={loading} className="w-full py-3 bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {step}</> : "Verify & Continue"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-white/40">
              Didn&apos;t receive the code?{" "}
              <button type="button" onClick={handleResendCode} disabled={resending} className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors disabled:opacity-50">
                {resending ? "Sending..." : "Resend code"}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={gradientStyle}>
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="text-center mb-6">
          <Link href="/">
            <Image src="/logo/white_icon_transparent_background.png" alt="Athletiq" width={56} height={56} className="mx-auto mb-3" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Register Your Organization</h1>
          <p className="text-white/45 text-sm mt-1">Create an account and get started in minutes.</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>Organization Name</label>
              <input type="text" name="organizationName" required value={form.organizationName} onChange={handleChange} className={inputClass} placeholder="Acme Athletics" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input type="text" name="firstName" required value={form.firstName} onChange={handleChange} className={inputClass} placeholder="John" />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input type="text" name="lastName" required value={form.lastName} onChange={handleChange} className={inputClass} placeholder="Doe" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" required value={form.email} onChange={handleChange} className={inputClass} placeholder="john@example.com" />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input type="password" name="password" required value={form.password} onChange={handleChange} className={inputClass} placeholder="Minimum 8 characters" />
            </div>

            <div>
              <label className={labelClass}>Confirm Password</label>
              <input type="password" name="confirmPassword" required value={form.confirmPassword} onChange={handleChange} className={inputClass} placeholder="Re-enter your password" />
            </div>

            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">{error}</div>}

            <button type="submit" disabled={loading} className="w-full py-3 bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {step}</> : "Create Organization"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-white/40">
            Already have an account?{" "}
            <Link href="/signin" className="text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
