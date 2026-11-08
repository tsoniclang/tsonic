import { sourceTypeDescriptorStructure } from "./descriptor-model.js";
import { sourceTypeDescriptorOpenness } from "./local-type-flow/uses.js";
const absenceDescriptor = Object.freeze({ kind: "intrinsic", intrinsic: "absence" });
/** The arms of a descriptor: union members (flattened), the value and absence of an optional, else the descriptor itself. */
export function sourceTypeDescriptorArms(type) {
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "union")
        return structure.types.flatMap(sourceTypeDescriptorArms);
    if (structure.kind === "optional")
        return [...sourceTypeDescriptorArms(structure.value), absenceDescriptor];
    return [type];
}
/** An arm that is only null / undefined / void (A11: void is absence). */
export function sourceTypeDescriptorIsAbsentArm(type) {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "intrinsic" && (structure.intrinsic === "absence" || structure.intrinsic === "void");
}
/** An arm with no values (never). */
export function sourceTypeDescriptorIsNeverArm(type) {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "intrinsic" && structure.intrinsic === "never";
}
/** The whole value is absent: every arm is absence or void (a never type is not absent). */
export function sourceTypeDescriptorIsAbsent(type) {
    const arms = sourceTypeDescriptorArms(type).filter(arm => !sourceTypeDescriptorIsNeverArm(arm));
    return arms.length !== 0 && arms.every(sourceTypeDescriptorIsAbsentArm);
}
/** The value may be absent at runtime: an absence or void arm, an optional, or a top (any / unknown) arm. */
export function sourceTypeDescriptorMayBeAbsent(ast, type) {
    return sourceTypeDescriptorArms(type).some(arm => sourceTypeDescriptorIsAbsentArm(arm) || sourceTypeDescriptorOpenness(ast, arm) === "top");
}
/** The present arms: absence, void and never arms removed. Empty when the value is never present. */
export function sourceTypeDescriptorPresentArms(type) {
    return sourceTypeDescriptorArms(type).filter(arm => !sourceTypeDescriptorIsAbsentArm(arm) && !sourceTypeDescriptorIsNeverArm(arm));
}
//# sourceMappingURL=descriptor-arms.js.map