"use client";

import { useEffect } from "react";

export function TopbarDropdownCoordinator() {
  useEffect(() => {
    function coordinateDropdowns(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const topbar = target?.closest<HTMLElement>("[data-topbar]") ?? document.querySelector<HTMLElement>("[data-topbar]");
      if (!topbar) return;

      const selected = target?.closest<HTMLDetailsElement>("details");
      topbar.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((dropdown) => {
        if (dropdown !== selected) dropdown.open = false;
      });
    }

    document.addEventListener("click", coordinateDropdowns);
    return () => document.removeEventListener("click", coordinateDropdowns);
  }, []);

  return null;
}
