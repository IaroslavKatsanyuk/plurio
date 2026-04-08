"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const APPOINTMENTS_PATH = "/appointments";

function getSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return APPOINTMENTS_PATH;
  }
  return next;
}

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

/**
 * Вхід email + пароль. Успіх → redirect (кинуто з server action).
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(input.next));
}

/**
 * Реєстрація. Якщо в проєкті увімкнено підтвердження email — сесії може не бути.
 */
export async function signUpWithPassword(input: {
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const supabase = await createClient();
  const origin = getSiteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/appointments")}`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(APPOINTMENTS_PATH);
  }

  return { ok: true, needsEmailConfirmation: true };
}

/**
 * Вихід і редірект на логін.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
