import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPublicBookingPageData,
  toPublicBookingPayload,
} from "@/services/public-booking.service";

import { PublicBookingForm } from "./public-booking-form";

/** Full-viewport gradient so overflow from the date picker does not reveal the default white body. */
function PublicBookingBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[#080312] bg-gradient-to-b from-[#120726] via-[#0f061f] to-[#080312]"
      aria-hidden
    />
  );
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const result = await getPublicBookingPageData(username);
  if (!result.ok) {
    return { title: "Запис | Plurio" };
  }
  const label =
    result.data.owner.displayName?.trim() || username;
  return {
    title: `Запис — ${label} | Plurio`,
    description: "Онлайн-запис на прийом",
  };
}

export default async function PublicBookingPage({ params }: PageProps) {
  const { username } = await params;
  const result = await getPublicBookingPageData(username);

  if (!result.ok) {
    if (result.error.code === "CONFIG_MISSING") {
      const devHint =
        process.env.NODE_ENV === "development" ? (
          <span className="mt-2 block text-xs text-violet-400">
            Dev: додай{" "}
            <code className="rounded bg-violet-950 px-1 text-violet-200">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            у .env (серверний ключ з Supabase, не публікуй у клієнті).
          </span>
        ) : null;
      return (
        <>
          <PublicBookingBackdrop />
          <div className="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-16 text-center">
            <p className="max-w-md text-violet-200">
              Публічне бронювання тимчасово недоступне. Спробуйте пізніше або
              зв&apos;яжіться з майстром іншим способом.
            </p>
            {devHint}
          </div>
        </>
      );
    }
    notFound();
  }

  const payload = toPublicBookingPayload(result.data);

  return (
    <>
      <PublicBookingBackdrop />
      <div className="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-violet-500/35 bg-violet-950/55 p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12)] backdrop-blur-sm">
          <h1 className="mb-6 text-center text-2xl font-semibold text-violet-50">
            Запис на прийом
          </h1>
          <PublicBookingForm username={username} initial={payload} />
        </div>
      </div>
    </>
  );
}
