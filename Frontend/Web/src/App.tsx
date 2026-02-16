import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider, RequireAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Dashboard, Athletes, Teams, Events, Attendance, Analytics } from "@/views";
import { Invite } from "@/views/Invite";

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public route — no auth required */}
            <Route path="/invite" element={<Invite />} />

            {/* Authenticated routes */}
            <Route
              path="/*"
              element={
                <RequireAuth allowedRoles={["ADMIN", "COACH"]}>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/athletes" element={<Athletes />} />
                      <Route path="/teams" element={<Teams />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/analytics" element={<Analytics />} />
                    </Routes>
                  </Layout>
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;
