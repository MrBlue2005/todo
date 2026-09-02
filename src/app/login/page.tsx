"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import styles from "./login.module.css";

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Invalid email or password.";
  if (normalized.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (normalized.includes("already registered") || normalized.includes("already been registered")) return "An account already exists for this email.";
  if (normalized.includes("password")) return "Please check your password and try again.";
  if (normalized.includes("rate") || normalized.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  return "Unable to continue. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!isSupabaseConfigured) { router.replace("/today"); return; }
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const supabase = createClient();
      if (!supabase) throw new Error("Unavailable");
      const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
      if (result.error) { setError(friendlyAuthError(result.error.message)); return; }
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/today";
      window.location.replace(destination);
    } catch {
      setError("Unable to continue. Please try again.");
    } finally { setBusy(false); }
  }

  function switchMode() {
    setMode((current) => current === "login" ? "signup" : "login");
    setError(""); setShowPassword(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <main className={styles.card}>
        <header className={styles.brand}><span>RX</span><div><strong>RX Tasks</strong><small>Private operations workspace</small></div></header>
        <section className={styles.intro}><h1>{mode === "login" ? "Sign in to continue" : "Create your account"}</h1><p>{mode === "login" ? "Enter your RX Tasks account." : "Set up access to your RX Tasks workspace."}</p></section>
        <form className={styles.form} onSubmit={submit} aria-busy={busy}>
          <label htmlFor="email">Email</label>
          <div className={styles.field}><Mail size={18} /><input id="email" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" placeholder="name@example.com" required /></div>
          <label htmlFor="password">Password</label>
          <div className={styles.field}><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Your password" minLength={6} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.submit} type="submit" disabled={busy}>{busy ? mode === "login" ? "Signing in…" : "Creating account…" : mode === "login" ? "Sign in" : "Create account"}{!busy && <ArrowRight size={18} />}</button>
        </form>
        {isSupabaseConfigured && <button className={styles.modeSwitch} type="button" onClick={switchMode}>{mode === "login" ? "Create an account" : "Back to sign in"}</button>}
        {!isSupabaseConfigured && <div className={styles.demo}><span>Demo mode</span><p>Explore RX Tasks with local sample data.</p><button type="button" onClick={() => router.replace("/today")}>Continue with demo data</button></div>}
        <p className={styles.security}><LockKeyhole size={12} /> {isSupabaseConfigured ? "Secure session powered by Supabase" : "Demo data stays on this device"}</p>
      </main>
    </div>
  );
}
