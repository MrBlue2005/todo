"use client";

/* eslint-disable @next/next/no-img-element -- Private signed Storage URLs are already resized client-side. */

import { Bell, BellOff, Camera, Check, ChevronRight, CircleAlert, Download, HardDrive, LogOut, Pencil, Smartphone, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { MobileSheet } from "@/components/task-interactions/mobile-sheet";
import { createClient } from "@/lib/supabase/client";
import styles from "./profile.module.css";

type AmbientPeriod = "morning" | "day" | "evening" | "night";

function ambientPeriodForHour(hour: number): AmbientPeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function useLocalAmbientPeriod() {
  const [period, setPeriod] = useState<AmbientPeriod>("day");

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

  return period;
}
type NotificationState = "checking" | "unsupported" | "needs-install" | "default" | "denied" | "granted";
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "RX";
}

export default function ProfilePage() {
  const { isDemo, ready, profile, updateDisplayName, uploadProfilePhoto, removeProfilePhoto } = useApp();
  const ambientPeriod = useLocalAmbientPeriod();
  const [notificationState, setNotificationState] = useState<NotificationState>("checking");
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();
  const [installOpen, setInstallOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [workingPhoto, setWorkingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    async function detectNotifications() {
      if (ios && !installed) { setNotificationState("needs-install"); return; }
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) { setNotificationState("unsupported"); return; }
      if (Notification.permission === "denied") { setNotificationState("denied"); return; }
      if (Notification.permission !== "granted") { setNotificationState("default"); return; }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setNotificationState(subscription ? "granted" : "default");
      } catch { setNotificationState("unsupported"); }
    }
    const detectionTimer = window.setTimeout(() => {
      setIsIOS(ios);
      setStandalone(installed);
      void detectNotifications();
    }, 0);

    function captureInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => { window.clearTimeout(detectionTimer); window.removeEventListener("beforeinstallprompt", captureInstall); };
  }, []);

  const account = profile ? { name: profile.displayName, email: profile.email } : isDemo ? { name: "Demo workspace", email: "Using local sample data" } : { name: "RX account", email: "Loading account…" };
  const notificationCopy = useMemo(() => {
    if (!ready || notificationState === "checking") return { title: "Checking status", detail: "Confirming this device’s capabilities." };
    if (isDemo) return { title: "Unavailable in demo", detail: "Connect your RX account to receive reminders." };
    if (notificationState === "granted") return { title: "Push notifications", detail: "Enabled on this device." };
    if (notificationState === "denied") return { title: "Permission denied", detail: "Allow notifications in your device settings." };
    if (notificationState === "needs-install") return { title: "Install required", detail: "Add RX Tasks to your Home Screen first." };
    if (notificationState === "unsupported") return { title: "Not supported", detail: "Push notifications aren’t available here." };
    return { title: "Push notifications", detail: "Not enabled on this device." };
  }, [isDemo, notificationState, ready]);

  async function enableNotifications() {
    if (working || isDemo) return;
    if (notificationState === "needs-install") { setInstallOpen(true); return; }
    setWorking(true); setMessage("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) { setNotificationState("unsupported"); return; }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { setNotificationState(permission === "denied" ? "denied" : "default"); return; }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("configuration");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error("subscription");
      setNotificationState("granted");
      setMessage("Notifications are enabled on this device.");
    } catch {
      setMessage("Notifications couldn’t be enabled. Please try again later.");
    } finally { setWorking(false); }
  }

  async function installApp() {
    if (standalone) return;
    if (isIOS || !installPrompt) { setInstallOpen(true); return; }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") { setStandalone(true); setInstallPrompt(undefined); }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut({ scope: "local" });
    window.location.replace(new URL("/login", window.location.origin).toString());
  }

  function openNameEditor() {
    setNameDraft(account.name);
    setNameError("");
    setEditNameOpen(true);
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) { setNameError("Enter a display name."); return; }
    setSavingName(true); setNameError("");
    try {
      await updateDisplayName(name);
      setEditNameOpen(false);
    } catch {
      setNameError("Your display name could not be saved. Please try again.");
    } finally { setSavingName(false); }
  }

  async function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || workingPhoto) return;
    setWorkingPhoto(true); setPhotoError("");
    try {
      await uploadProfilePhoto(file);
      setPhotoOpen(false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "avatar-type" || reason === "avatar-decode") setPhotoError("Choose a JPEG, PNG, WebP, HEIC or HEIF image supported by this device.");
      else if (reason === "avatar-size") setPhotoError("Choose an image smaller than 10 MB.");
      else setPhotoError("Your profile photo could not be saved. Please try again.");
    } finally { setWorkingPhoto(false); }
  }

  async function removePhoto() {
    if (workingPhoto) return;
    setWorkingPhoto(true); setPhotoError("");
    try {
      await removeProfilePhoto();
      setPhotoOpen(false);
    } catch {
      setPhotoError("Your profile photo could not be removed. Please try again.");
    } finally { setWorkingPhoto(false); }
  }

  const canEnable = !isDemo && (notificationState === "default" || notificationState === "needs-install");
  const NotificationIcon = notificationState === "granted" ? Bell : notificationState === "denied" || notificationState === "unsupported" ? BellOff : Bell;

  return (
    <div className={styles.screen} data-ambient={ambientPeriod}>
      <header className={styles.header}><span>Account & app</span><h1>Profile</h1></header>

      <section className={styles.identity} aria-label="Account identity">
        <button type="button" className={styles.avatarButton} onClick={() => { setPhotoError(""); setPhotoOpen(true); }} disabled={isDemo || !profile} aria-label={profile?.avatarUrl ? "Change profile photo" : "Add profile photo"}>
          {profile?.avatarUrl ? <img className={styles.avatarImage} src={profile.avatarUrl} alt="" /> : <span className={styles.initials}>{initials(account.name)}</span>}
        </button>
        <div><strong>{account.name}</strong><span>{account.email}</span></div>
        {!isDemo && profile && <button type="button" className={styles.editNameButton} onClick={openNameEditor}><Pencil size={14} /> Edit</button>}
      </section>

      <section className={styles.group}>
        <h2>Notifications</h2>
        <div className={styles.groupSurface}>
          <div className={styles.settingRow}>
            <span className={`${styles.settingIcon} ${notificationState === "granted" ? styles.positive : notificationState === "denied" ? styles.warning : ""}`}><NotificationIcon size={18} /></span>
            <span className={styles.settingCopy}><strong>{notificationCopy.title}</strong><small>{notificationCopy.detail}</small></span>
            {notificationState === "granted" ? <Check className={styles.statusCheck} size={18} /> : canEnable ? <button type="button" className={styles.rowAction} onClick={() => void enableNotifications()} disabled={working}>{working ? "Enabling…" : notificationState === "needs-install" ? "Install" : "Enable"}</button> : null}
          </div>
        </div>
        {message && <p className={message.startsWith("Notifications are") ? styles.successMessage : styles.errorMessage}>{message}</p>}
      </section>

      <section className={styles.group}>
        <h2>App</h2>
        <div className={styles.groupSurface}>
          <button type="button" className={styles.settingRow} onClick={() => void installApp()} disabled={standalone}>
            <span className={`${styles.settingIcon} ${standalone ? styles.positive : ""}`}>{standalone ? <Smartphone size={18} /> : <Download size={18} />}</span>
            <span className={styles.settingCopy}><strong>{standalone ? "RX Tasks" : "Install RX Tasks"}</strong><small>{standalone ? "Installed on this device" : isIOS ? "Add to your iPhone Home Screen" : installPrompt ? "Install as an app" : "Open from your browser or Home Screen"}</small></span>
            {standalone ? <Check className={styles.statusCheck} size={18} /> : <ChevronRight size={17} />}
          </button>
          {isDemo && <div className={styles.settingRow}><span className={styles.settingIcon}><HardDrive size={18} /></span><span className={styles.settingCopy}><strong>Demo mode</strong><small>Using local sample data</small></span></div>}
        </div>
      </section>

      <section className={`${styles.group} ${styles.accountActions}`}>
        <h2>Account actions</h2>
        <div className={styles.groupSurface}>
          <button type="button" className={`${styles.settingRow} ${styles.signOutRow}`} onClick={() => void signOut()} disabled={signingOut}>
            <span className={styles.settingIcon}>{isDemo ? <UserRound size={18} /> : <LogOut size={18} />}</span>
            <span className={styles.settingCopy}><strong>{signingOut ? "Signing out…" : isDemo ? "Exit demo" : "Sign out"}</strong><small>{isDemo ? "Return to the sign-in screen" : "End this session on this device"}</small></span>
          </button>
        </div>
      </section>

      <p className={styles.footer}>RX Tasks</p>

      {installOpen && <MobileSheet open onClose={() => setInstallOpen(false)} title="Install RX Tasks" eyebrow="IPHONE APP">
        <div className={styles.installGuide}><CircleAlert size={21} /><p>In Safari, tap <strong>Share</strong>, choose <strong>Add to Home Screen</strong>, then open RX Tasks from your Home Screen.</p><button type="button" onClick={() => setInstallOpen(false)}>Got it</button></div>
      </MobileSheet>}
      {editNameOpen && <MobileSheet open onClose={() => !savingName && setEditNameOpen(false)} title="Edit name" eyebrow="PROFILE">
        <form className={styles.nameForm} onSubmit={(event) => void saveName(event)}>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} autoComplete="name" maxLength={80} autoFocus />
          {nameError && <p role="alert">{nameError}</p>}
          <button type="submit" disabled={savingName || !nameDraft.trim()}>{savingName ? "Saving…" : "Save name"}</button>
        </form>
      </MobileSheet>}
      {photoOpen && <MobileSheet open onClose={() => !workingPhoto && setPhotoOpen(false)} title="Profile photo" eyebrow="PROFILE">
        <div className={styles.photoActions}>
          <input ref={photoInput} className={styles.photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={(event) => void selectPhoto(event)} />
          <button type="button" className={styles.photoPrimary} onClick={() => photoInput.current?.click()} disabled={workingPhoto}><Camera size={17} />{workingPhoto ? "Working…" : profile?.avatarUrl ? "Change photo" : "Add photo"}</button>
          {profile?.avatarUrl && <button type="button" className={styles.photoRemove} onClick={() => void removePhoto()} disabled={workingPhoto}><Trash2 size={16} /> Remove photo</button>}
          <p>JPEG, PNG, WebP, HEIC or HEIF · maximum 10 MB</p>
          {photoError && <p className={styles.photoError} role="alert">{photoError}</p>}
        </div>
      </MobileSheet>}
    </div>
  );
}
