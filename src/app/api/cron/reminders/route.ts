import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY; const subject = process.env.VAPID_SUBJECT;
  if (!url || !serviceKey || !publicKey || !privateKey || !subject) return NextResponse.json({ error: "Server notification configuration is incomplete" }, { status: 503 });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: reminders, error } = await supabase
    .from("task_reminders")
    .select("id,user_id,task_id,tasks!inner(title,property_id,status)")
    .is("sent_at", null)
    .lte("remind_at", new Date().toISOString())
    .eq("tasks.status", "todo")
    .order("remind_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load reminders" }, { status: 500 });
  let sent = 0; let marked = 0; let expired = 0; let failed = 0;
  for (const reminder of reminders ?? []) {
    const { data: subscriptions, error: subscriptionError } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", reminder.user_id);
    if (subscriptionError) { failed += 1; continue; }
    const task = reminder.tasks as unknown as { title?: string } | null;
    let delivered = false;
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: "RX Reminder", body: task?.title ?? "A task needs your attention.", tag: `task-${reminder.task_id}`, url: "/today" }));
        sent += 1; delivered = true;
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          const { error: cleanupError } = await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          if (cleanupError) failed += 1; else expired += 1;
        } else failed += 1;
      }
    }
    if (delivered) {
      const { error: markError } = await supabase.from("task_reminders").update({ sent_at: new Date().toISOString() }).eq("id", reminder.id).is("sent_at", null);
      if (markError) failed += 1; else marked += 1;
    }
  }
  return NextResponse.json({ processed: reminders?.length ?? 0, sent, marked, expired, failed });
}
