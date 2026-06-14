export * from "../internal/ast/generated/index.js";
export { Node_Attributes, Node_CanHaveStatements, Node_Children, Node_ClassName, Node_Comments, Node_Decorators, Node_ImportClause, Node_IsTypeOnly, Node_ModifierFlags, Node_ModifierNodes, Node_PostfixToken, Node_QuestionDotToken, Node_RawText, Node_Statement, Node_Symbol, Node_Text, Node_TypeExpression, SourceFile_BindDiagnostics, SourceFile_Diagnostics, SourceFile_ECMALineMap, SourceFile_FileName, SourceFile_ForEachChild, SourceFile_GetDeclarationMap, SourceFile_GetNameTable, SourceFile_GetPositionMap, SourceFile_Imports, SourceFile_IsBound, SourceFile_IsJS, SourceFile_JSDiagnostics, SourceFile_JSDocDiagnostics, SourceFile_ParseOptions, SourceFile_Path, SourceFile_Text, } from "../internal/ast/ast.js";
export { Node_End, Node_ExportableData, Node_ForEachChild, Node_IterChildren, Node_KindString, Node_KindValue, Node_Modifiers, Node_Name, Node_Pos, Node_SubtreeFacts, NodeList_End, NodeList_HasTrailingComma, NodeList_Pos, } from "../internal/ast/spine.js";
export { ModifierFlagsAmbient, ModifierFlagsAsync, ModifierFlagsExport, } from "../internal/ast/modifierflags.js";
import { Node_ArgumentList as rawNodeArgumentList, Node_Arguments as rawNodeArguments, Node_Body as rawNodeBody, Node_ElementList as rawNodeElementList, Node_Elements as rawNodeElements, Node_Expression as rawNodeExpression, Node_Initializer as rawNodeInitializer, Node_Label as rawNodeLabel, Node_MemberList as rawNodeMemberList, Node_Members as rawNodeMembers, Node_ModuleSpecifier as rawNodeModuleSpecifier, Node_ParameterList as rawNodeParameterList, Node_Parameters as rawNodeParameters, Node_PropertyList as rawNodePropertyList, Node_Properties as rawNodeProperties, Node_PropertyName as rawNodePropertyName, Node_PropertyNameOrName as rawNodePropertyNameOrName, Node_QuestionToken as rawNodeQuestionToken, Node_StatementList as rawNodeStatementList, Node_Statements as rawNodeStatements, Node_Type as rawNodeType, Node_TypeArgumentList as rawNodeTypeArgumentList, Node_TypeArguments as rawNodeTypeArguments, Node_TypeParameterList as rawNodeTypeParameterList, Node_TypeParameters as rawNodeTypeParameters, } from "../internal/ast/ast.js";
const safeNodeAccessor = (node, read) => {
    if (!node)
        return undefined;
    try {
        return read(node);
    }
    catch {
        return undefined;
    }
};
export const Node_ArgumentList = (node) => safeNodeAccessor(node, rawNodeArgumentList);
export const Node_Arguments = (node) => safeNodeAccessor(node, rawNodeArguments);
export const Node_Body = (node) => safeNodeAccessor(node, rawNodeBody);
export const Node_ElementList = (node) => safeNodeAccessor(node, rawNodeElementList);
export const Node_Elements = (node) => safeNodeAccessor(node, rawNodeElements);
export const Node_Expression = (node) => safeNodeAccessor(node, rawNodeExpression);
export const Node_Initializer = (node) => safeNodeAccessor(node, rawNodeInitializer);
export const Node_Label = (node) => safeNodeAccessor(node, rawNodeLabel);
export const Node_MemberList = (node) => safeNodeAccessor(node, rawNodeMemberList);
export const Node_Members = (node) => safeNodeAccessor(node, rawNodeMembers);
export const Node_ModuleSpecifier = (node) => safeNodeAccessor(node, rawNodeModuleSpecifier);
export const Node_ParameterList = (node) => safeNodeAccessor(node, rawNodeParameterList);
export const Node_Parameters = (node) => safeNodeAccessor(node, rawNodeParameters);
export const Node_PropertyList = (node) => safeNodeAccessor(node, rawNodePropertyList);
export const Node_Properties = (node) => safeNodeAccessor(node, rawNodeProperties);
export const Node_PropertyName = (node) => safeNodeAccessor(node, rawNodePropertyName);
export const Node_PropertyNameOrName = (node) => safeNodeAccessor(node, rawNodePropertyNameOrName);
export const Node_QuestionToken = (node) => safeNodeAccessor(node, rawNodeQuestionToken);
export const Node_StatementList = (node) => safeNodeAccessor(node, rawNodeStatementList);
export const Node_Statements = (node) => safeNodeAccessor(node, rawNodeStatements);
export const Node_Type = (node) => safeNodeAccessor(node, rawNodeType);
export const Node_TypeArgumentList = (node) => safeNodeAccessor(node, rawNodeTypeArgumentList);
export const Node_TypeArguments = (node) => safeNodeAccessor(node, rawNodeTypeArguments);
export const Node_TypeParameterList = (node) => safeNodeAccessor(node, rawNodeTypeParameterList);
export const Node_TypeParameters = (node) => safeNodeAccessor(node, rawNodeTypeParameters);
//# sourceMappingURL=syntax.js.map