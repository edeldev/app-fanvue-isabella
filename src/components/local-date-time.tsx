"use client";

export function LocalDateTime({ value }: { value: string | Date }) {
  const iso = typeof value === "string" ? value : value.toISOString();

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString("es-MX")}
    </time>
  );
}
