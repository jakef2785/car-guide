"use client";

// Review form. HTML constraints + shared-schema limits are UX only — the server action
// re-validates independently (Security-Requirements.md).
import { useFormState, useFormStatus } from "react-dom";
import {
  submitReviewAction,
  type ReviewFormState,
} from "@/app/(public)/cars/[make]/[model]/review/actions";

const INITIAL: ReviewFormState = { error: null };

const inputClass = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const labelClass = "text-sm font-medium text-slate-700";

function RatingSelect({ name, label }: { name: string; label: string }) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} required defaultValue="" className={inputClass}>
        <option value="" disabled>
          Choose 1–5
        </option>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} — {["", "Poor", "Below average", "Average", "Good", "Excellent"][n]}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-charcoal px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit for moderation"}
    </button>
  );
}

export function ReviewForm({ modelId }: { modelId: string }) {
  const [state, formAction] = useFormState(submitReviewAction, INITIAL);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="modelId" value={modelId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <RatingSelect name="reliabilityRating" label="Reliability" />
        <RatingSelect name="runningCostRating" label="Running costs (5 = cheap to run)" />
      </div>

      <label className={labelClass}>
        Title
        <input type="text" name="title" required minLength={5} maxLength={100} className={inputClass} />
      </label>

      <label className={labelClass}>
        Your review
        <textarea
          name="body"
          required
          minLength={30}
          maxLength={5000}
          rows={6}
          className={inputClass}
          placeholder="What's it like to own? At least 30 characters."
        />
      </label>

      <label className={labelClass}>
        Known issues <span className="font-normal text-slate-600">(optional)</span>
        <textarea name="knownIssues" maxLength={2000} rows={3} className={inputClass} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Model year <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" name="variantYear" min={1980} max={2100} className={inputClass} />
        </label>
        <label className={labelClass}>
          Months owned <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" name="ownershipMonths" min={0} max={600} className={inputClass} />
        </label>
        <label className={labelClass}>
          Annual mileage <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" name="annualMileage" min={0} max={200000} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Real-world MPG <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" step="0.1" name="realWorldMpg" min={1} max={300} className={inputClass} />
        </label>
        <label className={labelClass}>
          Fuel £/month <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" step="0.01" name="monthlyFuelCostGbp" min={0} max={5000} className={inputClass} />
        </label>
        <label className={labelClass}>
          Insurance £/month <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" step="0.01" name="monthlyInsuranceGbp" min={0} max={5000} className={inputClass} />
        </label>
        <label className={labelClass}>
          Servicing £/year <span className="font-normal text-slate-600">(optional)</span>
          <input type="number" step="0.01" name="annualServicingGbp" min={0} max={20000} className={inputClass} />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <span className="text-xs text-slate-500">
          Reviews are checked by a moderator before appearing on the site.
        </span>
      </div>
    </form>
  );
}
