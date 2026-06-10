import Link from "next/link";

interface DashboardSwitchLinkProps {
  target: "/dashboard" | "/dashboard2";
  label: string;
}

export function DashboardSwitchLink({ target, label }: DashboardSwitchLinkProps) {
  return (
    <Link
      href={target}
      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}
