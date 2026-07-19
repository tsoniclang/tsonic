import type { CheckedCallMappingRequest, CheckedConversionMappingRequest, CheckedElementAccessMappingRequest, CheckedIterationMappingRequest, CheckedOperationObservationPointName, CheckedOperatorMappingRequest, CheckedPropertyAccessMappingRequest, ExtensionObservationRequest } from "./observations.js";
import type { CheckedAssertionConversionSourceOperation, CheckedCallArgumentConversionSourceOperation, CheckedCallSourceOperation, CheckedElementAccessSourceOperation, CheckedIterationSourceOperation, CheckedOperatorSourceOperation, CheckedPropertyAccessSourceOperation } from "./facts.js";
type ExactEnvelopeFields<TRequest, TSource, TFields extends PropertyKey> = Exclude<keyof TRequest, keyof TSource> extends TFields ? Exclude<TFields, Exclude<keyof TRequest, keyof TSource>> extends never ? true : false : false;
type RequireAllTrue<T extends readonly true[]> = T;
type AssertionConversionRequest = Extract<CheckedConversionMappingRequest, {
    readonly conversionKind: "assertion";
}>;
type CallArgumentConversionRequest = Extract<CheckedConversionMappingRequest, {
    readonly conversionKind: "call-argument";
}>;
export type CheckedOperationRequestFieldCoverage = RequireAllTrue<[
    ExactEnvelopeFields<CheckedCallMappingRequest, CheckedCallSourceOperation, "target">,
    ExactEnvelopeFields<CheckedPropertyAccessMappingRequest, CheckedPropertyAccessSourceOperation, "target">,
    ExactEnvelopeFields<CheckedElementAccessMappingRequest, CheckedElementAccessSourceOperation, "target">,
    ExactEnvelopeFields<CheckedOperatorMappingRequest, CheckedOperatorSourceOperation, "target">,
    ExactEnvelopeFields<CheckedIterationMappingRequest, CheckedIterationSourceOperation, "target">,
    ExactEnvelopeFields<AssertionConversionRequest, CheckedAssertionConversionSourceOperation, "targetPlatform" | "targetParameter" | "selectedSignature">,
    ExactEnvelopeFields<CallArgumentConversionRequest, CheckedCallArgumentConversionSourceOperation, "targetPlatform" | "target" | "targetParameter" | "selectedSignature">
]>;
export declare function checkedOperationRequestEquals<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, left: ExtensionObservationRequest<TObservation>, right: ExtensionObservationRequest<TObservation>): boolean;
export declare function differingCheckedOperationRequestFields<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, left: ExtensionObservationRequest<TObservation>, right: ExtensionObservationRequest<TObservation>): readonly string[];
export {};
//# sourceMappingURL=checked-operation-request-equality.d.ts.map