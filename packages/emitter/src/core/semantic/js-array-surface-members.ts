export const JS_ARRAY_MUTATING_METHODS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

export const JS_ARRAY_RETURNING_METHODS = new Set([
  "concat",
  "copyWithin",
  "filter",
  "flat",
  "flatMap",
  "map",
  "reverse",
  "slice",
  "sort",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
]);

export const jsArrayMethodReturnsMutatedArray = (memberName: string): boolean =>
  memberName === "sort" ||
  memberName === "reverse" ||
  memberName === "fill" ||
  memberName === "copyWithin";
