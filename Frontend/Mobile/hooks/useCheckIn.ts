import { useMutation, useQuery } from "@apollo/client";
import { CHECK_IN, CHECK_OUT, GET_CHECKIN_HISTORY, GET_UPCOMING_EVENTS } from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

export function useCheckIn() {
  const { user, selectedOrganization } = useAuth();

  const [checkInMutation, { loading: checkingIn }] = useMutation(CHECK_IN, {
    refetchQueries: [
      { query: GET_CHECKIN_HISTORY, variables: { userId: user?.id, limit: 20 } },
      { query: GET_UPCOMING_EVENTS, variables: { organizationId: selectedOrganization?.id, limit: 10 } },
    ],
  });

  const [checkOutMutation, { loading: checkingOut }] = useMutation(CHECK_OUT, {
    refetchQueries: [
      { query: GET_CHECKIN_HISTORY, variables: { userId: user?.id, limit: 20 } },
    ],
  });

  const checkIn = async (eventId: string) => {
    if (!user) throw new Error("User not logged in");

    const result = await checkInMutation({
      variables: {
        input: {
          userId: user.id,
          eventId,
        },
      },
    });

    return result.data?.checkIn;
  };

  const checkOut = async (checkInId: string) => {
    const result = await checkOutMutation({
      variables: {
        input: {
          checkInId,
        },
      },
    });

    return result.data?.checkOut;
  };

  return {
    checkIn,
    checkOut,
    isLoading: checkingIn || checkingOut,
  };
}

export function useCheckInHistory(limit = 20) {
  const { user } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_CHECKIN_HISTORY, {
    variables: { userId: user?.id, limit },
    skip: !user?.id,
  });

  return {
    checkIns: data?.checkInHistory || [],
    isLoading: loading,
    error,
    refetch,
  };
}
