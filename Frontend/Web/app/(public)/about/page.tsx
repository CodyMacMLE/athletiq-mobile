"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Target, Heart, Zap, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const values = [
  {
    icon: Target,
    title: "Built for Athletes",
    description: "Every feature we build starts with the question: does this make life easier for athletes, coaches, and the people who support them?",
  },
  {
    icon: Zap,
    title: "Simple by Design",
    description: "Athletic management shouldn't require a manual. We obsess over making complex workflows feel effortless.",
  },
  {
    icon: Heart,
    title: "Community First",
    description: "We believe sports bring people together. Athletiq is built to strengthen those connections, not replace them.",
  },
  {
    icon: Users,
    title: "For Every Role",
    description: "From the athlete checking in on their phone to the owner reviewing payroll — Athletiq works for everyone in your organization.",
  },
];

export default function AboutPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[rgba(20,15,50,0.35)] backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/white_icon_transparent_background.png" alt="Athletiq" width={32} height={32} />
            <span className="text-xl font-bold">Athletiq</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/about" className="text-white font-medium">About</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : isAuthenticated && user ? (
              <Link href="/account" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
                {user.image ? (
                  <img src={user.image} alt={user.firstName} className="w-9 h-9 rounded-full object-cover ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold ring-2 ring-purple-500/50 hover:ring-purple-500 transition-all">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                )}
                <span className="text-sm font-medium text-white/80">{user.firstName}</span>
              </Link>
            ) : (
              <>
                <Link href="/signin" className="text-sm text-white/70 hover:text-white transition-colors">Sign In</Link>
                <Link href="/register" className="px-4 py-2 text-sm font-medium bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl mb-6">
          We&apos;re building the future of<br />
          <span className="text-purple-500">athletic management</span>
        </h1>
        <p className="text-white/50 text-lg max-w-2xl mx-auto">
          Athletiq was born out of frustration with spreadsheets, paper sign-in sheets, and disconnected tools. We set out to build one platform that handles everything — from the gym floor to the front office.
        </p>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-white/5 rounded-2xl border border-white/8 p-8 space-y-5 text-white/80 text-base leading-relaxed">
          <p>
            Athletic organizations — gymnastics clubs, martial arts schools, sports academies — run on people. Coaches who care deeply, parents who drive hours to get their kids to practice, and athletes who give everything they have.
          </p>
          <p>
            But the tools they use to manage all of that? They haven&apos;t kept up. Attendance is tracked in spreadsheets. Hours are logged manually. Guardians have no visibility into their athlete&apos;s progress. Coaches juggle four different apps just to do their job.
          </p>
          <p>
            We built Athletiq to change that. One platform, built specifically for athletic organizations, that brings athletes, coaches, guardians, and administrators onto the same page.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white/5 border-t border-white/8">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">What we believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="bg-white/5 rounded-xl border border-white/8 p-6">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                  <v.icon className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">{v.title}</h3>
                <p className="text-white/50 text-sm">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Come build with us</h2>
        <p className="text-white/50 mb-8 max-w-lg mx-auto">
          Athletiq is just getting started. If you run an athletic organization, we&apos;d love to have you along for the ride.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg text-sm font-medium transition-colors">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg text-sm font-medium transition-colors">
            Get in Touch
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/white_icon_transparent_background.png" alt="Athletiq" width={20} height={20} />
            <span className="font-bold text-sm">Athletiq</span>
          </Link>
          <p className="text-white/35 text-sm">&copy; {new Date().getFullYear()} Athletiq. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-white/35">
            <Link href="/pricing" className="hover:text-white/70 transition-colors">Pricing</Link>
            <Link href="/contact" className="hover:text-white/70 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
