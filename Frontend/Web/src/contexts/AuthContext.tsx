import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useLazyQuery } from "@apollo/client/react";
import { GET_ME } from "@/lib/graphql";
import {
  cognitoSignIn,
  cognitoSignOut,
  getCognitoUser,
  type CognitoUser,
} from "@/lib/cognito";

export type TeamRole = "MEMBER" | "CAPTAIN" | "COACH" | "ADMIN";

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

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  image?: string;
  memberships: Membership[];
};

type AuthContextType = {
  user: User | null;
  cognitoUser: CognitoUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedOrganizationId: string | null;
  setSelectedOrganizationId: (id: string) => void;
  currentRole: TeamRole | null;
  isAdmin: boolean;
  isCoach: boolean;
  canEdit: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
  const [fetchMe, { data, loading: userLoading, refetch }] = useLazyQuery(GET_ME, {
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
    if (user?.memberships?.length > 0 && !selectedOrganizationId) {
      const firstOrg = user.memberships[0].team.organization;
      setSelectedOrganizationId(firstOrg.id);
    }
  }, [user, selectedOrganizationId]);

  // Get the user's role for the selected organization
  const currentMembership = user?.memberships?.find(
    (m: Membership) => m.team.organization.id === selectedOrganizationId
  );
  const currentRole = currentMembership?.role || null;

  // Role checks
  const isAdmin = currentRole === "ADMIN";
  const isCoach = currentRole === "COACH";
  const canEdit = isAdmin;

  const login = async (username: string, password: string) => {
    const result = await cognitoSignIn(username, password);
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
    isLoading: authLoading || userLoading,
    isAuthenticated: !!cognitoUser,
    selectedOrganizationId,
    setSelectedOrganizationId,
    currentRole,
    isAdmin,
    isCoach,
    canEdit,
    login,
    logout,
    refetch: refetch || (() => {}),
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
  allowedRoles = ["ADMIN", "COACH"]
}: {
  children: ReactNode;
  allowedRoles?: TeamRole[];
}) {
  const { isAuthenticated, isLoading, currentRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (currentRole && !allowedRoles.includes(currentRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Unauthorized</h1>
          <p className="text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Login page component
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Athletiq Admin</h1>
          <p className="mt-2 text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
