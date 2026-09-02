const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const legacyAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function isPlaceholder(value: string) {
  return /YOUR_|REPLACE_|PASTE_|<|>/i.test(value);
}

function isUsableUrl(value: string | undefined) {
  if (!value || isPlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isUsablePublicKey(value: string | undefined) {
  return Boolean(value && value.length >= 20 && !/\s/.test(value) && !isPlaceholder(value));
}

const publicKey = isUsablePublicKey(publishableKey)
  ? publishableKey
  : isUsablePublicKey(legacyAnonKey)
    ? legacyAnonKey
    : undefined;

export const supabaseConfig = isUsableUrl(url) && publicKey
  ? { url: url!, key: publicKey }
  : null;

export const isSupabaseConfigured = supabaseConfig !== null;
