"use client";

import { formatAppDateTime } from "@/lib/date-time";

export function LocalDateTime({ value }: { value: string | Date }) {
  const iso = typeof value === "string" ? value : value.toISOString();

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatAppDateTime(iso)}
    </time>
  );
}
