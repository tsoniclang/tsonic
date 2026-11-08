import { isTypeSyntaxNode } from "../source-model/syntax.js";
export const ModifierFlagsPublic = 1 << 0;
export const ModifierFlagsPrivate = 1 << 1;
export const ModifierFlagsProtected = 1 << 2;
export const ModifierFlagsReadonly = 1 << 3;
export const ModifierFlagsOverride = 1 << 4;
export const ModifierFlagsAbstract = 1 << 6;
export const ModifierFlagsAmbient = 1 << 7;
export const ModifierFlagsStatic = 1 << 8;
export const ModifierFlagsAccessor = 1 << 9;
export const ModifierFlagsAsync = 1 << 10;
export const ModifierFlagsConst = 1 << 12;
export function HasSyntacticModifier(ast, node, flag) {
    return ast.hasModifier(node, flag);
}
export function Node_Text(ast, node) {
    return node === undefined ? "" : ast.text(node);
}
export function SourceFile_FileName(ast, sourceFile) {
    return ast.getFileName(sourceFile);
}
export function SourceKind(ast, node) {
    return ast.kindName(node);
}
export function HasSourceKind(ast, node, expected) {
    return ast.kindName(node) === expected;
}
export function IsTypeSyntaxNode(ast, node) {
    return isTypeSyntaxNode(ast, node);
}
export function isAstNode(ast, value) {
    return typeof value === "object" &&
        value !== null &&
        ast.kind(value) !== undefined;
}
//# sourceMappingURL=node-access.js.map