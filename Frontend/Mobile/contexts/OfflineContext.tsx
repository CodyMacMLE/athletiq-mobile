import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useApolloClient } from "@apollo/client";
import {
  getPendingCheckIns,
  removeCheckIn,
  PendingCheckIn,
} from "@/lib/offline-queue";
import {
  NFC_CHECK_IN,
  GET_CHECKIN_HISTORY,
  GET_UPCOMING_EVENTS,
} from "@/lib/graphql";
import { useAuth } from "@/contexts/AuthContext";

const CONNECTIVITY_URL = "https://api.athletiq.fitness/graphql";
const POLL_OFFLINE_MS = 8_000;
const POLL_ONLINE_MS = 60_000;

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(CONNECTIVITY_URL, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timeoutId);
    return res.status < 500;
  } catch {
    return false;
  }
}

interface OfflineContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: async () => {},
  refreshPendingCount: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const apolloClient = useApolloClient();
  const { user, selectedOrganization } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Use refs for values needed inside timer callbacks to avoid stale closures
  const isSyncingRef = useRef(false);
  const isOnlineRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(user?.id);
  const orgIdRef = useRef(selectedOrganization?.id);
  const apolloRef = useRef(apolloClient);

  useEffect(() => { userIdRef.current = user?.id; }, [user]);
  useEffect(() => { orgIdRef.current = selectedOrganization?.id; }, [selectedOrganization]);
  useEffect(() => { apolloRef.current = apolloClient; }, [apolloClient]);

  const refreshPendingCount = useCallback(async () => {
    const queue = await getPendingCheckIns();
    setPendingCount(queue.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    const queue = await getPendingCheckIns();
    if (queue.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    await Promise.allSettled(
      queue.map(async (item: PendingCheckIn) => {
        try {
          await apolloRef.current.mutate({
            mutation: NFC_CHECK_IN,
            variables: { token: item.token, forUserId: item.forUserId },
            refetchQueries: [
              {
                query: GET_CHECKIN_HISTORY,
                variables: { userId: userIdRef.current, limit: 20 },
              },
              {
                query: GET_UPCOMING_EVENTS,
                variables: { organizationId: orgIdRef.current, limit: 10 },
              },
            ],
          });
          await removeCheckIn(item.id);
        } catch {
          // Leave in queue if the request fails
        }
      })
    );

    const remaining = await getPendingCheckIns();
    setPendingCount(remaining.length);
    isSyncingRef.current = false;
    setIsSyncing(false);
  }, []);

  // Keep a stable ref to syncNow so the poll loop can call it without restarts
  const syncNowRef = useRef(syncNow);
  useEffect(() => { syncNowRef.current = syncNow; }, [syncNow]);

  // ── Polling loop (pure JS, no native module) ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      const online = await checkConnectivity();
      const wasOnline = isOnlineRef.current;

      if (!cancelled) {
        if (online !== wasOnline) {
          isOnlineRef.current = online;
          setIsOnline(online);
          if (online && !wasOnline) syncNowRef.current();
        }
        pollTimerRef.current = setTimeout(poll, online ? POLL_ONLINE_MS : POLL_OFFLINE_MS);
      }
    }

    refreshPendingCount();
    poll();

    const appStateSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        poll();
      }
    });

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      appStateSub.remove();
    };
  }, []); // only run once on mount

  return (
    <OfflineContext.Provider
      value={{ isOnline, pendingCount, isSyncing, syncNow, refreshPendingCount }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
