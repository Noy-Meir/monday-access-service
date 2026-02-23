import type { RiskLevel } from '../../types';

const config: Record<RiskLevel, { label: string; classes: string; barColor: string }> = {
  LOW: {
    label: 'Low',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    barColor: 'bg-emerald-500',
  },
  MEDIUM: {
    label: 'Medium',
    classes: 'bg-amber-50 text-amber-700 ring-amber-200',
    barColor: 'bg-amber-400',
  },
  HIGH: {
    label: 'High',
    classes: 'bg-orange-50 text-orange-700 ring-orange-200',
    barColor: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Critical',
    classes: 'bg-red-50 text-red-700 ring-red-200',
    barColor: 'bg-red-600',
  },
};

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  score?: number;
}

export function RiskBadge({ riskLevel, score }: RiskBadgeProps) {
  const { label, classes } = config[riskLevel];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes}`}
    >
      {label}
      {score !== undefined && (
        <span className="opacity-60 font-normal">{score}/100</span>
      )}
    </span>
  );
}

/**
 * Expanded risk panel shown inline in the admin table when an assessment is loaded.
 */
interface RiskPanelProps {
  riskLevel: RiskLevel;
  score: number;
  reasoning: string;
  provider: string;
  executionTimeMs: number;
}

export function RiskPanel({ riskLevel, score, reasoning, provider, executionTimeMs }: RiskPanelProps) {
  const { barColor, classes } = config[riskLevel];

  return (
    <div className={`rounded-lg border ring-1 ring-inset px-4 py-3 space-y-2 ${classes}`}>
      {/* Score bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium w-16 shrink-0">Risk Score</span>
        <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs font-semibold w-10 text-right">{score}/100</span>
      </div>

      {/* Reasoning */}
      <p className="text-xs leading-relaxed">{reasoning}</p>

      {/* Meta */}
      <p className="text-[11px] opacity-60">
        Provider: {provider} · {executionTimeMs}ms
      </p>
    </div>
  );
}
