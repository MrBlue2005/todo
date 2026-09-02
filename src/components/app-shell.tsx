"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, House, Plus, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppOverlayContext } from "@/components/app-overlay-context";
import { AppProvider, useApp } from "@/components/providers/app-provider";
import { QuickCreateSheet } from "@/components/quick-create-sheet";

const tabs = [
  { href: "/today", label: "Today", icon: House },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "#create", label: "Add", icon: Plus, create: true },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string>();
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);
  const { notice, clearNotice } = useApp();
  const contentRef = useRef<HTMLElement>(null);
  const scrollPositions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const positions = scrollPositions.current;
    content.scrollTop = positions.get(pathname) ?? 0;
    return () => { positions.set(pathname, content.scrollTop); };
  }, [pathname]);

  useEffect(() => {
    function handleCalendarDate(event: Event) {
      setCalendarDate((event as CustomEvent<string>).detail);
    }
    window.addEventListener("rx-calendar-date-change", handleCalendarDate);
    return () => window.removeEventListener("rx-calendar-date-change", handleCalendarDate);
  }, []);

  if (pathname.startsWith("/login")) return <>{children}</>;
  return (
    <AppOverlayContext.Provider value={overlayRoot}>
      <div className="app-frame">
        <div className="phone-surface">
          <main className="app-content" ref={contentRef}>
            <div className="route-view" key={pathname}>{children}</div>
          </main>
          <nav className="bottom-nav" aria-label="Primary navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              if (tab.create) return (
                <button key={tab.label} className="nav-create" aria-label="Create task" onClick={() => setCreating(true)}>
                  <span><Icon size={22} strokeWidth={2.15} /></span><small>New</small>
                </button>
              );
              const active = pathname === tab.href || (tab.href === "/properties" && pathname.startsWith("/properties/"));
              return (
                <Link key={tab.href} href={tab.href} prefetch className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon size={20} strokeWidth={active ? 2.25 : 1.75} /><small>{tab.label}</small>
                </Link>
              );
            })}
          </nav>
          <div ref={setOverlayRoot} className="app-overlay-root" />
          {creating && <QuickCreateSheet open onClose={() => setCreating(false)} defaultDate={pathname === "/calendar" ? calendarDate : undefined} />}
          {notice && <button className="toast" onClick={clearNotice} aria-label="Dismiss message">{notice}</button>}
        </div>
      </div>
    </AppOverlayContext.Provider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppProvider><Shell>{children}</Shell></AppProvider>;
}
