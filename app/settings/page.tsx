import { DashboardNavbar } from "@/components/dashboard/navbar";
import { TelegramSettingsCard } from "@/components/dashboard/telegram-settings-card";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/services/profile.service";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profileResult = await getProfile();
  const profile = profileResult.ok ? profileResult.data : null;
  const telegramLinked =
    profile?.telegram_chat_id != null &&
    profile.telegram_chat_id !== "" &&
    profile.telegram_chat_id !== 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120726] via-[#0f061f] to-[#080312]">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
        <DashboardNavbar active="settings" userEmail={user.email ?? ""} />
        <main className="min-w-0 flex-1">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-violet-50">Налаштування</h1>
            <p className="text-sm text-violet-300">{user.email}</p>
          </header>
          <TelegramSettingsCard telegramLinked={telegramLinked} />
        </main>
      </div>
    </div>
  );
}
