import { Node_End, Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import { Node_Arguments, Node_Body, Node_ElementList, Node_Elements, Node_Expression, Node_Initializer, Node_MemberList, Node_Members, Node_ModuleSpecifier, Node_ModifierFlags, Node_ParameterList, Node_Parameters, Node_Properties, Node_PropertyName, Node_PropertyNameOrName, Node_QuestionToken, Node_StatementList, Node_Statements, Node_Text, Node_Type, Node_TypeParameterList, Node_TypeArguments, Node_TypeParameters, SourceFile_FileName, SourceFile_Text, } from "../internal/ast/ast.js";
import { AsClassDeclaration, AsBindingElement, AsExportDeclaration, AsHeritageClause, AsIdentifier, AsInterfaceDeclaration, AsParameterDeclaration, AsStringLiteral, AsTypeReferenceNode, } from "../internal/ast/generated/casts.js";
import { KindArrowFunction, KindBlock, KindCallExpression, KindClassDeclaration, KindCallSignature, KindConstructSignature, KindConstructorType, KindConstructor, KindEnumDeclaration, KindExportAssignment, KindExportDeclaration, KindExpressionWithTypeArguments, KindExtendsKeyword, KindFunctionDeclaration, KindFunctionExpression, KindFunctionType, KindGetAccessor, KindIdentifier, KindImplementsKeyword, KindIndexSignature, KindImportDeclaration, KindImportEqualsDeclaration, KindInterfaceDeclaration, KindMethodDeclaration, KindMethodSignature, KindModuleDeclaration, KindParameter, KindPropertyAccessExpression, KindPropertyDeclaration, KindPropertySignature, KindSetAccessor, KindSourceFile, KindStringLiteral, KindTypeAliasDeclaration, KindTypeReference, KindVariableDeclaration, KindVariableStatement, } from "../internal/ast/generated/kinds.js";
import { ModifierFlagsAbstract, ModifierFlagsAmbient, ModifierFlagsDefault, ModifierFlagsExport, ModifierFlagsParameterPropertyModifier, ModifierFlagsPrivate, ModifierFlagsProtected, ModifierFlagsPublic, ModifierFlagsReadonly, ModifierFlagsStatic, } from "../internal/ast/modifierflags.js";
import { SymbolFlagsValue } from "../internal/ast/generated/flags.js";
import { GetSourceFileOfNode, HasTypeArguments, HasSyntacticModifier, IsExternalOrCommonJSModule, IsFunctionLikeDeclaration, getImportTypeNodeLiteral, } from "../internal/ast/utilities.js";
import { IsDeclarationFileName } from "../internal/tspath/extension.js";
import { GetECMALineAndUTF16CharacterOfPosition } from "../internal/scanner/scanner.js";
export const getTstsSourceFileName = (sourceFile) => sourceFile?.FileName();
export const getTstsNodeSpan = (node) => node?.Loc ? { pos: node.Loc.pos, end: node.Loc.end } : undefined;
const nodeListNodes = (list) => list?.Nodes ?? [];
const nodeArray = (nodes) => nodes ?? [];
const hasModifier = (node, flag) => node !== undefined && HasSyntacticModifier(node, flag);
const safeNodeText = (node) => {
    if (!node)
        return undefined;
    try {
        return Node_Text(node);
    }
    catch {
        const sourceFile = GetSourceFileOfNode(node);
        const text = sourceFile ? SourceFile_Text(sourceFile) : "";
        const start = Node_Pos(node);
        const end = Node_End(node);
        return text.slice(start, end);
    }
};
export const forEachTstsChild = (node, visit) => {
    if (!node)
        return;
    Node_ForEachChild(node, (child) => {
        visit(child);
        return false;
    });
};
export const visitTstsSubtree = (node, visit) => {
    if (!node)
        return;
    visit(node);
    forEachTstsChild(node, (child) => visitTstsSubtree(child, visit));
};
export const getTstsIdentifierText = (node) => {
    if (node?.Kind !== KindIdentifier)
        return undefined;
    return AsIdentifier(node)?.Text;
};
export const isTstsIdentifier = (node) => node?.Kind === KindIdentifier;
export const getTstsNodeNameText = (node) => node ? getTstsIdentifierText(Node_Name(node)) : undefined;
export const getTstsNodeText = (node) => safeNodeText(node);
export const getTstsPropertyNameText = (node) => {
    if (!node)
        return undefined;
    let propertyName;
    let propertyNameOrName;
    try {
        propertyNameOrName = Node_PropertyNameOrName(node);
    }
    catch {
        propertyNameOrName = undefined;
    }
    try {
        propertyName = Node_PropertyName(node);
    }
    catch {
        propertyName = undefined;
    }
    return (getTstsNodeText(propertyNameOrName) ??
        getTstsNodeText(propertyName) ??
        getTstsNodeNameText(node));
};
export const getTstsContainingSourceFile = (node) => (node ? GetSourceFileOfNode(node) : undefined);
export const getTstsContainingSourceFileName = (node) => getTstsContainingSourceFile(node)?.FileName();
export const getTstsNodeLocation = (sourceFile, node) => {
    if (!sourceFile || !node)
        return undefined;
    const pos = Node_Pos(node);
    const end = Node_End(node);
    const [line, column] = GetECMALineAndUTF16CharacterOfPosition(sourceFile, pos);
    return {
        file: SourceFile_FileName(sourceFile),
        line: line + 1,
        column: column + 1,
        length: Math.max(0, end - pos),
    };
};
export const getTstsInitializerNode = (node) => {
    if (!node)
        return undefined;
    try {
        return Node_Initializer(node);
    }
    catch {
        return undefined;
    }
};
export const getTstsBodyNode = (node) => {
    if (!node)
        return undefined;
    try {
        return Node_Body(node);
    }
    catch {
        return undefined;
    }
};
export const getTstsExpressionNode = (node) => {
    if (!node)
        return undefined;
    try {
        return Node_Expression(node);
    }
    catch {
        return undefined;
    }
};
export const getTstsParameters = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_Parameters(node));
    }
    catch {
        try {
            return nodeListNodes(Node_ParameterList(node));
        }
        catch {
            return [];
        }
    }
};
export const getTstsTypeParameterNodes = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_TypeParameters(node));
    }
    catch {
        try {
            return nodeListNodes(Node_TypeParameterList(node));
        }
        catch {
            return [];
        }
    }
};
export const getTstsMemberNodes = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_Members(node));
    }
    catch {
        try {
            return nodeListNodes(Node_MemberList(node));
        }
        catch {
            return [];
        }
    }
};
export const getTstsStatementNodes = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_Statements(node));
    }
    catch {
        return nodeListNodes(Node_StatementList(node));
    }
};
export const getTstsPropertyNodes = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_Properties(node));
    }
    catch {
        return [];
    }
};
export const getTstsElementNodes = (node) => {
    if (!node)
        return [];
    try {
        return nodeArray(Node_Elements(node));
    }
    catch {
        return nodeListNodes(Node_ElementList(node));
    }
};
export const getTstsDeclarationKind = (node) => {
    switch (node?.Kind) {
        case KindVariableDeclaration:
        case KindVariableStatement:
            return "variable";
        case KindFunctionDeclaration:
        case KindFunctionExpression:
        case KindArrowFunction:
            return "function";
        case KindClassDeclaration:
            return "class";
        case KindInterfaceDeclaration:
            return "interface";
        case KindTypeAliasDeclaration:
            return "typeAlias";
        case KindEnumDeclaration:
            return "enum";
        case KindParameter:
            return "parameter";
        case KindPropertyDeclaration:
        case KindPropertySignature:
            return "property";
        case KindMethodDeclaration:
        case KindMethodSignature:
        case KindConstructor:
        case KindGetAccessor:
        case KindSetAccessor:
            return "method";
        default:
            return "variable";
    }
};
export const asTstsTypeReferenceNode = (node) => node?.Kind === KindTypeReference ? AsTypeReferenceNode(node) : undefined;
export const getTstsTypeReferenceName = (node) => {
    const typeReference = asTstsTypeReferenceNode(node);
    return getTstsIdentifierText(typeReference?.TypeName);
};
export const getTstsTypeArguments = (node) => node && HasTypeArguments(node) ? (Node_TypeArguments(node) ?? []) : [];
export const getTstsTypeReferenceDetails = (node) => {
    const name = getTstsTypeReferenceName(node);
    return name
        ? {
            name,
            typeArguments: getTstsTypeArguments(node),
        }
        : undefined;
};
export const getTstsDeclaredTypeNode = (node) => {
    switch (node?.Kind) {
        case KindParameter:
        case KindPropertyDeclaration:
        case KindPropertySignature:
        case KindVariableDeclaration:
        case KindTypeAliasDeclaration:
        case KindFunctionDeclaration:
        case KindFunctionExpression:
        case KindArrowFunction:
        case KindMethodDeclaration:
        case KindMethodSignature:
        case KindGetAccessor:
        case KindSetAccessor:
        case KindCallSignature:
        case KindConstructSignature:
        case KindIndexSignature:
        case KindFunctionType:
        case KindConstructorType:
            return Node_Type(node);
        default:
            return undefined;
    }
};
export const hasTstsAbstractModifier = (node) => hasModifier(node, ModifierFlagsAbstract);
export const hasTstsAmbientModifier = (node) => hasModifier(node, ModifierFlagsAmbient);
export const hasTstsDefaultModifier = (node) => hasModifier(node, ModifierFlagsDefault);
export const hasTstsExportModifier = (node) => hasModifier(node, ModifierFlagsExport);
export const hasTstsParameterPropertyModifier = (node) => hasModifier(node, ModifierFlagsParameterPropertyModifier);
export const hasTstsPrivateModifier = (node) => hasModifier(node, ModifierFlagsPrivate);
export const hasTstsProtectedModifier = (node) => hasModifier(node, ModifierFlagsProtected);
export const hasTstsPublicModifier = (node) => hasModifier(node, ModifierFlagsPublic);
export const hasTstsReadonlyModifier = (node) => hasModifier(node, ModifierFlagsReadonly);
export const hasTstsStaticModifier = (node) => hasModifier(node, ModifierFlagsStatic);
export const isTstsOptionalParameter = (node) => node !== undefined && Node_QuestionToken(node) !== undefined;
export const isTstsRestParameter = (node) => {
    if (!node)
        return false;
    if (node.Kind === KindParameter) {
        return AsParameterDeclaration(node)?.DotDotDotToken !== undefined;
    }
    return AsBindingElement(node)?.DotDotDotToken !== undefined;
};
export const isTstsParameterDeclaration = (node) => node?.Kind === KindParameter;
export const isTstsPropertyDeclarationLike = (node) => node?.Kind === KindPropertyDeclaration ||
    node?.Kind === KindPropertySignature;
