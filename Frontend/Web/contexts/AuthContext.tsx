"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useLazyQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GET_ME } from "@/lib/graphql";
import {
  cognitoSignIn,
  cognitoSignOut,
  cognitoConfirmNewPassword,
  getCognitoUser,
  type CognitoUser,
  type SignInResult,
} from "@/lib/cognito";

export type TeamRole = "MEMBER" | "CAPTAIN" | "COACH" | "ADMIN";
export type OrgRole = "OWNER" | "ADMIN" | "MANAGER" | "COACH" | "ATHLETE" | "GUARDIAN";

type Membership = {
  id: string;
  role: TeamRole;
  team: {
    id: string;
    name: string;
    organization: {
      id: string;
      name: string;
    };
  };
};

type OrgMembership = {
  id: string;
  role: OrgRole;
  organization: {
    id: string;
    name: string;
  };
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string;
  memberships: Membership[];
  organizationMemberships: OrgMembership[];
};

type AuthContextType = {
  user: User | null;
  cognitoUser: CognitoUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string) => void;
  currentRole: TeamRole | null;
  currentOrgRole: OrgRole | null;
  isOwner: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isCoach: boolean;
  canEdit: boolean;
  canManageOrg: boolean;
  login: (username: string, password: string) => Promise<SignInResult>;
  confirmNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check for existing Cognito session on mount
  useEffect(() => {
    async function checkAuth() {
      const user = await getCognitoUser();
      setCognitoUser(user);
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  // Fetch user data from GraphQL only when authenticated with Cognito
  const [fetchMe, { data, loading: userLoading, called: meCalled, refetch }] = useLazyQuery<any>(GET_ME, {
    errorPolicy: "all",
  });

  // Fetch user data when Cognito auth is confirmed
  useEffect(() => {
    if (cognitoUser) {
      fetchMe();
    }
  }, [cognitoUser, fetchMe]);

  const user = data?.me || null;

  // Auto-select first organization
  useEffect(() => {
    if (user?.organizationMemberships?.length > 0 && !selectedOrganizationId) {
      const firstOrg = user.organizationMemberships[0].organization;
      setSelectedOrganizationId(firstOrg.id);
    }
  }, [user, selectedOrganizationId]);

  // Get the user's org-level role for the selected organization
  const currentOrgMembership = user?.organizationMemberships?.find(
    (m: OrgMembership) => m.organization.id === selectedOrganizationId
  );
  const currentOrgRole = currentOrgMembership?.role || null;

  // Keep team-level role available for team-specific features
  const currentMembership = user?.memberships?.find(
    (m: Membership) => m.team.organization.id === selectedOrganizationId
  );
  const currentRole = currentMembership?.role || null;

  // Org-level role checks
  const isOwner = currentOrgRole === "OWNER";
  const isManager = currentOrgRole === "MANAGER";
  const isAdmin = currentOrgRole === "ADMIN";
  const isCoach = currentOrgRole === "COACH";
  const canManageOrg = isOwner || isAdmin;
  const canEdit = isOwner || isAdmin || isManager || isCoach;

  const login = async (username: string, password: string) => {
    const result = await cognitoSignIn(username, password);
    if (result.success) {
      const user = await getCognitoUser();
      setCognitoUser(user);
    }
    return result;
  };

  const confirmNewPassword = async (newPassword: string) => {
    const result = await cognitoConfirmNewPassword(newPassword);
    if (result.success) {
      const user = await getCognitoUser();
      setCognitoUser(user);
    }
    return result;
  };

  const logout = async () => {
    await cognitoSignOut();
    setCognitoUser(null);
  };

  const value: AuthContextType = {
    user,
    cognitoUser,
    isLoading: authLoading || userLoading || (!!cognitoUser && !meCalled),
    isAuthenticated: !!cognitoUser,
    selectedOrganizationId,
    setSelectedOrganizationId,
    currentRole,
    currentOrgRole,
    isOwner,
    isManager,
    isAdmin,
    isCoach,
    canEdit,
    canManageOrg,
    login,
    confirmNewPassword,
    logout,
    refetch: () => fetchMe(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// HOC for protecting routes
export function RequireAuth({
  children,
  allowedRoles = ["OWNER", "ADMIN", "MANAGER", "COACH"]
}: {
  children: ReactNode;
  allowedRoles?: OrgRole[];
}) {
  const { isAuthenticated, isLoading, currentOrgRole, user } = useAuth();
  const router = useRouter();

  // Redirect to account if user has no org memberships (e.g. org creation failed during registration)
  // Also covers the case where DB user record doesn't exist yet (user is null)
  const needsSetup = isAuthenticated && !isLoading && (!user || user.organizationMemberships?.length === 0);
  useEffect(() => {
    if (needsSetup) {
      router.replace("/account");
    }
  }, [needsSetup, router]);

  // Redirect unauthenticated users to sign-in page
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (needsSetup) {
    // Show loading while redirecting to profile
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!currentOrgRole || !allowedRoles.includes(currentOrgRole)) {
    return <AppDownloadPage />;
  }

  return <>{children}</>;
}

// App download page for athletes/guardians who don't have dashboard access
function AppDownloadPage() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
          <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Get the Athletiq App</h1>
          <p className="text-gray-400 text-sm mb-6">
            {user?.firstName ? `Hey ${user.firstName}! ` : ""}The Athletiq dashboard is for coaches and managers. Download the mobile app to check in to events, track hours, and stay connected with your team.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
            >
              App Store &mdash; Coming Soon
            </button>
            <button
              disabled
              className="w-full py-3 px-4 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed text-sm"
            >
              Google Play &mdash; Coming Soon
            </button>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/account"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Manage Profile
            </Link>
            <span className="text-gray-600">&middot;</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

