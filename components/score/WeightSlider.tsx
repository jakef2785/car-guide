"use client";

// A labelled 0–100 weight slider with a live value readout. Purely presentational client sugar —
// the value still travels as a plain GET form field, so the page works without JS (the readout
// just stays at its server-rendered value).
import { useState } from "react";

export function WeightSlider({
  name,
  label,
  source,
  defaultValue,
}: {
  name: string;
  label: string;
  source: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-sm tabular-nums text-gray-500">{value}</span>
      </span>
      <input
        type="range"
        name={name}
        min={0}
        max={100}
        step={5}
        defaultValue={defaultValue}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
      />
      <span className="mt-0.5 block text-xs text-gray-500">{source}</span>
    </label>
  );
}
