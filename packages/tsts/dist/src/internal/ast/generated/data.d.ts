import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Kind } from "./kinds.js";
import type { Node, NodeBase, NodeFactoryCoercible, NodeList, NodeVisitor, Visitor, nodeData } from "../spine.js";
import type { SubtreeFacts } from "../subtreefacts.js";
import type { AccessorDeclarationBase, BodyBase, ClassElementBase, ClassLikeBase, CompositeBase, DeclarationBase, ExportableBase, ExpressionBase, FlowNodeBase, FunctionLikeBase, FunctionLikeWithBodyBase, FunctionOrConstructorTypeNodeBase, IterationStatementBase, JSDocCommentBase, JSDocTagBase, JSDocTypeBase, LeftHandSideExpressionBase, LiteralExpressionBase, LiteralLikeNodeBase, LocalsContainerBase, MemberExpressionBase, ModifiersBase, NamedMemberBase, NodeWithTypeArgumentsBase, ObjectLiteralElementBase, PrimaryExpressionBase, StatementBase, TemplateLiteralLikeNodeBase, TypeElementBase, TypeNodeBase, TypeSyntaxBase, UnaryExpressionBase, UnionOrIntersectionTypeNodeBase, UpdateExpressionBase } from "./node.js";
import type { AssertsKeyword, AsteriskToken, AwaitKeyword, BinaryOperatorToken, BindingElementList, BindingName, BlockNode, CaseBlockNode, CaseClausesList, CatchClauseNode, ColonToken, DotDotDotToken, ElementList, EntityName, EnumMemberList, EqualsGreaterThanToken, EqualsToken, ExclamationToken, ExportSpecifierList, Expression, ExpressionWithTypeArgumentsList, ExpressionWithTypeArgumentsNode, ForInitializer, HeritageClauseList, IdentifierNode, ImportAttributeList, ImportAttributeName, ImportAttributesNode, ImportClauseNode, ImportSpecifierList, JSDocFullName, JsxAttributeList, JsxAttributeName, JsxAttributeValue, JsxAttributesNode, JsxChildList, JsxClosingElementNode, JsxClosingFragmentNode, JsxOpeningElementNode, JsxOpeningFragmentNode, JsxTagNameExpression, LeftHandSideExpression, MemberName, ModuleExportName, ModuleName, ModuleReference, NamedExportBindings, NamedImportBindings, PropertyName, QuestionDotToken, QuestionToken, Statement, StatementList, TemplateHeadNode, TemplateLiteral, TemplateLiteralTypeSpanList, TemplateMiddleOrTail, TemplateSpanList, TypeElementList, TypeList, TypeNode, TypeParameterDeclarationNode, TypeParameterList, TypePredicateParameterName, VariableDeclarationListNode, VariableDeclarationNode, VariableDeclarationNodeList } from "./unions.js";
export interface Token extends NodeBase {
}
export declare function Token_Clone(receiver: GoPtr<Token>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function Token_as_nodeData(receiver: GoPtr<Token>): nodeData;
export declare function createTokenData(): Token & nodeData;
export interface Identifier extends PrimaryExpressionBase, FlowNodeBase {
    Text: string;
}
export declare function Identifier_Clone(receiver: GoPtr<Identifier>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function Identifier_as_nodeData(receiver: GoPtr<Identifier>): nodeData;
export declare function createIdentifierData(): Identifier & nodeData;
export interface PrivateIdentifier extends PrimaryExpressionBase {
    Text: string;
}
export declare function PrivateIdentifier_Clone(receiver: GoPtr<PrivateIdentifier>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PrivateIdentifier_as_nodeData(receiver: GoPtr<PrivateIdentifier>): nodeData;
export declare function createPrivateIdentifierData(): PrivateIdentifier & nodeData;
export interface QualifiedName extends NodeBase, FlowNodeBase, CompositeBase {
    Left: GoPtr<EntityName>;
    Right: GoPtr<IdentifierNode>;
}
export declare function QualifiedName_Clone(receiver: GoPtr<QualifiedName>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function QualifiedName_ForEachChild(receiver: GoPtr<QualifiedName>, v: Visitor): bool;
export declare function QualifiedName_VisitEachChild(receiver: GoPtr<QualifiedName>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function QualifiedName_computeSubtreeFacts(receiver: GoPtr<QualifiedName>): SubtreeFacts;
export declare function QualifiedName_as_nodeData(receiver: GoPtr<QualifiedName>): nodeData;
export declare function createQualifiedNameData(): QualifiedName & nodeData;
export interface ComputedPropertyName extends NodeBase, CompositeBase {
    Expression: GoPtr<Expression>;
}
export declare function ComputedPropertyName_Clone(receiver: GoPtr<ComputedPropertyName>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ComputedPropertyName_ForEachChild(receiver: GoPtr<ComputedPropertyName>, v: Visitor): bool;
export declare function ComputedPropertyName_VisitEachChild(receiver: GoPtr<ComputedPropertyName>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ComputedPropertyName_computeSubtreeFacts(receiver: GoPtr<ComputedPropertyName>): SubtreeFacts;
export declare function ComputedPropertyName_as_nodeData(receiver: GoPtr<ComputedPropertyName>): nodeData;
export declare function createComputedPropertyNameData(): ComputedPropertyName & nodeData;
export interface Decorator extends NodeBase, CompositeBase {
    Expression: GoPtr<LeftHandSideExpression>;
}
export declare function Decorator_Clone(receiver: GoPtr<Decorator>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function Decorator_ForEachChild(receiver: GoPtr<Decorator>, v: Visitor): bool;
export declare function Decorator_VisitEachChild(receiver: GoPtr<Decorator>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function Decorator_as_nodeData(receiver: GoPtr<Decorator>): nodeData;
export declare function createDecoratorData(): Decorator & nodeData;
export interface EmptyStatement extends StatementBase {
}
export declare function EmptyStatement_Clone(receiver: GoPtr<EmptyStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function EmptyStatement_as_nodeData(receiver: GoPtr<EmptyStatement>): nodeData;
export declare function createEmptyStatementData(): EmptyStatement & nodeData;
export interface IfStatement extends StatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
    ThenStatement: GoPtr<Statement>;
    ElseStatement: GoPtr<Statement>;
}
export declare function IfStatement_Clone(receiver: GoPtr<IfStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function IfStatement_ForEachChild(receiver: GoPtr<IfStatement>, v: Visitor): bool;
export declare function IfStatement_VisitEachChild(receiver: GoPtr<IfStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function IfStatement_computeSubtreeFacts(receiver: GoPtr<IfStatement>): SubtreeFacts;
export declare function IfStatement_as_nodeData(receiver: GoPtr<IfStatement>): nodeData;
export declare function createIfStatementData(): IfStatement & nodeData;
export interface DoStatement extends IterationStatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
}
export declare function DoStatement_Clone(receiver: GoPtr<DoStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function DoStatement_ForEachChild(receiver: GoPtr<DoStatement>, v: Visitor): bool;
export declare function DoStatement_VisitEachChild(receiver: GoPtr<DoStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function DoStatement_computeSubtreeFacts(receiver: GoPtr<DoStatement>): SubtreeFacts;
export declare function DoStatement_as_nodeData(receiver: GoPtr<DoStatement>): nodeData;
export declare function createDoStatementData(): DoStatement & nodeData;
export interface WhileStatement extends IterationStatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
}
export declare function WhileStatement_Clone(receiver: GoPtr<WhileStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function WhileStatement_ForEachChild(receiver: GoPtr<WhileStatement>, v: Visitor): bool;
export declare function WhileStatement_VisitEachChild(receiver: GoPtr<WhileStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function WhileStatement_computeSubtreeFacts(receiver: GoPtr<WhileStatement>): SubtreeFacts;
export declare function WhileStatement_as_nodeData(receiver: GoPtr<WhileStatement>): nodeData;
export declare function createWhileStatementData(): WhileStatement & nodeData;
export interface ForStatement extends IterationStatementBase, LocalsContainerBase, CompositeBase {
    Initializer: GoPtr<ForInitializer>;
    Condition: GoPtr<Expression>;
    Incrementor: GoPtr<Expression>;
}
export declare function ForStatement_Clone(receiver: GoPtr<ForStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ForStatement_ForEachChild(receiver: GoPtr<ForStatement>, v: Visitor): bool;
export declare function ForStatement_VisitEachChild(receiver: GoPtr<ForStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ForStatement_computeSubtreeFacts(receiver: GoPtr<ForStatement>): SubtreeFacts;
export declare function ForStatement_as_nodeData(receiver: GoPtr<ForStatement>): nodeData;
export declare function createForStatementData(): ForStatement & nodeData;
export interface ForInOrOfStatement extends StatementBase, LocalsContainerBase, CompositeBase {
    AwaitModifier: GoPtr<AwaitKeyword>;
    Initializer: GoPtr<ForInitializer>;
    Expression: GoPtr<Expression>;
    Statement: GoPtr<Statement>;
}
export declare function ForInOrOfStatement_Clone(receiver: GoPtr<ForInOrOfStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ForInOrOfStatement_ForEachChild(receiver: GoPtr<ForInOrOfStatement>, v: Visitor): bool;
export declare function ForInOrOfStatement_VisitEachChild(receiver: GoPtr<ForInOrOfStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ForInOrOfStatement_as_nodeData(receiver: GoPtr<ForInOrOfStatement>): nodeData;
export declare function createForInOrOfStatementData(): ForInOrOfStatement & nodeData;
export interface BreakStatement extends StatementBase {
    Label: GoPtr<IdentifierNode>;
}
export declare function BreakStatement_Clone(receiver: GoPtr<BreakStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function BreakStatement_ForEachChild(receiver: GoPtr<BreakStatement>, v: Visitor): bool;
export declare function BreakStatement_VisitEachChild(receiver: GoPtr<BreakStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function BreakStatement_as_nodeData(receiver: GoPtr<BreakStatement>): nodeData;
export declare function createBreakStatementData(): BreakStatement & nodeData;
export interface ContinueStatement extends StatementBase {
    Label: GoPtr<IdentifierNode>;
}
export declare function ContinueStatement_Clone(receiver: GoPtr<ContinueStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ContinueStatement_ForEachChild(receiver: GoPtr<ContinueStatement>, v: Visitor): bool;
export declare function ContinueStatement_VisitEachChild(receiver: GoPtr<ContinueStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ContinueStatement_as_nodeData(receiver: GoPtr<ContinueStatement>): nodeData;
export declare function createContinueStatementData(): ContinueStatement & nodeData;
export interface ReturnStatement extends StatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
}
export declare function ReturnStatement_Clone(receiver: GoPtr<ReturnStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ReturnStatement_ForEachChild(receiver: GoPtr<ReturnStatement>, v: Visitor): bool;
export declare function ReturnStatement_VisitEachChild(receiver: GoPtr<ReturnStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ReturnStatement_as_nodeData(receiver: GoPtr<ReturnStatement>): nodeData;
export declare function createReturnStatementData(): ReturnStatement & nodeData;
export interface WithStatement extends StatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
    Statement: GoPtr<Statement>;
}
export declare function WithStatement_Clone(receiver: GoPtr<WithStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function WithStatement_ForEachChild(receiver: GoPtr<WithStatement>, v: Visitor): bool;
export declare function WithStatement_VisitEachChild(receiver: GoPtr<WithStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function WithStatement_computeSubtreeFacts(receiver: GoPtr<WithStatement>): SubtreeFacts;
export declare function WithStatement_as_nodeData(receiver: GoPtr<WithStatement>): nodeData;
export declare function createWithStatementData(): WithStatement & nodeData;
export interface SwitchStatement extends StatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
    CaseBlock: GoPtr<CaseBlockNode>;
}
export declare function SwitchStatement_Clone(receiver: GoPtr<SwitchStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SwitchStatement_ForEachChild(receiver: GoPtr<SwitchStatement>, v: Visitor): bool;
export declare function SwitchStatement_VisitEachChild(receiver: GoPtr<SwitchStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SwitchStatement_computeSubtreeFacts(receiver: GoPtr<SwitchStatement>): SubtreeFacts;
export declare function SwitchStatement_as_nodeData(receiver: GoPtr<SwitchStatement>): nodeData;
export declare function createSwitchStatementData(): SwitchStatement & nodeData;
export interface CaseBlock extends NodeBase, LocalsContainerBase, CompositeBase {
    Clauses: GoPtr<CaseClausesList>;
}
export declare function CaseBlock_Clone(receiver: GoPtr<CaseBlock>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function CaseBlock_ForEachChild(receiver: GoPtr<CaseBlock>, v: Visitor): bool;
export declare function CaseBlock_VisitEachChild(receiver: GoPtr<CaseBlock>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function CaseBlock_computeSubtreeFacts(receiver: GoPtr<CaseBlock>): SubtreeFacts;
export declare function CaseBlock_as_nodeData(receiver: GoPtr<CaseBlock>): nodeData;
export declare function createCaseBlockData(): CaseBlock & nodeData;
export interface CaseOrDefaultClause extends NodeBase, CompositeBase {
    Expression: GoPtr<Expression>;
    Statements: GoPtr<StatementList>;
}
export declare function CaseOrDefaultClause_Clone(receiver: GoPtr<CaseOrDefaultClause>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function CaseOrDefaultClause_ForEachChild(receiver: GoPtr<CaseOrDefaultClause>, v: Visitor): bool;
export declare function CaseOrDefaultClause_VisitEachChild(receiver: GoPtr<CaseOrDefaultClause>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function CaseOrDefaultClause_computeSubtreeFacts(receiver: GoPtr<CaseOrDefaultClause>): SubtreeFacts;
export declare function CaseOrDefaultClause_as_nodeData(receiver: GoPtr<CaseOrDefaultClause>): nodeData;
export declare function createCaseOrDefaultClauseData(): CaseOrDefaultClause & nodeData;
export interface ThrowStatement extends StatementBase, CompositeBase {
    Expression: GoPtr<Expression>;
}
export declare function ThrowStatement_Clone(receiver: GoPtr<ThrowStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ThrowStatement_ForEachChild(receiver: GoPtr<ThrowStatement>, v: Visitor): bool;
export declare function ThrowStatement_VisitEachChild(receiver: GoPtr<ThrowStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ThrowStatement_computeSubtreeFacts(receiver: GoPtr<ThrowStatement>): SubtreeFacts;
export declare function ThrowStatement_as_nodeData(receiver: GoPtr<ThrowStatement>): nodeData;
export declare function createThrowStatementData(): ThrowStatement & nodeData;
export interface TryStatement extends StatementBase, CompositeBase {
    TryBlock: GoPtr<BlockNode>;
    CatchClause: GoPtr<CatchClauseNode>;
    FinallyBlock: GoPtr<BlockNode>;
}
export declare function TryStatement_Clone(receiver: GoPtr<TryStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TryStatement_ForEachChild(receiver: GoPtr<TryStatement>, v: Visitor): bool;
export declare function TryStatement_VisitEachChild(receiver: GoPtr<TryStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TryStatement_computeSubtreeFacts(receiver: GoPtr<TryStatement>): SubtreeFacts;
export declare function TryStatement_as_nodeData(receiver: GoPtr<TryStatement>): nodeData;
export declare function createTryStatementData(): TryStatement & nodeData;
export interface CatchClause extends NodeBase, LocalsContainerBase, CompositeBase {
    VariableDeclaration: GoPtr<VariableDeclarationNode>;
    Block: GoPtr<BlockNode>;
}
export declare function CatchClause_Clone(receiver: GoPtr<CatchClause>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function CatchClause_ForEachChild(receiver: GoPtr<CatchClause>, v: Visitor): bool;
export declare function CatchClause_VisitEachChild(receiver: GoPtr<CatchClause>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function CatchClause_as_nodeData(receiver: GoPtr<CatchClause>): nodeData;
export declare function createCatchClauseData(): CatchClause & nodeData;
export interface DebuggerStatement extends StatementBase {
}
export declare function DebuggerStatement_Clone(receiver: GoPtr<DebuggerStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function DebuggerStatement_as_nodeData(receiver: GoPtr<DebuggerStatement>): nodeData;
export declare function createDebuggerStatementData(): DebuggerStatement & nodeData;
export interface LabeledStatement extends StatementBase {
    Label: GoPtr<IdentifierNode>;
    Statement: GoPtr<Statement>;
}
export declare function LabeledStatement_Clone(receiver: GoPtr<LabeledStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function LabeledStatement_ForEachChild(receiver: GoPtr<LabeledStatement>, v: Visitor): bool;
export declare function LabeledStatement_VisitEachChild(receiver: GoPtr<LabeledStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function LabeledStatement_computeSubtreeFacts(receiver: GoPtr<LabeledStatement>): SubtreeFacts;
export declare function LabeledStatement_as_nodeData(receiver: GoPtr<LabeledStatement>): nodeData;
export declare function createLabeledStatementData(): LabeledStatement & nodeData;
export interface ExpressionStatement extends StatementBase {
    Expression: GoPtr<Expression>;
}
export declare function ExpressionStatement_Clone(receiver: GoPtr<ExpressionStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExpressionStatement_ForEachChild(receiver: GoPtr<ExpressionStatement>, v: Visitor): bool;
export declare function ExpressionStatement_VisitEachChild(receiver: GoPtr<ExpressionStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExpressionStatement_computeSubtreeFacts(receiver: GoPtr<ExpressionStatement>): SubtreeFacts;
export declare function ExpressionStatement_as_nodeData(receiver: GoPtr<ExpressionStatement>): nodeData;
export declare function createExpressionStatementData(): ExpressionStatement & nodeData;
export interface Block extends StatementBase, LocalsContainerBase, CompositeBase {
    Statements: GoPtr<StatementList>;
    MultiLine: bool;
}
export declare function Block_Clone(receiver: GoPtr<Block>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function Block_ForEachChild(receiver: GoPtr<Block>, v: Visitor): bool;
export declare function Block_VisitEachChild(receiver: GoPtr<Block>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function Block_computeSubtreeFacts(receiver: GoPtr<Block>): SubtreeFacts;
export declare function Block_as_nodeData(receiver: GoPtr<Block>): nodeData;
export declare function createBlockData(): Block & nodeData;
export interface VariableStatement extends StatementBase, ModifiersBase, CompositeBase {
    DeclarationList: GoPtr<VariableDeclarationListNode>;
}
export declare function VariableStatement_Clone(receiver: GoPtr<VariableStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function VariableStatement_ForEachChild(receiver: GoPtr<VariableStatement>, v: Visitor): bool;
export declare function VariableStatement_VisitEachChild(receiver: GoPtr<VariableStatement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function VariableStatement_as_nodeData(receiver: GoPtr<VariableStatement>): nodeData;
export declare function createVariableStatementData(): VariableStatement & nodeData;
export interface VariableDeclaration extends NodeBase, DeclarationBase, ExportableBase, CompositeBase {
    name: GoPtr<BindingName>;
    ExclamationToken: GoPtr<ExclamationToken>;
    Type: GoPtr<TypeNode>;
    Initializer: GoPtr<Expression>;
}
export declare function VariableDeclaration_Clone(receiver: GoPtr<VariableDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function VariableDeclaration_Name(receiver: GoPtr<VariableDeclaration>): GoPtr<Node>;
export declare function VariableDeclaration_ForEachChild(receiver: GoPtr<VariableDeclaration>, v: Visitor): bool;
export declare function VariableDeclaration_VisitEachChild(receiver: GoPtr<VariableDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function VariableDeclaration_as_nodeData(receiver: GoPtr<VariableDeclaration>): nodeData;
export declare function createVariableDeclarationData(): VariableDeclaration & nodeData;
export interface VariableDeclarationList extends NodeBase, CompositeBase {
    Declarations: GoPtr<VariableDeclarationNodeList>;
}
export declare function VariableDeclarationList_Clone(receiver: GoPtr<VariableDeclarationList>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function VariableDeclarationList_ForEachChild(receiver: GoPtr<VariableDeclarationList>, v: Visitor): bool;
export declare function VariableDeclarationList_VisitEachChild(receiver: GoPtr<VariableDeclarationList>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function VariableDeclarationList_as_nodeData(receiver: GoPtr<VariableDeclarationList>): nodeData;
export declare function createVariableDeclarationListData(): VariableDeclarationList & nodeData;
export interface BindingPattern extends NodeBase, CompositeBase {
    Elements: GoPtr<BindingElementList>;
}
export declare function BindingPattern_Clone(receiver: GoPtr<BindingPattern>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function BindingPattern_ForEachChild(receiver: GoPtr<BindingPattern>, v: Visitor): bool;
export declare function BindingPattern_VisitEachChild(receiver: GoPtr<BindingPattern>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function BindingPattern_as_nodeData(receiver: GoPtr<BindingPattern>): nodeData;
export declare function createBindingPatternData(): BindingPattern & nodeData;
export interface ParameterDeclaration extends NodeBase, DeclarationBase, ModifiersBase, CompositeBase {
    DotDotDotToken: GoPtr<DotDotDotToken>;
    name: GoPtr<BindingName>;
    QuestionToken: GoPtr<QuestionToken>;
    Type: GoPtr<TypeNode>;
    Initializer: GoPtr<Expression>;
}
export declare function ParameterDeclaration_Clone(receiver: GoPtr<ParameterDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ParameterDeclaration_Name(receiver: GoPtr<ParameterDeclaration>): GoPtr<Node>;
export declare function ParameterDeclaration_ForEachChild(receiver: GoPtr<ParameterDeclaration>, v: Visitor): bool;
export declare function ParameterDeclaration_VisitEachChild(receiver: GoPtr<ParameterDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ParameterDeclaration_as_nodeData(receiver: GoPtr<ParameterDeclaration>): nodeData;
export declare function createParameterDeclarationData(): ParameterDeclaration & nodeData;
export interface BindingElement extends NodeBase, DeclarationBase, ExportableBase, FlowNodeBase, CompositeBase {
    DotDotDotToken: GoPtr<DotDotDotToken>;
    PropertyName: GoPtr<PropertyName>;
    name: GoPtr<BindingName>;
    Initializer: GoPtr<Expression>;
}
export declare function BindingElement_Clone(receiver: GoPtr<BindingElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function BindingElement_Name(receiver: GoPtr<BindingElement>): GoPtr<Node>;
export declare function BindingElement_ForEachChild(receiver: GoPtr<BindingElement>, v: Visitor): bool;
export declare function BindingElement_VisitEachChild(receiver: GoPtr<BindingElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function BindingElement_as_nodeData(receiver: GoPtr<BindingElement>): nodeData;
export declare function createBindingElementData(): BindingElement & nodeData;
export interface MissingDeclaration extends StatementBase, DeclarationBase, ModifiersBase {
}
export declare function MissingDeclaration_Clone(receiver: GoPtr<MissingDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function MissingDeclaration_ForEachChild(receiver: GoPtr<MissingDeclaration>, v: Visitor): bool;
export declare function MissingDeclaration_VisitEachChild(receiver: GoPtr<MissingDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function MissingDeclaration_as_nodeData(receiver: GoPtr<MissingDeclaration>): nodeData;
export declare function createMissingDeclarationData(): MissingDeclaration & nodeData;
export interface FunctionDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, FunctionLikeWithBodyBase, CompositeBase {
    name: GoPtr<IdentifierNode>;
}
export declare function FunctionDeclaration_Clone(receiver: GoPtr<FunctionDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function FunctionDeclaration_Name(receiver: GoPtr<FunctionDeclaration>): GoPtr<Node>;
export declare function FunctionDeclaration_ForEachChild(receiver: GoPtr<FunctionDeclaration>, v: Visitor): bool;
export declare function FunctionDeclaration_VisitEachChild(receiver: GoPtr<FunctionDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function FunctionDeclaration_as_nodeData(receiver: GoPtr<FunctionDeclaration>): nodeData;
export declare function createFunctionDeclarationData(): FunctionDeclaration & nodeData;
export interface ClassDeclaration extends DeclarationBase, StatementBase, ClassLikeBase {
}
export declare function ClassDeclaration_Clone(receiver: GoPtr<ClassDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ClassDeclaration_Name(receiver: GoPtr<ClassDeclaration>): GoPtr<Node>;
export declare function ClassDeclaration_ForEachChild(receiver: GoPtr<ClassDeclaration>, v: Visitor): bool;
export declare function ClassDeclaration_VisitEachChild(receiver: GoPtr<ClassDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ClassDeclaration_as_nodeData(receiver: GoPtr<ClassDeclaration>): nodeData;
export declare function createClassDeclarationData(): ClassDeclaration & nodeData;
export interface ClassExpression extends PrimaryExpressionBase, ClassLikeBase {
}
export declare function ClassExpression_Clone(receiver: GoPtr<ClassExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ClassExpression_Name(receiver: GoPtr<ClassExpression>): GoPtr<Node>;
export declare function ClassExpression_ForEachChild(receiver: GoPtr<ClassExpression>, v: Visitor): bool;
export declare function ClassExpression_VisitEachChild(receiver: GoPtr<ClassExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ClassExpression_as_nodeData(receiver: GoPtr<ClassExpression>): nodeData;
export declare function createClassExpressionData(): ClassExpression & nodeData;
export interface HeritageClause extends NodeBase, CompositeBase {
    Token: Kind;
    Types: GoPtr<ExpressionWithTypeArgumentsList>;
}
export declare function HeritageClause_Clone(receiver: GoPtr<HeritageClause>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function HeritageClause_ForEachChild(receiver: GoPtr<HeritageClause>, v: Visitor): bool;
export declare function HeritageClause_VisitEachChild(receiver: GoPtr<HeritageClause>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function HeritageClause_as_nodeData(receiver: GoPtr<HeritageClause>): nodeData;
export declare function createHeritageClauseData(): HeritageClause & nodeData;
export interface InterfaceDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, TypeSyntaxBase {
    name: GoPtr<IdentifierNode>;
    TypeParameters: GoPtr<TypeParameterList>;
    HeritageClauses: GoPtr<HeritageClauseList>;
    Members: GoPtr<TypeElementList>;
}
export declare function InterfaceDeclaration_Clone(receiver: GoPtr<InterfaceDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function InterfaceDeclaration_Name(receiver: GoPtr<InterfaceDeclaration>): GoPtr<Node>;
export declare function InterfaceDeclaration_ForEachChild(receiver: GoPtr<InterfaceDeclaration>, v: Visitor): bool;
export declare function InterfaceDeclaration_VisitEachChild(receiver: GoPtr<InterfaceDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function InterfaceDeclaration_as_nodeData(receiver: GoPtr<InterfaceDeclaration>): nodeData;
export declare function createInterfaceDeclarationData(): InterfaceDeclaration & nodeData;
export interface TypeAliasDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, LocalsContainerBase, TypeSyntaxBase {
    name: GoPtr<IdentifierNode>;
    TypeParameters: GoPtr<TypeParameterList>;
    Type: GoPtr<TypeNode>;
}
export declare function TypeAliasDeclaration_Clone(receiver: GoPtr<TypeAliasDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeAliasDeclaration_Name(receiver: GoPtr<TypeAliasDeclaration>): GoPtr<Node>;
export declare function TypeAliasDeclaration_ForEachChild(receiver: GoPtr<TypeAliasDeclaration>, v: Visitor): bool;
export declare function TypeAliasDeclaration_VisitEachChild(receiver: GoPtr<TypeAliasDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeAliasDeclaration_as_nodeData(receiver: GoPtr<TypeAliasDeclaration>): nodeData;
export declare function createTypeAliasDeclarationData(): TypeAliasDeclaration & nodeData;
export interface EnumMember extends NodeBase, NamedMemberBase, CompositeBase {
    Initializer: GoPtr<Expression>;
}
export declare function EnumMember_Clone(receiver: GoPtr<EnumMember>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function EnumMember_Name(receiver: GoPtr<EnumMember>): GoPtr<Node>;
export declare function EnumMember_ForEachChild(receiver: GoPtr<EnumMember>, v: Visitor): bool;
export declare function EnumMember_VisitEachChild(receiver: GoPtr<EnumMember>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function EnumMember_as_nodeData(receiver: GoPtr<EnumMember>): nodeData;
export declare function createEnumMemberData(): EnumMember & nodeData;
export interface EnumDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, CompositeBase {
    name: GoPtr<IdentifierNode>;
    Members: GoPtr<EnumMemberList>;
}
export declare function EnumDeclaration_Clone(receiver: GoPtr<EnumDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function EnumDeclaration_Name(receiver: GoPtr<EnumDeclaration>): GoPtr<Node>;
export declare function EnumDeclaration_ForEachChild(receiver: GoPtr<EnumDeclaration>, v: Visitor): bool;
export declare function EnumDeclaration_VisitEachChild(receiver: GoPtr<EnumDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function EnumDeclaration_as_nodeData(receiver: GoPtr<EnumDeclaration>): nodeData;
export declare function createEnumDeclarationData(): EnumDeclaration & nodeData;
export interface ModuleBlock extends StatementBase, CompositeBase {
    Statements: GoPtr<StatementList>;
}
export declare function ModuleBlock_Clone(receiver: GoPtr<ModuleBlock>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ModuleBlock_ForEachChild(receiver: GoPtr<ModuleBlock>, v: Visitor): bool;
export declare function ModuleBlock_VisitEachChild(receiver: GoPtr<ModuleBlock>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ModuleBlock_computeSubtreeFacts(receiver: GoPtr<ModuleBlock>): SubtreeFacts;
export declare function ModuleBlock_as_nodeData(receiver: GoPtr<ModuleBlock>): nodeData;
export declare function createModuleBlockData(): ModuleBlock & nodeData;
export interface NotEmittedStatement extends StatementBase {
}
export declare function NotEmittedStatement_Clone(receiver: GoPtr<NotEmittedStatement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NotEmittedStatement_as_nodeData(receiver: GoPtr<NotEmittedStatement>): nodeData;
export declare function createNotEmittedStatementData(): NotEmittedStatement & nodeData;
export interface NotEmittedTypeElement extends NodeBase, TypeElementBase {
}
export declare function NotEmittedTypeElement_Clone(receiver: GoPtr<NotEmittedTypeElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NotEmittedTypeElement_as_nodeData(receiver: GoPtr<NotEmittedTypeElement>): nodeData;
export declare function createNotEmittedTypeElementData(): NotEmittedTypeElement & nodeData;
export interface ImportDeclaration extends StatementBase, ModifiersBase, CompositeBase, DeclarationBase {
    ImportClause: GoPtr<ImportClauseNode>;
    ModuleSpecifier: GoPtr<Expression>;
    Attributes: GoPtr<ImportAttributesNode>;
}
export declare function ImportDeclaration_Clone(receiver: GoPtr<ImportDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportDeclaration_ForEachChild(receiver: GoPtr<ImportDeclaration>, v: Visitor): bool;
export declare function ImportDeclaration_VisitEachChild(receiver: GoPtr<ImportDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportDeclaration_computeSubtreeFacts(receiver: GoPtr<ImportDeclaration>): SubtreeFacts;
export declare function ImportDeclaration_as_nodeData(receiver: GoPtr<ImportDeclaration>): nodeData;
export declare function createImportDeclarationData(): ImportDeclaration & nodeData;
export interface ExternalModuleReference extends NodeBase {
    Expression: GoPtr<Expression>;
}
export declare function ExternalModuleReference_Clone(receiver: GoPtr<ExternalModuleReference>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExternalModuleReference_ForEachChild(receiver: GoPtr<ExternalModuleReference>, v: Visitor): bool;
export declare function ExternalModuleReference_VisitEachChild(receiver: GoPtr<ExternalModuleReference>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExternalModuleReference_computeSubtreeFacts(receiver: GoPtr<ExternalModuleReference>): SubtreeFacts;
export declare function ExternalModuleReference_as_nodeData(receiver: GoPtr<ExternalModuleReference>): nodeData;
export declare function createExternalModuleReferenceData(): ExternalModuleReference & nodeData;
export interface NamespaceImport extends NodeBase, DeclarationBase, ExportableBase {
    name: GoPtr<IdentifierNode>;
}
export declare function NamespaceImport_Clone(receiver: GoPtr<NamespaceImport>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamespaceImport_Name(receiver: GoPtr<NamespaceImport>): GoPtr<Node>;
export declare function NamespaceImport_ForEachChild(receiver: GoPtr<NamespaceImport>, v: Visitor): bool;
export declare function NamespaceImport_VisitEachChild(receiver: GoPtr<NamespaceImport>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamespaceImport_computeSubtreeFacts(receiver: GoPtr<NamespaceImport>): SubtreeFacts;
export declare function NamespaceImport_as_nodeData(receiver: GoPtr<NamespaceImport>): nodeData;
export declare function createNamespaceImportData(): NamespaceImport & nodeData;
export interface NamedImports extends NodeBase, CompositeBase {
    Elements: GoPtr<ImportSpecifierList>;
}
export declare function NamedImports_Clone(receiver: GoPtr<NamedImports>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamedImports_ForEachChild(receiver: GoPtr<NamedImports>, v: Visitor): bool;
export declare function NamedImports_VisitEachChild(receiver: GoPtr<NamedImports>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamedImports_computeSubtreeFacts(receiver: GoPtr<NamedImports>): SubtreeFacts;
export declare function NamedImports_as_nodeData(receiver: GoPtr<NamedImports>): nodeData;
export declare function createNamedImportsData(): NamedImports & nodeData;
export interface ExportAssignment extends DeclarationBase, StatementBase, ModifiersBase, CompositeBase {
    IsExportEquals: bool;
    Type: GoPtr<TypeNode>;
    Expression: GoPtr<Expression>;
}
export declare function ExportAssignment_Clone(receiver: GoPtr<ExportAssignment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExportAssignment_ForEachChild(receiver: GoPtr<ExportAssignment>, v: Visitor): bool;
export declare function ExportAssignment_VisitEachChild(receiver: GoPtr<ExportAssignment>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExportAssignment_as_nodeData(receiver: GoPtr<ExportAssignment>): nodeData;
export declare function createExportAssignmentData(): ExportAssignment & nodeData;
export interface NamespaceExportDeclaration extends DeclarationBase, StatementBase, ModifiersBase, TypeSyntaxBase {
    name: GoPtr<IdentifierNode>;
}
export declare function NamespaceExportDeclaration_Clone(receiver: GoPtr<NamespaceExportDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamespaceExportDeclaration_Name(receiver: GoPtr<NamespaceExportDeclaration>): GoPtr<Node>;
export declare function NamespaceExportDeclaration_ForEachChild(receiver: GoPtr<NamespaceExportDeclaration>, v: Visitor): bool;
export declare function NamespaceExportDeclaration_VisitEachChild(receiver: GoPtr<NamespaceExportDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamespaceExportDeclaration_as_nodeData(receiver: GoPtr<NamespaceExportDeclaration>): nodeData;
export declare function createNamespaceExportDeclarationData(): NamespaceExportDeclaration & nodeData;
export interface NamespaceExport extends NodeBase, DeclarationBase {
    name: GoPtr<ModuleExportName>;
}
export declare function NamespaceExport_Clone(receiver: GoPtr<NamespaceExport>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamespaceExport_Name(receiver: GoPtr<NamespaceExport>): GoPtr<Node>;
export declare function NamespaceExport_ForEachChild(receiver: GoPtr<NamespaceExport>, v: Visitor): bool;
export declare function NamespaceExport_VisitEachChild(receiver: GoPtr<NamespaceExport>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamespaceExport_computeSubtreeFacts(receiver: GoPtr<NamespaceExport>): SubtreeFacts;
export declare function NamespaceExport_as_nodeData(receiver: GoPtr<NamespaceExport>): nodeData;
export declare function createNamespaceExportData(): NamespaceExport & nodeData;
export interface NamedExports extends NodeBase, CompositeBase {
    Elements: GoPtr<ExportSpecifierList>;
}
export declare function NamedExports_Clone(receiver: GoPtr<NamedExports>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamedExports_ForEachChild(receiver: GoPtr<NamedExports>, v: Visitor): bool;
export declare function NamedExports_VisitEachChild(receiver: GoPtr<NamedExports>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamedExports_computeSubtreeFacts(receiver: GoPtr<NamedExports>): SubtreeFacts;
export declare function NamedExports_as_nodeData(receiver: GoPtr<NamedExports>): nodeData;
export declare function createNamedExportsData(): NamedExports & nodeData;
export interface ExportSpecifier extends NodeBase, DeclarationBase, ExportableBase, CompositeBase {
    IsTypeOnly: bool;
    PropertyName: GoPtr<ModuleExportName>;
    name: GoPtr<ModuleExportName>;
}
export declare function ExportSpecifier_Clone(receiver: GoPtr<ExportSpecifier>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExportSpecifier_Name(receiver: GoPtr<ExportSpecifier>): GoPtr<Node>;
export declare function ExportSpecifier_ForEachChild(receiver: GoPtr<ExportSpecifier>, v: Visitor): bool;
export declare function ExportSpecifier_VisitEachChild(receiver: GoPtr<ExportSpecifier>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExportSpecifier_as_nodeData(receiver: GoPtr<ExportSpecifier>): nodeData;
export declare function createExportSpecifierData(): ExportSpecifier & nodeData;
export interface CallSignatureDeclaration extends NodeBase, DeclarationBase, FunctionLikeBase, TypeElementBase, TypeSyntaxBase {
}
export declare function CallSignatureDeclaration_Clone(receiver: GoPtr<CallSignatureDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function CallSignatureDeclaration_ForEachChild(receiver: GoPtr<CallSignatureDeclaration>, v: Visitor): bool;
export declare function CallSignatureDeclaration_VisitEachChild(receiver: GoPtr<CallSignatureDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function CallSignatureDeclaration_as_nodeData(receiver: GoPtr<CallSignatureDeclaration>): nodeData;
export declare function createCallSignatureDeclarationData(): CallSignatureDeclaration & nodeData;
export interface ConstructSignatureDeclaration extends NodeBase, DeclarationBase, FunctionLikeBase, TypeElementBase, TypeSyntaxBase {
}
export declare function ConstructSignatureDeclaration_Clone(receiver: GoPtr<ConstructSignatureDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ConstructSignatureDeclaration_ForEachChild(receiver: GoPtr<ConstructSignatureDeclaration>, v: Visitor): bool;
export declare function ConstructSignatureDeclaration_VisitEachChild(receiver: GoPtr<ConstructSignatureDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ConstructSignatureDeclaration_as_nodeData(receiver: GoPtr<ConstructSignatureDeclaration>): nodeData;
export declare function createConstructSignatureDeclarationData(): ConstructSignatureDeclaration & nodeData;
export interface ConstructorDeclaration extends NodeBase, DeclarationBase, ModifiersBase, FunctionLikeWithBodyBase, ClassElementBase, CompositeBase {
}
export declare function ConstructorDeclaration_Clone(receiver: GoPtr<ConstructorDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ConstructorDeclaration_ForEachChild(receiver: GoPtr<ConstructorDeclaration>, v: Visitor): bool;
export declare function ConstructorDeclaration_VisitEachChild(receiver: GoPtr<ConstructorDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ConstructorDeclaration_as_nodeData(receiver: GoPtr<ConstructorDeclaration>): nodeData;
export declare function createConstructorDeclarationData(): ConstructorDeclaration & nodeData;
export interface GetAccessorDeclaration extends AccessorDeclarationBase {
}
export declare function GetAccessorDeclaration_Clone(receiver: GoPtr<GetAccessorDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function GetAccessorDeclaration_Name(receiver: GoPtr<GetAccessorDeclaration>): GoPtr<Node>;
export declare function GetAccessorDeclaration_ForEachChild(receiver: GoPtr<GetAccessorDeclaration>, v: Visitor): bool;
export declare function GetAccessorDeclaration_VisitEachChild(receiver: GoPtr<GetAccessorDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function GetAccessorDeclaration_as_nodeData(receiver: GoPtr<GetAccessorDeclaration>): nodeData;
export declare function createGetAccessorDeclarationData(): GetAccessorDeclaration & nodeData;
export interface SetAccessorDeclaration extends AccessorDeclarationBase {
}
export declare function SetAccessorDeclaration_Clone(receiver: GoPtr<SetAccessorDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SetAccessorDeclaration_Name(receiver: GoPtr<SetAccessorDeclaration>): GoPtr<Node>;
export declare function SetAccessorDeclaration_ForEachChild(receiver: GoPtr<SetAccessorDeclaration>, v: Visitor): bool;
export declare function SetAccessorDeclaration_VisitEachChild(receiver: GoPtr<SetAccessorDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SetAccessorDeclaration_as_nodeData(receiver: GoPtr<SetAccessorDeclaration>): nodeData;
export declare function createSetAccessorDeclarationData(): SetAccessorDeclaration & nodeData;
export interface IndexSignatureDeclaration extends NodeBase, DeclarationBase, ModifiersBase, FunctionLikeBase, TypeElementBase, ClassElementBase, TypeSyntaxBase {
}
export declare function IndexSignatureDeclaration_Clone(receiver: GoPtr<IndexSignatureDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function IndexSignatureDeclaration_ForEachChild(receiver: GoPtr<IndexSignatureDeclaration>, v: Visitor): bool;
export declare function IndexSignatureDeclaration_VisitEachChild(receiver: GoPtr<IndexSignatureDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function IndexSignatureDeclaration_as_nodeData(receiver: GoPtr<IndexSignatureDeclaration>): nodeData;
export declare function createIndexSignatureDeclarationData(): IndexSignatureDeclaration & nodeData;
export interface MethodSignatureDeclaration extends NodeBase, NamedMemberBase, FunctionLikeBase, TypeElementBase, TypeSyntaxBase {
}
export declare function MethodSignatureDeclaration_Clone(receiver: GoPtr<MethodSignatureDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function MethodSignatureDeclaration_Name(receiver: GoPtr<MethodSignatureDeclaration>): GoPtr<Node>;
export declare function MethodSignatureDeclaration_ForEachChild(receiver: GoPtr<MethodSignatureDeclaration>, v: Visitor): bool;
export declare function MethodSignatureDeclaration_VisitEachChild(receiver: GoPtr<MethodSignatureDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function MethodSignatureDeclaration_as_nodeData(receiver: GoPtr<MethodSignatureDeclaration>): nodeData;
export declare function createMethodSignatureDeclarationData(): MethodSignatureDeclaration & nodeData;
export interface MethodDeclaration extends NodeBase, NamedMemberBase, FunctionLikeWithBodyBase, FlowNodeBase, ClassElementBase, ObjectLiteralElementBase, CompositeBase {
}
export declare function MethodDeclaration_Clone(receiver: GoPtr<MethodDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function MethodDeclaration_Name(receiver: GoPtr<MethodDeclaration>): GoPtr<Node>;
export declare function MethodDeclaration_ForEachChild(receiver: GoPtr<MethodDeclaration>, v: Visitor): bool;
export declare function MethodDeclaration_VisitEachChild(receiver: GoPtr<MethodDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function MethodDeclaration_as_nodeData(receiver: GoPtr<MethodDeclaration>): nodeData;
export declare function createMethodDeclarationData(): MethodDeclaration & nodeData;
export interface PropertySignatureDeclaration extends NodeBase, NamedMemberBase, TypeElementBase, TypeSyntaxBase {
    Type: GoPtr<TypeNode>;
    Initializer: GoPtr<Expression>;
}
export declare function PropertySignatureDeclaration_Clone(receiver: GoPtr<PropertySignatureDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PropertySignatureDeclaration_Name(receiver: GoPtr<PropertySignatureDeclaration>): GoPtr<Node>;
export declare function PropertySignatureDeclaration_ForEachChild(receiver: GoPtr<PropertySignatureDeclaration>, v: Visitor): bool;
export declare function PropertySignatureDeclaration_VisitEachChild(receiver: GoPtr<PropertySignatureDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PropertySignatureDeclaration_as_nodeData(receiver: GoPtr<PropertySignatureDeclaration>): nodeData;
export declare function createPropertySignatureDeclarationData(): PropertySignatureDeclaration & nodeData;
export interface PropertyDeclaration extends NodeBase, NamedMemberBase, ClassElementBase, CompositeBase {
    Type: GoPtr<TypeNode>;
    Initializer: GoPtr<Expression>;
}
export declare function PropertyDeclaration_Clone(receiver: GoPtr<PropertyDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PropertyDeclaration_Name(receiver: GoPtr<PropertyDeclaration>): GoPtr<Node>;
export declare function PropertyDeclaration_ForEachChild(receiver: GoPtr<PropertyDeclaration>, v: Visitor): bool;
export declare function PropertyDeclaration_VisitEachChild(receiver: GoPtr<PropertyDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PropertyDeclaration_as_nodeData(receiver: GoPtr<PropertyDeclaration>): nodeData;
export declare function createPropertyDeclarationData(): PropertyDeclaration & nodeData;
export interface SemicolonClassElement extends NodeBase, DeclarationBase, ClassElementBase {
}
export declare function SemicolonClassElement_Clone(receiver: GoPtr<SemicolonClassElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SemicolonClassElement_as_nodeData(receiver: GoPtr<SemicolonClassElement>): nodeData;
export declare function createSemicolonClassElementData(): SemicolonClassElement & nodeData;
export interface ClassStaticBlockDeclaration extends NodeBase, DeclarationBase, ModifiersBase, LocalsContainerBase, ClassElementBase, CompositeBase {
    Body: GoPtr<BlockNode>;
}
export declare function ClassStaticBlockDeclaration_Clone(receiver: GoPtr<ClassStaticBlockDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ClassStaticBlockDeclaration_ForEachChild(receiver: GoPtr<ClassStaticBlockDeclaration>, v: Visitor): bool;
export declare function ClassStaticBlockDeclaration_VisitEachChild(receiver: GoPtr<ClassStaticBlockDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ClassStaticBlockDeclaration_as_nodeData(receiver: GoPtr<ClassStaticBlockDeclaration>): nodeData;
export declare function createClassStaticBlockDeclarationData(): ClassStaticBlockDeclaration & nodeData;
export interface OmittedExpression extends ExpressionBase {
}
export declare function OmittedExpression_Clone(receiver: GoPtr<OmittedExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function OmittedExpression_as_nodeData(receiver: GoPtr<OmittedExpression>): nodeData;
export declare function createOmittedExpressionData(): OmittedExpression & nodeData;
export interface KeywordExpression extends ExpressionBase, FlowNodeBase {
}
export declare function KeywordExpression_Clone(receiver: GoPtr<KeywordExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function KeywordExpression_as_nodeData(receiver: GoPtr<KeywordExpression>): nodeData;
export declare function createKeywordExpressionData(): KeywordExpression & nodeData;
export interface StringLiteral extends LiteralExpressionBase {
}
export declare function StringLiteral_Clone(receiver: GoPtr<StringLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function StringLiteral_as_nodeData(receiver: GoPtr<StringLiteral>): nodeData;
export declare function createStringLiteralData(): StringLiteral & nodeData;
export interface NumericLiteral extends LiteralExpressionBase {
}
export declare function NumericLiteral_Clone(receiver: GoPtr<NumericLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NumericLiteral_as_nodeData(receiver: GoPtr<NumericLiteral>): nodeData;
export declare function createNumericLiteralData(): NumericLiteral & nodeData;
export interface BigIntLiteral extends LiteralExpressionBase {
}
export declare function BigIntLiteral_Clone(receiver: GoPtr<BigIntLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function BigIntLiteral_as_nodeData(receiver: GoPtr<BigIntLiteral>): nodeData;
export declare function createBigIntLiteralData(): BigIntLiteral & nodeData;
export interface RegularExpressionLiteral extends LiteralExpressionBase {
}
export declare function RegularExpressionLiteral_Clone(receiver: GoPtr<RegularExpressionLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function RegularExpressionLiteral_as_nodeData(receiver: GoPtr<RegularExpressionLiteral>): nodeData;
export declare function createRegularExpressionLiteralData(): RegularExpressionLiteral & nodeData;
export interface NoSubstitutionTemplateLiteral extends ExpressionBase, TemplateLiteralLikeNodeBase, DeclarationBase {
}
export declare function NoSubstitutionTemplateLiteral_Clone(receiver: GoPtr<NoSubstitutionTemplateLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NoSubstitutionTemplateLiteral_as_nodeData(receiver: GoPtr<NoSubstitutionTemplateLiteral>): nodeData;
export declare function createNoSubstitutionTemplateLiteralData(): NoSubstitutionTemplateLiteral & nodeData;
export interface BinaryExpression extends ExpressionBase, DeclarationBase, ModifiersBase, CompositeBase {
    Left: GoPtr<Expression>;
    Type: GoPtr<TypeNode>;
    OperatorToken: GoPtr<BinaryOperatorToken>;
    Right: GoPtr<Expression>;
}
export declare function BinaryExpression_Clone(receiver: GoPtr<BinaryExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function BinaryExpression_ForEachChild(receiver: GoPtr<BinaryExpression>, v: Visitor): bool;
export declare function BinaryExpression_VisitEachChild(receiver: GoPtr<BinaryExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function BinaryExpression_as_nodeData(receiver: GoPtr<BinaryExpression>): nodeData;
export declare function createBinaryExpressionData(): BinaryExpression & nodeData;
export interface PrefixUnaryExpression extends UpdateExpressionBase {
    Operator: Kind;
    Operand: GoPtr<Expression>;
}
export declare function PrefixUnaryExpression_Clone(receiver: GoPtr<PrefixUnaryExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PrefixUnaryExpression_ForEachChild(receiver: GoPtr<PrefixUnaryExpression>, v: Visitor): bool;
export declare function PrefixUnaryExpression_VisitEachChild(receiver: GoPtr<PrefixUnaryExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PrefixUnaryExpression_computeSubtreeFacts(receiver: GoPtr<PrefixUnaryExpression>): SubtreeFacts;
export declare function PrefixUnaryExpression_as_nodeData(receiver: GoPtr<PrefixUnaryExpression>): nodeData;
export declare function createPrefixUnaryExpressionData(): PrefixUnaryExpression & nodeData;
export interface PostfixUnaryExpression extends UpdateExpressionBase {
    Operand: GoPtr<Expression>;
    Operator: Kind;
}
export declare function PostfixUnaryExpression_Clone(receiver: GoPtr<PostfixUnaryExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PostfixUnaryExpression_ForEachChild(receiver: GoPtr<PostfixUnaryExpression>, v: Visitor): bool;
export declare function PostfixUnaryExpression_VisitEachChild(receiver: GoPtr<PostfixUnaryExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PostfixUnaryExpression_computeSubtreeFacts(receiver: GoPtr<PostfixUnaryExpression>): SubtreeFacts;
export declare function PostfixUnaryExpression_as_nodeData(receiver: GoPtr<PostfixUnaryExpression>): nodeData;
export declare function createPostfixUnaryExpressionData(): PostfixUnaryExpression & nodeData;
export interface YieldExpression extends ExpressionBase {
    AsteriskToken: GoPtr<AsteriskToken>;
    Expression: GoPtr<Expression>;
}
export declare function YieldExpression_Clone(receiver: GoPtr<YieldExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function YieldExpression_ForEachChild(receiver: GoPtr<YieldExpression>, v: Visitor): bool;
export declare function YieldExpression_VisitEachChild(receiver: GoPtr<YieldExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function YieldExpression_as_nodeData(receiver: GoPtr<YieldExpression>): nodeData;
export declare function createYieldExpressionData(): YieldExpression & nodeData;
export interface ArrowFunction extends ExpressionBase, DeclarationBase, ModifiersBase, FunctionLikeWithBodyBase, FlowNodeBase, CompositeBase {
    EqualsGreaterThanToken: GoPtr<EqualsGreaterThanToken>;
}
export declare function ArrowFunction_Clone(receiver: GoPtr<ArrowFunction>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ArrowFunction_ForEachChild(receiver: GoPtr<ArrowFunction>, v: Visitor): bool;
export declare function ArrowFunction_VisitEachChild(receiver: GoPtr<ArrowFunction>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ArrowFunction_as_nodeData(receiver: GoPtr<ArrowFunction>): nodeData;
export declare function createArrowFunctionData(): ArrowFunction & nodeData;
export interface FunctionExpression extends PrimaryExpressionBase, DeclarationBase, ModifiersBase, FunctionLikeWithBodyBase, FlowNodeBase, CompositeBase {
    name: GoPtr<IdentifierNode>;
}
export declare function FunctionExpression_Clone(receiver: GoPtr<FunctionExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function FunctionExpression_Name(receiver: GoPtr<FunctionExpression>): GoPtr<Node>;
export declare function FunctionExpression_ForEachChild(receiver: GoPtr<FunctionExpression>, v: Visitor): bool;
export declare function FunctionExpression_VisitEachChild(receiver: GoPtr<FunctionExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function FunctionExpression_as_nodeData(receiver: GoPtr<FunctionExpression>): nodeData;
export declare function createFunctionExpressionData(): FunctionExpression & nodeData;
export interface AsExpression extends ExpressionBase {
    Expression: GoPtr<Expression>;
    Type: GoPtr<TypeNode>;
}
export declare function AsExpression_Clone(receiver: GoPtr<AsExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function AsExpression_ForEachChild(receiver: GoPtr<AsExpression>, v: Visitor): bool;
export declare function AsExpression_VisitEachChild(receiver: GoPtr<AsExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function AsExpression_as_nodeData(receiver: GoPtr<AsExpression>): nodeData;
export declare function createAsExpressionData(): AsExpression & nodeData;
export interface SatisfiesExpression extends ExpressionBase {
    Expression: GoPtr<Expression>;
    Type: GoPtr<TypeNode>;
}
export declare function SatisfiesExpression_Clone(receiver: GoPtr<SatisfiesExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SatisfiesExpression_ForEachChild(receiver: GoPtr<SatisfiesExpression>, v: Visitor): bool;
export declare function SatisfiesExpression_VisitEachChild(receiver: GoPtr<SatisfiesExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SatisfiesExpression_as_nodeData(receiver: GoPtr<SatisfiesExpression>): nodeData;
export declare function createSatisfiesExpressionData(): SatisfiesExpression & nodeData;
export interface ConditionalExpression extends ExpressionBase, CompositeBase {
    Condition: GoPtr<Expression>;
    QuestionToken: GoPtr<QuestionToken>;
    WhenTrue: GoPtr<Expression>;
    ColonToken: GoPtr<ColonToken>;
    WhenFalse: GoPtr<Expression>;
}
export declare function ConditionalExpression_Clone(receiver: GoPtr<ConditionalExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ConditionalExpression_ForEachChild(receiver: GoPtr<ConditionalExpression>, v: Visitor): bool;
export declare function ConditionalExpression_VisitEachChild(receiver: GoPtr<ConditionalExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ConditionalExpression_computeSubtreeFacts(receiver: GoPtr<ConditionalExpression>): SubtreeFacts;
export declare function ConditionalExpression_as_nodeData(receiver: GoPtr<ConditionalExpression>): nodeData;
export declare function createConditionalExpressionData(): ConditionalExpression & nodeData;
export interface PropertyAccessExpression extends MemberExpressionBase, FlowNodeBase, CompositeBase {
    Expression: GoPtr<Expression>;
    QuestionDotToken: GoPtr<QuestionDotToken>;
    name: GoPtr<MemberName>;
}
export declare function PropertyAccessExpression_Clone(receiver: GoPtr<PropertyAccessExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PropertyAccessExpression_Name(receiver: GoPtr<PropertyAccessExpression>): GoPtr<Node>;
export declare function PropertyAccessExpression_ForEachChild(receiver: GoPtr<PropertyAccessExpression>, v: Visitor): bool;
export declare function PropertyAccessExpression_VisitEachChild(receiver: GoPtr<PropertyAccessExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PropertyAccessExpression_as_nodeData(receiver: GoPtr<PropertyAccessExpression>): nodeData;
export declare function createPropertyAccessExpressionData(): PropertyAccessExpression & nodeData;
export interface ElementAccessExpression extends MemberExpressionBase, FlowNodeBase, CompositeBase {
    Expression: GoPtr<Expression>;
    QuestionDotToken: GoPtr<QuestionDotToken>;
    ArgumentExpression: GoPtr<Expression>;
}
export declare function ElementAccessExpression_Clone(receiver: GoPtr<ElementAccessExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ElementAccessExpression_ForEachChild(receiver: GoPtr<ElementAccessExpression>, v: Visitor): bool;
export declare function ElementAccessExpression_VisitEachChild(receiver: GoPtr<ElementAccessExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ElementAccessExpression_computeSubtreeFacts(receiver: GoPtr<ElementAccessExpression>): SubtreeFacts;
export declare function ElementAccessExpression_as_nodeData(receiver: GoPtr<ElementAccessExpression>): nodeData;
export declare function createElementAccessExpressionData(): ElementAccessExpression & nodeData;
export interface CallExpression extends LeftHandSideExpressionBase, DeclarationBase, CompositeBase {
    Expression: GoPtr<Expression>;
    QuestionDotToken: GoPtr<QuestionDotToken>;
    TypeArguments: GoPtr<TypeList>;
    Arguments: GoPtr<ElementList>;
}
export declare function CallExpression_Clone(receiver: GoPtr<CallExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function CallExpression_ForEachChild(receiver: GoPtr<CallExpression>, v: Visitor): bool;
export declare function CallExpression_VisitEachChild(receiver: GoPtr<CallExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function CallExpression_as_nodeData(receiver: GoPtr<CallExpression>): nodeData;
export declare function createCallExpressionData(): CallExpression & nodeData;
export interface NewExpression extends PrimaryExpressionBase, CompositeBase {
    Expression: GoPtr<Expression>;
    TypeArguments: GoPtr<TypeList>;
    Arguments: GoPtr<ElementList>;
}
export declare function NewExpression_Clone(receiver: GoPtr<NewExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NewExpression_ForEachChild(receiver: GoPtr<NewExpression>, v: Visitor): bool;
export declare function NewExpression_VisitEachChild(receiver: GoPtr<NewExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NewExpression_as_nodeData(receiver: GoPtr<NewExpression>): nodeData;
export declare function createNewExpressionData(): NewExpression & nodeData;
export interface MetaProperty extends PrimaryExpressionBase, FlowNodeBase, CompositeBase {
    KeywordToken: Kind;
    name: GoPtr<IdentifierNode>;
}
export declare function MetaProperty_Clone(receiver: GoPtr<MetaProperty>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function MetaProperty_Name(receiver: GoPtr<MetaProperty>): GoPtr<Node>;
export declare function MetaProperty_ForEachChild(receiver: GoPtr<MetaProperty>, v: Visitor): bool;
export declare function MetaProperty_VisitEachChild(receiver: GoPtr<MetaProperty>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function MetaProperty_as_nodeData(receiver: GoPtr<MetaProperty>): nodeData;
export declare function createMetaPropertyData(): MetaProperty & nodeData;
export interface NonNullExpression extends LeftHandSideExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function NonNullExpression_Clone(receiver: GoPtr<NonNullExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NonNullExpression_ForEachChild(receiver: GoPtr<NonNullExpression>, v: Visitor): bool;
export declare function NonNullExpression_VisitEachChild(receiver: GoPtr<NonNullExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NonNullExpression_as_nodeData(receiver: GoPtr<NonNullExpression>): nodeData;
export declare function createNonNullExpressionData(): NonNullExpression & nodeData;
export interface SpreadElement extends ExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function SpreadElement_Clone(receiver: GoPtr<SpreadElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SpreadElement_ForEachChild(receiver: GoPtr<SpreadElement>, v: Visitor): bool;
export declare function SpreadElement_VisitEachChild(receiver: GoPtr<SpreadElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SpreadElement_as_nodeData(receiver: GoPtr<SpreadElement>): nodeData;
export declare function createSpreadElementData(): SpreadElement & nodeData;
export interface TemplateExpression extends PrimaryExpressionBase, CompositeBase {
    Head: GoPtr<TemplateHeadNode>;
    TemplateSpans: GoPtr<TemplateSpanList>;
}
export declare function TemplateExpression_Clone(receiver: GoPtr<TemplateExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateExpression_ForEachChild(receiver: GoPtr<TemplateExpression>, v: Visitor): bool;
export declare function TemplateExpression_VisitEachChild(receiver: GoPtr<TemplateExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TemplateExpression_computeSubtreeFacts(receiver: GoPtr<TemplateExpression>): SubtreeFacts;
export declare function TemplateExpression_as_nodeData(receiver: GoPtr<TemplateExpression>): nodeData;
export declare function createTemplateExpressionData(): TemplateExpression & nodeData;
export interface TemplateSpan extends NodeBase {
    Expression: GoPtr<Expression>;
    Literal: GoPtr<TemplateMiddleOrTail>;
}
export declare function TemplateSpan_Clone(receiver: GoPtr<TemplateSpan>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateSpan_ForEachChild(receiver: GoPtr<TemplateSpan>, v: Visitor): bool;
export declare function TemplateSpan_VisitEachChild(receiver: GoPtr<TemplateSpan>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TemplateSpan_computeSubtreeFacts(receiver: GoPtr<TemplateSpan>): SubtreeFacts;
export declare function TemplateSpan_as_nodeData(receiver: GoPtr<TemplateSpan>): nodeData;
export declare function createTemplateSpanData(): TemplateSpan & nodeData;
export interface TaggedTemplateExpression extends MemberExpressionBase, CompositeBase {
    Tag: GoPtr<Expression>;
    QuestionDotToken: GoPtr<QuestionDotToken>;
    TypeArguments: GoPtr<TypeList>;
    Template: GoPtr<TemplateLiteral>;
}
export declare function TaggedTemplateExpression_Clone(receiver: GoPtr<TaggedTemplateExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TaggedTemplateExpression_ForEachChild(receiver: GoPtr<TaggedTemplateExpression>, v: Visitor): bool;
export declare function TaggedTemplateExpression_VisitEachChild(receiver: GoPtr<TaggedTemplateExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TaggedTemplateExpression_as_nodeData(receiver: GoPtr<TaggedTemplateExpression>): nodeData;
export declare function createTaggedTemplateExpressionData(): TaggedTemplateExpression & nodeData;
export interface ParenthesizedExpression extends PrimaryExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function ParenthesizedExpression_Clone(receiver: GoPtr<ParenthesizedExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ParenthesizedExpression_ForEachChild(receiver: GoPtr<ParenthesizedExpression>, v: Visitor): bool;
export declare function ParenthesizedExpression_VisitEachChild(receiver: GoPtr<ParenthesizedExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ParenthesizedExpression_computeSubtreeFacts(receiver: GoPtr<ParenthesizedExpression>): SubtreeFacts;
export declare function ParenthesizedExpression_as_nodeData(receiver: GoPtr<ParenthesizedExpression>): nodeData;
export declare function createParenthesizedExpressionData(): ParenthesizedExpression & nodeData;
export interface ArrayLiteralExpression extends PrimaryExpressionBase, CompositeBase {
    Elements: GoPtr<ElementList>;
    MultiLine: bool;
}
export declare function ArrayLiteralExpression_Clone(receiver: GoPtr<ArrayLiteralExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ArrayLiteralExpression_ForEachChild(receiver: GoPtr<ArrayLiteralExpression>, v: Visitor): bool;
export declare function ArrayLiteralExpression_VisitEachChild(receiver: GoPtr<ArrayLiteralExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ArrayLiteralExpression_computeSubtreeFacts(receiver: GoPtr<ArrayLiteralExpression>): SubtreeFacts;
export declare function ArrayLiteralExpression_as_nodeData(receiver: GoPtr<ArrayLiteralExpression>): nodeData;
export declare function createArrayLiteralExpressionData(): ArrayLiteralExpression & nodeData;
export interface ObjectLiteralExpression extends PrimaryExpressionBase, DeclarationBase, CompositeBase {
    Properties: GoPtr<NodeList>;
    MultiLine: bool;
}
export declare function ObjectLiteralExpression_Clone(receiver: GoPtr<ObjectLiteralExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ObjectLiteralExpression_ForEachChild(receiver: GoPtr<ObjectLiteralExpression>, v: Visitor): bool;
export declare function ObjectLiteralExpression_VisitEachChild(receiver: GoPtr<ObjectLiteralExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ObjectLiteralExpression_computeSubtreeFacts(receiver: GoPtr<ObjectLiteralExpression>): SubtreeFacts;
export declare function ObjectLiteralExpression_as_nodeData(receiver: GoPtr<ObjectLiteralExpression>): nodeData;
export declare function createObjectLiteralExpressionData(): ObjectLiteralExpression & nodeData;
export interface SpreadAssignment extends NodeBase, DeclarationBase, ObjectLiteralElementBase {
    Expression: GoPtr<Expression>;
}
export declare function SpreadAssignment_Clone(receiver: GoPtr<SpreadAssignment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SpreadAssignment_ForEachChild(receiver: GoPtr<SpreadAssignment>, v: Visitor): bool;
export declare function SpreadAssignment_VisitEachChild(receiver: GoPtr<SpreadAssignment>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SpreadAssignment_as_nodeData(receiver: GoPtr<SpreadAssignment>): nodeData;
export declare function createSpreadAssignmentData(): SpreadAssignment & nodeData;
export interface PropertyAssignment extends NodeBase, NamedMemberBase, ObjectLiteralElementBase, CompositeBase {
    Type: GoPtr<TypeNode>;
    Initializer: GoPtr<Expression>;
}
export declare function PropertyAssignment_Clone(receiver: GoPtr<PropertyAssignment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PropertyAssignment_Name(receiver: GoPtr<PropertyAssignment>): GoPtr<Node>;
export declare function PropertyAssignment_ForEachChild(receiver: GoPtr<PropertyAssignment>, v: Visitor): bool;
export declare function PropertyAssignment_VisitEachChild(receiver: GoPtr<PropertyAssignment>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PropertyAssignment_as_nodeData(receiver: GoPtr<PropertyAssignment>): nodeData;
export declare function createPropertyAssignmentData(): PropertyAssignment & nodeData;
export interface ShorthandPropertyAssignment extends NodeBase, NamedMemberBase, ObjectLiteralElementBase, CompositeBase {
    Type: GoPtr<TypeNode>;
    EqualsToken: GoPtr<EqualsToken>;
    ObjectAssignmentInitializer: GoPtr<Expression>;
}
export declare function ShorthandPropertyAssignment_Clone(receiver: GoPtr<ShorthandPropertyAssignment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ShorthandPropertyAssignment_Name(receiver: GoPtr<ShorthandPropertyAssignment>): GoPtr<Node>;
export declare function ShorthandPropertyAssignment_ForEachChild(receiver: GoPtr<ShorthandPropertyAssignment>, v: Visitor): bool;
export declare function ShorthandPropertyAssignment_VisitEachChild(receiver: GoPtr<ShorthandPropertyAssignment>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ShorthandPropertyAssignment_as_nodeData(receiver: GoPtr<ShorthandPropertyAssignment>): nodeData;
export declare function createShorthandPropertyAssignmentData(): ShorthandPropertyAssignment & nodeData;
export interface DeleteExpression extends UnaryExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function DeleteExpression_Clone(receiver: GoPtr<DeleteExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function DeleteExpression_ForEachChild(receiver: GoPtr<DeleteExpression>, v: Visitor): bool;
export declare function DeleteExpression_VisitEachChild(receiver: GoPtr<DeleteExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function DeleteExpression_computeSubtreeFacts(receiver: GoPtr<DeleteExpression>): SubtreeFacts;
export declare function DeleteExpression_as_nodeData(receiver: GoPtr<DeleteExpression>): nodeData;
export declare function createDeleteExpressionData(): DeleteExpression & nodeData;
export interface TypeOfExpression extends UnaryExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function TypeOfExpression_Clone(receiver: GoPtr<TypeOfExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeOfExpression_ForEachChild(receiver: GoPtr<TypeOfExpression>, v: Visitor): bool;
export declare function TypeOfExpression_VisitEachChild(receiver: GoPtr<TypeOfExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeOfExpression_computeSubtreeFacts(receiver: GoPtr<TypeOfExpression>): SubtreeFacts;
export declare function TypeOfExpression_as_nodeData(receiver: GoPtr<TypeOfExpression>): nodeData;
export declare function createTypeOfExpressionData(): TypeOfExpression & nodeData;
export interface VoidExpression extends UnaryExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function VoidExpression_Clone(receiver: GoPtr<VoidExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function VoidExpression_ForEachChild(receiver: GoPtr<VoidExpression>, v: Visitor): bool;
export declare function VoidExpression_VisitEachChild(receiver: GoPtr<VoidExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function VoidExpression_computeSubtreeFacts(receiver: GoPtr<VoidExpression>): SubtreeFacts;
export declare function VoidExpression_as_nodeData(receiver: GoPtr<VoidExpression>): nodeData;
export declare function createVoidExpressionData(): VoidExpression & nodeData;
export interface AwaitExpression extends UnaryExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function AwaitExpression_Clone(receiver: GoPtr<AwaitExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function AwaitExpression_ForEachChild(receiver: GoPtr<AwaitExpression>, v: Visitor): bool;
export declare function AwaitExpression_VisitEachChild(receiver: GoPtr<AwaitExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function AwaitExpression_as_nodeData(receiver: GoPtr<AwaitExpression>): nodeData;
export declare function createAwaitExpressionData(): AwaitExpression & nodeData;
export interface TypeAssertion extends UnaryExpressionBase {
    Type: GoPtr<TypeNode>;
    Expression: GoPtr<Expression>;
}
export declare function TypeAssertion_Clone(receiver: GoPtr<TypeAssertion>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeAssertion_ForEachChild(receiver: GoPtr<TypeAssertion>, v: Visitor): bool;
export declare function TypeAssertion_VisitEachChild(receiver: GoPtr<TypeAssertion>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeAssertion_as_nodeData(receiver: GoPtr<TypeAssertion>): nodeData;
export declare function createTypeAssertionData(): TypeAssertion & nodeData;
export interface KeywordTypeNode extends TypeNodeBase {
}
export declare function KeywordTypeNode_Clone(receiver: GoPtr<KeywordTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function KeywordTypeNode_as_nodeData(receiver: GoPtr<KeywordTypeNode>): nodeData;
export declare function createKeywordTypeNodeData(): KeywordTypeNode & nodeData;
export interface UnionTypeNode extends TypeNodeBase, UnionOrIntersectionTypeNodeBase {
}
export declare function UnionTypeNode_Clone(receiver: GoPtr<UnionTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function UnionTypeNode_ForEachChild(receiver: GoPtr<UnionTypeNode>, v: Visitor): bool;
export declare function UnionTypeNode_VisitEachChild(receiver: GoPtr<UnionTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function UnionTypeNode_as_nodeData(receiver: GoPtr<UnionTypeNode>): nodeData;
export declare function createUnionTypeNodeData(): UnionTypeNode & nodeData;
export interface IntersectionTypeNode extends TypeNodeBase, UnionOrIntersectionTypeNodeBase {
}
export declare function IntersectionTypeNode_Clone(receiver: GoPtr<IntersectionTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function IntersectionTypeNode_ForEachChild(receiver: GoPtr<IntersectionTypeNode>, v: Visitor): bool;
export declare function IntersectionTypeNode_VisitEachChild(receiver: GoPtr<IntersectionTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function IntersectionTypeNode_as_nodeData(receiver: GoPtr<IntersectionTypeNode>): nodeData;
export declare function createIntersectionTypeNodeData(): IntersectionTypeNode & nodeData;
export interface ConditionalTypeNode extends TypeNodeBase, LocalsContainerBase {
    CheckType: GoPtr<TypeNode>;
    ExtendsType: GoPtr<TypeNode>;
    TrueType: GoPtr<TypeNode>;
    FalseType: GoPtr<TypeNode>;
}
export declare function ConditionalTypeNode_Clone(receiver: GoPtr<ConditionalTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ConditionalTypeNode_ForEachChild(receiver: GoPtr<ConditionalTypeNode>, v: Visitor): bool;
export declare function ConditionalTypeNode_VisitEachChild(receiver: GoPtr<ConditionalTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ConditionalTypeNode_as_nodeData(receiver: GoPtr<ConditionalTypeNode>): nodeData;
export declare function createConditionalTypeNodeData(): ConditionalTypeNode & nodeData;
export interface TypeOperatorNode extends TypeNodeBase {
    Operator: Kind;
    Type: GoPtr<TypeNode>;
}
export declare function TypeOperatorNode_Clone(receiver: GoPtr<TypeOperatorNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeOperatorNode_ForEachChild(receiver: GoPtr<TypeOperatorNode>, v: Visitor): bool;
export declare function TypeOperatorNode_VisitEachChild(receiver: GoPtr<TypeOperatorNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeOperatorNode_as_nodeData(receiver: GoPtr<TypeOperatorNode>): nodeData;
export declare function createTypeOperatorNodeData(): TypeOperatorNode & nodeData;
export interface InferTypeNode extends TypeNodeBase {
    TypeParameter: GoPtr<TypeParameterDeclarationNode>;
}
export declare function InferTypeNode_Clone(receiver: GoPtr<InferTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function InferTypeNode_ForEachChild(receiver: GoPtr<InferTypeNode>, v: Visitor): bool;
export declare function InferTypeNode_VisitEachChild(receiver: GoPtr<InferTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function InferTypeNode_as_nodeData(receiver: GoPtr<InferTypeNode>): nodeData;
export declare function createInferTypeNodeData(): InferTypeNode & nodeData;
export interface ArrayTypeNode extends TypeNodeBase {
    ElementType: GoPtr<TypeNode>;
}
export declare function ArrayTypeNode_Clone(receiver: GoPtr<ArrayTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ArrayTypeNode_ForEachChild(receiver: GoPtr<ArrayTypeNode>, v: Visitor): bool;
export declare function ArrayTypeNode_VisitEachChild(receiver: GoPtr<ArrayTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ArrayTypeNode_as_nodeData(receiver: GoPtr<ArrayTypeNode>): nodeData;
export declare function createArrayTypeNodeData(): ArrayTypeNode & nodeData;
export interface IndexedAccessTypeNode extends TypeNodeBase {
    ObjectType: GoPtr<TypeNode>;
    IndexType: GoPtr<TypeNode>;
}
export declare function IndexedAccessTypeNode_Clone(receiver: GoPtr<IndexedAccessTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function IndexedAccessTypeNode_ForEachChild(receiver: GoPtr<IndexedAccessTypeNode>, v: Visitor): bool;
export declare function IndexedAccessTypeNode_VisitEachChild(receiver: GoPtr<IndexedAccessTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function IndexedAccessTypeNode_as_nodeData(receiver: GoPtr<IndexedAccessTypeNode>): nodeData;
export declare function createIndexedAccessTypeNodeData(): IndexedAccessTypeNode & nodeData;
export interface TypeReferenceNode extends NodeWithTypeArgumentsBase {
    TypeName: GoPtr<EntityName>;
}
export declare function TypeReferenceNode_Clone(receiver: GoPtr<TypeReferenceNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeReferenceNode_ForEachChild(receiver: GoPtr<TypeReferenceNode>, v: Visitor): bool;
export declare function TypeReferenceNode_VisitEachChild(receiver: GoPtr<TypeReferenceNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeReferenceNode_as_nodeData(receiver: GoPtr<TypeReferenceNode>): nodeData;
export declare function createTypeReferenceNodeData(): TypeReferenceNode & nodeData;
export interface ExpressionWithTypeArguments extends MemberExpressionBase, CompositeBase {
    Expression: GoPtr<Expression>;
    TypeArguments: GoPtr<TypeList>;
}
export declare function ExpressionWithTypeArguments_Clone(receiver: GoPtr<ExpressionWithTypeArguments>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExpressionWithTypeArguments_ForEachChild(receiver: GoPtr<ExpressionWithTypeArguments>, v: Visitor): bool;
export declare function ExpressionWithTypeArguments_VisitEachChild(receiver: GoPtr<ExpressionWithTypeArguments>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExpressionWithTypeArguments_as_nodeData(receiver: GoPtr<ExpressionWithTypeArguments>): nodeData;
export declare function createExpressionWithTypeArgumentsData(): ExpressionWithTypeArguments & nodeData;
export interface LiteralTypeNode extends TypeNodeBase {
    Literal: GoPtr<Node>;
}
export declare function LiteralTypeNode_Clone(receiver: GoPtr<LiteralTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function LiteralTypeNode_ForEachChild(receiver: GoPtr<LiteralTypeNode>, v: Visitor): bool;
export declare function LiteralTypeNode_VisitEachChild(receiver: GoPtr<LiteralTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function LiteralTypeNode_as_nodeData(receiver: GoPtr<LiteralTypeNode>): nodeData;
export declare function createLiteralTypeNodeData(): LiteralTypeNode & nodeData;
export interface ThisTypeNode extends TypeNodeBase {
}
export declare function ThisTypeNode_Clone(receiver: GoPtr<ThisTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ThisTypeNode_as_nodeData(receiver: GoPtr<ThisTypeNode>): nodeData;
export declare function createThisTypeNodeData(): ThisTypeNode & nodeData;
export interface TypePredicateNode extends TypeNodeBase {
    AssertsModifier: GoPtr<AssertsKeyword>;
    ParameterName: GoPtr<TypePredicateParameterName>;
    Type: GoPtr<TypeNode>;
}
export declare function TypePredicateNode_Clone(receiver: GoPtr<TypePredicateNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypePredicateNode_ForEachChild(receiver: GoPtr<TypePredicateNode>, v: Visitor): bool;
export declare function TypePredicateNode_VisitEachChild(receiver: GoPtr<TypePredicateNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypePredicateNode_as_nodeData(receiver: GoPtr<TypePredicateNode>): nodeData;
export declare function createTypePredicateNodeData(): TypePredicateNode & nodeData;
export interface ImportAttribute extends NodeBase, CompositeBase {
    name: GoPtr<ImportAttributeName>;
    Value: GoPtr<Expression>;
}
export declare function ImportAttribute_Clone(receiver: GoPtr<ImportAttribute>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportAttribute_Name(receiver: GoPtr<ImportAttribute>): GoPtr<Node>;
export declare function ImportAttribute_ForEachChild(receiver: GoPtr<ImportAttribute>, v: Visitor): bool;
export declare function ImportAttribute_VisitEachChild(receiver: GoPtr<ImportAttribute>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportAttribute_computeSubtreeFacts(receiver: GoPtr<ImportAttribute>): SubtreeFacts;
export declare function ImportAttribute_as_nodeData(receiver: GoPtr<ImportAttribute>): nodeData;
export declare function createImportAttributeData(): ImportAttribute & nodeData;
export interface ImportAttributes extends NodeBase, CompositeBase {
    Token: Kind;
    Attributes: GoPtr<ImportAttributeList>;
    MultiLine: bool;
}
export declare function ImportAttributes_Clone(receiver: GoPtr<ImportAttributes>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportAttributes_ForEachChild(receiver: GoPtr<ImportAttributes>, v: Visitor): bool;
export declare function ImportAttributes_VisitEachChild(receiver: GoPtr<ImportAttributes>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportAttributes_computeSubtreeFacts(receiver: GoPtr<ImportAttributes>): SubtreeFacts;
export declare function ImportAttributes_as_nodeData(receiver: GoPtr<ImportAttributes>): nodeData;
export declare function createImportAttributesData(): ImportAttributes & nodeData;
export interface TypeQueryNode extends NodeWithTypeArgumentsBase {
    ExprName: GoPtr<EntityName>;
}
export declare function TypeQueryNode_Clone(receiver: GoPtr<TypeQueryNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeQueryNode_ForEachChild(receiver: GoPtr<TypeQueryNode>, v: Visitor): bool;
export declare function TypeQueryNode_VisitEachChild(receiver: GoPtr<TypeQueryNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeQueryNode_as_nodeData(receiver: GoPtr<TypeQueryNode>): nodeData;
export declare function createTypeQueryNodeData(): TypeQueryNode & nodeData;
export interface MappedTypeNode extends TypeNodeBase, DeclarationBase, LocalsContainerBase {
    ReadonlyToken: GoPtr<Node>;
    TypeParameter: GoPtr<TypeParameterDeclarationNode>;
    NameType: GoPtr<TypeNode>;
    QuestionToken: GoPtr<Node>;
    Type: GoPtr<TypeNode>;
    Members: GoPtr<TypeElementList>;
}
export declare function MappedTypeNode_Clone(receiver: GoPtr<MappedTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function MappedTypeNode_ForEachChild(receiver: GoPtr<MappedTypeNode>, v: Visitor): bool;
export declare function MappedTypeNode_VisitEachChild(receiver: GoPtr<MappedTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function MappedTypeNode_as_nodeData(receiver: GoPtr<MappedTypeNode>): nodeData;
export declare function createMappedTypeNodeData(): MappedTypeNode & nodeData;
export interface TypeLiteralNode extends TypeNodeBase, DeclarationBase {
    Members: GoPtr<TypeElementList>;
}
export declare function TypeLiteralNode_Clone(receiver: GoPtr<TypeLiteralNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeLiteralNode_ForEachChild(receiver: GoPtr<TypeLiteralNode>, v: Visitor): bool;
export declare function TypeLiteralNode_VisitEachChild(receiver: GoPtr<TypeLiteralNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeLiteralNode_as_nodeData(receiver: GoPtr<TypeLiteralNode>): nodeData;
export declare function createTypeLiteralNodeData(): TypeLiteralNode & nodeData;
export interface TupleTypeNode extends TypeNodeBase {
    Elements: GoPtr<TypeList>;
}
export declare function TupleTypeNode_Clone(receiver: GoPtr<TupleTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TupleTypeNode_ForEachChild(receiver: GoPtr<TupleTypeNode>, v: Visitor): bool;
export declare function TupleTypeNode_VisitEachChild(receiver: GoPtr<TupleTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TupleTypeNode_as_nodeData(receiver: GoPtr<TupleTypeNode>): nodeData;
export declare function createTupleTypeNodeData(): TupleTypeNode & nodeData;
export interface NamedTupleMember extends TypeNodeBase, DeclarationBase {
    DotDotDotToken: GoPtr<DotDotDotToken>;
    name: GoPtr<IdentifierNode>;
    QuestionToken: GoPtr<QuestionToken>;
    Type: GoPtr<TypeNode>;
}
export declare function NamedTupleMember_Clone(receiver: GoPtr<NamedTupleMember>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function NamedTupleMember_Name(receiver: GoPtr<NamedTupleMember>): GoPtr<Node>;
export declare function NamedTupleMember_ForEachChild(receiver: GoPtr<NamedTupleMember>, v: Visitor): bool;
export declare function NamedTupleMember_VisitEachChild(receiver: GoPtr<NamedTupleMember>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NamedTupleMember_as_nodeData(receiver: GoPtr<NamedTupleMember>): nodeData;
export declare function createNamedTupleMemberData(): NamedTupleMember & nodeData;
export interface OptionalTypeNode extends TypeNodeBase {
    Type: GoPtr<TypeNode>;
}
export declare function OptionalTypeNode_Clone(receiver: GoPtr<OptionalTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function OptionalTypeNode_ForEachChild(receiver: GoPtr<OptionalTypeNode>, v: Visitor): bool;
export declare function OptionalTypeNode_VisitEachChild(receiver: GoPtr<OptionalTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function OptionalTypeNode_as_nodeData(receiver: GoPtr<OptionalTypeNode>): nodeData;
export declare function createOptionalTypeNodeData(): OptionalTypeNode & nodeData;
export interface RestTypeNode extends TypeNodeBase {
    Type: GoPtr<TypeNode>;
}
export declare function RestTypeNode_Clone(receiver: GoPtr<RestTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function RestTypeNode_ForEachChild(receiver: GoPtr<RestTypeNode>, v: Visitor): bool;
export declare function RestTypeNode_VisitEachChild(receiver: GoPtr<RestTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function RestTypeNode_as_nodeData(receiver: GoPtr<RestTypeNode>): nodeData;
export declare function createRestTypeNodeData(): RestTypeNode & nodeData;
export interface ParenthesizedTypeNode extends TypeNodeBase {
    Type: GoPtr<TypeNode>;
}
export declare function ParenthesizedTypeNode_Clone(receiver: GoPtr<ParenthesizedTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ParenthesizedTypeNode_ForEachChild(receiver: GoPtr<ParenthesizedTypeNode>, v: Visitor): bool;
export declare function ParenthesizedTypeNode_VisitEachChild(receiver: GoPtr<ParenthesizedTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ParenthesizedTypeNode_as_nodeData(receiver: GoPtr<ParenthesizedTypeNode>): nodeData;
export declare function createParenthesizedTypeNodeData(): ParenthesizedTypeNode & nodeData;
export interface FunctionTypeNode extends TypeNodeBase, FunctionOrConstructorTypeNodeBase {
}
export declare function FunctionTypeNode_Clone(receiver: GoPtr<FunctionTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function FunctionTypeNode_ForEachChild(receiver: GoPtr<FunctionTypeNode>, v: Visitor): bool;
export declare function FunctionTypeNode_VisitEachChild(receiver: GoPtr<FunctionTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function FunctionTypeNode_as_nodeData(receiver: GoPtr<FunctionTypeNode>): nodeData;
export declare function createFunctionTypeNodeData(): FunctionTypeNode & nodeData;
export interface ConstructorTypeNode extends TypeNodeBase, FunctionOrConstructorTypeNodeBase {
}
export declare function ConstructorTypeNode_Clone(receiver: GoPtr<ConstructorTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ConstructorTypeNode_ForEachChild(receiver: GoPtr<ConstructorTypeNode>, v: Visitor): bool;
export declare function ConstructorTypeNode_VisitEachChild(receiver: GoPtr<ConstructorTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ConstructorTypeNode_as_nodeData(receiver: GoPtr<ConstructorTypeNode>): nodeData;
export declare function createConstructorTypeNodeData(): ConstructorTypeNode & nodeData;
export interface TemplateHead extends NodeBase, TemplateLiteralLikeNodeBase {
}
export declare function TemplateHead_Clone(receiver: GoPtr<TemplateHead>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateHead_as_nodeData(receiver: GoPtr<TemplateHead>): nodeData;
export declare function createTemplateHeadData(): TemplateHead & nodeData;
export interface TemplateMiddle extends NodeBase, TemplateLiteralLikeNodeBase {
}
export declare function TemplateMiddle_Clone(receiver: GoPtr<TemplateMiddle>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateMiddle_as_nodeData(receiver: GoPtr<TemplateMiddle>): nodeData;
export declare function createTemplateMiddleData(): TemplateMiddle & nodeData;
export interface TemplateTail extends NodeBase, TemplateLiteralLikeNodeBase {
}
export declare function TemplateTail_Clone(receiver: GoPtr<TemplateTail>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateTail_as_nodeData(receiver: GoPtr<TemplateTail>): nodeData;
export declare function createTemplateTailData(): TemplateTail & nodeData;
export interface TemplateLiteralTypeNode extends TypeNodeBase {
    Head: GoPtr<TemplateHeadNode>;
    TemplateSpans: GoPtr<TemplateLiteralTypeSpanList>;
}
export declare function TemplateLiteralTypeNode_Clone(receiver: GoPtr<TemplateLiteralTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateLiteralTypeNode_ForEachChild(receiver: GoPtr<TemplateLiteralTypeNode>, v: Visitor): bool;
export declare function TemplateLiteralTypeNode_VisitEachChild(receiver: GoPtr<TemplateLiteralTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TemplateLiteralTypeNode_as_nodeData(receiver: GoPtr<TemplateLiteralTypeNode>): nodeData;
export declare function createTemplateLiteralTypeNodeData(): TemplateLiteralTypeNode & nodeData;
export interface TemplateLiteralTypeSpan extends TypeNodeBase {
    Type: GoPtr<TypeNode>;
    Literal: GoPtr<TemplateMiddleOrTail>;
}
export declare function TemplateLiteralTypeSpan_Clone(receiver: GoPtr<TemplateLiteralTypeSpan>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TemplateLiteralTypeSpan_ForEachChild(receiver: GoPtr<TemplateLiteralTypeSpan>, v: Visitor): bool;
export declare function TemplateLiteralTypeSpan_VisitEachChild(receiver: GoPtr<TemplateLiteralTypeSpan>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TemplateLiteralTypeSpan_as_nodeData(receiver: GoPtr<TemplateLiteralTypeSpan>): nodeData;
export declare function createTemplateLiteralTypeSpanData(): TemplateLiteralTypeSpan & nodeData;
export interface SyntheticExpression extends ExpressionBase {
    Type: unknown;
    IsSpread: bool;
    TupleNameSource: GoPtr<Node>;
}
export declare function SyntheticExpression_Clone(receiver: GoPtr<SyntheticExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SyntheticExpression_ForEachChild(receiver: GoPtr<SyntheticExpression>, v: Visitor): bool;
export declare function SyntheticExpression_VisitEachChild(receiver: GoPtr<SyntheticExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SyntheticExpression_as_nodeData(receiver: GoPtr<SyntheticExpression>): nodeData;
export declare function createSyntheticExpressionData(): SyntheticExpression & nodeData;
export interface PartiallyEmittedExpression extends LeftHandSideExpressionBase {
    Expression: GoPtr<Expression>;
}
export declare function PartiallyEmittedExpression_Clone(receiver: GoPtr<PartiallyEmittedExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function PartiallyEmittedExpression_ForEachChild(receiver: GoPtr<PartiallyEmittedExpression>, v: Visitor): bool;
export declare function PartiallyEmittedExpression_VisitEachChild(receiver: GoPtr<PartiallyEmittedExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function PartiallyEmittedExpression_computeSubtreeFacts(receiver: GoPtr<PartiallyEmittedExpression>): SubtreeFacts;
export declare function PartiallyEmittedExpression_as_nodeData(receiver: GoPtr<PartiallyEmittedExpression>): nodeData;
export declare function createPartiallyEmittedExpressionData(): PartiallyEmittedExpression & nodeData;
export interface JsxElement extends PrimaryExpressionBase, CompositeBase {
    OpeningElement: GoPtr<JsxOpeningElementNode>;
    Children: GoPtr<JsxChildList>;
    ClosingElement: GoPtr<JsxClosingElementNode>;
}
export declare function JsxElement_Clone(receiver: GoPtr<JsxElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxElement_ForEachChild(receiver: GoPtr<JsxElement>, v: Visitor): bool;
export declare function JsxElement_VisitEachChild(receiver: GoPtr<JsxElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxElement_as_nodeData(receiver: GoPtr<JsxElement>): nodeData;
export declare function createJsxElementData(): JsxElement & nodeData;
export interface JsxAttributes extends PrimaryExpressionBase, DeclarationBase, CompositeBase {
    Properties: GoPtr<JsxAttributeList>;
}
export declare function JsxAttributes_Clone(receiver: GoPtr<JsxAttributes>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxAttributes_ForEachChild(receiver: GoPtr<JsxAttributes>, v: Visitor): bool;
export declare function JsxAttributes_VisitEachChild(receiver: GoPtr<JsxAttributes>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxAttributes_as_nodeData(receiver: GoPtr<JsxAttributes>): nodeData;
export declare function createJsxAttributesData(): JsxAttributes & nodeData;
export interface JsxNamespacedName extends ExpressionBase, CompositeBase {
    Namespace: GoPtr<IdentifierNode>;
    name: GoPtr<IdentifierNode>;
}
export declare function JsxNamespacedName_Clone(receiver: GoPtr<JsxNamespacedName>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxNamespacedName_Name(receiver: GoPtr<JsxNamespacedName>): GoPtr<Node>;
export declare function JsxNamespacedName_ForEachChild(receiver: GoPtr<JsxNamespacedName>, v: Visitor): bool;
export declare function JsxNamespacedName_VisitEachChild(receiver: GoPtr<JsxNamespacedName>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxNamespacedName_as_nodeData(receiver: GoPtr<JsxNamespacedName>): nodeData;
export declare function createJsxNamespacedNameData(): JsxNamespacedName & nodeData;
export interface JsxOpeningElement extends ExpressionBase, CompositeBase {
    TagName: GoPtr<JsxTagNameExpression>;
    TypeArguments: GoPtr<TypeList>;
    Attributes: GoPtr<JsxAttributesNode>;
}
export declare function JsxOpeningElement_Clone(receiver: GoPtr<JsxOpeningElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxOpeningElement_ForEachChild(receiver: GoPtr<JsxOpeningElement>, v: Visitor): bool;
export declare function JsxOpeningElement_VisitEachChild(receiver: GoPtr<JsxOpeningElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxOpeningElement_as_nodeData(receiver: GoPtr<JsxOpeningElement>): nodeData;
export declare function createJsxOpeningElementData(): JsxOpeningElement & nodeData;
export interface JsxSelfClosingElement extends PrimaryExpressionBase, CompositeBase {
    TagName: GoPtr<JsxTagNameExpression>;
    TypeArguments: GoPtr<TypeList>;
    Attributes: GoPtr<JsxAttributesNode>;
}
export declare function JsxSelfClosingElement_Clone(receiver: GoPtr<JsxSelfClosingElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxSelfClosingElement_ForEachChild(receiver: GoPtr<JsxSelfClosingElement>, v: Visitor): bool;
export declare function JsxSelfClosingElement_VisitEachChild(receiver: GoPtr<JsxSelfClosingElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxSelfClosingElement_as_nodeData(receiver: GoPtr<JsxSelfClosingElement>): nodeData;
export declare function createJsxSelfClosingElementData(): JsxSelfClosingElement & nodeData;
export interface JsxFragment extends PrimaryExpressionBase, CompositeBase {
    OpeningFragment: GoPtr<JsxOpeningFragmentNode>;
    Children: GoPtr<JsxChildList>;
    ClosingFragment: GoPtr<JsxClosingFragmentNode>;
}
export declare function JsxFragment_Clone(receiver: GoPtr<JsxFragment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxFragment_ForEachChild(receiver: GoPtr<JsxFragment>, v: Visitor): bool;
export declare function JsxFragment_VisitEachChild(receiver: GoPtr<JsxFragment>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxFragment_as_nodeData(receiver: GoPtr<JsxFragment>): nodeData;
export declare function createJsxFragmentData(): JsxFragment & nodeData;
export interface JsxOpeningFragment extends ExpressionBase {
}
export declare function JsxOpeningFragment_Clone(receiver: GoPtr<JsxOpeningFragment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxOpeningFragment_as_nodeData(receiver: GoPtr<JsxOpeningFragment>): nodeData;
export declare function createJsxOpeningFragmentData(): JsxOpeningFragment & nodeData;
export interface JsxClosingFragment extends ExpressionBase {
}
export declare function JsxClosingFragment_Clone(receiver: GoPtr<JsxClosingFragment>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxClosingFragment_as_nodeData(receiver: GoPtr<JsxClosingFragment>): nodeData;
export declare function createJsxClosingFragmentData(): JsxClosingFragment & nodeData;
export interface JsxAttribute extends NodeBase, DeclarationBase, CompositeBase {
    name: GoPtr<JsxAttributeName>;
    Initializer: GoPtr<JsxAttributeValue>;
}
export declare function JsxAttribute_Clone(receiver: GoPtr<JsxAttribute>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxAttribute_Name(receiver: GoPtr<JsxAttribute>): GoPtr<Node>;
export declare function JsxAttribute_ForEachChild(receiver: GoPtr<JsxAttribute>, v: Visitor): bool;
export declare function JsxAttribute_VisitEachChild(receiver: GoPtr<JsxAttribute>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxAttribute_as_nodeData(receiver: GoPtr<JsxAttribute>): nodeData;
export declare function createJsxAttributeData(): JsxAttribute & nodeData;
export interface JsxSpreadAttribute extends ObjectLiteralElementBase, NodeBase {
    Expression: GoPtr<Expression>;
}
export declare function JsxSpreadAttribute_Clone(receiver: GoPtr<JsxSpreadAttribute>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxSpreadAttribute_ForEachChild(receiver: GoPtr<JsxSpreadAttribute>, v: Visitor): bool;
export declare function JsxSpreadAttribute_VisitEachChild(receiver: GoPtr<JsxSpreadAttribute>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxSpreadAttribute_as_nodeData(receiver: GoPtr<JsxSpreadAttribute>): nodeData;
export declare function createJsxSpreadAttributeData(): JsxSpreadAttribute & nodeData;
export interface JsxClosingElement extends NodeBase {
    TagName: GoPtr<JsxTagNameExpression>;
}
export declare function JsxClosingElement_Clone(receiver: GoPtr<JsxClosingElement>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxClosingElement_ForEachChild(receiver: GoPtr<JsxClosingElement>, v: Visitor): bool;
export declare function JsxClosingElement_VisitEachChild(receiver: GoPtr<JsxClosingElement>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxClosingElement_as_nodeData(receiver: GoPtr<JsxClosingElement>): nodeData;
export declare function createJsxClosingElementData(): JsxClosingElement & nodeData;
export interface JsxExpression extends ExpressionBase {
    DotDotDotToken: GoPtr<DotDotDotToken>;
    Expression: GoPtr<Expression>;
}
export declare function JsxExpression_Clone(receiver: GoPtr<JsxExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxExpression_ForEachChild(receiver: GoPtr<JsxExpression>, v: Visitor): bool;
export declare function JsxExpression_VisitEachChild(receiver: GoPtr<JsxExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JsxExpression_as_nodeData(receiver: GoPtr<JsxExpression>): nodeData;
export declare function createJsxExpressionData(): JsxExpression & nodeData;
export interface JsxText extends ExpressionBase, LiteralLikeNodeBase {
    ContainsOnlyTriviaWhiteSpaces: bool;
}
export declare function JsxText_Clone(receiver: GoPtr<JsxText>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JsxText_as_nodeData(receiver: GoPtr<JsxText>): nodeData;
export declare function createJsxTextData(): JsxText & nodeData;
export interface SyntaxList extends NodeBase {
    Children: GoSlice<GoPtr<Node>>;
}
export declare function SyntaxList_Clone(receiver: GoPtr<SyntaxList>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SyntaxList_ForEachChild(receiver: GoPtr<SyntaxList>, v: Visitor): bool;
export declare function SyntaxList_VisitEachChild(receiver: GoPtr<SyntaxList>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SyntaxList_as_nodeData(receiver: GoPtr<SyntaxList>): nodeData;
export declare function createSyntaxListData(): SyntaxList & nodeData;
export interface JSDoc extends NodeBase {
    Comment: GoPtr<NodeList>;
    Tags: GoPtr<NodeList>;
}
export declare function JSDoc_Clone(receiver: GoPtr<JSDoc>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDoc_ForEachChild(receiver: GoPtr<JSDoc>, v: Visitor): bool;
export declare function JSDoc_VisitEachChild(receiver: GoPtr<JSDoc>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDoc_as_nodeData(receiver: GoPtr<JSDoc>): nodeData;
export declare function createJSDocData(): JSDoc & nodeData;
export interface JSDocTypeExpression extends TypeNodeBase {
    Type: GoPtr<TypeNode>;
}
export declare function JSDocTypeExpression_Clone(receiver: GoPtr<JSDocTypeExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocTypeExpression_ForEachChild(receiver: GoPtr<JSDocTypeExpression>, v: Visitor): bool;
export declare function JSDocTypeExpression_VisitEachChild(receiver: GoPtr<JSDocTypeExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocTypeExpression_as_nodeData(receiver: GoPtr<JSDocTypeExpression>): nodeData;
export declare function createJSDocTypeExpressionData(): JSDocTypeExpression & nodeData;
export interface JSDocNonNullableType extends JSDocTypeBase {
    Type: GoPtr<TypeNode>;
}
export declare function JSDocNonNullableType_Clone(receiver: GoPtr<JSDocNonNullableType>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocNonNullableType_ForEachChild(receiver: GoPtr<JSDocNonNullableType>, v: Visitor): bool;
export declare function JSDocNonNullableType_VisitEachChild(receiver: GoPtr<JSDocNonNullableType>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocNonNullableType_as_nodeData(receiver: GoPtr<JSDocNonNullableType>): nodeData;
export declare function createJSDocNonNullableTypeData(): JSDocNonNullableType & nodeData;
export interface JSDocNullableType extends JSDocTypeBase {
    Type: GoPtr<TypeNode>;
}
export declare function JSDocNullableType_Clone(receiver: GoPtr<JSDocNullableType>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocNullableType_ForEachChild(receiver: GoPtr<JSDocNullableType>, v: Visitor): bool;
export declare function JSDocNullableType_VisitEachChild(receiver: GoPtr<JSDocNullableType>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocNullableType_as_nodeData(receiver: GoPtr<JSDocNullableType>): nodeData;
export declare function createJSDocNullableTypeData(): JSDocNullableType & nodeData;
export interface JSDocAllType extends JSDocTypeBase {
}
export declare function JSDocAllType_Clone(receiver: GoPtr<JSDocAllType>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocAllType_as_nodeData(receiver: GoPtr<JSDocAllType>): nodeData;
export declare function createJSDocAllTypeData(): JSDocAllType & nodeData;
export interface JSDocVariadicType extends JSDocTypeBase {
    Type: GoPtr<TypeNode>;
}
export declare function JSDocVariadicType_Clone(receiver: GoPtr<JSDocVariadicType>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocVariadicType_ForEachChild(receiver: GoPtr<JSDocVariadicType>, v: Visitor): bool;
export declare function JSDocVariadicType_VisitEachChild(receiver: GoPtr<JSDocVariadicType>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocVariadicType_as_nodeData(receiver: GoPtr<JSDocVariadicType>): nodeData;
export declare function createJSDocVariadicTypeData(): JSDocVariadicType & nodeData;
export interface JSDocOptionalType extends JSDocTypeBase {
    Type: GoPtr<TypeNode>;
}
export declare function JSDocOptionalType_Clone(receiver: GoPtr<JSDocOptionalType>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocOptionalType_ForEachChild(receiver: GoPtr<JSDocOptionalType>, v: Visitor): bool;
export declare function JSDocOptionalType_VisitEachChild(receiver: GoPtr<JSDocOptionalType>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocOptionalType_as_nodeData(receiver: GoPtr<JSDocOptionalType>): nodeData;
export declare function createJSDocOptionalTypeData(): JSDocOptionalType & nodeData;
export interface JSDocTypeTag extends JSDocTagBase {
    TypeExpression: GoPtr<Node>;
}
export declare function JSDocTypeTag_Clone(receiver: GoPtr<JSDocTypeTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocTypeTag_ForEachChild(receiver: GoPtr<JSDocTypeTag>, v: Visitor): bool;
export declare function JSDocTypeTag_VisitEachChild(receiver: GoPtr<JSDocTypeTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocTypeTag_as_nodeData(receiver: GoPtr<JSDocTypeTag>): nodeData;
export declare function createJSDocTypeTagData(): JSDocTypeTag & nodeData;
export interface JSDocUnknownTag extends JSDocTagBase {
}
export declare function JSDocUnknownTag_Clone(receiver: GoPtr<JSDocUnknownTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocUnknownTag_ForEachChild(receiver: GoPtr<JSDocUnknownTag>, v: Visitor): bool;
export declare function JSDocUnknownTag_VisitEachChild(receiver: GoPtr<JSDocUnknownTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocUnknownTag_as_nodeData(receiver: GoPtr<JSDocUnknownTag>): nodeData;
export declare function createJSDocUnknownTagData(): JSDocUnknownTag & nodeData;
export interface JSDocTemplateTag extends JSDocTagBase {
    Constraint: GoPtr<Node>;
    TypeParameters: GoPtr<TypeParameterList>;
}
export declare function JSDocTemplateTag_Clone(receiver: GoPtr<JSDocTemplateTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocTemplateTag_ForEachChild(receiver: GoPtr<JSDocTemplateTag>, v: Visitor): bool;
export declare function JSDocTemplateTag_VisitEachChild(receiver: GoPtr<JSDocTemplateTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocTemplateTag_as_nodeData(receiver: GoPtr<JSDocTemplateTag>): nodeData;
export declare function createJSDocTemplateTagData(): JSDocTemplateTag & nodeData;
export interface JSDocReturnTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
}
export declare function JSDocReturnTag_Clone(receiver: GoPtr<JSDocReturnTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocReturnTag_ForEachChild(receiver: GoPtr<JSDocReturnTag>, v: Visitor): bool;
export declare function JSDocReturnTag_VisitEachChild(receiver: GoPtr<JSDocReturnTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocReturnTag_as_nodeData(receiver: GoPtr<JSDocReturnTag>): nodeData;
export declare function createJSDocReturnTagData(): JSDocReturnTag & nodeData;
export interface JSDocPublicTag extends JSDocTagBase {
}
export declare function JSDocPublicTag_Clone(receiver: GoPtr<JSDocPublicTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocPublicTag_ForEachChild(receiver: GoPtr<JSDocPublicTag>, v: Visitor): bool;
export declare function JSDocPublicTag_VisitEachChild(receiver: GoPtr<JSDocPublicTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocPublicTag_as_nodeData(receiver: GoPtr<JSDocPublicTag>): nodeData;
export declare function createJSDocPublicTagData(): JSDocPublicTag & nodeData;
export interface JSDocPrivateTag extends JSDocTagBase {
}
export declare function JSDocPrivateTag_Clone(receiver: GoPtr<JSDocPrivateTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocPrivateTag_ForEachChild(receiver: GoPtr<JSDocPrivateTag>, v: Visitor): bool;
export declare function JSDocPrivateTag_VisitEachChild(receiver: GoPtr<JSDocPrivateTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocPrivateTag_as_nodeData(receiver: GoPtr<JSDocPrivateTag>): nodeData;
export declare function createJSDocPrivateTagData(): JSDocPrivateTag & nodeData;
export interface JSDocProtectedTag extends JSDocTagBase {
}
export declare function JSDocProtectedTag_Clone(receiver: GoPtr<JSDocProtectedTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocProtectedTag_ForEachChild(receiver: GoPtr<JSDocProtectedTag>, v: Visitor): bool;
export declare function JSDocProtectedTag_VisitEachChild(receiver: GoPtr<JSDocProtectedTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocProtectedTag_as_nodeData(receiver: GoPtr<JSDocProtectedTag>): nodeData;
export declare function createJSDocProtectedTagData(): JSDocProtectedTag & nodeData;
export interface JSDocReadonlyTag extends JSDocTagBase {
}
export declare function JSDocReadonlyTag_Clone(receiver: GoPtr<JSDocReadonlyTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocReadonlyTag_ForEachChild(receiver: GoPtr<JSDocReadonlyTag>, v: Visitor): bool;
export declare function JSDocReadonlyTag_VisitEachChild(receiver: GoPtr<JSDocReadonlyTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocReadonlyTag_as_nodeData(receiver: GoPtr<JSDocReadonlyTag>): nodeData;
export declare function createJSDocReadonlyTagData(): JSDocReadonlyTag & nodeData;
export interface JSDocOverrideTag extends JSDocTagBase {
}
export declare function JSDocOverrideTag_Clone(receiver: GoPtr<JSDocOverrideTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocOverrideTag_ForEachChild(receiver: GoPtr<JSDocOverrideTag>, v: Visitor): bool;
export declare function JSDocOverrideTag_VisitEachChild(receiver: GoPtr<JSDocOverrideTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocOverrideTag_as_nodeData(receiver: GoPtr<JSDocOverrideTag>): nodeData;
export declare function createJSDocOverrideTagData(): JSDocOverrideTag & nodeData;
export interface JSDocDeprecatedTag extends JSDocTagBase {
}
export declare function JSDocDeprecatedTag_Clone(receiver: GoPtr<JSDocDeprecatedTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocDeprecatedTag_ForEachChild(receiver: GoPtr<JSDocDeprecatedTag>, v: Visitor): bool;
export declare function JSDocDeprecatedTag_VisitEachChild(receiver: GoPtr<JSDocDeprecatedTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocDeprecatedTag_as_nodeData(receiver: GoPtr<JSDocDeprecatedTag>): nodeData;
export declare function createJSDocDeprecatedTagData(): JSDocDeprecatedTag & nodeData;
export interface JSDocSeeTag extends JSDocTagBase {
    NameExpression: GoPtr<TypeNode>;
}
export declare function JSDocSeeTag_Clone(receiver: GoPtr<JSDocSeeTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocSeeTag_ForEachChild(receiver: GoPtr<JSDocSeeTag>, v: Visitor): bool;
export declare function JSDocSeeTag_VisitEachChild(receiver: GoPtr<JSDocSeeTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocSeeTag_as_nodeData(receiver: GoPtr<JSDocSeeTag>): nodeData;
export declare function createJSDocSeeTagData(): JSDocSeeTag & nodeData;
export interface JSDocImplementsTag extends JSDocTagBase {
    ClassName: GoPtr<ExpressionWithTypeArgumentsNode>;
}
export declare function JSDocImplementsTag_Clone(receiver: GoPtr<JSDocImplementsTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocImplementsTag_ForEachChild(receiver: GoPtr<JSDocImplementsTag>, v: Visitor): bool;
export declare function JSDocImplementsTag_VisitEachChild(receiver: GoPtr<JSDocImplementsTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocImplementsTag_as_nodeData(receiver: GoPtr<JSDocImplementsTag>): nodeData;
export declare function createJSDocImplementsTagData(): JSDocImplementsTag & nodeData;
export interface JSDocAugmentsTag extends JSDocTagBase {
    ClassName: GoPtr<ExpressionWithTypeArgumentsNode>;
}
export declare function JSDocAugmentsTag_Clone(receiver: GoPtr<JSDocAugmentsTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocAugmentsTag_ForEachChild(receiver: GoPtr<JSDocAugmentsTag>, v: Visitor): bool;
export declare function JSDocAugmentsTag_VisitEachChild(receiver: GoPtr<JSDocAugmentsTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocAugmentsTag_as_nodeData(receiver: GoPtr<JSDocAugmentsTag>): nodeData;
export declare function createJSDocAugmentsTagData(): JSDocAugmentsTag & nodeData;
export interface JSDocSatisfiesTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
}
export declare function JSDocSatisfiesTag_Clone(receiver: GoPtr<JSDocSatisfiesTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocSatisfiesTag_ForEachChild(receiver: GoPtr<JSDocSatisfiesTag>, v: Visitor): bool;
export declare function JSDocSatisfiesTag_VisitEachChild(receiver: GoPtr<JSDocSatisfiesTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocSatisfiesTag_as_nodeData(receiver: GoPtr<JSDocSatisfiesTag>): nodeData;
export declare function createJSDocSatisfiesTagData(): JSDocSatisfiesTag & nodeData;
export interface JSDocThrowsTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
}
export declare function JSDocThrowsTag_Clone(receiver: GoPtr<JSDocThrowsTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocThrowsTag_ForEachChild(receiver: GoPtr<JSDocThrowsTag>, v: Visitor): bool;
export declare function JSDocThrowsTag_VisitEachChild(receiver: GoPtr<JSDocThrowsTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocThrowsTag_as_nodeData(receiver: GoPtr<JSDocThrowsTag>): nodeData;
export declare function createJSDocThrowsTagData(): JSDocThrowsTag & nodeData;
export interface JSDocThisTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
}
export declare function JSDocThisTag_Clone(receiver: GoPtr<JSDocThisTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocThisTag_ForEachChild(receiver: GoPtr<JSDocThisTag>, v: Visitor): bool;
export declare function JSDocThisTag_VisitEachChild(receiver: GoPtr<JSDocThisTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocThisTag_as_nodeData(receiver: GoPtr<JSDocThisTag>): nodeData;
export declare function createJSDocThisTagData(): JSDocThisTag & nodeData;
export interface JSDocImportTag extends JSDocTagBase {
    ImportClause: GoPtr<ImportClauseNode>;
    ModuleSpecifier: GoPtr<Expression>;
    Attributes: GoPtr<ImportAttributesNode>;
}
export declare function JSDocImportTag_Clone(receiver: GoPtr<JSDocImportTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocImportTag_ForEachChild(receiver: GoPtr<JSDocImportTag>, v: Visitor): bool;
export declare function JSDocImportTag_VisitEachChild(receiver: GoPtr<JSDocImportTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocImportTag_as_nodeData(receiver: GoPtr<JSDocImportTag>): nodeData;
export declare function createJSDocImportTagData(): JSDocImportTag & nodeData;
export interface JSDocCallbackTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
    name: GoPtr<JSDocFullName>;
}
export declare function JSDocCallbackTag_Clone(receiver: GoPtr<JSDocCallbackTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocCallbackTag_Name(receiver: GoPtr<JSDocCallbackTag>): GoPtr<Node>;
export declare function JSDocCallbackTag_ForEachChild(receiver: GoPtr<JSDocCallbackTag>, v: Visitor): bool;
export declare function JSDocCallbackTag_VisitEachChild(receiver: GoPtr<JSDocCallbackTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocCallbackTag_as_nodeData(receiver: GoPtr<JSDocCallbackTag>): nodeData;
export declare function createJSDocCallbackTagData(): JSDocCallbackTag & nodeData;
export interface JSDocOverloadTag extends JSDocTagBase {
    TypeExpression: GoPtr<TypeNode>;
}
export declare function JSDocOverloadTag_Clone(receiver: GoPtr<JSDocOverloadTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocOverloadTag_ForEachChild(receiver: GoPtr<JSDocOverloadTag>, v: Visitor): bool;
export declare function JSDocOverloadTag_VisitEachChild(receiver: GoPtr<JSDocOverloadTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocOverloadTag_as_nodeData(receiver: GoPtr<JSDocOverloadTag>): nodeData;
export declare function createJSDocOverloadTagData(): JSDocOverloadTag & nodeData;
export interface JSDocTypedefTag extends JSDocTagBase {
    TypeExpression: GoPtr<Node>;
    name: GoPtr<JSDocFullName>;
}
export declare function JSDocTypedefTag_Clone(receiver: GoPtr<JSDocTypedefTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocTypedefTag_Name(receiver: GoPtr<JSDocTypedefTag>): GoPtr<Node>;
export declare function JSDocTypedefTag_ForEachChild(receiver: GoPtr<JSDocTypedefTag>, v: Visitor): bool;
export declare function JSDocTypedefTag_VisitEachChild(receiver: GoPtr<JSDocTypedefTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocTypedefTag_as_nodeData(receiver: GoPtr<JSDocTypedefTag>): nodeData;
export declare function createJSDocTypedefTagData(): JSDocTypedefTag & nodeData;
export interface JSDocSignature extends JSDocTypeBase, FunctionLikeBase {
}
export declare function JSDocSignature_Clone(receiver: GoPtr<JSDocSignature>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocSignature_ForEachChild(receiver: GoPtr<JSDocSignature>, v: Visitor): bool;
export declare function JSDocSignature_VisitEachChild(receiver: GoPtr<JSDocSignature>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocSignature_as_nodeData(receiver: GoPtr<JSDocSignature>): nodeData;
export declare function createJSDocSignatureData(): JSDocSignature & nodeData;
export interface JSDocNameReference extends TypeNodeBase {
    name: GoPtr<EntityName>;
}
export declare function JSDocNameReference_Clone(receiver: GoPtr<JSDocNameReference>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocNameReference_Name(receiver: GoPtr<JSDocNameReference>): GoPtr<Node>;
export declare function JSDocNameReference_ForEachChild(receiver: GoPtr<JSDocNameReference>, v: Visitor): bool;
export declare function JSDocNameReference_VisitEachChild(receiver: GoPtr<JSDocNameReference>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocNameReference_as_nodeData(receiver: GoPtr<JSDocNameReference>): nodeData;
export declare function createJSDocNameReferenceData(): JSDocNameReference & nodeData;
export interface ModuleDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, LocalsContainerBase, BodyBase, CompositeBase {
    Keyword: Kind;
    name: GoPtr<ModuleName>;
}
export declare function ModuleDeclaration_Clone(receiver: GoPtr<ModuleDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ModuleDeclaration_Name(receiver: GoPtr<ModuleDeclaration>): GoPtr<Node>;
export declare function ModuleDeclaration_ForEachChild(receiver: GoPtr<ModuleDeclaration>, v: Visitor): bool;
export declare function ModuleDeclaration_VisitEachChild(receiver: GoPtr<ModuleDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ModuleDeclaration_as_nodeData(receiver: GoPtr<ModuleDeclaration>): nodeData;
export declare function createModuleDeclarationData(): ModuleDeclaration & nodeData;
export interface ImportEqualsDeclaration extends DeclarationBase, StatementBase, ExportableBase, ModifiersBase, CompositeBase {
    IsTypeOnly: bool;
    name: GoPtr<IdentifierNode>;
    ModuleReference: GoPtr<ModuleReference>;
}
export declare function ImportEqualsDeclaration_Clone(receiver: GoPtr<ImportEqualsDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportEqualsDeclaration_Name(receiver: GoPtr<ImportEqualsDeclaration>): GoPtr<Node>;
export declare function ImportEqualsDeclaration_ForEachChild(receiver: GoPtr<ImportEqualsDeclaration>, v: Visitor): bool;
export declare function ImportEqualsDeclaration_VisitEachChild(receiver: GoPtr<ImportEqualsDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportEqualsDeclaration_as_nodeData(receiver: GoPtr<ImportEqualsDeclaration>): nodeData;
export declare function createImportEqualsDeclarationData(): ImportEqualsDeclaration & nodeData;
export interface ExportDeclaration extends DeclarationBase, StatementBase, ModifiersBase, CompositeBase {
    IsTypeOnly: bool;
    ExportClause: GoPtr<NamedExportBindings>;
    ModuleSpecifier: GoPtr<Expression>;
    Attributes: GoPtr<ImportAttributesNode>;
}
export declare function ExportDeclaration_Clone(receiver: GoPtr<ExportDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ExportDeclaration_ForEachChild(receiver: GoPtr<ExportDeclaration>, v: Visitor): bool;
export declare function ExportDeclaration_VisitEachChild(receiver: GoPtr<ExportDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ExportDeclaration_as_nodeData(receiver: GoPtr<ExportDeclaration>): nodeData;
export declare function createExportDeclarationData(): ExportDeclaration & nodeData;
export interface ImportTypeNode extends NodeWithTypeArgumentsBase {
    IsTypeOf: bool;
    Argument: GoPtr<TypeNode>;
    Attributes: GoPtr<ImportAttributesNode>;
    Qualifier: GoPtr<EntityName>;
}
export declare function ImportTypeNode_Clone(receiver: GoPtr<ImportTypeNode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportTypeNode_ForEachChild(receiver: GoPtr<ImportTypeNode>, v: Visitor): bool;
export declare function ImportTypeNode_VisitEachChild(receiver: GoPtr<ImportTypeNode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportTypeNode_as_nodeData(receiver: GoPtr<ImportTypeNode>): nodeData;
export declare function createImportTypeNodeData(): ImportTypeNode & nodeData;
export interface ImportClause extends NodeBase, DeclarationBase, ExportableBase, CompositeBase {
    PhaseModifier: Kind;
    name: GoPtr<IdentifierNode>;
    NamedBindings: GoPtr<NamedImportBindings>;
}
export declare function ImportClause_Clone(receiver: GoPtr<ImportClause>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportClause_Name(receiver: GoPtr<ImportClause>): GoPtr<Node>;
export declare function ImportClause_ForEachChild(receiver: GoPtr<ImportClause>, v: Visitor): bool;
export declare function ImportClause_VisitEachChild(receiver: GoPtr<ImportClause>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportClause_as_nodeData(receiver: GoPtr<ImportClause>): nodeData;
export declare function createImportClauseData(): ImportClause & nodeData;
export interface ImportSpecifier extends NodeBase, DeclarationBase, ExportableBase, CompositeBase {
    IsTypeOnly: bool;
    PropertyName: GoPtr<ModuleExportName>;
    name: GoPtr<IdentifierNode>;
}
export declare function ImportSpecifier_Clone(receiver: GoPtr<ImportSpecifier>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function ImportSpecifier_Name(receiver: GoPtr<ImportSpecifier>): GoPtr<Node>;
export declare function ImportSpecifier_ForEachChild(receiver: GoPtr<ImportSpecifier>, v: Visitor): bool;
export declare function ImportSpecifier_VisitEachChild(receiver: GoPtr<ImportSpecifier>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function ImportSpecifier_as_nodeData(receiver: GoPtr<ImportSpecifier>): nodeData;
export declare function createImportSpecifierData(): ImportSpecifier & nodeData;
export interface JSDocText extends JSDocCommentBase {
}
export declare function JSDocText_Clone(receiver: GoPtr<JSDocText>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocText_as_nodeData(receiver: GoPtr<JSDocText>): nodeData;
export declare function createJSDocTextData(): JSDocText & nodeData;
export interface JSDocLink extends JSDocCommentBase {
    name: GoPtr<EntityName>;
}
export declare function JSDocLink_Clone(receiver: GoPtr<JSDocLink>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocLink_Name(receiver: GoPtr<JSDocLink>): GoPtr<Node>;
export declare function JSDocLink_ForEachChild(receiver: GoPtr<JSDocLink>, v: Visitor): bool;
export declare function JSDocLink_VisitEachChild(receiver: GoPtr<JSDocLink>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocLink_as_nodeData(receiver: GoPtr<JSDocLink>): nodeData;
export declare function createJSDocLinkData(): JSDocLink & nodeData;
export interface JSDocLinkPlain extends JSDocCommentBase {
    name: GoPtr<EntityName>;
}
export declare function JSDocLinkPlain_Clone(receiver: GoPtr<JSDocLinkPlain>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocLinkPlain_Name(receiver: GoPtr<JSDocLinkPlain>): GoPtr<Node>;
export declare function JSDocLinkPlain_ForEachChild(receiver: GoPtr<JSDocLinkPlain>, v: Visitor): bool;
export declare function JSDocLinkPlain_VisitEachChild(receiver: GoPtr<JSDocLinkPlain>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocLinkPlain_as_nodeData(receiver: GoPtr<JSDocLinkPlain>): nodeData;
export declare function createJSDocLinkPlainData(): JSDocLinkPlain & nodeData;
export interface JSDocLinkCode extends JSDocCommentBase {
    name: GoPtr<EntityName>;
}
export declare function JSDocLinkCode_Clone(receiver: GoPtr<JSDocLinkCode>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocLinkCode_Name(receiver: GoPtr<JSDocLinkCode>): GoPtr<Node>;
export declare function JSDocLinkCode_ForEachChild(receiver: GoPtr<JSDocLinkCode>, v: Visitor): bool;
export declare function JSDocLinkCode_VisitEachChild(receiver: GoPtr<JSDocLinkCode>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocLinkCode_as_nodeData(receiver: GoPtr<JSDocLinkCode>): nodeData;
export declare function createJSDocLinkCodeData(): JSDocLinkCode & nodeData;
export interface TypeParameterDeclaration extends NodeBase, DeclarationBase, ModifiersBase, TypeSyntaxBase {
    name: GoPtr<IdentifierNode>;
    Constraint: GoPtr<TypeNode>;
    Expression: GoPtr<Expression>;
    DefaultType: GoPtr<TypeNode>;
}
export declare function TypeParameterDeclaration_Clone(receiver: GoPtr<TypeParameterDeclaration>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function TypeParameterDeclaration_Name(receiver: GoPtr<TypeParameterDeclaration>): GoPtr<Node>;
export declare function TypeParameterDeclaration_ForEachChild(receiver: GoPtr<TypeParameterDeclaration>, v: Visitor): bool;
export declare function TypeParameterDeclaration_VisitEachChild(receiver: GoPtr<TypeParameterDeclaration>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function TypeParameterDeclaration_as_nodeData(receiver: GoPtr<TypeParameterDeclaration>): nodeData;
export declare function createTypeParameterDeclarationData(): TypeParameterDeclaration & nodeData;
export interface SyntheticReferenceExpression extends ExpressionBase {
    Expression: GoPtr<Expression>;
    ThisArg: GoPtr<Expression>;
}
export declare function SyntheticReferenceExpression_Clone(receiver: GoPtr<SyntheticReferenceExpression>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function SyntheticReferenceExpression_ForEachChild(receiver: GoPtr<SyntheticReferenceExpression>, v: Visitor): bool;
export declare function SyntheticReferenceExpression_VisitEachChild(receiver: GoPtr<SyntheticReferenceExpression>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function SyntheticReferenceExpression_computeSubtreeFacts(receiver: GoPtr<SyntheticReferenceExpression>): SubtreeFacts;
export declare function SyntheticReferenceExpression_as_nodeData(receiver: GoPtr<SyntheticReferenceExpression>): nodeData;
export declare function createSyntheticReferenceExpressionData(): SyntheticReferenceExpression & nodeData;
export interface JSDocTypeLiteral extends JSDocTypeBase, DeclarationBase {
    JSDocPropertyTags: GoSlice<GoPtr<Node>>;
    IsArrayType: bool;
}
export declare function JSDocTypeLiteral_Clone(receiver: GoPtr<JSDocTypeLiteral>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocTypeLiteral_ForEachChild(receiver: GoPtr<JSDocTypeLiteral>, v: Visitor): bool;
export declare function JSDocTypeLiteral_VisitEachChild(receiver: GoPtr<JSDocTypeLiteral>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function JSDocTypeLiteral_as_nodeData(receiver: GoPtr<JSDocTypeLiteral>): nodeData;
export declare function createJSDocTypeLiteralData(): JSDocTypeLiteral & nodeData;
export interface JSDocParameterOrPropertyTag extends JSDocTagBase {
    name: GoPtr<EntityName>;
    IsBracketed: bool;
    TypeExpression: GoPtr<TypeNode>;
    IsNameFirst: bool;
}
export declare function JSDocParameterOrPropertyTag_Clone(receiver: GoPtr<JSDocParameterOrPropertyTag>, f: NodeFactoryCoercible): GoPtr<Node>;
export declare function JSDocParameterOrPropertyTag_Name(receiver: GoPtr<JSDocParameterOrPropertyTag>): GoPtr<Node>;
export declare function JSDocParameterOrPropertyTag_ForEachChild(receiver: GoPtr<JSDocParameterOrPropertyTag>, v: Visitor): bool;
export declare function JSDocParameterOrPropertyTag_as_nodeData(receiver: GoPtr<JSDocParameterOrPropertyTag>): nodeData;
export declare function createJSDocParameterOrPropertyTagData(): JSDocParameterOrPropertyTag & nodeData;
//# sourceMappingURL=data.d.ts.map