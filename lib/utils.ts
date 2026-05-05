import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True when the document runs inside an iframe (always false during SSR). */
export function isIframe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent can throw when comparing to `window.top`
    return true;
  }
}
