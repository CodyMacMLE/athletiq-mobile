"use client";

import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider, RequireAuth } from "@/contexts/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <RequireAuth allowedRoles={["OWNER", "ADMIN", "MANAGER", "COACH"]}>
          {children}
        </RequireAuth>
      </AuthProvider>
    </ApolloProvider>
  );
}
