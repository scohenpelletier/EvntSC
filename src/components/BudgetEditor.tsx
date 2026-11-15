"use client";
import type { BudgetFinding, BudgetSummary } from "@/lib/budget";
import { formatCents } from "@/lib/money";
import { budgetCategories, LABELS, newId, type BudgetLine } from "@/lib/schema";
import { Button, Card, cx } from "./ui";

export function FindingList({ findings, compact = false }: { findings: BudgetFinding[]; compact?: boolean }) {
  if (!findings.length) return <p className="text-sm text-muted">No budget findings from the current inputs.</p>;
  const order = { issue: 0, warning: 1, info: 2 } as const;
  return (
    <ul className="space-y-2">
      {[...findings]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((f) => (
          <li
            key={f.id}
            className={cx(
              "rounded-md border-l-4 bg-paper px-3.5 py-2.5 text-sm",
              f.severity === "issue" ? "border-cardinal" : f.severity === "warning" ? "border-amber" : "border-line-strong",
            )}
          >
            <p className="font-semibold">
              {f.severity === "issue" && <span className="sr-only">Issue: </span>}
              {f.title}
            </p>
            {!compact && <p className="text-muted">{f.detail}</p>}
          </li>
        ))}
    </ul>
  );
}

export function BudgetTotals({ b, tone = "light" }: { b: BudgetSummary; tone?: "light" | "cardinal" }) {
  const dark = tone === "cardinal";
  const row = (label: string, value: React.ReactNode, note?: string, strong = false) => (
    <div className={cx("flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0", dark ? "border-white/20" : "border-line")}>
      <dt className={cx("text-sm", strong ? "font-semibold" : dark ? "text-white/80" : "text-muted")}>
        {label}
      </dt>
      <dd className={cx("text-right tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
  const unknown = (t: string) => <span className={cx("text-sm italic", dark ? "font-semibold not-italic text-gold" : "text-amber")}>{t}</span>;
  return (
    <dl>
      {row("Known subtotal", formatCents(b.knownSubtotalCents), b.complete ? undefined : "Excludes unknown and invalid lines", true)}
      {b.quotedCents > 0 && row("· from written quotes", formatCents(b.quotedCents))}
      {b.quotedCents > 0 && b.estimatedCents > 0 && row("· from estimates", formatCents(b.estimatedCents))}
      {b.unknownCount > 0 && row("Unknown costs", unknown(`${b.unknownCount}`))}
      {row(
        "Total",
        b.totalCents !== null ? formatCents(b.totalCents) : unknown(b.unknownCount ? "Unknown until every cost is in" : "—"),
        undefined,
        true,
      )}
      {row("Your target", b.target.cents !== null ? formatCents(b.target.cents) : unknown("Not set"))}
      {b.remainingCents !== null &&
        row(
          b.remainingCents >= 0 ? (b.complete ? "Remaining" : "At most remaining") : "Over target",
          <span className={b.remainingCents < 0 ? (dark ? "font-bold text-gold" : "font-semibold text-cardinal") : ""}>{formatCents(Math.abs(b.remainingCents))}</span>,
          b.complete ? undefined : b.remainingCents >= 0 ? "Unknown costs will reduce this" : "Unknown costs may add to this",
        )}
      {b.requested.cents !== null && row("Funding requested", formatCents(b.requested.cents))}
      {b.confirmed.cents !== null && row("Confirmed funding", formatCents(b.confirmed.cents))}
      {b.uncoveredCents !== null && row("Not covered by confirmed funding", formatCents(b.uncoveredCents))}
    </dl>
  );
}

export function SavingsList({ ideas }: { ideas: BudgetSummary["savings"] }) {
  if (!ideas.length) return null;
  return (
    <ul className="space-y-2">
      {ideas.map((i) => (
        <li key={i.id} className="rounded-lg border border-gold bg-gold-wash px-3.5 py-2.5 text-sm">
          <p className="font-semibold">
            {i.title}
            {i.savesCents !== null && <span className="ml-1 font-normal text-green">· saves about {formatCents(i.savesCents)}</span>}
          </p>
          <p className="text-xs text-muted">Assumption: {i.assumption}</p>
        </li>
      ))}
    </ul>
  );
}

export function BudgetEditor({ lines, summary, onChange }: { lines: BudgetLine[]; summary: BudgetSummary; onChange: (lines: BudgetLine[]) => void }) {
  const update = (id: string, patch: Partial<BudgetLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = () => onChange([...lines, { id: newId("l"), description: "", category: "other", quantity: "1", unitCost: "", costUnknown: false, costType: "estimate", notes: "" }]);
  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card
        title="Expense lines"
        action={
          <Button size="sm" variant="primary" onClick={add}>
            + Add line
          </Button>
        }
      >
        {lines.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-muted">
            No expenses yet. Add a line for each expected cost. If you don&apos;t know a price, add the line and mark it “cost unknown”.
          </div>
        ) : (
          <ul className="space-y-3">
            {lines.map((line, idx) => {
              const r = summary.lines.find((x) => x.id === line.id);
              const label = (f: string) => `${f}, line ${idx + 1}`;
              return (
                <li
                  key={line.id}
                  className={cx(
                    "rounded-xl border p-3.5 sm:p-4",
                    r?.errors.length ? "border-cardinal/50 bg-cardinal-wash/30" : r?.unknown ? "border-amber/50 bg-amber-wash/40" : "border-line",
                  )}
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <input
                      aria-label={label("Description")}
                      placeholder="Description"
                      value={line.description}
                      maxLength={160}
                      onChange={(e) => update(line.id, { description: e.target.value })}
                      className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm"
                    />
                    <select
                      aria-label={label("Category")}
                      value={line.category}
                      onChange={(e) => update(line.id, { category: e.target.value as BudgetLine["category"] })}
                      className="rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm"
                    >
                      {budgetCategories.map((c) => (
                        <option key={c} value={c}>
                          {LABELS.category[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted">
                      Qty
                      <input
                        aria-label={label("Quantity")}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => update(line.id, { quantity: e.target.value })}
                        className="mt-0.5 block w-20 rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink"
                      />
                    </label>
                    <span className="pb-2 text-muted" aria-hidden>
                      ×
                    </span>
                    <label className="text-xs text-muted">
                      Unit cost ($)
                      <input
                        aria-label={label("Unit cost")}
                        inputMode="decimal"
                        value={line.costUnknown ? "" : line.unitCost}
                        disabled={line.costUnknown}
                        placeholder={line.costUnknown ? "unknown" : "0.00"}
                        onChange={(e) => update(line.id, { unitCost: e.target.value })}
                        className="mt-0.5 block w-28 rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink disabled:bg-amber-wash"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 pb-2 text-sm">
                      <input type="checkbox" checked={line.costUnknown} onChange={(e) => update(line.id, { costUnknown: e.target.checked })} />
                      Cost unknown
                    </label>
                    {!line.costUnknown && (
                      <label className="text-xs text-muted">
                        Source
                        <select
                          aria-label={label("Cost source")}
                          value={line.costType}
                          onChange={(e) => update(line.id, { costType: e.target.value as BudgetLine["costType"] })}
                          className="mt-0.5 block rounded-md border border-line-strong bg-white px-2 py-1.5 text-sm text-ink"
                        >
                          <option value="estimate">{LABELS.costType.estimate}</option>
                          <option value="quote">{LABELS.costType.quote}</option>
                        </select>
                      </label>
                    )}
                    <div className="ml-auto pb-1 text-right">
                      <span className="block text-xs text-muted">Amount</span>
                      <span className="font-semibold tabular-nums">
                        {r?.unknown ? <span className="italic text-amber">Unknown</span> : r?.amountCents != null ? formatCents(r.amountCents) : <span className="text-cardinal">—</span>}
                      </span>
                    </div>
                  </div>
                  {r?.errors.length ? (
                    <p className="mt-2 text-xs text-cardinal" role="alert">
                      {r.errors.join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      aria-label={label("Notes")}
                      placeholder="Notes (optional)"
                      value={line.notes}
                      maxLength={500}
                      onChange={(e) => update(line.id, { notes: e.target.value })}
                      className="flex-1 rounded-md border border-line bg-white px-2 py-1 text-xs"
                    />
                    <Button size="sm" variant="ghost" onClick={() => remove(line.id)} aria-label={label("Remove")}>
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div className="space-y-6">
        <section aria-labelledby="totals-h" className="on-cardinal rounded-xl bg-cardinal p-5 text-white sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="totals-h" className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Totals
            </h2>
            <span className="text-xs text-white/70">Calculated by EvntSC</span>
          </div>
          {summary.remainingCents !== null && (
            <p className="mt-1 mb-3 flex items-baseline gap-2">
              <span className="font-display text-4xl tabular-nums">{formatCents(Math.abs(summary.remainingCents))}</span>
              <span className="text-sm font-semibold text-gold">
                {summary.remainingCents < 0 ? "over target" : summary.complete ? "remaining" : "at most remaining"}
              </span>
            </p>
          )}
          <BudgetTotals b={summary} tone="cardinal" />
        </section>
        {summary.savings.length > 0 && (
          <Card title="Ways to close the gap">
            <SavingsList ideas={summary.savings} />
          </Card>
        )}
        <Card title="Findings">
          <FindingList findings={summary.findings} />
        </Card>
      </div>
    </div>
  );
}
