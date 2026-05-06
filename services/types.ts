/** Узгоджені типи відповідей сервісів (без витоку сирих помилок Supabase в UI). */

export type ServiceError = {
  code: string;
  message: string;
};

export type ProfileRow = {
  user_id: string;
  display_name: string | null;
  booking_slug: string | null;
  /** IANA, наприклад Europe/Kyiv — для календаря слотів і перевірки записів */
  booking_timezone: string;
  /** null = легасі-графік 08:00–21:00 щодня */
  work_weekly_schedule: unknown | null;
  /** bigint з БД може прийти як рядок у JSON */
  telegram_chat_id: string | number | null;
  telegram_link_token: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  telegram_username: string | null;
  /** bigint з БД може прийти як рядок у JSON */
  telegram_chat_id: string | number | null;
  telegram_link_token: string | null;
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
  telegram_reminder_sent_at: string | null;
  /** Перше повідомлення в Telegram про запис (незабаром після бронювання); ім'я колонки історичне. */
  telegram_reminder_24h_sent_at: string | null;
  telegram_reminder_2h_sent_at: string | null;
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
  /** Гривні; з БД numeric може прийти як рядок. */
  price: number;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateServiceInput = {
  name: string;
  duration_minutes: number;
  price?: number;
  category?: string | null;
  description?: string | null;
};

export type UpdateServiceInput = {
  name?: string;
  duration_minutes?: number;
  price?: number;
  category?: string | null;
  description?: string | null;
};

export type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
};

export type CreateProductInput = {
  name: string;
  price?: number;
  stock?: number;
  category?: string | null;
  description?: string | null;
};

export type UpdateProductInput = {
  name?: string;
  price?: number;
  stock?: number;
  category?: string | null;
  description?: string | null;
};

/** Рядок позиції замовлення (зберігається в JSON). */
export type OrderLineItem = {
  product_name: string;
  quantity: number;
};

export type OrderStatus = "new" | "paid" | "cancelled";

export type OrderRow = {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  source: string | null;
  status: OrderStatus;
  total: number;
  items: OrderLineItem[];
  created_at: string;
  updated_at: string;
};

export type CreateOrderInput = {
  client_name: string;
  client_phone?: string | null;
  source?: string | null;
  status?: OrderStatus;
  total: number;
  items: OrderLineItem[];
};

export type UpdateOrderInput = {
  client_name?: string;
  client_phone?: string | null;
  source?: string | null;
  status?: OrderStatus;
  total?: number;
  items?: OrderLineItem[];
};

export type ExpenseRow = {
  id: string;
  user_id: string;
  title: string;
  /** Гривні; з БД numeric може прийти як рядок. */
  amount: number;
  category: string;
  notes: string | null;
  /** Календарний день витрати YYYY-MM-DD. */
  occurred_on: string;
  created_at: string;
  updated_at: string;
};

export type CreateExpenseInput = {
  title: string;
  amount: number;
  category?: string;
  notes?: string | null;
  /** YYYY-MM-DD */
  occurred_on: string;
};

/** Рядок позиції інвойсу (зберігається в JSON). */
export type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type InvoiceStatus = "draft" | "issued" | "paid" | "void";

export type InvoiceRow = {
  id: string;
  user_id: string;
  number: number;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  status: InvoiceStatus;
  items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  issued_at: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateInvoiceInput = {
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  status?: InvoiceStatus;
  items: InvoiceLineItem[];
  notes?: string | null;
  /** ISO datetime або порожньо — now */
  issued_at?: string;
  due_at?: string | null;
};

export type UpdateInvoiceInput = {
  client_name?: string;
  client_email?: string | null;
  client_phone?: string | null;
  status?: InvoiceStatus;
  items?: InvoiceLineItem[];
  notes?: string | null;
  issued_at?: string;
  due_at?: string | null;
};

/** Діапазон неробочих днів (YYYY-MM-DD, inclusive) у календарі майстра. */
export type BookingTimeOffRange = {
  start_date: string;
  end_date: string;
};

export type BookingTimeOffRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBookingTimeOffInput = {
  start_date: string;
  end_date: string;
  note?: string | null;
};
