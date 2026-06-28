import type { bool, byte, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Uint128 } from "../../go/github.com/zeebo/xxh3.js";
import { Mutex, Once, RWMutex } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";
import type { Set } from "../collections/set.js";
import type { ResolutionMode } from "../core/compileroptions.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import type { Pattern } from "../core/pattern.js";
import type { ScriptKind } from "../core/scriptkind.js";
import type { TextPos, TextRange } from "../core/text.js";
import type { Tristate } from "../core/tristate.js";
import type { Path as Path_79c49227 } from "../tspath/path.js";
import type { AccessorDeclarationBase, ArrayLiteralExpression, ArrowFunction, AsExpression, AwaitExpression, BigIntLiteral, BinaryExpression, BindingElement, BindingPattern, Block, CallExpression, CaseOrDefaultClause, CatchClause, ClassDeclaration, ClassExpression, ClassStaticBlockDeclaration, CompositeBase, ConditionalExpression, ComputedPropertyName, ConstructorDeclaration, ConstructorTypeNode, Declaration, DeclarationBase, Decorator, DoStatement, ElementAccessExpression, EnumDeclaration, EnumMember, ExportAssignment, ExportDeclaration, ExportSpecifier, Expression as Expression_9ab73856, ExpressionStatement, ExpressionWithTypeArguments, ForInOrOfStatement, ForStatement, FunctionDeclaration, FunctionExpression, FunctionOrConstructorTypeNodeBase, GetAccessorDeclaration, HeritageClause, IfStatement, Identifier, ImportAttributesNode, ImportClause as ImportClause_58d51725, ImportDeclaration, ImportEqualsDeclaration, ImportSpecifier, IndexSignatureDeclaration, InterfaceDeclaration, JSDocParameterOrPropertyTag, JsxAttribute, JsxAttributes, JsxClosingElement, JsxClosingFragment, JsxElement, JsxExpression, JsxFragment, JsxNamespacedName, JsxOpeningElement, JsxOpeningFragment, JsxSelfClosingElement, JsxSpreadAttribute, JsxText, KeywordExpression, LabeledStatement, LiteralLikeNode, LocalsContainerBase, MetaProperty, MethodDeclaration, MethodSignatureDeclaration, ModuleDeclaration, ModuleName, NamedExports, NamedImports, NewExpression, NodeFactory, NonNullExpression, NoSubstitutionTemplateLiteral, ObjectLiteralExpression, ParameterDeclaration, ParameterDeclarationNode, ParameterList as ParameterList_5701af3c, ParenthesizedExpression, PartiallyEmittedExpression, PostfixUnaryExpression, PrefixUnaryExpression, PrivateIdentifier, PropertyAccessExpression, PropertyAssignment, PropertyDeclaration, PropertySignatureDeclaration, ReturnStatement, SatisfiesExpression, SetAccessorDeclaration, ShorthandPropertyAssignment, SpreadAssignment, SpreadElement, Statement as Statement_98c7cd47, StatementList as StatementList_3cde134f, SwitchStatement, TaggedTemplateExpression, TemplateHead, TemplateMiddle, TemplateTail, Token, TokenNode, TryStatement, TypeAliasDeclaration, TypeAssertion, TypeParameterDeclaration, TypeSyntaxBase, VariableDeclaration, VariableDeclarationList, VariableStatement, WhileStatement, WithStatement, YieldExpression } from "./generated/index.js";
import type { AsteriskToken, AwaitKeyword, BindingName, BinaryOperatorToken, BlockNode, CaseBlockNode, CatchClauseNode, ClassElementList, ColonToken, ConciseBody, DotDotDotToken, ElementList, EntityName, EnumMemberList, EqualsGreaterThanToken, EqualsToken, ExclamationToken, ExportSpecifierList, ExpressionWithTypeArgumentsList, ForInitializer, FunctionBody, HeritageClauseList, IdentifierNode, ImportClauseNode, ImportSpecifierList, JsxAttributesNode, JsxTagNameExpression, MemberName, ModuleBody, ModuleReference, NamedExportBindings, NamedImportBindings, ParameterList, PropertyName, QuestionDotToken, QuestionToken, Statement, StatementList, TemplateLiteral, TypeElementList, TypeList, TypeNode, TypeParameterList, VariableDeclarationListNode, VariableDeclarationNode, VariableDeclarationNodeList } from "./generated/unions.js";
import type { Kind } from "./generated/kinds.js";
import type { NodeFlags } from "./generated/flags.js";
import type { Node, NodeBase, NodeList, ModifierList, NodeFactoryCoercible, Visitor, nodeData } from "./spine.js";
import type { ModifierFlags as ModifierFlags_d6bd8366 } from "./modifierflags.js";
import type { TokenFlags } from "./tokenflags.js";
import type { SubtreeFacts } from "./subtreefacts.js";
import type { Diagnostic } from "./diagnostic.js";
import type { FlowNode, FlowReduceLabelData, FlowSwitchClauseData } from "./flow.js";
import type { SourceFileParseOptions } from "./parseoptions.js";
import type { PositionMap } from "./positionmap.js";
import type { Symbol as Symbol_4919c5f0, SymbolTable } from "./symbol.js";
import type { NodeVisitor } from "./visitor.js";
export type { Node, NodeList, ModifierList, NodeFactoryCoercible, Visitor, nodeData, NodeBase } from "./spine.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::varGroup::parseJSDocForNode","kind":"varGroup","status":"implemented","sigHash":"5ac2e1c2b1fa4923ca9e2b5a393324ec40d359485e4b84a71e90a0e3709b2a59","bodyHash":"ee0732b6f5907671106f1890827985a41457e26b69ec619310f430583e750e74"}
 *
 * Go source:
 * var parseJSDocForNode func(*SourceFile, *Node) []*Node
 */
export declare let parseJSDocForNode: ((arg0: GoPtr<SourceFile>, arg1: GoPtr<Node>) => GoSlice<GoPtr<Node>>) | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::SetParseJSDocForNode","kind":"func","status":"implemented","sigHash":"5aca890b39fdda6f4899a1aa07e2be2add8bfdb3e21fbf63d0ef1efdeccb0d2a","bodyHash":"42d8f8eca703ba54c171f8255bb5ea33de96b58602e639bc20aa9a826183ce5f"}
 *
 * Go source:
 * func SetParseJSDocForNode(fn func(*SourceFile, *Node) []*Node) {
 * 	parseJSDocForNode = fn
 * }
 */
