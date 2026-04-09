/** Узгоджені типи відповідей сервісів (без витоку сирих помилок Supabase в UI). */

export type ServiceError = {
  code: string;
  message: string;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  telegram_username: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateClientInput = {
  name: string;
  telegram_username?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type UpdateClientInput = {
  name?: string;
  telegram_username?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type AppointmentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  service_id: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed";

export type CreateAppointmentInput = {
  client_id?: string | null;
  service_id?: string | null;
  title?: string | null;
  starts_at: string;
  ends_at: string;
  status?: AppointmentStatus;
  notes?: string | null;
};

export type ServiceRow = {
  id: string;
  user_id: string;
  name: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
};

export type CreateServiceInput = {
  name: string;
  duration_minutes: number;
};

export type UpdateServiceInput = {
  name?: string;
  duration_minutes?: number;
};
