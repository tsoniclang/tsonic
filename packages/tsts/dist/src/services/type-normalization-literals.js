import { getBigIntLiteralValue, getNumberLiteralValue, getStringLiteralValue, isFreshLiteralType } from "../internal/checker/checker/state.js";
import { Checker_getBigIntLiteralType, Checker_getEnumLiteralType, Checker_getFreshTypeOfLiteralType, Checker_getNumberLiteralType, Checker_getStringLiteralType } from "../internal/checker/checker/types.js";
import { TypeFlagsBigIntLiteral, TypeFlagsEnumLiteral, TypeFlagsNumberLiteral, TypeFlagsStringLiteral, Type_AsLiteralType } from "../internal/checker/types.js";
import { Number_IsNaN } from "../internal/jsnum/jsnum.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { Checker_getDeclaredTypeOfSymbol, Checker_getTypeOfSymbol } from "../internal/checker/checker/symbols.js";
import { TypeFlagsEnum, TypeFlagsUniqueESSymbol } from "../internal/checker/types.js";
import { reacquireCachedLateBoundSymbol } from "./type-normalization-declarations.js";
export function reacquireLiteralType(producer, type) {
    if (type.alias !== undefined)
        return undefined;
    if ((type.flags & TypeFlagsUniqueESSymbol) !== 0) {
        const source = type.checker;
        const symbol = type.symbol;
        if (source === undefined || symbol === undefined || source.uniqueESSymbolTypes.get(symbol) !== type)
            return undefined;
        const selected = symbol.checkerId === undefined ? symbol : reacquireCachedLateBoundSymbol(source, producer, symbol);
        if (selected === undefined)
            return undefined;
        if (symbol.checkerId === undefined && source.program.SourceFiles() !== producer.program.SourceFiles())
            throw new TypeError("A native unique symbol requires the same actual Program");
        const result = Checker_getTypeOfSymbol(producer, selected);
        if (result === undefined || result.checker !== producer || result.symbol !== selected
            || (result.flags & TypeFlagsUniqueESSymbol) === 0 || producer.uniqueESSymbolTypes.get(selected) !== result
            || LinkStore_TryGet(producer.valueSymbolLinks, selected)?.resolvedType !== result)
            throw new TypeError("The actual unique symbol retains both target-owned native value cache relations");
        return result;
    }
    let regular;
    if ((type.flags & TypeFlagsEnum) !== 0) {
        const source = type.checker;
        const symbol = type.symbol;
        if (source === undefined || symbol === undefined)
            return undefined;
        const declared = LinkStore_TryGet(source.declaredTypeLinks, symbol)?.declaredType;
        if (declared === undefined)
            return undefined;
        const originalRegular = Type_AsLiteralType(declared)?.regularType;
        if (declared !== type && originalRegular !== type)
            return undefined;
        const selected = Checker_getDeclaredTypeOfSymbol(producer, symbol);
        if (selected === undefined)
            throw new Error("The native computed enum declaration did not return its value");
        const result = declared === type ? selected : Type_AsLiteralType(selected)?.regularType;
        if (result === undefined)
            throw new Error("The native computed enum declaration requires its regular value");
        return result;
    }
    else if ((type.flags & TypeFlagsEnumLiteral) !== 0) {
        const original = isFreshLiteralType(type) ? Type_AsLiteralType(type)?.regularType : type;
        const source = original?.checker;
        const member = original?.symbol;
        const owner = member?.Parent;
        if (source === undefined || member === undefined || owner === undefined)
            return undefined;
        if ((type.flags & TypeFlagsStringLiteral) !== 0) {
            const value = getStringLiteralValue(type);
            if (source.enumLiteralTypes.get({ enumSymbol: owner, value }) !== original)
                return undefined;
            regular = Checker_getEnumLiteralType(producer, value, owner, member);
        }
        else if ((type.flags & TypeFlagsNumberLiteral) !== 0) {
            const value = getNumberLiteralValue(type);
            const cached = Number_IsNaN(value) ? source.enumNaNLiteralTypes.get(owner) : source.enumLiteralTypes.get({ enumSymbol: owner, value });
            if (cached !== original)
                return undefined;
            regular = Checker_getEnumLiteralType(producer, value, owner, member);
        }
        else
            return undefined;
    }
    else if ((type.flags & TypeFlagsStringLiteral) !== 0) {
        regular = Checker_getStringLiteralType(producer, getStringLiteralValue(type));
    }
    else if ((type.flags & TypeFlagsNumberLiteral) !== 0) {
        regular = Checker_getNumberLiteralType(producer, getNumberLiteralValue(type));
    }
    else if ((type.flags & TypeFlagsBigIntLiteral) !== 0) {
        regular = Checker_getBigIntLiteralType(producer, getBigIntLiteralValue(type));
    }
    else
        return undefined;
    if (regular === undefined)
        throw new Error("The native literal constructor did not return its value");
    if (!isFreshLiteralType(type))
        return regular;
    const fresh = Checker_getFreshTypeOfLiteralType(producer, regular);
    if (fresh === undefined)
        throw new Error("The native fresh literal constructor did not return its value");
    return fresh;
}
//# sourceMappingURL=type-normalization-literals.js.map