import type { RunStep } from "@playground/shared";
import { Check, Circle, LoaderCircle, X } from "lucide-react";

export function RunTimeline({ steps, selectedStepId, onSelect }: {
  steps: RunStep[];
  selectedStepId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="space-y-1" aria-live="polite">
      {steps.map((step) => {
        const Icon = step.status === "succeeded" ? Check : step.status === "running" ? LoaderCircle : step.status === "failed" ? X : Circle;
        const tone = step.status === "succeeded" ? "bg-green-100 text-ok" : step.status === "running" ? "bg-blue-100 text-issuer" : step.status === "failed" ? "bg-red-100 text-bad" : "bg-slate-100 text-slate-400";
        return (
          <li key={step.id}>
            <button onClick={() => onSelect(step.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${selectedStepId === step.id ? "bg-slate-100" : "hover:bg-slate-50"}`}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}>
                <Icon size={16} className={step.status === "running" ? "animate-spin" : ""} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{step.title}</span>
                <span className="block text-xs capitalize text-slate-500">{step.status}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
