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
  const { user, currentRole, isAdmin, canEdit, selectedOrganizationId, logout } = useAuth();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const organizations = user?.memberships?.map((m) => m.team.organization) || [];
  const uniqueOrgs = [...new Map(organizations.map((o) => [o.id, o])).values()];
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
    <div className="min-h-screen bg-gray-900">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 bg-gray-800 border-r border-gray-700 z-50 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
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
            className={`p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ${
              sidebarCollapsed ? "mx-auto" : ""
            }`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Organization Selector */}
        {!sidebarCollapsed && (
          <div className="px-4 py-4 border-b border-gray-700">
            <div className="relative">
              <button
                onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-700 rounded-lg text-white hover:bg-gray-600 transition-colors"
              >
                <span className="truncate">{selectedOrg?.name || "Select Organization"}</span>
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>
              {orgDropdownOpen && uniqueOrgs.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                  {uniqueOrgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        // setSelectedOrganizationId(org.id);
                        setOrgDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-600 transition-colors ${
                        org.id === selectedOrganizationId ? "text-purple-400" : "text-white"
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
                    ? "bg-purple-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={sidebarCollapsed ? item.name : ""}
              >
                <item.icon className={`w-5 h-5 ${sidebarCollapsed ? "" : "mr-3"}`} />
                {!sidebarCollapsed && item.name}
              </Link>
            );
          })}

          {canEdit && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-gray-500 uppercase">Admin</p>
                </div>
              )}
              {sidebarCollapsed && <div className="border-t border-gray-700 my-2"></div>}
              {adminOnlyNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-purple-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
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
        <div className="mt-auto p-4 border-t border-gray-700">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-3">
              <Link href="/account" className="group">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-transparent group-hover:ring-purple-500 transition-all"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium shrink-0 group-hover:bg-purple-500 transition-colors">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                )}
              </Link>
              <button
                onClick={() => logout()}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-transparent group-hover:ring-purple-500 transition-all"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium shrink-0 group-hover:bg-purple-500 transition-colors">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                )}
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                    {user?.firstName} {user?.lastName}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => logout()}
                className="p-2 text-gray-400 hover:text-white transition-colors"
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
