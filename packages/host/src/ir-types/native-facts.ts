import { encodeKey } from "../ids/index.js";
import type { NativeCarrierOf } from "./contract.js";
import type { KeyData } from "../ids/contract.js";
import type { Violation } from "../diag/contract.js";
import type { NativePrimitive } from "./data.js";
import type { CheckFailure, NativeArithmeticCarrier, NativeConversionResult, NativeFactsRule, NativeFactsSite,
  NativeFloatingFormat, NativeRounding, PlatformDeclaration, SelectedNativeFacts } from "./native-facts-data.js";

function declarationData(value: PlatformDeclaration): KeyData {
  return [value.providerId, value.providerVersion, value.providerModuleId, value.moduleSpecifier, value.exportId];
}

export function platformDeclarationKey(value: PlatformDeclaration): string { return encodeKey(declarationData(value)); }

function conversionData(value: NativeConversionResult): KeyData {
  switch (value.kind) {
    case "wrap": case "saturate": case "not-applicable": return [value.kind];
    case "constant": return [value.kind, value.value];
    case "fail": return [value.kind, value.failure];
  }
}

export function nativeFactsKey(value: SelectedNativeFacts): string {
  return encodeKey([
    value.carrierHolding.map(row => [row.carrier, row.holding]),
    value.nativeIntegerWidths.map(row => [row.carrier, row.bits]),
    value.floatingFormats.map(row => [row.carrier, row.interchange, row.nanSignObservable, row.nanPayloadObservable, row.signalingNaNObservable]),
    value.integerOverflow.map(row => [row.carrier, row.operation, row.result, row.law]),
    value.divisionByZero.map(row => [row.carrier, row.law]),
    value.remainderByZero.map(row => [row.carrier, row.law]),
    value.signedQuotientOverflow.map(row => [row.carrier, row.law]),
    value.divisionRounding.map(row => [row.carrier, row.rounding]),
    value.remainderSign.map(row => [row.carrier, row.sign]),
    value.invalidShiftCount.map(row => [row.carrier, row.law.kind, row.law.kind === "mask" ? row.law.mask : row.law.failure]),
    value.conversions.map(row => [row.from, row.to, row.rounding, conversionData(row.outOfRange),
      conversionData(row.notANumber), conversionData(row.positiveInfinity), conversionData(row.negativeInfinity)]),
    value.arrayIndexFailure, value.tupleIndexFailure, value.fixedArrayIndexFailure, value.stringIndexFailure,
    value.absentAccessFailure, value.typeTestFailure, value.allocationFailure, value.handleActivation,
    value.destinationCheck, value.byPlaceArgumentCheck, value.cleanupFailure, value.derivedFieldInitialization,
    value.constructionIdentity,
    value.geometry.layouts.map(row => [declarationData(row.declaration), row.layout.fingerprint, row.layout.byteOrder, row.layout.addressWidth]),
  ]);
}

function nativeCarrier(value: NativePrimitive): boolean {
  switch (value) {
    case "bool": case "char": case "int8": case "uint8": case "int16": case "uint16": case "int32": case "uint32":
    case "int64": case "uint64": case "int128": case "uint128": case "native-int": case "native-uint":
    case "float16": case "float32": case "float64": case "decimal": return true;
    default: return false;
  }
}

function integerCarrier(value: NativePrimitive): boolean {
  switch (value) {
    case "int8": case "uint8": case "int16": case "uint16": case "int32": case "uint32":
    case "int64": case "uint64": case "int128": case "uint128": case "native-int": case "native-uint": return true;
    default: return false;
  }
}
function floatingCarrier(value: NativePrimitive | "bigint"): boolean { return value === "float16" || value === "float32" || value === "float64"; }

export const nativeCarrierOf: NativeCarrierOf = (table, type, typeOf) => {
  const count = table.terms.length;
  let selected = type;
  let remaining = count;
  for (;;) {
    if (!Number.isSafeInteger(selected) || selected < 0 || Object.is(selected, -0) || selected >= count) {
      throw new TypeError("A native carrier requires its actual ready type domain");
    }
    if (remaining === 0) throw new TypeError("A native carrier literal-base relation must be acyclic");
    const term = typeOf(selected);
    if (term === null) return { kind: "resource-stop" };
    if (term === undefined) throw new TypeError("A native carrier requires a complete ready type row");
    remaining -= 1;
    if (term.kind === "primitive") return { kind: "primitive", type: selected, primitive: term.primitive };
    if (term.kind !== "literal") return { kind: "needs-selected-association", type: selected };
    selected = term.base;
  }
};

