export const APP_TIME_ZONE = "America/Monterrey";

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: APP_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeZone: APP_TIME_ZONE,
});

export function formatAppDateTime(value: string | Date) {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatAppDate(value: string | Date) {
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}
