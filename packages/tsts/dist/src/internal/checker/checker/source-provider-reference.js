import { Node_Expression, Node_Initializer } from "../../ast/ast.js";
import { SymbolFlagsAlias, SymbolFlagsNamespaceModule, SymbolFlagsValueModule } from "../../ast/generated/flags.js";
import { AsElementAccessExpression } from "../../ast/generated/casts.js";
import { IsElementAccessExpression, IsIdentifier, IsPropertyAccessExpression, IsVariableDeclaration } from "../../ast/generated/predicates.js";
import { GetSourceFileOfNode, IsOptionalChain, IsStringLiteralLike, IsVarConst, OEKParentheses, SkipOuterExpressions } from "../../ast/utilities.js";
import { getExtensionHost } from "../../../extensions/host.js";
import { providerIntrinsicDeclarationFactKey, providerTypeFamilyFactKey, providerVirtualDeclarationFactKey } from "../../../extensions/facts.js";
import { Checker_GetAliasedSymbol, Checker_GetSymbolAtLocation } from "./symbols.js";
export function resolveSourceProviderReference(checker, expression) {
    if (checker === undefined || expression === undefined)
        return undefined;
    const sourceFile = GetSourceFileOfNode(expression);
    if (sourceFile === undefined || !checker.fileIndexMap.has(sourceFile)) {
        throw new Error("Provider identity requires an expression from the owning compiler program.");
    }
    const host = getExtensionHost(checker.program);
    if (host === undefined)
        return undefined;
    const symbol = resolveStaticReferenceSymbol(checker, expression, new Set());
    if (symbol === undefined)
        return undefined;
    const intrinsic = host.facts.get(symbol, providerIntrinsicDeclarationFactKey);
    const family = host.facts.get(symbol, providerTypeFamilyFactKey);
    const ordinary = host.facts.get(symbol, providerVirtualDeclarationFactKey);
    const facet = family !== undefined
        ? Object.freeze({ kind: "type-family", family })
        : ordinary !== undefined && (intrinsic === undefined || !providerVirtualDeclarationFactKey.equals(ordinary, intrinsic))
            ? Object.freeze({ kind: "declaration", declaration: ordinary }) : undefined;
    if (intrinsic === undefined)
        return facet === undefined ? undefined : Object.freeze({ expression, symbol, ordinary: facet });
    return Object.freeze({ expression, symbol, intrinsic, ...(facet === undefined ? {} : { ordinary: facet }) });
}
function resolveStaticReferenceSymbol(checker, expression, aliases) {
    const host = checker === undefined ? undefined : getExtensionHost(checker.program);
    let selected = SkipOuterExpressions(expression, OEKParentheses);
    while (selected !== undefined && (IsIdentifier(selected) ||
        IsPropertyAccessExpression(selected) || IsElementAccessExpression(selected))) {
        if (IsOptionalChain(selected))
            return undefined;
        let receiver;
        if (!IsIdentifier(selected)) {
            if (IsElementAccessExpression(selected) &&
                !IsStringLiteralLike(AsElementAccessExpression(selected).ArgumentExpression))
                return undefined;
            const namespace = resolveStaticReferenceSymbol(checker, Node_Expression(selected), aliases);
            if (namespace === undefined)
                return undefined;
            if ((namespace.Flags & (SymbolFlagsNamespaceModule | SymbolFlagsValueModule)) === 0) {
                receiver = host?.facts.get(namespace, providerVirtualDeclarationFactKey);
                if (receiver?.exportId === undefined || receiver.memberId !== undefined || receiver.signatureId !== undefined)
                    return undefined;
            }
        }
        const binding = Checker_GetSymbolAtLocation(checker, selected);
        const symbol = binding !== undefined && (binding.Flags & SymbolFlagsAlias) !== 0
            ? Checker_GetAliasedSymbol(checker, binding)
            : binding;
        if (symbol === undefined)
            return undefined;
        if (receiver !== undefined && !isExactProviderMember(receiver, host?.facts.get(symbol, providerVirtualDeclarationFactKey)))
            return undefined;
        const variable = symbol.ValueDeclaration;
        if (variable === undefined || !IsVariableDeclaration(variable) || !IsVarConst(variable))
            return symbol;
        const initializer = Node_Initializer(variable);
        if (initializer === undefined)
            return symbol;
        if (aliases.has(symbol))
            return undefined;
        aliases.add(symbol);
        selected = SkipOuterExpressions(initializer, OEKParentheses);
    }
    return undefined;
}
function isExactProviderMember(owner, member) {
    return member !== undefined && member.memberId !== undefined && member.signatureId === undefined
        && member.providerId === owner.providerId && member.providerVersion === owner.providerVersion
        && member.moduleSpecifier === owner.moduleSpecifier && member.providerModuleId === owner.providerModuleId
        && member.artifactFileName === owner.artifactFileName
        && member.exportId === owner.exportId && member.exportName === owner.exportName;
}
//# sourceMappingURL=source-provider-reference.js.map