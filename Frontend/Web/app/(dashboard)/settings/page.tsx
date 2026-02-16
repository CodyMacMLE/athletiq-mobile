"use client";

import { HelpCircle } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Help & Support */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Help &amp; Support</h2>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <p className="text-sm text-gray-300 mb-3">
            Need help or have feedback? Reach out to us.
          </p>
          <a
            href="mailto:support@athletiq.app"
            className="inline-block text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            support@athletiq.app
          </a>
        </div>
      </section>
    </div>
  );
}
