export type JsDiagnosticSurfaceMetadata = {
  readonly builtinMemberNames: readonly string[];
  readonly ambientGlobalCalls: Readonly<Record<string, readonly string[]>>;
  readonly ambientGlobalFunctions: readonly string[];
  readonly typedArraySymbolNames: readonly string[];
};

export type DiagnosticSurfaceMetadata = {
  readonly js: JsDiagnosticSurfaceMetadata;
};

const defineJsDiagnosticSurface = (
  metadata: JsDiagnosticSurfaceMetadata
): JsDiagnosticSurfaceMetadata => ({
  builtinMemberNames: [...metadata.builtinMemberNames].sort(),
  ambientGlobalCalls: Object.fromEntries(
    Object.entries(metadata.ambientGlobalCalls)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([owner, members]) => [owner, [...members].sort()])
  ),
  ambientGlobalFunctions: [...metadata.ambientGlobalFunctions].sort(),
  typedArraySymbolNames: [...metadata.typedArraySymbolNames].sort(),
});

export const DIAGNOSTIC_SURFACE_METADATA: DiagnosticSurfaceMetadata = {
  js: defineJsDiagnosticSurface({
    builtinMemberNames: [
      "charAt",
      "charCodeAt",
      "codePointAt",
      "concat",
      "endsWith",
      "every",
      "filter",
      "find",
      "findIndex",
      "flat",
      "flatMap",
      "forEach",
      "includes",
      "indexOf",
      "join",
      "lastIndexOf",
      "length",
      "localeCompare",
      "map",
      "match",
      "matchAll",
      "pop",
      "push",
      "reduce",
      "reduceRight",
      "replace",
      "replaceAll",
      "reverse",
      "search",
      "shift",
      "slice",
      "some",
      "sort",
      "splice",
      "split",
      "startsWith",
      "substr",
      "substring",
      "toLocaleLowerCase",
      "toLocaleUpperCase",
      "toLowerCase",
      "toUpperCase",
      "trim",
      "trimEnd",
      "trimStart",
      "unshift",
    ],
    ambientGlobalCalls: {
      Array: ["from", "isArray", "of"],
      JSON: ["parse", "stringify"],
      Object: ["entries", "fromEntries", "keys", "values"],
    },
    ambientGlobalFunctions: ["Array", "Symbol"],
    typedArraySymbolNames: [
      "BigInt64Array",
      "BigUint64Array",
      "Float32Array",
      "Float64Array",
      "Int16Array",
      "Int32Array",
      "Int8Array",
      "Uint16Array",
      "Uint32Array",
      "Uint8Array",
      "Uint8ClampedArray",
    ],
  }),
};

export const getJsDiagnosticSurfaceMetadata = (): JsDiagnosticSurfaceMetadata =>
  DIAGNOSTIC_SURFACE_METADATA.js;
