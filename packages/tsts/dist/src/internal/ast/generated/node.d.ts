import type { GoPtr, GoSlice } from "../../../go/compat.js";
import { Uint32 } from "../../../go/sync/atomic.js";
import type { ModifierList, Node, NodeBase, NodeList } from "../spine.js";
import type { ModifierFlags } from "../modifierflags.js";
import type { TokenFlags } from "../tokenflags.js";
import type { AsteriskToken, BlockOrExpression, ClassElementList, HeritageClauseList, IdentifierNode, NodeBody, ParameterList, PropertyName, Statement, TypeList, TypeNode, TypeParameterList } from "./unions.js";
export interface StatementBase extends NodeBase, FlowNodeBase {
    readonly _statementBrand?: never;
}
export interface IterationStatementBase extends StatementBase {
    Statement: GoPtr<Statement>;
}
export interface ExpressionBase extends NodeBase {
    readonly _expressionBrand?: never;
}
export interface UnaryExpressionBase extends ExpressionBase {
    readonly _unaryExpressionBrand?: never;
}
export interface UpdateExpressionBase extends UnaryExpressionBase {
    readonly _updateExpressionBrand?: never;
}
export interface LeftHandSideExpressionBase extends UpdateExpressionBase {
    readonly _leftHandSideExpressionBrand?: never;
}
export interface MemberExpressionBase extends LeftHandSideExpressionBase {
    readonly _memberExpressionBrand?: never;
}
export interface PrimaryExpressionBase extends MemberExpressionBase {
    readonly _primaryExpressionBrand?: never;
}
export interface TypeNodeBase extends NodeBase, TypeSyntaxBase {
    readonly _typeNodeBrand?: never;
}
export interface NodeWithTypeArgumentsBase extends TypeNodeBase {
    TypeArguments: GoPtr<TypeList>;
}
export interface JSDocTypeBase extends TypeNodeBase {
    readonly _jsDocTypeBrand?: never;
}
export interface DeclarationBase {
    readonly _declarationBrand?: never;
}
export interface ExportableBase {
}
export interface ModifiersBase {
    modifiers: GoPtr<ModifierList>;
    modifierFlags: ModifierFlags;
}
export interface LocalsContainerBase {
}
export interface FlowNodeBase {
}
export interface CompositeBase {
    facts: Uint32;
}
export interface TypeSyntaxBase {
}
export interface FunctionLikeBase extends DeclarationBase, LocalsContainerBase {
    TypeParameters: GoPtr<TypeParameterList>;
    Parameters: GoPtr<ParameterList>;
    Type: GoPtr<TypeNode>;
    FullSignature: GoPtr<TypeNode>;
}
export interface BodyBase {
    AsteriskToken: GoPtr<AsteriskToken>;
    Body: GoPtr<NodeBody>;
}
export interface FunctionLikeWithBodyBase extends FunctionLikeBase, BodyBase {
    readonly _functionLikeDeclarationBrand?: never;
    Body: GoPtr<BlockOrExpression>;
}
export interface ClassLikeBase extends DeclarationBase, ExportableBase, ModifiersBase, LocalsContainerBase, CompositeBase {
    name: GoPtr<IdentifierNode>;
    TypeParameters: GoPtr<TypeParameterList>;
    HeritageClauses: GoPtr<HeritageClauseList>;
    Members: GoPtr<ClassElementList>;
}
export interface LiteralLikeNodeBase {
    Text: string;
    TokenFlags: TokenFlags;
}
export interface LiteralExpressionBase extends LiteralLikeNodeBase, PrimaryExpressionBase {
    readonly _literalExpressionBrand?: never;
}
export interface TemplateLiteralLikeNodeBase extends LiteralLikeNodeBase {
    RawText: string;
    TemplateFlags: TokenFlags;
}
export interface TypeElementBase {
    readonly _typeElementBrand?: never;
}
export interface ClassElementBase {
    readonly _classElementBrand?: never;
}
export interface NamedMemberBase extends DeclarationBase, ModifiersBase {
    name: GoPtr<PropertyName>;
    PostfixToken: GoPtr<Node>;
}
export interface ObjectLiteralElementBase {
    readonly _objectLiteralBrand?: never;
}
export interface AccessorDeclarationBase extends NamedMemberBase, FunctionLikeWithBodyBase, FlowNodeBase, TypeElementBase, ClassElementBase, ObjectLiteralElementBase, CompositeBase, NodeBase {
}
export interface FunctionOrConstructorTypeNodeBase extends TypeNodeBase, ModifiersBase, FunctionLikeBase {
}
export interface UnionOrIntersectionTypeNodeBase extends TypeNodeBase {
    Types: GoPtr<TypeList>;
}
export interface JSDocTagBase extends NodeBase {
    TagName: GoPtr<IdentifierNode>;
    Comment: GoPtr<NodeList>;
}
export interface JSDocCommentBase extends NodeBase {
    text: GoSlice<string>;
}
//# sourceMappingURL=node.d.ts.map