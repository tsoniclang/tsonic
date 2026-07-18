import type { CheckedCallMappingRequest, CheckedConversionMappingRequest, CheckedElementAccessMappingRequest, CheckedIterationMappingRequest, CheckedOperationObservationPointName, CheckedOperatorMappingRequest, CheckedPropertyAccessMappingRequest, ExtensionObservationRequest } from "./observations.js";
type AllFieldsCompared<T, TCompared extends keyof T> = Exclude<keyof T, TCompared> extends never ? true : false;
type RequireAllTrue<T extends readonly true[]> = T;
type CallField = "call" | "callee" | "arguments" | "callKind" | "sourceSelectedSignature" | "sourceSelectedDeclaration" | "sourceSelectedMethodTypeArguments" | "sourceSelectedSignatureParameters" | "sourceSelectedSignatureKind" | "sourceArgumentBindings" | "sourceCallee" | "sourceArguments" | "sourceResult" | "sourceReceiver" | "optionalChain" | "target";
type PropertyField = "expression" | "receiver" | "propertyName" | "accessMode" | "callCallee" | "sourceReceiver" | "sourceResult" | "optionalChain" | "target";
type ElementField = "expression" | "receiver" | "argument" | "accessMode" | "callCallee" | "sourceReceiver" | "sourceArgument" | "sourceResult" | "sourceSelectedElementIndex" | "optionalChain" | "target";
type OperatorField = "expression" | "operator" | "left" | "right" | "sourceLeft" | "sourceRight" | "sourceResult" | "target";
type IterationField = "statement" | "expression" | "initializer" | "kind" | "sourceIterable" | "sourceElement" | "target";
type ConversionField = "conversionKind" | "expression" | "source" | "target" | "targetPlatform" | "call" | "slot" | "sourceArgumentIndex" | "targetParameterIndex" | "sourceForm" | "spreadElementIndex" | "targetForm" | "targetParameter" | "sourceSelectedSignature" | "selectedSignature" | "sourceBinding" | "assertionKind" | "explicitTargetTypeNode";
export type CheckedOperationRequestFieldCoverage = RequireAllTrue<[
    AllFieldsCompared<CheckedCallMappingRequest, CallField>,
    AllFieldsCompared<CheckedPropertyAccessMappingRequest, PropertyField>,
    AllFieldsCompared<CheckedElementAccessMappingRequest, ElementField>,
    AllFieldsCompared<CheckedOperatorMappingRequest, OperatorField>,
    AllFieldsCompared<CheckedIterationMappingRequest, IterationField>,
    AllFieldsCompared<CheckedConversionMappingRequest, ConversionField>
]>;
export declare function checkedOperationRequestEquals<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, left: ExtensionObservationRequest<TObservation>, right: ExtensionObservationRequest<TObservation>): boolean;
export declare function differingCheckedOperationRequestFields<TObservation extends CheckedOperationObservationPointName>(observation: TObservation, left: ExtensionObservationRequest<TObservation>, right: ExtensionObservationRequest<TObservation>): readonly string[];
export {};
//# sourceMappingURL=checked-operation-request-equality.d.ts.map