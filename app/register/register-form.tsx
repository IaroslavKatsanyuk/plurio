"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpWithPassword } from "@/services/auth.service";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        setInfo(null);
        try {
          const password = String(formData.get("password") ?? "");
          const confirm = String(formData.get("confirm") ?? "");
          if (password !== confirm) {
            setError("Паролі не збігаються.");
            return;
          }
          const result = await signUpWithPassword({
            email: String(formData.get("email") ?? ""),
            password,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.needsEmailConfirmation) {
            setInfo(
              "Перевір пошту: ми надіслали посилання для підтвердження акаунта.",
            );
          }
        } finally {
          setPending(false);
        }
      }}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-violet-700 dark:text-violet-300">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-violet-700 dark:text-violet-300"
        >
          Пароль
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirm"
          className="text-sm font-medium text-violet-700 dark:text-violet-300"
        >
          Підтвердження пароля
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-sm text-violet-700 dark:text-violet-300" role="status">
          {info}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
      >
        {pending ? "Реєстрація…" : "Створити акаунт"}
      </Button>
      <p className="text-center text-sm text-violet-600 dark:text-violet-400">
        Вже є акаунт?{" "}
        <Link href="/login" className="font-medium text-violet-900 underline dark:text-violet-100">
          Увійти
        </Link>
      </p>
    </form>
  );
}
