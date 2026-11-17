import type { NativeBinaryFloatPrimitive, NativeIntegerPrimitive, NativePrimitive, NativeSignedIntegerPrimitive } from "./data.js";

export type CheckFailure = "unwind" | "abort";
export type ReceiverAccess = "in-place" | "by-reference";
export type HandleActivation = "at-creation" | "when-first-driven";

export interface PlatformDeclaration {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerModuleId: string;
  readonly moduleSpecifier: string;
  readonly exportId: string;
}

export interface PlatformLayout {
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}

export interface PlatformLayoutRegistration {
  readonly declaration: PlatformDeclaration;
  readonly layout: PlatformLayout;
}

export interface PlatformFacts {
  readonly layouts: readonly PlatformLayoutRegistration[];
}

export type NativeArithmeticCarrier = NativeIntegerPrimitive | NativeBinaryFloatPrimitive | "decimal" | "bigint";
export type NativeIntegerOperation = "add" | "subtract" | "multiply" | "negate" | "increment" | "decrement" | "left-shift";
export type NativeOverflowLaw = "wrap" | CheckFailure;
export type NativeZeroLaw = "ieee754" | CheckFailure;
export type NativeRounding = "toward-zero" | "floor" | "ceiling" | "nearest-even" | "nearest-away";
export type NativeConversionResult =
  | { readonly kind: "wrap" | "saturate" | "not-applicable" }
  | { readonly kind: "constant"; readonly value: bigint }
  | { readonly kind: "fail"; readonly failure: CheckFailure };

export interface NativeCarrierHolding {
  readonly carrier: NativePrimitive;
  readonly holding: ReceiverAccess;
}

export interface NativeIntegerWidth {
  readonly carrier: "native-int" | "native-uint";
  readonly bits: number;
}

export type NativeFloatingInterchange = "ieee754-binary16" | "ieee754-binary32" | "ieee754-binary64";

export interface NativeFloatingFormat {
  readonly carrier: NativeBinaryFloatPrimitive;
  readonly interchange: NativeFloatingInterchange;
  readonly nanSignObservable: boolean;
  readonly nanPayloadObservable: boolean;
  readonly signalingNaNObservable: boolean;
}

export interface NativeOverflow {
  readonly carrier: NativeIntegerPrimitive;
  readonly operation: NativeIntegerOperation;
  readonly result: NativeIntegerPrimitive;
  readonly law: NativeOverflowLaw;
}

export type NativeZeroBehavior =
  | { readonly carrier: NativeBinaryFloatPrimitive; readonly law: NativeZeroLaw }
  | { readonly carrier: NativeIntegerPrimitive | "decimal" | "bigint"; readonly law: CheckFailure };

export interface NativeQuotientOverflow {
  readonly carrier: NativeSignedIntegerPrimitive;
  readonly law: NativeOverflowLaw;
}

export interface NativeDivisionRounding {
  readonly carrier: NativeArithmeticCarrier;
  readonly rounding: NativeRounding;
}

export interface NativeRemainderSign {
  readonly carrier: NativeArithmeticCarrier;
  readonly sign: "dividend" | "divisor" | "nonnegative";
}

export interface NativeShiftCount {
  readonly carrier: NativeIntegerPrimitive;
  readonly law:
    | { readonly kind: "mask"; readonly mask: bigint }
    | { readonly kind: "fail"; readonly failure: CheckFailure };
}

export interface NativeConversion {
  readonly from: NativeArithmeticCarrier;
  readonly to: NativeIntegerPrimitive | "bigint";
  readonly rounding: NativeRounding;
  readonly outOfRange: NativeConversionResult;
  readonly notANumber: NativeConversionResult;
  readonly positiveInfinity: NativeConversionResult;
  readonly negativeInfinity: NativeConversionResult;
}

export interface SelectedNativeFacts {
  readonly carrierHolding: readonly NativeCarrierHolding[];
  readonly nativeIntegerWidths: readonly NativeIntegerWidth[];
  readonly floatingFormats: readonly NativeFloatingFormat[];
  readonly integerOverflow: readonly NativeOverflow[];
  readonly divisionByZero: readonly NativeZeroBehavior[];
  readonly remainderByZero: readonly NativeZeroBehavior[];
  readonly signedQuotientOverflow: readonly NativeQuotientOverflow[];
  readonly divisionRounding: readonly NativeDivisionRounding[];
  readonly remainderSign: readonly NativeRemainderSign[];
  readonly invalidShiftCount: readonly NativeShiftCount[];
  readonly conversions: readonly NativeConversion[];
  readonly arrayIndexFailure: CheckFailure;
  readonly tupleIndexFailure: CheckFailure;
  readonly fixedArrayIndexFailure: CheckFailure;
  readonly stringIndexFailure: CheckFailure;
  readonly absentAccessFailure: CheckFailure;
  readonly typeTestFailure: CheckFailure;
  readonly allocationFailure: "observable" | "abort";
  readonly handleActivation: HandleActivation;
  readonly destinationCheck: "before-value" | "after-value";
  readonly byPlaceArgumentCheck: "before-later-arguments" | "after-later-arguments";
  readonly cleanupFailure: "replace-pending" | "preserve-pending";
  readonly derivedFieldInitialization: "before-base" | "after-base";
  readonly constructionIdentity: "available" | "unavailable";
  readonly geometry: PlatformFacts;
}

export type NativeFactsRule = "native-fact-value" | "native-fact-order" | "native-fact-unique";
export interface NativeFactsSite {
  readonly field: string;
  readonly index: number | null;
}
