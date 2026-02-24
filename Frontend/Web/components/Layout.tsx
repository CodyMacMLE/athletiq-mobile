"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@apollo/client/react";
import { GET_PENDING_EXCUSE_REQUESTS } from "@/lib/graphql";
import {
  Users,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Home,
  UserCog,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Megaphone,
  DollarSign,
  Building2,
  TrendingUp,
  Briefcase,
  FileCheck,
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── Nav definition ───────────────────────────────────────────────────────────

type NavChild = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  type: "group";
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  children: NavChild[];
};

type NavItem = {
  type: "item";
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type NavEntry = NavItem | NavGroup;

const NAV: NavEntry[] = [
  { type: "item",  name: "Dashboard",     href: "/dashboard",     icon: Home },
  { type: "item",  name: "Announcements", href: "/announcements", icon: Megaphone },
  {
    type: "group",
    name: "Organization",
    icon: Building2,
    children: [
      { name: "Users",   href: "/users",   icon: Users },
      { name: "Teams",   href: "/teams",   icon: UserCog },
      { name: "Events",  href: "/events",  icon: Calendar },
    ],
  },
  {
    type: "group",
    name: "Athletes",
    icon: TrendingUp,
    children: [
      { name: "Attendance",        href: "/attendance",               icon: ClipboardList },
      { name: "Analytics",         href: "/analytics",                icon: BarChart3 },
      { name: "Absence Requests",  href: "/athlete-absence-requests", icon: FileCheck },
    ],
  },
  {
    type: "group",
    name: "Staff",
    icon: Briefcase,
    adminOnly: true,
    children: [
      { name: "Payroll",           href: "/payroll",           icon: DollarSign },
      { name: "Absence Requests",  href: "/absence-requests",  icon: FileCheck },
    ],
  },
  { type: "item", name: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, canEdit, selectedOrganizationId, logout } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const STAFF_ROLES = ["OWNER", "ADMIN", "MANAGER", "COACH"];

  const { data: pendingExcuseData } = useQuery<any>(GET_PENDING_EXCUSE_REQUESTS, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId || !canEdit,
  });

  const pendingExcuses: any[] = pendingExcuseData?.pendingExcuseRequests || [];
  const staffPendingCount = pendingExcuses.filter((e) =>
    e.user?.organizationMemberships?.some(
      (m: any) => m.organization.id === selectedOrganizationId && STAFF_ROLES.includes(m.role)
    )
  ).length;
  const athletePendingCount = pendingExcuses.length - staffPendingCount;

  const navBadges: Record<string, number> = {
    "/absence-requests": staffPendingCount,
    "/athlete-absence-requests": athletePendingCount,
  };

  const teamOrgs = user?.memberships?.map((m) => m.team.organization) || [];
  const orgMemberOrgs = user?.organizationMemberships?.map((m) => m.organization) || [];
  const allOrgs = [...teamOrgs, ...orgMemberOrgs];
  const uniqueOrgs = [...new Map(allOrgs.map((o) => [o.id, o])).values()];
  const selectedOrg = uniqueOrgs.find((o) => o.id === selectedOrganizationId);

  // Auto-expand the group whose child matches the current route
  useEffect(() => {
    const active = new Set<string>();
    for (const entry of NAV) {
      if (entry.type === "group") {
        if (entry.children.some((c) => pathname.startsWith(c.href))) {
          active.add(entry.name);
        }
      }
    }
    setOpenGroups(active);
  }, [pathname]);

  // Collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarCollapsed(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const isChildActive = (entry: NavGroup) =>
    entry.children.some((c) => pathname.startsWith(c.href));

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function renderItem(item: NavItem) {
    if (item.adminOnly && !canEdit) return null;
    const active = pathname === item.href;
    return (
      <Link
        key={item.name}
        href={item.href}
        title={sidebarCollapsed ? item.name : ""}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          active ? "bg-[#6c5ce7] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
        } ${sidebarCollapsed ? "justify-center" : ""}`}
      >
        <item.icon className={`w-5 h-5 shrink-0 ${sidebarCollapsed ? "" : "mr-3"}`} />
        {!sidebarCollapsed && item.name}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    if (group.adminOnly && !canEdit) return null;

    const isOpen = openGroups.has(group.name);
    const hasActiveChild = isChildActive(group);

    if (sidebarCollapsed) {
      // Collapsed: show group icon linking to first child
      const firstHref = group.children[0]?.href ?? "#";
      return (
        <Link
          key={group.name}
          href={firstHref}
          title={group.name}
          className={`flex justify-center items-center px-3 py-2 rounded-lg transition-colors ${
            hasActiveChild ? "bg-[#6c5ce7]/30 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <group.icon className="w-5 h-5 shrink-0" />
        </Link>
      );
    }

    return (
      <div key={group.name}>
        {/* Group header */}
        <button
          onClick={() => toggleGroup(group.name)}
          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasActiveChild && !isOpen
              ? "text-white bg-white/8"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <group.icon className="w-5 h-5 shrink-0 mr-3" />
          <span className="flex-1 text-left">{group.name}</span>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>

        {/* Children */}
        {isOpen && (
          <div className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
            {group.children.map((child) => {
              const active = pathname.startsWith(child.href);
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    active ? "bg-[#6c5ce7] text-white font-medium" : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <child.icon className="w-4 h-4 shrink-0 mr-2.5" />
                  <span className="flex-1">{child.name}</span>
                  {(navBadges[child.href] ?? 0) > 0 && (
                    <span className="ml-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 rounded-full text-white">
                      {navBadges[child.href]}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "linear-gradient(160deg, #302b6f 10%, #4d2a69 60%, #302b6f 100%)" }}
    >
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 bg-[rgba(20,15,50,0.35)] border-r border-white/8 z-50 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/8">
          {!sidebarCollapsed && (
            <Image
              src="/logo/white_icon_transparent_background.png"
              alt="Athletiq"
              width={110}
              height={30}
              className="object-contain max-h-10"
            />
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 text-white/55 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${
              sidebarCollapsed ? "mx-auto" : ""
            }`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Organization Selector */}
        {!sidebarCollapsed && (
          <div className="px-4 py-4 border-b border-white/8">
            <div className="relative">
              <button
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white/10 rounded-lg text-white hover:bg-white/12 transition-colors"
              >
                <span className="truncate">{selectedOrg?.name || "Select Organization"}</span>
                <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
              </button>
              {orgDropdownOpen && uniqueOrgs.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white/10 rounded-lg shadow-lg overflow-hidden z-10">
                  {uniqueOrgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => setOrgDropdownOpen(false)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-white/12 transition-colors ${
                        org.id === selectedOrganizationId ? "text-[#a78bfa]" : "text-white"
                      }`}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((entry) =>
            entry.type === "item" ? renderItem(entry) : renderGroup(entry)
          )}
        </nav>

        {/* User */}
        <div className="mt-auto p-4 border-t border-white/8">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-3">
              <Link href="/account" className="group">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-transparent group-hover:ring-[#6c5ce7] transition-all"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-medium shrink-0 group-hover:bg-[#a78bfa] transition-colors">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
              </Link>
              <button
                onClick={() => logout()}
                className="p-2 text-white/55 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <Link href="/account" className="flex items-center flex-1 min-w-0 group">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-transparent group-hover:ring-[#6c5ce7] transition-all"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-medium shrink-0 group-hover:bg-[#a78bfa] transition-colors">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#c4b5fd] transition-colors">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => logout()}
                className="p-2 text-white/55 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "pl-20" : "pl-64"}`}>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
