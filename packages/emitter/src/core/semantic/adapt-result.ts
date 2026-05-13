export type AdaptResult<T> =
  | { readonly kind: "match"; readonly value: T }
  | { readonly kind: "noMatch" }
  | { readonly kind: "ambiguous"; readonly reason: string }
  | { readonly kind: "unsupported"; readonly reason: string };

export const adaptMatch = <T>(value: T): AdaptResult<T> => ({
  kind: "match",
  value,
});

export const adaptNoMatch = <T = never>(): AdaptResult<T> => ({
  kind: "noMatch",
});

export const adaptValueOrUndefined = <T>(
  result: AdaptResult<T>
): T | undefined => (result.kind === "match" ? result.value : undefined);
