import { Node_Arguments, Node_Body, Node_Elements, Node_ImportClause, Node_Members, Node_ModifierFlags, Node_ModifierNodes, Node_Parameters, Node_Properties, Node_QuestionToken, Node_Statements, Node_Text, Node_Type, Node_TypeArguments, Node_TypeParameters, SourceFile_FileName, SourceFile_Path, SourceFile_Text, } from "../internal/ast/ast.js";
import { Node_End, Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import { KindString } from "../internal/ast/generated/kinds.js";
import * as casts from "../internal/ast/generated/casts.js";
import * as predicates from "../internal/ast/generated/predicates.js";
import { NodeFlagsBlockScoped, NodeFlagsNone } from "../internal/ast/generated/flags.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsAsync, ModifierFlagsConst, ModifierFlagsDefault, ModifierFlagsExport, ModifierFlagsOverride, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsPublic, ModifierFlagsReadonly, ModifierFlagsStatic, } from "../internal/ast/modifierflags.js";
import { GetCombinedNodeFlags, GetHeritageElements, GetSourceFileOfNode, HasModifier, IsConstAssertion, IsTypeOnlyImportDeclaration, IsTypeOnlyImportOrExportDeclaration, IsVarAwaitUsing, IsVarConst, IsVarLet, IsVarUsing, NodeIsSynthesized } from "../internal/ast/utilities.js";
import { KindExtendsKeyword, KindImplementsKeyword } from "../internal/ast/generated/kinds.js";
import { ComputePositionMap, PositionMap_UTF8ToUTF16, } from "../internal/ast/positionmap.js";
import { GetTokenPosOfNode } from "../internal/scanner/scanner.js";
export function createAstReader() {
    const reader = {
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
        typeNode: (node) => node === undefined ? undefined : Node_Type(node),
        typeParameters: (node) => Node_TypeParameters(node) ?? [],
        typeArguments: (node) => Node_TypeArguments(node) ?? [],
        arguments: (node) => Node_Arguments(node) ?? [],
        elements: (node) => Node_Elements(node) ?? [],
        properties: (node) => Node_Properties(node) ?? [],
        questionToken: (node) => node === undefined ? undefined : Node_QuestionToken(node),
        operatorKindName,
        modifiers: (node) => Node_ModifierNodes(node) ?? [],
        modifierFlags: (node) => node === undefined ? 0 : Node_ModifierFlags(node),
        hasModifier: (node, flags) => node !== undefined && HasModifier(node, flags) === true,
        hasModifierKind: (node, kind) => node !== undefined && HasModifier(node, modifierFlagForKind(kind)) === true,
        variableDeclarationKind,
        isConstAssertion: (node) => node !== undefined && IsConstAssertion(node) === true,
        heritageElements: (node, kind) => GetHeritageElements(node, kind === "extends" ? KindExtendsKeyword : KindImplementsKeyword) ?? [],
        extendsHeritageElements: (node) => GetHeritageElements(node, KindExtendsKeyword) ?? [],
        implementsHeritageElements: (node) => GetHeritageElements(node, KindImplementsKeyword) ?? [],
        isTypeOnlyImportDeclaration: (node) => {
            if (node === undefined) {
                return false;
            }
            if (predicates.IsImportDeclaration(node)) {
                const importClause = Node_ImportClause(node);
                return importClause !== undefined
                    && IsTypeOnlyImportDeclaration(importClause) === true;
            }
            return IsTypeOnlyImportDeclaration(node) === true;
        },
        isTypeOnlyImportOrExportDeclaration: (node) => {
            if (node === undefined) {
                return false;
            }
            if (predicates.IsImportDeclaration(node)) {
                const importClause = Node_ImportClause(node);
                return importClause !== undefined
                    && IsTypeOnlyImportOrExportDeclaration(importClause) === true;
            }
            return IsTypeOnlyImportOrExportDeclaration(node) === true;
        },
        pos: (node) => node === undefined ? -1 : Node_Pos(node),
        end: (node) => node === undefined ? -1 : Node_End(node),
        authoredRange,
        getSourceFile: (node) => GetSourceFileOfNode(node),
        getFileName: (sourceFile) => sourceFile === undefined ? "" : SourceFile_FileName(sourceFile),
        getPath: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Path(sourceFile),
        getSourceText: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Text(sourceFile),
        isDeclarationFile: (sourceFile) => sourceFile?.IsDeclarationFile === true,
        is: predicates,
        as: casts,
    };
    return Object.freeze(reader);
}
function authoredRange(node) {
    if (node === undefined || NodeIsSynthesized(node)) {
        return Object.freeze({ kind: "synthetic" });
    }
    const sourceFile = GetSourceFileOfNode(node);
    if (sourceFile === undefined) {
        return Object.freeze({ kind: "synthetic" });
    }
    const positionMap = authoredPositionMap(sourceFile);
    const start = PositionMap_UTF8ToUTF16(positionMap, GetTokenPosOfNode(node, sourceFile, false));
    const end = PositionMap_UTF8ToUTF16(positionMap, Node_End(node));
    if (start < 0 || end < start) {
        return Object.freeze({ kind: "synthetic" });
    }
    return Object.freeze({ kind: "authored", start, end });
}
const authoredPositionMaps = new WeakMap();
function authoredPositionMap(sourceFile) {
    const existing = authoredPositionMaps.get(sourceFile);
    if (existing !== undefined) {
        return existing;
    }
    const created = ComputePositionMap(SourceFile_Text(sourceFile));
    if (created === undefined) {
        throw new Error("TS-Go position map construction returned no result.");
    }
    authoredPositionMaps.set(sourceFile, created);
    return created;
}
function operatorKindName(node) {
    if (node === undefined) {
        return undefined;
    }
    if (predicates.IsBinaryExpression(node)) {
        const operator = casts.AsBinaryExpression(node)?.OperatorToken;
        return operator === undefined ? undefined : KindString(operator.Kind);
    }
    if (predicates.IsPrefixUnaryExpression(node)) {
        const operator = casts.AsPrefixUnaryExpression(node)?.Operator;
        return operator === undefined ? undefined : KindString(operator);
    }
    if (predicates.IsPostfixUnaryExpression(node)) {
        const operator = casts.AsPostfixUnaryExpression(node)?.Operator;
        return operator === undefined ? undefined : KindString(operator);
    }
    if (predicates.IsTypeOperatorNode(node)) {
        const operator = casts.AsTypeOperatorNode(node)?.Operator;
        return operator === undefined ? undefined : KindString(operator);
    }
    return undefined;
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
