"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
  Menu,
  X,
  Megaphone,
  Heart,
} from "lucide-react";
import { useState, useEffect } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Users", href: "/users", icon: Users },
  { name: "Teams", href: "/teams", icon: UserCog },
  { name: "Events", href: "/events", icon: Calendar },
  { name: "Attendance", href: "/attendance", icon: ClipboardList },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Announcements", href: "/announcements", icon: Megaphone },
];

const adminOnlyNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, currentRole, isAdmin, canEdit, currentOrgRole, selectedOrganizationId, logout } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const teamOrgs = user?.memberships?.map((m) => m.team.organization) || [];
  const orgMemberOrgs = user?.organizationMemberships?.map((m) => m.organization) || [];
  const allOrgs = [...teamOrgs, ...orgMemberOrgs];
  const uniqueOrgs = [...new Map(allOrgs.map((o) => [o.id, o])).values()];
  const selectedOrg = uniqueOrgs.find((o) => o.id === selectedOrganizationId);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className="min-h-screen"
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
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>
              {orgDropdownOpen && uniqueOrgs.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white/10 rounded-lg shadow-lg overflow-hidden z-10">
                  {uniqueOrgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        // setSelectedOrganizationId(org.id);
                        setOrgDropdownOpen(false);
                      }}
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
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#6c5ce7] text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={sidebarCollapsed ? item.name : ""}
              >
                <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"}`} />
                {!sidebarCollapsed && item.name}
              </Link>
            );
          })}

          {currentOrgRole === "GUARDIAN" && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-white/40 uppercase">Guardian</p>
                </div>
              )}
              {sidebarCollapsed && <div className="border-t border-white/8 my-2"></div>}
              {[
                { name: "My Athletes", href: "/guardian", icon: Heart },
                { name: "Email Reports", href: "/guardian/email-reports", icon: Calendar },
              ].map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-[#6c5ce7] text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    } ${sidebarCollapsed ? "justify-center" : ""}`}
                    title={sidebarCollapsed ? item.name : ""}
                  >
                    <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </>
          )}

          {canEdit && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-white/40 uppercase">Admin</p>
                </div>
              )}
              {sidebarCollapsed && <div className="border-t border-white/8 my-2"></div>}
              {adminOnlyNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-[#6c5ce7] text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                    } ${sidebarCollapsed ? "justify-center" : ""}`}
                    title={sidebarCollapsed ? item.name : ""}
                  >
                    <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </>
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
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
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
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
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
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "pl-20" : "pl-64"
        }`}
      >
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
