import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function replaceVariables(text: string, variables: Record<string, string>) {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, "gi");
    result = result.replace(regex, value);
  });
  return result;
}
export function getGmailLink(email: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: subject,
    body: body
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function getLinkedInUrl(url: string | null, name: string, agency: string | null) {
  if (!url) return null;
  // If it's a Sales Navigator link, it will fail for other users.
  // We convert it to a robust LinkedIn search to find the profile.
  if (url.includes("/sales/")) {
    const query = encodeURIComponent(`${name} ${agency || ""}`.trim());
    return `https://www.linkedin.com/search/results/people/?keywords=${query}`;
  }
  return url;
}
