import { scheduleImmediateBookingTelegram } from "@/lib/telegram-immediate-booking";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

import type { ServiceResult } from "./types";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicBookingOwner = {
  displayName: string | null;
};

export type PublicServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
};

export type PublicBookingPageData = {
  owner: PublicBookingOwner;
  services: PublicServiceOption[];
};

export type CreatePublicBookingInput = {
  /** Сирий сегмент з URL; нормалізується всередині. */
  username: string;
  clientName: string;
  /** Обовʼязковий контактний телефон. */
  phone: string;
  telegram_username?: string | null;
  notes?: string | null;
  service_id?: string | null;
  title?: string | null;
  starts_at: string;
  ends_at?: string | null;
};

function normalizeTelegramUsername(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/^@+/, "");
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 64 && SLUG_REGEX.test(slug);
}

async function hasTimeOverlap(params: {
  supabase: SupabaseClient;
  userId: string;
  startsAt: string;
  endsAt: string;
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from("appointments")
    .select("id")
    .eq("user_id", params.userId)
    .lt("starts_at", params.endsAt)
    .gt("ends_at", params.startsAt)
    .limit(1);

  if (error) {
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Профіль власника за публічним slug і список послуг для форми бронювання.
 */
export async function getPublicBookingPageData(
  username: string,
): Promise<ServiceResult<PublicBookingPageData & { ownerUserId: string }>> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message:
          "Публічне бронювання не налаштоване на сервері (відсутній service role).",
      },
    };
  }

  const slug = normalizeSlug(username);
  if (!isValidSlug(slug)) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Сторінку не знайдено.",
      },
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("user_id, display_name, booking_slug")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (profileError || !profile?.user_id || !profile.booking_slug) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Сторінку не знайдено.",
      },
    };
  }

  const ownerUserId = profile.user_id as string;

  const { data: services, error: servicesError } = await admin
    .from("services")
    .select("id, name, duration_minutes")
    .eq("user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (servicesError) {
    return {
      ok: false,
      error: {
        code: "PUBLIC_BOOKING_LOAD_FAILED",
        message: "Не вдалося завантажити дані для запису.",
      },
    };
  }

  return {
    ok: true,
    data: {
      ownerUserId,
      owner: { displayName: profile.display_name as string | null },
      services: (services ?? []) as PublicServiceOption[],
    },
  };
}

/**
 * Публічна відповідь без внутрішніх ідентифікаторів власника.
 */
export function toPublicBookingPayload(
  data: PublicBookingPageData & { ownerUserId: string },
): PublicBookingPageData {
  return {
    owner: data.owner,
    services: data.services,
  };
}

/** Крок сітки слотів (хв). */
const SLOT_STEP_MINUTES = 15;
/** Робочий день відносно півночі обраного дня (локальної для клієнта). */
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 21;

function intervalOverlapMs(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): boolean {
  return a0 < b1 && a1 > b0;
}

/**
 * Повертає ISO-часи початку доступних слотів на обраний календарний день.
 * dayStart — мітка півночі того дня в часовому поясі клієнта (через Date.toISOString() від local midnight).
 */
export async function getPublicAvailabilitySlots(params: {
  username: string;
  dayStart: Date;
  serviceId: string | null;
}): Promise<ServiceResult<{ slotStartsIso: string[] }>> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message:
          "Публічне бронювання не налаштоване на сервері (відсутній service role).",
      },
    };
  }

  const page = await getPublicBookingPageData(params.username);
  if (!page.ok) {
    return page;
  }

  const { ownerUserId, services } = page.data;
  const hasCatalog = services.length > 0;

  let durationMinutes = 60;
  let selected: PublicServiceOption | null = null;
  if (params.serviceId) {
    selected = services.find((s) => s.id === params.serviceId) ?? null;
    if (!selected) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Некоректна послуга.",
        },
      };
    }
    durationMinutes = selected.duration_minutes;
  } else if (hasCatalog) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Оберіть послугу для розрахунку слотів.",
      },
    };
  }

  const dayStart = params.dayStart;
  const startMs = dayStart.getTime();
  if (!Number.isFinite(startMs)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Некоректна дата.",
      },
    };
  }

  const dayEnd = new Date(startMs + 24 * 60 * 60 * 1000);

  const { data: rows, error: aptError } = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("user_id", ownerUserId)
    .lt("starts_at", dayEnd.toISOString())
    .gt("ends_at", dayStart.toISOString());

  if (aptError) {
    return {
      ok: false,
      error: {
        code: "PUBLIC_BOOKING_LOAD_FAILED",
        message: "Не вдалося завантажити зайнятість.",
      },
    };
  }

  const busy = (rows ?? []).map((r) => ({
    s: new Date(r.starts_at as string).getTime(),
    e: new Date(r.ends_at as string).getTime(),
  }));

  const workOpen = new Date(
    startMs + WORK_DAY_START_HOUR * 60 * 60 * 1000,
  ).getTime();
  const workClose = new Date(
    startMs + WORK_DAY_END_HOUR * 60 * 60 * 1000,
  ).getTime();

  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000;

  const slotStartsIso: string[] = [];
  for (let t = workOpen; t + durationMs <= workClose; t += stepMs) {
    const slotEnd = t + durationMs;
    let collides = false;
    for (const b of busy) {
      if (intervalOverlapMs(t, slotEnd, b.s, b.e)) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      slotStartsIso.push(new Date(t).toISOString());
    }
  }

  return { ok: true, data: { slotStartsIso } };
}