export const isTstsClassDeclaration = (node) => node?.Kind === KindClassDeclaration;
export const isTstsInterfaceDeclaration = (node) => node?.Kind === KindInterfaceDeclaration;
export const isTstsCallExpression = (node) => node?.Kind === KindCallExpression;
export const isTstsFunctionLikeDeclaration = (node) => IsFunctionLikeDeclaration(node);
export const isTstsDeclarationFileNode = (node) => {
    const sourceFile = node?.Kind === KindSourceFile
        ? node
        : getTstsContainingSourceFile(node);
    return sourceFile ? IsDeclarationFileName(SourceFile_FileName(sourceFile)) : false;
};
export const isTstsExternalModuleSourceFile = (sourceFile) => IsExternalOrCommonJSModule(sourceFile);
export const isTstsModuleBoundaryStatement = (node) => node?.Kind === KindImportDeclaration ||
    node?.Kind === KindImportEqualsDeclaration ||
    node?.Kind === KindExportDeclaration ||
    node?.Kind === KindExportAssignment;
export const tstsSymbolMeaningValue = SymbolFlagsValue;
export const getTstsExpressionName = (node) => {
    const identifierText = getTstsIdentifierText(node);
    if (identifierText)
        return identifierText;
    return node?.Kind === KindPropertyAccessExpression
        ? getTstsNodeNameText(node)
        : undefined;
};
export const getTstsExpressionWithTypeArgumentsName = (node) => node?.Kind === KindExpressionWithTypeArguments
    ? getTstsExpressionName(Node_Expression(node))
    : undefined;
