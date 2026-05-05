import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TelegramSettingsCard } from "@/components/dashboard/telegram-settings-card";
import { WorkScheduleSettingsCard } from "@/components/dashboard/work-schedule-settings-card";
import {
  DEFAULT_BOOKING_TIMEZONE,
  normalizeProfileWeeklySchedule,
  scheduleToWeeklyForm,
} from "@/lib/work-schedule";
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
  const workInitialTz =
    profile?.booking_timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  const workInitialWeekly = scheduleToWeeklyForm(
    normalizeProfileWeeklySchedule(profile?.work_weekly_schedule),
  );
  const workExplicitSchedule = profile?.work_weekly_schedule != null;
  const telegramLinked =
    profile?.telegram_chat_id != null &&
    profile.telegram_chat_id !== "" &&
    profile.telegram_chat_id !== 0;

  return (
    <DashboardShell
      active="settings"
      userEmail={user.email ?? ""}
      title="Налаштування"
      subtitle={user.email ?? undefined}
    >
      <TelegramSettingsCard telegramLinked={telegramLinked} />
      <WorkScheduleSettingsCard
        initialTimezone={workInitialTz}
        initialWeekly={workInitialWeekly}
        hasExplicitSchedule={workExplicitSchedule}
      />
    </DashboardShell>
  );
}
