"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function StatusTooltips() {
  const [tooltip, setTooltip] = useState<{ text: string; left: number; top: number } | null>(null);
  const activeElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const restoreTitle = (element: HTMLElement | null) => {
      if (!element) return;
      if (element.dataset.tooltip) element.setAttribute("title", element.dataset.tooltip);
      delete element.dataset.tooltip;
    };
    const hide = () => {
      restoreTitle(activeElement.current);
      activeElement.current = null;
      setTooltip(null);
    };
    const targetFromEvent = (event: Event) => {
      const target = event.target;
      return target instanceof Element ? target.closest<HTMLElement>("td span[title], td span[data-tooltip]") : null;
    };
    const show = (event: Event) => {
      const element = targetFromEvent(event);
      if (!element) return;
      if (activeElement.current && activeElement.current !== element) restoreTitle(activeElement.current);
      const text = element.getAttribute("title") ?? element.dataset.tooltip;
      if (!text) return;
      element.dataset.tooltip = text;
      element.removeAttribute("title");
      activeElement.current = element;
      const rectangle = element.getBoundingClientRect();
      setTooltip({ text, left: rectangle.left + rectangle.width / 2, top: rectangle.top - 8 });
    };
    const leave = (event: PointerEvent | FocusEvent) => {
      const element = targetFromEvent(event);
      if (!element || element !== activeElement.current) return;
      const next = event.relatedTarget;
      if (next instanceof Node && element.contains(next)) return;
      hide();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    const onVisibilityChange = () => { if (document.visibilityState !== "visible") hide(); };

    document.addEventListener("pointerover", show);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", show);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      restoreTitle(activeElement.current);
    };
  }, []);

  return tooltip ? createPortal(<div role="tooltip" style={{ left: tooltip.left, top: tooltip.top }} className="pointer-events-none fixed z-[100] w-max max-w-72 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs leading-5 text-zinc-200 shadow-2xl">{tooltip.text}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" /></div>, document.body) : null;
}
