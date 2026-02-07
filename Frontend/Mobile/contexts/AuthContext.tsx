import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@apollo/client";
import { GET_ME, GET_MY_ORGANIZATIONS } from "@/lib/graphql";

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
  isLoading: boolean;
  setSelectedOrganization: (org: Organization) => void;
  refetchUser: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// For development, we'll use a hardcoded user ID
// In production, this would come from authentication
const DEV_USER_ID = "cody-user-id"; // This will be set after seeding

export function AuthProvider({ children }: { children: ReactNode }) {
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  const { data: userData, loading: userLoading, refetch: refetchUser } = useQuery(GET_ME, {
    // Skip if no user is logged in - in production this would check auth state
    skip: false,
  });

  const { data: orgsData, loading: orgsLoading } = useQuery(GET_MY_ORGANIZATIONS);

  const user = userData?.me || null;
  const organizations = orgsData?.myOrganizations || [];

  // Auto-select first organization if none selected
  useEffect(() => {
    if (!selectedOrganization && organizations.length > 0) {
      setSelectedOrganization(organizations[0]);
    }
  }, [organizations, selectedOrganization]);

  // Get the user's team ID for the selected organization
  const selectedTeamId = user?.memberships?.find(
    (m: User["memberships"][0]) => m.team.organization.id === selectedOrganization?.id
  )?.team.id || null;

  const value: AuthContextType = {
    user,
    organizations,
    selectedOrganization,
    selectedTeamId,
    isLoading: userLoading || orgsLoading,
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
