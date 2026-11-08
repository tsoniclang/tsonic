import { providerTypeFamilyFactKey, providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { sourceTypeFactSubjects } from "./semantics-fact-subjects.js";
export function sourceTypeRelationship(types, checker, facts, left, right) {
    if (left === right) {
        return "identical";
    }
    if (!types.isTypeReference(left) || !types.isTypeReference(right)) {
        return "unrelated";
    }
    const leftTarget = types.getTypeReferenceTarget(left);
    const rightTarget = types.getTypeReferenceTarget(right);
    if (leftTarget !== undefined && rightTarget !== undefined) {
        if (leftTarget === rightTarget)
            return "same-declaration";
        const leftSymbol = checker.getTypeSymbol(left);
        if (leftSymbol !== undefined && leftSymbol === checker.getTypeSymbol(right)) {
            return "same-declaration";
        }
    }
    const leftProviderIds = providerTypeDeclarationIds(checker, facts, left);
    return leftProviderIds.some((id) => providerTypeDeclarationIds(checker, facts, right).includes(id))
        ? "same-declaration"
        : "unrelated";
}
function providerTypeDeclarationIds(checker, facts, type) {
    const ids = new Set();
    for (const subject of sourceTypeFactSubjects(checker, type)) {
        const declaration = facts.getFact(subject, providerVirtualDeclarationFactKey);
        if (declaration?.exportId !== undefined) {
            ids.add(providerDeclarationId(declaration));
        }
        const family = facts.getFact(subject, providerTypeFamilyFactKey);
        for (const variant of family?.variants ?? []) {
            if (variant.declaration.exportId !== undefined) {
                ids.add(providerDeclarationId(variant.declaration));
            }
        }
    }
    return [...ids];
}
function providerDeclarationId(declaration) {
    return JSON.stringify([
        declaration.providerId,
        declaration.providerVersion,
        declaration.providerModuleId,
        declaration.exportId,
    ]);
}
//# sourceMappingURL=semantics-type-relationship.js.map