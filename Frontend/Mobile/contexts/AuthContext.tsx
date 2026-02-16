import {
  cognitoConfirmNewPassword,
  cognitoSignIn,
  cognitoSignOut,
  getCognitoUser,
  type CognitoUser,
  type SignInResult,
} from "@/lib/cognito";
import { GET_ME, GET_MY_ORGANIZATIONS, GET_MY_LINKED_ATHLETES } from "@/lib/graphql";
import { useLazyQuery } from "@apollo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

export type TeamInfo = {
  id: string;
  name: string;
  role: string;
};

export type LinkedAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  image?: string;
};

type AuthContextType = {
  user: User | null;
  organizations: Organization[];
  selectedOrganization: Organization | null;
  selectedTeam: TeamInfo | null;
  selectedTeamId: string | null;
  teamRole: string | null;
  isTeamCoach: boolean;
  teamsForCurrentOrg: TeamInfo[];
  orgRole: string | null;
  isOrgAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  cognitoUser: CognitoUser | null;
  // Guardian state
  linkedAthletes: LinkedAthlete[];
  hasGuardianLinks: boolean;
  isViewingAsGuardian: boolean;
  isPureGuardian: boolean;
  selectedAthlete: LinkedAthlete | null;
  setSelectedAthlete: (athlete: LinkedAthlete | null) => void;
  exitGuardianMode: () => void;
  targetUserId: string | undefined;
  login: (email: string, password: string) => Promise<SignInResult>;
  confirmNewPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setSelectedOrganization: (org: Organization) => void;
  setSelectedTeam: (team: TeamInfo) => void;
  refetchUser: () => void;
};

