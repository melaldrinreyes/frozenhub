import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configuredRedirectUrl = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signInWithGoogle() {
  const auth = supabase.auth as any;
  const redirectTo =
    configuredRedirectUrl && configuredRedirectUrl.length > 0
      ? configuredRedirectUrl
      : `${window.location.origin}/auth/callback`;

  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getSession() {
  const auth = supabase.auth as any;
  const {
    data: { session },
    error,
  } = await auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return session;
}

export async function signOut() {
  const auth = supabase.auth as any;
  const { error } = await auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}
