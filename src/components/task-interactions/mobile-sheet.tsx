"use client";

import { ChevronLeft, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import styles from "./task-interactions.module.css";

export function MobileSheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  nested = false,
  full = false,
  backLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  nested?: boolean;
  full?: boolean;
  backLabel?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const backdrop = nested ? null : backdropRef.current;
    const sheet = sheetRef.current;
    if (!sheet || (!nested && !backdrop)) return;
    const viewport = window.visualViewport;
    const sync = () => {
      const height = viewport ? viewport.height : window.innerHeight;
      const top = viewport ? viewport.offsetTop : 0;
      const left = viewport ? viewport.offsetLeft : 0;
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const keyboardInset = Math.max(0, layoutHeight - (height + top));
      const active = document.activeElement;
      const editableFocused = active instanceof HTMLElement && (
        active.matches("input, textarea, select") || active.isContentEditable
      );
      const reduced = Boolean(viewport && editableFocused && keyboardInset > 80);
      if (backdrop) {
        backdrop.style.left = `calc(50% + ${left}px)`;
        backdrop.style.paddingBottom = reduced ? `${keyboardInset}px` : "0px";
      }
      sheet.dataset.keyboardOpen = reduced ? "true" : "false";
      if (full && !nested) {
        if (reduced) {
          sheet.style.height = `${height}px`;
          sheet.style.maxHeight = `${height}px`;
        } else {
          sheet.style.height = "";
          sheet.style.maxHeight = "";
        }
      } else if (reduced) {
        sheet.style.maxHeight = `calc(${height}px - 8px)`;
      } else {
        sheet.style.maxHeight = `min(calc(${height}px - 8px), 86dvh, 760px)`;
      }
      if (reduced && active instanceof HTMLElement && sheet.contains(active)) {
        const bounds = active.getBoundingClientRect();
        if (bounds.top < top + 8 || bounds.bottom > top + height - 12) {
          window.requestAnimationFrame(() => active.scrollIntoView({ block: "nearest", inline: "nearest" }));
        }
      }
    };
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("focusin", sync);
    window.addEventListener("focusout", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("focusin", sync);
      window.removeEventListener("focusout", sync);
    };
  }, [open, nested, full]);

  if (!open) return null;
  return (
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${nested ? styles.nestedBackdrop : ""}`}
      data-app-overlay
      style={nested ? { position: "absolute", inset: 0, width: "auto", transform: "none" } : { position: "fixed", inset: "0 auto 0 50%", width: "min(100%, var(--phone-width))", transform: "translateX(-50%)" }}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={sheetRef}
        className={`${styles.sheet} ${full ? styles.fullSheet : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.handle} />
        <header className={styles.header}>
          <div>
            {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className={`${styles.closeButton} min-h-11 min-w-11`} type="button" onClick={onClose} aria-label={backLabel ?? "Close"}>
            {backLabel ? <ChevronLeft size={21} /> : <X size={19} />}
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function SettingRow({
  icon,
  label,
  value,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  tone?: "urgent" | "accent";
}) {
  return (
    <button type="button" className={styles.settingRow} onClick={onClick}>
      <span className={`${styles.settingIcon} ${tone ? styles[tone] : ""}`}>{icon}</span>
      <span className={styles.settingCopy}><small>{label}</small><strong>{value}</strong></span>
      <ChevronLeft className={styles.rowChevron} size={17} />
    </button>
  );
}
