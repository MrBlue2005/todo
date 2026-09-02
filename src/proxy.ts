import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (!supabaseConfig) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items, headers) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value)); } } });
  const { data } = await supabase.auth.getClaims(); const path = request.nextUrl.pathname;
  const user = data?.claims;
  const publicPath = path.startsWith("/login") || path.startsWith("/api/cron") || path.startsWith("/_next") || path === "/manifest.webmanifest" || path === "/sw.js" || path === "/icon.svg";
  const redirectWithSession = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(({ name, value, ...options }) => redirect.cookies.set(name, value, options));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirect.headers.set(name, value);
    }
    return redirect;
  };
  if (!user && !publicPath) { const login = request.nextUrl.clone(); login.pathname = "/login"; login.searchParams.set("next", path); return redirectWithSession(login); }
  if (user && path === "/login") { const today = request.nextUrl.clone(); today.pathname = "/today"; return redirectWithSession(today); }
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
