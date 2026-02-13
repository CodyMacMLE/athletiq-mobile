import cron, { type ScheduledTask } from "node-cron";
import { markAbsentForEndedEvents } from "../services/markAbsent.js";

let task: ScheduledTask | null = null;
let isRunning = false;

async function runAbsentMarker(lookbackMinutes: number): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const count = await markAbsentForEndedEvents({ lookbackMinutes });
    if (count > 0) {
      console.log(`[absent-marker] Created ${count} ABSENT record(s)`);
    }
  } catch (err) {
    console.error("[absent-marker] Error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the absent-marker cron job.
 * Immediately runs a 7-day catch-up pass (covers server restarts/downtime),
 * then schedules a job every 5 minutes with a 30-minute lookback.
 */
export function startAbsentMarkerCron(): void {
  // 7-day catch-up pass on startup (10080 = 7 * 24 * 60)
  runAbsentMarker(10080);

  task = cron.schedule("*/5 * * * *", () => {
    runAbsentMarker(30);
  });

  console.log("[absent-marker] Cron scheduled (every 5 minutes)");
}

/** Stop the cron task (for graceful shutdown). */
export function stopAbsentMarkerCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
