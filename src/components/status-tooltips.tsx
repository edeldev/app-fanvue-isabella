"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function StatusTooltips() {
  const [tooltip, setTooltip] = useState<{ text: string; left: number; top: number } | null>(null);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("td span[title]"));
    const cleanups = elements.map((element) => {
      const show = () => {
        const text = element.getAttribute("title");
        if (!text) return;
        element.dataset.tooltip = text;
        element.removeAttribute("title");
        const rectangle = element.getBoundingClientRect();
        setTooltip({ text, left: rectangle.left + rectangle.width / 2, top: rectangle.top - 8 });
      };
      const hide = () => {
        if (element.dataset.tooltip) element.setAttribute("title", element.dataset.tooltip);
        delete element.dataset.tooltip;
        setTooltip(null);
      };
      element.addEventListener("mouseenter", show);
      element.addEventListener("mouseleave", hide);
      element.addEventListener("focus", show);
      element.addEventListener("blur", hide);
      return () => {
        element.removeEventListener("mouseenter", show);
        element.removeEventListener("mouseleave", hide);
        element.removeEventListener("focus", show);
        element.removeEventListener("blur", hide);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  });

  return tooltip ? createPortal(<div role="tooltip" style={{ left: tooltip.left, top: tooltip.top }} className="pointer-events-none fixed z-[100] w-max max-w-72 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs leading-5 text-zinc-200 shadow-2xl">{tooltip.text}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" /></div>, document.body) : null;
}
