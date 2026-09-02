"use client";

import { ChevronLeft, X } from "lucide-react";
import { useContext, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AppOverlayContext } from "@/components/app-overlay-context";
import styles from "./task-interactions.module.css";

const KEYBOARD_TOLERANCE = 64;
const VIEWPORT_SETTLE_DELAY = 120;
const VIEWPORT_RESTORE_DELAY = 400;

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
  const portalHost = useContext(AppOverlayContext);

  useLayoutEffect(() => {
    if (!open || nested || !portalHost) return;
    const backdrop = backdropRef.current;
    const sheet = sheetRef.current;
    if (!sheet || !backdrop) return;
    const viewport = window.visualViewport;
    let frame = 0;
    let settleTimer = 0;
    let restoreTimer = 0;
    let stableWidth = portalHost.getBoundingClientRect().width;
    let stableHeight = Math.max(
      portalHost.getBoundingClientRect().height,
      window.innerHeight,
      document.documentElement.clientHeight,
      viewport ? viewport.height + viewport.offsetTop : 0,
    );

    const clearKeyboardGeometry = () => {
      backdrop.removeAttribute("data-keyboard-open");
      sheet.removeAttribute("data-keyboard-open");
      backdrop.style.removeProperty("--sheet-keyboard-inset");
      sheet.style.removeProperty("--sheet-visual-height");
    };

    const keepFocusedControlVisible = () => {
      const active = document.activeElement;
      if (sheet.dataset.keyboardOpen !== "true" || !(active instanceof HTMLElement) || !sheet.contains(active)) return;
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const measure = () => {
      frame = 0;
      const hostBounds = portalHost.getBoundingClientRect();
      if (Math.abs(hostBounds.width - stableWidth) > 2) {
        stableWidth = hostBounds.width;
        stableHeight = Math.max(hostBounds.height, window.innerHeight, document.documentElement.clientHeight);
      }

      const visualHeight = viewport?.height ?? window.innerHeight;
      const visualTop = viewport?.offsetTop ?? 0;
      const visualBottomInHost = visualTop + visualHeight - hostBounds.top;
      stableHeight = Math.max(stableHeight, hostBounds.height, window.innerHeight, document.documentElement.clientHeight, visualBottomInHost);
      const viewportReduction = Math.max(0, stableHeight - visualBottomInHost);
      const keyboardInset = Math.max(0, hostBounds.height - visualBottomInHost);
      const keyboardOpen = Boolean(viewport && viewportReduction > KEYBOARD_TOLERANCE);

      window.clearTimeout(settleTimer);
      if (!keyboardOpen) {
        clearKeyboardGeometry();
        return;
      }

      backdrop.dataset.keyboardOpen = "true";
      sheet.dataset.keyboardOpen = "true";
      backdrop.style.setProperty("--sheet-keyboard-inset", `${keyboardInset}px`);
      sheet.style.setProperty("--sheet-visual-height", `${visualHeight}px`);
      settleTimer = window.setTimeout(keepFocusedControlVisible, VIEWPORT_SETTLE_DELAY);
    };

    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const scheduleRestoreCheck = () => {
      scheduleMeasure();
      window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(scheduleMeasure, VIEWPORT_RESTORE_DELAY);
    };

    measure();
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleRestoreCheck);
    window.addEventListener("focusin", scheduleMeasure);
    window.addEventListener("focusout", scheduleRestoreCheck);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(restoreTimer);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleRestoreCheck);
      window.removeEventListener("focusin", scheduleMeasure);
      window.removeEventListener("focusout", scheduleRestoreCheck);
    };
  }, [open, nested, portalHost]);

  if (!open) return null;
  const content = (
    <div
      ref={backdropRef}
      className={`${styles.backdrop} ${nested ? styles.nestedBackdrop : ""}`}
      data-app-overlay
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
        <div className={styles.sheetShell}>
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
          <div className={styles.sheetBody}>{children}</div>
        </div>
      </section>
    </div>
  );
  if (nested) return content;
  return portalHost ? createPortal(content, portalHost) : null;
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
