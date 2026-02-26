/** Format a 10-digit phone string as (xxx) xxx-xxxx. Returns original value if not 10 digits. */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Progressively mask a phone input value as (xxx) xxx-xxxx.
 * Strips all non-digits, caps at 10, and formats based on how many digits exist.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Strip all non-digit characters from a phone number before sending to the backend. */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
