export type AdaptResult<T> =
  | { readonly kind: "match"; readonly value: T }
  | { readonly kind: "noMatch" }
  | {
      readonly kind: "ambiguous";
      readonly candidates: readonly T[];
      readonly reason: string;
    }
  | { readonly kind: "unsupported"; readonly reason: string };

export const adaptMatch = <T>(value: T): AdaptResult<T> => ({
  kind: "match",
  value,
});

export const adaptNoMatch = <T = never>(): AdaptResult<T> => ({
  kind: "noMatch",
});

export const adaptAmbiguous = <T>(
  candidates: readonly T[],
  reason: string
): AdaptResult<T> => ({
  kind: "ambiguous",
  candidates,
  reason,
});

export const adaptUnsupported = <T = never>(
  reason: string
): AdaptResult<T> => ({
  kind: "unsupported",
  reason,
});

export const adaptFromNullable = <T>(value: T | undefined): AdaptResult<T> =>
  value === undefined ? adaptNoMatch() : adaptMatch(value);

export const adaptValueOrUndefined = <T>(
  result: AdaptResult<T>
): T | undefined => {
  switch (result.kind) {
    case "match":
      return result.value;
    case "noMatch":
      return undefined;
    case "ambiguous":
      throw new Error(`ICE: Ambiguous adaptation result: ${result.reason}`);
    case "unsupported":
      throw new Error(`ICE: Unsupported adaptation result: ${result.reason}`);
  }
};
