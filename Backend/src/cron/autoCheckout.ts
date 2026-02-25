import cron, { type ScheduledTask } from "node-cron";
import { autoCheckoutEndedEvents } from "../services/autoCheckout.js";

let task: ScheduledTask | null = null;
let isRunning = false;

async function runAutoCheckout(lookbackMinutes: number): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const count = await autoCheckoutEndedEvents({ lookbackMinutes });
    if (count > 0) {
      console.log(`[auto-checkout] Checked out ${count} open check-in(s)`);
    }
  } catch (err) {
    console.error("[auto-checkout] Error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the auto-checkout cron job.
 * Immediately runs a 7-day catch-up pass (covers server restarts/downtime),
 * then schedules a job every 5 minutes with a 30-minute lookback.
 */
export function startAutoCheckoutCron(): void {
  // 7-day catch-up pass on startup (10080 = 7 * 24 * 60)
  runAutoCheckout(10080);

  task = cron.schedule("*/5 * * * *", () => {
    runAutoCheckout(30);
  });

  console.log("[auto-checkout] Cron scheduled (every 5 minutes)");
}

/** Stop the cron task (for graceful shutdown). */
export function stopAutoCheckoutCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
