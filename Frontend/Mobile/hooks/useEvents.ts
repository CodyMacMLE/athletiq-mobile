import { useQuery } from "@apollo/client";
import { GET_UPCOMING_EVENTS, GET_EVENTS, GET_EVENT } from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

export function useUpcomingEvents(limit = 10) {
  const { selectedOrganization } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_UPCOMING_EVENTS, {
    variables: { organizationId: selectedOrganization?.id, limit },
    skip: !selectedOrganization?.id,
  });

  return {
    events: data?.upcomingEvents || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useEvents(startDate?: string, endDate?: string) {
  const { selectedOrganization } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_EVENTS, {
    variables: {
      organizationId: selectedOrganization?.id,
      startDate,
      endDate,
    },
    skip: !selectedOrganization?.id,
  });

  return {
    events: data?.events || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useEvent(eventId: string) {
  const { data, loading, error } = useQuery(GET_EVENT, {
    variables: { id: eventId },
    skip: !eventId,
  });

  return {
    event: data?.event || null,
    isLoading: loading,
    error,
  };
}
