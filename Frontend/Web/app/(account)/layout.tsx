"use client";

import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider } from "@/contexts/AuthContext";

// The account page is accessible to all authenticated users (including athletes
// and guardians who have no dashboard access), so we do NOT wrap it in
// RequireAuth. The page itself handles the unauthenticated redirect.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>{children}</AuthProvider>
    </ApolloProvider>
  );
}
