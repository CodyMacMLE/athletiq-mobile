"use client";

import { FileCheck } from "lucide-react";

export default function AbsenceRequestsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <FileCheck className="w-8 h-8 text-white/40" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Absence Requests</h2>
      <p className="text-white/50 text-sm max-w-xs">
        Staff time-off requests will appear here. This page is coming soon.
      </p>
    </div>
  );
}
