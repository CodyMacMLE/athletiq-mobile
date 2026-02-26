"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Zap, Building2, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "Perfect for small teams just getting started.",
    icon: Zap,
    color: "blue",
    features: [
      "Up to 25 athletes",
      "1 team",
      "Event scheduling",
      "NFC check-ins",
      "Basic attendance tracking",
      "Mobile app access",
    ],
    cta: "Get Started Free",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For growing organizations managing multiple teams.",
    icon: Building2,
    color: "purple",
    features: [
      "Unlimited athletes",
      "Unlimited teams",
      "Advanced analytics & leaderboards",
      "Guardian access & email reports",
      "Payroll & coach hours tracking",
      "Ad-hoc check-in approvals",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "Custom",
    period: "",
    description: "For large clubs and multi-sport organizations.",
    icon: Trophy,
    color: "yellow",
    features: [
      "Everything in Pro",
      "Multiple organizations",
      "Custom branding",
      "Dedicated account manager",
      "API access",
      "SLA uptime guarantee",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    href: "/contact",
    highlighted: false,
  },
];

const colorMap: Record<string, { icon: string; badge: string; ring: string; cta: string }> = {
  blue:   { icon: "text-blue-400 bg-blue-600/20",   badge: "bg-blue-600/20 text-blue-400",     ring: "ring-blue-500/30",   cta: "bg-gray-700 hover:bg-gray-600 text-white" },
  purple: { icon: "text-purple-400 bg-purple-600/20", badge: "bg-purple-500 text-white",         ring: "ring-purple-500",    cta: "bg-purple-600 hover:bg-purple-700 text-white" },
  yellow: { icon: "text-yellow-400 bg-yellow-600/20", badge: "bg-yellow-600/20 text-yellow-400", ring: "ring-yellow-500/30", cta: "bg-gray-700 hover:bg-gray-600 text-white" },
};

export default function PricingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/white_icon_transparent_background.png" alt="Athletiq" width={32} height={32} />
            <span className="text-xl font-bold">Athletiq</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/pricing" className="text-white font-medium">Pricing</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/account">
                  {user.image ? (
                    <img src={user.image} alt={user.firstName} className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </div>
                  )}
                </Link>
              </div>
            ) : (
              <>
                <Link href="/signin" className="text-sm text-gray-300 hover:text-white transition-colors">Sign In</Link>
                <Link href="/register" className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl mb-4">Simple, Transparent Pricing</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Start free and scale as your organization grows. No hidden fees.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const colors = colorMap[plan.color];
            return (
              <div
                key={plan.name}
                className={`flex flex-col bg-gray-800 rounded-2xl p-8 ring-1 ${colors.ring} ${plan.highlighted ? "relative" : ""}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">Most Popular</span>
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${colors.icon}`}>
                  <plan.icon className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  {plan.period && <span className="text-gray-400 text-sm">{plan.period}</span>}
                </div>
                <p className="text-gray-400 text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`w-full py-3 rounded-lg text-sm font-semibold text-center transition-colors ${colors.cta}`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-500 text-sm mt-10">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-gray-800/50 border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I change plans later?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the start of the next billing cycle." },
              { q: "What counts as an athlete?", a: "Any user with the ATHLETE role in your organization counts toward your athlete limit." },
              { q: "Is there a free trial for Pro?", a: "Yes — every new organization gets a 14-day free trial of Pro features, no credit card required." },
              { q: "What payment methods do you accept?", a: "We accept all major credit cards via Stripe. Annual plans are also available at a discount." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-700 pb-6">
                <h3 className="text-base font-semibold text-white mb-2">{q}</h3>
                <p className="text-gray-400 text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-gray-400 mb-8">Join hundreds of organizations already using Athletiq.</p>
        <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
          Create Your Organization <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/white_icon_transparent_background.png" alt="Athletiq" width={20} height={20} />
            <span className="font-bold text-sm">Athletiq</span>
          </Link>
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Athletiq. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/about" className="hover:text-gray-300 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
