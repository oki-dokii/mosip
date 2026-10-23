import type { RunConfig } from "@playground/shared";
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
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const style = roleStyle[role];
  const Icon = style.icon;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <span className={`grid h-7 w-7 place-items-center rounded-lg bg-white shadow-sm ${style.color}`}><Icon size={15} /></span>
        {label}
      </legend>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id} className={`block ${option.disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
            <input className="peer sr-only" type="radio" disabled={option.disabled} aria-describedby={`${role}-${option.id}-description`} name={role} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${style.ring} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-blue-700`}>
              <span>
                <span className="block text-sm font-semibold text-ink">{option.name}</span>
                <span id={`${role}-${option.id}-description`} className="mt-0.5 block text-xs text-slate-600">{option.description ?? (option.kind === "inji" ? "MOSIP Inji" : option.kind)}</span>
              </span>
              {value === option.id && <BadgeCheck aria-hidden="true" className={style.color} size={20} />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
