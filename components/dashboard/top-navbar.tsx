type Props = {
  userEmail?: string | null;
};

function getInitials(email: string | null | undefined): string {
  const normalizedEmail = typeof email === "string" ? email : "";
  const local = normalizedEmail.split("@")[0]?.trim() ?? "";
  if (!local) {
    return "U";
  }

  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return local.slice(0, 2).toUpperCase();
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 2);
}

export function DashboardTopNavbar({ userEmail }: Props) {
  const initials = getInitials(userEmail);
  const displayEmail = typeof userEmail === "string" && userEmail.trim() ? userEmail : "Користувач";

  return (
    <header className="mb-5 hidden items-center justify-between rounded-xl border border-violet-900/60 bg-violet-950/40 px-4 py-2.5 shadow-lg backdrop-blur-sm lg:flex">
      <p className="text-sm font-semibold tracking-wide text-violet-100">Plurio</p>
      <div className="flex items-center gap-2">
        <p className="hidden text-sm text-violet-300 sm:block">{displayEmail}</p>
        <div
          aria-label={`Профіль ${displayEmail}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
          title={displayEmail}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
