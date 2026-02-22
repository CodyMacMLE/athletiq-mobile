"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { gql } from "@apollo/client";
import {
  Plus,
  Mail,
  Trash2,
  Calendar,
  Users,
  Send,
  Clock,
  Edit2,
  Check,
  X,
} from "lucide-react";

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
  mutation UpdateEmailReportConfig($id: ID!, $frequency: ReportFrequency, $enabled: Boolean) {
    updateEmailReportConfig(id: $id, frequency: $frequency, enabled: $enabled) {
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

type ReportFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUALLY";

type EmailReportConfig = {
  id: string;
  frequency: ReportFrequency;
  enabled: boolean;
  lastSentAt: string | null;
  organization: {
    id: string;
    name: string;
  };
};

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string; description: string }[] = [
  { value: "WEEKLY", label: "Weekly", description: "Every Monday at 8 AM" },
  { value: "MONTHLY", label: "Monthly", description: "1st of each month at 8 AM" },
  { value: "QUARTERLY", label: "Quarterly", description: "Every 3 months" },
  { value: "BIANNUALLY", label: "Bi-annually", description: "Every 6 months" },
];

export default function EmailReportsPage() {
  const { selectedOrganizationId, currentOrgRole, user } = useAuth();
  const selectedOrg = user?.organizationMemberships?.find(
    (m: any) => m.organization.id === selectedOrganizationId
  )?.organization ?? null;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrequency, setEditFrequency] = useState<ReportFrequency>("WEEKLY");
  const [newFrequency, setNewFrequency] = useState<ReportFrequency>("WEEKLY");

  const { data: configsData, loading, refetch } = useQuery(GET_EMAIL_REPORT_CONFIGS);

  const { data: athletesData } = useQuery(GET_LINKED_ATHLETES, {
    variables: { organizationId: selectedOrganizationId },
    skip: !selectedOrganizationId,
  });

  const [createConfig] = useMutation(CREATE_EMAIL_REPORT_CONFIG, {
    onCompleted: () => {
      refetch();
      setShowCreateModal(false);
    },
  });

  const [updateConfig] = useMutation(UPDATE_EMAIL_REPORT_CONFIG, {
    onCompleted: () => {
      refetch();
      setEditingId(null);
    },
  });

  const [deleteConfig] = useMutation(DELETE_EMAIL_REPORT_CONFIG, {
    onCompleted: () => refetch(),
  });

  const [sendTestReport] = useMutation(SEND_TEST_REPORT);

  // Check if user is a guardian
  const isGuardian = currentOrgRole === "GUARDIAN";

  const handleCreate = async () => {
    if (!selectedOrganizationId) return;
    try {
      await createConfig({
        variables: {
          input: {
            organizationId: selectedOrganizationId,
            frequency: newFrequency,
          },
        },
      });
    } catch (error) {
      console.error("Failed to create email report config:", error);
      alert("Failed to create email report. Make sure you have linked athletes.");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateConfig({
        variables: {
          id,
          frequency: editFrequency,
        },
      });
    } catch (error) {
      console.error("Failed to update config:", error);
      alert("Failed to update configuration");
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateConfig({
        variables: {
          id,
          enabled: !enabled,
        },
      });
    } catch (error) {
      console.error("Failed to toggle config:", error);
      alert("Failed to update configuration");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email report configuration?"))
      return;
    try {
      await deleteConfig({ variables: { id } });
    } catch (error) {
      console.error("Failed to delete config:", error);
      alert("Failed to delete configuration");
    }
  };

  const handleSendTest = async (id: string) => {
    try {
      await sendTestReport({ variables: { configId: id } });
      alert("Test report sent! Check your email.");
    } catch (error) {
      console.error("Failed to send test report:", error);
      alert("Failed to send test report");
    }
  };

  const configs = (configsData as any)?.myEmailReportConfigs || [];
  const linkedAthletes = (athletesData as any)?.myLinkedAthletes || [];

  if (!isGuardian) {
    return (
      <div className="min-h-screen bg-transparent text-white p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Mail className="w-12 h-12 mx-auto text-white/30 mb-4" />
          <h3 className="text-lg font-medium text-white/55">
            Email reports are only available for guardians
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Email Reports</h1>
            <p className="text-white/55 mt-1">
              Receive attendance reports for your athletes
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>

        {/* Linked Athletes Info */}
        {linkedAthletes.length > 0 && (
          <div className="bg-white/8 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#a78bfa]" />
              <h3 className="font-medium">Your Athletes</h3>
            </div>
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
        )}

        {/* Configs List */}
        {loading ? (
          <div className="text-center py-12 text-white/55">Loading...</div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 mx-auto text-white/30 mb-4" />
            <h3 className="text-lg font-medium text-white/55 mb-2">
              No email reports configured
            </h3>
            <p className="text-sm text-white/40 mb-4">
              Set up automated email reports to track your athletes' attendance
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-[#a78bfa] hover:text-[#c4b5fd]"
            >
              Create your first report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config: EmailReportConfig) => (
              <div
                key={config.id}
                className="bg-white/8 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {config.organization.name}
                      </h3>
                      {config.enabled ? (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-white/10 text-white/55 text-xs font-medium rounded-full flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Paused
                        </span>
                      )}
                    </div>

                    {editingId === config.id ? (
                      <div className="space-y-3">
                        <select
                          value={editFrequency}
                          onChange={(e) =>
                            setEditFrequency(e.target.value as ReportFrequency)
                          }
                          className="w-full px-3 py-2 bg-white/15 border border-white/25 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                        >
                          {FREQUENCY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} - {opt.description}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(config.id)}
                            className="px-3 py-1.5 bg-[#6c5ce7] hover:bg-[#5a4dd4] rounded text-sm font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-white/8 hover:bg-white/12 rounded text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-sm text-white/55">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {
                            FREQUENCY_OPTIONS.find(
                              (f) => f.value === config.frequency
                            )?.label
                          }
                        </div>
                        {config.lastSentAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Last sent{" "}
                            {new Date(config.lastSentAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== config.id && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleSendTest(config.id)}
                        className="p-2 hover:bg-[#a855f7]/15 text-[#a78bfa] rounded-lg transition-colors"
                        title="Send test report"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(config.id);
                          setEditFrequency(config.frequency);
                        }}
                        className="p-2 hover:bg-blue-600/20 text-blue-400 rounded-lg transition-colors"
                        title="Edit frequency"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleEnabled(config.id, config.enabled)
                        }
                        className={`p-2 rounded-lg transition-colors ${
                          config.enabled
                            ? "hover:bg-yellow-600/20 text-yellow-400"
                            : "hover:bg-green-600/20 text-green-400"
                        }`}
                        title={config.enabled ? "Pause reports" : "Resume reports"}
                      >
                        {config.enabled ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                        title="Delete configuration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/8 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold mb-4">Create Email Report</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Organization
                  </label>
                  <div className="px-3 py-2 bg-white/15 border border-white/25 rounded-lg text-white/55">
                    {selectedOrg?.name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Frequency
                  </label>
                  <select
                    value={newFrequency}
                    onChange={(e) =>
                      setNewFrequency(e.target.value as ReportFrequency)
                    }
                    className="w-full px-3 py-2 bg-white/15 border border-white/25 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6c5ce7]"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} - {opt.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3 text-sm text-blue-300">
                  Reports will include attendance data for all your linked athletes
                  in {selectedOrg?.name}.
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-white/8 hover:bg-white/12 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={linkedAthletes.length === 0}
                    className="flex-1 px-4 py-2 bg-[#6c5ce7] hover:bg-[#5a4dd4] disabled:bg-white/8 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    Create Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
