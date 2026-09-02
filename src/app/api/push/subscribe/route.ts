import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const subscription = await request.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id: auth.user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_agent: request.headers.get("user-agent") }, { onConflict: "user_id,endpoint" });
  if (error) return NextResponse.json({ error: "Subscription could not be saved" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
