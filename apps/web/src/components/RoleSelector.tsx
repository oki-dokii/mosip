import type { ReactNode } from "react";
import { BadgeCheck, Building2, ShieldCheck, WalletCards } from "lucide-react";

type Role = "issuer" | "wallet" | "verifier";
interface Option { id: string; name: string; kind: string; description?: string; disabled?: boolean }

const roleStyle = {
  issuer: { icon: Building2, color: "text-issuer", ring: "peer-checked:border-issuer peer-checked:bg-blue-50" },
  wallet: { icon: WalletCards, color: "text-wallet", ring: "peer-checked:border-wallet peer-checked:bg-green-50" },
  verifier: { icon: ShieldCheck, color: "text-verifier", ring: "peer-checked:border-verifier peer-checked:bg-orange-50" },
};

export function RoleSelector({ role, label, options, value, onChange }: {
  role: Role;
  label: ReactNode;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const style = roleStyle[role];
  const Icon = style.icon;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className={`grid h-6 w-6 place-items-center rounded-md bg-white shadow-sm border border-slate-200/60 ${style.color}`}><Icon size={13} /></span>
        {label}
      </legend>
      <div className="space-y-1.5">
        {options.map((option) => (
          <label key={option.id} className={`block ${option.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            <input className="peer sr-only" type="radio" disabled={option.disabled} aria-describedby={`${role}-${option.id}-description`} name={role} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span className={`flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 transition hover:shadow-sm ${style.ring} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-blue-700`}>
              <span className="min-w-0 pr-2">
                <span className="block text-xs font-bold text-ink">{option.name}</span>
                <span id={`${role}-${option.id}-description`} className="mt-0.5 block text-[11px] leading-tight text-slate-500 truncate">{option.description ?? (option.kind === "inji" ? "MOSIP Inji" : option.kind)}</span>
              </span>
              {value === option.id && <BadgeCheck aria-hidden="true" className={`${style.color} shrink-0`} size={18} />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