export declare function SetParseJSDocForNode(fn: (arg0: GoPtr<SourceFile>, arg1: GoPtr<Node>) => GoSlice<GoPtr<Node>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ParameterList","kind":"method","status":"implemented","sigHash":"74b6967bc8926b8a1c8985126ff19ca776119579407d529c03f57ea474b592ad","bodyHash":"306d1278e586826119d6993be361606d65ac5cef2ed3d056d9504d2371f1fb10"}
 *
 * Go source:
 * func (n *Node) ParameterList() *ParameterList             { return n.data.FunctionLikeData().Parameters }
 */
export declare function Node_ParameterList(receiver: GoPtr<Node>): GoPtr<ParameterList_5701af3c>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Parameters","kind":"method","status":"implemented","sigHash":"23cf975d760f34a8befc8b0300529b27a330b0a6f5f699459e4a6535e1360d20","bodyHash":"25c5242a76db327b5348ff6821dbce5e95d90da3edb45ae378f8315b9b3f2c9b"}
 *
 * Go source:
 * func (n *Node) Parameters() []*ParameterDeclarationNode   { return n.ParameterList().Nodes }
 */
export declare function Node_Parameters(receiver: GoPtr<Node>): GoSlice<GoPtr<ParameterDeclarationNode>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Decorators","kind":"method","status":"implemented","sigHash":"a93d7aca147a7b35e6c93423739ca898e430c565f89c7bfcbcc4252a3f5739f6","bodyHash":"c15a7dc4bacf014e60bd659110c713a63d65f63a38f74e966439cc9b468c7b2b"}
 *
 * Go source:
 * func (n *Node) Decorators() []*Node {
 * 	if n.Modifiers() == nil {
 * 		return nil
 * 	}
 * 	return core.Filter(n.Modifiers().Nodes, IsDecorator)
 * }
 */
export declare function Node_Decorators(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::MutableNode","kind":"type","status":"implemented","sigHash":"680e266ad37e89e56bcec1ff45c8b38e43c4dc5964c0dfc644285e9d4b5b6ffd","bodyHash":"74404c47623ed24ff296978787381a3ba81ceee723b5f5d85ce60f76a136442e"}
 *
 * Go source:
 * MutableNode Node
 */
export type MutableNode = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.AsMutable","kind":"method","status":"implemented","sigHash":"4283fb273144f250fc065d8d19a61bff0c1f8b54520e82bd6adf17b4f7695cb3","bodyHash":"ca8df0015ba1b5cff80ce1f57a5b18834be506677e05871d649fcb0ed6b45db0"}
 *
 * Go source:
 * func (n *Node) AsMutable() *MutableNode                     { return (*MutableNode)(n) }
 */
export declare function Node_AsMutable(receiver: GoPtr<Node>): GoPtr<MutableNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MutableNode.SetModifiers","kind":"method","status":"implemented","sigHash":"0ca0cec51609e27334688c2d7fbb55e4c922de4c80c463c4e7fc819e8a670c0a","bodyHash":"a4aa87a4c81e435a076eafc78e3b70cd4216c2cced7125619a7cbc07165f2350"}
 *
 * Go source:
 * func (n *MutableNode) SetModifiers(modifiers *ModifierList) { n.data.setModifiers(modifiers) }
 */
export declare function MutableNode_SetModifiers(receiver: GoPtr<MutableNode>, modifiers: GoPtr<ModifierList>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Symbol","kind":"method","status":"implemented","sigHash":"ea82523908dc157b6fd2262662b05f615a4ac39ce27e570b753a1242b3b094f0","bodyHash":"2341cb25830d96aed66d74985a64610058eedf7be04c8502c6e0a01ba536014e"}
 *
 * Go source:
 * func (n *Node) Symbol() *Symbol {
 * 	data := n.DeclarationData()
 * 	if data != nil {
 * 		return data.Symbol
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Symbol(receiver: GoPtr<Node>): GoPtr<Symbol_4919c5f0>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.LocalSymbol","kind":"method","status":"implemented","sigHash":"e564329fbf0f616daa60682bf81ee2c219b3428dd95e009b85a2c4d0fed59f44","bodyHash":"892b36923cecf19c682d60f1986f1b87cd83cb34d5db0e29fe4a3faef837d656"}
 *
 * Go source:
 * func (n *Node) LocalSymbol() *Symbol {
 * 	data := n.ExportableData()
 * 	if data != nil {
 * 		return data.LocalSymbol
 * 	}
 * 	return nil
 * }
 */
export declare function Node_LocalSymbol(receiver: GoPtr<Node>): GoPtr<Symbol_4919c5f0>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Locals","kind":"method","status":"implemented","sigHash":"96cc6e0f6d53895751a7e2645ec3fa462ce5e01286476998db8cfac3aea047c9","bodyHash":"9b2e77308b497b3559bac318b2a7f17966334c73e00d92ffae8d73f9f9f31eb9"}
 *
 * Go source:
 * func (n *Node) Locals() SymbolTable {
 * 	data := n.LocalsContainerData()
 * 	if data != nil {
 * 		return data.Locals
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Locals(receiver: GoPtr<Node>): SymbolTable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Body","kind":"method","status":"implemented","sigHash":"5e7666cfdb8d5ab11f3f0f64ad018f85e37676783a6fc9717fa05615193a47d3","bodyHash":"63a8eea0ad583858627aea55c6730afb22e6d4bed8e931433d630fa9f1d7bb99"}
 *
 * Go source:
 * func (n *Node) Body() *Node {
 * 	data := n.BodyData()
 * 	if data != nil {
 * 		return data.Body
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Body(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Text","kind":"method","status":"implemented","sigHash":"a6aba8a47a0b182d8908213b0c85105a97a394c5582e9943985e1641fe18474e","bodyHash":"cc9ab44b3987b720e322b9b3f36edd0e231e58acddeaa8482b8fe856f42262bf"}
 *
 * Go source:
 * func (n *Node) Text() string {
 * 	switch n.Kind {
 * 	case KindIdentifier:
 * 		return n.AsIdentifier().Text
 * 	case KindPrivateIdentifier:
 * 		return n.AsPrivateIdentifier().Text
 * 	case KindStringLiteral:
 * 		return n.AsStringLiteral().Text
 * 	case KindNumericLiteral:
 * 		return n.AsNumericLiteral().Text
 * 	case KindBigIntLiteral:
 * 		return n.AsBigIntLiteral().Text
 * 	case KindMetaProperty:
 * 		return n.AsMetaProperty().Name().Text()
 * 	case KindNoSubstitutionTemplateLiteral:
 * 		return n.AsNoSubstitutionTemplateLiteral().Text
 * 	case KindTemplateHead:
 * 		return n.AsTemplateHead().Text
 * 	case KindTemplateMiddle:
 * 		return n.AsTemplateMiddle().Text
 * 	case KindTemplateTail:
 * 		return n.AsTemplateTail().Text
 * 	case KindJsxNamespacedName:
 * 		return n.AsJsxNamespacedName().Namespace.Text() + ":" + n.AsJsxNamespacedName().name.Text()
 * 	case KindRegularExpressionLiteral:
 * 		return n.AsRegularExpressionLiteral().Text
 * 	case KindJSDocText:
 * 		return strings.Join(n.AsJSDocText().text, "")
 * 	case KindJSDocLink:
 * 		return strings.Join(n.AsJSDocLink().text, "")
 * 	case KindJSDocLinkCode:
 * 		return strings.Join(n.AsJSDocLinkCode().text, "")
 * 	case KindJSDocLinkPlain:
 * 		return strings.Join(n.AsJSDocLinkPlain().text, "")
 * 	}
 * 	panic(fmt.Sprintf("Unhandled case in Node.Text: %T", n.data))
 * }
 */
export declare function Node_Text(receiver: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Expression","kind":"method","status":"implemented","sigHash":"a453427ef69453f5942ee80cf683d4eab35ae7ed427489a29dbb9eb971bdb4e2","bodyHash":"38c7bf76b34f69c9a297f6b23b331d26d01eb9f74bc849395424485d97e6c480"}
 *
 * Go source:
 * func (n *Node) Expression() *Node {
 * 	switch n.Kind {
 * 	case KindPropertyAccessExpression:
 * 		return n.AsPropertyAccessExpression().Expression
 * 	case KindElementAccessExpression:
 * 		return n.AsElementAccessExpression().Expression
 * 	case KindParenthesizedExpression:
 * 		return n.AsParenthesizedExpression().Expression
 * 	case KindCallExpression:
 * 		return n.AsCallExpression().Expression
 * 	case KindNewExpression:
 * 		return n.AsNewExpression().Expression
 * 	case KindExpressionWithTypeArguments:
 * 		return n.AsExpressionWithTypeArguments().Expression
 * 	case KindComputedPropertyName:
 * 		return n.AsComputedPropertyName().Expression
 * 	case KindNonNullExpression:
 * 		return n.AsNonNullExpression().Expression
 * 	case KindTypeAssertionExpression:
 * 		return n.AsTypeAssertion().Expression
 * 	case KindAsExpression:
 * 		return n.AsAsExpression().Expression
 * 	case KindSatisfiesExpression:
 * 		return n.AsSatisfiesExpression().Expression
 * 	case KindTypeOfExpression:
 * 		return n.AsTypeOfExpression().Expression
 * 	case KindSpreadAssignment:
 * 		return n.AsSpreadAssignment().Expression
 * 	case KindSpreadElement:
 * 		return n.AsSpreadElement().Expression
 * 	case KindTemplateSpan:
 * 		return n.AsTemplateSpan().Expression
 * 	case KindDeleteExpression:
 * 		return n.AsDeleteExpression().Expression
 * 	case KindVoidExpression:
 * 		return n.AsVoidExpression().Expression
 * 	case KindAwaitExpression:
 * 		return n.AsAwaitExpression().Expression
 * 	case KindYieldExpression:
 * 		return n.AsYieldExpression().Expression
 * 	case KindPartiallyEmittedExpression:
 * 		return n.AsPartiallyEmittedExpression().Expression
 * 	case KindIfStatement:
 * 		return n.AsIfStatement().Expression
 * 	case KindDoStatement:
 * 		return n.AsDoStatement().Expression
 * 	case KindWhileStatement:
 * 		return n.AsWhileStatement().Expression
 * 	case KindWithStatement:
 * 		return n.AsWithStatement().Expression
 * 	case KindForInStatement, KindForOfStatement:
 * 		return n.AsForInOrOfStatement().Expression
 * 	case KindSwitchStatement:
 * 		return n.AsSwitchStatement().Expression
 * 	case KindCaseClause:
 * 		return n.AsCaseOrDefaultClause().Expression
 * 	case KindExpressionStatement:
 * 		return n.AsExpressionStatement().Expression
 * 	case KindReturnStatement:
 * 		return n.AsReturnStatement().Expression
 * 	case KindThrowStatement:
 * 		return n.AsThrowStatement().Expression
 * 	case KindExternalModuleReference:
 * 		return n.AsExternalModuleReference().Expression
 * 	case KindExportAssignment:
 * 		return n.AsExportAssignment().Expression
 * 	case KindDecorator:
 * 		return n.AsDecorator().Expression
 * 	case KindJsxExpression:
 * 		return n.AsJsxExpression().Expression
 * 	case KindJsxSpreadAttribute:
 * 		return n.AsJsxSpreadAttribute().Expression
 * 	}
 * 	panic("Unhandled case in Node.Expression: " + n.Kind.String())
 * }
 */
export declare function Node_Expression(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.RawText","kind":"method","status":"implemented","sigHash":"380d953fd044b1a507136c6d94f31de03b2ddb60d6aeafeb450112cb659c92b4","bodyHash":"f9fd02b52d8f6cca08a88643c6a0f41055e9ba795fa23110775d7aa262a2950c"}
 *
 * Go source:
 * func (n *Node) RawText() string {
 * 	switch n.Kind {
 * 	case KindTemplateHead:
 * 		return n.AsTemplateHead().RawText
 * 	case KindTemplateMiddle:
 * 		return n.AsTemplateMiddle().RawText
 * 	case KindTemplateTail:
 * 		return n.AsTemplateTail().RawText
 * 	}
 * 	panic("Unhandled case in Node.RawText: " + n.Kind.String())
 * }
 */
export declare function Node_RawText(receiver: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MutableNode.SetExpression","kind":"method","status":"implemented","sigHash":"2ea3b5d2e59d72a764a1dd0d905a1a3a1fd173b78da421cc0def68cb864a6bd9","bodyHash":"3c62dc877dd419cd07f784d05cc09cd35c25c953a6e97c9e7d725af4911d3e7a"}
 *
 * Go source:
 * func (m *MutableNode) SetExpression(expr *Node) {
 * 	n := (*Node)(m)
 * 	switch n.Kind {
 * 	case KindPropertyAccessExpression:
 * 		n.AsPropertyAccessExpression().Expression = expr
 * 	case KindElementAccessExpression:
 * 		n.AsElementAccessExpression().Expression = expr
 * 	case KindParenthesizedExpression:
 * 		n.AsParenthesizedExpression().Expression = expr
 * 	case KindCallExpression:
 * 		n.AsCallExpression().Expression = expr
 * 	case KindNewExpression:
 * 		n.AsNewExpression().Expression = expr
 * 	case KindExpressionWithTypeArguments:
 * 		n.AsExpressionWithTypeArguments().Expression = expr
 * 	case KindComputedPropertyName:
 * 		n.AsComputedPropertyName().Expression = expr
 * 	case KindNonNullExpression:
 * 		n.AsNonNullExpression().Expression = expr
 * 	case KindTypeAssertionExpression:
 * 		n.AsTypeAssertion().Expression = expr
 * 	case KindAsExpression:
 * 		n.AsAsExpression().Expression = expr
 * 	case KindSatisfiesExpression:
 * 		n.AsSatisfiesExpression().Expression = expr
 * 	case KindTypeOfExpression:
 * 		n.AsTypeOfExpression().Expression = expr
 * 	case KindSpreadAssignment:
 * 		n.AsSpreadAssignment().Expression = expr
 * 	case KindSpreadElement:
 * 		n.AsSpreadElement().Expression = expr
 * 	case KindTemplateSpan:
 * 		n.AsTemplateSpan().Expression = expr
 * 	case KindDeleteExpression:
 * 		n.AsDeleteExpression().Expression = expr
 * 	case KindVoidExpression:
 * 		n.AsVoidExpression().Expression = expr
 * 	case KindAwaitExpression:
 * 		n.AsAwaitExpression().Expression = expr
 * 	case KindYieldExpression:
 * 		n.AsYieldExpression().Expression = expr
 * 	case KindPartiallyEmittedExpression:
 * 		n.AsPartiallyEmittedExpression().Expression = expr
 * 	case KindIfStatement:
 * 		n.AsIfStatement().Expression = expr
 * 	case KindDoStatement:
 * 		n.AsDoStatement().Expression = expr
 * 	case KindWhileStatement:
 * 		n.AsWhileStatement().Expression = expr
 * 	case KindWithStatement:
 * 		n.AsWithStatement().Expression = expr
 * 	case KindForInStatement, KindForOfStatement:
 * 		n.AsForInOrOfStatement().Expression = expr
 * 	case KindSwitchStatement:
 * 		n.AsSwitchStatement().Expression = expr
 * 	case KindCaseClause:
 * 		n.AsCaseOrDefaultClause().Expression = expr
 * 	case KindExpressionStatement:
 * 		n.AsExpressionStatement().Expression = expr
 * 	case KindReturnStatement:
 * 		n.AsReturnStatement().Expression = expr
 * 	case KindThrowStatement:
 * 		n.AsThrowStatement().Expression = expr
 * 	case KindExternalModuleReference:
 * 		n.AsExternalModuleReference().Expression = expr
 * 	case KindExportAssignment:
 * 		n.AsExportAssignment().Expression = expr
 * 	case KindDecorator:
 * 		n.AsDecorator().Expression = expr
 * 	case KindJsxExpression:
 * 		n.AsJsxExpression().Expression = expr
 * 	case KindJsxSpreadAttribute:
 * 		n.AsJsxSpreadAttribute().Expression = expr
 * 	default:
 * 		panic("Unhandled case in mutableNode.SetExpression: " + n.Kind.String())
 * 	}
 * }
 */
export declare function MutableNode_SetExpression(receiver: GoPtr<MutableNode>, expr: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ArgumentList","kind":"method","status":"implemented","sigHash":"018f4d26efb4dc96cd74f4dca512cdce361ada9dde6596130108508f4c92d4d7","bodyHash":"3d0eb2f0b95510e01682995708700533759f868d25cfec121417d6abb7f6b48b"}
 *
 * Go source:
 * func (n *Node) ArgumentList() *NodeList {
 * 	switch n.Kind {
 * 	case KindCallExpression:
 * 		return n.AsCallExpression().Arguments
 * 	case KindNewExpression:
 * 		return n.AsNewExpression().Arguments
 * 	}
 * 	panic("Unhandled case in Node.Arguments: " + n.Kind.String())
 * }
 */
export declare function Node_ArgumentList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Arguments","kind":"method","status":"implemented","sigHash":"4991e3b1d6b60d99977a8e87a7d8410aa8f8249f97b53247ece29a51302f7ec0","bodyHash":"1648053b7d51b1fb560dbf6ff4930f1a8ce6e95221cfaf0754bcb1dba2eeb87e"}
 *
 * Go source:
 * func (n *Node) Arguments() []*Node {
 * 	list := n.ArgumentList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Arguments(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TypeArgumentList","kind":"method","status":"implemented","sigHash":"33c00bff7d5efb518863aa138bfbffe7cd7bd3b5b69bc77738b542b481a3bb89","bodyHash":"0e3ed6f0933dbabb251f47b2624bc37bfec423d269d8083f8b05bb3bbb0e1ab4"}
 *
 * Go source:
 * func (n *Node) TypeArgumentList() *NodeList {
 * 	switch n.Kind {
 * 	case KindCallExpression:
 * 		return n.AsCallExpression().TypeArguments
 * 	case KindNewExpression:
 * 		return n.AsNewExpression().TypeArguments
 * 	case KindTaggedTemplateExpression:
 * 		return n.AsTaggedTemplateExpression().TypeArguments
 * 	case KindTypeReference:
 * 		return n.AsTypeReferenceNode().TypeArguments
 * 	case KindExpressionWithTypeArguments:
 * 		return n.AsExpressionWithTypeArguments().TypeArguments
 * 	case KindImportType:
 * 		return n.AsImportTypeNode().TypeArguments
 * 	case KindTypeQuery:
 * 		return n.AsTypeQueryNode().TypeArguments
 * 	case KindJsxOpeningElement:
 * 		return n.AsJsxOpeningElement().TypeArguments
 * 	case KindJsxSelfClosingElement:
 * 		return n.AsJsxSelfClosingElement().TypeArguments
 * 	}
 * 	panic("Unhandled case in Node.TypeArguments")
 * }
 */
export declare function Node_TypeArgumentList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TypeArguments","kind":"method","status":"implemented","sigHash":"8e0c26f2c4258529661c05e8fcd66a2b2f917ce0a0e37e371a87f911a302f884","bodyHash":"27a0c7a1ff085b18725eea4d802a2828193e24d8d5a94482f4302773f5b6ed57"}
 *
 * Go source:
 * func (n *Node) TypeArguments() []*Node {
 * 	list := n.TypeArgumentList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_TypeArguments(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TypeParameterList","kind":"method","status":"implemented","sigHash":"19423008898710885d601fe16d603321dbcebcc21c658363b8a1e614c0604554","bodyHash":"92d683bdff431bad0da76f38fadc4f14b35b9824f8711a2da07c08ef1ddcbaad"}
 *
 * Go source:
 * func (n *Node) TypeParameterList() *NodeList {
 * 	switch n.Kind {
 * 	case KindClassDeclaration:
 * 		return n.AsClassDeclaration().TypeParameters
 * 	case KindClassExpression:
 * 		return n.AsClassExpression().TypeParameters
 * 	case KindInterfaceDeclaration:
 * 		return n.AsInterfaceDeclaration().TypeParameters
 * 	case KindTypeAliasDeclaration, KindJSTypeAliasDeclaration:
 * 		return n.AsTypeAliasDeclaration().TypeParameters
 * 	case KindJSDocTemplateTag:
 * 		return n.AsJSDocTemplateTag().TypeParameters
 * 	default:
 * 		funcLike := n.FunctionLikeData()
 * 		if funcLike != nil {
 * 			return funcLike.TypeParameters
 * 		}
 * 	}
 * 	panic("Unhandled case in Node.TypeParameterList")
 * }
 */
export declare function Node_TypeParameterList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TypeParameters","kind":"method","status":"implemented","sigHash":"317c4b970e6c3c05a95e2272c17fe37279af7691443eb78d81ad1d500e3eedfc","bodyHash":"38dc00cceb6e63d3f341d09f501d894df5e894b2419c0ddfa0a44885350cefb7"}
 *
 * Go source:
 * func (n *Node) TypeParameters() []*Node {
 * 	list := n.TypeParameterList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_TypeParameters(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.MemberList","kind":"method","status":"implemented","sigHash":"94773b319c6fef9bb7b6c71e06a7461198456451f8a20cc36eab160e818927a8","bodyHash":"4115beefaf441365c0576a3b5abcf359f19487cf547128e1289d165cbe5a8799"}
 *
 * Go source:
 * func (n *Node) MemberList() *NodeList {
 * 	switch n.Kind {
 * 	case KindClassDeclaration:
 * 		return n.AsClassDeclaration().Members
 * 	case KindClassExpression:
 * 		return n.AsClassExpression().Members
 * 	case KindInterfaceDeclaration:
 * 		return n.AsInterfaceDeclaration().Members
 * 	case KindEnumDeclaration:
 * 		return n.AsEnumDeclaration().Members
 * 	case KindTypeLiteral:
 * 		return n.AsTypeLiteralNode().Members
 * 	case KindMappedType:
 * 		return n.AsMappedTypeNode().Members
 * 	}
 * 	panic("Unhandled case in Node.MemberList: " + n.Kind.String())
 * }
 */
export declare function Node_MemberList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Members","kind":"method","status":"implemented","sigHash":"6981b89b11fdafc2f09dd9fb999e3568ce00bff2c82857b977aaf2daec4689c9","bodyHash":"d4b6bbb0f55cf81d3b72af3aee314f0d7382b97e105c43726854d161e4c97502"}
 *
 * Go source:
 * func (n *Node) Members() []*Node {
 * 	list := n.MemberList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Members(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.StatementList","kind":"method","status":"implemented","sigHash":"07c566de6753738c8253d99218a4f0aae9a8d6dda7af6b09ae2f18472a5cbc59","bodyHash":"239cb5c874f032ed1cc9884fa2dde0a83d7bca9b09e3b95ef4977dea1fc482fc"}
 *
 * Go source:
 * func (n *Node) StatementList() *NodeList {
 * 	switch n.Kind {
 * 	case KindSourceFile:
 * 		return n.AsSourceFile().Statements
 * 	case KindBlock:
 * 		return n.AsBlock().Statements
 * 	case KindModuleBlock:
 * 		return n.AsModuleBlock().Statements
 * 	case KindCaseClause, KindDefaultClause:
 * 		return n.AsCaseOrDefaultClause().Statements
 * 	}
 * 	panic("Unhandled case in Node.StatementList: " + n.Kind.String())
 * }
 */
export declare function Node_StatementList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Statements","kind":"method","status":"implemented","sigHash":"532d997f2231da797fedeabd37f7e9cb80dc43e0770d6370b83282268ac6292f","bodyHash":"35f4ce03949023e2740b28636492b2d454660142b85a1312cfca71c50453739b"}
 *
 * Go source:
 * func (n *Node) Statements() []*Node {
 * 	list := n.StatementList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Statements(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.CanHaveStatements","kind":"method","status":"implemented","sigHash":"ec609876401aa4a8ead475adf46be6e537641353288def2d8c4ec66e405b8247","bodyHash":"3cd5389f751c1f1438f030fd5cec02bf91a63e03065bfdf70abc31013dbe6710"}
 *
 * Go source:
 * func (n *Node) CanHaveStatements() bool {
 * 	switch n.Kind {
 * 	case KindSourceFile, KindBlock, KindModuleBlock, KindCaseClause, KindDefaultClause:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export declare function Node_CanHaveStatements(receiver: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ModifierFlags","kind":"method","status":"implemented","sigHash":"4123e1777e8e8653aaa4f35916df0b5a3a93cbdc8768c8369de483ce6612cd65","bodyHash":"22e4d55a90a78dc20ce70247e0cda316eb16ab1fa1b2257b486f8ea671aba792"}
 *
 * Go source:
 * func (n *Node) ModifierFlags() ModifierFlags {
 * 	modifiers := n.Modifiers()
 * 	if modifiers != nil {
 * 		return modifiers.ModifierFlags
 * 	}
 * 	return ModifierFlagsNone
 * }
 */
export declare function Node_ModifierFlags(receiver: GoPtr<Node>): ModifierFlags_d6bd8366;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ModifierNodes","kind":"method","status":"implemented","sigHash":"85068ebfe90393905e7e2b35e28f508999d7ebd72c5f6d6ee2b0723f2c617bc3","bodyHash":"8989d6ad2085f89bf569331dbddd87eaecc0e1c181138013a6fcb782ee454c3c"}
 *
 * Go source:
 * func (n *Node) ModifierNodes() []*Node {
 * 	modifiers := n.Modifiers()
 * 	if modifiers != nil {
 * 		return modifiers.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_ModifierNodes(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Type","kind":"method","status":"implemented","sigHash":"d120617346d2454b9b23ca70430df0558a869e82851205023d858d1d889d710d","bodyHash":"1c9143e224b78001641ffd1c168d03a72d505ca5472f2e2fc3e02d12f9454223"}
 *
 * Go source:
 * func (n *Node) Type() *Node {
 * 	switch n.Kind {
 * 	case KindVariableDeclaration:
 * 		return n.AsVariableDeclaration().Type
 * 	case KindParameter:
 * 		return n.AsParameterDeclaration().Type
 * 	case KindPropertySignature:
 * 		return n.AsPropertySignatureDeclaration().Type
 * 	case KindPropertyDeclaration:
 * 		return n.AsPropertyDeclaration().Type
 * 	case KindPropertyAssignment:
 * 		return n.AsPropertyAssignment().Type
 * 	case KindShorthandPropertyAssignment:
 * 		return n.AsShorthandPropertyAssignment().Type
 * 	case KindTypePredicate:
 * 		return n.AsTypePredicateNode().Type
 * 	case KindParenthesizedType:
 * 		return n.AsParenthesizedTypeNode().Type
 * 	case KindTypeOperator:
 * 		return n.AsTypeOperatorNode().Type
 * 	case KindMappedType:
 * 		return n.AsMappedTypeNode().Type
 * 	case KindTypeAssertionExpression:
 * 		return n.AsTypeAssertion().Type
 * 	case KindAsExpression:
 * 		return n.AsAsExpression().Type
 * 	case KindSatisfiesExpression:
 * 		return n.AsSatisfiesExpression().Type
 * 	case KindTypeAliasDeclaration, KindJSTypeAliasDeclaration:
 * 		return n.AsTypeAliasDeclaration().Type
 * 	case KindNamedTupleMember:
 * 		return n.AsNamedTupleMember().Type
 * 	case KindOptionalType:
 * 		return n.AsOptionalTypeNode().Type
 * 	case KindRestType:
 * 		return n.AsRestTypeNode().Type
 * 	case KindTemplateLiteralTypeSpan:
 * 		return n.AsTemplateLiteralTypeSpan().Type
 * 	case KindJSDocTypeExpression:
 * 		return n.AsJSDocTypeExpression().Type
 * 	case KindJSDocParameterTag, KindJSDocPropertyTag:
 * 		return n.AsJSDocParameterOrPropertyTag().TypeExpression
 * 	case KindJSDocNullableType:
 * 		return n.AsJSDocNullableType().Type
 * 	case KindJSDocNonNullableType:
 * 		return n.AsJSDocNonNullableType().Type
 * 	case KindJSDocOptionalType:
 * 		return n.AsJSDocOptionalType().Type
 * 	case KindExportAssignment:
 * 		return n.AsExportAssignment().Type
 * 	case KindBinaryExpression:
 * 		return n.AsBinaryExpression().Type
 * 	default:
 * 		if funcLike := n.FunctionLikeData(); funcLike != nil {
 * 			return funcLike.Type
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Type(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MutableNode.SetType","kind":"method","status":"implemented","sigHash":"4b2f396e5bcf615594613fb71d30ae0baf6f2fda8ed951da7918fa37f49558e4","bodyHash":"6ecdcf63c8754e41752aaf9c51e89379fed3bd66e6e0b5c24e6c5fa41c9feaf2"}
 *
 * Go source:
 * func (m *MutableNode) SetType(t *Node) {
 * 	n := (*Node)(m)
 * 	switch m.Kind {
 * 	case KindVariableDeclaration:
 * 		n.AsVariableDeclaration().Type = t
 * 	case KindParameter:
 * 		n.AsParameterDeclaration().Type = t
 * 	case KindPropertySignature:
 * 		n.AsPropertySignatureDeclaration().Type = t
 * 	case KindPropertyDeclaration:
 * 		n.AsPropertyDeclaration().Type = t
 * 	case KindPropertyAssignment:
 * 		n.AsPropertyAssignment().Type = t
 * 	case KindShorthandPropertyAssignment:
 * 		n.AsShorthandPropertyAssignment().Type = t
 * 	case KindTypePredicate:
 * 		n.AsTypePredicateNode().Type = t
 * 	case KindParenthesizedType:
 * 		n.AsParenthesizedTypeNode().Type = t
 * 	case KindTypeOperator:
 * 		n.AsTypeOperatorNode().Type = t
 * 	case KindMappedType:
 * 		n.AsMappedTypeNode().Type = t
 * 	case KindTypeAssertionExpression:
 * 		n.AsTypeAssertion().Type = t
 * 	case KindAsExpression:
 * 		n.AsAsExpression().Type = t
 * 	case KindSatisfiesExpression:
 * 		n.AsSatisfiesExpression().Type = t
 * 	case KindTypeAliasDeclaration, KindJSTypeAliasDeclaration:
 * 		n.AsTypeAliasDeclaration().Type = t
 * 	case KindNamedTupleMember:
 * 		n.AsNamedTupleMember().Type = t
 * 	case KindOptionalType:
 * 		n.AsOptionalTypeNode().Type = t
 * 	case KindRestType:
 * 		n.AsRestTypeNode().Type = t
 * 	case KindTemplateLiteralTypeSpan:
 * 		n.AsTemplateLiteralTypeSpan().Type = t
 * 	case KindJSDocTypeExpression:
 * 		n.AsJSDocTypeExpression().Type = t
 * 	case KindJSDocParameterTag, KindJSDocPropertyTag:
 * 		n.AsJSDocParameterOrPropertyTag().TypeExpression = t
 * 	case KindJSDocNullableType:
 * 		n.AsJSDocNullableType().Type = t
 * 	case KindJSDocNonNullableType:
 * 		n.AsJSDocNonNullableType().Type = t
 * 	case KindJSDocOptionalType:
 * 		n.AsJSDocOptionalType().Type = t
 * 	case KindExportAssignment:
 * 		n.AsExportAssignment().Type = t
 * 	case KindBinaryExpression:
 * 		n.AsBinaryExpression().Type = t
 * 	default:
 * 		if funcLike := n.FunctionLikeData(); funcLike != nil {
 * 			funcLike.Type = t
 * 		} else {
 * 			panic("Unhandled case in mutableNode.SetType: " + n.Kind.String())
 * 		}
 * 	}
 * }
 */
export declare function MutableNode_SetType(receiver: GoPtr<MutableNode>, t: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Initializer","kind":"method","status":"implemented","sigHash":"3e1776a793c2166ed6e16e270c0df24a1824b90193a8ff35cf648194e97a531d","bodyHash":"085ff4561c16ac23e8e7f1b56d137f5a9abf0e6d1fa538d1a9dcdc6c4c993ce1"}
 *
 * Go source:
 * func (n *Node) Initializer() *Node {
 * 	switch n.Kind {
 * 	case KindVariableDeclaration:
 * 		return n.AsVariableDeclaration().Initializer
 * 	case KindParameter:
 * 		return n.AsParameterDeclaration().Initializer
 * 	case KindBindingElement:
 * 		return n.AsBindingElement().Initializer
 * 	case KindPropertyDeclaration:
 * 		return n.AsPropertyDeclaration().Initializer
 * 	case KindPropertySignature:
 * 		return n.AsPropertySignatureDeclaration().Initializer
 * 	case KindPropertyAssignment:
 * 		return n.AsPropertyAssignment().Initializer
 * 	case KindEnumMember:
 * 		return n.AsEnumMember().Initializer
 * 	case KindForStatement:
 * 		return n.AsForStatement().Initializer
 * 	case KindForInStatement, KindForOfStatement:
 * 		return n.AsForInOrOfStatement().Initializer
 * 	case KindJsxAttribute:
 * 		return n.AsJsxAttribute().Initializer
 * 	}
 * 	panic("Unhandled case in Node.Initializer")
 * }
 */
export declare function Node_Initializer(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MutableNode.SetInitializer","kind":"method","status":"implemented","sigHash":"64f21c4461a65c71df46052f93bb54362768496601aefcad1fdce063cb6fa2fe","bodyHash":"17292fbcc0893c66f5a3fa9c19f46d78d0b9342c999eeaeccbdd3e7b90d4f027"}
 *
 * Go source:
 * func (m *MutableNode) SetInitializer(initializer *Node) {
 * 	n := (*Node)(m)
 * 	switch n.Kind {
 * 	case KindVariableDeclaration:
 * 		n.AsVariableDeclaration().Initializer = initializer
 * 	case KindParameter:
 * 		n.AsParameterDeclaration().Initializer = initializer
 * 	case KindBindingElement:
 * 		n.AsBindingElement().Initializer = initializer
 * 	case KindPropertyDeclaration:
 * 		n.AsPropertyDeclaration().Initializer = initializer
 * 	case KindPropertySignature:
 * 		n.AsPropertySignatureDeclaration().Initializer = initializer
 * 	case KindPropertyAssignment:
 * 		n.AsPropertyAssignment().Initializer = initializer
 * 	case KindEnumMember:
 * 		n.AsEnumMember().Initializer = initializer
 * 	case KindForStatement:
 * 		n.AsForStatement().Initializer = initializer
 * 	case KindForInStatement, KindForOfStatement:
 * 		n.AsForInOrOfStatement().Initializer = initializer
 * 	case KindJsxAttribute:
 * 		n.AsJsxAttribute().Initializer = initializer
 * 	default:
 * 		panic("Unhandled case in mutableNode.SetInitializer")
 * 	}
 * }
 */
export declare function MutableNode_SetInitializer(receiver: GoPtr<MutableNode>, initializer: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TagName","kind":"method","status":"implemented","sigHash":"84a4dabde8dae9fd2a382c718ddf350d8336fc9046ec00256bd526c61c79223d","bodyHash":"2f412fc7c02073ce9deb4a3f1a345146021a46cefeaa4b79e3bf205a523163b6"}
 *
 * Go source:
 * func (n *Node) TagName() *Node {
 * 	switch n.Kind {
 * 	case KindJsxOpeningElement:
 * 		return n.AsJsxOpeningElement().TagName
 * 	case KindJsxClosingElement:
 * 		return n.AsJsxClosingElement().TagName
 * 	case KindJsxSelfClosingElement:
 * 		return n.AsJsxSelfClosingElement().TagName
 * 	case KindJSDocUnknownTag:
 * 		return n.AsJSDocUnknownTag().TagName
 * 	case KindJSDocAugmentsTag:
 * 		return n.AsJSDocAugmentsTag().TagName
 * 	case KindJSDocImplementsTag:
 * 		return n.AsJSDocImplementsTag().TagName
 * 	case KindJSDocDeprecatedTag:
 * 		return n.AsJSDocDeprecatedTag().TagName
 * 	case KindJSDocPublicTag:
 * 		return n.AsJSDocPublicTag().TagName
 * 	case KindJSDocPrivateTag:
 * 		return n.AsJSDocPrivateTag().TagName
 * 	case KindJSDocProtectedTag:
 * 		return n.AsJSDocProtectedTag().TagName
 * 	case KindJSDocReadonlyTag:
 * 		return n.AsJSDocReadonlyTag().TagName
 * 	case KindJSDocOverrideTag:
 * 		return n.AsJSDocOverrideTag().TagName
 * 	case KindJSDocCallbackTag:
 * 		return n.AsJSDocCallbackTag().TagName
 * 	case KindJSDocOverloadTag:
 * 		return n.AsJSDocOverloadTag().TagName
 * 	case KindJSDocParameterTag, KindJSDocPropertyTag:
 * 		return n.AsJSDocParameterOrPropertyTag().TagName
 * 	case KindJSDocReturnTag:
 * 		return n.AsJSDocReturnTag().TagName
 * 	case KindJSDocThisTag:
 * 		return n.AsJSDocThisTag().TagName
 * 	case KindJSDocTypeTag:
 * 		return n.AsJSDocTypeTag().TagName
 * 	case KindJSDocTemplateTag:
 * 		return n.AsJSDocTemplateTag().TagName
 * 	case KindJSDocTypedefTag:
 * 		return n.AsJSDocTypedefTag().TagName
 * 	case KindJSDocSeeTag:
 * 		return n.AsJSDocSeeTag().TagName
 * 	case KindJSDocSatisfiesTag:
 * 		return n.AsJSDocSatisfiesTag().TagName
 * 	case KindJSDocThrowsTag:
 * 		return n.AsJSDocThrowsTag().TagName
 * 	case KindJSDocImportTag:
 * 		return n.AsJSDocImportTag().TagName
 * 	}
 * 	panic("Unhandled case in Node.TagName: " + n.Kind.String())
 * }
 */
export declare function Node_TagName(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.PropertyName","kind":"method","status":"implemented","sigHash":"9d10c798e2310d13fd0364d2e0b775f1ba6388df2b1212cc1d66fb16eadd11eb","bodyHash":"b0848a03c49385f03db7ac8331ad7014de183ef42268d38d41b6fe340497764e"}
 *
 * Go source:
 * func (n *Node) PropertyName() *Node {
 * 	switch n.Kind {
 * 	case KindImportSpecifier:
 * 		return n.AsImportSpecifier().PropertyName
 * 	case KindExportSpecifier:
 * 		return n.AsExportSpecifier().PropertyName
 * 	case KindBindingElement:
 * 		return n.AsBindingElement().PropertyName
 * 	}
 * 	return nil
 * }
 */
export declare function Node_PropertyName(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.PropertyNameOrName","kind":"method","status":"implemented","sigHash":"00ddf835c852f3a88d45420e07f069de8ce8ba4d6fec313baba1d1066325c3f5","bodyHash":"b42acc1cd809e7cc2c61ce4ad8e37cdb17faac23eeaf3bcfd2ccfdad099efbe4"}
 *
 * Go source:
 * func (n *Node) PropertyNameOrName() *Node {
 * 	name := n.PropertyName()
 * 	if name == nil {
 * 		name = n.Name()
 * 	}
 * 	return name
 * }
 */
export declare function Node_PropertyNameOrName(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.IsTypeOnly","kind":"method","status":"implemented","sigHash":"f3e04789b31553bd06f6c343d1924597c398ae04c92a531dacb91e09b3080b9d","bodyHash":"200a434ffae30f9acd7edeb34fb4e5ef1f53281be0707c15b9ba0594f2c009ec"}
 *
 * Go source:
 * func (n *Node) IsTypeOnly() bool {
 * 	switch n.Kind {
 * 	case KindImportEqualsDeclaration:
 * 		return n.AsImportEqualsDeclaration().IsTypeOnly
 * 	case KindImportSpecifier:
 * 		return n.AsImportSpecifier().IsTypeOnly
 * 	case KindImportClause:
 * 		return n.AsImportClause().PhaseModifier == KindTypeKeyword
 * 	case KindExportDeclaration:
 * 		return n.AsExportDeclaration().IsTypeOnly
 * 	case KindExportSpecifier:
 * 		return n.AsExportSpecifier().IsTypeOnly
 * 	}
 * 	return false
 * }
 */
export declare function Node_IsTypeOnly(receiver: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.CommentList","kind":"method","status":"implemented","sigHash":"6c839d4167cfd1fcfbd013a627bf12f8c1be7f739ace9674c0bcb3d54f8cfd58","bodyHash":"b90e29ebe49ba862402c46fd816fa10096a647081c5694a7e7902c0cffca84af"}
 *
 * Go source:
 * func (n *Node) CommentList() *NodeList {
 * 	switch n.Kind {
 * 	case KindJSDoc:
 * 		return n.AsJSDoc().Comment
 * 	case KindJSDocUnknownTag:
 * 		return n.AsJSDocUnknownTag().Comment
 * 	case KindJSDocAugmentsTag:
 * 		return n.AsJSDocAugmentsTag().Comment
 * 	case KindJSDocImplementsTag:
 * 		return n.AsJSDocImplementsTag().Comment
 * 	case KindJSDocDeprecatedTag:
 * 		return n.AsJSDocDeprecatedTag().Comment
 * 	case KindJSDocPublicTag:
 * 		return n.AsJSDocPublicTag().Comment
 * 	case KindJSDocPrivateTag:
 * 		return n.AsJSDocPrivateTag().Comment
 * 	case KindJSDocProtectedTag:
 * 		return n.AsJSDocProtectedTag().Comment
 * 	case KindJSDocReadonlyTag:
 * 		return n.AsJSDocReadonlyTag().Comment
 * 	case KindJSDocOverrideTag:
 * 		return n.AsJSDocOverrideTag().Comment
 * 	case KindJSDocCallbackTag:
 * 		return n.AsJSDocCallbackTag().Comment
 * 	case KindJSDocOverloadTag:
 * 		return n.AsJSDocOverloadTag().Comment
 * 	case KindJSDocParameterTag, KindJSDocPropertyTag:
 * 		return n.AsJSDocParameterOrPropertyTag().Comment
 * 	case KindJSDocReturnTag:
 * 		return n.AsJSDocReturnTag().Comment
 * 	case KindJSDocThisTag:
 * 		return n.AsJSDocThisTag().Comment
 * 	case KindJSDocTypeTag:
 * 		return n.AsJSDocTypeTag().Comment
 * 	case KindJSDocTemplateTag:
 * 		return n.AsJSDocTemplateTag().Comment
 * 	case KindJSDocTypedefTag:
 * 		return n.AsJSDocTypedefTag().Comment
 * 	case KindJSDocSeeTag:
 * 		return n.AsJSDocSeeTag().Comment
 * 	case KindJSDocSatisfiesTag:
 * 		return n.AsJSDocSatisfiesTag().Comment
 * 	case KindJSDocThrowsTag:
 * 		return n.AsJSDocThrowsTag().Comment
 * 	case KindJSDocImportTag:
 * 		return n.AsJSDocImportTag().Comment
 * 	}
 * 	panic("Unhandled case in Node.CommentList: " + n.Kind.String())
 * }
 */
export declare function Node_CommentList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Comments","kind":"method","status":"implemented","sigHash":"2ea09c721f3101e1efc81e110b9c43dbf6c55f435d1bdad008e73115d803fdb4","bodyHash":"7d061eec2b0c133c87a3985174cbf3cfad8f0c217f4c65f177e9f5b75e549fe5"}
 *
 * Go source:
 * func (n *Node) Comments() []*Node {
 * 	list := n.CommentList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Comments(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Label","kind":"method","status":"implemented","sigHash":"c443b8e2c6c6ce8036f93d5c9588a02671b224ed188f46f95528baae5bf919f9","bodyHash":"109b88d8d28cac5b745ffcc05743ed584a70494e4cb573c0dc9ae46264b73227"}
 *
 * Go source:
 * func (n *Node) Label() *Node {
 * 	switch n.Kind {
 * 	case KindLabeledStatement:
 * 		return n.AsLabeledStatement().Label
 * 	case KindBreakStatement:
 * 		return n.AsBreakStatement().Label
 * 	case KindContinueStatement:
 * 		return n.AsContinueStatement().Label
 * 	}
 * 	panic("Unhandled case in Node.Label: " + n.Kind.String())
 * }
 */
export declare function Node_Label(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Attributes","kind":"method","status":"implemented","sigHash":"f7bb831a53c1c57cbe7fb35b10d77f27f175a06b3bccc97fd513e049b9b8d73a","bodyHash":"b3119ffd885d252868d252233d1bb30de9af73616e50395cc5c426edf5c9c993"}
 *
 * Go source:
 * func (n *Node) Attributes() *Node {
 * 	switch n.Kind {
 * 	case KindJsxOpeningElement:
 * 		return n.AsJsxOpeningElement().Attributes
 * 	case KindJsxSelfClosingElement:
 * 		return n.AsJsxSelfClosingElement().Attributes
 * 	}
 * 	panic("Unhandled case in Node.Attributes: " + n.Kind.String())
 * }
 */
export declare function Node_Attributes(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Children","kind":"method","status":"implemented","sigHash":"e032dd8275f90262bec0027ac0c13a92b9332da7210b21cfb2a54962f50d5e6d","bodyHash":"224c8359aa03e95ab01b69cf9e4e4dbd173ea2225955f60dbe611202edcc98aa"}
 *
 * Go source:
 * func (n *Node) Children() *NodeList {
 * 	switch n.Kind {
 * 	case KindJsxElement:
 * 		return n.AsJsxElement().Children
 * 	case KindJsxFragment:
 * 		return n.AsJsxFragment().Children
 * 	}
 * 	panic("Unhandled case in Node.Children: " + n.Kind.String())
 * }
 */
export declare function Node_Children(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ModuleSpecifier","kind":"method","status":"implemented","sigHash":"847b0ec0ec1a398ce04fa392fa08621d7172a0c401f8245a7cc3bf44afdb72a9","bodyHash":"99fb20a708bd50995bcf310b32ae17b5e50738cbd7ac5783ea61b354d11d2299"}
 *
 * Go source:
 * func (n *Node) ModuleSpecifier() *Expression {
 * 	switch n.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		return n.AsImportDeclaration().ModuleSpecifier
 * 	case KindExportDeclaration:
 * 		return n.AsExportDeclaration().ModuleSpecifier
 * 	case KindJSDocImportTag:
 * 		return n.AsJSDocImportTag().ModuleSpecifier
 * 	}
 * 	panic("Unhandled case in Node.ModuleSpecifier: " + n.Kind.String())
 * }
 */
export declare function Node_ModuleSpecifier(receiver: GoPtr<Node>): GoPtr<Expression_9ab73856>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ImportClause","kind":"method","status":"implemented","sigHash":"38ba01306083818baa900335af19e8f9109df3588735600d3cb812a6b931fa7d","bodyHash":"2ebd25b9691893f94c6751ae9d2f2319821a80b7cf3a34c596de9824909ceafe"}
 *
 * Go source:
 * func (n *Node) ImportClause() *Node {
 * 	switch n.Kind {
 * 	case KindImportDeclaration, KindJSImportDeclaration:
 * 		return n.AsImportDeclaration().ImportClause
 * 	case KindJSDocImportTag:
 * 		return n.AsJSDocImportTag().ImportClause
 * 	}
 * 	panic("Unhandled case in Node.ImportClause: " + n.Kind.String())
 * }
 */
export declare function Node_ImportClause(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Statement","kind":"method","status":"implemented","sigHash":"e57df22ecec78e292f93df3c95132ba0d137bff4a9e27026c2cd8af50f21e28e","bodyHash":"d36ac9cebfcb466bafbc2434dca821206837fa4d6c38ad2d926c5dc6ec1e3756"}
 *
 * Go source:
 * func (n *Node) Statement() *Statement {
 * 	switch n.Kind {
 * 	case KindDoStatement:
 * 		return n.AsDoStatement().Statement
 * 	case KindWhileStatement:
 * 		return n.AsWhileStatement().Statement
 * 	case KindForStatement:
 * 		return n.AsForStatement().Statement
 * 	case KindForInStatement, KindForOfStatement:
 * 		return n.AsForInOrOfStatement().Statement
 * 	case KindWithStatement:
 * 		return n.AsWithStatement().Statement
 * 	case KindLabeledStatement:
 * 		return n.AsLabeledStatement().Statement
 * 	}
 * 	panic("Unhandled case in Node.Statement: " + n.Kind.String())
 * }
 */
export declare function Node_Statement(receiver: GoPtr<Node>): GoPtr<Statement_98c7cd47>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.PropertyList","kind":"method","status":"implemented","sigHash":"bbe64a53d54ff22f39264e2e58132e9544afd5a680577f51bf05995542ae01cf","bodyHash":"741580be630539b512e7f0f57012e894212ee5e2bba06870cabfb4559a5cfd6d"}
 *
 * Go source:
 * func (n *Node) PropertyList() *NodeList {
 * 	switch n.Kind {
 * 	case KindObjectLiteralExpression:
 * 		return n.AsObjectLiteralExpression().Properties
 * 	case KindJsxAttributes:
 * 		return n.AsJsxAttributes().Properties
 * 	}
 * 	panic("Unhandled case in Node.PropertyList: " + n.Kind.String())
 * }
 */
export declare function Node_PropertyList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Properties","kind":"method","status":"implemented","sigHash":"3c3ff7bb53bcbf57e9e47453fc18a5334f725836546ecd89fde2855d83f2d881","bodyHash":"069ae4079449dfce6fdc26d8384a45025dd2ea4c2000aa9ca4bd847ad6890522"}
 *
 * Go source:
 * func (n *Node) Properties() []*Node {
 * 	list := n.PropertyList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Properties(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ElementList","kind":"method","status":"implemented","sigHash":"e986fecf3ab267ed5b96df61d2b6b2d5aa1f09d1f128153afeade0905bdbf88a","bodyHash":"f0976abdf53edaafdb21676b4049f8c98a41e845a4dc7a33c4e913c5f60fa40c"}
 *
 * Go source:
 * func (n *Node) ElementList() *NodeList {
 * 	switch n.Kind {
 * 	case KindNamedImports:
 * 		return n.AsNamedImports().Elements
 * 	case KindNamedExports:
 * 		return n.AsNamedExports().Elements
 * 	case KindObjectBindingPattern, KindArrayBindingPattern:
 * 		return n.AsBindingPattern().Elements
 * 	case KindArrayLiteralExpression:
 * 		return n.AsArrayLiteralExpression().Elements
 * 	case KindTupleType:
 * 		return n.AsTupleTypeNode().Elements
 * 	}
 * 	panic("Unhandled case in Node.ElementList: " + n.Kind.String())
 * }
 */
export declare function Node_ElementList(receiver: GoPtr<Node>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Elements","kind":"method","status":"implemented","sigHash":"b616476bc1eae9b64e028543c5f2a25a1e15f23c3819df87e111130156cfa003","bodyHash":"d53c75ce3a86b54cf67b392f906e0fabe8022b6ca24598b3b64713fe27241617"}
 *
 * Go source:
 * func (n *Node) Elements() []*Node {
 * 	list := n.ElementList()
 * 	if list != nil {
 * 		return list.Nodes
 * 	}
 * 	return nil
 * }
 */
export declare function Node_Elements(receiver: GoPtr<Node>): GoSlice<GoPtr<Node>> | undefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.PostfixToken","kind":"method","status":"implemented","sigHash":"8904f6d40b9cb9f638c8960b7074dc4615ff0d7d804d1f7fca557e75970e6aa6","bodyHash":"673dad292f914208552af426a361dc560f491b307d1e8670f8f8298fd502882e"}
 *
 * Go source:
 * func (n *Node) PostfixToken() *Node {
 * 	switch n.Kind {
 * 	case KindMethodDeclaration:
 * 		return n.AsMethodDeclaration().PostfixToken
 * 	case KindShorthandPropertyAssignment:
 * 		return n.AsShorthandPropertyAssignment().PostfixToken
 * 	case KindMethodSignature:
 * 		return n.AsMethodSignatureDeclaration().PostfixToken
 * 	case KindPropertySignature:
 * 		return n.AsPropertySignatureDeclaration().PostfixToken
 * 	case KindPropertyAssignment:
 * 		return n.AsPropertyAssignment().PostfixToken
 * 	case KindPropertyDeclaration:
 * 		return n.AsPropertyDeclaration().PostfixToken
 * 	case KindEnumMember:
 * 		return n.AsEnumMember().PostfixToken
 * 	case KindGetAccessor:
 * 		return n.AsGetAccessorDeclaration().PostfixToken
 * 	case KindSetAccessor:
 * 		return n.AsSetAccessorDeclaration().PostfixToken
 * 	}
 * 	return nil
 * }
 */
export declare function Node_PostfixToken(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.QuestionToken","kind":"method","status":"implemented","sigHash":"add8ef50e96b396a11b9db493c68e7aca0b0350801c284a34fe3cc7411a2a0c0","bodyHash":"ae6e52547634d46f46f2b73371bd2a57ea049bd8928b990aa94e1b80d0d1ba20"}
 *
 * Go source:
 * func (n *Node) QuestionToken() *TokenNode {
 * 	switch n.Kind {
 * 	case KindParameter:
 * 		return n.AsParameterDeclaration().QuestionToken
 * 	case KindConditionalExpression:
 * 		return n.AsConditionalExpression().QuestionToken
 * 	case KindMappedType:
 * 		return n.AsMappedTypeNode().QuestionToken
 * 	case KindNamedTupleMember:
 * 		return n.AsNamedTupleMember().QuestionToken
 * 	}
 * 	postfix := n.PostfixToken()
 * 	if postfix != nil && postfix.Kind == KindQuestionToken {
 * 		return postfix
 * 	}
 * 	return nil
 * }
 */
export declare function Node_QuestionToken(receiver: GoPtr<Node>): GoPtr<TokenNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.QuestionDotToken","kind":"method","status":"implemented","sigHash":"c0083bafc8199729f729eb686aa6b4c7569878d4671881ecd39f0d96aacce037","bodyHash":"d2c31e550523923e059e2bb1d6bb47ccfdbd7a13578e90375dffb8a5c38f140d"}
 *
 * Go source:
 * func (n *Node) QuestionDotToken() *Node {
 * 	switch n.Kind {
 * 	case KindElementAccessExpression:
 * 		return n.AsElementAccessExpression().QuestionDotToken
 * 	case KindPropertyAccessExpression:
 * 		return n.AsPropertyAccessExpression().QuestionDotToken
 * 	case KindCallExpression:
 * 		return n.AsCallExpression().QuestionDotToken
 * 	case KindTaggedTemplateExpression:
 * 		return n.AsTaggedTemplateExpression().QuestionDotToken
 * 	}
 * 	panic("Unhandled case in Node.QuestionDotToken: " + n.Kind.String())
 * }
 */
export declare function Node_QuestionDotToken(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TypeExpression","kind":"method","status":"implemented","sigHash":"bb7658e1d6e5f6aa338ec32c9e49eec023f48508794f163c1ef6158702d095f7","bodyHash":"71b45a89b3ab38d6736c6df140d449be54b3e7dd9fbd5932d74b65dfef7a4b92"}
 *
 * Go source:
 * func (n *Node) TypeExpression() *Node {
 * 	switch n.Kind {
 * 	case KindJSDocParameterTag, KindJSDocPropertyTag:
 * 		return n.AsJSDocParameterOrPropertyTag().TypeExpression
 * 	case KindJSDocReturnTag:
 * 		return n.AsJSDocReturnTag().TypeExpression
 * 	case KindJSDocTypeTag:
 * 		return n.AsJSDocTypeTag().TypeExpression
 * 	case KindJSDocTypedefTag:
 * 		return n.AsJSDocTypedefTag().TypeExpression
 * 	case KindJSDocCallbackTag:
 * 		return n.AsJSDocCallbackTag().TypeExpression
 * 	case KindJSDocSatisfiesTag:
 * 		return n.AsJSDocSatisfiesTag().TypeExpression
 * 	case KindJSDocThrowsTag:
 * 		return n.AsJSDocThrowsTag().TypeExpression
 * 	}
 * 	panic("Unhandled case in Node.TypeExpression: " + n.Kind.String())
 * }
 */
export declare function Node_TypeExpression(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ClassName","kind":"method","status":"implemented","sigHash":"42ae67a56328d501b91fe6e58b3962b306f096fd87962131b883706f56311c22","bodyHash":"300edf50d45543a21079a49107f2b9c61d183ffbbf787189d30cd761c12ec073"}
 *
 * Go source:
 * func (n *Node) ClassName() *Node {
 * 	switch n.Kind {
 * 	case KindJSDocAugmentsTag:
 * 		return n.AsJSDocAugmentsTag().ClassName
 * 	case KindJSDocImplementsTag:
 * 		return n.AsJSDocImplementsTag().ClassName
 * 	}
 * 	panic("Unhandled case in Node.ClassName: " + n.Kind.String())
 * }
 */
export declare function Node_ClassName(receiver: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Contains","kind":"method","status":"implemented","sigHash":"35d61fb7cf5a8e89e7c433da3d3961bb8aafb695be32170aca21ec6a41482ead","bodyHash":"5bbbbce3c245bd8c7ce019c651fd83f3e060c2993d57da9cae9f0829bc6686a1"}
 *
 * Go source:
 * func (n *Node) Contains(descendant *Node) bool {
 * 	for descendant != nil {
 * 		if descendant == n {
 * 			return true
 * 		}
 * 		parent := descendant.Parent
 * 		if parent == nil && !IsSourceFile(descendant) {
 * 			panic("descendant is not parented")
 * 		}
 * 		descendant = parent
 * 	}
 * 	return false
 * }
 */
export declare function Node_Contains(receiver: GoPtr<Node>, descendant: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.AsFlowSwitchClauseData","kind":"method","status":"implemented","sigHash":"119bed177d08d70df373c8859b32220579faa882651026276d341c6156dfc896","bodyHash":"285971301a7b23fb84b70cac8c242ea4665634831e1b8f3f132c66047277f8aa"}
 *
 * Go source:
 * func (n *Node) AsFlowSwitchClauseData() *FlowSwitchClauseData {
 * 	return n.data.(*FlowSwitchClauseData)
 * }
 */
export declare function Node_AsFlowSwitchClauseData(receiver: GoPtr<Node>): GoPtr<FlowSwitchClauseData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.AsFlowReduceLabelData","kind":"method","status":"implemented","sigHash":"037468d65e06901b0b7c1b782bd2a2da875927cfc0988e5daa9d3632610268bf","bodyHash":"164678c0f5bd3d53b8311d6d0925b752d7c900b865d9dc104d823c521972d351"}
 *
 * Go source:
 * func (n *Node) AsFlowReduceLabelData() *FlowReduceLabelData {
 * 	return n.data.(*FlowReduceLabelData)
 * }
 */
export declare function Node_AsFlowReduceLabelData(receiver: GoPtr<Node>): GoPtr<FlowReduceLabelData>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NamedMember","kind":"type","status":"implemented","sigHash":"e24e1dee7707e1f1320b5dcc6a6178733206112ef4fbd250c4b170af5c05c67d","bodyHash":"6c82401e57f641b5ab4b0474ef61a08cd7606ebf27cb1c4b505f58883161f557"}
 *
 * Go source:
 * NamedMember                 = Node
 */
export type NamedMember = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::AnyValidImportOrReExport","kind":"type","status":"implemented","sigHash":"1873e3dbd63889d7f9bf5579172e6545ad333dc5f2a6161ff2df408ba289f0c9","bodyHash":"503ddf72e017e94309265986928e1d4ffbc86ba3b41a2e39d5aff080cdc04123"}
 *
 * Go source:
 * AnyValidImportOrReExport    = Node
 */
export type AnyValidImportOrReExport = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::ValidImportTypeNode","kind":"type","status":"implemented","sigHash":"cef62c308942eee138cf95571c189dec5fd28588d723238e90d6ba4c5f391141","bodyHash":"0f4d29c6c04b7e883ef82ef8aaf290c658eda46d0b6e2a173dcdcd879bfc8980"}
 *
 * Go source:
 * ValidImportTypeNode         = Node
 */
export type ValidImportTypeNode = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::TypeOnlyImportDeclaration","kind":"type","status":"implemented","sigHash":"5b2415ba0b681ff826c6549ebd52e52663fcbacad5525fc3559e7bd739c6ceee","bodyHash":"6269543a21323f4a29ceba7da3f5d6b16c2ad3429bd0ec43731aaae79e39afdf"}
 *
 * Go source:
 * TypeOnlyImportDeclaration   = Node
 */
export type TypeOnlyImportDeclaration = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::StringLiteralLike","kind":"type","status":"implemented","sigHash":"06d241158a99b435e88984ebf91142ca3efad178c583c079107acb3553d2036b","bodyHash":"bc42c4db84976a5c76c75a207bcce4c017c3b8f8643ee6672fccfd24a7185c0a"}
 *
 * Go source:
 * StringLiteralLike           = Node
 */
export type StringLiteralLike = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::ObjectLiteralLike","kind":"type","status":"implemented","sigHash":"70563e300a2f6783bd3cff429e0ff1084acc63cbcb1e1727ba7d38b19d7cf98b","bodyHash":"f7913c11d905782cef77a66a7a57aaaf5c2edab558145f1bc3df6c2cd5af1a17"}
 *
 * Go source:
 * ObjectLiteralLike           = Node
 */
export type ObjectLiteralLike = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::AnyImportOrRequireStatement","kind":"type","status":"implemented","sigHash":"ede08ab972393168f59689077782bffa5b64d5e27c206e771b7e4fa15fa4a6d7","bodyHash":"1434676bfae3e530d5417603b016f2161bd7934afefda08b7d89a63b2f475c68"}
 *
 * Go source:
 * AnyImportOrRequireStatement = Node
 */
export type AnyImportOrRequireStatement = Node;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsWriteOnlyAccess","kind":"func","status":"implemented","sigHash":"d57baffc30fed3407bd99da97d4f43b57f8483b3bff70837c90630a43ea32332","bodyHash":"d84c58d7aa7f1af7af09de1e0997a2637ba788cb193a5dade0cb259c2db779b6"}
 *
 * Go source:
 * func IsWriteOnlyAccess(node *Node) bool {
 * 	return accessKind(node) == AccessKindWrite
 * }
 */
export declare function IsWriteOnlyAccess(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsWriteAccess","kind":"func","status":"implemented","sigHash":"e56383f933a603974abc8e6c0cea0f134a9b2b18c5323ee999e8cc0b730df5b1","bodyHash":"cc9fb353bba0ba8ea843e783f05e91d33679f451cda0611bca79a060f05ad483"}
 *
 * Go source:
 * func IsWriteAccess(node *Node) bool {
 * 	return accessKind(node) != AccessKindRead
 * }
 */
export declare function IsWriteAccess(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsWriteAccessForReference","kind":"func","status":"implemented","sigHash":"89d985bb07ea5462d9c03594878094a48c8cd43780df7125025b66a7346b503a","bodyHash":"19c2c2555ce26d0e8a9123ab24f01763d5a2e4b348e2f9a27e3a26755a705dc5"}
 *
 * Go source:
 * func IsWriteAccessForReference(node *Node) bool {
 * 	decl := GetDeclarationFromName(node)
 * 	return (decl != nil && declarationIsWriteAccess(decl)) || node.Kind == KindDefaultKeyword || IsWriteAccess(node)
 * }
 */
export declare function IsWriteAccessForReference(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::GetDeclarationFromName","kind":"func","status":"implemented","sigHash":"1accab3cf6f95159875c42f14a785efecf4c8e038a8b7110e5de54559dbeafac","bodyHash":"1816dad79e74806a6f8fe84445d039df9cbc98e253130d916ae43886365cf9fc"}
 *
 * Go source:
 * func GetDeclarationFromName(name *Node) *Declaration {
 * 	if name == nil || name.Parent == nil {
 * 		return nil
 * 	}
 * 	parent := name.Parent
 * 	switch name.Kind {
 * 	case KindStringLiteral, KindNoSubstitutionTemplateLiteral, KindNumericLiteral:
 * 		if IsComputedPropertyName(parent) {
 * 			return parent.Parent
 * 		}
 * 		fallthrough
 * 	case KindIdentifier:
 * 		if IsDeclaration(parent) {
 * 			if parent.Name() == name {
 * 				return parent
 * 			}
 * 			return nil
 * 		}
 * 		if IsQualifiedName(parent) {
 * 			tag := parent.Parent
 * 			if IsJSDocParameterTag(tag) && tag.Name() == parent {
 * 				return tag
 * 			}
 * 			return nil
 * 		}
 * 		binExp := parent.Parent
 * 		if IsBinaryExpression(binExp) && GetAssignmentDeclarationKind(binExp) != JSDeclarationKindNone {
 * 			// (binExp.left as BindableStaticNameExpression).symbol || binExp.symbol
 * 			leftHasSymbol := false
 * 			if binExp.AsBinaryExpression().Left != nil && binExp.AsBinaryExpression().Left.Symbol() != nil {
 * 				leftHasSymbol = true
 * 			}
 * 			if leftHasSymbol || binExp.Symbol() != nil {
 * 				if GetNameOfDeclaration(binExp.AsNode()) == name {
 * 					return binExp.AsNode()
 * 				}
 * 			}
 * 		}
 * 	case KindPrivateIdentifier:
 * 		if IsDeclaration(parent) && parent.Name() == name {
 * 			return parent
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function GetDeclarationFromName(name: GoPtr<Node>): GoPtr<Declaration>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::declarationIsWriteAccess","kind":"func","status":"implemented","sigHash":"48c27de57fb067bc0ed9d75ce6547ca8fef16bfaae0022d5fe3da9fd4766ba9a","bodyHash":"f99823bcc31174f8a3da78167fc73d194dc8cd51ba90d809e5478383f992514e"}
 *
 * Go source:
 * func declarationIsWriteAccess(decl *Node) bool {
 * 	if decl == nil {
 * 		return false
 * 	}
 * 	// Consider anything in an ambient declaration to be a write access since it may be coming from JS.
 * 	if decl.Flags&NodeFlagsAmbient != 0 {
 * 		return true
 * 	}
 *
 * 	switch decl.Kind {
 * 	case KindBinaryExpression,
 * 		KindBindingElement,
 * 		KindClassDeclaration,
 * 		KindClassExpression,
 * 		KindDefaultKeyword,
 * 		KindEnumDeclaration,
 * 		KindEnumMember,
 * 		KindExportSpecifier,
 * 		KindImportClause, // default import
 * 		KindImportEqualsDeclaration,
 * 		KindImportSpecifier,
 * 		KindInterfaceDeclaration,
 * 		KindJSDocCallbackTag,
 * 		KindJSDocTypedefTag,
 * 		KindJsxAttribute,
 * 		KindModuleDeclaration,
 * 		KindNamespaceExportDeclaration,
 * 		KindNamespaceImport,
 * 		KindNamespaceExport,
 * 		KindParameter,
 * 		KindShorthandPropertyAssignment,
 * 		KindTypeAliasDeclaration,
 * 		KindJSTypeAliasDeclaration,
 * 		KindTypeParameter:
 * 		return true
 *
 * 	case KindPropertyAssignment:
 * 		// In `({ x: y } = 0);`, `x` is not a write access.
 * 		return !IsArrayLiteralOrObjectLiteralDestructuringPattern(decl.Parent)
 *
 * 	case KindFunctionDeclaration, KindFunctionExpression, KindConstructor, KindMethodDeclaration, KindGetAccessor, KindSetAccessor:
 * 		// functions considered write if they provide a value (have a body)
 * 		switch decl.Kind {
 * 		case KindFunctionDeclaration:
 * 			return decl.AsFunctionDeclaration().Body != nil
 * 		case KindFunctionExpression:
 * 			return decl.AsFunctionExpression().Body != nil
 * 		case KindConstructor:
 * 			// constructor node stores body on the parent? treat same as others
 * 			return decl.AsConstructorDeclaration().Body != nil
 * 		case KindMethodDeclaration:
 * 			return decl.AsMethodDeclaration().Body != nil
 * 		case KindGetAccessor:
 * 			return decl.AsGetAccessorDeclaration().Body != nil
 * 		case KindSetAccessor:
 * 			return decl.AsSetAccessorDeclaration().Body != nil
 * 		}
 * 		return false
 *
 * 	case KindVariableDeclaration, KindPropertyDeclaration:
 * 		// variable/property write if initializer present or is in catch clause
 * 		var hasInit bool
 * 		switch decl.Kind {
 * 		case KindVariableDeclaration:
 * 			hasInit = decl.AsVariableDeclaration().Initializer != nil
 * 		case KindPropertyDeclaration:
 * 			hasInit = decl.AsPropertyDeclaration().Initializer != nil
 * 		}
 * 		return hasInit || IsCatchClause(decl.Parent)
 *
 * 	case KindMethodSignature, KindPropertySignature, KindJSDocPropertyTag, KindJSDocParameterTag:
 * 		return false
 *
 * 	default:
 * 		// preserve TS behavior: crash on unexpected kinds
 * 		panic("Unhandled case in declarationIsWriteAccess")
 * 	}
 * }
 */
export declare function declarationIsWriteAccess(decl: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsArrayLiteralOrObjectLiteralDestructuringPattern","kind":"func","status":"implemented","sigHash":"de41f011534199e5fecedede4217313f1ef14e3e749ab21fa9c845a2eb8efe50","bodyHash":"b9b198c40c2bb3f012caabb3f8ee633b98ca564566001e7bf722b05ef54cb338"}
 *
 * Go source:
 * func IsArrayLiteralOrObjectLiteralDestructuringPattern(node *Node) bool {
 * 	if !(IsArrayLiteralExpression(node) || IsObjectLiteralExpression(node)) {
 * 		return false
 * 	}
 * 	parent := node.Parent
 * 	// [a,b,c] from:
 * 	// [a, b, c] = someExpression;
 * 	if IsBinaryExpression(parent) && parent.AsBinaryExpression().Left == node && parent.AsBinaryExpression().OperatorToken.Kind == KindEqualsToken {
 * 		return true
 * 	}
 * 	// [a, b, c] from:
 * 	// for([a, b, c] of expression)
 * 	if IsForOfStatement(parent) && parent.Initializer() == node {
 * 		return true
 * 	}
 * 	// {x, a: {a, b, c} } = someExpression
 * 	if IsPropertyAssignment(parent) {
 * 		return IsArrayLiteralOrObjectLiteralDestructuringPattern(parent.Parent)
 * 	}
 * 	// [a, b, c] of
 * 	// [x, [a, b, c] ] = someExpression
 * 	return IsArrayLiteralOrObjectLiteralDestructuringPattern(parent)
 * }
 */
export declare function IsArrayLiteralOrObjectLiteralDestructuringPattern(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::accessKind","kind":"func","status":"implemented","sigHash":"863210d2dff016f721f03d9cd72e7435f1fe2d931c83aafcb0c6d26faff510d9","bodyHash":"aa5c6114266540577361e43acfbea4cd5c499e78d31a4f1d4987c1a4a4b78271"}
 *
 * Go source:
 * func accessKind(node *Node) AccessKind {
 * 	parent := node.Parent
 * 	if parent == nil {
 * 		return AccessKindRead
 * 	}
 * 	switch parent.Kind {
 * 	case KindParenthesizedExpression:
 * 		return accessKind(parent)
 * 	case KindPrefixUnaryExpression:
 * 		operator := parent.AsPrefixUnaryExpression().Operator
 * 		if operator == KindPlusPlusToken || operator == KindMinusMinusToken {
 * 			return AccessKindReadWrite
 * 		}
 * 		return AccessKindRead
 * 	case KindPostfixUnaryExpression:
 * 		operator := parent.AsPostfixUnaryExpression().Operator
 * 		if operator == KindPlusPlusToken || operator == KindMinusMinusToken {
 * 			return AccessKindReadWrite
 * 		}
 * 		return AccessKindRead
 * 	case KindBinaryExpression:
 * 		if parent.AsBinaryExpression().Left == node {
 * 			operator := parent.AsBinaryExpression().OperatorToken
 * 			if IsAssignmentOperator(operator.Kind) {
 * 				if operator.Kind == KindEqualsToken {
 * 					return AccessKindWrite
 * 				}
 * 				return AccessKindReadWrite
 * 			}
 * 		}
 * 		return AccessKindRead
 * 	case KindPropertyAccessExpression:
 * 		if parent.AsPropertyAccessExpression().Name() != node {
 * 			return AccessKindRead
 * 		}
 * 		return accessKind(parent)
 * 	case KindPropertyAssignment:
 * 		parentAccess := accessKind(parent.Parent)
 * 		// In `({ x: varname }) = { x: 1 }`, the left `x` is a read, the right `x` is a write.
 * 		if node == parent.AsPropertyAssignment().Name() {
 * 			return reverseAccessKind(parentAccess)
 * 		}
 * 		return parentAccess
 * 	case KindShorthandPropertyAssignment:
 * 		// Assume it's the local variable being accessed, since we don't check public properties for --noUnusedLocals.
 * 		if node == parent.AsShorthandPropertyAssignment().ObjectAssignmentInitializer {
 * 			return AccessKindRead
 * 		}
 * 		return accessKind(parent.Parent)
 * 	case KindArrayLiteralExpression:
 * 		return accessKind(parent)
 * 	case KindForInStatement, KindForOfStatement:
 * 		if node == parent.AsForInOrOfStatement().Initializer {
 * 			return AccessKindWrite
 * 		}
 * 		return AccessKindRead
 * 	default:
 * 		return AccessKindRead
 * 	}
 * }
 */
export declare function accessKind(node: GoPtr<Node>): AccessKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::reverseAccessKind","kind":"func","status":"implemented","sigHash":"4b9714bb565319daa3cc0495c261020ac3793c547493b7618ba87c9e2f1b63fd","bodyHash":"3be55e8a3a0b24f091a511857da165a9a191eaf954983d3fa9f77c90a16f9c7d"}
 *
 * Go source:
 * func reverseAccessKind(a AccessKind) AccessKind {
 * 	switch a {
 * 	case AccessKindRead:
 * 		return AccessKindWrite
 * 	case AccessKindWrite:
 * 		return AccessKindRead
 * 	case AccessKindReadWrite:
 * 		return AccessKindReadWrite
 * 	}
 * 	panic("Unhandled case in reverseAccessKind")
 * }
 */
export declare function reverseAccessKind(a: AccessKind): AccessKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::AccessKind","kind":"type","status":"implemented","sigHash":"c684aae4d01e4ed551c5c5f13e9fa2ed34251e8a8e654f261bc194c4852f6dad","bodyHash":"cea11ce6d8d92272d99b15aba159167b5f67b18c092f982c0d90c6ccb1df2a58"}
 *
 * Go source:
 * AccessKind int32
 */
export type AccessKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::constGroup::AccessKindRead+AccessKindWrite+AccessKindReadWrite","kind":"constGroup","status":"implemented","sigHash":"e3a6ad2cbf1ed6b0f9d5ead8ec03dbf798a3cf2cbd35fffb277b82ca04d5079a","bodyHash":"4f400ec76a911d3aabc92958dbf26c9d521ead320e8eeba10b1996c20c76f640"}
 *
 * Go source:
 * const (
 * 	AccessKindRead      AccessKind = iota // Only reads from a variable
 * 	AccessKindWrite                       // Only writes to a variable without ever reading it. E.g.: `x=1;`.
 * 	AccessKindReadWrite                   // Reads from and writes to a variable. E.g.: `f(x++);`, `x/=1`.
 * )
 */
export declare const AccessKindRead: AccessKind;
export declare const AccessKindWrite: AccessKind;
export declare const AccessKindReadWrite: AccessKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsDeclarationNode","kind":"func","status":"implemented","sigHash":"8c648e660252469cf80d372ca421bbdca6d4893c6806133b3914a3ac35b76b89","bodyHash":"f75ed3ee84a9df817353139e1c29b4a86bdef8241369a9f318c34b211f488520"}
 *
 * Go source:
 * func IsDeclarationNode(node *Node) bool {
 * 	return node.DeclarationData() != nil
 * }
 */
export declare function IsDeclarationNode(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsLocalsContainer","kind":"func","status":"implemented","sigHash":"10827d07286c61b7a32df28ba9ec42dbccd36a247bb149d63bad52d171332ade","bodyHash":"f34ff2661a2eedb13f702ec57d04235a14908137e96ecaec3a9f1d048b829ac5"}
 *
 * Go source:
 * func IsLocalsContainer(node *Node) bool {
 * 	return node.LocalsContainerData() != nil
 * }
 */
export declare function IsLocalsContainer(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.JSDoc","kind":"method","status":"implemented","sigHash":"1d3cb1d38faf7da5151a84121dbb168530bdb76d1d2635bff4233a5f578ff362","bodyHash":"ca10b85819bcd16331ec0db578a050d65273704844816a269c21500830ebea7c"}
 *
 * Go source:
 * func (node *Node) JSDoc(file *SourceFile) []*Node {
 * 	if node.Flags&NodeFlagsHasJSDoc == 0 {
 * 		return nil
 * 	}
 * 	if file == nil {
 * 		file = GetSourceFileOfNode(node)
 * 		if file == nil {
 * 			return nil
 * 		}
 * 	}
 * 	if file.hasLazyJSDoc {
 * 		return file.resolveJSDoc(node)
 * 	}
 * 	return file.jsdocCache[node]
 * }
 */
export declare function Node_JSDoc(receiver: GoPtr<Node>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.EagerJSDoc","kind":"method","status":"implemented","sigHash":"e1b1dc027f606be82d9a51f3ca645f4d04947c0767ea65a7f6cbf47bf6a8b3a2","bodyHash":"76d96b9c8c86f92cf8d4793d5808deb5c9682c7601a303ad3ddb6ed382d4b813"}
 *
 * Go source:
 * func (node *Node) EagerJSDoc(file *SourceFile) []*Node {
 * 	if node.Flags&NodeFlagsHasJSDoc == 0 {
 * 		return nil
 * 	}
 * 	if file == nil {
 * 		file = GetSourceFileOfNode(node)
 * 		if file == nil {
 * 			return nil
 * 		}
 * 	}
 * 	if file.hasLazyJSDoc {
 * 		file.jsdocMu.RLock()
 * 		jsdocs := file.jsdocCache[node]
 * 		file.jsdocMu.RUnlock()
 * 		return jsdocs
 * 	}
 * 	return file.jsdocCache[node]
 * }
 */
export declare function Node_EagerJSDoc(receiver: GoPtr<Node>, file: GoPtr<SourceFile>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TypeSyntaxBase.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"0a155b6c10c56850bc5c9dee88d60443a23e5bf307e4667470f6ea4dbe8c0623","bodyHash":"c5e668160e6fab60d4ee6aeb7e89f0b677862802fc38edf3fb94209dd89124c8"}
 *
 * Go source:
 * func (node *TypeSyntaxBase) computeSubtreeFacts() SubtreeFacts   { return SubtreeContainsTypeScript }
 */
export declare function TypeSyntaxBase_computeSubtreeFacts(receiver: GoPtr<TypeSyntaxBase>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TypeSyntaxBase.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"951e71aaa46d124ce9a37e93643f574fde7752a7bdf829a11cde55f1f8adb47f","bodyHash":"1b0fc97b7c29447ccf78c3066b29624f7a012b2f915b30da5d0fe5c3451e4598"}
 *
 * Go source:
 * func (node *TypeSyntaxBase) propagateSubtreeFacts() SubtreeFacts { return SubtreeContainsTypeScript }
 */
export declare function TypeSyntaxBase_propagateSubtreeFacts(receiver: GoPtr<TypeSyntaxBase>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Token.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"63dc263f4e13845bbee64c9678e5c8471d49cfc0768d2461821b394d0a96785d","bodyHash":"1c60a087c132b7b7568b9c127f10d40e308f9690c8a2c06f994c0f58d46453ec"}
 *
 * Go source:
 * func (node *Token) computeSubtreeFacts() SubtreeFacts {
 * 	switch node.Kind {
 * 	case KindUsingKeyword:
 * 		return SubtreeContainsUsing
 * 	case KindPublicKeyword,
 * 		KindPrivateKeyword,
 * 		KindProtectedKeyword,
 * 		KindReadonlyKeyword,
 * 		KindAbstractKeyword,
 * 		KindDeclareKeyword,
 * 		KindConstKeyword,
 * 		KindAnyKeyword,
 * 		KindNumberKeyword,
 * 		KindBigIntKeyword,
 * 		KindNeverKeyword,
 * 		KindObjectKeyword,
 * 		KindInKeyword,
 * 		KindOutKeyword,
 * 		KindOverrideKeyword,
 * 		KindStringKeyword,
 * 		KindBooleanKeyword,
 * 		KindSymbolKeyword,
 * 		KindVoidKeyword,
 * 		KindUnknownKeyword,
 * 		KindUndefinedKeyword,
 * 		KindExportKeyword:
 * 		return SubtreeContainsTypeScript
 * 	case KindAccessorKeyword:
 * 		return SubtreeContainsClassFields
 * 	case KindAsyncKeyword:
 * 		return SubtreeContainsAnyAwait
 * 	case KindSuperKeyword:
 * 		return SubtreeContainsLexicalSuper
 * 	case KindThisKeyword:
 * 		return SubtreeContainsLexicalThis
 * 	case KindAsteriskAsteriskToken, KindAsteriskAsteriskEqualsToken:
 * 		return SubtreeContainsExponentiationOperator
 * 	case KindQuestionQuestionToken:
 * 		return SubtreeContainsNullishCoalescing
 * 	case KindQuestionDotToken:
 * 		return SubtreeContainsOptionalChaining
 * 	case KindQuestionQuestionEqualsToken, KindBarBarEqualsToken, KindAmpersandAmpersandEqualsToken:
 * 		return SubtreeContainsLogicalAssignments
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function Token_computeSubtreeFacts(receiver: GoPtr<Token>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PrivateIdentifier.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"113fa669799693d01b21b5195a25f7388c32f82d7d9c33d9ebc7a55811dc5c15","bodyHash":"505e211e5d132d52411654d76c6cb240314c61246443e4992e4469266f805daf"}
 *
 * Go source:
 * func (node *PrivateIdentifier) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeContainsClassFields
 * }
 */
export declare function PrivateIdentifier_computeSubtreeFacts(receiver: GoPtr<PrivateIdentifier>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NewModifier","kind":"method","status":"implemented","sigHash":"d62f0b230a9c040f1324d26a6d85ec018ec8b15394d66b31ac97c8447dba7b7c","bodyHash":"bf44c15a5e564de2f1c36d66622f2accdc1cd29387e29c7244a6a894e8004d8c"}
 *
 * Go source:
 * func (f *NodeFactory) NewModifier(kind Kind) *Node {
 * 	return f.NewToken(kind)
 * }
 */
export declare function NodeFactory_NewModifier(receiver: GoPtr<NodeFactory>, kind: Kind): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Decorator.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"80aa0e3300dc3e8409355e4652d0468cb5d7a4277092e9fbc55ce195a4a3c5ca","bodyHash":"4bdae84c562449732253ea5346716a65708c7ba90eaafd9dc1b8b5828d929da1"}
 *
 * Go source:
 * func (node *Decorator) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) |
 * 		SubtreeContainsTypeScript |
 * 		SubtreeContainsDecorators
 * }
 */
export declare function Decorator_computeSubtreeFacts(receiver: GoPtr<Decorator>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ForInOrOfStatement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"17c634a447354dea46c41ecdfb926bc3cfc090e5b1e8b87c4c88adb2a8428792","bodyHash":"131bfa7d3f92ce7aa6e84b094861ce098a7d928a9bab590b809572982c84741f"}
 *
 * Go source:
 * func (node *ForInOrOfStatement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Initializer) |
 * 		propagateSubtreeFacts(node.Expression) |
 * 		propagateSubtreeFacts(node.Statement) |
 * 		core.IfElse(node.AwaitModifier != nil, SubtreeContainsForAwaitOrAsyncGenerator, SubtreeFactsNone)
 * }
 */
export declare function ForInOrOfStatement_computeSubtreeFacts(receiver: GoPtr<ForInOrOfStatement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ReturnStatement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"73728f6de77b39ab57d6d86eb959642df307903b1f45462bc74e3fa6ada1002b","bodyHash":"ba84919bd9bb81da6ad599dedef71df9e7593586d5abe63f57b15b1b485f4ec8"}
 *
 * Go source:
 * func (node *ReturnStatement) computeSubtreeFacts() SubtreeFacts {
 * 	// return in an ES2018 async generator must be awaited
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsForAwaitOrAsyncGenerator
 * }
 */
export declare function ReturnStatement_computeSubtreeFacts(receiver: GoPtr<ReturnStatement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CatchClause.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"8481a7deee27410a3f80144c1c4f5ffac42c6b2fa4e8814316dcf4814b180945","bodyHash":"32ad1f516b07e1fc4b657f6f10cdc12cb2355bf22de996bae5f1a260707adf2b"}
 *
 * Go source:
 * func (node *CatchClause) computeSubtreeFacts() SubtreeFacts {
 * 	res := propagateSubtreeFacts(node.VariableDeclaration) |
 * 		propagateSubtreeFacts(node.Block)
 * 	if node.VariableDeclaration == nil {
 * 		res |= SubtreeContainsMissingCatchClauseVariable
 * 	}
 * 	return res
 * }
 */
export declare function CatchClause_computeSubtreeFacts(receiver: GoPtr<CatchClause>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CatchClause.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"67af478b126eec14469534526214f97535f1f0cc905cc27ee04752391c537184","bodyHash":"03499d53243457fd2c78b7b0ab706bb62e7c1b803c628be88db58cfc3eab5dbf"}
 *
 * Go source:
 * func (node *CatchClause) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsCatchClause
 * }
 */
export declare function CatchClause_propagateSubtreeFacts(receiver: GoPtr<CatchClause>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::VariableStatement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"d9ef7215adec6dcaac30e6c90567b20c64b83b60407924fd5e21992633426eec","bodyHash":"0a62bbca679a7ecd109907ddf6a3d42d907b373076849acc9c53960d0dc6058a"}
 *
 * Go source:
 * func (node *VariableStatement) computeSubtreeFacts() SubtreeFacts {
 * 	if node.modifiers != nil && node.modifiers.ModifierFlags&ModifierFlagsAmbient != 0 {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.DeclarationList)
 * 	}
 * }
 */
export declare function VariableStatement_computeSubtreeFacts(receiver: GoPtr<VariableStatement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::VariableDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"a590a3ef3209817fe68396523dc5ecee2d8f6d66af24694b4bc0f0ee9838a230","bodyHash":"8a8a70c6b68c4dbfef82d8baa66470b7299eba8c4a58edfdbee4e1e5674efc07"}
 *
 * Go source:
 * func (node *VariableDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.ExclamationToken) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 		propagateSubtreeFacts(node.Initializer)
 * }
 */
export declare function VariableDeclaration_computeSubtreeFacts(receiver: GoPtr<VariableDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::VariableDeclarationList.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"084ba366a13832b4d5eb8bc184141bae20ac740f70de8f5d11b1b96436317ba7","bodyHash":"e8eb09af30691fda9baccdf6111e3c6b8ad0ebe04950ab779375798e3d784d36"}
 *
 * Go source:
 * func (node *VariableDeclarationList) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateNodeListSubtreeFacts(node.Declarations, propagateSubtreeFacts) |
 * 		core.IfElse(node.Flags&NodeFlagsUsing != 0, SubtreeContainsUsing, SubtreeFactsNone)
 * }
 */
export declare function VariableDeclarationList_computeSubtreeFacts(receiver: GoPtr<VariableDeclarationList>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::VariableDeclarationList.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"fbd76450d773caf9795d67624214a9ce9531fe1b1735f7af66098d9876717370","bodyHash":"20f03cf5be817d872f522d9f58c66362580d685e8a1f488a3863e97626b7ea58"}
 *
 * Go source:
 * func (node *VariableDeclarationList) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsVariableDeclarationList
 * }
 */
export declare function VariableDeclarationList_propagateSubtreeFacts(receiver: GoPtr<VariableDeclarationList>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BindingPattern.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"38d67e4775dd9a1728cfeacae040f42819e7f5f6f8f84a499f38f4b80845ecba","bodyHash":"9d94f77c5f71462d48dd7708122427450002dc07d7a4482e0c644c8ba2048070"}
 *
 * Go source:
 * func (node *BindingPattern) computeSubtreeFacts() SubtreeFacts {
 * 	switch node.Kind {
 * 	case KindObjectBindingPattern:
 * 		return propagateNodeListSubtreeFacts(node.Elements, propagateObjectBindingElementSubtreeFacts)
 * 	case KindArrayBindingPattern:
 * 		return propagateNodeListSubtreeFacts(node.Elements, propagateBindingElementSubtreeFacts)
 * 	default:
 * 		return SubtreeFactsNone
 * 	}
 * }
 */
export declare function BindingPattern_computeSubtreeFacts(receiver: GoPtr<BindingPattern>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BindingPattern.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"05249009a89973895efbf7c0d0a5549c760e7e083965b725ea587332097280b3","bodyHash":"a2013d6d09c42e9b7c3bff6f8026496e3d46787f26366c77e59aca3769cae511"}
 *
 * Go source:
 * func (node *BindingPattern) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsBindingPattern
 * }
 */
export declare function BindingPattern_propagateSubtreeFacts(receiver: GoPtr<BindingPattern>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ParameterDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"2e33ffdc1ef782e908496238c5f7b25e8426a98f84542978af2c7c5748c8f9d7","bodyHash":"504eee77fe9b4a1876387f0188bd320916f8d830281f56f90235cbd823b26ced"}
 *
 * Go source:
 * func (node *ParameterDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.name != nil && IsThisIdentifier(node.name) {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.QuestionToken) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 			propagateSubtreeFacts(node.Initializer)
 * 	}
 * }
 */
export declare function ParameterDeclaration_computeSubtreeFacts(receiver: GoPtr<ParameterDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ParameterDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"d5158308f9fcf6c3afaf5f88f9e560edbdb82dc807bfd6b8515d02223515c29f","bodyHash":"22cc800fd18551ec8bfa163082f146f1618fd002a97201cb54374cdc500d31b2"}
 *
 * Go source:
 * func (node *ParameterDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsParameter
 * }
 */
export declare function ParameterDeclaration_propagateSubtreeFacts(receiver: GoPtr<ParameterDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BindingElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"c907425bb7402d0e8ca10174d63d801f93610a3b91c48988de780a0c491cc650","bodyHash":"2bede2962e46f4c822556067bc1307e1048574a4d4defe37aea51d4436965474"}
 *
 * Go source:
 * func (node *BindingElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.PropertyName) |
 * 		propagateSubtreeFacts(node.name) |
 * 		propagateSubtreeFacts(node.Initializer) |
 * 		core.IfElse(node.DotDotDotToken != nil, SubtreeContainsRestOrSpread, SubtreeFactsNone)
 * }
 */
export declare function BindingElement_computeSubtreeFacts(receiver: GoPtr<BindingElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"6fcc8cc535fbd9e630616b74a064f639c1ed74315c58ac3b775d502b458afdde","bodyHash":"08c9a8f339ea0cb3e1976559bf44b5a08bbcb9800711afaa8a2ed5d344cf37a8"}
 *
 * Go source:
 * func (node *FunctionDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.Body == nil || node.ModifierFlags()&ModifierFlagsAmbient != 0 {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		isAsync := node.ModifierFlags()&ModifierFlagsAsync != 0
 * 		isGenerator := node.AsteriskToken != nil
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.AsteriskToken) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 			propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 			propagateSubtreeFacts(node.Body) |
 * 			core.IfElse(isAsync && isGenerator, SubtreeContainsForAwaitOrAsyncGenerator, SubtreeFactsNone) |
 * 			core.IfElse(isAsync && !isGenerator, SubtreeContainsAnyAwait, SubtreeFactsNone)
 * 	}
 * }
 */
export declare function FunctionDeclaration_computeSubtreeFacts(receiver: GoPtr<FunctionDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"4380c737648fa6c3ec8576aea4bf62308670a8391bbd627e81be60a471ff8840","bodyHash":"38ad45d32ca1ea843e5749b1e1f66195bf40e2c4e2652c95d5d6e33726034b38"}
 *
 * Go source:
 * func (node *FunctionDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsFunction
 * }
 */
export declare function FunctionDeclaration_propagateSubtreeFacts(receiver: GoPtr<FunctionDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"85eefae30ce964e5943433d0036b248ac5a3589b2dc87b694bb4c48abb845760","bodyHash":"b6e2264eb2366e2e7b72596022fccab24d82f2c1d6a26593cc175e2f1d1e6b7d"}
 *
 * Go source:
 * func (node *ClassDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsClass
 * }
 */
export declare function ClassDeclaration_propagateSubtreeFacts(receiver: GoPtr<ClassDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"90ae1e4584c267048fccda287aa86568c304f5cbe0d631da13800fd613c880bd","bodyHash":"1f4a1618c4dafa3c277f0312e5339f7349330455f6789dc7e1d1644f52ae455b"}
 *
 * Go source:
 * func (node *ClassExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsClass
 * }
 */
export declare function ClassExpression_propagateSubtreeFacts(receiver: GoPtr<ClassExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::HeritageClause.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"891fd4123f534195f5a76b531c419fd9b2fd85fada600c2661ff2a509d7e5ef6","bodyHash":"656ea754ad33269d1c9b6647e3c5ea99d22791bb66b344c9bf67056dc70a89cf"}
 *
 * Go source:
 * func (node *HeritageClause) computeSubtreeFacts() SubtreeFacts {
 * 	switch node.Token {
 * 	case KindExtendsKeyword:
 * 		return propagateNodeListSubtreeFacts(node.Types, propagateSubtreeFacts)
 * 	case KindImplementsKeyword:
 * 		return SubtreeContainsTypeScript
 * 	default:
 * 		return SubtreeFactsNone
 * 	}
 * }
 */
export declare function HeritageClause_computeSubtreeFacts(receiver: GoPtr<HeritageClause>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsTypeOrJSTypeAliasDeclaration","kind":"func","status":"implemented","sigHash":"cdc0381c834e14e84fdc41668935417112a6b562f44dd4b4f34ed56824329af0","bodyHash":"780b4ff7bb4c0f25ccc5fc757c141d9d1043300eda1a23f4d2c65a360d79468f"}
 *
 * Go source:
 * func IsTypeOrJSTypeAliasDeclaration(node *Node) bool {
 * 	return node.Kind == KindTypeAliasDeclaration || node.Kind == KindJSTypeAliasDeclaration
 * }
 */
export declare function IsTypeOrJSTypeAliasDeclaration(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::EnumMember.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"ca487a59ca331c9cf8280501c0ea184c1bccbb35ba302f25bb3f6dbbc7982b88","bodyHash":"be54f57cba2eb4eb6bb0a9a85e36e737208e541fea0131408d64817200522e4f"}
 *
 * Go source:
 * func (node *EnumMember) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) |
 * 		propagateSubtreeFacts(node.Initializer) |
 * 		SubtreeContainsTypeScript
 * }
 */
export declare function EnumMember_computeSubtreeFacts(receiver: GoPtr<EnumMember>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::EnumDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"8fab9c407e8ecf7d8ae1680b0e011e09bd0c21a22587e1c72dfa0603e89301ba","bodyHash":"f3cf6507a501d423226febacf252bfafa1ada7e55fe39a4ba0ad8d26d5dfff31"}
 *
 * Go source:
 * func (node *EnumDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.modifiers != nil && node.modifiers.ModifierFlags&ModifierFlagsAmbient != 0 {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateNodeListSubtreeFacts(node.Members, propagateSubtreeFacts) |
 * 			SubtreeContainsTypeScript
 * 	}
 * }
 */
export declare function EnumDeclaration_computeSubtreeFacts(receiver: GoPtr<EnumDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ModuleDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"beffcfe564d2ae514458a46d53afb5f5b52621375166c98e94e0ffab9253f102","bodyHash":"062fba552c88062abb463d76a1296e21b0d2255acef7bc6de17609f63903fc40"}
 *
 * Go source:
 * func (node *ModuleDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.ModifierFlags()&ModifierFlagsAmbient != 0 {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateSubtreeFacts(node.Body) |
 * 			SubtreeContainsTypeScript
 * 	}
 * }
 */
export declare function ModuleDeclaration_computeSubtreeFacts(receiver: GoPtr<ModuleDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ModuleDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"61da7370679ee5f15dea93f5f42c7e120f6a730786ee1a180350f903ef224dfc","bodyHash":"93d83881b17c7af007dd387b16fb68a7f41a401b467ff8aba571750e89bdccb3"}
 *
 * Go source:
 * func (node *ModuleDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsModule
 * }
 */
export declare function ModuleDeclaration_propagateSubtreeFacts(receiver: GoPtr<ModuleDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ImportEqualsDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"b61b9b71560c23eb899c9cdfb0ff187140291830c327a316299e7ebdde9e58a7","bodyHash":"79a6b8ae80e39968dee173964294b33cba0436c57970965a9b6f1809fa558f5b"}
 *
 * Go source:
 * func (node *ImportEqualsDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.IsTypeOnly || !IsExternalModuleReference(node.ModuleReference) {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateSubtreeFacts(node.ModuleReference)
 * 	}
 * }
 */
export declare function ImportEqualsDeclaration_computeSubtreeFacts(receiver: GoPtr<ImportEqualsDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsImportDeclarationOrJSImportDeclaration","kind":"func","status":"implemented","sigHash":"561df0ffe38b60838ea208112499cf02b7fd395f8b64f4aacb4c10035469bf2f","bodyHash":"9ca480bd22cb4b46df133a637cbac859e525234480b6cc8af00a413a1d36c5d0"}
 *
 * Go source:
 * func IsImportDeclarationOrJSImportDeclaration(node *Node) bool {
 * 	return node.Kind == KindImportDeclaration || node.Kind == KindJSImportDeclaration
 * }
 */
export declare function IsImportDeclarationOrJSImportDeclaration(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ImportSpecifier.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"3093e7355f3d5f7f48add19adfa71e8656c6a9a7cbba992111d5baaa61f100bc","bodyHash":"18e4434d2dcc4eb3071d7b346e0db340bcb1667d1f2662a1442278c5923136e3"}
 *
 * Go source:
 * func (node *ImportSpecifier) computeSubtreeFacts() SubtreeFacts {
 * 	if node.IsTypeOnly {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateSubtreeFacts(node.PropertyName) |
 * 			propagateSubtreeFacts(node.name)
 * 	}
 * }
 */
export declare function ImportSpecifier_computeSubtreeFacts(receiver: GoPtr<ImportSpecifier>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ImportClause.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"2c8511653b40ccbd2dde19da523df88c22e6242baf0326336806e79326fb9e9b","bodyHash":"9ee3d062985e694ccad8ab804e53fb56ede0664b89fbbc81bd1bccb37a0ad444"}
 *
 * Go source:
 * func (node *ImportClause) computeSubtreeFacts() SubtreeFacts {
 * 	if node.PhaseModifier == KindTypeKeyword {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateSubtreeFacts(node.name) |
 * 			propagateSubtreeFacts(node.NamedBindings)
 * 	}
 * }
 */
export declare function ImportClause_computeSubtreeFacts(receiver: GoPtr<ImportClause_58d51725>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ExportAssignment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"e69dc85d0ae3b56c48974682ca467a64f76135b51fe35130b11db4ee0c6e1954","bodyHash":"efdada7523f7a48051911e1ec4468511a83b213d80c4928b14aee835b6cf4391"}
 *
 * Go source:
 * func (node *ExportAssignment) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateModifierListSubtreeFacts(node.modifiers) | propagateSubtreeFacts(node.Type) | propagateSubtreeFacts(node.Expression) | core.IfElse(node.IsExportEquals, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export declare function ExportAssignment_computeSubtreeFacts(receiver: GoPtr<ExportAssignment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::IsAnyExportAssignment","kind":"func","status":"implemented","sigHash":"07dcaf9fd13ad3949db1d4d5829224d39e7550681caf87c017ef9818a36da19f","bodyHash":"c275b691611d9342b9fd2d75521d7209507e867a582acbb109de1ad362eb94cd"}
 *
 * Go source:
 * func IsAnyExportAssignment(node *Node) bool {
 * 	return node.Kind == KindExportAssignment
 * }
 */
export declare function IsAnyExportAssignment(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ExportDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"3cfb3720b2a07d7eb88fc0c898ff2085ef1e21ad8c4f723518f84b6c26f5f935","bodyHash":"a502820b3966660117f161d4278558aa61dda8cdfa0ec328af82cc9c3ae2802d"}
 *
 * Go source:
 * func (node *ExportDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateSubtreeFacts(node.ExportClause) |
 * 		propagateSubtreeFacts(node.ModuleSpecifier) |
 * 		propagateSubtreeFacts(node.Attributes) |
 * 		core.IfElse(node.IsTypeOnly, SubtreeContainsTypeScript, SubtreeFactsNone)
 * }
 */
export declare function ExportDeclaration_computeSubtreeFacts(receiver: GoPtr<ExportDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ExportSpecifier.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"acf23d17754c209af9e51f2f4624e9eecb00a94c4795772169a182d5407c1222","bodyHash":"2d2487dfdf5b2334177a5331bc6e8104dba56dd760aa7bbc1bc28c73ef9f4940"}
 *
 * Go source:
 * func (node *ExportSpecifier) computeSubtreeFacts() SubtreeFacts {
 * 	if node.IsTypeOnly {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateSubtreeFacts(node.PropertyName) |
 * 			propagateSubtreeFacts(node.name)
 * 	}
 * }
 */
export declare function ExportSpecifier_computeSubtreeFacts(receiver: GoPtr<ExportSpecifier>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ConstructorDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"faf750dea5f221670bd33a86445a89c3ffc9287a0fd62b082392233783488291","bodyHash":"52d37d40ad53878870e1cc85d8cd469990407ccd9eaac969712fb56e723e6766"}
 *
 * Go source:
 * func (node *ConstructorDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.Body == nil {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 			propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 			propagateSubtreeFacts(node.Body)
 * 	}
 * }
 */
export declare function ConstructorDeclaration_computeSubtreeFacts(receiver: GoPtr<ConstructorDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ConstructorDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"0eaccb55feb8622b25ab622c0f96091839dbe7970336e2359044ce61b2599686","bodyHash":"d832268d5bd5c672e0cbde37b0fce67d2d89b61cff36556ec8e32b51781d1794"}
 *
 * Go source:
 * func (node *ConstructorDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsConstructor
 * }
 */
export declare function ConstructorDeclaration_propagateSubtreeFacts(receiver: GoPtr<ConstructorDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AccessorDeclarationBase.IsAccessorDeclaration","kind":"method","status":"implemented","sigHash":"d1a3bedb33255dd16c8cb6e872b05d2bf891466b3e5bf881d2bdd26609c1cbfc","bodyHash":"16265746c4f47e17662df9aaed91913a42c0b12b942c9e295cd342cc2f0d546a"}
 *
 * Go source:
 * func (node *AccessorDeclarationBase) IsAccessorDeclaration() {}
 */
export declare function AccessorDeclarationBase_IsAccessorDeclaration(receiver: GoPtr<AccessorDeclarationBase>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AccessorDeclarationBase.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"ec9f2b765bec45b93a5e616d8e16bce00f1d1575d968aac03e9b06b13b81e668","bodyHash":"a3d608b0192c35269cd5d51d86a2b17f284d359a7eb4f21543ceae41e29a2e21"}
 *
 * Go source:
 * func (node *AccessorDeclarationBase) computeSubtreeFacts() SubtreeFacts {
 * 	if node.Body == nil {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 			propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 			propagateSubtreeFacts(node.Body)
 * 	}
 * }
 */
export declare function AccessorDeclarationBase_computeSubtreeFacts(receiver: GoPtr<AccessorDeclarationBase>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AccessorDeclarationBase.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"26da712bb97858e999ccbef9cb62ccc926dc6192a684b1ef02488e10b823d01b","bodyHash":"2f9a3ddbb66c176fa783ffee78870811e91bbe490c29865963dc04b7f4a1331a"}
 *
 * Go source:
 * func (node *AccessorDeclarationBase) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsAccessor |
 * 		propagateSubtreeFacts(node.name)
 * }
 */
export declare function AccessorDeclarationBase_propagateSubtreeFacts(receiver: GoPtr<AccessorDeclarationBase>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MethodDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"907a8612c11072bb5282fb73dfbd34e1ae03ac08eaa5c83721097202ff5423f5","bodyHash":"0483ccb253479fc6c3eb7df34545084bd2217c8cba1e879f614ef1c37bbc01cd"}
 *
 * Go source:
 * func (node *MethodDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	if node.Body == nil {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		isAsync := node.modifiers != nil && node.modifiers.ModifierFlags&ModifierFlagsAsync != 0
 * 		isGenerator := node.AsteriskToken != nil
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.AsteriskToken) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.PostfixToken) |
 * 			propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 			propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 			propagateSubtreeFacts(node.Body) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 			propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 			core.IfElse(isAsync && isGenerator, SubtreeContainsForAwaitOrAsyncGenerator, SubtreeFactsNone) |
 * 			core.IfElse(isAsync && !isGenerator, SubtreeContainsAnyAwait, SubtreeFactsNone)
 * 	}
 * }
 */
export declare function MethodDeclaration_computeSubtreeFacts(receiver: GoPtr<MethodDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MethodDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"142494937807fd9ae4b96267d6d0d3e898e79583eaad9fc0d5c9745959afc69e","bodyHash":"5b30c3e5d9037c2cf89deddc78a17244d11ee4ad231caf80d3a6e169ec323d25"}
 *
 * Go source:
 * func (node *MethodDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsMethod |
 * 		propagateSubtreeFacts(node.name)
 * }
 */
export declare function MethodDeclaration_propagateSubtreeFacts(receiver: GoPtr<MethodDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PropertyDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"45c241882e0f942350181095f9b604208892c4dc2119b83a38cccde320a0de1a","bodyHash":"bba80967f1c6abb1a258dc7b1b5c5a6cc115ddc16bdcc633fc31b196dd624435"}
 *
 * Go source:
 * func (node *PropertyDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateSubtreeFacts(node.name) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.PostfixToken) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 		propagateSubtreeFacts(node.Initializer) |
 * 		SubtreeContainsClassFields
 * }
 */
export declare function PropertyDeclaration_computeSubtreeFacts(receiver: GoPtr<PropertyDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PropertyDeclaration.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"7a72f10093d4d3c0f03e0aefef925068947437361e4826c9b94ec2ddd2204634","bodyHash":"87c94cbe2f5f593b011701efad8da390514c5b9bf525e33ea6471442f4384c5a"}
 *
 * Go source:
 * func (node *PropertyDeclaration) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsProperty |
 * 		propagateSubtreeFacts(node.name)
 * }
 */
export declare function PropertyDeclaration_propagateSubtreeFacts(receiver: GoPtr<PropertyDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassStaticBlockDeclaration.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"8cd2b84b2f4c89a3e095815c856b9873a13139b77af3929de94d5c701ce86243","bodyHash":"9fb7e27333992842a69b6bff62e5ff34ddc3aea44bdc341bf1b128a1743cda77"}
 *
 * Go source:
 * func (node *ClassStaticBlockDeclaration) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateSubtreeFacts(node.Body) |
 * 		SubtreeContainsClassFields
 * }
 */
export declare function ClassStaticBlockDeclaration_computeSubtreeFacts(receiver: GoPtr<ClassStaticBlockDeclaration>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::KeywordExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"9005bb0c00db66fa8c12a4eec3b35e80d014fcfe000dd2e45fdebe4dbeb4c2c0","bodyHash":"537d6d01d432932c8dae6c962462dabf0f2bf3738ad13b90d56ab11dadb3824f"}
 *
 * Go source:
 * func (node *KeywordExpression) computeSubtreeFacts() SubtreeFacts {
 * 	switch node.Kind {
 * 	case KindThisKeyword:
 * 		return SubtreeContainsLexicalThis
 * 	case KindSuperKeyword:
 * 		return SubtreeContainsLexicalSuper
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function KeywordExpression_computeSubtreeFacts(receiver: GoPtr<KeywordExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BigIntLiteral.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"a78ff3a3ad723e2d747b60a76238fdc67db36f0689a2004c202cc5afc7980cf0","bodyHash":"fc1312241431649ecc09a61c8448fb18ab1889340376a67f3e0488d865a06657"}
 *
 * Go source:
 * func (node *BigIntLiteral) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeFactsNone // `bigint` is not downleveled in any way
 * }
 */
export declare function BigIntLiteral_computeSubtreeFacts(receiver: GoPtr<BigIntLiteral>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Identifier.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"562477747d797928017e54ecfaa0acf6fe2f4c4235b6adb40c68e7a879af136b","bodyHash":"c980f3f2024df9eba0a68677c4fb6734079c5d535174ea4909e092791a54baaf"}
 *
 * Go source:
 * func (node *Identifier) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeContainsIdentifier
 * }
 */
export declare function Identifier_computeSubtreeFacts(receiver: GoPtr<Identifier>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NoSubstitutionTemplateLiteral.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"1162368deb5333eab7b6fae42937a4e05c600f9623ffdca6203748d2fa4a6593","bodyHash":"cbd29c297964d2f6fad93687437bca3447a812a2b625d1ba1dd79cbe706fab52"}
 *
 * Go source:
 * func (node *NoSubstitutionTemplateLiteral) computeSubtreeFacts() SubtreeFacts {
 * 	if node.TemplateFlags&TokenFlagsContainsInvalidEscape != 0 {
 * 		return SubtreeContainsInvalidTemplateEscape
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function NoSubstitutionTemplateLiteral_computeSubtreeFacts(receiver: GoPtr<NoSubstitutionTemplateLiteral>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BinaryExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"0e0de814ebf95d2453b1142327f30f15a456327d0c01e5fd5aa2c85b68240923","bodyHash":"d77df7b9ee1fa290a48bf43a538f5f90bd9a06464cc547c9561e2881e37d5a47"}
 *
 * Go source:
 * func (node *BinaryExpression) computeSubtreeFacts() SubtreeFacts {
 * 	facts := propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateSubtreeFacts(node.Left) |
 * 		propagateSubtreeFacts(node.Type) |
 * 		propagateSubtreeFacts(node.OperatorToken) |
 * 		propagateSubtreeFacts(node.Right) |
 * 		core.IfElse(node.OperatorToken.Kind == KindInKeyword && IsPrivateIdentifier(node.Left), SubtreeContainsClassFields|SubtreeContainsPrivateIdentifierInExpression, SubtreeFactsNone)
 * 	if node.OperatorToken.Kind == KindEqualsToken {
 * 		if (IsObjectLiteralExpression(node.Left) || IsArrayLiteralExpression(node.Left)) && ContainsObjectRestOrSpread(node.Left) {
 * 			facts |= SubtreeContainsObjectRestOrSpread
 * 		}
 * 	}
 * 	return facts
 * }
 */
export declare function BinaryExpression_computeSubtreeFacts(receiver: GoPtr<BinaryExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BinaryExpression.setModifiers","kind":"method","status":"implemented","sigHash":"45631c0604651e778156b70a86f5f1c8708999b090ba325485138b2a833e9d00","bodyHash":"5466ef6583a1e481085cce0a139452e6ed80d97134bb957baf9e1a1e3ab32426"}
 *
 * Go source:
 * func (node *BinaryExpression) setModifiers(modifiers *ModifierList) { node.modifiers = modifiers }
 */
export declare function BinaryExpression_setModifiers(receiver: GoPtr<BinaryExpression>, modifiers: GoPtr<ModifierList>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::YieldExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"d2097e7faa0dca4d6908597b349318b0c034f2668e65e31e1cb9d4a06d3399d6","bodyHash":"54ffb49713ac3081f2a1f8f4a5a17c5f661ef740019690d95aeaddcc68592ba5"}
 *
 * Go source:
 * func (node *YieldExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsForAwaitOrAsyncGenerator
 * }
 */
export declare function YieldExpression_computeSubtreeFacts(receiver: GoPtr<YieldExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ArrowFunction.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"b3d6c10d7e0bd342fb87647cf0ad9c3331527c0b2495c0c2add1e20cbd1c14ff","bodyHash":"36da4e24e0b8f76e989d799444e56c464d6f46531b86f6d1ff876d21f86b78db"}
 *
 * Go source:
 * func (node *ArrowFunction) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 		propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 		propagateSubtreeFacts(node.Body) |
 * 		core.IfElse(node.ModifierFlags()&ModifierFlagsAsync != 0, SubtreeContainsAnyAwait, SubtreeFactsNone)
 * }
 */
export declare function ArrowFunction_computeSubtreeFacts(receiver: GoPtr<ArrowFunction>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ArrowFunction.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"7c5bf0c19e9333f507945a09c818907cb99ccfa83decabfa6386f21794f74ae2","bodyHash":"0905d07006ec0e1124b57f54b7a212e2ba7e2dac41f1d93f0b3d01798adbc9e1"}
 *
 * Go source:
 * func (node *ArrowFunction) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsArrowFunction
 * }
 */
export declare function ArrowFunction_propagateSubtreeFacts(receiver: GoPtr<ArrowFunction>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"f80309d27bc5aeacc3d87e8db9d788197c4d800b1450400a24ac717c8e857611","bodyHash":"81bb9bb95fc1669c3a6e545bb85fae63703e8208fd8c5ff5234533b041000d77"}
 *
 * Go source:
 * func (node *FunctionExpression) computeSubtreeFacts() SubtreeFacts {
 * 	isAsync := node.modifiers != nil && node.modifiers.ModifierFlags&ModifierFlagsAsync != 0
 * 	isGenerator := node.AsteriskToken != nil
 * 	return propagateModifierListSubtreeFacts(node.modifiers) |
 * 		propagateSubtreeFacts(node.AsteriskToken) |
 * 		propagateSubtreeFacts(node.name) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 		propagateNodeListSubtreeFacts(node.Parameters, propagateSubtreeFacts) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.Type) |
 * 		propagateEraseableSyntaxSubtreeFacts(node.FullSignature) |
 * 		propagateSubtreeFacts(node.Body) |
 * 		core.IfElse(isAsync && isGenerator, SubtreeContainsForAwaitOrAsyncGenerator, SubtreeFactsNone) |
 * 		core.IfElse(isAsync && !isGenerator, SubtreeContainsAnyAwait, SubtreeFactsNone)
 * }
 */
export declare function FunctionExpression_computeSubtreeFacts(receiver: GoPtr<FunctionExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"5c3977ed9571553699a6f1bf68993e8f625d99b00359806fe8c775ab2c912558","bodyHash":"c3308a8d97bf1c0c036a7fe3ec1e142fa862054ff501ea182290ae9f8265d679"}
 *
 * Go source:
 * func (node *FunctionExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsFunction
 * }
 */
export declare function FunctionExpression_propagateSubtreeFacts(receiver: GoPtr<FunctionExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AsExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"9fe493323b584d7769db45f11b0a783b40da78e0877df5bd2661a841aa2c7ba6","bodyHash":"c0691ca00bc48207b7e52cf1a1178a6f07ab9f9c2ce91065ad7f54b3ed74c7d4"}
 *
 * Go source:
 * func (node *AsExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsTypeScript
 * }
 */
export declare function AsExpression_computeSubtreeFacts(receiver: GoPtr<AsExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AsExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"8e92bd227ebd23112da3caf86f0a05e8c60513c67b446b3c4b8541db246d7afd","bodyHash":"7c1fc3dc4d8f855f44100c27102ea44254a0ac6220a52d6ae203a6a4c0b29c84"}
 *
 * Go source:
 * func (node *AsExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsOuterExpression
 * }
 */
export declare function AsExpression_propagateSubtreeFacts(receiver: GoPtr<AsExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SatisfiesExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"078a428caa90311b16b3562af7ea59d3c5a3cb8e4efc069af825368cc993408a","bodyHash":"1690f9cb74a2a9bb79ba213b9cebf2e539e38a20e0ff0b63f8f4bd4ec2d1f6f8"}
 *
 * Go source:
 * func (node *SatisfiesExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsTypeScript
 * }
 */
export declare function SatisfiesExpression_computeSubtreeFacts(receiver: GoPtr<SatisfiesExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SatisfiesExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"6607fa64c8de5311f14811b3d655c7036971d56be6598e9d561db3317e6a5790","bodyHash":"0671992ae9fef0b8b196e78af2cde5496820fc01952971ab4d9117dfc5b7e7e9"}
 *
 * Go source:
 * func (node *SatisfiesExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsOuterExpression
 * }
 */
export declare function SatisfiesExpression_propagateSubtreeFacts(receiver: GoPtr<SatisfiesExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PropertyAccessExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"ca47498bf087d4bf141136eb5311b566e5246db4175ff753f15e410449d4139a","bodyHash":"04f7777c0b9fc66c49175c71a5aa9ab8ea18b8f450c31457b726c0836a3a193a"}
 *
 * Go source:
 * func (node *PropertyAccessExpression) computeSubtreeFacts() SubtreeFacts {
 * 	privateName := SubtreeFactsNone
 * 	if !IsIdentifier(node.name) {
 * 		privateName = SubtreeContainsPrivateIdentifierInExpression
 * 	}
 * 	return propagateSubtreeFacts(node.Expression) |
 * 		propagateSubtreeFacts(node.QuestionDotToken) |
 * 		propagateSubtreeFacts(node.name) | privateName
 * }
 */
export declare function PropertyAccessExpression_computeSubtreeFacts(receiver: GoPtr<PropertyAccessExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PropertyAccessExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"0dd4b982ab1c90f421e6f24d0680f5ae36555b1a37cf2ad73b2345f81b9b8e51","bodyHash":"633bbe9983abd75a66ab6a26b0b727e324e2f5fdf9de1daf4e2dda34c82d04c7"}
 *
 * Go source:
 * func (node *PropertyAccessExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsPropertyAccess
 * }
 */
export declare function PropertyAccessExpression_propagateSubtreeFacts(receiver: GoPtr<PropertyAccessExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ElementAccessExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"e3bf1704bbb54f4a30dca700ae9aa0eb93d439b3c5f5c4c963ea77c6ca324d2f","bodyHash":"4fa965aee04ed65f0d8a7c373d3ebbf3c43ad44c77426444c1beca3c2f8a76cd"}
 *
 * Go source:
 * func (node *ElementAccessExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsElementAccess
 * }
 */
export declare function ElementAccessExpression_propagateSubtreeFacts(receiver: GoPtr<ElementAccessExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CallExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"c8fee996dd681bc138b06e820d59c59e6aa82f62886044158e9a4142a6572d65","bodyHash":"7d880a508efc515a8407c171543fea291e43712eaf81f2d78a1fb8395e854812"}
 *
 * Go source:
 * func (node *CallExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) |
 * 		propagateSubtreeFacts(node.QuestionDotToken) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments) |
 * 		propagateNodeListSubtreeFacts(node.Arguments, propagateSubtreeFacts) |
 * 		core.IfElse(node.Expression.Kind == KindImportKeyword, SubtreeContainsDynamicImport, SubtreeFactsNone)
 * }
 */
export declare function CallExpression_computeSubtreeFacts(receiver: GoPtr<CallExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CallExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"71a4ede2b15e57cfd2e677d970a8117738d3e1dfc6e552cdc8a1b965db13be8d","bodyHash":"e51292dea55da12a30192969dfb5b5b81a4888b6b4711050bf6339f3554c9392"}
 *
 * Go source:
 * func (node *CallExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsCall
 * }
 */
export declare function CallExpression_propagateSubtreeFacts(receiver: GoPtr<CallExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NewExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"27d79ca2daf6bcc85e7c1e0602625763937b9b8a2414733de81b0341418fa220","bodyHash":"a970c02d45e36af13ee259d7088d6d4f5efb6ceb0dd004b3bf7ec9ef7d119c28"}
 *
 * Go source:
 * func (node *NewExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments) |
 * 		propagateNodeListSubtreeFacts(node.Arguments, propagateSubtreeFacts)
 * }
 */
export declare function NewExpression_computeSubtreeFacts(receiver: GoPtr<NewExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NewExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"e3b6c957e3bbb70c0bc0e5cd79a42d0eceeb561089edeca91de5abb1a1da0c0d","bodyHash":"cdae1fef3d05d538d7a294985a0035b11f68631d66f92fe755b0c27e5ae78114"}
 *
 * Go source:
 * func (node *NewExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsNew
 * }
 */
export declare function NewExpression_propagateSubtreeFacts(receiver: GoPtr<NewExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::MetaProperty.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"82d7e8d44699deae2dbf0aec7bd37df933e1f9cc48b4b48f4486bc49dd3e82f7","bodyHash":"a6ab2c1bbbed3191d16ba9af599c4e227ccc40bb40fd30e56274908b347e75c3"}
 *
 * Go source:
 * func (node *MetaProperty) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) &^ SubtreeContainsIdentifier
 * }
 */
export declare function MetaProperty_computeSubtreeFacts(receiver: GoPtr<MetaProperty>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NonNullExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"e86bbc16c3fe7e1c0593e5c02078dd44fa042a25b4efb0023d9253cbe55aa8cd","bodyHash":"647fe62ea26d8d82e5b65ea8571e0268b01953bab315d153d7cfaa5034650cfe"}
 *
 * Go source:
 * func (node *NonNullExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsTypeScript
 * }
 */
export declare function NonNullExpression_computeSubtreeFacts(receiver: GoPtr<NonNullExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SpreadElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"cd5768cb47d391e8c924f63a4efe050f8a92aa1eee5de85e8347967f6d3557dd","bodyHash":"7cdeb2e95f5c3b32cfdae7220e105ecba56675cabe896be8c0d8bc481a8f9a02"}
 *
 * Go source:
 * func (node *SpreadElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsRestOrSpread
 * }
 */
export declare function SpreadElement_computeSubtreeFacts(receiver: GoPtr<SpreadElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TaggedTemplateExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"418812817c7215cfb7f539c93dd0d2710cc56d0904859a01efb6bec29a9eb7b6","bodyHash":"3fba5a1ff793a9fbbadcb460fb1ce26b6579c1bfde682c2722971d3d42de53c8"}
 *
 * Go source:
 * func (node *TaggedTemplateExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Tag) |
 * 		propagateSubtreeFacts(node.QuestionDotToken) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments) |
 * 		propagateSubtreeFacts(node.Template)
 * }
 */
export declare function TaggedTemplateExpression_computeSubtreeFacts(receiver: GoPtr<TaggedTemplateExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ArrayLiteralExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"41a897a87133c912aa9439318cf56cdf1cc481ef61205af4222f66dfd1d02bbb","bodyHash":"132941e62a473666d10f0ddbf02418e51caf9d62024470306dbbc556f7adb71e"}
 *
 * Go source:
 * func (node *ArrayLiteralExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsArrayLiteral
 * }
 */
export declare function ArrayLiteralExpression_propagateSubtreeFacts(receiver: GoPtr<ArrayLiteralExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ObjectLiteralExpression.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"f4663847857e92bcab654a659d6c3475854d1cec4b95dcd84e0daa4bc8b12ed3","bodyHash":"a83474975bd7c66a3aebe08b53359e249f029702c97d6f46b77037e4fc1c9c8b"}
 *
 * Go source:
 * func (node *ObjectLiteralExpression) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsObjectLiteral
 * }
 */
export declare function ObjectLiteralExpression_propagateSubtreeFacts(receiver: GoPtr<ObjectLiteralExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SpreadAssignment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"6143e8c5142c88fcdf8ec9f6a4fd7234a55d7cb9ac5f2792d1abc122f04fb567","bodyHash":"668e74fb028865fab2d16feae406ddd1c6d3912032ebd41063fefb2df777b730"}
 *
 * Go source:
 * func (node *SpreadAssignment) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsESObjectRestOrSpread | SubtreeContainsObjectRestOrSpread
 * }
 */
export declare function SpreadAssignment_computeSubtreeFacts(receiver: GoPtr<SpreadAssignment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PropertyAssignment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"6366226d0d3172acdc339656a5806281f4c856f852d7cdf9948357d3d34de276","bodyHash":"b801aa9c9fe24a9ce76698e7b37468e030ea561006c75007009fa9c77718946e"}
 *
 * Go source:
 * func (node *PropertyAssignment) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) |
 * 		propagateSubtreeFacts(node.Type) |
 * 		propagateSubtreeFacts(node.Initializer)
 * }
 */
export declare function PropertyAssignment_computeSubtreeFacts(receiver: GoPtr<PropertyAssignment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ShorthandPropertyAssignment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"646f57ecb31afdff0d4d314cf512ef681ea70e476412430a26e3ec0eb2374d61","bodyHash":"3c50f832a6fe927d2122e5a0d40fcc35aecdcf7d6e82084126199b49649d2073"}
 *
 * Go source:
 * func (node *ShorthandPropertyAssignment) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) |
 * 		propagateSubtreeFacts(node.Type) |
 * 		propagateSubtreeFacts(node.ObjectAssignmentInitializer) |
 * 		SubtreeContainsTypeScript
 * }
 */
export declare function ShorthandPropertyAssignment_computeSubtreeFacts(receiver: GoPtr<ShorthandPropertyAssignment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::AwaitExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"84624141a6c1409cbe862a78fcdedf7dc8b1275eaab5c03f9e5b662dc1846428","bodyHash":"a33d2c2b2c449bf2b0a7cbf2f2ae9c5700c83654600aa2233cac4b2147759292"}
 *
 * Go source:
 * func (node *AwaitExpression) computeSubtreeFacts() SubtreeFacts {
 * 	// await in an ES2018 async generator must use `yield __await(expr)`
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsAwait | SubtreeContainsAnyAwait | SubtreeContainsForAwaitOrAsyncGenerator
 * }
 */
export declare function AwaitExpression_computeSubtreeFacts(receiver: GoPtr<AwaitExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TypeAssertion.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"5566c3bd779a177007f18de2caf68ad1f3decf0acbf9853b4d997efd6f5b7828","bodyHash":"4f4b03fb0d3eaf9e35ccaefd7e19142207c01f851f5de0851d4cb89dad91af88"}
 *
 * Go source:
 * func (node *TypeAssertion) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsTypeScript
 * }
 */
export declare function TypeAssertion_computeSubtreeFacts(receiver: GoPtr<TypeAssertion>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TypeAssertion.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"5babb23316f239a6eacb30f6afface2aa6fe0268e9d4fa53d0adc1f48ede6450","bodyHash":"847a197dea42ccec63dc4ddf577f2e6492aa4797e8a9cfffa25776cde5023554"}
 *
 * Go source:
 * func (node *TypeAssertion) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.SubtreeFacts() & ^SubtreeExclusionsOuterExpression
 * }
 */
export declare function TypeAssertion_propagateSubtreeFacts(receiver: GoPtr<TypeAssertion>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ExpressionWithTypeArguments.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"693e3c874376f96bdd9bfc61c31486ca1cc083206cfbce56eea64df23741d9f0","bodyHash":"c92d9142c41d48aee80d6c3c909d40b8fb6d4d3eeae8de3d42c1718ff2acf275"}
 *
 * Go source:
 * func (node *ExpressionWithTypeArguments) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments)
 * }
 */
export declare function ExpressionWithTypeArguments_computeSubtreeFacts(receiver: GoPtr<ExpressionWithTypeArguments>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ImportAttributesNode.GetResolutionModeOverride","kind":"method","status":"implemented","sigHash":"7e0f6ecc67d1522690bd28a0da88f2b92d3183687c4a45101e5d2628ba15f61c","bodyHash":"0727c4069bd79bf0cee7ff51bf99d0d2623828021423713179818da025ac956d"}
 *
 * Go source:
 * func (node *ImportAttributesNode) GetResolutionModeOverride( /* !!! grammarErrorOnNode?: (node: Node, diagnostic: DiagnosticMessage) => void* / ) (core.ResolutionMode, bool) {
 * 	if node == nil {
 * 		return core.ResolutionModeNone, false
 * 	}
 *
 * 	attributes := node.AsImportAttributes().Attributes
 *
 * 	if len(attributes.Nodes) != 1 {
 * 		// !!!
 * 		// grammarErrorOnNode?.(
 * 		//     node,
 * 		//     node.token === SyntaxKind.WithKeyword
 * 		//         ? Diagnostics.Type_import_attributes_should_have_exactly_one_key_resolution_mode_with_value_import_or_require
 * 		//         : Diagnostics.Type_import_assertions_should_have_exactly_one_key_resolution_mode_with_value_import_or_require,
 * 		// );
 * 		return core.ResolutionModeNone, false
 * 	}
 *
 * 	elem := attributes.Nodes[0].AsImportAttribute()
 * 	if !IsStringLiteralLike(elem.Name()) {
 * 		return core.ResolutionModeNone, false
 * 	}
 * 	if elem.Name().Text() != "resolution-mode" {
 * 		// !!!
 * 		// grammarErrorOnNode?.(
 * 		//     elem.name,
 * 		//     node.token === SyntaxKind.WithKeyword
 * 		//         ? Diagnostics.resolution_mode_is_the_only_valid_key_for_type_import_attributes
 * 		//         : Diagnostics.resolution_mode_is_the_only_valid_key_for_type_import_assertions,
 * 		// );
 * 		return core.ResolutionModeNone, false
 * 	}
 * 	if !IsStringLiteralLike(elem.Value) {
 * 		return core.ResolutionModeNone, false
 * 	}
 * 	if elem.Value.Text() != "import" && elem.Value.Text() != "require" {
 * 		// !!!
 * 		// grammarErrorOnNode?.(elem.value, Diagnostics.resolution_mode_should_be_either_require_or_import);
 * 		return core.ResolutionModeNone, false
 * 	}
 * 	if elem.Value.Text() == "import" {
 * 		return core.ResolutionModeESM, true
 * 	} else {
 * 		return core.ModuleKindCommonJS, true
 * 	}
 * }
 */
export declare function ImportAttributesNode_GetResolutionModeOverride(receiver: GoPtr<ImportAttributesNode>): [ResolutionMode, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionOrConstructorTypeNodeBase.DeclarationData","kind":"method","status":"implemented","sigHash":"54b1ed8c1a40f0dc87c85ae6468c3ddf8e2aae440b30ee62712b7fc76202afb3","bodyHash":"d0bdfb7692610014561ca8841817299587cd905d960b90586d239ef15a4951f3"}
 *
 * Go source:
 * func (node *FunctionOrConstructorTypeNodeBase) DeclarationData() *DeclarationBase {
 * 	return node.FunctionLikeBase.DeclarationData()
 * }
 */
export declare function FunctionOrConstructorTypeNodeBase_DeclarationData(receiver: GoPtr<FunctionOrConstructorTypeNodeBase>): GoPtr<DeclarationBase>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TemplateHead.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"095e135f58d8936aa68e27e81a7095f9a39b600e51e38fb64abacaaca4d8275d","bodyHash":"b07cd7378638404732744bad3f80a4801e0680531f5e1ab5e986cf0e1c416526"}
 *
 * Go source:
 * func (node *TemplateHead) computeSubtreeFacts() SubtreeFacts {
 * 	if node.TemplateFlags&TokenFlagsContainsInvalidEscape != 0 {
 * 		return SubtreeContainsInvalidTemplateEscape
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function TemplateHead_computeSubtreeFacts(receiver: GoPtr<TemplateHead>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TemplateMiddle.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"f22840854ec1446d33ebad461518ef58584a0f93ce0646e41422e14eee3ba250","bodyHash":"5f491b42092980b6ec8902beddcf0ee03812f0424699201465362783dd833400"}
 *
 * Go source:
 * func (node *TemplateMiddle) computeSubtreeFacts() SubtreeFacts {
 * 	if node.TemplateFlags&TokenFlagsContainsInvalidEscape != 0 {
 * 		return SubtreeContainsInvalidTemplateEscape
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function TemplateMiddle_computeSubtreeFacts(receiver: GoPtr<TemplateMiddle>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TemplateTail.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"51ffbaffdbdfc46467ed17c778a9aa9b0fdbabfaefc5e320a50fd34c9e5bea61","bodyHash":"64a744ba7b8fbdf0ebdfaad86661da7f62bf4e43004cbce6c4bd4bcb0db1a8f9"}
 *
 * Go source:
 * func (node *TemplateTail) computeSubtreeFacts() SubtreeFacts {
 * 	if node.TemplateFlags&TokenFlagsContainsInvalidEscape != 0 {
 * 		return SubtreeContainsInvalidTemplateEscape
 * 	}
 * 	return SubtreeFactsNone
 * }
 */
export declare function TemplateTail_computeSubtreeFacts(receiver: GoPtr<TemplateTail>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"5fe69ec92cae33b2f6a5bc117a0e9762da340ea884c9565c46d61e230aa2d89b","bodyHash":"dcce323c6ea4e6f950e28448416e6ac67b9eb2d1aa3dec64c527d0bb3538cc9b"}
 *
 * Go source:
 * func (node *JsxElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.OpeningElement) |
 * 		propagateNodeListSubtreeFacts(node.Children, propagateSubtreeFacts) |
 * 		propagateSubtreeFacts(node.ClosingElement) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxElement_computeSubtreeFacts(receiver: GoPtr<JsxElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxAttributes.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"427148050d872cf4f37c9a74caf88b1ea819e5348e5feea52f023d6cf82e2e7b","bodyHash":"ed228fe790b8cb5cb7d13f675f56eaf6b704a7b692d135b348d79ca0d4af9a64"}
 *
 * Go source:
 * func (node *JsxAttributes) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateNodeListSubtreeFacts(node.Properties, propagateSubtreeFacts) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxAttributes_computeSubtreeFacts(receiver: GoPtr<JsxAttributes>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxNamespacedName.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"0c002dc9afc77170b6d7fa2512f91880fd3f59c3f0f3a93d58c68796b38f332c","bodyHash":"877bc3f2de139f17f59ec7ead74812be9c15ff589ab2157fb7593653ab23ba01"}
 *
 * Go source:
 * func (node *JsxNamespacedName) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Namespace) |
 * 		propagateSubtreeFacts(node.name) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxNamespacedName_computeSubtreeFacts(receiver: GoPtr<JsxNamespacedName>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxOpeningElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"9270b478a6281c5ad6f76c1ecdac565832a24dda0e3a137eaec22a5052d8c1ad","bodyHash":"35f59a8953ac68d476ae916799f313aef0f0ea7044335d1e88e56e0f7570243b"}
 *
 * Go source:
 * func (node *JsxOpeningElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.TagName) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments) |
 * 		propagateSubtreeFacts(node.Attributes) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxOpeningElement_computeSubtreeFacts(receiver: GoPtr<JsxOpeningElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxSelfClosingElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"19c2441316c41a80cff84dc287ea23d0af4ced102523950c218bc295515772d1","bodyHash":"6c3db3185bc89a7f5e86b40f7f8e953ffc830c25ef6d32f02a1d65355c4f2d16"}
 *
 * Go source:
 * func (node *JsxSelfClosingElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.TagName) |
 * 		propagateEraseableSyntaxListSubtreeFacts(node.TypeArguments) |
 * 		propagateSubtreeFacts(node.Attributes) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxSelfClosingElement_computeSubtreeFacts(receiver: GoPtr<JsxSelfClosingElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxFragment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"40c663e60ed0faa852abb59e08166b9275ecfcff4e2295022fe218b4f8be1b32","bodyHash":"240307305b8fddfdff51e71c542007616eb2f5830a11c703d0f4e96dc6fc8802"}
 *
 * Go source:
 * func (node *JsxFragment) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateNodeListSubtreeFacts(node.Children, propagateSubtreeFacts) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxFragment_computeSubtreeFacts(receiver: GoPtr<JsxFragment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxOpeningFragment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"065e31c0dfbe688e3485f7eb076efc594af3e8262d42baa418a62c0dc1c4eb89","bodyHash":"6b0c9465caf09a32d00a03f75dd806bb7d5ddd6a89e070ef0834b8e599b8beba"}
 *
 * Go source:
 * func (node *JsxOpeningFragment) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeContainsJsx
 * }
 */
export declare function JsxOpeningFragment_computeSubtreeFacts(receiver: GoPtr<JsxOpeningFragment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxClosingFragment.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"f9d49dce075729175574ab49309714bf8d97c58e228a62ce3e65e1d933dce459","bodyHash":"b020962b7b3ec0af74435e62601c9cab2b5fbab5318e04c220a1a7fa8f32d395"}
 *
 * Go source:
 * func (node *JsxClosingFragment) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeContainsJsx
 * }
 */
export declare function JsxClosingFragment_computeSubtreeFacts(receiver: GoPtr<JsxClosingFragment>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxAttribute.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"360430820536d6810c1e211880d854a8e546e5cacd509de03e1ce08bdd6f5a1d","bodyHash":"5c34b0d15591a0eace4fadfc9e062d8585ae9e3d790dedaf0b4af51262d023bf"}
 *
 * Go source:
 * func (node *JsxAttribute) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.name) |
 * 		propagateSubtreeFacts(node.Initializer) |
 * 		SubtreeContainsJsx
 * }
 */
export declare function JsxAttribute_computeSubtreeFacts(receiver: GoPtr<JsxAttribute>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxSpreadAttribute.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"28905d81e99786fd4f5220bc919fb381519c72a5e3a14d2095f61ac4606db104","bodyHash":"c6cad9706d5dd7afc4e8b9ea81e7b8994ff85eaf320f82215fd8014cd56f422a"}
 *
 * Go source:
 * func (node *JsxSpreadAttribute) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsJsx
 * }
 */
export declare function JsxSpreadAttribute_computeSubtreeFacts(receiver: GoPtr<JsxSpreadAttribute>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxClosingElement.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"e23f087fd588930e53d23aed0399b03e1c051815cc032732b163514899daefbb","bodyHash":"210734b7fd3ea23930e8f92f638b819db2fd4119229e9569e2d3f63a1f5515a8"}
 *
 * Go source:
 * func (node *JsxClosingElement) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.TagName) | SubtreeContainsJsx
 * }
 */
export declare function JsxClosingElement_computeSubtreeFacts(receiver: GoPtr<JsxClosingElement>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxExpression.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"471771838c1aabb6925e1e39b00a8b7909789f23dff50e518045f681b6e74f8f","bodyHash":"538bcce2b653dbe0f9e20d43a4cc7d8d9766d3840662323399c4ca1aeb364365"}
 *
 * Go source:
 * func (node *JsxExpression) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateSubtreeFacts(node.Expression) | SubtreeContainsJsx
 * }
 */
export declare function JsxExpression_computeSubtreeFacts(receiver: GoPtr<JsxExpression>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::JsxText.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"ee8ea9a99ebc707b2c7ac5902ecf32efe235a4da576c0458bdb803f377651633","bodyHash":"9e7f47182be226b59c1198d0f08485fabe3cb02a6e9122d4f2f26c6d5f3f2075"}
 *
 * Go source:
 * func (node *JsxText) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeContainsJsx
 * }
 */
export declare function JsxText_computeSubtreeFacts(receiver: GoPtr<JsxText>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.IsJSDoc","kind":"method","status":"implemented","sigHash":"2f377fbafee03c3026ae5656806a92e92dbb6000db1a4bb39e53f898eaa0e44d","bodyHash":"f30418ab0e0a1113430080c92f43bf7c299b05be5bf204fc92c44d03a970e662"}
 *
 * Go source:
 * func (node *Node) IsJSDoc() bool {
 * 	return node.Kind == KindJSDoc
 * }
 */
export declare function Node_IsJSDoc(receiver: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::PatternAmbientModule","kind":"type","status":"implemented","sigHash":"5c578c4109ac436eda4952dd1f76e183906b1488f81b42929516b6bcc8f68dcb","bodyHash":"d33f3b72a5b625ac4eed0f36275ecd5dbdc09bf46688019164ef2eb80d1ac30e"}
 *
 * Go source:
 * PatternAmbientModule struct {
 * 	Pattern core.Pattern
 * 	Symbol  *Symbol
 * }
 */
export interface PatternAmbientModule {
    Pattern: Pattern;
    Symbol: GoPtr<Symbol_4919c5f0>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::CommentDirectiveKind","kind":"type","status":"implemented","sigHash":"2bf26aa79418695c4ae1fa44a6163cba6943e806c07c95197ccf77375b3e8b87","bodyHash":"df022af03aeefe5f53f2e2ce4a6e0c8240235039e87874dfbc8c62b2f10f4e50"}
 *
 * Go source:
 * CommentDirectiveKind int32
 */
export type CommentDirectiveKind = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::constGroup::CommentDirectiveKindUnknown+CommentDirectiveKindExpectError+CommentDirectiveKindIgnore","kind":"constGroup","status":"implemented","sigHash":"5698df3bff31f08ea8b3d1f940f04f662a4c1190179ad0534b6206bb4ae7f49c","bodyHash":"da9749e66614232c3d94840fdcf4761dd1ce7c38f8d4f3cf2782217077d2f81f"}
 *
 * Go source:
 * const (
 * 	CommentDirectiveKindUnknown CommentDirectiveKind = iota
 * 	CommentDirectiveKindExpectError
 * 	CommentDirectiveKindIgnore
 * )
 */
export declare const CommentDirectiveKindUnknown: CommentDirectiveKind;
export declare const CommentDirectiveKindExpectError: CommentDirectiveKind;
export declare const CommentDirectiveKindIgnore: CommentDirectiveKind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::CommentDirective","kind":"type","status":"implemented","sigHash":"e373af1e299efa1a5fb1148f49bcf52a5f957ac66035d647f95cca95abf5c784","bodyHash":"fb5d9320dfacfe8175e41a653e2aec9f0d685cc8d26efc8ca7cb79ed25db878f"}
 *
 * Go source:
 * CommentDirective struct {
 * 	Loc  core.TextRange
 * 	Kind CommentDirectiveKind
 * }
 */
export interface CommentDirective {
    Loc: TextRange;
    Kind: CommentDirectiveKind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::SourceFileMetaData","kind":"type","status":"implemented","sigHash":"4b2a19a6f67a369a9cf1f1476c60ec83d77d2a787e1a9e4edd04c66a1c06cab3","bodyHash":"2105c9357bddbfd1ddb1fc14b49a6b096d377da02172ca6a17a1df47620ef7da"}
 *
 * Go source:
 * SourceFileMetaData struct {
 * 	PackageJsonType      string
 * 	PackageJsonDirectory string
 * 	ImpliedNodeFormat    core.ResolutionMode
 * }
 */
export interface SourceFileMetaData {
    PackageJsonType: string;
    PackageJsonDirectory: string;
    ImpliedNodeFormat: ResolutionMode;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::CheckJsDirective","kind":"type","status":"implemented","sigHash":"1c0eacfc1e2dedb6f4d82f90d85d0cb6dbb0fc92f34312d8a1d5da547f475dd7","bodyHash":"f0a89880a168deda4cfae67bf54f953c68bf4599463f15640e2b162849e2c078"}
 *
 * Go source:
 * CheckJsDirective struct {
 * 	Enabled bool
 * 	Range   CommentRange
 * }
 */
export interface CheckJsDirective {
    Enabled: bool;
    Range: CommentRange;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::HasFileName","kind":"type","status":"implemented","sigHash":"e72177473a93e23c9f236e698213f4fd5e015e09352b98dd507fad1981267a51","bodyHash":"9f26b203fce1096d80abd97bea5e832a66e3474e2526fc94bfb6b64f76ac4038"}
 *
 * Go source:
 * HasFileName interface {
 * 	FileName() string
 * 	Path() tspath.Path
 * }
 */
export interface HasFileName {
    FileName(): string;
    Path(): Path_79c49227;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::TokenCacheKey","kind":"type","status":"implemented","sigHash":"c212331b5565fb1e485fc2373d2016ac0c3a390cc33678feeca5319f86bdde3a","bodyHash":"8539474677e01804b24d35e2d51c51f2ddb6d924742878bd3ef243f8cf682011"}
 *
 * Go source:
 * TokenCacheKey struct {
 * 	parent *Node
 * 	loc    core.TextRange
 * }
 */
export interface TokenCacheKey {
    parent: GoPtr<Node>;
    loc: TextRange;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::SourceFile","kind":"type","status":"implemented","sigHash":"53bc3d216fc97196ba25b91ad0f1a75f9bad287f452bf3347a3eb4370d6154a9","bodyHash":"1544dafdd77c4d0f387a639475526fd1733904026a2433ebb63bc31804f02f87"}
 *
 * Go source:
 * SourceFile struct {
 * 	NodeBase
 * 	DeclarationBase
 * 	LocalsContainerBase
 * 	CompositeBase
 *
 * 	// Fields set by NewSourceFile
 * 	fileName       string // For debugging convenience
 * 	parseOptions   SourceFileParseOptions
 * 	text           string
 * 	Statements     *NodeList  // NodeList[*Statement]
 * 	EndOfFileToken *TokenNode // TokenNode[*EndOfFileToken]
 *
 * 	// Fields set by parser
 * 	diagnostics                 []*Diagnostic
 * 	jsDiagnostics               []*Diagnostic
 * 	jsdocDiagnostics            []*Diagnostic
 * 	LanguageVariant             core.LanguageVariant
 * 	ScriptKind                  core.ScriptKind
 * 	IsDeclarationFile           bool
 * 	ContainsNonASCII            bool
 * 	UsesUriStyleNodeCoreModules core.Tristate
 * 	Identifiers                 map[string]string
 * 	IdentifierCount             int
 * 	imports                     []*LiteralLikeNode // []LiteralLikeNode
 * 	ModuleAugmentations         []*ModuleName      // []ModuleName
 * 	AmbientModuleNames          []string
 * 	CommentDirectives           []CommentDirective
 * 	jsdocCache                  map[*Node][]*Node
 * 	jsdocMu                     sync.RWMutex
 * 	hasLazyJSDoc                bool
 * 	ReparsedClones              []*Node
 * 	Pragmas                     []Pragma
 * 	ReferencedFiles             []*FileReference
 * 	TypeReferenceDirectives     []*FileReference
 * 	LibReferenceDirectives      []*FileReference
 * 	CheckJsDirective            *CheckJsDirective
 * 	NodeCount                   int
 * 	TextCount                   int
 * 	CommonJSModuleIndicator     *Node
 * 	// If this is the SourceFile itself, then this module was "forced"
 * 	// to be an external module (previously "true").
 * 	ExternalModuleIndicator *Node
 *
 * 	// Fields set by binder
 *
 * 	isBound                   atomic.Bool
 * 	bindOnce                  sync.Once
 * 	bindDiagnostics           []*Diagnostic
 * 	BindSuggestionDiagnostics []*Diagnostic
 * 	EndFlowNode               *FlowNode
 * 	SymbolCount               int
 * 	ClassifiableNames         collections.Set[string]
 * 	PatternAmbientModules     []*PatternAmbientModule
 * 	NestedCJSExports          []*Node
 * 	GlobalExports             SymbolTable
 *
 * 	// Fields set by ECMALineMap
 *
 * 	ecmaLineMapMu sync.RWMutex
 * 	ecmaLineMap   []core.TextPos
 *
 * 	// Fields set by language service
 *
 * 	Hash             xxh3.Uint128
 * 	tokenCacheMu     sync.Mutex
 * 	tokenCache       map[TokenCacheKey]*Node
 * 	tokenFactory     *NodeFactory
 * 	declarationMapMu sync.Mutex
 * 	declarationMap   map[string][]*Node
 * 	nameTableOnce    sync.Once
 * 	nameTable        map[string]int
 *
 * 	// Fields for UTF-8 to UTF-16 position mapping
 *
 * 	positionMapOnce sync.Once
 * 	positionMap     *PositionMap
 * }
 */
export interface SourceFile extends NodeBase, DeclarationBase, LocalsContainerBase, CompositeBase {
    FileName(): string;
    Path(): Path_79c49227;
    Text(): string;
    ECMALineMap(): GoSlice<TextPos>;
    Imports(): GoSlice<GoPtr<LiteralLikeNode>>;
    IsJS(): bool;
    fileName: string;
    parseOptions: SourceFileParseOptions;
    text: string;
    Statements: GoPtr<NodeList>;
    EndOfFileToken: GoPtr<TokenNode>;
    diagnostics: GoSlice<GoPtr<Diagnostic>>;
    jsDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    jsdocDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    LanguageVariant: LanguageVariant;
    ScriptKind: ScriptKind;
    IsDeclarationFile: bool;
    ContainsNonASCII: bool;
    UsesUriStyleNodeCoreModules: Tristate;
    Identifiers: GoMap<string, string>;
    IdentifierCount: int;
    imports: GoSlice<GoPtr<LiteralLikeNode>>;
    ModuleAugmentations: GoSlice<GoPtr<ModuleName>>;
    AmbientModuleNames: GoSlice<string>;
    CommentDirectives: GoSlice<CommentDirective>;
    jsdocCache: GoMap<GoPtr<Node>, GoSlice<GoPtr<Node>>>;
    jsdocMu: RWMutex;
    hasLazyJSDoc: bool;
    ReparsedClones: GoSlice<GoPtr<Node>>;
    Pragmas: GoSlice<Pragma>;
    ReferencedFiles: GoSlice<GoPtr<FileReference>>;
    TypeReferenceDirectives: GoSlice<GoPtr<FileReference>>;
    LibReferenceDirectives: GoSlice<GoPtr<FileReference>>;
    CheckJsDirective: GoPtr<CheckJsDirective>;
    NodeCount: int;
    TextCount: int;
    CommonJSModuleIndicator: GoPtr<Node>;
    ExternalModuleIndicator: GoPtr<Node>;
    isBound: Bool;
    bindOnce: Once;
    bindDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    BindSuggestionDiagnostics: GoSlice<GoPtr<Diagnostic>>;
    EndFlowNode: GoPtr<FlowNode>;
    SymbolCount: int;
    ClassifiableNames: Set<string>;
    PatternAmbientModules: GoSlice<GoPtr<PatternAmbientModule>>;
    NestedCJSExports: GoSlice<GoPtr<Node>>;
    GlobalExports: SymbolTable;
    ecmaLineMapMu: RWMutex;
    ecmaLineMap: GoSlice<TextPos>;
    Hash: Uint128;
    tokenCacheMu: Mutex;
    tokenCache: GoMap<TokenCacheKey, GoPtr<Node>>;
    tokenFactory: GoPtr<NodeFactory>;
    declarationMapMu: Mutex;
    declarationMap: GoMap<string, GoSlice<GoPtr<Node>>>;
    nameTableOnce: Once;
    nameTable: GoMap<string, int>;
    positionMapOnce: Once;
    positionMap: GoPtr<PositionMap>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NewSourceFile","kind":"method","status":"implemented","sigHash":"e4940d9f3428e9275d7d63fa9892eb9e80b6175579425eaaca1143b60814b22e","bodyHash":"6892b9b6566cfd7095dd835823697c16146bdc757ce1ffced931ebbad6e391df"}
 *
 * Go source:
 * func (f *NodeFactory) NewSourceFile(opts SourceFileParseOptions, text string, statements *NodeList, endOfFileToken *TokenNode) *Node {
 * 	if tspath.GetEncodedRootLength(opts.FileName) == 0 || opts.FileName != tspath.NormalizePath(opts.FileName) {
 * 		panic(fmt.Sprintf("fileName should be normalized and absolute: %q", opts.FileName))
 * 	}
 * 	data := &SourceFile{}
 * 	data.fileName = opts.FileName
 * 	data.parseOptions = opts
 * 	data.text = text
 * 	data.Statements = statements
 * 	data.EndOfFileToken = endOfFileToken
 * 	return f.newNode(KindSourceFile, data)
 * }
 */
export declare function AsSourceFile(n: GoPtr<Node>): GoPtr<SourceFile>;
export declare function SourceFile_as_nodeData(receiver: GoPtr<SourceFile>): nodeData;
export declare function NodeFactory_NewSourceFile(receiver: GoPtr<NodeFactory>, opts: SourceFileParseOptions, text: string, statements: GoPtr<NodeList>, endOfFileToken: GoPtr<TokenNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.ParseOptions","kind":"method","status":"implemented","sigHash":"940524c927e1180e0832f9b7b2a570e1094f8036bdfd91e5554e2ef43dda8405","bodyHash":"9dc97cda2475483be2d5b5fdec51395a4747412060d7ae849e3070da475e3a77"}
 *
 * Go source:
 * func (node *SourceFile) ParseOptions() SourceFileParseOptions {
 * 	return node.parseOptions
 * }
 */
export declare function SourceFile_ParseOptions(receiver: GoPtr<SourceFile>): SourceFileParseOptions;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.Text","kind":"method","status":"implemented","sigHash":"c3a456f50179d44a72d54ea8a47519b0ba3c192989bcd352e88a197161bd8c6a","bodyHash":"f54db0b3dddea5a2c52125b8354ea8e8fbd86dd39ea77384ac3d8a737a6ad470"}
 *
 * Go source:
 * func (node *SourceFile) Text() string {
 * 	return node.text
 * }
 */
export declare function SourceFile_Text(receiver: GoPtr<SourceFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.FileName","kind":"method","status":"implemented","sigHash":"5d5b7371eac058827ed0d0f12dd69cdc09be6b9f466918ac0694eeb727219c82","bodyHash":"694b9e1221863f51130a8ea18fddf839086bfed238b5f9bea4fdee2468436c41"}
 *
 * Go source:
 * func (node *SourceFile) FileName() string {
 * 	return node.parseOptions.FileName
 * }
 */
export declare function SourceFile_FileName(receiver: GoPtr<SourceFile>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.Path","kind":"method","status":"implemented","sigHash":"1abc603c48a2b8dad5dee4777dd2dc2a495cf83eead546da3138375a2fe545e5","bodyHash":"a004bc3cc492a600e5e62fe3630f22f7a63aa20878a4c1ebf52b8f6d644bed16"}
 *
 * Go source:
 * func (node *SourceFile) Path() tspath.Path {
 * 	return node.parseOptions.Path
 * }
 */
export declare function SourceFile_Path(receiver: GoPtr<SourceFile>): Path_79c49227;
export declare function SourceFile_as_ast_HasFileName(receiver: GoPtr<SourceFile>): HasFileName;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.Imports","kind":"method","status":"implemented","sigHash":"279edf65bfae1dd40e7b89d6530ce9196979a40832ae39c8437c0bd7250bb028","bodyHash":"134e49d263c3481c7a03c1d229e18cada6e75cc87b7bc34f6033f1bea7352c99"}
 *
 * Go source:
 * func (node *SourceFile) Imports() []*LiteralLikeNode {
 * 	return node.imports
 * }
 */
export declare function SourceFile_Imports(receiver: GoPtr<SourceFile>): GoSlice<GoPtr<LiteralLikeNode>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.Diagnostics","kind":"method","status":"implemented","sigHash":"179beb9d023562e7dc3f865f1da6a3c43e845ada8782fded28a56f67c9fb375c","bodyHash":"774fb21e20d7d845bea1622be1d24b129bd5c274d508409270dcff83d1fc33fb"}
 *
 * Go source:
 * func (node *SourceFile) Diagnostics() []*Diagnostic {
 * 	return node.diagnostics
 * }
 */
export declare function SourceFile_Diagnostics(receiver: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetDiagnostics","kind":"method","status":"implemented","sigHash":"84991e3e1510fd70c8043d4e51a42697d09a1d5e5aaf5982dbfc7cafce427152","bodyHash":"c8a5a83a215d89fef57b816ea85f8a4c3f7b38f7dc99c1342b3730cbea4da1ba"}
 *
 * Go source:
 * func (node *SourceFile) SetDiagnostics(diags []*Diagnostic) {
 * 	node.diagnostics = diags
 * }
 */
export declare function SourceFile_SetDiagnostics(receiver: GoPtr<SourceFile>, diags: GoSlice<GoPtr<Diagnostic>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.JSDiagnostics","kind":"method","status":"implemented","sigHash":"599957913035a01d38541b93152b96e85b655dceb9a53dad0efa33adeab8904b","bodyHash":"b79393010f250891c5aea9ff3a9921a4a3a2764bb7d723bd48f44c19637e97e7"}
 *
 * Go source:
 * func (node *SourceFile) JSDiagnostics() []*Diagnostic {
 * 	return node.jsDiagnostics
 * }
 */
export declare function SourceFile_JSDiagnostics(receiver: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetJSDiagnostics","kind":"method","status":"implemented","sigHash":"19638104b2bf6ec2af9e5f70b4ac30156404bfcec98bc2cb34083315154087cd","bodyHash":"8055041365e0ace3b8c0e95a49a808d95c2fa2d1fac44faae9dd3938039353e8"}
 *
 * Go source:
 * func (node *SourceFile) SetJSDiagnostics(diags []*Diagnostic) {
 * 	node.jsDiagnostics = diags
 * }
 */
export declare function SourceFile_SetJSDiagnostics(receiver: GoPtr<SourceFile>, diags: GoSlice<GoPtr<Diagnostic>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.JSDocDiagnostics","kind":"method","status":"implemented","sigHash":"4cbb154b1288cbb1b6f0dbbbb680637f55062ccd1cf683d0cc9bc819ff6ffd77","bodyHash":"1b47352ecb0c491146fe7c1d77f3900708e4500f17bbeb9eadf26c8945430faf"}
 *
 * Go source:
 * func (node *SourceFile) JSDocDiagnostics() []*Diagnostic {
 * 	return node.jsdocDiagnostics
 * }
 */
export declare function SourceFile_JSDocDiagnostics(receiver: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetJSDocDiagnostics","kind":"method","status":"implemented","sigHash":"18460bf5d4739ccf236267afa032fce64bba2636ad5739060d6ed481d4bd931b","bodyHash":"12653ebd98f87a6029c6ae546f937a3dff828dfa4115bb29a73652bddabeeb6f"}
 *
 * Go source:
 * func (node *SourceFile) SetJSDocDiagnostics(diags []*Diagnostic) {
 * 	node.jsdocDiagnostics = diags
 * }
 */
export declare function SourceFile_SetJSDocDiagnostics(receiver: GoPtr<SourceFile>, diags: GoSlice<GoPtr<Diagnostic>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetJSDocCache","kind":"method","status":"implemented","sigHash":"a9f922f59ad6626e26a22947c508ee3f71789b21939055546c51c223bf7a1ec3","bodyHash":"fcbe64ccd7d2e4fb60be2bbf4fff81d513d484686b762cac885f2a6416d2b569"}
 *
 * Go source:
 * func (node *SourceFile) SetJSDocCache(cache map[*Node][]*Node) {
 * 	node.jsdocCache = cache
 * }
 */
export declare function SourceFile_SetJSDocCache(receiver: GoPtr<SourceFile>, cache: GoMap<GoPtr<Node>, GoSlice<GoPtr<Node>>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetHasLazyJSDoc","kind":"method","status":"implemented","sigHash":"528dcb2e91a7dc029803b8bb310dc70ddd98383a2d37bcdb430bb6bdc3c24e4f","bodyHash":"e5ebdce454911228a4e5873630e4427532ced2a27feb8ede3d57f3641cf9110f"}
 *
 * Go source:
 * func (node *SourceFile) SetHasLazyJSDoc(lazy bool) {
 * 	node.hasLazyJSDoc = lazy
 * }
 */
export declare function SourceFile_SetHasLazyJSDoc(receiver: GoPtr<SourceFile>, lazy: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.resolveJSDoc","kind":"method","status":"implemented","sigHash":"0b0900b712b8fc654369cddb39ce74621004cb090e3312c3d2ed0c0360ca483e","bodyHash":"795db99ad5d3a52abd4379a3f133c6ae959c46ec2752dfd1856beea041464abc"}
 *
 * Go source:
 * func (node *SourceFile) resolveJSDoc(n *Node) []*Node {
 * 	if parseJSDocForNode == nil {
 * 		panic("resolveJSDoc called but parseJSDocForNode is not registered; ensure the parser package is imported")
 * 	}
 * 	// Fast path: check cache under read lock
 * 	node.jsdocMu.RLock()
 * 	if jsdocs, ok := node.jsdocCache[n]; ok {
 * 		node.jsdocMu.RUnlock()
 * 		return jsdocs
 * 	}
 * 	node.jsdocMu.RUnlock()
 *
 * 	// Slow path: parse and cache under write lock
 * 	node.jsdocMu.Lock()
 * 	defer node.jsdocMu.Unlock()
 * 	// Double-check after acquiring write lock
 * 	if jsdocs, ok := node.jsdocCache[n]; ok {
 * 		return jsdocs
 * 	}
 * 	jsdocs := parseJSDocForNode(node, n)
 * 	if node.jsdocCache == nil {
 * 		node.jsdocCache = make(map[*Node][]*Node)
 * 	}
 * 	node.jsdocCache[n] = jsdocs
 * 	return jsdocs
 * }
 */
export declare function SourceFile_resolveJSDoc(receiver: GoPtr<SourceFile>, n: GoPtr<Node>): GoSlice<GoPtr<Node>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.BindDiagnostics","kind":"method","status":"implemented","sigHash":"235a151865b3e621bf037b6c8f2b11bccaf1313ee2d2a316d5ed24a008cfcf09","bodyHash":"fd1c217aa6e1a8a41a45a27b4b1fed75772361793e3dfd1a49339214cc685c0c"}
 *
 * Go source:
 * func (node *SourceFile) BindDiagnostics() []*Diagnostic {
 * 	return node.bindDiagnostics
 * }
 */
export declare function SourceFile_BindDiagnostics(receiver: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.SetBindDiagnostics","kind":"method","status":"implemented","sigHash":"b17ee72e255032b896438d688f5fcaa9d67a9450b456889b971c0fe2f5845e9d","bodyHash":"f8fd2d08d815a531d54060c9385df4a1a7ff302993322e00fac69b2e065213b7"}
 *
 * Go source:
 * func (node *SourceFile) SetBindDiagnostics(diags []*Diagnostic) {
 * 	node.bindDiagnostics = diags
 * }
 */
export declare function SourceFile_SetBindDiagnostics(receiver: GoPtr<SourceFile>, diags: GoSlice<GoPtr<Diagnostic>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.ForEachChild","kind":"method","status":"implemented","sigHash":"eff1e7f74cc8c522b9386f2a71939504766e2114656ee9a748077638cdeb7c15","bodyHash":"5cd709a2152deb5c212eaa0beb65d23a000609ba3a61aaeceff4d2f8d790f19e"}
 *
 * Go source:
 * func (node *SourceFile) ForEachChild(v Visitor) bool {
 * 	return visitNodeList(v, node.Statements) || visit(v, node.EndOfFileToken)
 * }
 */
export declare function SourceFile_ForEachChild(receiver: GoPtr<SourceFile>, v: Visitor): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.VisitEachChild","kind":"method","status":"implemented","sigHash":"7ccd1da3d76ce97dd985b9e88e52fff0146ab03b0436b893033cd0d724469460","bodyHash":"3ebefbcf580e504aad3b1d0e8421902546810cd14da612b0a8e5dc857869455a"}
 *
 * Go source:
 * func (node *SourceFile) VisitEachChild(v *NodeVisitor) *Node {
 * 	return v.Factory.UpdateSourceFile(node, v.visitTopLevelStatements(node.Statements), v.visitToken(node.EndOfFileToken))
 * }
 */
export declare function SourceFile_VisitEachChild(receiver: GoPtr<SourceFile>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.IsJS","kind":"method","status":"implemented","sigHash":"8923da1293787c287f2d91e4167695611ab66db39e777bc21860a04dcfaf5921","bodyHash":"b7577558c73970c7bad964ad57d2ecd7c0d0450f7b8e59a95d25aecdae15d6c4"}
 *
 * Go source:
 * func (node *SourceFile) IsJS() bool {
 * 	return IsSourceFileJS(node)
 * }
 */
export declare function SourceFile_IsJS(receiver: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.copyFrom","kind":"method","status":"implemented","sigHash":"ae744035c63cc00a52b1a4b8cbd46f351607b7d8c7788b73c49d4fd1741c998a","bodyHash":"fcb7efd368bfbbb08404b38ca524050b10631017b61a1332fb88e05c1ef38aaa"}
 *
 * Go source:
 * func (node *SourceFile) copyFrom(other *SourceFile) {
 * 	// Do not copy fields set by NewSourceFile (Text, FileName, Path, or Statements)
 * 	node.LanguageVariant = other.LanguageVariant
 * 	node.ScriptKind = other.ScriptKind
 * 	node.IsDeclarationFile = other.IsDeclarationFile
 * 	node.ContainsNonASCII = other.ContainsNonASCII
 * 	node.UsesUriStyleNodeCoreModules = other.UsesUriStyleNodeCoreModules
 * 	node.Identifiers = other.Identifiers
 * 	node.imports = other.imports
 * 	node.ModuleAugmentations = other.ModuleAugmentations
 * 	node.AmbientModuleNames = other.AmbientModuleNames
 * 	node.CommentDirectives = other.CommentDirectives
 * 	node.Pragmas = other.Pragmas
 * 	node.ReferencedFiles = other.ReferencedFiles
 * 	node.TypeReferenceDirectives = other.TypeReferenceDirectives
 * 	node.LibReferenceDirectives = other.LibReferenceDirectives
 * 	node.CommonJSModuleIndicator = other.CommonJSModuleIndicator
 * 	node.ExternalModuleIndicator = other.ExternalModuleIndicator
 * 	node.Flags |= other.Flags
 * }
 */
export declare function SourceFile_copyFrom(receiver: GoPtr<SourceFile>, other: GoPtr<SourceFile>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.Clone","kind":"method","status":"implemented","sigHash":"e1d4a0a17e7f613eb0e24078725cd5e75726237761cb9010855963ee374207d5","bodyHash":"d13cfed49d3ca29b6f621e1784098619b91da51cd78d2db75b1af23b2ee98001"}
 *
 * Go source:
 * func (node *SourceFile) Clone(f NodeFactoryCoercible) *Node {
 * 	updated := f.AsNodeFactory().NewSourceFile(node.parseOptions, node.text, node.Statements, node.EndOfFileToken)
 * 	newFile := updated.AsSourceFile()
 * 	newFile.copyFrom(node)
 * 	return cloneNode(updated, node.AsNode(), f.AsNodeFactory().hooks)
 * }
 */
export declare function SourceFile_Clone(receiver: GoPtr<SourceFile>, f: NodeFactoryCoercible): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"2a300548dca62b8e5356063d81f006089dc5cacfeaa623eedf5cec94d7f5729f","bodyHash":"6281e5de44530b5fab663f52d7a1133e87a6b3b052678a13035510f93b8cf0fd"}
 *
 * Go source:
 * func (node *SourceFile) computeSubtreeFacts() SubtreeFacts {
 * 	return propagateNodeListSubtreeFacts(node.Statements, propagateSubtreeFacts)
 * }
 */
export declare function SourceFile_computeSubtreeFacts(receiver: GoPtr<SourceFile>): SubtreeFacts;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.UpdateSourceFile","kind":"method","status":"implemented","sigHash":"e3ea0b4fb25a98e1a176b9dfd8aa512d28e87999379b4ee6f870b9fdb3b341b4","bodyHash":"faaa62137f77ef448bfb6f4bfb29ade94e950dce538e6c942390fe3f427f2874"}
 *
 * Go source:
 * func (f *NodeFactory) UpdateSourceFile(node *SourceFile, statements *StatementList, endOfFileToken *TokenNode) *Node {
 * 	if statements != node.Statements || endOfFileToken != node.EndOfFileToken {
 * 		updated := f.NewSourceFile(node.parseOptions, node.text, statements, endOfFileToken).AsSourceFile()
 * 		updated.copyFrom(node)
 * 		return updateNode(updated.AsNode(), node.AsNode(), f.hooks)
 * 	}
 * 	return node.AsNode()
 * }
 */
export declare function NodeFactory_UpdateSourceFile(receiver: GoPtr<NodeFactory>, node: GoPtr<SourceFile>, statements: GoPtr<StatementList_3cde134f>, endOfFileToken: GoPtr<TokenNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.ECMALineMap","kind":"method","status":"implemented","sigHash":"a2c1e1c1ccffb866337bd78c077854301d915dc94b284419811762566d57ca19","bodyHash":"d0562dd997bba445e106e5bc5cf99877bd8093a668d76d8e97e9d0ce13ba7e7e"}
 *
 * Go source:
 * func (node *SourceFile) ECMALineMap() []core.TextPos {
 * 	node.ecmaLineMapMu.RLock()
 * 	lineMap := node.ecmaLineMap
 * 	node.ecmaLineMapMu.RUnlock()
 * 	if lineMap == nil {
 * 		node.ecmaLineMapMu.Lock()
 * 		defer node.ecmaLineMapMu.Unlock()
 * 		lineMap = node.ecmaLineMap
 * 		if lineMap == nil {
 * 			lineMap = core.ComputeECMALineStarts(node.Text())
 * 			node.ecmaLineMap = lineMap
 * 		}
 * 	}
 * 	return lineMap
 * }
 */
export declare function SourceFile_ECMALineMap(receiver: GoPtr<SourceFile>): GoSlice<TextPos>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.GetNameTable","kind":"method","status":"implemented","sigHash":"20bd78e754e0ad84523304e016214ac4a2fa92fbf3bfd6b21f4adac851102b0d","bodyHash":"ac2966a6a3e02c8f51e6d67b354cb6066ce61187f0229511a9f29491681cde36"}
 *
 * Go source:
 * func (file *SourceFile) GetNameTable() map[string]int {
 * 	file.nameTableOnce.Do(func() {
 * 		nameTable := make(map[string]int, file.IdentifierCount)
 *
 * 		var walk func(node *Node) bool
 * 		walk = func(node *Node) bool {
 * 			if IsIdentifier(node) && !IsTagName(node) && node.Text() != "" ||
 * 				IsStringOrNumericLiteralLike(node) && literalIsName(node) ||
 * 				IsPrivateIdentifier(node) {
 * 				text := node.Text()
 * 				if _, ok := nameTable[text]; ok {
 * 					nameTable[text] = -1
 * 				} else {
 * 					nameTable[text] = node.Pos()
 * 				}
 * 			}
 *
 * 			node.ForEachChild(walk)
 * 			jsdocNodes := node.JSDoc(file)
 * 			for _, jsdoc := range jsdocNodes {
 * 				jsdoc.ForEachChild(walk)
 * 			}
 * 			return false
 * 		}
 * 		file.ForEachChild(walk)
 *
 * 		file.nameTable = nameTable
 * 	})
 * 	return file.nameTable
 * }
 */
export declare function SourceFile_GetNameTable(receiver: GoPtr<SourceFile>): GoMap<string, int>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.IsBound","kind":"method","status":"implemented","sigHash":"e9f541a6ff5e7a68b670fc674b1a642966e756ac57d4c6cbd6858dab0891ac2e","bodyHash":"83b89cd435ca1f9bc970dc30245634b548b836a5ce4f7aed71c976adfbe2a0c8"}
 *
 * Go source:
 * func (node *SourceFile) IsBound() bool {
 * 	return node.isBound.Load()
 * }
 */
export declare function SourceFile_IsBound(receiver: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.GetPositionMap","kind":"method","status":"implemented","sigHash":"7a37e4f7ef341ef4db949d8ecd688078936938df9edc481082cfa83671f5523d","bodyHash":"e93fb10115ea853e3720e776ca00fb52b79e76efcc83b1d4fa41517166868a0d"}
 *
 * Go source:
 * func (file *SourceFile) GetPositionMap() *PositionMap {
 * 	file.positionMapOnce.Do(func() {
 * 		if !file.ContainsNonASCII {
 * 			file.positionMap = &PositionMap{asciiOnly: true}
 * 		} else {
 * 			file.positionMap = ComputePositionMap(file.Text())
 * 		}
 * 	})
 * 	return file.positionMap
 * }
 */
export declare function SourceFile_GetPositionMap(receiver: GoPtr<SourceFile>): GoPtr<PositionMap>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.BindOnce","kind":"method","status":"implemented","sigHash":"d20d09214a537f5b634793ce42cc932703f40fee3b052924aab90e02fdbd1379","bodyHash":"98459b80fb37086a3fea24531c538541af253e70a48ca68a24790ae95e5a7f61"}
 *
 * Go source:
 * func (node *SourceFile) BindOnce(bind func()) {
 * 	node.bindOnce.Do(func() {
 * 		bind()
 * 		node.isBound.Store(true)
 * 	})
 * }
 */
export declare function SourceFile_BindOnce(receiver: GoPtr<SourceFile>, bind: () => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.GetOrCreateToken","kind":"method","status":"implemented","sigHash":"17e4735a41f9c362dfa26a185738e75708765a49480e183fbd984638d9c73b63","bodyHash":"1fd96d5121156a8f85ec3bf9ea0c8d6caddb789e6c50499f598602f265cfccee"}
 *
 * Go source:
 * func (node *SourceFile) GetOrCreateToken(
 * 	kind Kind,
 * 	pos int,
 * 	end int,
 * 	parent *Node,
 * 	flags TokenFlags,
 * ) *TokenNode {
 * 	node.tokenCacheMu.Lock()
 * 	defer node.tokenCacheMu.Unlock()
 * 	loc := core.NewTextRange(pos, end)
 * 	key := TokenCacheKey{parent, loc}
 * 	if token, ok := node.tokenCache[key]; ok {
 * 		if token.Kind != kind {
 * 			panic(fmt.Sprintf("Token cache mismatch: %v != %v", token.Kind, kind))
 * 		}
 * 		return token
 * 	}
 * 	if parent.Flags&NodeFlagsReparsed != 0 {
 * 		panic(fmt.Sprintf("Cannot create token from reparsed node of kind %v", parent.Kind))
 * 	}
 * 	if node.tokenCache == nil {
 * 		node.tokenCache = make(map[TokenCacheKey]*Node)
 * 	}
 * 	token := createToken(kind, node, pos, end, flags)
 * 	token.Loc = loc
 * 	token.Parent = parent
 * 	node.tokenCache[key] = token
 * 	return token
 * }
 */
export declare function SourceFile_GetOrCreateToken(receiver: GoPtr<SourceFile>, kind: Kind, pos: int, end: int, parent: GoPtr<Node>, flags: TokenFlags): GoPtr<TokenNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::createToken","kind":"func","status":"implemented","sigHash":"5de2094d9a107a1a3508ac0414666f642fa8ab577f11758b31a281c3f1bcc510","bodyHash":"efea1dfb31a5771292db456584f36dde8b05960c979705f9a431409df5b2fcdf"}
 * @tsgo-override {"category":"runtime-correctness-performance","allow":["body"],"reason":"Use TS-Go byte-offset slicing over JS/.NET UTF-16 source storage; direct JS slice would mis-handle non-ASCII positions and bypass the shared byte-view cache."}
 *
 * Go source:
 * func createToken(kind Kind, file *SourceFile, pos, end int, flags TokenFlags) *Node {
 * 	if file.tokenFactory == nil {
 * 		file.tokenFactory = NewNodeFactory(NodeFactoryHooks{})
 * 	}
 * 	text := file.text[pos:end]
 * 	switch kind {
 * 	case KindNumericLiteral:
 * 		return file.tokenFactory.NewNumericLiteral(text, flags)
 * 	case KindBigIntLiteral:
 * 		return file.tokenFactory.NewBigIntLiteral(text, flags)
 * 	case KindStringLiteral:
 * 		return file.tokenFactory.NewStringLiteral(text, flags)
 * 	case KindJsxText, KindJsxTextAllWhiteSpaces:
 * 		return file.tokenFactory.NewJsxText(text, kind == KindJsxTextAllWhiteSpaces)
 * 	case KindRegularExpressionLiteral:
 * 		return file.tokenFactory.NewRegularExpressionLiteral(text, flags)
 * 	case KindNoSubstitutionTemplateLiteral:
 * 		return file.tokenFactory.NewNoSubstitutionTemplateLiteral(text, flags)
 * 	case KindTemplateHead:
 * 		return file.tokenFactory.NewTemplateHead(text, "" /*rawText* /, flags)
 * 	case KindTemplateMiddle:
 * 		return file.tokenFactory.NewTemplateMiddle(text, "" /*rawText* /, flags)
 * 	case KindTemplateTail:
 * 		return file.tokenFactory.NewTemplateTail(text, "" /*rawText* /, flags)
 * 	case KindIdentifier:
 * 		return file.tokenFactory.NewIdentifier(text)
 * 	case KindPrivateIdentifier:
 * 		return file.tokenFactory.NewPrivateIdentifier(text)
 * 	default: // Punctuation and keywords
 * 		return file.tokenFactory.NewToken(kind)
 * 	}
 * }
 */
export declare function createToken(kind: Kind, file: GoPtr<SourceFile>, pos: int, end: int, flags: TokenFlags): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.GetDeclarationMap","kind":"method","status":"implemented","sigHash":"3a5aa189eddf2eb3c25facd5c54bd48b51709fef3d8343083a42ebadb72d012f","bodyHash":"edb9132ae5d8a291b15710bede0e2ef37392b22f4afa035bdcda37ab9abc4dd5"}
 *
 * Go source:
 * func (node *SourceFile) GetDeclarationMap() map[string][]*Node {
 * 	node.declarationMapMu.Lock()
 * 	defer node.declarationMapMu.Unlock()
 * 	if node.declarationMap == nil {
 * 		node.declarationMap = node.computeDeclarationMap()
 * 	}
 * 	return node.declarationMap
 * }
 */
export declare function SourceFile_GetDeclarationMap(receiver: GoPtr<SourceFile>): GoMap<string, GoSlice<GoPtr<Node>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::SourceFile.computeDeclarationMap","kind":"method","status":"implemented","sigHash":"d8c644a80f56e42c73fc71a7078b43b2909d7f1f086ad31f4f0f9c33566e9939","bodyHash":"90bb4c17553afb94f076dc6773ac89c58be7468efaa02197ebcda7d5c73a032e"}
 *
 * Go source:
 * func (node *SourceFile) computeDeclarationMap() map[string][]*Node {
 * 	result := make(map[string][]*Node)
 *
 * 	addDeclaration := func(declaration *Node) {
 * 		name := GetDeclarationName(declaration)
 * 		if name != "" {
 * 			result[name] = append(result[name], declaration)
 * 		}
 * 	}
 *
 * 	var visit func(*Node) bool
 * 	visit = func(node *Node) bool {
 * 		switch node.Kind {
 * 		case KindFunctionDeclaration, KindFunctionExpression, KindMethodDeclaration, KindMethodSignature:
 * 			declarationName := GetDeclarationName(node)
 * 			if declarationName != "" {
 * 				declarations := result[declarationName]
 * 				var lastDeclaration *Node
 * 				if len(declarations) != 0 {
 * 					lastDeclaration = declarations[len(declarations)-1]
 * 				}
 * 				// Check whether this declaration belongs to an "overload group".
 * 				if lastDeclaration != nil && node.Parent == lastDeclaration.Parent && node.Symbol() == lastDeclaration.Symbol() {
 * 					// Overwrite the last declaration if it was an overload and this one is an implementation.
 * 					if node.Body() != nil && lastDeclaration.Body() == nil {
 * 						declarations[len(declarations)-1] = node
 * 					}
 * 				} else {
 * 					result[declarationName] = append(result[declarationName], node)
 * 				}
 * 			}
 * 			node.ForEachChild(visit)
 * 		case KindClassDeclaration, KindClassExpression, KindInterfaceDeclaration, KindTypeAliasDeclaration, KindEnumDeclaration, KindModuleDeclaration,
 * 			KindImportEqualsDeclaration, KindImportClause, KindNamespaceImport, KindGetAccessor, KindSetAccessor, KindTypeLiteral:
 * 			addDeclaration(node)
 * 			node.ForEachChild(visit)
 * 		case KindImportSpecifier, KindExportSpecifier:
 * 			if node.PropertyName() != nil {
 * 				addDeclaration(node)
 * 			}
 * 		case KindParameter:
 * 			// Only consider parameter properties
 * 			if !HasSyntacticModifier(node, ModifierFlagsParameterPropertyModifier) {
 * 				break
 * 			}
 * 			fallthrough
 * 		case KindVariableDeclaration, KindBindingElement:
 * 			name := node.Name()
 * 			if name != nil {
 * 				if IsBindingPattern(name) {
 * 					node.Name().ForEachChild(visit)
 * 				} else {
 * 					if node.Initializer() != nil {
 * 						visit(node.Initializer())
 * 					}
 * 					addDeclaration(node)
 * 				}
 * 			}
 * 		case KindEnumMember, KindPropertyDeclaration, KindPropertySignature:
 * 			addDeclaration(node)
 * 		case KindExportDeclaration:
 * 			// Handle named exports case e.g.:
 * 			//    export {a, b as B} from "mod";
 * 			exportClause := node.AsExportDeclaration().ExportClause
 * 			if exportClause != nil {
 * 				if IsNamedExports(exportClause) {
 * 					for _, element := range exportClause.Elements() {
 * 						visit(element)
 * 					}
 * 				} else {
 * 					visit(exportClause.AsNamespaceExport().Name())
 * 				}
 * 			}
 * 		case KindImportDeclaration:
 * 			importClause := node.AsImportDeclaration().ImportClause
 * 			if importClause != nil {
 * 				// Handle default import case e.g.:
 * 				//    import d from "mod";
 * 				if importClause.Name() != nil {
 * 					addDeclaration(importClause.Name())
 * 				}
 * 				// Handle named bindings in imports e.g.:
 * 				//    import * as NS from "mod";
 * 				//    import {a, b as B} from "mod";
 * 				namedBindings := importClause.AsImportClause().NamedBindings
 * 				if namedBindings != nil {
 * 					if namedBindings.Kind == KindNamespaceImport {
 * 						addDeclaration(namedBindings)
 * 					} else {
 * 						for _, element := range namedBindings.Elements() {
 * 							visit(element)
 * 						}
 * 					}
 * 				}
 * 			}
 * 		case KindBinaryExpression:
 * 			switch GetAssignmentDeclarationKind(node) {
 * 			case JSDeclarationKindExportsProperty, JSDeclarationKindThisProperty, JSDeclarationKindProperty:
 * 				addDeclaration(node)
 * 			}
 * 			node.ForEachChild(visit)
 * 		default:
 * 			node.ForEachChild(visit)
 * 		}
 * 		return false
 * 	}
 * 	node.ForEachChild(visit)
 * 	return result
 * }
 */
export declare function SourceFile_computeDeclarationMap(receiver: GoPtr<SourceFile>): GoMap<string, GoSlice<GoPtr<Node>>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::GetDeclarationName","kind":"func","status":"implemented","sigHash":"5a472dfd7101cb40f01ea5fceb094f15016e8984d829000672fe63d3b1999747","bodyHash":"9add130be4bd285f4f7cc4353865ba50ee6146726e4fc56316f81e9aee14726f"}
 *
 * Go source:
 * func GetDeclarationName(declaration *Node) string {
 * 	name := GetNonAssignedNameOfDeclaration(declaration)
 * 	if name != nil {
 * 		if IsComputedPropertyName(name) {
 * 			if IsStringOrNumericLiteralLike(name.Expression()) {
 * 				return name.Expression().Text()
 * 			}
 * 			if IsPropertyAccessExpression(name.Expression()) {
 * 				return name.Expression().Name().Text()
 * 			}
 * 		} else if IsPropertyName(name) {
 * 			return name.Text()
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function GetDeclarationName(declaration: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::SourceFileLike","kind":"type","status":"implemented","sigHash":"a778b740f2af5187430d8b9b63518951c188705c8ed904f7cfd59b2404d6452a","bodyHash":"49188745e74ebb4858cfc773e13682014e09d92155993b8b9df20758ab850b75"}
 *
 * Go source:
 * SourceFileLike interface {
 * 	Text() string
 * 	ECMALineMap() []core.TextPos
 * }
 */
export interface SourceFileLike {
    Text(): string;
    ECMALineMap(): GoSlice<TextPos>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::CommentRange","kind":"type","status":"implemented","sigHash":"6abe6c7c0d330cd4dda72b74e6c12e3884675c76deef16376c593072bef825ba","bodyHash":"3b9e0a382184a8ccc0e5f36a83497657f69de1ad7dd98caa96e9a7fa7a7fd3eb"}
 *
 * Go source:
 * CommentRange struct {
 * 	core.TextRange
 * 	Kind               Kind
 * 	HasTrailingNewLine bool
 * }
 */
export interface CommentRange extends TextRange {
    Kind: Kind;
    HasTrailingNewLine: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NewCommentRange","kind":"method","status":"implemented","sigHash":"5b3542c99846156a532cc1d8533a381000773536be1a10a2a72592c9a9e592d3","bodyHash":"0f50fc997fd520b1a6b5337b8fe9765c57ca13ad88b60be95535b6902744b625"}
 *
 * Go source:
 * func (f *NodeFactory) NewCommentRange(kind Kind, pos int, end int, hasTrailingNewLine bool) CommentRange {
 * 	return CommentRange{
 * 		TextRange:          core.NewTextRange(pos, end),
 * 		Kind:               kind,
 * 		HasTrailingNewLine: hasTrailingNewLine,
 * 	}
 * }
 */
export declare function NodeFactory_NewCommentRange(receiver: GoPtr<NodeFactory>, kind: Kind, pos: int, end: int, hasTrailingNewLine: bool): CommentRange;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::FileReference","kind":"type","status":"implemented","sigHash":"8e4016d25dc67b7eff4c2c9d74613a043bc230db6abab32c67d01e370d7bad49","bodyHash":"187b3a5726141ea60d2ba6ee985693b75f15274ea200f7096aee6c2cc20641cc"}
 *
 * Go source:
 * FileReference struct {
 * 	core.TextRange
 * 	FileName       string
 * 	ResolutionMode core.ResolutionMode
 * 	Preserve       bool
 * }
 */
export interface FileReference extends TextRange {
    FileName: string;
    ResolutionMode: ResolutionMode;
    Preserve: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::PragmaArgument","kind":"type","status":"implemented","sigHash":"3f902144cb82dbf89d2255bc3fce73baed3e4d0f32d617cdf592a5db11f610d9","bodyHash":"b480ef215b7a3c0f6f0ce7a849547a8ca828f0b0eca6a14b8b60e0e916454605"}
 *
 * Go source:
 * PragmaArgument struct {
 * 	core.TextRange
 * 	Name  string
 * 	Value string
 * }
 */
export interface PragmaArgument extends TextRange {
    Name: string;
    Value: string;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::Pragma","kind":"type","status":"implemented","sigHash":"468c93cec9912ff95bb395fa13974742ec5b2b0295bff67a3e3f0865d51a29fa","bodyHash":"5517b7318097a4a61ec97ebda6b34b50f42928bf5b3fce3da5a3e563fed0036b"}
 *
 * Go source:
 * Pragma struct {
 * 	CommentRange
 * 	Name string
 * 	Args map[string]PragmaArgument
 * }
 */
export interface Pragma extends CommentRange {
    Name: string;
    Args: GoMap<string, PragmaArgument>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::PragmaKindFlags","kind":"type","status":"implemented","sigHash":"f469162de0392a0d8dd2a350abb167bc19c62c88d8a363ee0e6e591fe4a6dbec","bodyHash":"535c9798f46aeb5158dc1a9f60303de6a8bb4b4e1019c61ca253c26fa47c9a3d"}
 *
 * Go source:
 * PragmaKindFlags = uint8
 */
export type PragmaKindFlags = byte;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::constGroup::PragmaKindTripleSlashXML+PragmaKindSingleLine+PragmaKindMultiLine+PragmaKindFlagsNone+PragmaKindAll+PragmaKindDefault","kind":"constGroup","status":"implemented","sigHash":"f63774f9681cad2228f8dc2884ae43cffabe334ec69c7da7e80a8acefda6b44d","bodyHash":"63b94510f25bf46c0321d4262a7b41f912d6a2513385e1dea0d7697d500efb88"}
 *
 * Go source:
 * const (
 * 	PragmaKindTripleSlashXML PragmaKindFlags = 1 << iota
 * 	PragmaKindSingleLine
 * 	PragmaKindMultiLine
 * 	PragmaKindFlagsNone PragmaKindFlags = 0
 * 	PragmaKindAll                       = PragmaKindTripleSlashXML | PragmaKindSingleLine | PragmaKindMultiLine
 * 	PragmaKindDefault                   = PragmaKindAll
 * )
 */
export declare const PragmaKindTripleSlashXML: PragmaKindFlags;
export declare const PragmaKindSingleLine: PragmaKindFlags;
export declare const PragmaKindMultiLine: PragmaKindFlags;
export declare const PragmaKindFlagsNone: PragmaKindFlags;
export declare const PragmaKindAll: int;
export declare const PragmaKindDefault: int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::PragmaArgumentSpecification","kind":"type","status":"implemented","sigHash":"2b3ede31b1a4d191575bdd573254af18d051ccc9918f0c5c0365f2315cbe04a0","bodyHash":"0796d17ee075da388b4a655988d7f19c0f6923607de9a40f1923d3cd0d23fa41"}
 *
 * Go source:
 * PragmaArgumentSpecification struct {
 * 	Name        string
 * 	Optional    bool
 * 	CaptureSpan bool
 * }
 */
export interface PragmaArgumentSpecification {
    Name: string;
    Optional: bool;
    CaptureSpan: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::PragmaSpecification","kind":"type","status":"implemented","sigHash":"9970a408b49706480fdc5b02e1ed5e65b992aafb19f24b4804075c1918fe2a78","bodyHash":"d451777ea24f578ae4b2890c9fecf38555e76303dfb30413b174b3ae85cc6bf4"}
 *
 * Go source:
 * PragmaSpecification struct {
 * 	Args []PragmaArgumentSpecification
 * 	Kind PragmaKindFlags
 * }
 */
export interface PragmaSpecification {
    Args: GoSlice<PragmaArgumentSpecification>;
    Kind: PragmaKindFlags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::PragmaSpecification.IsTripleSlash","kind":"method","status":"implemented","sigHash":"b7c2b47a53b28c730a5f716911d5c127b3176b52fdb042215ed61a5ae0c02210","bodyHash":"9cebce6276d7e038c0e8181094b5f230cadea7c79e7558772f44cdfa986b3fd9"}
 *
 * Go source:
 * func (spec *PragmaSpecification) IsTripleSlash() bool {
 * 	return (spec.Kind & PragmaKindTripleSlashXML) > 0
 * }
 */
export declare function PragmaSpecification_IsTripleSlash(receiver: GoPtr<PragmaSpecification>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::forEachChild_JSDocParameterOrPropertyTag","kind":"func","status":"implemented","sigHash":"7d73492f7af8705421d1c00f841cdc250bad0b90fe86f8131f8f00bfdf4090ea","bodyHash":"07e08080187d11d1fc5728ec9acba1669796be3936e6c21c7c24f4ab3caeb4a2"}
 *
 * Go source:
 * func forEachChild_JSDocParameterOrPropertyTag(node *JSDocParameterOrPropertyTag, v Visitor) bool {
 * 	return visit(v, node.TagName) ||
 * 		(node.IsNameFirst &&
 * 			(visit(v, node.name) || visit(v, node.TypeExpression))) ||
 * 		(!node.IsNameFirst &&
 * 			(visit(v, node.TypeExpression) || visit(v, node.name))) ||
 * 		visitNodeList(v, node.Comment)
 * }
 */
export declare function forEachChild_JSDocParameterOrPropertyTag(node: GoPtr<JSDocParameterOrPropertyTag>, v: Visitor): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::visitEachChild_JSDocParameterOrPropertyTag","kind":"func","status":"implemented","sigHash":"480579fe34c08cd210e2180dc687d3a7b1c7c400f8bb0aefb88a8a860565c869","bodyHash":"ac98a9a736af99239000481a05b7e0864abbe0e34eb3d5b982424a0943d32258"}
 *
 * Go source:
 * func visitEachChild_JSDocParameterOrPropertyTag(node *JSDocParameterOrPropertyTag, v *NodeVisitor) *Node {
 * 	return v.Factory.UpdateJSDocParameterOrPropertyTag(node, v.visitNode(node.TagName), v.visitNode(node.name), node.IsBracketed, v.visitNode(node.TypeExpression), node.IsNameFirst, v.visitNodes(node.Comment))
 * }
 */
export declare function visitEachChild_JSDocParameterOrPropertyTag(node: GoPtr<JSDocParameterOrPropertyTag>, v: GoPtr<NodeVisitor>): GoPtr<Node>;
export declare function NodeFactory_UpdateComputedPropertyName(receiver: GoPtr<NodeFactory>, node: GoPtr<ComputedPropertyName>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateJSDocParameterOrPropertyTag(receiver: GoPtr<NodeFactory>, node: GoPtr<JSDocParameterOrPropertyTag>, tagName: GoPtr<IdentifierNode>, name: GoPtr<EntityName>, isBracketed: bool, typeExpression: GoPtr<TypeNode>, isNameFirst: bool, comment: GoPtr<NodeList>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.ReleaseArenas","kind":"method","status":"implemented","sigHash":"5f60c1b96ee97c17702c2b35d40a988074adcf77965b995340c93883e9758567","bodyHash":"5a2c80ebdf5af96bdf002847add0dcda4cfc5871ca3f4eeda347a471517863bf"}
 *
 * Go source:
 * func (f *NodeFactory) ReleaseArenas() {
 * 	*f = NodeFactory{
 * 		hooks:     f.hooks,
 * 		textCount: f.textCount,
 * 		nodeCount: f.nodeCount,
 * 	}
 * }
 */
export declare function NodeFactory_ReleaseArenas(receiver: GoPtr<NodeFactory>): void;
export declare function NodeFactory_UpdateBlock(receiver: GoPtr<NodeFactory>, node: GoPtr<Block>, statements: GoPtr<StatementList_3cde134f>, multiLine: bool): GoPtr<Node>;
export declare function NodeFactory_UpdateForStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<ForStatement>, initializer: GoPtr<ForInitializer>, condition: GoPtr<Expression_9ab73856>, incrementor: GoPtr<Expression_9ab73856>, statement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateExpressionStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<ExpressionStatement>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateTryStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<TryStatement>, tryBlock: GoPtr<BlockNode>, catchClause: GoPtr<CatchClauseNode>, finallyBlock: GoPtr<BlockNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateClassDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ClassDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, heritageClauses: GoPtr<HeritageClauseList>, members: GoPtr<ClassElementList>): GoPtr<Node>;
export declare function NodeFactory_UpdateClassExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ClassExpression>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, heritageClauses: GoPtr<HeritageClauseList>, members: GoPtr<ClassElementList>): GoPtr<Node>;
export declare function NodeFactory_UpdateHeritageClause(receiver: GoPtr<NodeFactory>, node: GoPtr<HeritageClause>, token: Kind, types: GoPtr<ExpressionWithTypeArgumentsList>): GoPtr<Node>;
export declare function NodeFactory_UpdateTypeParameterDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<TypeParameterDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, constraint: GoPtr<TypeNode>, expression: GoPtr<Expression_9ab73856>, defaultType: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateConstructorTypeNode(receiver: GoPtr<NodeFactory>, node: GoPtr<ConstructorTypeNode>, modifiers: GoPtr<ModifierList>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateConstructorDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ConstructorDeclaration>, modifiers: GoPtr<ModifierList>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList_5701af3c>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdatePropertySignatureDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<PropertySignatureDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdatePropertyDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateBinaryExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<BinaryExpression>, modifiers: GoPtr<ModifierList>, left: GoPtr<Expression_9ab73856>, typeNode: GoPtr<TypeNode>, operatorToken: GoPtr<BinaryOperatorToken>, right: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdatePrefixUnaryExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<PrefixUnaryExpression>, operator: Kind, operand: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdatePostfixUnaryExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<PostfixUnaryExpression>, operand: GoPtr<Expression_9ab73856>, operator: Kind): GoPtr<Node>;
export declare function NodeFactory_UpdatePropertyAccessExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<PropertyAccessExpression>, expression: GoPtr<Expression_9ab73856>, questionDotToken: GoPtr<QuestionDotToken>, name: GoPtr<MemberName>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateElementAccessExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ElementAccessExpression>, expression: GoPtr<Expression_9ab73856>, questionDotToken: GoPtr<QuestionDotToken>, argumentExpression: GoPtr<Expression_9ab73856>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateCallExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<CallExpression>, expression: GoPtr<Expression_9ab73856>, questionDotToken: GoPtr<QuestionDotToken>, typeArguments: GoPtr<TypeList>, argumentsNodes: GoPtr<ElementList>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateNewExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<NewExpression>, expression: GoPtr<Expression_9ab73856>, typeArguments: GoPtr<TypeList>, argumentsNodes: GoPtr<ElementList>): GoPtr<Node>;
export declare function NodeFactory_UpdateTaggedTemplateExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<TaggedTemplateExpression>, tag: GoPtr<Expression_9ab73856>, questionDotToken: GoPtr<QuestionDotToken>, typeArguments: GoPtr<TypeList>, template: GoPtr<TemplateLiteral>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateParenthesizedExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ParenthesizedExpression>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateJsxOpeningElement(receiver: GoPtr<NodeFactory>, node: GoPtr<JsxOpeningElement>, tagName: GoPtr<JsxTagNameExpression>, typeArguments: GoPtr<TypeList>, attributes: GoPtr<JsxAttributesNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateJsxSelfClosingElement(receiver: GoPtr<NodeFactory>, node: GoPtr<JsxSelfClosingElement>, tagName: GoPtr<JsxTagNameExpression>, typeArguments: GoPtr<TypeList>, attributes: GoPtr<JsxAttributesNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateArrayLiteralExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ArrayLiteralExpression>, elements: GoPtr<ElementList>, multiLine: bool): GoPtr<Node>;
export declare function NodeFactory_UpdateObjectLiteralExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ObjectLiteralExpression>, properties: GoPtr<NodeList>, multiLine: bool): GoPtr<Node>;
export declare function NodeFactory_UpdateSpreadAssignment(receiver: GoPtr<NodeFactory>, node: GoPtr<SpreadAssignment>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdatePropertyAssignment(receiver: GoPtr<NodeFactory>, node: GoPtr<PropertyAssignment>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateExpressionWithTypeArguments(receiver: GoPtr<NodeFactory>, node: GoPtr<ExpressionWithTypeArguments>, expression: GoPtr<Expression_9ab73856>, typeArguments: GoPtr<TypeList>): GoPtr<Node>;
export declare function NodeFactory_UpdateSpreadElement(receiver: GoPtr<NodeFactory>, node: GoPtr<SpreadElement>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateIfStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<IfStatement>, expression: GoPtr<Expression_9ab73856>, thenStatement: GoPtr<Statement>, elseStatement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateDoStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<DoStatement>, statement: GoPtr<Statement>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateWhileStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<WhileStatement>, expression: GoPtr<Expression_9ab73856>, statement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateForInOrOfStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<ForInOrOfStatement>, awaitModifier: GoPtr<AwaitKeyword>, initializer: GoPtr<ForInitializer>, expression: GoPtr<Expression_9ab73856>, statement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateWithStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<WithStatement>, expression: GoPtr<Expression_9ab73856>, statement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateSwitchStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<SwitchStatement>, expression: GoPtr<Expression_9ab73856>, caseBlock: GoPtr<CaseBlockNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateCaseOrDefaultClause(receiver: GoPtr<NodeFactory>, node: GoPtr<CaseOrDefaultClause>, expression: GoPtr<Expression_9ab73856>, statements: GoPtr<StatementList>): GoPtr<Node>;
export declare function NodeFactory_UpdateCatchClause(receiver: GoPtr<NodeFactory>, node: GoPtr<CatchClause>, variableDeclaration: GoPtr<VariableDeclarationNode>, block: GoPtr<BlockNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateLabeledStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<LabeledStatement>, label: GoPtr<IdentifierNode>, statement: GoPtr<Statement>): GoPtr<Node>;
export declare function NodeFactory_UpdateVariableStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<VariableStatement>, modifiers: GoPtr<ModifierList>, declarationList: GoPtr<VariableDeclarationListNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateVariableDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<VariableDeclaration>, name: GoPtr<BindingName>, exclamationToken: GoPtr<ExclamationToken>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateVariableDeclarationList(receiver: GoPtr<NodeFactory>, node: GoPtr<VariableDeclarationList>, declarations: GoPtr<VariableDeclarationNodeList>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateFunctionDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<FunctionDeclaration>, modifiers: GoPtr<ModifierList>, asteriskToken: GoPtr<AsteriskToken>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateInterfaceDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<InterfaceDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, heritageClauses: GoPtr<HeritageClauseList>, members: GoPtr<TypeElementList>): GoPtr<Node>;
export declare function NodeFactory_UpdateTypeAliasDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<TypeAliasDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateEnumDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<EnumDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<IdentifierNode>, members: GoPtr<EnumMemberList>): GoPtr<Node>;
export declare function NodeFactory_UpdateModuleDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ModuleDeclaration>, modifiers: GoPtr<ModifierList>, keyword: Kind, name: GoPtr<ModuleName>, body: GoPtr<ModuleBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateImportEqualsDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ImportEqualsDeclaration>, modifiers: GoPtr<ModifierList>, isTypeOnly: bool, name: GoPtr<IdentifierNode>, moduleReference: GoPtr<ModuleReference>): GoPtr<Node>;
export declare function NodeFactory_UpdateShorthandPropertyAssignment(receiver: GoPtr<NodeFactory>, node: GoPtr<ShorthandPropertyAssignment>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeNode: GoPtr<TypeNode>, equalsToken: GoPtr<EqualsToken>, objectAssignmentInitializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdatePartiallyEmittedExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<PartiallyEmittedExpression>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateAsExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<AsExpression>, expression: GoPtr<Expression_9ab73856>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateSatisfiesExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<SatisfiesExpression>, expression: GoPtr<Expression_9ab73856>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateConditionalExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<ConditionalExpression>, condition: GoPtr<Expression_9ab73856>, questionToken: GoPtr<QuestionToken>, whenTrue: GoPtr<Expression_9ab73856>, colonToken: GoPtr<ColonToken>, whenFalse: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateNonNullExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<NonNullExpression>, expression: GoPtr<Expression_9ab73856>, flags: NodeFlags): GoPtr<Node>;
export declare function NodeFactory_UpdateReturnStatement(receiver: GoPtr<NodeFactory>, node: GoPtr<ReturnStatement>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateYieldExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<YieldExpression>, asteriskToken: GoPtr<AsteriskToken>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateGetAccessorDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<GetAccessorDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateSetAccessorDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<SetAccessorDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateIndexSignatureDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<IndexSignatureDeclaration>, modifiers: GoPtr<ModifierList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateMethodSignatureDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<MethodSignatureDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateMethodDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<MethodDeclaration>, modifiers: GoPtr<ModifierList>, asteriskToken: GoPtr<AsteriskToken>, name: GoPtr<PropertyName>, postfixToken: GoPtr<TokenNode>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateArrowFunction(receiver: GoPtr<NodeFactory>, node: GoPtr<ArrowFunction>, modifiers: GoPtr<ModifierList>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, equalsGreaterThanToken: GoPtr<EqualsGreaterThanToken>, body: GoPtr<ConciseBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateFunctionExpression(receiver: GoPtr<NodeFactory>, node: GoPtr<FunctionExpression>, modifiers: GoPtr<ModifierList>, asteriskToken: GoPtr<AsteriskToken>, name: GoPtr<IdentifierNode>, typeParameters: GoPtr<TypeParameterList>, parameters: GoPtr<ParameterList>, typeNode: GoPtr<TypeNode>, fullSignature: GoPtr<TypeNode>, body: GoPtr<FunctionBody>): GoPtr<Node>;
export declare function NodeFactory_UpdateParameterDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ParameterDeclaration>, modifiers: GoPtr<ModifierList>, dotDotDotToken: GoPtr<DotDotDotToken>, name: GoPtr<BindingName>, questionToken: GoPtr<QuestionToken>, typeNode: GoPtr<TypeNode>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateBindingElement(receiver: GoPtr<NodeFactory>, node: GoPtr<BindingElement>, dotDotDotToken: GoPtr<DotDotDotToken>, propertyName: GoPtr<PropertyName>, name: GoPtr<BindingName>, initializer: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateExportAssignment(receiver: GoPtr<NodeFactory>, node: GoPtr<ExportAssignment>, modifiers: GoPtr<ModifierList>, isExportEquals: bool, typeNode: GoPtr<TypeNode>, expression: GoPtr<Expression_9ab73856>): GoPtr<Node>;
export declare function NodeFactory_UpdateImportDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ImportDeclaration>, modifiers: GoPtr<ModifierList>, importClause: GoPtr<ImportClauseNode>, moduleSpecifier: GoPtr<Expression_9ab73856>, attributes: GoPtr<ImportAttributesNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateExportDeclaration(receiver: GoPtr<NodeFactory>, node: GoPtr<ExportDeclaration>, modifiers: GoPtr<ModifierList>, isTypeOnly: bool, exportClause: GoPtr<NamedExportBindings>, moduleSpecifier: GoPtr<Expression_9ab73856>, attributes: GoPtr<ImportAttributesNode>): GoPtr<Node>;
export declare function NodeFactory_UpdateImportClause(receiver: GoPtr<NodeFactory>, node: GoPtr<ImportClause_58d51725>, phaseModifier: Kind, name: GoPtr<IdentifierNode>, namedBindings: GoPtr<NamedImportBindings>): GoPtr<Node>;
export declare function NodeFactory_UpdateNamedImports(receiver: GoPtr<NodeFactory>, node: GoPtr<NamedImports>, elements: GoPtr<ImportSpecifierList>): GoPtr<Node>;
export declare function NodeFactory_UpdateNamedExports(receiver: GoPtr<NodeFactory>, node: GoPtr<NamedExports>, elements: GoPtr<ExportSpecifierList>): GoPtr<Node>;
//# sourceMappingURL=ast.d.ts.map