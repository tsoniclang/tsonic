// Meaning rows of the JS API meaning table (api/table.ts, D18): receiver mutation, parameter roles, result kind and
// effects of JS standard-library members. This is the Source half of the tsonic-csharp policy/operations/source-profiles/js
// tables; a target keeps only its own names, types and ABI, keyed by the JS API identity (declaringName + name).
// Row data only; every lookup goes through the one table.
// A parameter role holds for every overload of the member: a parameter that is a callback in one overload only
// (`replace(search, replacer)` beside `replace(search, replaceValue: string)`) is a "value".
import type { SourceJsApiMember } from "@tsonic/target-api/source";

type Owner = SourceJsApiMember["owner"];
type Parameter = SourceJsApiMember["parameters"][number];
type Result = SourceJsApiMember["result"];

export interface JsSourceApiMemberMeaning {
  readonly owner: Owner;
  readonly receiver: SourceJsApiMember["receiver"];
  readonly parameters: readonly Parameter[];
  readonly result: Result;
  readonly effects: SourceJsApiMember["effects"];
}

type Row = readonly [name: string, parameters: readonly Parameter[], result: Result, flags?: "callback" | "stores" | "callback-stores"];

const table = new Map<string, JsSourceApiMemberMeaning>();
/** Meaning rows keyed `declaringName.name`; a construct signature is `declaringName.constructor`, a call signature `declaringName.call`. */
export const jsSourceApiMeaningRows: ReadonlyMap<string, JsSourceApiMemberMeaning> = table;

function define(declaringNames: readonly string[], owner: Owner, receiver: SourceJsApiMember["receiver"], rows: readonly Row[]): void {
  for (const declaringName of declaringNames) {
    for (const [name, parameters, result, flags] of rows) {
      const key = `${declaringName}.${name}`;
      if (table.has(key)) throw new Error(`The JS API member '${key}' has more than one meaning.`);
      table.set(key, Object.freeze({
        owner, receiver, parameters: Object.freeze([...parameters]), result,
        effects: Object.freeze({
          invokesCallbacks: flags === "callback" || flags === "callback-stores",
          storesArguments: flags === "stores" || flags === "callback-stores",
        }),
      }));
    }
  }
}

// Arrays. ReadonlyArray carries the non-mutating view; Array adds the mutating members.
const arrayReadRows: readonly Row[] = [
  ["length", [], "number"],
  ["at", ["index"], "element"],
  ["concat", ["rest"], "new-collection", "stores"],
  ["join", ["value"], "string"],
  ["slice", ["index", "index"], "new-collection"],
  ["indexOf", ["value", "index"], "number"],
  ["lastIndexOf", ["value", "index"], "number"],
  ["includes", ["value", "index"], "boolean"],
  ["find", ["callback"], "element", "callback"],
  ["findIndex", ["callback"], "number", "callback"],
  ["findLast", ["callback"], "element", "callback"],
  ["findLastIndex", ["callback"], "number", "callback"],
  ["filter", ["callback"], "new-collection", "callback"],
  ["map", ["callback"], "new-collection", "callback"],
  ["flatMap", ["callback"], "new-collection", "callback"],
  ["flat", ["count"], "new-collection"],
  ["forEach", ["callback"], "void", "callback"],
  ["some", ["callback"], "boolean", "callback"],
  ["every", ["callback"], "boolean", "callback"],
  ["reduce", ["callback", "value"], "value", "callback"],
  ["reduceRight", ["callback", "value"], "value", "callback"],
  ["keys", [], "iterator"],
  ["values", [], "iterator"],
  ["entries", [], "iterator"],
  ["Symbol.iterator", [], "iterator"],
  ["toString", [], "string"],
  ["toLocaleString", ["options"], "string"],
  ["toReversed", [], "new-collection"],
  ["toSorted", ["callback"], "new-collection", "callback"],
  ["toSpliced", ["index", "count", "rest"], "new-collection", "stores"],
  ["with", ["index", "value"], "new-collection", "stores"],
];
const arrayWriteRows: readonly Row[] = [
  ["push", ["rest"], "number", "stores"],
  ["pop", [], "element"],
  ["shift", [], "element"],
  ["unshift", ["rest"], "number", "stores"],
  ["splice", ["index", "count", "rest"], "new-collection", "stores"],
  ["sort", ["callback"], "receiver", "callback"],
  ["reverse", [], "receiver"],
  ["fill", ["value", "index", "index"], "receiver", "stores"],
  ["copyWithin", ["index", "index", "index"], "receiver"],
];
define(["ReadonlyArray"], "readonly-array", "readonly", arrayReadRows);
define(["Array"], "array", "readonly", arrayReadRows.filter(([name]) => name !== "length"));
define(["Array"], "array", "mutating", [["length", [], "number"], ...arrayWriteRows]);
define(["ArrayConstructor"], "array", "static", [
  ["isArray", ["value"], "boolean"],
  ["from", ["value", "callback"], "new-collection", "callback-stores"],
  ["of", ["rest"], "new-collection", "stores"],
]);

