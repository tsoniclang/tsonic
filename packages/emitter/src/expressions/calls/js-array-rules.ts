export type JsArrayRewriteStrategy =
  | { readonly kind: "wrapperInvocation" }
  | { readonly kind: "linqSelectToArray"; readonly minArgs: number }
  | { readonly kind: "linqWhereToArray"; readonly minArgs: number }
  | { readonly kind: "linqAggregate"; readonly minArgs: number }
  | { readonly kind: "linqAggregateReverse"; readonly minArgs: number }
  | { readonly kind: "stringJoin"; readonly defaultSeparator: string };

export type JsArrayMethodRule = {
  readonly methodName: string;
  readonly strategy: JsArrayRewriteStrategy;
  readonly returnsArray: boolean;
};

const JS_ARRAY_METHOD_RULES: readonly JsArrayMethodRule[] = [
  {
    methodName: "at",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "concat",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: true,
  },
  {
    methodName: "every",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "filter",
    strategy: { kind: "linqWhereToArray", minArgs: 1 },
    returnsArray: true,
  },
  {
    methodName: "find",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "findIndex",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "findLast",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "findLastIndex",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "flat",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: true,
  },
  {
    methodName: "forEach",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "includes",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "indexOf",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "join",
    strategy: { kind: "stringJoin", defaultSeparator: "," },
    returnsArray: false,
  },
  {
    methodName: "lastIndexOf",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
  {
    methodName: "map",
    strategy: { kind: "linqSelectToArray", minArgs: 1 },
    returnsArray: true,
  },
  {
    methodName: "reduce",
    strategy: { kind: "linqAggregate", minArgs: 1 },
    returnsArray: false,
  },
  {
    methodName: "reduceRight",
    strategy: { kind: "linqAggregateReverse", minArgs: 1 },
    returnsArray: false,
  },
  {
    methodName: "slice",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: true,
  },
  {
    methodName: "some",
    strategy: { kind: "wrapperInvocation" },
    returnsArray: false,
  },
];

const JS_ARRAY_METHOD_RULES_BY_NAME = new Map(
  JS_ARRAY_METHOD_RULES.map((rule) => [rule.methodName, rule] as const)
);

export const getJsArrayMethodRule = (
  methodName: string
): JsArrayMethodRule | undefined =>
  JS_ARRAY_METHOD_RULES_BY_NAME.get(methodName);
