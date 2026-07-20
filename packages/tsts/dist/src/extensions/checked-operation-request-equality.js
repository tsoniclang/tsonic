import { ExtensionObservationPoint } from "./observations.js";
import { checkedCallSourceOperationEquals, checkedConversionSourceOperationEquals, checkedElementAccessSourceOperationEquals, checkedIterationSourceOperationEquals, checkedOperatorSourceOperationEquals, checkedPropertyAccessSourceOperationEquals, optionalCheckedSourceCallCompositionEvidenceEquals, selectedTargetSignatureEquals, targetParameterEquals, targetTypeRefEquals, } from "./fact-value-equality.js";
export function checkedOperationRequestEquals(observation, left, right) {
    return differingCheckedOperationRequestFields(observation, left, right).length === 0;
}
export function differingCheckedOperationRequestFields(observation, left, right) {
    const differences = [];
    switch (observation) {
        case ExtensionObservationPoint.mapCheckedCall:
            compareSourceOperation(differences, checkedCallSourceOperationEquals(left, right));
            compareValue(differences, "sourceComposition", left.sourceComposition, right.sourceComposition, optionalCheckedSourceCallCompositionEvidenceEquals);
            compareIdentity(differences, "target", left.target, right.target);
            break;
        case ExtensionObservationPoint.mapCheckedPropertyAccess:
            compareSourceOperation(differences, checkedPropertyAccessSourceOperationEquals(left, right));
            compareIdentity(differences, "target", left.target, right.target);
            break;
        case ExtensionObservationPoint.mapCheckedElementAccess:
            compareSourceOperation(differences, checkedElementAccessSourceOperationEquals(left, right));
            compareIdentity(differences, "target", left.target, right.target);
            break;
        case ExtensionObservationPoint.mapCheckedOperator:
            compareSourceOperation(differences, checkedOperatorSourceOperationEquals(left, right));
            compareIdentity(differences, "target", left.target, right.target);
            break;
        case ExtensionObservationPoint.mapCheckedIteration:
            compareSourceOperation(differences, checkedIterationSourceOperationEquals(left, right));
            compareIdentity(differences, "target", left.target, right.target);
            break;
        case ExtensionObservationPoint.mapCheckedConversion:
            compareConversionRequests(left, right, differences);
            break;
    }
    return Object.freeze(differences);
}
function compareConversionRequests(left, right, differences) {
    compareSourceOperation(differences, checkedConversionSourceOperationEquals(left, right));
    compareIdentity(differences, "targetPlatform", left.targetPlatform, right.targetPlatform);
    if (left.conversionKind !== "call-argument" || right.conversionKind !== "call-argument") {
        return;
    }
    compareValue(differences, "target", left.target, right.target, targetTypeRefEquals);
    compareValue(differences, "targetParameter", left.targetParameter, right.targetParameter, targetParameterEquals);
    compareValue(differences, "selectedSignature", left.selectedSignature, right.selectedSignature, selectedTargetSignatureEquals);
}
function compareSourceOperation(differences, equal) {
    if (!equal) {
        differences.push("sourceOperation");
    }
}
function compareIdentity(differences, field, left, right) {
    if (!Object.is(left, right)) {
        differences.push(field);
    }
}
function compareValue(differences, field, left, right, equals) {
    if (!equals(left, right)) {
        differences.push(field);
    }
}
//# sourceMappingURL=checked-operation-request-equality.js.map