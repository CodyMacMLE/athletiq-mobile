"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { DELETE_MY_ACCOUNT } from "@/lib/graphql";
import { Bell, HelpCircle, Trash2, X } from "lucide-react";

export default function SettingsPage() {
  const { logout } = useAuth();
  const [deleteMyAccount] = useMutation(DELETE_MY_ACCOUNT);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await logout();
    } catch (err) {
      console.error("Failed to delete account:", err);
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Notifications */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 divide-y divide-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-300">Push Notifications</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full relative cursor-not-allowed opacity-50">
              <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-300">Email Notifications</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full relative cursor-not-allowed opacity-50">
              <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full" />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Notification preferences coming soon.</p>
      </section>

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

      {/* Danger Zone */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
        </div>
        <div className="bg-gray-800 rounded-lg border border-red-900/50 p-4">
          <p className="text-sm text-gray-300 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Delete Account
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Delete Account</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to delete your account? This will permanently remove all your
              data and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
