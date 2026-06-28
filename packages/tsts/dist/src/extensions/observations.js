export const ExtensionObservationPoint = {
    validateTargetConstraint: "target.validateConstraint",
    observePostCheckAssignability: "target.observePostCheckAssignability",
    mapCheckedCall: "operation.mapCheckedCall",
    mapInferredSourceTypeArgumentsToTarget: "operation.mapInferredSourceTypeArgumentsToTarget",
    mapCheckedPropertyAccess: "operation.mapCheckedPropertyAccess",
    mapCheckedElementAccess: "operation.mapCheckedElementAccess",
    mapCheckedOperator: "operation.mapCheckedOperator",
    mapCheckedIteration: "operation.mapCheckedIteration",
    recordContextualTargetType: "type.recordContextualTargetType",
    mapCheckedConversion: "operation.mapCheckedConversion",
    resolveParameterPassing: "parameter.resolvePassing",
    resolveRuntimeCarrier: "type.resolveRuntimeCarrier",
    validateExtensionFlowUse: "flow.validateExtensionUse",
};
export const deferObservation = Object.freeze({ kind: "defer" });
export function acceptObservation(value, evidence) {
    return evidence === undefined ? { kind: "accept", value } : { kind: "accept", value, evidence };
}
export function rejectObservation(diagnostic) {
    return { kind: "reject", diagnostic };
}
//# sourceMappingURL=observations.js.map