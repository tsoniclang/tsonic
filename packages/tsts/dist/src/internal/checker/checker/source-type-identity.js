import { Type_Flags, Type_Id, Type_Symbol, TypeFlagsUniqueESSymbol, } from "../types.js";
export function sourceTypesShareStableIdentity(left, right) {
    if (left === right) {
        return true;
    }
    if (left?.checker !== undefined && left.checker === right?.checker && Type_Id(left) === Type_Id(right)) {
        return true;
    }
    const leftIsUniqueSymbol = (Type_Flags(left) & TypeFlagsUniqueESSymbol) !== 0;
    const rightIsUniqueSymbol = (Type_Flags(right) & TypeFlagsUniqueESSymbol) !== 0;
    if (!leftIsUniqueSymbol || !rightIsUniqueSymbol) {
        return false;
    }
    const leftSymbol = Type_Symbol(left);
    const rightSymbol = Type_Symbol(right);
    if (leftSymbol === undefined || leftSymbol !== rightSymbol) {
        return false;
    }
    const leftDeclaration = leftSymbol.ValueDeclaration;
    const rightDeclaration = rightSymbol.ValueDeclaration;
    return leftDeclaration !== undefined && leftDeclaration === rightDeclaration;
}
export function preserveEquivalentSourceType(existing, incoming) {
    if (existing === undefined) {
        return incoming;
    }
    if (incoming === undefined) {
        return existing;
    }
    return sourceTypesShareStableIdentity(existing, incoming) ? existing : undefined;
}
//# sourceMappingURL=source-type-identity.js.map