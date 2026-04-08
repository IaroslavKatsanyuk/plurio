"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithPassword } from "@/services/auth.service";

type Props = {
  nextPath: string;
};

export function LoginForm({ nextPath }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        try {
          const result = await signInWithPassword({
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            next: nextPath,
          });
          if (!result.ok) {
            setError(result.error);
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
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
      >
        {pending ? "Вхід…" : "Увійти"}
      </Button>
      <p className="text-center text-sm text-violet-600 dark:text-violet-400">
        Немає акаунта?{" "}
        <Link href="/register" className="font-medium text-violet-900 underline dark:text-violet-100">
          Реєстрація
        </Link>
      </p>
    </form>
  );
}