export function floatingFormatWidth(format: NativeFloatingFormat): 16 | 32 | 64 | null {
  switch (format.interchange) {
    case "ieee754-binary16": return 16;
    case "ieee754-binary32": return 32;
    case "ieee754-binary64": return 64;
    default: return null;
  }
}

export function floatingBitsFit(bits: bigint, format: NativeFloatingFormat): boolean {
  if (typeof bits !== "bigint" || bits < 0n) return false;
  const width = floatingFormatWidth(format);
  return width !== null && bits <= (width === 16 ? 0xffffn : width === 32 ? 0xffffffffn : 0xffffffffffffffffn);
}

function arithmeticCarrier(value: NativeArithmeticCarrier): boolean {
  return value === "bigint" || value === "decimal" || integerCarrier(value) || floatingCarrier(value);
}
function failure(value: CheckFailure): boolean { return value === "unwind" || value === "abort"; }
function rounding(value: NativeRounding): boolean {
  return value === "toward-zero" || value === "floor" || value === "ceiling" || value === "nearest-even" || value === "nearest-away";
}
function conversion(value: NativeConversionResult): boolean {
  if (value === null || value === undefined) return false;
  switch (value.kind) {
    case "wrap": case "saturate": case "not-applicable": return true;
    case "constant": return typeof value.value === "bigint";
    case "fail": return failure(value.failure);
    default: return false;
  }
}

