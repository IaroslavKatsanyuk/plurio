"use client";

import { useMemo, useState } from "react";
import { Calculator, Info, TrendingUp } from "lucide-react";

type TaxFormId =
  | "fop1"
  | "fop2"
  | "fop3_5"
  | "fop3_3"
  | "fop_zahalny"
  | "tov";

type TaxFormDef = {
  id: TaxFormId;
  label: string;
  desc: string;
  taxRate: number | null;
  fixedTax: boolean;
  fixedMonthly?: number;
  esv: number;
  limits: number | null;
  pdv?: number;
  vz?: number;
  esv_rate?: number;
  dividends?: number;
};

const TAX_FORMS: TaxFormDef[] = [
  {
    id: "fop1",
    label: "ФОП 1 група",
    desc: "До 167 МЗП (~1 245 720 ₴/рік). Єдиний податок: фіксований (до 10% МЗП/міс). ЄСВ: мінімальний.",
    taxRate: null,
    fixedTax: true,
    fixedMonthly: 302,
    esv: 1474,
    limits: 1_245_720,
  },
  {
    id: "fop2",
    label: "ФОП 2 група",
    desc: "До 834 МЗП (~6 229 500 ₴/рік). Єдиний податок: до 20% МЗП/міс (~1 340 ₴). ЄСВ: мінімальний.",
    taxRate: null,
    fixedTax: true,
    fixedMonthly: 1340,
    esv: 1474,
    limits: 6_229_500,
  },
  {
    id: "fop3_5",
    label: "ФОП 3 група (5%)",
    desc: "Без обмежень доходу. Єдиний податок: 5% від доходу. ЄСВ: мінімальний.",
    taxRate: 0.05,
    fixedTax: false,
    esv: 1474,
    limits: null,
  },
  {
    id: "fop3_3",
    label: "ФОП 3 група (3% + ПДВ)",
    desc: "Без обмежень. Єдиний податок: 3% + платник ПДВ (20%).",
    taxRate: 0.03,
    pdv: 0.2,
    fixedTax: false,
    esv: 1474,
    limits: null,
  },
  {
    id: "fop_zahalny",
    label: "ФОП на загальній системі",
    desc: "ПДФО: 18% від чистого прибутку. ВЗ: 1.5%. ЄСВ: 22% від бази (не менше мін.).",
    taxRate: 0.18,
    vz: 0.015,
    esv_rate: 0.22,
    fixedTax: false,
    esv: 1474,
    limits: null,
  },
  {
    id: "tov",
    label: "ТОВ (загальна система)",
    desc: "Податок на прибуток: 18%. ПДВ (якщо платник): 20%. Дивіденди: 5% або 9%.",
    taxRate: 0.18,
    pdv: 0.2,
    dividends: 0.05,
    fixedTax: false,
    esv: 1474,
    limits: null,
  },
];

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border py-2.5 last:border-0 ${highlight ? "font-semibold" : ""}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-base text-primary" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

type Props = {
  /** Підказка доходу з CRM (наприклад 0, якщо сум немає в БД). */
  suggestedIncomeYear: number;
};

