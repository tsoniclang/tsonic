import { Node_Arguments, Node_Body, Node_Elements, Node_Members, Node_ModifierFlags, Node_ModifierNodes, Node_Parameters, Node_Properties, Node_Statements, Node_Text, Node_TypeArguments, Node_TypeParameters, SourceFile_FileName, SourceFile_Path, SourceFile_Text, } from "../internal/ast/ast.js";
import { Node_End, Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import { KindString } from "../internal/ast/generated/kinds.js";
import * as casts from "../internal/ast/generated/casts.js";
import * as predicates from "../internal/ast/generated/predicates.js";
import { NodeFlagsBlockScoped, NodeFlagsNone } from "../internal/ast/generated/flags.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsAsync, ModifierFlagsConst, ModifierFlagsDefault, ModifierFlagsExport, ModifierFlagsOverride, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsPublic, ModifierFlagsReadonly, ModifierFlagsStatic, } from "../internal/ast/modifierflags.js";
import { GetCombinedNodeFlags, GetHeritageElements, GetSourceFileOfNode, HasModifier, IsTypeOnlyImportDeclaration, IsTypeOnlyImportOrExportDeclaration, IsVarAwaitUsing, IsVarConst, IsVarLet, IsVarUsing } from "../internal/ast/utilities.js";
import { KindExtendsKeyword, KindImplementsKeyword } from "../internal/ast/generated/kinds.js";
export function createAstReader() {
    return {
        kind: (node) => node?.Kind,
        kindName: (node) => node === undefined ? "Undefined" : KindString(node.Kind),
        text: (node) => node === undefined ? "" : Node_Text(node),
        name: (node) => node === undefined ? undefined : Node_Name(node),
        body: (node) => node === undefined ? undefined : Node_Body(node),
        parent: (node) => node?.Parent,
        children: collectChildren,
        forEachChild: (node, callback) => {
            if (node === undefined) {
                return;
            }
            Node_ForEachChild(node, (child) => {
                callback(child);
                return false;
            });
        },
        statements: (node) => Node_Statements(node) ?? [],
        members: (node) => Node_Members(node) ?? [],
        parameters: (node) => Node_Parameters(node) ?? [],
        typeParameters: (node) => Node_TypeParameters(node) ?? [],
        typeArguments: (node) => Node_TypeArguments(node) ?? [],
        arguments: (node) => Node_Arguments(node) ?? [],
        elements: (node) => Node_Elements(node) ?? [],
        properties: (node) => Node_Properties(node) ?? [],
        modifiers: (node) => Node_ModifierNodes(node) ?? [],
        modifierFlags: (node) => node === undefined ? 0 : Node_ModifierFlags(node),
        hasModifier: (node, flags) => node !== undefined && HasModifier(node, flags) === true,
        hasModifierKind: (node, kind) => node !== undefined && HasModifier(node, modifierFlagForKind(kind)) === true,
        variableDeclarationKind,
        heritageElements: (node, kind) => GetHeritageElements(node, kind === "extends" ? KindExtendsKeyword : KindImplementsKeyword) ?? [],
        extendsHeritageElements: (node) => GetHeritageElements(node, KindExtendsKeyword) ?? [],
        implementsHeritageElements: (node) => GetHeritageElements(node, KindImplementsKeyword) ?? [],
        isTypeOnlyImportDeclaration: (node) => {
            if (node === undefined) {
                return false;
            }
            const importClause = casts.AsImportDeclaration(node)?.ImportClause;
            return IsTypeOnlyImportDeclaration(importClause ?? node) === true;
        },
        isTypeOnlyImportOrExportDeclaration: (node) => {
            if (node === undefined) {
                return false;
            }
            const importClause = casts.AsImportDeclaration(node)?.ImportClause;
            return IsTypeOnlyImportOrExportDeclaration(importClause ?? node) === true;
        },
        pos: (node) => node === undefined ? -1 : Node_Pos(node),
        end: (node) => node === undefined ? -1 : Node_End(node),
        getSourceFile: (node) => GetSourceFileOfNode(node),
        getFileName: (sourceFile) => sourceFile === undefined ? "" : SourceFile_FileName(sourceFile),
        getPath: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Path(sourceFile),
        getSourceText: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Text(sourceFile),
        is: predicates,
        as: casts,
    };
}
function variableDeclarationKind(node) {
    const declarationList = variableDeclarationList(node);
    if (declarationList === undefined) {
        return undefined;
    }
    if (IsVarAwaitUsing(declarationList)) {
        return "await using";
    }
    if (IsVarUsing(declarationList)) {
        return "using";
    }
    if (IsVarConst(declarationList)) {
        return "const";
    }
    if (IsVarLet(declarationList)) {
        return "let";
    }
    return (GetCombinedNodeFlags(declarationList) & NodeFlagsBlockScoped) === NodeFlagsNone ? "var" : undefined;
}
function variableDeclarationList(node) {
    if (node === undefined) {
        return undefined;
    }
    if (predicates.IsVariableStatement(node)) {
        return casts.AsVariableStatement(node)?.DeclarationList;
    }
    if (predicates.IsVariableDeclarationList(node)) {
        return node;
    }
    if (predicates.IsVariableDeclaration(node) && predicates.IsVariableDeclarationList(node.Parent)) {
        return node.Parent;
    }
    return undefined;
}
function modifierFlagForKind(kind) {
    switch (kind) {
        case "public":
            return ModifierFlagsPublic;
        case "private":
            return ModifierFlagsPrivate;
        case "protected":
            return ModifierFlagsProtected;
        case "readonly":
            return ModifierFlagsReadonly;
        case "override":
            return ModifierFlagsOverride;
        case "export":
            return ModifierFlagsExport;
        case "abstract":
            return ModifierFlagsAbstract;
        case "ambient":
            return ModifierFlagsAmbient;
        case "static":
            return ModifierFlagsStatic;
        case "async":
            return ModifierFlagsAsync;
        case "default":
            return ModifierFlagsDefault;
        case "const":
            return ModifierFlagsConst;
    }
}
function collectChildren(node) {
    if (node === undefined) {
        return [];
    }
    const children = [];
    Node_ForEachChild(node, (child) => {
        children.push(child);
        return false;
    });
    return children;
}
//# sourceMappingURL=ast-reader.js.map