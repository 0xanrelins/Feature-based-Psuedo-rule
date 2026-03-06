"use client";

import { ScoreBreakdown } from "../types";

interface ScoreTableProps {
  scores: ScoreBreakdown;
  compact?: boolean;
}

interface ScoreRowProps {
  label: string;
  value: number;
  unit?: string;
  description: string;
  colorClass?: string;
}

function ScoreRow({ label, value, unit = "", description, colorClass = "text-text-primary" }: ScoreRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex flex-col">
        <span className="text-xs text-text-muted font-mono">{label}</span>
        <span className="text-[10px] text-text-secondary/70 font-mono">{description}</span>
      </div>
      <span className={`text-sm font-mono font-semibold ${colorClass}`}>
        {value}{unit}
      </span>
    </div>
  );
}

export default function ScoreTable({ scores, compact = false }: ScoreTableProps) {
  const { pt, pro, sr, card, ae, total } = scores;

  // Determine colors based on score values
  const getPTColor = (val: number) => val >= 3 ? "text-accent-green" : val >= 2 ? "text-accent-yellow" : "text-accent-orange";
  const getPROColor = (val: number) => val >= 40 ? "text-accent-green" : val >= 25 ? "text-accent-yellow" : "text-accent-orange";
  const getSRColor = (val: number) => val >= 1 ? "text-accent-green" : val >= 0.7 ? "text-accent-yellow" : "text-accent-orange";
  const getCARDColor = (val: number) => val <= 15 ? "text-accent-green" : val <= 30 ? "text-accent-yellow" : "text-accent-orange";
  const getAEColor = (val: number) => val >= 35 ? "text-accent-green" : val >= 20 ? "text-accent-yellow" : "text-accent-orange";

  if (compact) {
    // Compact version for list view
    return (
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div className="text-center">
          <span className="text-text-muted">PT</span>
          <span className={` block ${getPTColor(pt)}`}>{pt}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted">PRO</span>
          <span className={`block ${getPROColor(pro)}`}>{pro}%</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted">SR</span>
          <span className={`block ${getSRColor(sr)}`}>{sr}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted">CARD</span>
          <span className={`block ${getCARDColor(card)}`}>{card}</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted">AE</span>
          <span className={`block ${getAEColor(ae)}`}>{ae}%</span>
        </div>
        <div className="text-center">
          <span className="text-text-muted">TOTAL</span>
          <span className={`block font-bold ${total >= 70 ? "text-accent-green" : total >= 50 ? "text-accent-yellow" : "text-accent-red"}`}>
            {total}
          </span>
        </div>
      </div>
    );
  }

  // Full version for output panel
  return (
    <div className="bg-bg-secondary/30 rounded-lg border border-border/50 p-3">
      <div className="text-xs text-accent-orange font-mono uppercase tracking-wider mb-2">
        Score Breakdown
      </div>
      
      <ScoreRow 
        label="PT" 
        value={pt} 
        unit="%"
        description="Profit Target"
        colorClass={getPTColor(pt)}
      />
      <ScoreRow 
        label="PRO" 
        value={pro} 
        unit="%"
        description="Probability of Success"
        colorClass={getPROColor(pro)}
      />
      <ScoreRow 
        label="SR" 
        value={sr}
        description="Strike Rate"
        colorClass={getSRColor(sr)}
      />
      <ScoreRow 
        label="CARD" 
        value={card}
        description="Risk/Reward Ratio"
        colorClass={getCARDColor(card)}
      />
      <ScoreRow 
        label="AE" 
        value={ae} 
        unit="%"
        description="Average Expectancy"
        colorClass={getAEColor(ae)}
      />
      
      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-text-primary">TOTAL</span>
        <span className={`text-lg font-mono font-bold ${total >= 70 ? "text-accent-green" : total >= 50 ? "text-accent-yellow" : "text-accent-red"}`}>
          {total}/100
        </span>
      </div>
    </div>
  );
}
