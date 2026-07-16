"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    fetch("/api/perf", {
      method: "POST",
      body: JSON.stringify({
        id: metric.id,
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
    }).catch((err) => console.error("[WebVitals] Failed to send metric:", err));
  });

  return null;
}
