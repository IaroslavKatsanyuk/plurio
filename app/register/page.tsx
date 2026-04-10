import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";

import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AuthShell title="Реєстрація">
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-violet-300">
          <Link href="/" className="underline hover:text-violet-100">
            На головну
          </Link>
        </p>
    </AuthShell>
  );
}
