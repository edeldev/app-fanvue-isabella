import { Check, CheckCheck } from "lucide-react";
import type { MessageDeliveryState } from "@/domain/messages/delivery-status";

const labels: Record<MessageDeliveryState, string> = {
  SENT: "Enviado",
  DELIVERED: "Entregado",
  READ: "Leído",
};

export function MessageReceipt({ state, compact = false }: { state: MessageDeliveryState | null; compact?: boolean }) {
  if (!state) return null;
  const Icon = state === "SENT" ? Check : CheckCheck;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 ${state === "READ" ? "text-sky-400" : "text-zinc-500"}`}
      title={labels[state]}
      aria-label={labels[state]}
    >
      <Icon className={compact ? "size-3" : "size-3.5"} strokeWidth={2.25} aria-hidden="true" />
      {!compact ? <span className="sr-only">{labels[state]}</span> : null}
    </span>
  );
}
