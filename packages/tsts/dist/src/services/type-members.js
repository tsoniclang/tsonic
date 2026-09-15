import { SymbolName } from "../internal/ast/symbol.js";
import { SymbolFlagsOptional } from "../internal/ast/symbolflags.js";
import { Checker_GetTypeOfPropertyOfType } from "../internal/checker/exports.js";
import { Checker_GetRootSymbols } from "../internal/checker/services.js";
import { Checker_isReadonlySymbol } from "../internal/checker/checker/symbols.js";
import { typeIndexComponents } from "./type-index-components.js";
export function readTypePropertyInfo(checker, type, symbol) {
    if (symbol === undefined)
        throw new Error("The checker returned an absent property symbol for a source type.");
    const name = SymbolName(symbol);
    const propertyType = Checker_GetTypeOfPropertyOfType(checker, type, symbol.Name);
    if (propertyType === undefined) {
        throw new Error(`The checker returned property '${name}' without its effective source type.`);
    }
    return {
        symbol,
        rootSymbols: Object.freeze(Checker_GetRootSymbols(checker, symbol).filter((root) => root !== undefined)),
        name,
        type: propertyType,
        optional: (symbol.Flags & SymbolFlagsOptional) !== 0,
        readonly: Checker_isReadonlySymbol(checker, symbol) === true,
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