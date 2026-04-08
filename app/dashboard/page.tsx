import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/services/auth.service";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Дашборд
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Вийти
          </Button>
        </form>
      </header>
      <p className="text-zinc-600 dark:text-zinc-400">
        Тут згодом з’являться клієнти та записи. Поки що сесія працює, маршрут{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">/dashboard</code>{" "}
        захищений middleware.
      </p>
      <p>
        <Link href="/" className="text-sm text-zinc-500 underline">
          На головну
        </Link>
      </p>
    </div>
  );
}
