import type { CsvColumn } from "@/components/dashboard/export-button";
import type { ClientRow } from "@/services/types";

export const clientExportColumns: CsvColumn<ClientRow>[] = [
  { label: "Імʼя", value: (r) => r.name },
  { label: "Телефон", value: (r) => r.phone ?? "" },
  { label: "Telegram", value: (r) => r.telegram_username ?? "" },
  { label: "Email", value: (r) => r.email ?? "" },
  { label: "Нотатки", value: (r) => r.notes ?? "" },
];
