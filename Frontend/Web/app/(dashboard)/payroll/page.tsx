"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { GET_ORG_COACH_HOURS } from "@/lib/graphql/queries";
import { UPDATE_COACH_PAY_RATE } from "@/lib/graphql/mutations";
import { ChevronLeft, ChevronRight, ChevronDown, Pencil, Check, X, Users, Clock, DollarSign } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── PayRateCell ──────────────────────────────────────────────────────────────
// Supports toggling between Hourly ($/hr) and Salary ($/mo fixed)

function PayRateCell({
  userId,
  organizationId,
  hourlyRate,
  salaryAmount,
  onSaved,
}: {
  userId: string;
  organizationId: string;
  hourlyRate: number | null;
  salaryAmount: number | null;
  onSaved: () => void;
}) {
  const isSalary = salaryAmount != null;
  const hasRate = hourlyRate != null || salaryAmount != null;

  const [editing, setEditing]     = useState(false);
  const [payType, setPayType]     = useState<"hourly" | "salary">(isSalary ? "salary" : "hourly");
  const [value, setValue]         = useState(
    isSalary ? String(salaryAmount) : hourlyRate != null ? String(hourlyRate) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const [updateRate, { loading }] = useMutation(UPDATE_COACH_PAY_RATE);

  function openEdit() {
    setPayType(salaryAmount != null ? "salary" : "hourly");
    setValue(salaryAmount != null ? String(salaryAmount) : hourlyRate != null ? String(hourlyRate) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancel() { setEditing(false); }

  async function save() {
    const parsed = value.trim() === "" ? null : parseFloat(value);
    if (parsed !== null && isNaN(parsed)) { cancel(); return; }
    await updateRate({
      variables: {
        organizationId,
        userId,
        ...(payType === "salary"
          ? { salaryAmount: parsed }
          : { hourlyRate: parsed }),
      },
    });
    setEditing(false);
    onSaved();
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <button
        onClick={openEdit}
        className="flex items-center justify-end gap-1.5 w-full group"
      >
        {hasRate ? (
          <span className="text-white font-medium">
            {salaryAmount != null
              ? `$${salaryAmount.toFixed(2)}/mo`
              : `$${hourlyRate!.toFixed(2)}/hr`}
          </span>
        ) : (
          <span className="text-white/30 italic text-sm">— set rate</span>
        )}
        <Pencil className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
      </button>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-1.5 items-end" onClick={e => e.stopPropagation()}>
      {/* Type toggle */}
      <div className="flex rounded-md overflow-hidden border border-white/15 text-xs">
        {(["hourly", "salary"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setPayType(t);
              setValue("");
            }}
            className={`px-2.5 py-1 transition-colors ${
              payType === t
                ? "bg-[#6c5ce7] text-white"
                : "bg-white/8 text-white/50 hover:text-white"
            }`}
          >
            {t === "hourly" ? "Hourly" : "Salary"}
          </button>
        ))}
      </div>

      {/* Value input + actions */}
      <div className="flex items-center gap-1">
        <span className="text-white/50 text-sm">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-24 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-sm focus:outline-none focus:border-[#6c5ce7] text-right"
          placeholder={payType === "hourly" ? "0.00/hr" : "0.00/mo"}
          disabled={loading}
        />
        <button onClick={save} disabled={loading} className="text-[#6c5ce7] hover:text-[#a78bfa] transition-colors">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={cancel} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-white/30 text-xs">
        {payType === "hourly" ? "Per hour worked" : "Fixed monthly amount"}
      </p>
    </div>
  );
}

// ─── CoachRow ─────────────────────────────────────────────────────────────────

function CoachRow({ coach, organizationId, refetch }: { coach: any; organizationId: string; refetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasPay      = coach.hourlyRate != null || coach.salaryAmount != null;
  const hasDeductions = hasPay && coach.appliedDeductions?.length > 0;

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
          <p className="text-white font-medium truncate">{coach.user.firstName} {coach.user.lastName}</p>
          {coach.salaryAmount != null && (
            <p className="text-white/35 text-xs">Salary</p>
          )}
        </div>

        {/* Hours — dimmed for salaried staff since hours don't affect pay */}
        <div className="text-right shrink-0 w-24">
          <p className={`font-medium ${coach.salaryAmount != null ? "text-white/40" : "text-white"}`}>
            {coach.totalHours.toFixed(1)} hrs
          </p>
        </div>

        {/* Pay rate cell — stop propagation so edit clicks don't expand row */}
        <div className="shrink-0 w-44 flex justify-end" onClick={e => e.stopPropagation()}>
          <PayRateCell
            userId={coach.userId}
            organizationId={organizationId}
            hourlyRate={coach.hourlyRate}
            salaryAmount={coach.salaryAmount}
            onSaved={refetch}
          />
        </div>

        {/* Est. pay (net if deductions, gross otherwise) */}
        <div className="text-right shrink-0 w-28">
          {hasPay ? (
            <div>
              <p className="text-emerald-400 font-medium">
                ${(hasDeductions ? coach.netPay : coach.grossPay)?.toFixed(2)}
              </p>
              {hasDeductions && (
                <p className="text-white/35 text-xs line-through">${coach.grossPay?.toFixed(2)}</p>
              )}
            </div>
          ) : (
            <p className="text-white/25 text-sm italic">— set rate</p>
          )}
        </div>

        <ChevronRight
          className={`w-4 h-4 text-white/30 transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-white/8">
          {coach.entries.length > 0 ? (
            <div className="px-5 py-3 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs text-white/40 font-medium uppercase tracking-wide pb-1">
                <span>Date</span><span>Event</span><span>Check-in / Check-out</span>
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
          ) : (
            <div className="px-5 py-3 text-sm text-white/35 italic">No check-ins this month</div>
          )}

          {/* Pay breakdown */}
          {hasPay && (
            <div className="border-t border-white/8 px-5 py-3 space-y-1.5">
              {coach.salaryAmount != null && (
                <p className="text-xs text-white/35 mb-1">Fixed monthly salary — hours tracked but do not affect pay</p>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Gross Pay</span>
                <span className="text-white">${coach.grossPay?.toFixed(2)}</span>
              </div>
              {coach.appliedDeductions?.map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white/50">
                    {d.name}
                    <span className="text-white/30 ml-1.5 text-xs">
                      ({d.type === "PERCENT" ? `${d.value}%` : `$${d.value}`})
                    </span>
                  </span>
                  <span className="text-red-400">−${d.amount.toFixed(2)}</span>
                </div>
              ))}
              {hasDeductions && (
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-white/8">
                  <span className="text-white">Net Pay</span>
                  <span className="text-emerald-400">${coach.netPay?.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { selectedOrganizationId, canEdit } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

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

  const coaches: any[] = data?.orgCoachHours?.coaches ?? [];

  const totalStaff   = coaches.length;
  const totalHours   = coaches.reduce((s: number, c: any) => s + c.totalHours, 0);
  const totalGross   = coaches.reduce((s: number, c: any) => s + (c.grossPay ?? 0), 0);
  const totalNet     = coaches.reduce((s: number, c: any) => s + (c.netPay ?? c.grossPay ?? 0), 0);
  const hasAnyPay    = coaches.some((c: any) => c.hourlyRate != null || c.salaryAmount != null);
  const hasDeductions = coaches.some((c: any) => c.appliedDeductions?.length > 0);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-white/50 text-sm mt-0.5">Staff hours &amp; pay estimates</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-medium w-36 text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white/60 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid gap-4 ${hasDeductions ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2"><Users className="w-4 h-4" />Total Staff</div>
          <p className="text-2xl font-bold text-white">{totalStaff}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2"><Clock className="w-4 h-4" />Total Hours</div>
          <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/8 p-5">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <DollarSign className="w-4 h-4" />{hasDeductions ? "Gross Pay" : "Est. Total Pay"}
          </div>
          <p className={`text-2xl font-bold ${hasAnyPay ? "text-white" : "text-white/30"}`}>
            {hasAnyPay ? `$${totalGross.toFixed(2)}` : "—"}
          </p>
        </div>
        {hasDeductions && (
          <div className="bg-white/5 rounded-xl border border-white/8 p-5">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-2"><DollarSign className="w-4 h-4" />Est. Net Pay</div>
            <p className="text-2xl font-bold text-emerald-400">${totalNet.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Coach list */}
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
          {/* Column headers — widths mirror CoachRow columns */}
          <div className="flex items-center gap-4 px-5 text-xs font-medium text-white/35 uppercase tracking-wide">
            <div className="w-9 shrink-0" />
            <div className="flex-1">Name</div>
            <div className="w-24 text-right">Hours</div>
            <div className="w-44 text-right">Rate</div>
            <div className="w-28 text-right">{hasDeductions ? "Net Pay" : "Est. Pay"}</div>
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