const STORAGE_KEYS = {
  selectedOrg: "athletiq_selected_org",
  selectedTeam: (orgId: string) => `athletiq_selected_team_${orgId}`,
  selectedAthlete: (orgId: string) => `athletiq_selected_athlete_${orgId}`,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedOrganization, setSelectedOrganizationState] = useState<Organization | null>(null);
  const [selectedTeam, setSelectedTeamState] = useState<TeamInfo | null>(null);
  const [persistenceChecked, setPersistenceChecked] = useState(false);

  const [selectedAthlete, setSelectedAthleteState] = useState<LinkedAthlete | null>(null);

  const [fetchMe, { data: userData, loading: userLoading, called: userCalled }] = useLazyQuery(GET_ME);
  const [fetchOrgs, { data: orgsData, loading: orgsLoading, called: orgsCalled }] = useLazyQuery(GET_MY_ORGANIZATIONS);
  const [fetchLinkedAthletes, { data: linkedAthletesData }] = useLazyQuery(GET_MY_LINKED_ATHLETES);

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

  // Auto-select organization from persistence or first available
  useEffect(() => {
    if (!selectedOrganization && organizations.length > 0) {
      AsyncStorage.getItem(STORAGE_KEYS.selectedOrg).then((savedOrgId) => {
        const match = savedOrgId ? organizations.find((o: Organization) => o.id === savedOrgId) : null;
        setSelectedOrganizationState(match || organizations[0]);
        setPersistenceChecked(true);
      }).catch(() => {
        setSelectedOrganizationState(organizations[0]);
        setPersistenceChecked(true);
      });
    }
  }, [organizations, selectedOrganization]);

  // Compute teams for current org
  const teamsForCurrentOrg: TeamInfo[] = useMemo(() => {
    if (!user || !selectedOrganization) return [];
    return user.memberships
      .filter((m: User["memberships"][0]) => m.team.organization.id === selectedOrganization.id)
      .map((m: User["memberships"][0]) => ({
        id: m.team.id,
        name: m.team.name,
        role: m.role,
      }));
  }, [user, selectedOrganization]);

  // Auto-select team from persistence or first available
  useEffect(() => {
    if (selectedOrganization && teamsForCurrentOrg.length > 0 && !selectedTeam) {
      const storageKey = STORAGE_KEYS.selectedTeam(selectedOrganization.id);
      AsyncStorage.getItem(storageKey).then((savedTeamId) => {
        const match = savedTeamId ? teamsForCurrentOrg.find((t) => t.id === savedTeamId) : null;
        setSelectedTeamState(match || teamsForCurrentOrg[0]);
      }).catch(() => {
        setSelectedTeamState(teamsForCurrentOrg[0]);
      });
    }
  }, [teamsForCurrentOrg, selectedOrganization, selectedTeam]);

  // Derived values
  const selectedTeamId = selectedTeam?.id ?? null;
  const teamRole = selectedTeam?.role ?? null;
  const isTeamCoach = teamRole === "COACH" || teamRole === "ADMIN";

  // Get the user's org role for the selected organization
  const orgRole =
    user?.organizationMemberships?.find(
      (m: User["organizationMemberships"][0]) => m.organization.id === selectedOrganization?.id
    )?.role || null;

  const isOrgAdmin = orgRole === "OWNER" || orgRole === "MANAGER";

  // Fetch linked athletes when org changes
  useEffect(() => {
    if (selectedOrganization && cognitoUser) {
      fetchLinkedAthletes({ variables: { organizationId: selectedOrganization.id } });
    }
  }, [selectedOrganization, cognitoUser, fetchLinkedAthletes]);

  // Guardian derived state
  const linkedAthletes: LinkedAthlete[] = useMemo(() => {
    if (!linkedAthletesData?.myLinkedAthletes) return [];
    return linkedAthletesData.myLinkedAthletes.map((link: any) => ({
      id: link.athlete.id,
      firstName: link.athlete.firstName,
      lastName: link.athlete.lastName,
      image: link.athlete.image,
    }));
  }, [linkedAthletesData]);

  const hasGuardianLinks = linkedAthletes.length > 0;
  const isPureGuardian = orgRole === "GUARDIAN" && teamsForCurrentOrg.length === 0;
  const isViewingAsGuardian = selectedAthlete !== null;
  const targetUserId = isViewingAsGuardian ? selectedAthlete?.id : user?.id;

  // Auto-select first athlete for pure guardians, restore from storage for others
  useEffect(() => {
    if (!selectedOrganization || linkedAthletes.length === 0) return;

    if (isPureGuardian && !selectedAthlete) {
      // Pure guardian — auto-select first athlete
      const first = linkedAthletes[0];
      setSelectedAthleteState(first);
      AsyncStorage.setItem(STORAGE_KEYS.selectedAthlete(selectedOrganization.id), JSON.stringify(first)).catch(() => {});
      return;
    }

    // Non-pure guardian — try to restore from storage
    if (!isPureGuardian && !selectedAthlete && hasGuardianLinks) {
      AsyncStorage.getItem(STORAGE_KEYS.selectedAthlete(selectedOrganization.id)).then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as LinkedAthlete;
            // Verify athlete is still in linked athletes
            if (linkedAthletes.some((a) => a.id === parsed.id)) {
              setSelectedAthleteState(parsed);
            }
          } catch {}
        }
      }).catch(() => {});
    }
  }, [linkedAthletes, selectedOrganization, isPureGuardian]);

  const setSelectedAthlete = useCallback((athlete: LinkedAthlete | null) => {
    setSelectedAthleteState(athlete);
    if (selectedOrganization) {
      if (athlete) {
        AsyncStorage.setItem(STORAGE_KEYS.selectedAthlete(selectedOrganization.id), JSON.stringify(athlete)).catch(() => {});
      } else {
        AsyncStorage.removeItem(STORAGE_KEYS.selectedAthlete(selectedOrganization.id)).catch(() => {});
      }
    }
  }, [selectedOrganization]);

  const exitGuardianMode = useCallback(() => {
    if (!isPureGuardian) {
      setSelectedAthleteState(null);
      if (selectedOrganization) {
        AsyncStorage.removeItem(STORAGE_KEYS.selectedAthlete(selectedOrganization.id)).catch(() => {});
      }
    }
  }, [isPureGuardian, selectedOrganization]);

  const setSelectedOrganization = useCallback((org: Organization) => {
    setSelectedOrganizationState(org);
    setSelectedTeamState(null); // Reset team — will auto-select via effect
    setSelectedAthleteState(null); // Reset guardian mode on org switch
    AsyncStorage.setItem(STORAGE_KEYS.selectedOrg, org.id).catch(() => {});
  }, []);

  const setSelectedTeam = useCallback((team: TeamInfo) => {
    setSelectedTeamState(team);
    if (selectedOrganization) {
      AsyncStorage.setItem(STORAGE_KEYS.selectedTeam(selectedOrganization.id), team.id).catch(() => {});
    }
  }, [selectedOrganization]);

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
    setSelectedOrganizationState(null);
    setSelectedTeamState(null);
    setSelectedAthleteState(null);
    setPersistenceChecked(false);
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
  const isLoading = !authChecked || (isAuthenticated && (!userCalled || !orgsCalled || (!user && (userLoading || orgsLoading))));

  const value: AuthContextType = {
    user,
    organizations,
    selectedOrganization,
    selectedTeam,
    selectedTeamId,
    teamRole,
    isTeamCoach,
    teamsForCurrentOrg,
    orgRole,
    isOrgAdmin,
    isAuthenticated,
    isLoading,
    cognitoUser,
    // Guardian state
    linkedAthletes,
    hasGuardianLinks,
    isViewingAsGuardian,
    isPureGuardian,
    selectedAthlete,
    setSelectedAthlete,
    exitGuardianMode,
    targetUserId,
    login,
    confirmNewPassword,
    logout,
    setSelectedOrganization,
    setSelectedTeam,
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
