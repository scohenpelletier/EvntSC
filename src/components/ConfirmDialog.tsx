"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, cx } from "./ui";

/**
 * In-app confirmation dialogs (replaces window.confirm).
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete plan?", body: "…", confirmLabel: "Delete", tone: "danger" })) …
 *
 * Built on the native <dialog> element with showModal(): it renders in the top
 * layer, traps focus, makes the page behind it inert, and closes on Escape
 * (which counts as Cancel). Focus starts on Cancel for destructive actions and
 * returns to the triggering element afterwards.
 */

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Optional third choice, e.g. "Save and leave". Resolves to "extra". */
  extraLabel?: string;
};
export type ConfirmResult = boolean | "extra";

type Pending = ConfirmOptions & { resolve: (r: ConfirmResult) => void };
type ConfirmFn = {
  (opts: ConfirmOptions & { extraLabel: string }): Promise<ConfirmResult>;
  (opts: Omit<ConfirmOptions, "extraLabel">): Promise<boolean>;
};

const Ctx = createContext<((o: ConfirmOptions) => Promise<ConfirmResult>) | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return fn as ConfirmFn;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPending((prev) => {
          prev?.resolve(false); // a newer request cancels an older open one
          return { ...opts, resolve };
        });
      }),
    [],
  );

  useEffect(() => {
    const d = ref.current;
    if (!d || !pending) return;
    if (!d.open) d.showModal();
    (pending.tone === "danger" ? cancelRef : confirmRef).current?.focus();
  }, [pending]);

  const finish = (result: ConfirmResult) => {
    const p = pending;
    setPending(null);
    if (ref.current?.open) ref.current.close();
    p?.resolve(result);
    returnFocus.current?.focus?.();
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={pending?.body ? bodyId : undefined}
        onCancel={(e) => {
          e.preventDefault();
          finish(false);
        }}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself, outside the panel) cancels.
          if (e.target === e.currentTarget) finish(false);
        }}
        className="confirm-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/40"
      >
        {pending && (
          <div className="p-5">
            <div className="flex items-start gap-3">
              {pending.tone === "danger" && (
                <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cardinal-wash text-cardinal">
                  !
                </span>
              )}
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-lg font-semibold leading-snug">
                  {pending.title}
                </h2>
                {pending.body && (
                  <div id={bodyId} className="mt-1.5 text-sm text-muted">
                    {pending.body}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button ref={cancelRef} onClick={() => finish(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              {pending.extraLabel && (
                <Button variant="secondary" onClick={() => finish("extra")}>
                  {pending.extraLabel}
                </Button>
              )}
              <Button
                ref={confirmRef}
                variant="primary"
                className={cx(pending.tone === "danger" && "border-cardinal-ink bg-cardinal-ink")}
                onClick={() => finish(true)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}
