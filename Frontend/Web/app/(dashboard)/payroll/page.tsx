"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_COACH_HOURS } from "@/lib/graphql/queries";
import { UPDATE_COACH_HOURLY_RATE } from "@/lib/graphql/mutations";
import { ChevronLeft, ChevronRight, Pencil, Check, Users, Clock, DollarSign } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric",
  });
}

function RateCell({
  userId,
  organizationId,
  hourlyRate,
  onSaved,
}: {
  userId: string;
  organizationId: string;
  hourlyRate: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(hourlyRate != null ? String(hourlyRate) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  const [updateRate, { loading }] = useMutation(UPDATE_COACH_HOURLY_RATE);

  async function save() {
    const parsed = value.trim() === "" ? null : parseFloat(value);
    if (parsed !== null && isNaN(parsed)) {
      setEditing(false);
      return;
    }
    await updateRate({ variables: { organizationId, userId, hourlyRate: parsed } });
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="flex items-center gap-1.5 group"
      >
        {hourlyRate != null ? (
          <span className="text-white font-medium">${hourlyRate.toFixed(2)}/hr</span>
        ) : (
          <span className="text-white/30 italic text-sm">— set rate</span>
        )}
        <Pencil className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/50">$</span>
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-sm focus:outline-none focus:border-[#6c5ce7]"
        placeholder="0.00"
        disabled={loading}
      />
      <button onClick={save} disabled={loading} className="text-[#6c5ce7] hover:text-[#a78bfa] transition-colors">
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}

function CoachRow({ coach, organizationId, refetch }: { coach: any; organizationId: string; refetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasPay = coach.hourlyRate != null;

  return (
    <div className="bg-white/5 rounded-xl border border-white/8 overflow-hidden">
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="shrink-0">
          {coach.user.image ? (
            <img src={coach.user.image} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white text-sm font-medium">
              {coach.user.firstName?.[0]}{coach.user.lastName?.[0]}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {coach.user.firstName} {coach.user.lastName}
          </p>
        </div>

        {/* Hours */}
        <div className="text-right shrink-0 w-24">
          <p className="text-white font-medium">{coach.totalHours.toFixed(1)} hrs</p>
        </div>

        {/* Rate (stop propagation so clicks don't toggle) */}
        <div className="shrink-0 w-36 text-right" onClick={e => e.stopPropagation()}>
          <RateCell
            userId={coach.userId}
            organizationId={organizationId}
            hourlyRate={coach.hourlyRate}
            onSaved={refetch}
          />
        </div>

        {/* Pay */}
        <div className="text-right shrink-0 w-28">
          {hasPay ? (
            <p className="text-emerald-400 font-medium">${coach.totalPay?.toFixed(2)}</p>
          ) : (
            <p className="text-white/25 text-sm italic">— set rate</p>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronRight
          className={`w-4 h-4 text-white/30 transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expanded entries */}
      {expanded && coach.entries.length > 0 && (
        <div className="border-t border-white/8 px-5 py-3 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-white/40 font-medium uppercase tracking-wide pb-1">
            <span>Date</span>
            <span>Event</span>
            <span>Check-in / Check-out</span>
            <span className="text-right">Hours</span>
          </div>
          {coach.entries.map((entry: any, idx: number) => (
            <div key={entry.checkIn?.id ?? idx} className="grid grid-cols-4 gap-2 text-sm">
              <span className="text-white/55">{formatEventDate(entry.event.date)}</span>
              <span className="text-white truncate">{entry.event.title}</span>
              <span className="text-white/55">
                {formatTime(entry.checkIn?.checkInTime)} → {formatTime(entry.checkIn?.checkOutTime)}
              </span>
              <span className="text-right text-[#a78bfa]">{entry.hoursLogged.toFixed(2)} hrs</span>
            </div>
          ))}
        </div>
      )}
      {expanded && coach.entries.length === 0 && (
        <div className="border-t border-white/8 px-5 py-3 text-sm text-white/35 italic">
          No check-ins this month
        </div>
      )}
    </div>
  );
}

export default function PayrollPage() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, loading, refetch } = useQuery<any>(GET_ORG_COACH_HOURS, {
    variables: { organizationId: selectedOrganizationId ?? "", month, year },
    skip: !selectedOrganizationId,
  });

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-white/60 text-lg">Not authorized</p>
          <p className="text-white/35 text-sm mt-1">Only admins and managers can view payroll</p>
        </div>
      </div>
    );
  }

  const summary = data?.orgCoachHours;
  const coaches: any[] = summary?.coaches ?? [];

  const totalStaff = coaches.length;
  const totalHours = coaches.reduce((s: number, c: any) => s + c.totalHours, 0);
  const totalPay = coaches.reduce((s: number, c: any) => s + (c.totalPay ?? 0), 0);
  const hasAnyRate = coaches.some((c: any) => c.hourlyRate != null);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-white/50 text-sm mt-0.5">Staff hours & pay estimates</p>
        </div>

        {/* Month picker */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-medium w-36 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <Users className="w-4 h-4" />
            Total Staff
          </div>
          <p className="text-2xl font-bold text-white">{totalStaff}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <Clock className="w-4 h-4" />
            Total Hours
          </div>
          <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            Est. Total Pay
          </div>
          <p className={`text-2xl font-bold ${hasAnyRate ? "text-emerald-400" : "text-white/30"}`}>
            {hasAnyRate ? `$${totalPay.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      {/* Coach table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6c5ce7]" />
        </div>
      ) : coaches.length === 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/8 p-12 text-center">
          <p className="text-white/40">No staff check-ins for {MONTH_NAMES[month - 1]} {year}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-5 text-xs font-medium text-white/35 uppercase tracking-wide">
            <div className="w-9 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="w-24 text-right">Hours</div>
            <div className="w-36 text-right">Hourly Rate</div>
            <div className="w-28 text-right">Est. Pay</div>
            <div className="w-4 shrink-0" />
          </div>

          {coaches.map((coach: any) => (
            <CoachRow
              key={coach.userId}
              coach={coach}
              organizationId={selectedOrganizationId ?? ""}
              refetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
