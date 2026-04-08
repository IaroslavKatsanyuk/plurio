import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";

import { LoginForm } from "./login-form";

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  return (
    <AuthShell title="Вхід">
        <LoginForm nextPath={nextPath} />
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="underline">
            На головну
          </Link>
        </p>
    </AuthShell>
  );
}