export const getTstsCallExpressionDetails = (node) => node?.Kind === KindCallExpression
    ? {
        calleeName: getTstsExpressionName(Node_Expression(node)),
        expression: Node_Expression(node),
        arguments: Node_Arguments(node) ?? [],
        typeArguments: getTstsTypeArguments(node),
    }
    : undefined;
export const getTstsHeritageTypeNodes = (node) => {
    const heritageClauses = node?.Kind === KindInterfaceDeclaration
        ? AsInterfaceDeclaration(node)?.HeritageClauses
        : node?.Kind === KindClassDeclaration
            ? AsClassDeclaration(node)?.HeritageClauses
            : undefined;
    const types = [];
    for (const clauseNode of heritageClauses?.Nodes ?? []) {
        const clause = AsHeritageClause(clauseNode);
        types.push(...(clause?.Types?.Nodes ?? []));
    }
    return types;
};
const heritageClauseKind = (clause) => {
    if (clause?.Token === KindExtendsKeyword)
        return "extends";
    if (clause?.Token === KindImplementsKeyword)
        return "implements";
    return undefined;
};
export const getTstsHeritageClauseDetails = (node) => {
    const heritageClauses = node?.Kind === KindInterfaceDeclaration
        ? AsInterfaceDeclaration(node)?.HeritageClauses
        : node?.Kind === KindClassDeclaration
            ? AsClassDeclaration(node)?.HeritageClauses
            : undefined;
    const result = [];
    for (const clauseNode of heritageClauses?.Nodes ?? []) {
        const clause = AsHeritageClause(clauseNode);
        const kind = heritageClauseKind(clause);
        if (!kind)
            continue;
        result.push({
            kind,
            clause: clauseNode,
            types: clause?.Types?.Nodes ?? [],
        });
    }
    return result;
};
export const getTstsExportModuleSpecifiersFromStatements = (statements) => {
    const specifiers = [];
    for (const statement of statements) {
        if (statement?.Kind !== KindExportDeclaration)
            continue;
        const declaration = AsExportDeclaration(statement);
        const moduleSpecifier = declaration?.ModuleSpecifier ?? Node_ModuleSpecifier(statement);
        const text = moduleSpecifier?.Kind === KindStringLiteral
            ? AsStringLiteral(moduleSpecifier)?.Text
            : getTstsNodeText(moduleSpecifier);
        if (text) {
            specifiers.push(text);
        }
    }
    return specifiers;
};
export const getTstsImportTypeModuleSpecifiers = (node) => {
    const specifiers = [];
    visitTstsSubtree(node, (current) => {
        const literal = getImportTypeNodeLiteral(current);
        const text = literal?.Kind === KindStringLiteral
            ? AsStringLiteral(literal)?.Text
            : undefined;
        if (text) {
            specifiers.push(text);
        }
    });
    return specifiers;
};
//# sourceMappingURL=ast-helpers.js.map