import type { RunStep } from "@playground/shared";
import { Check, Circle, LoaderCircle, X } from "lucide-react";

export function RunTimeline({ steps, selectedStepId, onSelect }: {
  steps: RunStep[];
  selectedStepId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div><p role="status" className="sr-only">{steps.find(step => step.status === "running") ? `Current protocol step: ${steps.find(step => step.status === "running")!.title}.` : steps.length ? "No active protocol step." : "No protocol steps recorded."}</p><ol className="space-y-1" aria-label="Protocol steps">
      {steps.map((step) => {
        const Icon = step.status === "succeeded" ? Check : step.status === "running" ? LoaderCircle : step.status === "failed" ? X : Circle;
        const tone = step.status === "succeeded" ? "bg-green-100 text-ok" : step.status === "running" ? "bg-blue-100 text-issuer" : step.status === "failed" ? "bg-red-100 text-bad" : "bg-slate-100 text-slate-600";
        return (
          <li key={step.id}>
            <button aria-pressed={selectedStepId === step.id} onClick={() => onSelect(step.id)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${selectedStepId === step.id ? "bg-slate-100 shadow-xs" : "hover:bg-slate-50"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone}`}>
                <Icon size={13} className={step.status === "running" ? "animate-spin" : ""} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-ink">{step.title}</span>
                <span className="block text-[11px] capitalize text-slate-500">{step.status}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol></div>
  );
}
