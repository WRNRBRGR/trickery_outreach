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
