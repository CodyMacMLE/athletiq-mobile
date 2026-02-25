import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "athletiq_offline_checkin_queue";

export interface PendingCheckIn {
  id: string;
  token: string;
  forUserId?: string;
  queuedAt: string;
}

export async function getPendingCheckIns(): Promise<PendingCheckIn[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function enqueueCheckIn(
  params: Omit<PendingCheckIn, "id" | "queuedAt">
): Promise<PendingCheckIn> {
  const item: PendingCheckIn = {
    ...params,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  };
  const queue = await getPendingCheckIns();
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export async function removeCheckIn(id: string): Promise<void> {
  const queue = await getPendingCheckIns();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.id !== id)));
}

export async function clearPendingCheckIns(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
