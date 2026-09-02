"use client";

import { useEffect, useLayoutEffect, useState } from "react";

type AmbientPeriod = "morning" | "day" | "evening" | "night";

function ambientPeriodForHour(hour: number): AmbientPeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function initialPeriod(): AmbientPeriod {
  return typeof window === "undefined" ? "day" : ambientPeriodForHour(new Date().getHours());
}

export function AmbientBackground() {
  const [period, setPeriod] = useState<AmbientPeriod>(initialPeriod);

  useLayoutEffect(() => {
    document.documentElement.dataset.ambient = period;
  }, [period]);

  useEffect(() => {
    let timer = 0;

    function updatePeriod() {
      window.clearTimeout(timer);
      const localNow = new Date();
      setPeriod(ambientPeriodForHour(localNow.getHours()));

      const nextBoundary = new Date(localNow);
      const nextHour = [6, 11, 17, 22].find((hour) => hour > localNow.getHours());
      if (nextHour === undefined) nextBoundary.setDate(nextBoundary.getDate() + 1);
      nextBoundary.setHours(nextHour ?? 6, 0, 1, 0);
      timer = window.setTimeout(updatePeriod, nextBoundary.getTime() - localNow.getTime());
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") updatePeriod();
    }

    updatePeriod();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return null;
}