"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { FinanceView } from "@/components/dashboard/finance-view";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { FinanceBundle } from "@/services/analytics.service";

type Props = {
  userEmail: string;
  bundle: FinanceBundle;
};

export function FinancePageContent({ userEmail, bundle }: Props) {
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);

  return (
    <DashboardShell
      active="finance"
      userEmail={userEmail}
      title="Фінанси"
      subtitle="Доходи, витрати та прибуток"
      headerRight={
        <Button
          type="button"
          onClick={() => setExpenseFormOpen(true)}
          className="gap-2 shadow-lg shadow-primary/25"
        >
          <Plus className="size-4" aria-hidden />
          Додати витрату
        </Button>
      }
    >
      <FinanceView
        bundle={bundle}
        expenseFormOpen={expenseFormOpen}
        onExpenseFormOpenChange={setExpenseFormOpen}
      />
    </DashboardShell>
  );
}