// Typed arrays: one shared member declaration set (TypedArray<TArray, TElement>).
define(["TypedArray"], "typed-array", "readonly", [
  ["length", [], "number"],
  ["BYTES_PER_ELEMENT", [], "number"],
  ["at", ["index"], "element"],
  ["includes", ["value", "index"], "boolean"],
  ["indexOf", ["value", "index"], "number"],
  ["join", ["value"], "string"],
  ["slice", ["index", "index"], "new-collection"],
  ["subarray", ["index", "index"], "value"],
]);
define(["TypedArray"], "typed-array", "mutating", [
  ["fill", ["value", "index", "index"], "receiver"],
  ["reverse", [], "receiver"],
  ["set", ["value", "index"], "void"],
  ["sort", ["callback"], "receiver", "callback"],
]);

// Set / Map and their readonly views.
const setReadRows: readonly Row[] = [
  ["size", [], "number"],
  ["has", ["value"], "boolean"],
  ["keys", [], "iterator"],
  ["values", [], "iterator"],
  ["entries", [], "iterator"],
  ["Symbol.iterator", [], "iterator"],
  ["forEach", ["callback"], "void", "callback"],
  ["union", ["value"], "new-collection"],
  ["intersection", ["value"], "new-collection"],
  ["difference", ["value"], "new-collection"],
  ["symmetricDifference", ["value"], "new-collection"],
  ["isSubsetOf", ["value"], "boolean"],
  ["isSupersetOf", ["value"], "boolean"],
  ["isDisjointFrom", ["value"], "boolean"],
];
define(["Set", "ReadonlySet"], "set", "readonly", setReadRows);
define(["Set"], "set", "mutating", [
  ["add", ["value"], "receiver", "stores"],
  ["delete", ["value"], "boolean"],
  ["clear", [], "void"],
]);
const mapReadRows: readonly Row[] = [
  ["size", [], "number"],
  ["get", ["key"], "value"],
  ["has", ["key"], "boolean"],
  ["keys", [], "iterator"],
  ["values", [], "iterator"],
  ["entries", [], "iterator"],
  ["Symbol.iterator", [], "iterator"],
  ["forEach", ["callback"], "void", "callback"],
];
define(["Map", "ReadonlyMap"], "map", "readonly", mapReadRows);
define(["Map"], "map", "mutating", [
  ["set", ["key", "value"], "receiver", "stores"],
  ["delete", ["key"], "boolean"],
  ["clear", [], "void"],
]);
define(["WeakSet"], "weak-set", "readonly", [["has", ["value"], "boolean"]]);
define(["WeakSet"], "weak-set", "mutating", [["add", ["value"], "receiver", "stores"], ["delete", ["value"], "boolean"]]);
define(["WeakMap"], "weak-map", "readonly", [["get", ["key"], "value"], ["has", ["key"], "boolean"]]);
define(["WeakMap"], "weak-map", "mutating", [["set", ["key", "value"], "receiver", "stores"], ["delete", ["key"], "boolean"]]);

