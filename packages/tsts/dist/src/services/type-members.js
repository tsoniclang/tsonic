import { Node_AsNode } from "../internal/ast/spine.js";
import { IsClassLike } from "../internal/ast/utilities.js";
import { CheckFlagsMapped } from "../internal/ast/checkflags.js";
import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsOptional, SymbolFlagsPrototype } from "../internal/ast/symbolflags.js";
import { Checker_GetRootSymbols } from "../internal/checker/services.js";
import { Checker_isErrorType } from "../internal/checker/checker/diagnostics.js";
import { admitNativeChecker, markNativeCheckerProvisional } from "../internal/checker/resource-admission.js";
import { Checker_getPropertyOfObjectType, Checker_getPropertyOfType, Checker_getTypeOfSymbol, Checker_isReadonlySymbol } from "../internal/checker/checker/symbols.js";
import { completedRequiredPropertySource } from "../internal/checker/checker/source-type-answers.js";
import { Type_AsMappedType } from "../internal/checker/types.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { typeIndexComponents } from "./type-index-components.js";
export function readTypePropertyInfo(checker, type, symbol) {
    if (symbol === undefined)
        throw new Error("The checker returned an absent property symbol for a source type.");
    const selected = Checker_getPropertyOfType(checker, type, symbol.Name);
    if (selected !== undefined && LinkStore_TryGet(checker.valueSymbolLinks, selected)?.resolvedType === undefined) {
        markNativeCheckerProvisional(checker);
    }
    const property = selected === undefined ? undefined : selectedPropertyInfo(checker, symbol, selected);
    if (property === undefined)
        throw new Error(`The checker returned property '${SymbolName(symbol)}' without its effective source type.`);
    return property;
}
export function readObjectPropertyInfo(checker, type, name) {
    const symbol = Checker_getPropertyOfObjectType(checker, type, name);
    if (symbol === undefined)
        return null;
    const property = selectedPropertyInfo(checker, symbol, symbol);
    if (property === undefined || property.type.checker !== checker || Checker_isErrorType(checker, property.type))
        return undefined;
    return Object.freeze(property);
}
export function readTypePropertyHeader(checker, symbol) {
    if (symbol === undefined)
        throw new Error("The checker returned an absent property symbol in an object inventory.");
    return selectedPropertyInfo(checker, symbol, undefined);
}
function selectedPropertyInfo(checker, symbol, selected) {
    const propertyType = selected === undefined ? undefined : Checker_getTypeOfSymbol(checker, selected);
    if (selected !== undefined && propertyType === undefined)
        return undefined;
    const mapped = propertyType !== undefined && (symbol.CheckFlags & CheckFlagsMapped) !== 0;
    const mappedLinks = mapped
        ? LinkStore_TryGet(checker.mappedSymbolLinks, symbol) : undefined;
    const links = propertyType !== undefined && (mapped || symbol.ValueDeclaration === undefined)
        ? LinkStore_TryGet(checker.valueSymbolLinks, symbol) : undefined;
    const containingType = mapped ? links?.containingType : undefined;
    const bindingPattern = propertyType !== undefined && links?.resolvedType === propertyType ? links.bindingPattern : undefined;
    const classPrototype = (symbol.Flags & SymbolFlagsPrototype) !== 0 && symbol.ValueDeclaration === undefined
        && symbol.Parent?.Exports?.get(symbol.Name) === symbol ? symbol.Parent.ValueDeclaration : undefined;
    const mappedDeclaration = containingType === undefined ? undefined : Type_AsMappedType(containingType)?.declaration;
    const intrinsicOrigin = symbol === checker.globalThisSymbol ? "global-this"
        : symbol === checker.undefinedSymbol ? "undefined" : undefined;
    const typeSource = selected === symbol && propertyType !== undefined ? completedRequiredPropertySource(checker, symbol, propertyType) : undefined;
    admitNativeChecker(checker, "retained", mapped ? 3 : 2);
    return {
        symbol,
        rootSymbols: Object.freeze(Checker_GetRootSymbols(checker, symbol).filter((root) => root !== undefined)),
        name: SymbolName(symbol),
        ...(propertyType === undefined ? {} : { type: propertyType }),
        optional: (symbol.Flags & SymbolFlagsOptional) !== 0,
        readonly: Checker_isReadonlySymbol(checker, symbol) === true,
        ...(typeSource === undefined ? {} : { typeSource }),
        ...(intrinsicOrigin === undefined ? {} : { intrinsicOrigin }),
        ...(bindingPattern === undefined ? {} : { bindingPattern }),
        ...(classPrototype !== undefined && IsClassLike(classPrototype) ? { classPrototype } : {}),
        ...(!mapped ? {} : { mapped: Object.freeze({
                keyType: mappedLinks?.keyType,
                syntheticOrigin: mappedLinks?.syntheticOrigin,
                declaration: mappedDeclaration === undefined ? undefined : Node_AsNode(mappedDeclaration),
            }) }),
    };
}
export function readTypeIndexInfo(checker, type, info) {
    return {
        keyType: info?.keyType,
        valueType: info?.valueType,
        readonly: info?.isReadonly === true,
        declaration: info?.declaration,
        symbol: info?.indexSymbol,
        components: typeIndexComponents(checker, type, info),
    };
}
//# sourceMappingURL=type-members.js.map