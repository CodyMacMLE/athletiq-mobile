/** Format a 10-digit phone string as (xxx) xxx-xxxx. Returns original value if not 10 digits. */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Strip all non-digit characters from a phone number before sending to the backend. */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
