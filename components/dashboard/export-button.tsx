"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CsvColumn<T> = {
  label: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.value(row))).join(","),
  );
  return [header, ...lines].join("\n");
}

type Props<T> = {
  data: T[];
  columns: CsvColumn<T>[];
  filename?: string;
  /** Optional label for the button (default: export CSV). */
  label?: string;
};

export function ExportButton<T>({ data, columns, filename = "export", label }: Props<T>) {
  function handleExport() {
    const csv = toCsv(data, columns);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="size-3.5" aria-hidden />
      {label ?? "Експорт CSV"}
    </Button>
  );
}
