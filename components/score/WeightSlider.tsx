"use client";

// A labelled 0–100 weight slider with a live value readout. Purely presentational client sugar —
// the value still travels as a plain GET form field, so the page works without JS (the readout
// just stays at its server-rendered value).
//
// noData: the criterion has no data for ANY model, so no weight can affect the ranking. The
// slider is disabled and badged rather than left live — a draggable control that silently does
// nothing misleads (same no-data-≠-zero principle as the scoring itself). Disabled inputs don't
// submit, which is fine: models exclude null criteria from their weighted average regardless.
import { useState } from "react";

export function WeightSlider({
  name,
  label,
  source,
  defaultValue,
  noData = false,
}: {
  name: string;
  label: string;
  source: string;
  defaultValue: number;
  noData?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className={`block ${noData ? "opacity-60" : ""}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        {noData ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            No data yet
          </span>
        ) : (
          <span className="text-sm tabular-nums text-gray-500">{value}</span>
        )}
      </span>
      <input
        type="range"
        name={name}
        min={0}
        max={100}
        step={5}
        defaultValue={noData ? 0 : defaultValue}
        disabled={noData}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600 disabled:cursor-not-allowed"
      />
      <span className="mt-0.5 block text-xs text-gray-600">
        {noData
          ? "No model has data for this yet — it can't affect the ranking until data lands."
          : source}
      </span>
    </label>
  );
}
