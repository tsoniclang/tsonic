/**
 * `earned` is everything the computation has earned up to this pause: only diagnostics that stand whatever the
 * pending answers turn out to be, never a complaint of a provisional round. Its final `done` value must contain
 * each entry again, as the same diagnostic objects: what a pause stated is kept only while the computation has
 * no completed result.
 */
export type Step<Done, Request, Paused, Earned> =
  | { readonly kind: "done"; readonly value: Done }
  | { readonly kind: "paused";
      readonly requests: readonly [Request, ...Request[]];
      readonly paused: Paused;
      readonly earned: readonly Earned[] };
