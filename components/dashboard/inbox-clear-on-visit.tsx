"use client";

import { useEffect } from "react";

/**
 * Позначає події «дзвіночка» прочитаними, коли власник відкриває сторінку записів.
 */
export function InboxClearOnVisit() {
  useEffect(() => {
    void fetch("/api/inbox", { method: "POST" }).then(() => {
      window.dispatchEvent(new CustomEvent("plurio:inbox-updated"));
    });
  }, []);
  return null;
}
