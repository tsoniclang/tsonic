import { Node_Elements } from "../internal/ast/ast.js";
import { AsExportDeclaration, AsImportClause, AsImportDeclaration } from "../internal/ast/generated/casts.js";
import { KindDeferKeyword, KindTypeKeyword, KindUnknown } from "../internal/ast/generated/kinds.js";
import { IsExportDeclaration, IsImportDeclaration, IsJSImportDeclaration, IsNamespaceImport } from "../internal/ast/generated/predicates.js";
import { IsInJSFile, IsParseTreeNode } from "../internal/ast/utilities.js";
import { Checker_GetEmitResolver } from "../internal/checker/checker/support.js";
import { Checker_GetSymbolAtLocation } from "../internal/checker/checker/symbols.js";
import { EmitResolver_IsReferencedAliasDeclaration, EmitResolver_IsValueAliasDeclaration } from "../internal/checker/emitresolver.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
export function sourceModuleLink(checker, specifier, admitsCheckerDiagnostic) {
    const declaration = specifier.Parent;
    if (declaration === undefined || !IsParseTreeNode(declaration) || !IsParseTreeNode(specifier))
        return undefined;
    let evaluation;
    if (IsImportDeclaration(declaration) || IsJSImportDeclaration(declaration)) {
        const imported = AsImportDeclaration(declaration);
        if (imported?.ModuleSpecifier !== specifier)
            return undefined;
        const clause = imported.ImportClause;
        if (clause === undefined)
            evaluation = "eager";
        else {
            const binding = AsImportClause(clause);
            if (binding === undefined)
                return undefined;
            switch (binding.PhaseModifier) {
                case KindTypeKeyword:
                    evaluation = "erased";
                    break;
                case KindDeferKeyword:
                    evaluation = "deferred";
                    break;
                case KindUnknown: {
                    const resolver = Checker_GetEmitResolver(checker);
                    const referenced = (alias) => IsInJSFile(alias) || EmitResolver_IsReferencedAliasDeclaration(resolver, alias);
                    const named = binding.NamedBindings;
                    evaluation = !checker.canCollectSymbolAliasAccessibilityData
                        || binding.name !== undefined && referenced(clause)
                        || named !== undefined && (IsNamespaceImport(named) ? referenced(named) : (Node_Elements(named) ?? []).some(alias => alias !== undefined && referenced(alias)))
                        ? "eager" : "erased";
                    break;
                }
                default: return undefined;
            }
        }
    }
    else if (IsExportDeclaration(declaration)) {
        const exported = AsExportDeclaration(declaration);
        if (exported?.ModuleSpecifier !== specifier)
            return undefined;
        evaluation = exported.IsTypeOnly ? "erased"
            : exported.ExportClause === undefined || !checker.canCollectSymbolAliasAccessibilityData
                || EmitResolver_IsValueAliasDeclaration(Checker_GetEmitResolver(checker), declaration) ? "eager" : "erased";
    }
    else
        return undefined;
    const cause = LinkStore_TryGet(checker.nodeLinks, specifier)?.externalModuleFailure;
    if (cause !== undefined)
        return { resolution: { kind: "unresolved",
                cause: admitsCheckerDiagnostic?.(cause) === false ? undefined : cause }, evaluation };
    const module = Checker_GetSymbolAtLocation(checker, specifier);
    return { resolution: module === undefined ? { kind: "unresolved", cause: undefined } : { kind: "resolved", module }, evaluation };
}
//# sourceMappingURL=source-module-link.js.map