"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MessageHistory({ children, conversationKey }: { children: ReactNode; conversationKey: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversationKey]);

  return <div ref={container} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">{children}</div>;
}
