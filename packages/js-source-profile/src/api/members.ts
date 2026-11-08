import type { SourceJsApiMember } from "@tsonic/target-api/source";

type Parameter = SourceJsApiMember["parameters"][number];
type Row = readonly [name: string, parameters: readonly Parameter[], resultPresence?: SourceJsApiMember["resultPresence"]];
type Meaning = Omit<SourceJsApiMember, "declaration" | "name">;

function createMemberTable(): (owner: string, name: string) => Meaning | undefined {
  const table = new Map<string, Meaning>();
  const define = (declarations: readonly string[], owner: Meaning["owner"], receiver: Meaning["receiver"], rows: readonly Row[]) => {
    for (const declaration of declarations) for (const [name, parameters, resultPresence] of rows) {
      const key = `${declaration}.${name}`;
      if (table.has(key)) throw new Error(`The JS profile has duplicate member meaning for '${key}'.`);
      table.set(key, Object.freeze({ owner, receiver, parameters: Object.freeze([...parameters]),
        resultPresence: resultPresence ?? Object.freeze({ kind: "declaration" }) }));
    }
  };
  const rows = (names: readonly string[], parameters: readonly Parameter[] = []): readonly Row[] =>
    names.map(name => [name, parameters] as const);
  const array: readonly Row[] = [
    ["at", ["index"]], ["concat", ["rest"]], ["join", ["value"]], ["slice", ["index", "index"]],
    ["indexOf", ["value", "index"]], ["lastIndexOf", ["value", "index"]], ["includes", ["value", "index"]],
    ...rows(["find", "findIndex", "findLast", "findLastIndex", "filter", "map", "flatMap", "forEach", "some", "every"], ["callback"]),
    ["flat", ["count"]], ["reduce", ["callback", "value"]], ["reduceRight", ["callback", "value"]],
    ...rows(["keys", "values", "entries", "Symbol.iterator", "toString", "toReversed"]),
    ["toLocaleString", ["options"]], ["toSorted", ["callback"]], ["toSpliced", ["index", "count", "rest"]], ["with", ["index", "value"]],
  ];
  define(["ReadonlyArray"], "readonly-array", "readonly", [["length", []], ...array]);
  define(["Array"], "array", "readonly", array);
  define(["Array"], "array", "mutating", [
    ["length", []], ["push", ["rest"]], ["pop", []], ["shift", []], ["unshift", ["rest"]],
    ["splice", ["index", "count", "rest"]], ["sort", ["callback"]], ["reverse", []],
    ["fill", ["value", "index", "index"]], ["copyWithin", ["index", "index", "index"]],
  ]);
  define(["ArrayConstructor"], "array", "static", [["isArray", ["value"]], ["from", ["value", "callback"]], ["of", ["rest"]]]);
  define(["TypedArray"], "typed-array", "readonly", [
    ...rows(["length", "BYTES_PER_ELEMENT"]), ["at", ["index"]], ["includes", ["value", "index"]],
    ["indexOf", ["value", "index"]], ["join", ["value"]], ["slice", ["index", "index"]], ["subarray", ["index", "index"]],
  ]);
  define(["TypedArray"], "typed-array", "mutating", [
    ["fill", ["value", "index", "index"]], ["reverse", []], ["set", ["value", "index"]], ["sort", ["callback"]],
  ]);
  define(["Set", "ReadonlySet"], "set", "readonly", [
    ...rows(["size", "keys", "values", "entries", "Symbol.iterator"]), ["has", ["value"]], ["forEach", ["callback"]],
    ...rows(["union", "intersection", "difference", "symmetricDifference", "isSubsetOf", "isSupersetOf", "isDisjointFrom"], ["value"]),
  ]);
  define(["Set"], "set", "mutating", [["add", ["value"]], ["delete", ["value"]], ["clear", []]]);
  define(["Map", "ReadonlyMap"], "map", "readonly", [
    ...rows(["size", "keys", "values", "entries", "Symbol.iterator"]), ["get", ["key"]], ["has", ["key"]], ["forEach", ["callback"]],
  ]);
  define(["Map"], "map", "mutating", [["set", ["key", "value"]], ["delete", ["key"]], ["clear", []]]);
  define(["WeakSet"], "weak-set", "readonly", [["has", ["value"]]]);
  define(["WeakSet"], "weak-set", "mutating", [["add", ["value"]], ["delete", ["value"]]]);
  define(["WeakMap"], "weak-map", "readonly", [["get", ["key"]], ["has", ["key"]]]);
  define(["WeakMap"], "weak-map", "mutating", [["set", ["key", "value"]], ["delete", ["key"]]]);
  define(["String"], "string", "readonly", [
    ["length", []], ...rows(["at", "charAt", "charCodeAt", "codePointAt"], ["index"]), ["concat", ["rest"]],
    ...rows(["endsWith", "startsWith", "includes", "indexOf", "lastIndexOf"], ["value", "index"]),
    ["localeCompare", ["value", "options"]], ...rows(["match", "matchAll", "normalize", "search"], ["value"]),
    ...rows(["padEnd", "padStart"], ["count", "value"]), ["repeat", ["count"]],
    ...rows(["replace", "replaceAll"], ["value", "value"]), ...rows(["slice", "substring"], ["index", "index"]),
    ["split", ["value", "count"]], ["substr", ["index", "count"]],
    ...rows(["toLowerCase", "toUpperCase", "trim", "trimStart", "trimEnd", "trimLeft", "trimRight", "isWellFormed", "toWellFormed", "toString", "valueOf", "Symbol.iterator"]),
    ...rows(["toLocaleLowerCase", "toLocaleUpperCase"], ["options"]),
  ]);
  define(["StringConstructor"], "string", "static", [["fromCharCode", ["rest"]], ["fromCodePoint", ["rest"]], ["raw", ["value", "rest"]]]);
  define(["Promise", "PromiseLike"], "promise", "readonly", [["then", ["callback", "callback"]]]);
  define(["Promise"], "promise", "readonly", [["catch", ["callback"]], ["finally", ["callback"]]]);
  define(["PromiseConstructor"], "promise", "static", [
    ...rows(["resolve", "reject", "all", "allSettled", "any", "race"], ["value"]), ["withResolvers", []],
  ]);
  define(["RegExp"], "regexp", "readonly", [
    ["test", ["value"]], ...rows(["source", "flags", "global", "ignoreCase", "multiline", "sticky", "unicode", "unicodeSets", "dotAll", "hasIndices", "toString"]),
  ]);
  define(["RegExp"], "regexp", "mutating", [["exec", ["value"]], ["lastIndex", []]]);
  define(["Number"], "number", "readonly", [
    ...rows(["toFixed", "toPrecision", "toExponential", "toString"], ["count"]), ["toLocaleString", ["value", "options"]], ["valueOf", []],
  ]);
  define(["NumberConstructor"], "number", "static", [
    ...rows(["isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat"], ["value"]), ["parseInt", ["value", "count"]],
    ...rows(["MAX_SAFE_INTEGER", "MIN_SAFE_INTEGER", "MAX_VALUE", "MIN_VALUE", "EPSILON", "NaN", "POSITIVE_INFINITY", "NEGATIVE_INFINITY"]),
  ]);
  define(["Math"], "math", "static", [
    ...rows(["abs", "ceil", "floor", "round", "trunc", "sign", "sqrt", "cbrt", "exp", "expm1", "log", "log1p", "log2", "log10", "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "fround", "clz32"], ["value"]),
    ...rows(["atan2", "pow", "imul"], ["value", "value"]), ...rows(["max", "min", "hypot"], ["rest"]),
    ...rows(["random", "E", "LN10", "LN2", "LOG10E", "LOG2E", "PI", "SQRT1_2", "SQRT2"]),
  ]);
  define(["JSON"], "json", "static", [["parse", ["value", "callback"]], ["stringify", ["value", "value", "value"],
    Object.freeze({ kind: "serialization", valueParameterIndex: 0, replacerParameterIndex: 1,
      replacerAppliesTo: "root-and-descendants", proof: "present-serializable-root" })]]);
  define(["ObjectConstructor"], "object", "static", [
    ...rows(["keys", "values", "entries", "fromEntries", "getOwnPropertyNames", "freeze", "isFrozen", "create"], ["value"]),
    ["assign", ["value", "rest"]], ["hasOwn", ["value", "key"]], ["is", ["value", "value"]],
  ]);
  define(["Global"], "global", "static", [
    ["parseInt", ["value", "count"]], ...rows(["parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI"], ["value"]),
    ["queueMicrotask", ["callback"]], ["structuredClone", ["value", "options"]],
  ]);
  define(["Date"], "date", "readonly", [
    ...rows(["getTime", "valueOf", "getFullYear", "getMonth", "getDate", "getDay", "getHours", "getMinutes", "getSeconds", "getMilliseconds", "getUTCFullYear", "getUTCMonth", "getUTCDate", "getUTCDay", "getUTCHours", "getUTCMinutes", "getUTCSeconds", "getUTCMilliseconds", "getTimezoneOffset", "toISOString", "toJSON", "toString", "toDateString", "toTimeString", "toUTCString"]),
    ...rows(["toLocaleString", "toLocaleDateString", "toLocaleTimeString"], ["value", "options"]),
  ]);
  define(["Date"], "date", "mutating", rows(["setTime", "setFullYear", "setMonth", "setDate", "setHours", "setMinutes", "setSeconds", "setMilliseconds", "setUTCFullYear", "setUTCMonth", "setUTCDate", "setUTCHours", "setUTCMinutes", "setUTCSeconds", "setUTCMilliseconds"], ["rest"]));
  define(["DateConstructor"], "date", "static", [["now", []], ["parse", ["value"]], ["UTC", ["rest"]]]);
  define(["Symbol"], "symbol", "readonly", rows(["description", "toString", "valueOf"]));
  define(["SymbolConstructor"], "symbol", "static", [["for", ["key"]], ["keyFor", ["value"]]]);
  define(["BigInt"], "bigint", "readonly", [["toString", ["count"]], ["toLocaleString", ["value", "options"]], ["valueOf", []]]);
  define(["BigIntConstructor"], "bigint", "static", [["asIntN", ["count", "value"]], ["asUintN", ["count", "value"]]]);
  define(["Error"], "error", "readonly", rows(["name", "message", "stack", "cause", "toString"]));
  define(["ErrorConstructor"], "error", "static", [["captureStackTrace", ["value", "value"]]]);
  define(["ArrayBuffer", "SharedArrayBuffer"], "binary", "readonly", [["byteLength", []], ["slice", ["index", "index"]]]);
  define(["ArrayBufferConstructor"], "binary", "static", [["isView", ["value"]]]);
  define(["DataView"], "binary", "readonly", [
    ...rows(["buffer", "byteLength", "byteOffset"]),
    ...rows(["getInt8", "getUint8", "getInt16", "getUint16", "getInt32", "getUint32", "getFloat32", "getFloat64", "getBigInt64", "getBigUint64"], ["index", "value"]),
  ]);
  define(["DataView"], "binary", "mutating", rows(["setInt8", "setUint8", "setInt16", "setUint16", "setInt32", "setUint32", "setFloat32", "setFloat64", "setBigInt64", "setBigUint64"], ["index", "value", "value"]));
  define(["IntlNumberFormat", "IntlDateTimeFormat"], "intl", "readonly", [["format", ["value"]], ["formatToParts", ["value"]], ["resolvedOptions", []]]);
  define(["IntlCollator"], "intl", "readonly", [["compare", ["value", "value"]], ["resolvedOptions", []]]);
  define(["IntlNumberFormatConstructor", "IntlDateTimeFormatConstructor", "IntlCollatorConstructor"], "intl", "static", [["supportedLocalesOf", ["value", "options"]]]);
  const constructors: readonly (readonly [string, Meaning["owner"], readonly Parameter[]])[] = [
    ["ArrayConstructor", "array", ["rest"]], ["SetConstructor", "set", ["value"]], ["MapConstructor", "map", ["value"]],
    ["WeakSetConstructor", "weak-set", ["value"]], ["WeakMapConstructor", "weak-map", ["value"]], ["PromiseConstructor", "promise", ["callback"]],
    ["RegExpConstructor", "regexp", ["value", "options"]], ["DateConstructor", "date", ["rest"]],
    ["ErrorConstructor", "error", ["value", "options"]], ["RangeErrorConstructor", "error", ["value", "options"]],
    ["TypeErrorConstructor", "error", ["value", "options"]], ["URIErrorConstructor", "error", ["value", "options"]],
    ["ArrayBufferConstructor", "binary", ["count", "options"]], ["SharedArrayBufferConstructor", "binary", ["count", "options"]],
    ["DataViewConstructor", "binary", ["value", "index", "count"]],
    ["IntlNumberFormatConstructor", "intl", ["value", "options"]], ["IntlDateTimeFormatConstructor", "intl", ["value", "options"]], ["IntlCollatorConstructor", "intl", ["value", "options"]],
  ];
  for (const [name, owner, parameters] of constructors) define([name], owner, "static", [["constructor", parameters]]);
  const calls: readonly (readonly [string, Meaning["owner"], readonly Parameter[]])[] = [
    ["ArrayConstructor", "array", ["rest"]], ["ErrorConstructor", "error", ["value", "options"]],
    ["RangeErrorConstructor", "error", ["value", "options"]], ["TypeErrorConstructor", "error", ["value", "options"]], ["URIErrorConstructor", "error", ["value", "options"]],
    ["RegExpConstructor", "regexp", ["value", "options"]], ["SymbolConstructor", "symbol", ["value"]],
    ["BigIntConstructor", "bigint", ["value"]], ["DateConstructor", "date", []], ["StringConstructor", "string", ["value"]],
  ];
  for (const [name, owner, parameters] of calls) define([name], owner, "static", [["call", parameters]]);
  return (owner, name) => table.get(`${owner}.${name}`);
}

export const jsProfileMemberMeaning = createMemberTable();
