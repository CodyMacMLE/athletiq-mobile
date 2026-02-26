"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle,
  Smartphone,
  Monitor,
  Trophy,
  Target,
  Tv,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const mobileFeatures = [
  "Quick check-in to practices and events",
  "View attendance history and hours",
  "Browse team schedule and upcoming events",
  "Stay connected with your team",
];

const dashboardFeatures = [
  "Track and manage attendance across all teams",
  "View analytics, leaderboards, and trends",
  "Create and manage teams, events, and schedules",
  "Role-based access for Owners, Managers, and Coaches",
];

const roadmapItems = [
  {
    icon: Trophy,
    title: "Competition Event Manager",
    description:
      "Plan and run competitions with brackets, heats, and multi-day event support.",
    color: "purple",
  },
  {
    icon: Target,
    title: "Scoring Systems",
    description:
      "Flexible scoring configurations for any sport — points, times, distances, and custom criteria.",
    color: "blue",
  },
  {
    icon: Tv,
    title: "Scoring View App",
    description:
      "A dedicated display app powered by Athletiq for live scoreboards at events and venues.",
    color: "green",
  },
];

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  purple: { bg: "bg-purple-600/20", text: "text-purple-400", border: "border-purple-500/30" },
  blue: { bg: "bg-blue-600/20", text: "text-blue-400", border: "border-blue-500/30" },
  green: { bg: "bg-green-600/20", text: "text-green-400", border: "border-green-500/30" },
};

export default function LandingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[rgba(20,15,50,0.35)] backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo/white_icon_transparent_background.png"
              alt="Athletiq"
              width={32}
              height={32}
            />
            <span className="text-xl font-bold">Athletiq</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : isAuthenticated && user ? (
              <Link href="/account" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white leading-tight">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-white/45 leading-tight mt-0.5">{user.email}</p>
                </div>
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.firstName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all shrink-0">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                )}
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          The All-in-One Platform
          <br />
          <span className="text-purple-500">for Athletic Management</span>
        </h1>
        <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto">
          From check-ins on the field to analytics in the front office — Athletiq
          connects athletes, guardians, coaches, and administrators on one
          platform.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="px-6 py-3 text-sm font-medium bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg transition-colors inline-flex items-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="px-6 py-3 text-sm font-medium bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg transition-colors inline-flex items-center gap-2"
              >
                Register Your Organization
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/signin"
                className="px-6 py-3 text-sm font-medium bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg transition-colors"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Athletes & Guardians Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/20 text-blue-400 text-sm font-medium rounded-full mb-6">
              <Smartphone className="w-4 h-4" />
              Mobile App
            </div>
            <h2 className="text-3xl font-bold mb-4">
              For Athletes & Guardians
            </h2>
            <p className="text-white/50 mb-8">
              The Athletiq mobile app puts everything athletes and guardians need
              right in their pocket. Check in to events, track your hours, and
              never miss a practice.
            </p>
            <ul className="space-y-3 mb-8">
              {mobileFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-white/80">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled
                className="px-5 py-2.5 bg-white/8 text-white/50 font-medium rounded-lg cursor-not-allowed text-sm border border-white/10"
              >
                App Store — Coming Soon
              </button>
              <button
                disabled
                className="px-5 py-2.5 bg-white/8 text-white/50 font-medium rounded-lg cursor-not-allowed text-sm border border-white/10"
              >
                Google Play — Coming Soon
              </button>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-64 h-[500px] bg-white/5 rounded-[2.5rem] border-2 border-white/8 flex items-center justify-center p-8">
              <div className="text-center">
                <Smartphone className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <p className="text-white/50 text-sm">
                  Mobile app coming soon to iOS and Android
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations & Coaches Section */}
      <section className="bg-white/5 border-t border-white/8">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 flex justify-center">
              <div className="w-full max-w-md bg-white/5 rounded-xl border border-white/8 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <Monitor className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    Dashboard Preview
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-white/10 rounded-full w-3/4"></div>
                  <div className="h-3 bg-white/10 rounded-full w-1/2"></div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="h-20 bg-purple-600/10 border border-purple-500/20 rounded-lg"></div>
                    <div className="h-20 bg-blue-600/10 border border-blue-500/20 rounded-lg"></div>
                    <div className="h-20 bg-green-600/10 border border-green-500/20 rounded-lg"></div>
                  </div>
                  <div className="h-32 bg-white/5 rounded-lg mt-4"></div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-600/20 text-purple-400 text-sm font-medium rounded-full mb-6">
                <Monitor className="w-4 h-4" />
                Web Dashboard
              </div>
              <h2 className="text-3xl font-bold mb-4">
                For Organizations & Coaches
              </h2>
              <p className="text-white/50 mb-8">
                The Athletiq web dashboard gives coaches, managers, and
                organization owners the tools they need to run their programs
                effectively.
              </p>
              <ul className="space-y-3 mb-8">
                {dashboardFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="px-5 py-2.5 bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white font-medium rounded-lg transition-colors text-sm inline-flex items-center justify-center gap-2"
                >
                  Register Your Organization
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/signin"
                  className="px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-medium rounded-lg transition-colors text-sm text-center"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          What&apos;s Coming Next
        </h2>
        <p className="text-white/50 text-center mb-12 max-w-xl mx-auto">
          We&apos;re building the future of athletic management. Here&apos;s
          what&apos;s on our roadmap.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roadmapItems.map((item) => {
            const colors = colorMap[item.color];
            return (
              <div
                key={item.title}
                className={`bg-white/5 rounded-xl p-6 border ${colors.border} hover:bg-white/8 transition-colors`}
              >
                <div
                  className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mb-4`}
                >
                  <item.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-purple-100 mb-8 max-w-lg mx-auto">
            Create your organization in minutes and start managing your athletes
            today.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-white text-purple-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Register Your Organization
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/logo/white_icon_transparent_background.png"
                  alt="Athletiq"
                  width={24}
                  height={24}
                />
                <span className="font-bold">Athletiq</span>
              </div>
              <p className="text-white/35 text-sm">
                The all-in-one platform for athletic management.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Product
              </h4>
              <ul className="space-y-2 text-sm text-white/35">
                <li>
                  <Link href="/register" className="hover:text-white/70 transition-colors">
                    Get Started
                  </Link>
                </li>
                <li>
                  <Link href="/signin" className="hover:text-white/70 transition-colors">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Company
              </h4>
              <ul className="space-y-2 text-sm text-white/35">
                <li>
                  <span className="cursor-default">About</span>
                </li>
                <li>
                  <span className="cursor-default">Contact</span>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Legal
              </h4>
              <ul className="space-y-2 text-sm text-white/35">
                <li>
                  <span className="cursor-default">Privacy Policy</span>
                </li>
                <li>
                  <span className="cursor-default">Terms of Service</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/8 pt-8 text-center text-white/35 text-sm">
            &copy; {new Date().getFullYear()} Athletiq. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