function resolveEndsAt(params: {
  startsAt: Date;
  endsAtInput: string | null | undefined;
  service: PublicServiceOption | null;
  hasServiceCatalog: boolean;
}): { ok: true; endsAtIso: string } | { ok: false; message: string } {
  const startMs = params.startsAt.getTime();
  if (!Number.isFinite(startMs)) {
    return { ok: false, message: "Некоректний час початку." };
  }

  if (params.service) {
    const end = new Date(
      startMs + params.service.duration_minutes * 60 * 1000,
    );
    return { ok: true, endsAtIso: end.toISOString() };
  }

  if (params.hasServiceCatalog) {
    return {
      ok: false,
      message: "Оберіть послугу.",
    };
  }

  if (params.endsAtInput) {
    const end = new Date(params.endsAtInput);
    const endMs = end.getTime();
    if (!Number.isFinite(endMs) || endMs <= startMs) {
      return {
        ok: false,
        message: "Час закінчення має бути пізніше за час початку.",
      };
    }
    return { ok: true, endsAtIso: end.toISOString() };
  }

  const end = new Date(startMs + 60 * 60 * 1000);
  return { ok: true, endsAtIso: end.toISOString() };
}

/**
 * Створює клієнта та запис від імені власника сторінки (після перевірок).
 */
export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<ServiceResult<{ appointmentId: string }>> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message:
          "Публічне бронювання не налаштоване на сервері (відсутній service role).",
      },
    };
  }

  const page = await getPublicBookingPageData(input.username);
  if (!page.ok) {
    return page;
  }

  const { ownerUserId, services } = page.data;
  const hasServiceCatalog = services.length > 0;

  const name = input.clientName.trim();
  if (!name || name.length > 200) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Вкажіть ім'я (до 200 символів).",
      },
    };
  }

  const phone = input.phone.trim();
  if (!phone) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Вкажіть телефон.",
      },
    };
  }
  if (phone.length > 64) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Некоректна довжина телефону.",
      },
    };
  }

  const telegramUsername = normalizeTelegramUsername(input.telegram_username);
  if (telegramUsername && telegramUsername.length > 64) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Нік у Telegram занадто довгий.",
      },
    };
  }

  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : input.notes.trim() || null;
  if (notes && notes.length > 2000) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Коментар занадто довгий.",
      },
    };
  }

  const startsAt = new Date(input.starts_at);
  const startMs = startsAt.getTime();
  if (!Number.isFinite(startMs)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Некоректний час початку.",
      },
    };
  }

  const startsIso = startsAt.toISOString();

  let selectedService: PublicServiceOption | null = null;
  if (input.service_id) {
    selectedService =
      services.find((s) => s.id === input.service_id) ?? null;
    if (!selectedService) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Обрана послуга недоступна.",
        },
      };
    }
  }

  const endsResolved = resolveEndsAt({
    startsAt,
    endsAtInput: input.ends_at,
    service: selectedService,
    hasServiceCatalog,
  });
  if (!endsResolved.ok) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: endsResolved.message },
    };
  }

  const endsIso = endsResolved.endsAtIso;

  const overlap = await hasTimeOverlap({
    supabase: admin,
    userId: ownerUserId,
    startsAt: startsIso,
    endsAt: endsIso,
  });
  if (overlap) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_TIME_OVERLAP",
        message: "Цей час уже зайнятий. Оберіть інший слот.",
      },
    };
  }

  const title =
    input.title?.trim() || `Запис: ${name}`.slice(0, 200);

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .insert({
      user_id: ownerUserId,
      name,
      email: null,
      phone,
      notes,
      telegram_username: telegramUsername,
    })
    .select("id")
    .single();

  if (clientError || !clientRow) {
    return {
      ok: false,
      error: {
        code: "PUBLIC_BOOKING_CREATE_FAILED",
        message: "Не вдалося створити запис. Спробуйте пізніше.",
      },
    };
  }

  const clientId = clientRow.id as string;

  const { data: appointmentRow, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      user_id: ownerUserId,
      client_id: clientId,
      service_id: selectedService?.id ?? null,
      title,
      starts_at: startsIso,
      ends_at: endsIso,
      status: "scheduled",
      notes: null,
    })
    .select("id")
    .single();

  if (appointmentError || !appointmentRow) {
    await admin.from("clients").delete().eq("id", clientId);
    return {
      ok: false,
      error: {
        code: "PUBLIC_BOOKING_CREATE_FAILED",
        message: "Не вдалося створити запис. Спробуйте пізніше.",
      },
    };
  }

  const appointmentId = appointmentRow.id as string;
  scheduleImmediateBookingTelegram(admin, appointmentId);

  return {
    ok: true,
    data: { appointmentId },
  };
}