// Strings (immutable receiver).
define(["String"], "string", "readonly", [
  ["length", [], "number"],
  ["at", ["index"], "string"],
  ["charAt", ["index"], "string"],
  ["charCodeAt", ["index"], "number"],
  ["codePointAt", ["index"], "number"],
  ["concat", ["rest"], "string"],
  ["endsWith", ["value", "index"], "boolean"],
  ["startsWith", ["value", "index"], "boolean"],
  ["includes", ["value", "index"], "boolean"],
  ["indexOf", ["value", "index"], "number"],
  ["lastIndexOf", ["value", "index"], "number"],
  ["localeCompare", ["value", "options"], "number"],
  ["match", ["value"], "value"],
  ["matchAll", ["value"], "iterator"],
  ["normalize", ["value"], "string"],
  ["padEnd", ["count", "value"], "string"],
  ["padStart", ["count", "value"], "string"],
  ["repeat", ["count"], "string"],
  ["replace", ["value", "value"], "string"],
  ["replaceAll", ["value", "value"], "string"],
  ["search", ["value"], "number"],
  ["slice", ["index", "index"], "string"],
  ["split", ["value", "count"], "new-collection"],
  ["substring", ["index", "index"], "string"],
  ["substr", ["index", "count"], "string"],
  ["toLowerCase", [], "string"],
  ["toUpperCase", [], "string"],
  ["toLocaleLowerCase", ["options"], "string"],
  ["toLocaleUpperCase", ["options"], "string"],
  ["trim", [], "string"],
  ["trimStart", [], "string"],
  ["trimEnd", [], "string"],
  ["trimLeft", [], "string"],
  ["trimRight", [], "string"],
  ["isWellFormed", [], "boolean"],
  ["toWellFormed", [], "string"],
  ["toString", [], "string"],
  ["valueOf", [], "string"],
  ["Symbol.iterator", [], "iterator"],
]);
define(["StringConstructor"], "string", "static", [
  ["fromCharCode", ["rest"], "string"],
  ["fromCodePoint", ["rest"], "string"],
  ["raw", ["value", "rest"], "string"],
]);

// Promises.
define(["Promise"], "promise", "readonly", [
  ["then", ["callback", "callback"], "value", "callback"],
  ["catch", ["callback"], "value", "callback"],
  ["finally", ["callback"], "value", "callback"],
]);
define(["PromiseConstructor"], "promise", "static", [
  ["resolve", ["value"], "value", "stores"],
  ["reject", ["value"], "value", "stores"],
  ["all", ["value"], "value"],
  ["allSettled", ["value"], "value"],
  ["any", ["value"], "value"],
  ["race", ["value"], "value"],
  ["withResolvers", [], "value"],
]);

// RegExp.
define(["RegExp"], "regexp", "readonly", [
  ["test", ["value"], "boolean"],
  ["source", [], "string"],
  ["flags", [], "string"],
  ["global", [], "boolean"],
  ["ignoreCase", [], "boolean"],
  ["multiline", [], "boolean"],
  ["sticky", [], "boolean"],
  ["unicode", [], "boolean"],
  ["unicodeSets", [], "boolean"],
  ["dotAll", [], "boolean"],
  ["hasIndices", [], "boolean"],
  ["toString", [], "string"],
]);
define(["RegExp"], "regexp", "mutating", [
  ["exec", ["value"], "value"],
  ["lastIndex", [], "number"],
]);

