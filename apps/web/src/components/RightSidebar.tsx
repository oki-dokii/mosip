import { useEffect, useState } from "react";
import { ChevronRight, FileSearch, GitCompare, History, Layers, Menu, Play, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import type { RunSummary } from "@playground/shared";

interface Props {
  run: RunSummary | null;
  runId?: string | null;
}

interface NavItem {
  id: string;
  label: string;
  stepNumber: string;
  description: string;
  icon: typeof SlidersHorizontal;
  badge?: string | undefined;
}

export function RightSidebar({ run, runId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("configure-run");

  const navItems: NavItem[] = [
    {
      id: "configure-run",
      stepNumber: "Step 1",
      label: "Configure Run",
      description: "Choose issuer, wallet, verifier & fault",
      icon: SlidersHorizontal,
    },
    {
      id: "live-run",
      stepNumber: "Step 2",
      label: "Live Protocol Run",
      description: run ? `Run ${run.id.slice(0, 8)} (${run.status})` : runId ? `Run ${runId.slice(0, 8)}` : "Timeline, coverage & inspector",
      icon: Play,
      badge: run ? run.status : undefined,
    },
    {
      id: "wallet-evidence",
      stepNumber: "Step 3",
      label: "Real-Wallet Evidence",
      description: "Observed Android & Web evidence",
      icon: ShieldCheck,
    },
    {
      id: "run-archive",
      stepNumber: "Step 4",
      label: "History & Matrix",
      description: "Run history and compatibility matrix",
      icon: History,
    },
    {
      id: "run-comparison",
      stepNumber: "Step 5",
      label: "Compare Runs",
      description: "Side-by-side run diffs & structure",
      icon: GitCompare,
    },
    {
      id: "gap-explorer",
      stepNumber: "Step 6",
      label: "Interoperability Findings",
      description: "Observed protocol limits & gap register",
      icon: FileSearch,
    },
  ];

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    navItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Custom event listener so other buttons (like the header button) can trigger the sidebar
  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("toggle-right-sidebar", handleToggle);
    window.addEventListener("open-right-sidebar", handleOpen);
    return () => {
      window.removeEventListener("toggle-right-sidebar", handleToggle);
      window.removeEventListener("open-right-sidebar", handleOpen);
    };
  }, []);

  // Keyboard navigation: Escape closes sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating 3-lines button on the right edge */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation sidebar"
        aria-expanded={isOpen}
        className="fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full bg-issuer px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition hover:scale-105 hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
      >
        <Menu size={16} />
        <span>Steps</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">
          6
        </span>
      </button>

      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Right Drawer Sidebar */}
      <aside
        aria-label="Steps and workflow navigation"
        className={`fixed top-0 right-0 z-50 flex h-full w-84 max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-white/10 dark:bg-[#111724] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-issuer dark:bg-blue-400/10 dark:text-blue-400">
              <Layers size={17} />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-ink dark:text-white">Workflow Steps</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Jump directly to any section</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-ink dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Run Quick Status if available */}
        {run && (
          <div className="mx-4 mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs dark:border-white/5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-issuer dark:text-blue-400">
                Run {run.id.slice(0, 8)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  run.status === "passed"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : run.status === "running" || run.status === "pending"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {run.config.issuer} → {run.config.wallet} → {run.config.verifier}
            </p>
          </div>
        )}

        {/* Steps List */}
        <nav aria-label="Page sections" className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={`group flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
                  isActive
                    ? "border border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10"
                    : "border border-transparent hover:bg-slate-100/70 dark:hover:bg-white/5"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${
                    isActive
                      ? "bg-issuer text-white shadow-xs"
                      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:group-hover:bg-white/10"
                  }`}
                >
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {item.stepNumber}
                    </span>
                    {item.badge && (
                      <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`block text-xs font-bold leading-snug ${
                      isActive
                        ? "text-issuer dark:text-blue-400"
                        : "text-ink dark:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  size={14}
                  className={`mt-2 shrink-0 text-slate-400 transition-transform ${
                    isActive
                      ? "translate-x-0.5 text-issuer dark:text-blue-400"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200/80 p-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setIsOpen(false);
            }}
            className="w-full rounded-lg border border-slate-300/80 bg-white py-2 text-center font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ↑ Back to Top
          </button>
        </div>
      </aside>
    </>
  );
}
