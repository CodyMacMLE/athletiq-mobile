import {
  cognitoConfirmNewPassword,
  cognitoSignIn,
  cognitoSignOut,
  getCognitoUser,
  type CognitoUser,
  type SignInResult,
} from "@/lib/cognito";
import { GET_ME, GET_MY_ORGANIZATIONS } from "@/lib/graphql";
import { useLazyQuery } from "@apollo/client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

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
  memberships: Array<{
    id: string;
    role: string;
    hoursRequired: number;
    team: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
        image?: string;
      };
    };
  }>;
  organizationMemberships: Array<{
    id: string;
    role: string;
    organization: {
      id: string;
      name: string;
    };
  }>;
};

type Organization = {
  id: string;
  name: string;
  image?: string;
  memberCount: number;
};

type AuthContextType = {
  user: User | null;
  organizations: Organization[];
  selectedOrganization: Organization | null;
  selectedTeamId: string | null;
  orgRole: string | null;
  isOrgAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  cognitoUser: CognitoUser | null;
  login: (email: string, password: string) => Promise<SignInResult>;
  confirmNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSelectedOrganization: (org: Organization) => void;
  refetchUser: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const [fetchMe, { data: userData, loading: userLoading, called: userCalled }] = useLazyQuery(GET_ME);
  const [fetchOrgs, { data: orgsData, loading: orgsLoading, called: orgsCalled }] = useLazyQuery(GET_MY_ORGANIZATIONS);

  // Check for existing Cognito session on mount
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        // Race against a timeout in case Amplify hangs
        const user = await Promise.race([
          getCognitoUser(),
          new Promise<null>((resolve) => {
            timeout = setTimeout(() => resolve(null), 5000);
          }),
        ]);
        if (user) {
          setCognitoUser(user);
        }
      } catch {
        // No session found or Amplify error — continue as unauthenticated
      } finally {
        setAuthChecked(true);
      }
    })();
    return () => clearTimeout(timeout);
  }, []);

  // Fetch user data when cognito user is set
  useEffect(() => {
    if (cognitoUser) {
      fetchMe();
      fetchOrgs();
    }
  }, [cognitoUser, fetchMe, fetchOrgs]);

  const user = userData?.me || null;
  const organizations = orgsData?.myOrganizations || [];

  // Auto-select first organization if none selected
  useEffect(() => {
    if (!selectedOrganization && organizations.length > 0) {
      setSelectedOrganization(organizations[0]);
    }
  }, [organizations, selectedOrganization]);

  // Get the user's team ID for the selected organization
  const selectedTeamId =
    user?.memberships?.find(
      (m: User["memberships"][0]) => m.team.organization.id === selectedOrganization?.id
    )?.team.id || null;

  // Get the user's org role for the selected organization
  const orgRole =
    user?.organizationMemberships?.find(
      (m: User["organizationMemberships"][0]) => m.organization.id === selectedOrganization?.id
    )?.role || null;

  const isOrgAdmin = orgRole === "OWNER" || orgRole === "MANAGER";

  const login = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const result = await cognitoSignIn(email, password);
    if (result.success) {
      const user = await getCognitoUser();
      setCognitoUser(user);
    }
    return result;
  }, []);

  const confirmNewPassword = useCallback(
    async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
      const result = await cognitoConfirmNewPassword(newPassword);
      if (result.success) {
        const user = await getCognitoUser();
        setCognitoUser(user);
      }
      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    await cognitoSignOut();
    setCognitoUser(null);
    setSelectedOrganization(null);
    // Reset Apollo store to clear cached data - use require to avoid circular import
    const { apolloClient } = require("@/lib/apollo");
    await apolloClient.resetStore();
  }, []);

  const refetchUser = useCallback(() => {
    if (cognitoUser) {
      fetchMe();
      fetchOrgs();
    }
  }, [cognitoUser, fetchMe, fetchOrgs]);

  const isAuthenticated = !!cognitoUser;
  const isLoading = !authChecked || (isAuthenticated && (!userCalled || !orgsCalled || userLoading || orgsLoading));

  const value: AuthContextType = {
    user,
    organizations,
    selectedOrganization,
    selectedTeamId,
    orgRole,
    isOrgAdmin,
    isAuthenticated,
    isLoading,
    cognitoUser,
    login,
    confirmNewPassword,
    logout,
    setSelectedOrganization,
    refetchUser,
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
