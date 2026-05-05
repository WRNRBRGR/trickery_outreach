import { formatInTimeZone } from "date-fns-tz";

/**
 * Calculates the best time in the USER's local time (or UTC) to send a mail
 * so that it arrives between 9am and 12pm in the RECIPIENT'S timezone.
 */
export function getOptimalSendTimeRange(recipientTimezone: string) {
  const now = new Date();
  
  // We want the recipient to get it between 9:00 and 12:00 in their TZ.
  // We'll calculate what that time is in the browser's local time.
  
  const recipient9am = new Date(now);
  recipient9am.setHours(9, 0, 0, 0); // This is local 9am, we need to shift it
  
  // Actually, simpler:
  // 1. Get current time in recipient TZ.
  // 2. Find the offset.
  
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Example: Recipient is New York (UTC-4), User is Berlin (UTC+2).
  // 9am NY is 3pm Berlin.
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: recipientTimezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const recipientHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  
  const hourDiff = now.getHours() - recipientHour;
  
  const startHour = (9 + hourDiff + 24) % 24;
  const endHour = (12 + hourDiff + 24) % 24;
  
  return {
    start: `${startHour}:00`,
    end: `${endHour}:00`,
    diff: hourDiff
  };
}

export function formatTimeForDisplay(hourStr: string) {
  const [h] = hourStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}${ampm}`;
}
