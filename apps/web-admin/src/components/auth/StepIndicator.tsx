import { Check } from "lucide-react";

export function StepIndicator({ step, total, accent }: { step: number; total: number; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-6" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "active" : "upcoming";
        return (
          <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200"
              style={
                state === "upcoming"
                  ? { backgroundColor: "var(--border)", color: "var(--muted-foreground)" }
                  : { backgroundColor: accent, color: "white" }
              }
            >
              {state === "done" ? <Check className="w-3.5 h-3.5" /> : n}
            </div>
            {n < total && (
              <div
                className="flex-1 h-0.5 rounded-full transition-colors duration-200"
                style={{ backgroundColor: state === "done" ? accent : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
