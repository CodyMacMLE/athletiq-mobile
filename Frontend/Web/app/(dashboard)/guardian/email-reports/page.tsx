"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { gql } from "@apollo/client";
import { Mail, Users, Check, Send, Clock } from "lucide-react";

const GET_EMAIL_REPORT_CONFIGS = gql`
  query GetEmailReportConfigs {
    myEmailReportConfigs {
      id
      frequency
      enabled
      lastSentAt
      organization {
        id
        name
      }
    }
  }
`;

const GET_LINKED_ATHLETES = gql`
  query GetLinkedAthletes($organizationId: ID!) {
    myLinkedAthletes(organizationId: $organizationId) {
      id
      athlete {
        id
        firstName
        lastName
      }
    }
  }
`;

const CREATE_EMAIL_REPORT_CONFIG = gql`
  mutation CreateEmailReportConfig($input: CreateEmailReportConfigInput!) {
    createEmailReportConfig(input: $input) {
      id
      frequency
      enabled
      organization {
        id
        name
      }
    }
  }
`;

const UPDATE_EMAIL_REPORT_CONFIG = gql`
  mutation UpdateEmailReportConfig($id: ID!, $enabled: Boolean) {
    updateEmailReportConfig(id: $id, enabled: $enabled) {
      id
      frequency
      enabled
    }
  }
`;

const DELETE_EMAIL_REPORT_CONFIG = gql`
  mutation DeleteEmailReportConfig($id: ID!) {
    deleteEmailReportConfig(id: $id)
  }
`;

const SEND_TEST_REPORT = gql`
  mutation SendTestReport($configId: ID!) {
    sendTestReport(configId: $configId)
  }
`;

type ReportFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUALLY" | "ANNUALLY";

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string; description: string }[] = [
  { value: "WEEKLY", label: "Weekly", description: "Every week" },
  { value: "MONTHLY", label: "Monthly", description: "Once a month" },
  { value: "QUARTERLY", label: "Quarterly", description: "Every 3 months" },
  { value: "BIANNUALLY", label: "Bi-annually", description: "Twice a year" },
  { value: "ANNUALLY", label: "Annually", description: "Once a year" },
];

export default function EmailReportsPage() {
  const { selectedOrganizationId, currentOrgRole } = useAuth();
  const [togglingFreq, setTogglingFreq] = useState<string | null>(null);
  const [testSentFreq, setTestSentFreq] = useState<string | null>(null);

  const { data: configsData, loading, refetch } = useQuery(GET_EMAIL_REPORT_CONFIGS);
  const { data: athletesData } = useQuery(GET_LINKED_ATHLETES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createConfig] = useMutation(CREATE_EMAIL_REPORT_CONFIG);
  const [updateConfig] = useMutation(UPDATE_EMAIL_REPORT_CONFIG);
  const [deleteConfig] = useMutation(DELETE_EMAIL_REPORT_CONFIG);
  const [sendTestReport] = useMutation(SEND_TEST_REPORT);

  const isGuardian = currentOrgRole === "GUARDIAN";
  const configs: any[] = (configsData as any)?.myEmailReportConfigs || [];
  const linkedAthletes: any[] = (athletesData as any)?.myLinkedAthletes || [];

  // Build a map of frequency → config for the selected org
  const configsByFreq = new Map<string, any>(
    configs
      .filter((c: any) => c.organization.id === selectedOrganizationId)
      .map((c: any) => [c.frequency, c])
  );

  const handleToggle = async (frequency: ReportFrequency) => {
    if (!selectedOrganizationId || togglingFreq) return;
    setTogglingFreq(frequency);
    try {
      const existing = configsByFreq.get(frequency);
      if (existing) {
        // Toggle enabled/disabled
        if (existing.enabled) {
          await deleteConfig({ variables: { id: existing.id } });
        } else {
          await updateConfig({ variables: { id: existing.id, enabled: true } });
        }
      } else {
        // Create new config for this frequency
        await createConfig({
          variables: { input: { organizationId: selectedOrganizationId, frequency } },
        });
      }
      await refetch();
    } catch (err) {
      console.error("Failed to toggle report frequency:", err);
    } finally {
      setTogglingFreq(null);
    }
  };

  const handleSendTest = async (frequency: ReportFrequency) => {
    const config = configsByFreq.get(frequency);
    if (!config) return;
    try {
      await sendTestReport({ variables: { configId: config.id } });
      setTestSentFreq(frequency);
      setTimeout(() => setTestSentFreq(null), 3000);
    } catch (err) {
      console.error("Failed to send test report:", err);
    }
  };

  if (!isGuardian) {
    return (
      <div className="max-w-2xl">
        <div className="text-center py-12">
          <Mail className="w-12 h-12 mx-auto text-white/30 mb-4" />
          <h3 className="text-lg font-medium text-white/55">
            Email reports are only available for guardians
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Email Reports</h1>

      {/* Linked Athletes */}
      {linkedAthletes.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#a78bfa]" />
            <h2 className="text-lg font-semibold text-white">Your Athletes</h2>
          </div>
          <div className="bg-white/8 rounded-lg border border-white/8 p-4">
            <div className="flex flex-wrap gap-2">
              {linkedAthletes.map((link: any) => (
                <span
                  key={link.id}
                  className="px-3 py-1 bg-[#a855f7]/15 text-[#c4b5fd] rounded-full text-sm"
                >
                  {link.athlete.firstName} {link.athlete.lastName}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Report Frequencies */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-[#a78bfa]" />
          <h2 className="text-lg font-semibold text-white">Report Frequency</h2>
        </div>
        <div className="bg-white/8 rounded-lg border border-white/8 p-4 space-y-5">
          <p className="text-sm text-white/55">
            Choose how often you receive attendance reports for your athletes. You can enable multiple frequencies.
          </p>

          {loading ? (
            <div className="text-center py-4 text-white/40 text-sm">Loading...</div>
          ) : linkedAthletes.length === 0 ? (
            <div className="text-center py-4 text-white/40 text-sm">
              You need linked athletes before setting up email reports.
            </div>
          ) : (
            <div className="space-y-3">
              {FREQUENCY_OPTIONS.map((option) => {
                const config = configsByFreq.get(option.value);
                const active = config?.enabled === true;
                const isToggling = togglingFreq === option.value;
                const lastSentAt = config?.lastSentAt;
                const testSent = testSentFreq === option.value;

                return (
                  <div
                    key={option.value}
                    className="flex items-center justify-between px-3 py-2.5 bg-white/5 rounded-lg"
                  >
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => !isToggling && handleToggle(option.value)}
                    >
                      {/* Toggle switch */}
                      <div
                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                          isToggling ? "opacity-50" : ""
                        } ${active ? "bg-[#6c5ce7]" : "bg-white/15"}`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            active ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{option.label}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-white/40">{option.description}</p>
                          {lastSentAt && (
                            <p className="text-xs text-white/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last sent {new Date(lastSentAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Send test button — only shown when active */}
                    {active && (
                      <button
                        onClick={() => handleSendTest(option.value)}
                        className={`ml-3 p-1.5 rounded-lg transition-colors shrink-0 ${
                          testSent
                            ? "text-green-400 bg-green-600/15"
                            : "text-white/40 hover:text-[#a78bfa] hover:bg-[#a855f7]/10"
                        }`}
                        title="Send test report now"
                      >
                        {testSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
