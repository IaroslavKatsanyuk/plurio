/**
 * Спільні публічні змінні Supabase (безпечно для браузера; anon-ключ за дизайном публічний).
 * Викидає помилку під час виконання, якщо змінні відсутні.
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Відсутні NEXT_PUBLIC_SUPABASE_URL або NEXT_PUBLIC_SUPABASE_ANON_KEY. Додай їх у .env або .env.local (значення з дашборду Supabase: Project Settings → API).",
    );
  }
  return { url, anonKey };
}
