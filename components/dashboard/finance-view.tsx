"use client";

import type { LucideIcon } from "lucide-react";
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ChangeEvent, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { dateKeyKyiv } from "@/lib/datetime-kyiv";
import { cn } from "@/lib/utils";
import type { FinanceBundle } from "@/services/analytics.service";
import type { ExpenseRow } from "@/services/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const CHART_GRID = "hsl(220 15% 90%)";
const CHART_TICK = "#64748b";
const CHART_INCOME = "hsl(142 71% 45%)";
const CHART_EXPENSE = "hsl(0 84% 60%)";

const EXPENSE_CATEGORIES = [
  "оренда",
  "зарплата",
  "матеріали",
  "реклама",
  "обладнання",
  "інше",
] as const;

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) {
    return ym;
  }
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1, 12, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastSixYearMonths(): string[] {
  const thisYm = dateKeyKyiv(new Date().toISOString()).slice(0, 7);
  return Array.from({ length: 6 }, (_, i) => shiftYearMonth(thisYm, -(5 - i)));
}

function monthLabelUk(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) {
    return ym;
  }
  const anchor = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  return anchor.toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });
}

function formatExpenseDateYmd(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) {
    return ymd;
  }
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayYmdKyiv(): string {
  return dateKeyKyiv(new Date().toISOString());
}

function incomeForYearMonth(
  bundle: FinanceBundle,
  servicesById: Map<string, { price: number }>,
  yearMonth: string,
): number {
  let sum = 0;
  for (const a of bundle.appointments) {
    if (a.status !== "completed") {
      continue;
    }
    const k = dateKeyKyiv(a.starts_at);
    if (!k.startsWith(yearMonth)) {
      continue;
    }
    const svc = a.service_id ? servicesById.get(a.service_id) : undefined;
    sum += svc?.price ?? 0;
  }
  for (const o of bundle.orders) {
    if (o.status !== "paid") {
      continue;
    }
    const k = dateKeyKyiv(o.created_at);
    if (!k.startsWith(yearMonth)) {
      continue;
    }
    sum += o.total;
  }
  return sum;
}

function expensesForYearMonth(expenses: ExpenseRow[], yearMonth: string): number {
  return expenses
    .filter((e) => e.occurred_on.startsWith(yearMonth))
    .reduce((s, e) => s + e.amount, 0);
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[15px]",
            iconClassName,
          )}
        >
          <Icon aria-hidden />
        </div>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

type Props = {
  bundle: FinanceBundle;
  expenseFormOpen: boolean;
  onExpenseFormOpenChange: (open: boolean) => void;
};

