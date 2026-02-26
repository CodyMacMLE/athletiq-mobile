"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, MessageSquare, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const inputClass =
  "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent";

export default function ContactPage() {
  const { isAuthenticated, isLoading, user } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate submission — wire up to your email/backend later
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  };

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
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="text-white font-medium">Contact</Link>
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
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Get in Touch</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Have a question, feature request, or just want to say hi? We&apos;d love to hear from you.
        </p>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Contact info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold mb-1">Email Us</h3>
              <p className="text-gray-400 text-sm mb-2">For general inquiries and support.</p>
              <a href="mailto:hello@athletiq.fitness" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
                hello@athletiq.fitness
              </a>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold mb-1">Feature Requests</h3>
              <p className="text-gray-400 text-sm">
                Have an idea that would make Athletiq better for your organization? We&apos;re all ears — use the form and select &quot;Feature Request&quot; as the subject.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16 bg-gray-800 rounded-xl border border-gray-700 px-8">
                <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-7 h-7 text-green-400" />
                </div>
                <h2 className="text-xl font-bold mb-2">Message Sent!</h2>
                <p className="text-gray-400 text-sm">Thanks for reaching out. We&apos;ll get back to you within 1–2 business days.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
                  <select
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="" disabled>Select a subject</option>
                    <option>General Inquiry</option>
                    <option>Feature Request</option>
                    <option>Bug Report</option>
                    <option>Billing</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={inputClass}
                    placeholder="Tell us what's on your mind..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
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
            <Link href="/pricing" className="hover:text-gray-300 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-gray-300 transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