// Numbers, Math, JSON.
define(["Number"], "number", "readonly", [
  ["toFixed", ["count"], "string"],
  ["toPrecision", ["count"], "string"],
  ["toExponential", ["count"], "string"],
  ["toString", ["count"], "string"],
  ["toLocaleString", ["value", "options"], "string"],
  ["valueOf", [], "number"],
]);
define(["NumberConstructor"], "number", "static", [
  ["isFinite", ["value"], "boolean"],
  ["isInteger", ["value"], "boolean"],
  ["isNaN", ["value"], "boolean"],
  ["isSafeInteger", ["value"], "boolean"],
  ["parseFloat", ["value"], "number"],
  ["parseInt", ["value", "count"], "number"],
  ...["MAX_SAFE_INTEGER", "MIN_SAFE_INTEGER", "MAX_VALUE", "MIN_VALUE", "EPSILON", "NaN", "POSITIVE_INFINITY",
    "NEGATIVE_INFINITY"].map((name): Row => [name, [], "number"]),
]);
define(["Math"], "math", "static", [
  ...["abs", "ceil", "floor", "round", "trunc", "sign", "sqrt", "cbrt", "exp", "expm1", "log", "log1p", "log2", "log10",
    "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "fround", "clz32"]
    .map((name): Row => [name, ["value"], "number"]),
  ...["atan2", "pow", "imul"].map((name): Row => [name, ["value", "value"], "number"]),
  ...["max", "min", "hypot"].map((name): Row => [name, ["rest"], "number"]),
  ["random", [], "number"],
  ...["E", "LN10", "LN2", "LOG10E", "LOG2E", "PI", "SQRT1_2", "SQRT2"].map((name): Row => [name, [], "number"]),
]);
define(["JSON"], "json", "static", [
  ["parse", ["value", "callback"], "value", "callback"],
  ["stringify", ["value", "value", "value"], "string"],
]);

// Object statics.
define(["ObjectConstructor"], "object", "static", [
  ["keys", ["value"], "new-collection"],
  ["values", ["value"], "new-collection"],
  ["entries", ["value"], "new-collection"],
  ["fromEntries", ["value"], "value", "stores"],
  ["getOwnPropertyNames", ["value"], "new-collection"],
  ["assign", ["value", "rest"], "value", "stores"],
  ["freeze", ["value"], "value"],
  ["isFrozen", ["value"], "boolean"],
  ["hasOwn", ["value", "key"], "boolean"],
  ["is", ["value", "value"], "boolean"],
  ["create", ["value"], "value"],
]);

// Global functions.
define(["Global"], "global", "static", [
  ["parseInt", ["value", "count"], "number"],
  ["parseFloat", ["value"], "number"],
  ["isNaN", ["value"], "boolean"],
  ["isFinite", ["value"], "boolean"],
  ["encodeURIComponent", ["value"], "string"],
  ["decodeURIComponent", ["value"], "string"],
  ["encodeURI", ["value"], "string"],
  ["decodeURI", ["value"], "string"],
  ["queueMicrotask", ["callback"], "void", "callback"],
  ["structuredClone", ["value", "options"], "value"],
]);

// Date.
define(["Date"], "date", "readonly", [
  ...["getTime", "valueOf", "getFullYear", "getMonth", "getDate", "getDay", "getHours", "getMinutes", "getSeconds",
    "getMilliseconds", "getUTCFullYear", "getUTCMonth", "getUTCDate", "getUTCDay", "getUTCHours", "getUTCMinutes",
    "getUTCSeconds", "getUTCMilliseconds", "getTimezoneOffset"].map((name): Row => [name, [], "number"]),
  ...["toISOString", "toJSON", "toString", "toDateString", "toTimeString", "toUTCString"]
    .map((name): Row => [name, [], "string"]),
  ...["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].map((name): Row => [name, ["value", "options"], "string"]),
]);
define(["Date"], "date", "mutating", [
  ...["setTime", "setFullYear", "setMonth", "setDate", "setHours", "setMinutes", "setSeconds", "setMilliseconds",
    "setUTCFullYear", "setUTCMonth", "setUTCDate", "setUTCHours", "setUTCMinutes", "setUTCSeconds", "setUTCMilliseconds"]
    .map((name): Row => [name, ["rest"], "number"]),
]);
define(["DateConstructor"], "date", "static", [
  ["now", [], "number"],
  ["parse", ["value"], "number"],
  ["UTC", ["rest"], "number"],
]);

// Symbol.
define(["Symbol"], "symbol", "readonly", [
  ["description", [], "value"],
  ["toString", [], "string"],
  ["valueOf", [], "value"],
]);
define(["SymbolConstructor"], "symbol", "static", [
  ["for", ["key"], "value"],
  ["keyFor", ["value"], "value"],
]);

// BigInt.
define(["BigInt"], "bigint", "readonly", [
  ["toString", ["count"], "string"],
  ["toLocaleString", ["value", "options"], "string"],
  ["valueOf", [], "value"],
]);
define(["BigIntConstructor"], "bigint", "static", [
  ["asIntN", ["count", "value"], "value"],
  ["asUintN", ["count", "value"], "value"],
]);

// Error.
define(["Error"], "error", "readonly", [
  ["name", [], "string"],
  ["message", [], "string"],
  ["stack", [], "value"],
  ["cause", [], "value"],
  ["toString", [], "string"],
]);
define(["ErrorConstructor"], "error", "static", [
  ["captureStackTrace", ["value", "value"], "void"],
]);

// Binary data: ArrayBuffer, SharedArrayBuffer, DataView.
define(["ArrayBuffer", "SharedArrayBuffer"], "binary", "readonly", [
  ["byteLength", [], "number"],
  ["slice", ["index", "index"], "new-collection"],
]);
define(["ArrayBufferConstructor"], "binary", "static", [
  ["isView", ["value"], "boolean"],
]);
define(["DataView"], "binary", "readonly", [
  ["buffer", [], "value"],
  ["byteLength", [], "number"],
  ["byteOffset", [], "number"],
  ...["getInt8", "getUint8", "getInt16", "getUint16", "getInt32", "getUint32", "getFloat32", "getFloat64"]
    .map((name): Row => [name, ["index", "value"], "number"]),
  ...["getBigInt64", "getBigUint64"].map((name): Row => [name, ["index", "value"], "value"]),
]);
define(["DataView"], "binary", "mutating", [
  ...["setInt8", "setUint8", "setInt16", "setUint16", "setInt32", "setUint32", "setFloat32", "setFloat64",
    "setBigInt64", "setBigUint64"].map((name): Row => [name, ["index", "value", "value"], "void"]),
]);

// Intl.
define(["IntlNumberFormat"], "intl", "readonly", [
  ["format", ["value"], "string"],
  ["formatToParts", ["value"], "new-collection"],
  ["resolvedOptions", [], "value"],
]);
define(["IntlDateTimeFormat"], "intl", "readonly", [
  ["format", ["value"], "string"],
  ["formatToParts", ["value"], "new-collection"],
  ["resolvedOptions", [], "value"],
]);
define(["IntlCollator"], "intl", "readonly", [
  ["compare", ["value", "value"], "number"],
  ["resolvedOptions", [], "value"],
]);
define(["IntlNumberFormatConstructor", "IntlDateTimeFormatConstructor", "IntlCollatorConstructor"], "intl", "static", [
  ["supportedLocalesOf", ["value", "options"], "new-collection"],
]);

// Construction and call signatures of constructor interfaces (`new Map(entries)`, `Array(n)`).
const constructions: readonly (readonly [declaringName: string, owner: Owner, parameters: readonly Parameter[],
  flags?: "callback" | "stores"])[] = [
  ["ArrayConstructor", "array", ["rest"], "stores"],
  ["SetConstructor", "set", ["value"], "stores"],
  ["MapConstructor", "map", ["value"], "stores"],
  ["WeakSetConstructor", "weak-set", ["value"], "stores"],
  ["WeakMapConstructor", "weak-map", ["value"], "stores"],
  ["PromiseConstructor", "promise", ["callback"], "callback"],
  ["RegExpConstructor", "regexp", ["value", "options"]],
  ["DateConstructor", "date", ["rest"]],
  ["SymbolConstructor", "symbol", ["value"]],
  ["BigIntConstructor", "bigint", ["value"]],
  ["ErrorConstructor", "error", ["value", "options"]],
  ["ArrayBufferConstructor", "binary", ["count", "options"]],
  ["SharedArrayBufferConstructor", "binary", ["count", "options"]],
  ["DataViewConstructor", "binary", ["value", "index", "count"]],
  ["IntlNumberFormatConstructor", "intl", ["value", "options"]],
  ["IntlDateTimeFormatConstructor", "intl", ["value", "options"]],
  ["IntlCollatorConstructor", "intl", ["value", "options"]],
];
for (const [declaringName, owner, parameters, flags] of constructions) {
  table.set(`${declaringName}.constructor`, Object.freeze({
    owner, receiver: "static" as const, parameters: Object.freeze([...parameters]),
    // Collections construct a new collection; every other owner constructs one value (a promise, date, symbol, bigint,
    // error, buffer, view or formatter).
    result: owner === "array" || owner === "set" || owner === "map" || owner === "weak-set" || owner === "weak-map"
      ? "new-collection" as const : "value" as const,
    effects: Object.freeze({ invokesCallbacks: flags === "callback", storesArguments: flags === "stores" }),
  }));
}

// Call signatures of constructor interfaces (`Array(n)`, `Error("m")`, `String(x)`, `Date()`).
const calls: readonly (readonly [declaringName: string, owner: Owner, parameters: readonly Parameter[], result: Result,
  flags?: "stores"])[] = [
  ["ArrayConstructor", "array", ["rest"], "new-collection", "stores"],
  ["ErrorConstructor", "error", ["value", "options"], "value"],
  ["RegExpConstructor", "regexp", ["value", "options"], "value"],
  ["SymbolConstructor", "symbol", ["value"], "value"],
  ["BigIntConstructor", "bigint", ["value"], "value"],
  ["DateConstructor", "date", [], "string"],
  ["StringConstructor", "string", ["value"], "string"],
];
for (const [declaringName, owner, parameters, result, flags] of calls) {
  table.set(`${declaringName}.call`, Object.freeze({
    owner, receiver: "static" as const, parameters: Object.freeze([...parameters]), result,
    effects: Object.freeze({ invokesCallbacks: false, storesArguments: flags === "stores" }),
  }));
}
