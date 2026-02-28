import CircuitBreaker from "opossum";
import { logger, captureError } from "./logger.js";

// ─── Circuit Breaker Factory ───────────────────────────────────────────────────
// Wraps async functions (SES, SNS, S3) in a circuit breaker.
// If calls fail repeatedly, the circuit opens and falls back gracefully instead
// of hanging for 30+ seconds waiting for AWS service timeouts.
//
// States:
//   CLOSED  — normal operation, calls pass through
//   OPEN    — circuit tripped, calls immediately return the fallback
//   HALF_OPEN — one probe call is allowed through to test if the service recovered

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 8000,         // Treat call as failure if it takes > 8s
  errorThresholdPercentage: 50,  // Open after 50% failures in the window
  resetTimeout: 30_000,  // Try again after 30s in OPEN state
  volumeThreshold: 5,    // Minimum calls before the circuit can trip
};

/**
 * Creates a circuit-broken version of `fn`.
 *
 * @param fn         The async function to protect (e.g. `() => ses.send(cmd)`)
 * @param serviceName Short label for logging (e.g. "SES", "SNS", "S3")
 * @param fallback   Optional fallback value when the circuit is open. Defaults to undefined.
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  serviceName: string,
  options: Partial<CircuitBreaker.Options> = {}
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker(fn, { ...DEFAULT_OPTIONS, ...options, name: serviceName });

  breaker.on("open", () => {
    logger.warn({ service: serviceName }, "Circuit breaker OPENED — calls will be rejected");
    captureError(new Error(`Circuit breaker opened for ${serviceName}`), { service: serviceName });
  });

  breaker.on("halfOpen", () => {
    logger.info({ service: serviceName }, "Circuit breaker HALF-OPEN — probing");
  });

  breaker.on("close", () => {
    logger.info({ service: serviceName }, "Circuit breaker CLOSED — service recovered");
  });

  breaker.on("timeout", () => {
    logger.warn({ service: serviceName }, "Circuit breaker call timed out");
  });

  breaker.on("fallback", (result: unknown) => {
    logger.warn({ service: serviceName, fallback: result }, "Circuit breaker fallback triggered");
  });

  return breaker;
}

/**
 * Fire-and-forget wrapper — calls the function but swallows circuit-open errors.
 * Suitable for non-critical side effects like sending email notifications.
 */
export async function fireAndForget<TArgs extends unknown[], TResult>(
  breaker: CircuitBreaker<TArgs, TResult>,
  ...args: TArgs
): Promise<void> {
  try {
    await breaker.fire(...args);
  } catch (err) {
    // Circuit is open or call failed — log and continue.
    // The main request should still succeed.
    logger.warn({ err, name: breaker.name }, "Non-critical external call failed (circuit breaker)");
  }
}
