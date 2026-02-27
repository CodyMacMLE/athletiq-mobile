// Parse time strings like "6:00 PM" or "14:00" into hours/minutes
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Compute the duration of an event in hours given its startTime and endTime strings.
 * Returns 0 for "All Day" events or any unparseable/invalid input.
 */
export function computeEventDuration(startTime: string, endTime: string): number {
  if (!startTime || !endTime || startTime === "All Day" || endTime === "All Day") return 0;
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  const minutes = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
  return Math.max(0, minutes / 60);
}
