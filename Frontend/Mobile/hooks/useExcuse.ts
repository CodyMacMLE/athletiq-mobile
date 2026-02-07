import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_EXCUSE_REQUEST,
  CANCEL_EXCUSE_REQUEST,
  GET_MY_EXCUSE_REQUESTS,
  GET_UPCOMING_EVENTS,
} from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

export function useExcuseRequests() {
  const { user } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_MY_EXCUSE_REQUESTS, {
    variables: { userId: user?.id },
    skip: !user?.id,
  });

  return {
    excuseRequests: data?.myExcuseRequests || [],
    isLoading: loading,
    error,
    refetch,
  };
}

export function useExcuseMutations() {
  const { user, selectedOrganization } = useAuth();

  const [createExcuseMutation, { loading: creating }] = useMutation(CREATE_EXCUSE_REQUEST, {
    refetchQueries: [
      { query: GET_MY_EXCUSE_REQUESTS, variables: { userId: user?.id } },
      { query: GET_UPCOMING_EVENTS, variables: { organizationId: selectedOrganization?.id, limit: 10 } },
    ],
  });

  const [cancelExcuseMutation, { loading: canceling }] = useMutation(CANCEL_EXCUSE_REQUEST, {
    refetchQueries: [
      { query: GET_MY_EXCUSE_REQUESTS, variables: { userId: user?.id } },
      { query: GET_UPCOMING_EVENTS, variables: { organizationId: selectedOrganization?.id, limit: 10 } },
    ],
  });

  const createExcuseRequest = async (eventId: string, reason: string) => {
    if (!user) throw new Error("User not logged in");

    const result = await createExcuseMutation({
      variables: {
        input: {
          userId: user.id,
          eventId,
          reason,
        },
      },
    });

    return result.data?.createExcuseRequest;
  };

  const cancelExcuseRequest = async (excuseRequestId: string) => {
    const result = await cancelExcuseMutation({
      variables: { id: excuseRequestId },
    });

    return result.data?.cancelExcuseRequest;
  };

  return {
    createExcuseRequest,
    cancelExcuseRequest,
    isLoading: creating || canceling,
  };
}
