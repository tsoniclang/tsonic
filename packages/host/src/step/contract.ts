/**
 * `earned` on a pause is what the computation has earned since its previous pause (since its start, for the first
 * pause): only diagnostics that stand whatever the pending answers turn out to be, never a complaint of a
 * provisional group or round. A diagnostic is stated once: with the first pause after it was earned, or, when it
 * was earned after the last pause, in the `done` value. A `done` value therefore carries only what was earned
 * after the last pause. Whoever runs the computation keeps the earlier chunks and composes the complete list; the
 * computation never repeats a diagnostic it has stated.
 */
export type Step<Done, Request, Paused, Earned> =
  | { readonly kind: "done"; readonly value: Done }
  | { readonly kind: "paused";
      readonly requests: readonly [Request, ...Request[]];
      readonly paused: Paused;
      readonly earned: readonly Earned[] };