export function TaxesCalculator({ suggestedIncomeYear }: Props) {
  const [selectedForm, setSelectedForm] = useState<TaxFormId>("fop3_5");
  const [manualIncome, setManualIncome] = useState("");

  const form = TAX_FORMS.find((f) => f.id === selectedForm) ?? TAX_FORMS[2];

  const income = manualIncome ? Number(manualIncome) : suggestedIncomeYear;
  const totalExpenses = 0;
  const profit = income - totalExpenses;

  const { taxUnified, taxESV, taxPDV, taxPDFO, taxVZ, totalTax, netProfit } = useMemo(() => {
    let tu = 0;
    let te = 0;
    let tp = 0;
    let tpdfo = 0;
    let tvz = 0;
    const months = new Date().getMonth() + 1;

    if (form.fixedTax && form.fixedMonthly != null) {
      tu = form.fixedMonthly * months;
      te = form.esv * months;
    } else if (form.id === "fop3_5" && form.taxRate != null) {
      tu = income * form.taxRate;
      te = form.esv * months;
    } else if (form.id === "fop3_3" && form.taxRate != null && form.pdv != null) {
      tu = income * form.taxRate;
      tp = income * form.pdv;
      te = form.esv * months;
    } else if (form.id === "fop_zahalny" && form.taxRate != null && form.vz != null && form.esv_rate != null) {
      tpdfo = Math.max(profit, 0) * form.taxRate;
      tvz = Math.max(profit, 0) * form.vz;
      te = Math.max(profit * form.esv_rate, form.esv * months);
    } else if (form.id === "tov" && form.taxRate != null && form.pdv != null) {
      tpdfo = Math.max(profit, 0) * form.taxRate;
      tp = income * form.pdv;
    }

    const total = tu + te + tp + tpdfo + tvz;
    const net = income - totalExpenses - total;
    return {
      taxUnified: tu,
      taxESV: te,
      taxPDV: tp,
      taxPDFO: tpdfo,
      taxVZ: tvz,
      totalTax: total,
      netProfit: net,
    };
  }, [form, income, profit, totalExpenses]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Орієнтовний калькулятор. Витрати з CRM поки не підключені (0 ₴). Дохід можна ввести вручну або
        взяти підказку знизу.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TAX_FORMS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedForm(f.id)}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              selectedForm === f.id
                ? "border-primary bg-primary/15 shadow-sm"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <span className={selectedForm === f.id ? "font-semibold text-foreground" : "text-foreground"}>
              {f.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <p className="text-sm">{form.desc}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden />
            Дані для розрахунку
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Дохід за рік (₴)</label>
              <input
                type="number"
                value={manualIncome}
                onChange={(e) => setManualIncome(e.target.value)}
                placeholder={`${suggestedIncomeYear.toLocaleString("uk-UA")} (підказка)`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {!manualIncome ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Автоматично: {suggestedIncomeYear.toLocaleString("uk-UA")} ₴ (з CRM немає сум — зазвичай
                  0).
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Витрати за рік (₴)</label>
              <input
                readOnly
                value={totalExpenses.toLocaleString("uk-UA")}
                className="flex h-10 w-full cursor-not-allowed rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
              />
              <p className="mt-1 text-xs text-muted-foreground">Підключення до модуля витрат — згодом.</p>
            </div>
            {form.limits != null ? (
              <div
                className={`rounded-lg border p-3 ${
                  income > form.limits
                    ? "border-red-500/50 bg-red-950/40"
                    : "border-emerald-600/40 bg-emerald-950/30"
                }`}
              >
                <p
                  className={`text-xs font-medium ${
                    income > form.limits ? "text-red-200" : "text-emerald-200"
                  }`}
                >
                  {income > form.limits
                    ? `Увага: перевищено орієнтовний ліміт ${income.toLocaleString("uk-UA")} > ${form.limits.toLocaleString("uk-UA")} ₴`
                    : `У межах орієнтовного ліміту: ${income.toLocaleString("uk-UA")} / ${form.limits.toLocaleString("uk-UA")} ₴`}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Calculator className="h-5 w-5 text-muted-foreground" aria-hidden />
            Розрахунок податків
          </h2>
          <div>
            <ResultRow label="Дохід" value={`${income.toLocaleString("uk-UA")} ₴`} />
            <ResultRow label="Витрати" value={`${totalExpenses.toLocaleString("uk-UA")} ₴`} />
            <ResultRow label="Прибуток (до податків)" value={`${profit.toLocaleString("uk-UA")} ₴`} />
            {taxUnified > 0 ? (
              <ResultRow
                label={
                  form.fixedTax
                    ? `Єдиний податок (${new Date().getMonth() + 1} міс.)`
                    : `Єдиний податок (${((form.taxRate ?? 0) * 100).toFixed(0)}%)`
                }
                value={`${Math.round(taxUnified).toLocaleString("uk-UA")} ₴`}
              />
            ) : null}
            {taxESV > 0 ? (
              <ResultRow
                label={`ЄСВ (${new Date().getMonth() + 1} міс.)`}
                value={`${Math.round(taxESV).toLocaleString("uk-UA")} ₴`}
              />
            ) : null}
            {taxPDV > 0 ? (
              <ResultRow label="ПДВ (орієнтир)" value={`${Math.round(taxPDV).toLocaleString("uk-UA")} ₴`} />
            ) : null}
            {taxPDFO > 0 ? (
              <ResultRow label="Податок на прибуток / ПДФО (18%)" value={`${Math.round(taxPDFO).toLocaleString("uk-UA")} ₴`} />
            ) : null}
            {taxVZ > 0 ? (
              <ResultRow label="Військовий збір (1.5%)" value={`${Math.round(taxVZ).toLocaleString("uk-UA")} ₴`} />
            ) : null}
            <ResultRow label="Всього податків" value={`${Math.round(totalTax).toLocaleString("uk-UA")} ₴`} />
            <ResultRow
              label="Чистий прибуток (орієнтир)"
              value={`${Math.round(netProfit).toLocaleString("uk-UA")} ₴`}
              highlight
            />
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Розрахунок орієнтовний; ставки та ліміти змінюються законодавством. Для обліку зверніться до
        бухгалтера.
      </p>
    </div>
  );
}
