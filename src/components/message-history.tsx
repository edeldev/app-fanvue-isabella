"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function MessageHistory({ children, conversationKey, latestMessageId }: { children: ReactNode; conversationKey: string; latestMessageId: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const lastConversation = useRef<string | null>(null);
  const lastMessage = useRef<string | null>(null);
  const wasNearBottom = useRef(true);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const changedConversation = lastConversation.current !== conversationKey;
    const changedMessage = lastMessage.current !== latestMessageId;
    if (changedConversation || (changedMessage && wasNearBottom.current)) element.scrollTop = element.scrollHeight;
    lastConversation.current = conversationKey;
    lastMessage.current = latestMessageId;
  }, [conversationKey, latestMessageId]);

  return <div ref={container} onScroll={(event) => { const element = event.currentTarget; wasNearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>;
}
