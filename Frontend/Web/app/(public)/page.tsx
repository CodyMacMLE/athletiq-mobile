"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  BarChart3,
  Calendar,
  Shield,
  Crown,
  UserCog,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const features = [
  {
    icon: ClipboardList,
    title: "Attendance Tracking",
    description:
      "Automated check-ins, absence tracking, and excuse management for every practice and event.",
    color: "purple",
  },
  {
    icon: BarChart3,
    title: "Team Analytics",
    description:
      "Real-time dashboards with attendance rates, leaderboards, and performance trends.",
    color: "blue",
  },
  {
    icon: Calendar,
    title: "Event Management",
    description:
      "Schedule practices, games, and events. Track attendance per event with ease.",
    color: "green",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description:
      "Owners, Managers, and Coaches each get the right level of control for their role.",
    color: "yellow",
  },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  purple: { bg: "bg-purple-600/20", text: "text-purple-500" },
  blue: { bg: "bg-blue-600/20", text: "text-blue-500" },
  green: { bg: "bg-green-600/20", text: "text-green-500" },
  yellow: { bg: "bg-yellow-600/20", text: "text-yellow-500" },
};

const roles = [
  {
    icon: Crown,
    title: "Owner",
    description:
      "Full organizational control including billing, settings, and member management.",
    color: "purple",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-600/10",
    textColor: "text-purple-400",
  },
  {
    icon: UserCog,
    title: "Manager",
    description:
      "Edit athletes, teams, events, and attendance. Everything except org-level settings.",
    color: "blue",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-600/10",
    textColor: "text-blue-400",
  },
  {
    icon: Eye,
    title: "Coach",
    description:
      "View dashboards, rosters, schedules, and analytics. Read-only access to stay informed.",
    color: "green",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-600/10",
    textColor: "text-green-400",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold">Athletiq</span>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Manage Your Athletes,
          <br />
          <span className="text-purple-500">Elevate Your Organization</span>
        </h1>
        <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
          The all-in-one platform for tracking attendance, managing teams, and
          gaining insights across your entire athletic organization.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-6 py-3 text-sm font-medium bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            Register Your Organization
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 text-sm font-medium bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything You Need
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          Powerful tools to streamline your organization from top to bottom.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const colors = colorMap[feature.color];
            return (
              <div
                key={feature.title}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div
                  className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roles Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          Built for Every Role
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
          From organization owners to coaches on the field, everyone gets the
          access they need.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.title}
              className={`bg-gray-800 rounded-xl p-6 border ${role.borderColor} ${role.bgColor} hover:border-opacity-60 transition-colors`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[role.color].bg}`}
                >
                  <role.icon
                    className={`w-5 h-5 ${colorMap[role.color].text}`}
                  />
                </div>
                <h3 className={`text-lg font-semibold ${role.textColor}`}>
                  {role.title}
                </h3>
              </div>
              <p className="text-gray-400 text-sm">{role.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
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
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Athletiq. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
