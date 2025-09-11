"use client";

import { useEffect, useState } from "react";

// Hook to retrieve the feedback link at runtime from the API route.
// This prevents needing a rebuild when the link changes in Azure App Settings.
export function useFeedbackLink() {
  const [feedbackLink, setFeedbackLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/config/feedback-link", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFeedbackLink(data.feedbackLink || null);
      } catch {
        // swallow - non critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return feedbackLink;
}
