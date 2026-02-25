import { useMutation, useQuery } from "@apollo/client";
import { CHECK_IN, CHECK_OUT, GET_CHECKIN_HISTORY } from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

export function useCheckIn() {
  const { user, selectedOrganization, selectedTeamId } = useAuth();

  const [checkInMutation, { loading: checkingIn }] = useMutation(CHECK_IN, {
    // Use query name strings so all active instances (with any teamId variable) are refetched
    refetchQueries: ["GetCheckInHistory", "GetUpcomingEvents"],
  });

  const [checkOutMutation, { loading: checkingOut }] = useMutation(CHECK_OUT, {
    refetchQueries: ["GetCheckInHistory"],
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
  const { user, selectedTeamId } = useAuth();

  const { data, loading, error, refetch } = useQuery(GET_CHECKIN_HISTORY, {
    variables: { userId: user?.id, teamId: selectedTeamId || undefined, limit },
    skip: !user?.id,
  });

  return {
    checkIns: data?.checkInHistory || [],
    isLoading: loading,
    error,
    refetch,
  };
}