export function verifyNativeFacts(value: SelectedNativeFacts): readonly Violation<NativeFactsRule, NativeFactsSite>[] {
  const findings: Violation<NativeFactsRule, NativeFactsSite>[] = [];
  const add = (rule: NativeFactsRule, field: string, index: number | null): void => {
    findings.push({ rule, site: { field, index }, detail: [{ kind: "text", value: field }] });
  };
  if (value === null || value === undefined) {
    add("native-fact-value", "nativeFacts", null);
    return findings;
  }
  const scalar = (valid: boolean, field: string): void => { if (!valid) add("native-fact-value", field, null); };
  const rows = <Row>(values: readonly Row[], field: string, maximum: number,
    key: (row: Row) => string, valid: (row: Row) => boolean): void => {
    if (!Array.isArray(values) || values.length > maximum) { add("native-fact-value", field, null); return; }
    const seen = new Set<string>();
    let previous: string | null = null;
    for (let index = 0; index < values.length; index += 1) {
      const row = values[index];
      if (row === null || row === undefined || !valid(row)) { add("native-fact-value", field, index); continue; }
      const current = key(row);
      if (seen.has(current)) add("native-fact-unique", field, index);
      seen.add(current);
      if (previous !== null && current < previous) add("native-fact-order", field, index);
      previous = current;
    }
  };
  rows(value.carrierHolding, "carrierHolding", 18, row => row.carrier,
    row => nativeCarrier(row.carrier) && (row.holding === "in-place" || row.holding === "by-reference"));
  rows(value.nativeIntegerWidths, "nativeIntegerWidths", 2, row => row.carrier,
    row => (row.carrier === "native-int" || row.carrier === "native-uint") && Number.isSafeInteger(row.bits) && row.bits > 0);
  rows(value.floatingFormats, "floatingFormats", 3, row => row.carrier,
    row => floatingCarrier(row.carrier)
      && (row.interchange === "ieee754-binary16" || row.interchange === "ieee754-binary32" || row.interchange === "ieee754-binary64")
      && typeof row.nanSignObservable === "boolean" && typeof row.nanPayloadObservable === "boolean"
      && typeof row.signalingNaNObservable === "boolean");
  rows(value.integerOverflow, "integerOverflow", 84, row => encodeKey([row.carrier, row.operation]), row => {
    const operation = row.operation;
    return integerCarrier(row.carrier) && integerCarrier(row.result) && (row.law === "wrap" || failure(row.law))
      && (operation === "add" || operation === "subtract" || operation === "multiply" || operation === "negate"
        || operation === "increment" || operation === "decrement" || operation === "left-shift");
  });
  rows(value.divisionByZero, "divisionByZero", 17, row => row.carrier,
    row => arithmeticCarrier(row.carrier) && (row.law === "ieee754" ? floatingCarrier(row.carrier) : failure(row.law)));
  rows(value.remainderByZero, "remainderByZero", 17, row => row.carrier,
    row => arithmeticCarrier(row.carrier) && (row.law === "ieee754" ? floatingCarrier(row.carrier) : failure(row.law)));
  rows(value.signedQuotientOverflow, "signedQuotientOverflow", 6, row => row.carrier,
    row => (row.carrier === "int8" || row.carrier === "int16" || row.carrier === "int32" || row.carrier === "int64"
      || row.carrier === "int128" || row.carrier === "native-int") && (row.law === "wrap" || failure(row.law)));
  rows(value.divisionRounding, "divisionRounding", 17, row => row.carrier,
    row => arithmeticCarrier(row.carrier) && rounding(row.rounding));
  rows(value.remainderSign, "remainderSign", 17, row => row.carrier,
    row => arithmeticCarrier(row.carrier) && (row.sign === "dividend" || row.sign === "divisor" || row.sign === "nonnegative"));
  rows(value.invalidShiftCount, "invalidShiftCount", 12, row => row.carrier,
    row => integerCarrier(row.carrier) && row.law !== null && row.law !== undefined
      && (row.law.kind === "mask" ? typeof row.law.mask === "bigint" && row.law.mask >= 0n : row.law.kind === "fail" && failure(row.law.failure)));
  rows(value.conversions, "conversions", 221, row => encodeKey([row.from, row.to]),
    row => arithmeticCarrier(row.from) && (row.to === "bigint" || integerCarrier(row.to)) && rounding(row.rounding) && conversion(row.outOfRange)
      && conversion(row.notANumber) && conversion(row.positiveInfinity) && conversion(row.negativeInfinity));
  scalar(failure(value.arrayIndexFailure), "arrayIndexFailure");
  scalar(failure(value.tupleIndexFailure), "tupleIndexFailure");
  scalar(failure(value.fixedArrayIndexFailure), "fixedArrayIndexFailure");
  scalar(failure(value.stringIndexFailure), "stringIndexFailure");
  scalar(failure(value.absentAccessFailure), "absentAccessFailure");
  scalar(failure(value.typeTestFailure), "typeTestFailure");
  scalar(value.allocationFailure === "observable" || value.allocationFailure === "abort", "allocationFailure");
  scalar(value.handleActivation === "at-creation" || value.handleActivation === "when-first-driven", "handleActivation");
  scalar(value.destinationCheck === "before-value" || value.destinationCheck === "after-value", "destinationCheck");
  scalar(value.byPlaceArgumentCheck === "before-later-arguments" || value.byPlaceArgumentCheck === "after-later-arguments", "byPlaceArgumentCheck");
  scalar(value.cleanupFailure === "replace-pending" || value.cleanupFailure === "preserve-pending", "cleanupFailure");
  scalar(value.derivedFieldInitialization === "before-base" || value.derivedFieldInitialization === "after-base", "derivedFieldInitialization");
  scalar(value.constructionIdentity === "available" || value.constructionIdentity === "unavailable", "constructionIdentity");
  if (value.geometry === null || value.geometry === undefined || !Array.isArray(value.geometry.layouts)) {
    add("native-fact-value", "geometry", null);
    return findings;
  }
  rows(value.geometry.layouts, "geometry.layouts", Number.MAX_SAFE_INTEGER, row => platformDeclarationKey(row.declaration), row => {
    const declaration = row.declaration, layout = row.layout;
    return declaration !== null && declaration !== undefined && layout !== null && layout !== undefined
      && typeof declaration.providerId === "string" && declaration.providerId.length !== 0
      && typeof declaration.providerVersion === "string" && declaration.providerVersion.length !== 0
      && typeof declaration.providerModuleId === "string" && declaration.providerModuleId.length !== 0
      && typeof declaration.moduleSpecifier === "string" && declaration.moduleSpecifier.length !== 0
      && typeof declaration.exportId === "string" && declaration.exportId.length !== 0
      && typeof layout.fingerprint === "string" && layout.fingerprint.length !== 0
      && (layout.byteOrder === "little" || layout.byteOrder === "big") && (layout.addressWidth === 32 || layout.addressWidth === 64);
  });
  return findings;
}
