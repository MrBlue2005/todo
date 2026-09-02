"use client";

import { ChevronLeft, X } from "lucide-react";
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
  if (!open) return null;
  return (
    <div
      className={`${styles.backdrop} ${nested ? styles.nestedBackdrop : ""}`}
      data-app-overlay
      style={nested ? { position: "absolute", inset: 0, width: "auto", transform: "none" } : { position: "fixed", inset: "0 auto 0 50%", width: "min(100%, var(--phone-width))", transform: "translateX(-50%)" }}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
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
