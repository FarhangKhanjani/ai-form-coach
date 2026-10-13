import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
});

/** Where auth emails and Google sign-in send the user back to (this app's root). */
export const appUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href;
