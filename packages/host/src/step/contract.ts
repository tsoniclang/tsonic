/**
 * `earned` is everything the computation has earned up to this pause. Its final `done` value must contain
 * each entry again: what a pause stated is kept only while the computation has no completed result.
 */
export type Step<Done, Request, Paused, Earned> =
  | { readonly kind: "done"; readonly value: Done }
  | { readonly kind: "paused";
      readonly requests: readonly [Request, ...Request[]];
      readonly paused: Paused;
      readonly earned: readonly Earned[] };