export function FinanceView({ bundle, expenseFormOpen, onExpenseFormOpenChange }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "інше",
    occurred_on: todayYmdKyiv(),
    notes: "",
  });

  const servicesById = useMemo(
    () => new Map(bundle.services.map((s) => [s.id, s])),
    [bundle.services],
  );

  const thisYm = dateKeyKyiv(new Date().toISOString()).slice(0, 7);

  const monthIncome = useMemo(
    () => incomeForYearMonth(bundle, servicesById, thisYm),
    [bundle, servicesById, thisYm],
  );

  const monthExpensesTotal = useMemo(
    () => expensesForYearMonth(bundle.expenses, thisYm),
    [bundle.expenses, thisYm],
  );

  const monthProfit = monthIncome - monthExpensesTotal;

  const chartData = useMemo(() => {
    const keys = lastSixYearMonths();
    return keys.map((ym) => ({
      month: monthLabelUk(ym),
      income: incomeForYearMonth(bundle, servicesById, ym),
      expenses: expensesForYearMonth(bundle.expenses, ym),
    }));
  }, [bundle, servicesById]);

  async function submitExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number.parseFloat(String(form.amount).replace(",", "."));
    if (!form.title.trim()) {
      setFormError("Вкажи назву.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Вкажи суму більшу за 0.");
      return;
    }

    setPending(true);
    setFormError(null);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          amount,
          category: form.category,
          notes: form.notes.trim() || null,
          occurred_on: form.occurred_on.trim().slice(0, 10),
        }),
      });
      const json = (await response.json()) as { data?: ExpenseRow; error?: { message?: string } };
      if (!response.ok || !json.data) {
        setFormError(json.error?.message ?? "Не вдалося зберегти витрату.");
        return;
      }
      setForm({
        title: "",
        amount: "",
        category: "інше",
        occurred_on: todayYmdKyiv(),
        notes: "",
      });
      onExpenseFormOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDeleteExpense(id: string) {
    if (!window.confirm("Видалити витрату?")) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } };
        window.alert(json.error?.message ?? "Не вдалося видалити.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Доходи (місяць)"
          value={`${monthIncome.toLocaleString("uk-UA")} ₴`}
          sub="з послуг і замовлень"
          icon={TrendingUp}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400"
        />
        <StatCard
          title="Витрати (місяць)"
          value={`${monthExpensesTotal.toLocaleString("uk-UA")} ₴`}
          sub="усі категорії"
          icon={TrendingDown}
          iconClassName="bg-red-100 text-red-500 dark:bg-red-950/50 dark:text-red-400"
        />
        <StatCard
          title="Прибуток (місяць)"
          value={`${monthProfit.toLocaleString("uk-UA")} ₴`}
          sub="доходи − витрати"
          icon={Wallet}
          iconClassName={
            monthProfit >= 0
              ? "bg-primary/10 text-primary"
              : "bg-red-100 text-red-500 dark:bg-red-950/50 dark:text-red-400"
          }
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-5 font-display text-lg font-bold">Доходи та витрати за 6 місяців</h2>
        <div className="h-[230px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: CHART_TICK }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_TICK }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid hsl(220 15% 90%)",
                  borderRadius: 8,
                  color: "#0f172a",
                }}
                formatter={(value: number, name: string) => [
                  `${Number(value).toLocaleString("uk-UA")} ₴`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                name="Доходи"
                dataKey="income"
                fill={CHART_INCOME}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                name="Витрати"
                dataKey="expenses"
                fill={CHART_EXPENSE}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold">Витрати</h2>
        </div>
        {bundle.expenses.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">Витрат ще немає</p>
            <Button
              type="button"
              size="sm"
              className="mt-3 gap-1 shadow-md shadow-primary/20"
              onClick={() => onExpenseFormOpenChange(true)}
            >
              <Plus className="size-[13px]" aria-hidden />
              Додати
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Назва
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Категорія
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Дата
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Сума, ₴
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody>
              {bundle.expenses.map((row) => (
                <tr
                  key={row.id}
                  className="group border-b border-border transition-colors last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.title}</p>
                    {row.notes ? <p className="text-xs text-muted-foreground">{row.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {row.occurred_on ? formatExpenseDateYmd(row.occurred_on) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-destructive">
                    {row.amount.toLocaleString("uk-UA")} ₴
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      title="Видалити"
                      aria-label="Видалити витрату"
                      disabled={pending}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition-colors hover:bg-rose-200 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => void onDeleteExpense(row.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={expenseFormOpen}
        onClose={() => {
          onExpenseFormOpenChange(false);
          setFormError(null);
        }}
        title="Нова витрата"
      >
        <form onSubmit={(ev) => void submitExpense(ev)} className="grid gap-3">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <label className="grid gap-1 text-sm text-muted-foreground">
            Назва *
            <Input
              value={form.title}
              onChange={(ev) => setForm((f) => ({ ...f, title: ev.target.value }))}
              required
              placeholder="Напр. Оренда приміщення"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-muted-foreground">
              Сума (₴) *
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))}
                placeholder="0"
                required
              />
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Дата
              <Input
                type="date"
                value={form.occurred_on}
                onChange={(ev) => setForm((f) => ({ ...f, occurred_on: ev.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Категорія
            <select
              value={form.category}
              onChange={(ev: ChangeEvent<HTMLSelectElement>) =>
                setForm((f) => ({ ...f, category: ev.target.value }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Нотатки
            <textarea
              className={cn(
                "min-h-[72px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
              rows={2}
              placeholder="Додаткова інформація…"
              value={form.notes}
              onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
            />
          </label>
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onExpenseFormOpenChange(false);
                setFormError(null);
              }}
            >
              Скасувати
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              Додати
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
