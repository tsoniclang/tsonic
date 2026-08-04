import { SourceFile_FileName } from "../internal/ast/ast.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { ObjectFlagsReference, TypeFlagsIntersection, TypeFlagsUnion, } from "../internal/checker/types.js";
import { TypeAlias_Symbol, Type_Alias, Type_Flags, Type_ObjectFlags, Type_Symbol, Type_Target, Type_Types, } from "../internal/checker/types.js";
import { providerVirtualDeclarationFactKey } from "./facts.js";
import { getExtensionHost } from "./host.js";
import { providerVirtualStructuredTypeDemand } from "./provider-virtual-internal.js";
import { getProviderVirtualArtifactForCompiler } from "./provider-virtual-internal.js";
export function recordProviderStructuredTypeDemand(program, type, location) {
    const host = program === undefined ? undefined : getExtensionHost(program);
    if (host === undefined || type === undefined) {
        return;
    }
    const sourceFile = location === undefined ? undefined : GetSourceFileOfNode(location);
    if (sourceFile === undefined
        || getProviderVirtualArtifactForCompiler(host.providers, SourceFile_FileName(sourceFile)) !== undefined) {
        return;
    }
    const visitedTypes = new Set();
    const visitedSymbols = new Set();
    const visitSymbol = (symbol) => {
        if (symbol === undefined || visitedSymbols.has(symbol)) {
            return;
        }
        visitedSymbols.add(symbol);
        const declaration = host.facts.get(symbol, providerVirtualDeclarationFactKey);
        if (declaration !== undefined) {
            host.providers[providerVirtualStructuredTypeDemand](declaration);
        }
    };
    const visitType = (candidate) => {
        if (candidate === undefined || visitedTypes.has(candidate)) {
            return;
        }
        visitedTypes.add(candidate);
        visitSymbol(Type_Symbol(candidate));
        visitSymbol(TypeAlias_Symbol(Type_Alias(candidate)));
        if ((Type_ObjectFlags(candidate) & ObjectFlagsReference) !== 0) {
            visitType(Type_Target(candidate));
        }
        const flags = Type_Flags(candidate);
        if ((flags & (TypeFlagsUnion | TypeFlagsIntersection)) !== 0) {
            for (const constituent of Type_Types(candidate)) {
                visitType(constituent);
            }
        }
    };
    visitType(type);
}
//# sourceMappingURL=provider-materialization-integration.js.map