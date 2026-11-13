export type Step<Done, Request, Paused, Earned> =
  | { readonly kind: "done"; readonly value: Done }
  | { readonly kind: "paused";
      readonly requests: readonly [Request, ...Request[]];
      readonly paused: Paused;
      readonly earned: readonly Earned[] };
