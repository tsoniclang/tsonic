import { Node_AsNode } from "../internal/ast/spine.js";
import { CheckFlagsMapped } from "../internal/ast/checkflags.js";
import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsOptional } from "../internal/ast/symbolflags.js";
import { Checker_GetTypeOfPropertyOfType } from "../internal/checker/exports.js";
import { Checker_GetRootSymbols } from "../internal/checker/services.js";
import { Checker_isReadonlySymbol } from "../internal/checker/checker/symbols.js";
import { Type_AsMappedType } from "../internal/checker/types.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { typeIndexComponents } from "./type-index-components.js";
export function readTypePropertyInfo(checker, type, symbol) {
    if (symbol === undefined)
        throw new Error("The checker returned an absent property symbol for a source type.");
    const name = SymbolName(symbol);
    const propertyType = Checker_GetTypeOfPropertyOfType(checker, type, symbol.Name);
    if (propertyType === undefined) {
        throw new Error(`The checker returned property '${name}' without its effective source type.`);
    }
    const mapped = (symbol.CheckFlags & CheckFlagsMapped) !== 0;
    const mappedLinks = mapped
        ? LinkStore_TryGet(checker.mappedSymbolLinks, symbol) : undefined;
    const containingType = mapped
        ? LinkStore_TryGet(checker.valueSymbolLinks, symbol)?.containingType : undefined;
    const mappedDeclaration = containingType === undefined ? undefined : Type_AsMappedType(containingType)?.declaration;
    return {
        symbol,
        rootSymbols: Object.freeze(Checker_GetRootSymbols(checker, symbol).filter((root) => root !== undefined)),
        name,
        type: propertyType,
        optional: (symbol.Flags & SymbolFlagsOptional) !== 0,
        readonly: Checker_isReadonlySymbol(checker, symbol) === true,
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