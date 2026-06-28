import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { HasFileName, SourceFile } from "../../ast/ast.js";
import type { Node, NodeVisitor } from "../../ast/spine.js";
import type { BinaryExpression, Block, CallExpression, CaseBlock, CaseOrDefaultClause, CatchClause, ClassDeclaration, DoStatement, ExportAssignment, ExportDeclaration, ExpressionStatement, ForInOrOfStatement, ForStatement, FunctionDeclaration, IfStatement, ImportDeclaration, ImportEqualsDeclaration, LabeledStatement, ParenthesizedExpression, PartiallyEmittedExpression, PostfixUnaryExpression, PrefixUnaryExpression, PropertyAssignment, ShorthandPropertyAssignment, SpreadAssignment, SpreadElement, SwitchStatement, TaggedTemplateExpression, TryStatement, VariableDeclaration, VariableDeclarationList, VariableStatement, VoidExpression, WhileStatement, WithStatement } from "../../ast/generated/data.js";
import type { Declaration, Expression, IdentifierNode, ModuleExportName, Statement } from "../../ast/generated/unions.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { Set } from "../../collections/set.js";
import type { CompilerOptions, ModuleKind, ScriptTarget } from "../../core/compileroptions.js";
import type { TextRange } from "../../core/text.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import type { externalModuleInfo } from "./externalmoduleinfo.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::type::CommonJSModuleTransformer","kind":"type","status":"implemented","sigHash":"6d4c0901945b9e8638e5f6f227099900201a96ea3928cc98c41cdb0923078648","bodyHash":"e0eeaed36f030134bee4d976d10ead60bbddbba34241020f13ddb7378a7f29c4"}
 *
 * Go source:
 * CommonJSModuleTransformer struct {
 * 	transformers.Transformer
 * 	topLevelVisitor           *ast.NodeVisitor // visits statements at top level of a module
 * 	topLevelNestedVisitor     *ast.NodeVisitor // visits nested statements at top level of a module
 * 	discardedValueVisitor     *ast.NodeVisitor // visits expressions whose values would be discarded at runtime
 * 	assignmentPatternVisitor  *ast.NodeVisitor // visits assignment patterns in a destructuring assignment
 * 	compilerOptions           *core.CompilerOptions
 * 	resolver                  binder.ReferenceResolver
 * 	getEmitModuleFormatOfFile func(file ast.HasFileName) core.ModuleKind
 * 	moduleKind                core.ModuleKind
 * 	languageVersion           core.ScriptTarget
 * 	currentSourceFile         *ast.SourceFile
 * 	currentModuleInfo         *externalModuleInfo
 * 	parentNode                *ast.Node // used for ancestor tracking via pushNode/popNode to detect expression identifiers
 * 	currentNode               *ast.Node // used for ancestor tracking via pushNode/popNode to detect expression identifiers
 * }
 */
export interface CommonJSModuleTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    topLevelVisitor: GoPtr<NodeVisitor>;
    topLevelNestedVisitor: GoPtr<NodeVisitor>;
    discardedValueVisitor: GoPtr<NodeVisitor>;
    assignmentPatternVisitor: GoPtr<NodeVisitor>;
    compilerOptions: GoPtr<CompilerOptions>;
    resolver: ReferenceResolver;
    getEmitModuleFormatOfFile: (file: HasFileName) => ModuleKind;
    moduleKind: ModuleKind;
    languageVersion: ScriptTarget;
    currentSourceFile: GoPtr<SourceFile>;
    currentModuleInfo: GoPtr<externalModuleInfo>;
    parentNode: GoPtr<Node>;
    currentNode: GoPtr<Node>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::func::NewCommonJSModuleTransformer","kind":"func","status":"implemented","sigHash":"632f889e84474a37b13cf54af97ee34c2092af798bfed81d73ed2c9967119b2b","bodyHash":"807e3734c2fb13888541a8dd2c8d165bc1fd05269263a9508eb1733f5af1ab6a"}
 *
 * Go source:
 * func NewCommonJSModuleTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opts.CompilerOptions
 * 	emitContext := opts.Context
 * 	tx := &CommonJSModuleTransformer{compilerOptions: compilerOptions, resolver: opts.Resolver, getEmitModuleFormatOfFile: opts.GetEmitModuleFormatOfFile}
 * 	tx.topLevelVisitor = emitContext.NewNodeVisitor(tx.visitTopLevel)
 * 	tx.topLevelNestedVisitor = emitContext.NewNodeVisitor(tx.visitTopLevelNested)
 * 	tx.discardedValueVisitor = emitContext.NewNodeVisitor(tx.visitDiscardedValue)
 * 	tx.assignmentPatternVisitor = emitContext.NewNodeVisitor(tx.visitAssignmentPattern)
 * 	tx.languageVersion = compilerOptions.GetEmitScriptTarget()
 * 	tx.moduleKind = compilerOptions.GetEmitModuleKind()
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export declare function NewCommonJSModuleTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.pushNode","kind":"method","status":"implemented","sigHash":"52c6ddb1b68bf87c80488d5ea74c1c3616208245b2ace59ac78bb413ef42e514","bodyHash":"b5cb93ef696ec2f17164f11c27638594c3022ce5aecf3c2963785b11124b29f7"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export declare function CommonJSModuleTransformer_pushNode(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.popNode","kind":"method","status":"implemented","sigHash":"f8570ac4729da2089101a9082e5e3b22be66e8861d38b2d0be0ad46296a81ea4","bodyHash":"25f4196ebf13cd5266d68bf90cef9a2ffa3b9b57e208c015229b16e13cbacc08"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export declare function CommonJSModuleTransformer_popNode(receiver: GoPtr<CommonJSModuleTransformer>, grandparentNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevel","kind":"method","status":"implemented","sigHash":"59fd263b1f35f73cba38e443e97c5bbbd980a30520e2d35531a5c0d93a51cbf9","bodyHash":"25f8f3f8a726edd0b1540411513803e2b0a0deba67f60ead86f33a49ebacd88e"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevel(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	switch node.Kind {
 * 	case ast.KindImportDeclaration:
 * 		node = tx.visitTopLevelImportDeclaration(node.AsImportDeclaration())
 * 	case ast.KindImportEqualsDeclaration:
 * 		node = tx.visitTopLevelImportEqualsDeclaration(node.AsImportEqualsDeclaration())
 * 	case ast.KindExportDeclaration:
 * 		node = tx.visitTopLevelExportDeclaration(node.AsExportDeclaration())
 * 	case ast.KindExportAssignment:
 * 		node = tx.visitTopLevelExportAssignment(node.AsExportAssignment())
 * 	case ast.KindFunctionDeclaration:
 * 		node = tx.visitTopLevelFunctionDeclaration(node.AsFunctionDeclaration())
 * 	case ast.KindClassDeclaration:
 * 		node = tx.visitTopLevelClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindVariableStatement:
 * 		node = tx.visitTopLevelVariableStatement(node.AsVariableStatement())
 * 	default:
 * 		node = tx.visitTopLevelNestedNoStack(node)
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevel(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNested","kind":"method","status":"implemented","sigHash":"b8e821e682f2066833fd6066f7b3397b6542c453ef4dd2b4c3d0dd22eef8c654","bodyHash":"cc53ca116f8f50aff563ac6254b40830c07a967181a5bb2174f44de00b4321d5"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNested(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	return tx.visitTopLevelNestedNoStack(node)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNested(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedNoStack","kind":"method","status":"implemented","sigHash":"f958e2fec85bd486349c7485d0713fe49db9162c22b14ffe83b1f20c3931c010","bodyHash":"ff41309d2d85d495090fe016413775905a49b96084ab2332faf872ce6737c9b5"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedNoStack(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindVariableStatement:
 * 		node = tx.visitTopLevelVariableStatement(node.AsVariableStatement())
 * 	case ast.KindForStatement:
 * 		node = tx.visitTopLevelNestedForStatement(node.AsForStatement())
 * 	case ast.KindForInStatement, ast.KindForOfStatement:
 * 		node = tx.visitTopLevelNestedForInOrOfStatement(node.AsForInOrOfStatement())
 * 	case ast.KindDoStatement:
 * 		node = tx.visitTopLevelNestedDoStatement(node.AsDoStatement())
 * 	case ast.KindWhileStatement:
 * 		node = tx.visitTopLevelNestedWhileStatement(node.AsWhileStatement())
 * 	case ast.KindLabeledStatement:
 * 		node = tx.visitTopLevelNestedLabeledStatement(node.AsLabeledStatement())
 * 	case ast.KindWithStatement:
 * 		node = tx.visitTopLevelNestedWithStatement(node.AsWithStatement())
 * 	case ast.KindIfStatement:
 * 		node = tx.visitTopLevelNestedIfStatement(node.AsIfStatement())
 * 	case ast.KindSwitchStatement:
 * 		node = tx.visitTopLevelNestedSwitchStatement(node.AsSwitchStatement())
 * 	case ast.KindCaseBlock:
 * 		node = tx.visitTopLevelNestedCaseBlock(node.AsCaseBlock())
 * 	case ast.KindCaseClause, ast.KindDefaultClause:
 * 		node = tx.visitTopLevelNestedCaseOrDefaultClause(node.AsCaseOrDefaultClause())
 * 	case ast.KindTryStatement:
 * 		node = tx.visitTopLevelNestedTryStatement(node.AsTryStatement())
 * 	case ast.KindCatchClause:
 * 		node = tx.visitTopLevelNestedCatchClause(node.AsCatchClause())
 * 	case ast.KindBlock:
 * 		node = tx.visitTopLevelNestedBlock(node.AsBlock())
 * 	default:
 * 		node = tx.visitNoStack(node, false /*resultIsDiscarded* /)
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedNoStack(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visit","kind":"method","status":"implemented","sigHash":"eaef52a9188bdad117782da9eb2f2615e6990323b7deeb597e16b26e92d750ab","bodyHash":"9803b846057bdda509b5ea186925631f238e9149976029bb8da26ffac0550e98"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visit(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	return tx.visitNoStack(node, false /*resultIsDiscarded* /)
 * }
 */
export declare function CommonJSModuleTransformer_visit(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitNoStack","kind":"method","status":"implemented","sigHash":"3784a1a990ff90674d498e772080b7539ef874d53220a83171b673e2fdeb741c","bodyHash":"d97780b0a94ed50189c28d25de22ca487bcdb6f0c3fa1a14d5fbe6c709b34fb3"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitNoStack(node *ast.Node, resultIsDiscarded bool) *ast.Node {
 * 	// This visitor does not need to descend into the tree if there are no dynamic imports or identifiers in the subtree
 * 	if !ast.IsSourceFile(node) && node.SubtreeFacts()&(ast.SubtreeContainsDynamicImport|ast.SubtreeContainsIdentifier) == 0 {
 * 		return node
 * 	}
 *
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		node = tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindForStatement:
 * 		node = tx.visitForStatement(node.AsForStatement())
 * 	case ast.KindForInStatement, ast.KindForOfStatement:
 * 		node = tx.visitForInOrOfStatement(node.AsForInOrOfStatement())
 * 	case ast.KindExpressionStatement:
 * 		node = tx.visitExpressionStatement(node.AsExpressionStatement())
 * 	case ast.KindVoidExpression:
 * 		node = tx.visitVoidExpression(node.AsVoidExpression())
 * 	case ast.KindParenthesizedExpression:
 * 		node = tx.visitParenthesizedExpression(node.AsParenthesizedExpression(), resultIsDiscarded)
 * 	case ast.KindPartiallyEmittedExpression:
 * 		node = tx.visitPartiallyEmittedExpression(node.AsPartiallyEmittedExpression(), resultIsDiscarded)
 * 	case ast.KindCallExpression:
 * 		node = tx.visitCallExpression(node.AsCallExpression())
 * 	case ast.KindTaggedTemplateExpression:
 * 		node = tx.visitTaggedTemplateExpression(node.AsTaggedTemplateExpression())
 * 	case ast.KindBinaryExpression:
 * 		node = tx.visitBinaryExpression(node.AsBinaryExpression(), resultIsDiscarded)
 * 	case ast.KindPrefixUnaryExpression:
 * 		node = tx.visitPrefixUnaryExpression(node.AsPrefixUnaryExpression(), resultIsDiscarded)
 * 	case ast.KindPostfixUnaryExpression:
 * 		node = tx.visitPostfixUnaryExpression(node.AsPostfixUnaryExpression(), resultIsDiscarded)
 * 	case ast.KindShorthandPropertyAssignment:
 * 		node = tx.visitShorthandPropertyAssignment(node.AsShorthandPropertyAssignment())
 * 	case ast.KindIdentifier:
 * 		node = tx.visitIdentifier(node)
 * 	default:
 * 		node = tx.Visitor().VisitEachChild(node)
 * 	}
 *
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitNoStack(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitDiscardedValue","kind":"method","status":"implemented","sigHash":"ab67adfcf56cc3a226ce24043ffec9c851d5656a40bfe247a7b6fcb57a51a062","bodyHash":"0ed9fa2686eb3919656df6aca2af4d81993e5d0fa44ea08a2031a371df8713ee"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitDiscardedValue(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	return tx.visitNoStack(node, true /*resultIsDiscarded* /)
 * }
 */
export declare function CommonJSModuleTransformer_visitDiscardedValue(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentPattern","kind":"method","status":"implemented","sigHash":"64aa914c8b12d9cece3c2badf8f8ea191129379a747d211dcf85ae48ebb01398","bodyHash":"229b06429210d1d3a65adb37569b200eedfff09c770644aba3d6accec0c6a93a"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentPattern(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	return tx.visitAssignmentPatternNoStack(node)
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentPattern(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentPatternNoStack","kind":"method","status":"implemented","sigHash":"2f2612e24ec84df3a00f73ca5a8fdf297396c93f477879233798d3570429dbfd","bodyHash":"b45162c4f4e64bd5bb9c1c79cd16af8dae5fb1c3a7f1937ede4a904e34317fdc"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentPatternNoStack(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	// AssignmentPattern
 * 	case ast.KindObjectLiteralExpression, ast.KindArrayLiteralExpression:
 * 		node = tx.assignmentPatternVisitor.VisitEachChild(node)
 *
 * 	// AssignmentProperty
 * 	case ast.KindPropertyAssignment:
 * 		node = tx.visitAssignmentProperty(node.AsPropertyAssignment())
 * 	case ast.KindShorthandPropertyAssignment:
 * 		node = tx.visitShorthandAssignmentProperty(node.AsShorthandPropertyAssignment())
 *
 * 	// AssignmentRestProperty
 * 	case ast.KindSpreadAssignment:
 * 		node = tx.visitAssignmentRestProperty(node.AsSpreadAssignment())
 *
 * 	// AssignmentRestElement
 * 	case ast.KindSpreadElement:
 * 		node = tx.visitAssignmentRestElement(node.AsSpreadElement())
 *
 * 	// AssignmentElement
 * 	default:
 * 		if ast.IsExpression(node) {
 * 			node = tx.visitAssignmentElement(node)
 * 			break
 * 		}
 *
 * 		node = tx.visitNoStack(node, false /*resultIsDiscarded* /)
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentPatternNoStack(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"3f4e09887bc9830c8695830b5c575e16d5980ef9597c40204f9bec1db5416dfd","bodyHash":"537d9d7737682cd5f3159b93d9e2bda75b9938212f0ecdc6ea59b5b92bd3d549"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile ||
 * 		!(ast.IsEffectiveExternalModule(node, tx.compilerOptions) ||
 * 			node.SubtreeFacts()&ast.SubtreeContainsDynamicImport != 0) {
 * 		return node.AsNode()
 * 	}
 *
 * 	tx.currentSourceFile = node
 * 	tx.currentModuleInfo = collectExternalModuleInfo(node, tx.compilerOptions, tx.EmitContext(), tx.resolver)
 * 	updated := tx.transformCommonJSModule(node)
 * 	tx.currentSourceFile = nil
 * 	tx.currentModuleInfo = nil
 * 	return updated
 * }
 */
export declare function CommonJSModuleTransformer_visitSourceFile(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.shouldEmitUnderscoreUnderscoreESModule","kind":"method","status":"implemented","sigHash":"40a25537a03ad80d41492779056b66860eab323d1b214b0ccf180407d9219445","bodyHash":"747e64997af90311bcddcd784f0d35660226f4d6e4ce45323746e67553a186ef"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) shouldEmitUnderscoreUnderscoreESModule() bool {
 * 	if tspath.FileExtensionIsOneOf(tx.currentSourceFile.FileName(), tspath.SupportedJSExtensionsFlat) &&
 * 		tx.currentSourceFile.CommonJSModuleIndicator != nil &&
 * 		(tx.currentSourceFile.ExternalModuleIndicator == nil || tx.currentSourceFile.ExternalModuleIndicator.Kind == ast.KindSourceFile) {
 * 		return false
 * 	}
 * 	if tx.currentModuleInfo.exportEquals == nil && ast.IsExternalModule(tx.currentSourceFile) {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function CommonJSModuleTransformer_shouldEmitUnderscoreUnderscoreESModule(receiver: GoPtr<CommonJSModuleTransformer>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createUnderscoreUnderscoreESModule","kind":"method","status":"implemented","sigHash":"978526624f96af912542dba91dd2e5df2e0d3d359fc51f4f83bbff2d1f024d2b","bodyHash":"6cadc654b492fdd6b3b3e4ae6283339e1946f7688760042718d458a2c00efc86"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createUnderscoreUnderscoreESModule() *ast.Statement {
 * 	statement := tx.Factory().NewExpressionStatement(
 * 		tx.Factory().NewCallExpression(
 * 			tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("Object"),
 * 				nil, /*questionDotToken* /
 * 				tx.Factory().NewIdentifier("defineProperty"),
 * 				ast.NodeFlagsNone,
 * 			),
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Factory().NewNodeList([]*ast.Node{
 * 				tx.Factory().NewIdentifier("exports"),
 * 				tx.Factory().NewStringLiteral("__esModule", ast.TokenFlagsNone),
 * 				tx.Factory().NewObjectLiteralExpression(
 * 					tx.Factory().NewNodeList([]*ast.Node{
 * 						tx.Factory().NewPropertyAssignment(
 * 							nil, /*modifiers* /
 * 							tx.Factory().NewIdentifier("value"),
 * 							nil, /*postfixToken* /
 * 							nil, /*typeNode* /
 * 							tx.Factory().NewTrueExpression(),
 * 						),
 * 					}),
 * 					false, /*multiLine* /
 * 				),
 * 			}),
 * 			ast.NodeFlagsNone,
 * 		),
 * 	)
 * 	tx.EmitContext().SetEmitFlags(statement, printer.EFCustomPrologue)
 * 	return statement
 * }
 */
export declare function CommonJSModuleTransformer_createUnderscoreUnderscoreESModule(receiver: GoPtr<CommonJSModuleTransformer>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.transformCommonJSModule","kind":"method","status":"implemented","sigHash":"01428906557fa8f8071cae186c96e58678754ad31b5c71759c52418c9d620617","bodyHash":"7571a2cd16922eebb8a50a967e559d9461092d4d75b7cc4e6470c3124a261d97"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) transformCommonJSModule(node *ast.SourceFile) *ast.Node {
 * 	tx.EmitContext().StartVariableEnvironment()
 *
 * 	// emit standard prologue directives (e.g. "use strict")
 * 	prologue, rest := tx.Factory().SplitStandardPrologue(node.Statements.Nodes)
 * 	statements := slices.Clone(prologue)
 *
 * 	// emit custom prologues from other transformations
 * 	custom, rest := tx.Factory().SplitCustomPrologue(rest)
 * 	statements = append(statements, core.FirstResult(tx.topLevelVisitor.VisitSlice(custom))...)
 *
 * 	// emits `Object.defineProperty(exports, "__esModule", { value: true });` at the top of the file
 * 	if tx.shouldEmitUnderscoreUnderscoreESModule() {
 * 		statements = append(statements, tx.createUnderscoreUnderscoreESModule())
 * 	}
 *
 * 	// initialize all exports to `undefined`, e.g.:
 * 	//  exports.a = exports.b = void 0;
 * 	if len(tx.currentModuleInfo.exportedNames) > 0 {
 * 		const chunkSize = 50
 * 		l := len(tx.currentModuleInfo.exportedNames)
 * 		for i := 0; i < l; i += chunkSize {
 * 			right := tx.Factory().NewVoidZeroExpression()
 * 			for _, nextId := range tx.currentModuleInfo.exportedNames[i:min(i+chunkSize, l)] {
 * 				var left *ast.Expression
 * 				if nextId.Kind == ast.KindStringLiteral {
 * 					left = tx.Factory().NewElementAccessExpression(
 * 						tx.Factory().NewIdentifier("exports"),
 * 						nil, /*questionDotToken* /
 * 						tx.Factory().NewStringLiteralFromNode(nextId),
 * 						ast.NodeFlagsNone,
 * 					)
 * 				} else {
 * 					name := nextId.Clone(tx.Factory())
 * 					tx.EmitContext().SetEmitFlags(name, printer.EFNoSourceMap|printer.EFNoComments)
 * 					left = tx.Factory().NewPropertyAccessExpression(
 * 						tx.Factory().NewIdentifier("exports"),
 * 						nil, /*questionDotToken* /
 * 						name,
 * 						ast.NodeFlagsNone,
 * 					)
 * 				}
 * 				right = tx.Factory().NewAssignmentExpression(left, right)
 * 			}
 * 			statement := tx.Factory().NewExpressionStatement(right)
 * 			tx.EmitContext().AddEmitFlags(statement, printer.EFCustomPrologue)
 * 			statements = append(statements, statement)
 * 		}
 * 	}
 *
 * 	// initialize exports for function declarations, e.g.:
 * 	//  exports.f = f;
 * 	//  function f() {}
 * 	// These are marked as custom prologue so they are ordered before the external helpers
 * 	// import declaration (e.g., `const tslib_1 = require("tslib")`), matching TypeScript's emit order.
 * 	exportedFunctionsStart := len(statements)
 * 	for f := range tx.currentModuleInfo.exportedFunctions.Values() {
 * 		statements = tx.appendExportsOfClassOrFunctionDeclaration(statements, f.AsNode())
 * 	}
 * 	for _, s := range statements[exportedFunctionsStart:] {
 * 		tx.EmitContext().AddEmitFlags(s, printer.EFCustomPrologue)
 * 	}
 *
 * 	// visit the remaining statements in the source file
 * 	rest, _ = tx.topLevelVisitor.VisitSlice(rest)
 * 	statements = append(statements, rest...)
 *
 * 	// emit `module.exports = ...` if needd
 * 	statements = tx.appendExportEqualsIfNeeded(statements)
 *
 * 	// merge temp variables into the statement list
 * 	statements = tx.EmitContext().EndAndMergeVariableEnvironment(statements)
 *
 * 	statementList := tx.Factory().NewNodeList(statements)
 * 	statementList.Loc = node.Statements.Loc
 * 	result := tx.Factory().UpdateSourceFile(node, statementList, node.EndOfFileToken).AsSourceFile()
 * 	tx.EmitContext().AddEmitHelper(result.AsNode(), tx.EmitContext().ReadEmitHelpers()...)
 *
 * 	externalHelpersImportDeclaration := createExternalHelpersImportDeclarationIfNeeded(tx.EmitContext(), result, tx.compilerOptions, tx.getEmitModuleFormatOfFile(node), false /*hasExportStarsToExportValues* /, false /*hasImportStar* /, false /*hasImportDefault* /)
 * 	if externalHelpersImportDeclaration != nil {
 * 		prologue, rest := tx.Factory().SplitStandardPrologue(result.Statements.Nodes)
 * 		custom, rest := tx.Factory().SplitCustomPrologue(rest)
 * 		statements := slices.Clone(prologue)
 * 		statements = append(statements, custom...)
 * 		statements = append(statements, tx.topLevelVisitor.VisitNode(externalHelpersImportDeclaration))
 * 		statements = append(statements, rest...)
 * 		statementList := tx.Factory().NewNodeList(statements)
 * 		statementList.Loc = result.Statements.Loc
 * 		result = tx.Factory().UpdateSourceFile(result, statementList, node.EndOfFileToken).AsSourceFile()
 * 	}
 *
 * 	return result.AsNode()
 * }
 */
export declare function CommonJSModuleTransformer_transformCommonJSModule(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportEqualsIfNeeded","kind":"method","status":"implemented","sigHash":"ac3856b278d37ebe10b47a9dc29cb1d9efb3c0f1117247d997822f358d157127","bodyHash":"5fc337ce18b00b2ffff32a93a6b5013d06ea1645dcc720ef63d2509a38295a60"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportEqualsIfNeeded(statements []*ast.Statement) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil {
 * 		expressionResult := tx.visitExportEquals(tx.currentModuleInfo.exportEquals)
 * 		if expressionResult != nil {
 * 			statement := tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewAssignmentExpression(
 * 					tx.Factory().NewPropertyAccessExpression(
 * 						tx.Factory().NewIdentifier("module"),
 * 						nil, /*questionDotToken* /
 * 						tx.Factory().NewIdentifier("exports"),
 * 						ast.NodeFlagsNone,
 * 					),
 * 					expressionResult,
 * 				),
 * 			)
 *
 * 			tx.EmitContext().AssignCommentAndSourceMapRanges(statement, tx.currentModuleInfo.exportEquals.AsNode())
 * 			tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 			statements = append(statements, statement)
 * 		}
 * 	}
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportEqualsIfNeeded(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitExportEquals","kind":"method","status":"implemented","sigHash":"a42886e76297cee7598c1b41b297a9b00a475f7e0d0d1f99e52302130eb7390d","bodyHash":"5f65302112450be1f27924734d35233c54326e4ad09008c3c8bd728b78d22233"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitExportEquals(node *ast.ExportAssignment) *ast.Expression {
 * 	grandparentNode := tx.pushNode(node.AsNode())
 * 	defer tx.popNode(grandparentNode)
 * 	return tx.Visitor().VisitNode(node.Expression)
 * }
 */
export declare function CommonJSModuleTransformer_visitExportEquals(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfImportDeclaration","kind":"method","status":"implemented","sigHash":"144b9b8a59d92cb2078041cf61fc080fa57225c9b1073b8e8c43c38bbe9bfe09","bodyHash":"f6199d0c6d3646660fc7c7b88809103439c7e3899c00fda4ccf49b755d39f1aa"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfImportDeclaration(statements []*ast.Statement, decl *ast.ImportDeclaration) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil {
 * 		return statements
 * 	}
 *
 * 	importClause := decl.ImportClause
 * 	if importClause == nil {
 * 		return statements
 * 	}
 *
 * 	seen := &collections.Set[string]{}
 * 	if importClause.Name() != nil {
 * 		statements = tx.appendExportsOfDeclaration(statements, importClause, seen, false /*liveBinding* /)
 * 	}
 *
 * 	namedBindings := importClause.AsImportClause().NamedBindings
 * 	if namedBindings != nil {
 * 		switch namedBindings.Kind {
 * 		case ast.KindNamespaceImport:
 * 			statements = tx.appendExportsOfDeclaration(statements, namedBindings, seen, false /*liveBinding* /)
 *
 * 		case ast.KindNamedImports:
 * 			for _, importBinding := range namedBindings.Elements() {
 * 				statements = tx.appendExportsOfDeclaration(statements, importBinding, seen, true /*liveBinding* /)
 * 			}
 * 		}
 * 	}
 *
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfImportDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, decl: GoPtr<ImportDeclaration>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfVariableStatement","kind":"method","status":"implemented","sigHash":"f00b79906d296357cd0b115d7ab7d78dc89abfccc34c7aedee864377caa12716","bodyHash":"f82d8d88397ef61ebba919d9c92e7f61b313ece74c51cd1ee6feb550ce06201d"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfVariableStatement(statements []*ast.Statement, node *ast.VariableStatement) []*ast.Statement {
 * 	return tx.appendExportsOfVariableDeclarationList(statements, node.DeclarationList.AsVariableDeclarationList() /*isForInOrOfInitializer* /, false)
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfVariableStatement(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<VariableStatement>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfVariableDeclarationList","kind":"method","status":"implemented","sigHash":"66a0b4f4dffb5a1cdceab9999397a6ac09ed324b5446f63fc98abf886b341c41","bodyHash":"fc262d86dbec55af9c3a6d6df90f12091b02ff7fd335fa2d6d9a19d6ea2bc6ab"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfVariableDeclarationList(statements []*ast.Statement, node *ast.VariableDeclarationList, isForInOrOfInitializer bool) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil {
 * 		return statements
 * 	}
 *
 * 	for _, decl := range node.Declarations.Nodes {
 * 		statements = tx.appendExportsOfBindingElement(statements, decl, isForInOrOfInitializer)
 * 	}
 *
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfVariableDeclarationList(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<VariableDeclarationList>, isForInOrOfInitializer: bool): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfBindingElement","kind":"method","status":"implemented","sigHash":"c127fe1c3b8a4aef2bda22b27875580aa23729b9dc8f8a90fc26153fdbd872d2","bodyHash":"86be654ebb90ce235a82b715eacc860ef8d104fbe2ec728a4f2a19fbcc0a637f"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfBindingElement(statements []*ast.Statement, decl *ast.Node /*VariableDeclaration | BindingElement* /, isForInOrOfInitializer bool) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil || decl.Name() == nil {
 * 		return statements
 * 	}
 *
 * 	if ast.IsBindingPattern(decl.Name()) {
 * 		for _, element := range decl.Name().Elements() {
 * 			if !ast.IsOmittedExpression(element) {
 * 				statements = tx.appendExportsOfBindingElement(statements, element, isForInOrOfInitializer)
 * 			}
 * 		}
 * 	} else if !transformers.IsGeneratedIdentifier(tx.EmitContext(), decl.Name()) &&
 * 		(!ast.IsVariableDeclaration(decl) || decl.Initializer() != nil || isForInOrOfInitializer) {
 * 		statements = tx.appendExportsOfDeclaration(statements, decl, nil /*seen* /, false /*liveBinding* /)
 * 	}
 *
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfBindingElement(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, decl: GoPtr<Node>, isForInOrOfInitializer: bool): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfClassOrFunctionDeclaration","kind":"method","status":"implemented","sigHash":"d9e5b0050af5356d3ca9aef34aa63297df9a7cf7af0c8e6a649cf95718c4bb49","bodyHash":"1d2f202042728e0b2628baa793e1fe2c4ff5023a03dfb55ec2618b6a30d18496"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfClassOrFunctionDeclaration(statements []*ast.Statement, decl *ast.Declaration) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil {
 * 		return statements
 * 	}
 *
 * 	seen := &collections.Set[string]{}
 * 	if ast.HasSyntacticModifier(decl, ast.ModifierFlagsExport) {
 * 		var exportName *ast.IdentifierNode
 * 		if ast.HasSyntacticModifier(decl, ast.ModifierFlagsDefault) {
 * 			exportName = tx.Factory().NewIdentifier("default")
 * 		} else {
 * 			exportName = tx.Factory().GetDeclarationName(decl)
 * 		}
 *
 * 		exportValue := tx.Factory().GetLocalName(decl)
 * 		statements = tx.appendExportStatement(statements, seen, exportName, exportValue, &decl.Loc, false /*allowComments* /, false /*liveBinding* /)
 * 	}
 *
 * 	if decl.Name() != nil {
 * 		return tx.appendExportsOfDeclaration(statements, decl, seen, false /*liveBinding* /)
 * 	}
 *
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfClassOrFunctionDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, decl: GoPtr<Declaration>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportsOfDeclaration","kind":"method","status":"implemented","sigHash":"c946a9180e804d3ab5cc332648d9c384080a51a16ae36199b62e94d85e8f748f","bodyHash":"b7739f092738ee566c795913dfd9400f68b2a44d5070159f5fb4c49aef9249de"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportsOfDeclaration(statements []*ast.Statement, decl *ast.Declaration, seen *collections.Set[string], liveBinding bool) []*ast.Statement {
 * 	if tx.currentModuleInfo.exportEquals != nil {
 * 		return statements
 * 	}
 *
 * 	if seen == nil {
 * 		seen = &collections.Set[string]{}
 * 	}
 *
 * 	if name := decl.Name(); tx.currentModuleInfo.exportSpecifiers.Len() > 0 && name != nil && ast.IsIdentifier(name) {
 * 		name = tx.Factory().GetDeclarationName(decl)
 * 		exportSpecifiers := tx.currentModuleInfo.exportSpecifiers.Get(name.Text())
 * 		if len(exportSpecifiers) > 0 {
 * 			exportValue := tx.visitExpressionIdentifier(name)
 * 			for _, exportSpecifier := range exportSpecifiers {
 * 				statements = tx.appendExportStatement(statements, seen, exportSpecifier.Name(), exportValue, &exportSpecifier.Name().Loc /*location* /, false /*allowComments* /, liveBinding)
 * 			}
 * 		}
 * 	}
 *
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportsOfDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, decl: GoPtr<Declaration>, seen: GoPtr<Set<string>>, liveBinding: bool): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.appendExportStatement","kind":"method","status":"implemented","sigHash":"9330324b7ca26a97098d5c365a66a0da4cdb6169094c82528b77742aa8235ed3","bodyHash":"dbb909ba6c6962450d59013e574106c7f10531c4d8e53733d3a49e735a79a88d"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) appendExportStatement(statements []*ast.Statement, seen *collections.Set[string], exportName *ast.ModuleExportName, expression *ast.Expression, location *core.TextRange, allowComments bool, liveBinding bool) []*ast.Statement {
 * 	if exportName.Kind != ast.KindStringLiteral {
 * 		if seen.Has(exportName.Text()) {
 * 			return statements
 * 		}
 * 		seen.Add(exportName.Text())
 * 	}
 * 	statements = append(statements, tx.createExportStatement(exportName, expression, location, allowComments, liveBinding))
 * 	return statements
 * }
 */
export declare function CommonJSModuleTransformer_appendExportStatement(receiver: GoPtr<CommonJSModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, seen: GoPtr<Set<string>>, exportName: GoPtr<ModuleExportName>, expression: GoPtr<Expression>, location: GoPtr<TextRange>, allowComments: bool, liveBinding: bool): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createExportStatement","kind":"method","status":"implemented","sigHash":"9724eaf175199472ab36bddd05ee297ed394926cfa2aa4743509e9b30de261a4","bodyHash":"f082b0891b3ecb17d191f418a0ca521887271a6fe56611b9a6935f4c867d3970"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createExportStatement(name *ast.ModuleExportName, value *ast.Expression, location *core.TextRange, allowComments bool, liveBinding bool) *ast.Statement {
 * 	statement := tx.Factory().NewExpressionStatement(tx.createExportExpression(name, value, nil /*location* /, liveBinding))
 * 	if location != nil {
 * 		tx.EmitContext().SetCommentRange(statement, *location)
 * 	}
 * 	tx.EmitContext().AddEmitFlags(statement, printer.EFStartOnNewLine)
 * 	if !allowComments {
 * 		tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 	}
 * 	return statement
 * }
 */
export declare function CommonJSModuleTransformer_createExportStatement(receiver: GoPtr<CommonJSModuleTransformer>, name: GoPtr<ModuleExportName>, value: GoPtr<Expression>, location: GoPtr<TextRange>, allowComments: bool, liveBinding: bool): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createExportExpression","kind":"method","status":"implemented","sigHash":"525c18108219b6c130c6d2227e7a0e8d28c5561839a86a4192dbadb254ac8467","bodyHash":"342c900bd4dffa59ad3559612f0531a325e1987fc3116173c44bb4dec0b77143"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createExportExpression(name *ast.ModuleExportName, value *ast.Expression, location *core.TextRange, liveBinding bool) *ast.Expression {
 * 	var expression *ast.Expression
 * 	if liveBinding {
 * 		// For a live binding we emit a getter on `exports` that returns the value:
 * 		//  Object.defineProperty(exports, "<name>", { enumerable: true, get: function () { return <value>; } });
 * 		expression = tx.Factory().NewCallExpression(
 * 			tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("Object"),
 * 				nil, /*questionDotToken* /
 * 				tx.Factory().NewIdentifier("defineProperty"),
 * 				ast.NodeFlagsNone,
 * 			),
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Factory().NewNodeList([]*ast.Node{
 * 				tx.Factory().NewIdentifier("exports"),
 * 				tx.Factory().NewStringLiteralFromNode(name),
 * 				tx.Factory().NewObjectLiteralExpression(
 * 					tx.Factory().NewNodeList([]*ast.Node{
 * 						tx.Factory().NewPropertyAssignment(
 * 							nil, /*modifiers* /
 * 							tx.Factory().NewIdentifier("enumerable"),
 * 							nil, /*postfixToken* /
 * 							nil, /*typeNode* /
 * 							tx.Factory().NewTrueExpression(),
 * 						),
 * 						tx.Factory().NewPropertyAssignment(
 * 							nil, /*modifiers* /
 * 							tx.Factory().NewIdentifier("get"),
 * 							nil, /*postfixToken* /
 * 							nil, /*typeNode* /
 * 							tx.Factory().NewFunctionExpression(
 * 								nil, /*modifiers* /
 * 								nil, /*asteriskToken* /
 * 								nil, /*name* /
 * 								nil, /*typeParameters* /
 * 								tx.Factory().NewNodeList([]*ast.Node{}),
 * 								nil, /*type* /
 * 								nil, /*fullSignature* /
 * 								tx.Factory().NewBlock(
 * 									tx.Factory().NewNodeList([]*ast.Node{
 * 										tx.Factory().NewReturnStatement(value),
 * 									}),
 * 									false, /*multiLine* /
 * 								),
 * 							),
 * 						),
 * 					}),
 * 					false, /*multiLine* /
 * 				),
 * 			}),
 * 			ast.NodeFlagsNone,
 * 		)
 * 	} else {
 * 		// Otherwise, we emit a simple property assignment.
 * 		var left *ast.Expression
 * 		if name.Kind == ast.KindStringLiteral {
 * 			// emits:
 * 			//  exports["<name>"] = <value>;
 * 			left = tx.Factory().NewElementAccessExpression(
 * 				tx.Factory().NewIdentifier("exports"),
 * 				nil, /*questionDotToken* /
 * 				tx.Factory().NewStringLiteralFromNode(name),
 * 				ast.NodeFlagsNone,
 * 			)
 * 		} else {
 * 			// emits:
 * 			//  exports.<name> = <value>;
 * 			left = tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("exports"),
 * 				nil, /*questionDotToken* /
 * 				name.Clone(tx.Factory()),
 * 				ast.NodeFlagsNone,
 * 			)
 * 		}
 * 		expression = tx.Factory().NewAssignmentExpression(left, value)
 * 	}
 * 	if location != nil {
 * 		tx.EmitContext().SetCommentRange(expression, *location)
 * 	}
 * 	return expression
 * }
 */
export declare function CommonJSModuleTransformer_createExportExpression(receiver: GoPtr<CommonJSModuleTransformer>, name: GoPtr<ModuleExportName>, value: GoPtr<Expression>, location: GoPtr<TextRange>, liveBinding: bool): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createRequireCall","kind":"method","status":"implemented","sigHash":"1b07b57d3d763ea0f30a1fb704fb3cda2a0a95d978a9760c98eedd24590db84b","bodyHash":"340d3a13a83d6c009cc34b97d55c4d52e33fe8d5998aa68762d567d12679a051"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createRequireCall(node *ast.Node /*ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration* /) *ast.Node {
 * 	var args []*ast.Expression
 * 	moduleName := getExternalModuleNameLiteral(tx.Factory(), node, tx.currentSourceFile, nil /*host* /, nil /*resolver* /, tx.compilerOptions)
 * 	if moduleName != nil {
 * 		args = append(args, rewriteModuleSpecifier(tx.EmitContext(), moduleName, tx.compilerOptions))
 * 	}
 * 	return tx.Factory().NewCallExpression(
 * 		tx.Factory().NewIdentifier("require"),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		tx.Factory().NewNodeList(args),
 * 		ast.NodeFlagsNone)
 * }
 */
export declare function CommonJSModuleTransformer_createRequireCall(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.getHelperExpressionForExport","kind":"method","status":"implemented","sigHash":"f2c44e3e3aec1cfee468e7248d6edea35009460301a52e267e8d19d8886f4b6f","bodyHash":"ea5d476b611eb742847d770c3dced2e44b5813e1318530679c2fa6317618bca9"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) getHelperExpressionForExport(node *ast.ExportDeclaration, innerExpr *ast.Expression) *ast.Expression {
 * 	if getExportNeedsImportStarHelper(node) {
 * 		return tx.Visitor().VisitNode(tx.Factory().NewImportStarHelper(innerExpr))
 * 	}
 * 	return innerExpr
 * }
 */
export declare function CommonJSModuleTransformer_getHelperExpressionForExport(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ExportDeclaration>, innerExpr: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.getHelperExpressionForImport","kind":"method","status":"implemented","sigHash":"2ce1e3ebea538d85fcc6bf4df8d570a123ad75523fc7db3e6d8f107ffa3e12ff","bodyHash":"9e9761c3944ad4d4109599cd64a6b543fe5f7709114e30470b48028dacf8932c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) getHelperExpressionForImport(node *ast.ImportDeclaration, innerExpr *ast.Expression) *ast.Expression {
 * 	if getImportNeedsImportStarHelper(node) {
 * 		return tx.Visitor().VisitNode(tx.Factory().NewImportStarHelper(innerExpr))
 * 	}
 * 	if getImportNeedsImportDefaultHelper(node) {
 * 		return tx.Visitor().VisitNode(tx.Factory().NewImportDefaultHelper(innerExpr))
 * 	}
 * 	return innerExpr
 * }
 */
export declare function CommonJSModuleTransformer_getHelperExpressionForImport(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ImportDeclaration>, innerExpr: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelImportDeclaration","kind":"method","status":"implemented","sigHash":"727c427297512fa984f273f17b55934dc078501832364bea8de26e9f70b5ff50","bodyHash":"13d89de8f137452095b7bd5a819775b4a40e41d9b76045143329f9b3b7c43cde"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelImportDeclaration(node *ast.ImportDeclaration) *ast.Node {
 * 	if node.ImportClause == nil {
 * 		// import "mod";
 * 		statement := tx.Factory().NewExpressionStatement(tx.createRequireCall(node.AsNode()))
 * 		tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 		return statement
 * 	}
 *
 * 	var statements []*ast.Statement
 * 	var variables []*ast.VariableDeclarationNode
 * 	namespaceDeclaration := ast.GetNamespaceDeclarationNode(node.AsNode())
 * 	if namespaceDeclaration != nil && !ast.IsDefaultImport(node.AsNode()) {
 * 		// import * as n from "mod";
 * 		variables = append(variables,
 * 			tx.Factory().NewVariableDeclaration(
 * 				namespaceDeclaration.Name().Clone(tx.Factory()),
 * 				nil, /*exclamationToken* /
 * 				nil, /*type* /
 * 				tx.getHelperExpressionForImport(node, tx.createRequireCall(node.AsNode())),
 * 			),
 * 		)
 * 	} else {
 * 		// import d from "mod";
 * 		// import { x, y } from "mod";
 * 		// import d, { x, y } from "mod";
 * 		// import d, * as n from "mod";
 * 		variables = append(variables,
 * 			tx.Factory().NewVariableDeclaration(
 * 				tx.Factory().NewGeneratedNameForNode(node.AsNode()),
 * 				nil, /*exclamationToken* /
 * 				nil, /*type* /
 * 				tx.getHelperExpressionForImport(node, tx.createRequireCall(node.AsNode())),
 * 			),
 * 		)
 *
 * 		if namespaceDeclaration != nil && ast.IsDefaultImport(node.AsNode()) {
 * 			variables = append(variables,
 * 				tx.Factory().NewVariableDeclaration(
 * 					namespaceDeclaration.Name().Clone(tx.Factory()),
 * 					nil, /*exclamationToken* /
 * 					nil, /*type* /
 * 					tx.Factory().NewGeneratedNameForNode(node.AsNode()),
 * 				),
 * 			)
 * 		}
 * 	}
 *
 * 	varStatement := tx.Factory().NewVariableStatement(
 * 		nil, /*modifiers* /
 * 		tx.Factory().NewVariableDeclarationList(
 * 			tx.Factory().NewNodeList(variables),
 * 			ast.NodeFlagsConst,
 * 		),
 * 	)
 *
 * 	tx.EmitContext().SetOriginal(varStatement, node.AsNode())
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(varStatement, node.AsNode())
 * 	statements = append(statements, varStatement)
 * 	statements = tx.appendExportsOfImportDeclaration(statements, node)
 * 	return transformers.SingleOrMany(statements, tx.Factory())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelImportDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ImportDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"8efe95a803418788a5dcbe5906af9742d41d6951cb13e0fb8611abd00d00bc95","bodyHash":"763f085699cba44db7f992bc163a2f074f2ba0065ddb2fa3c62da63028286319"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) *ast.Node {
 * 	if !ast.IsExternalModuleImportEqualsDeclaration(node.AsNode()) {
 * 		// import m = n;
 * 		panic("import= for internal module references should be handled in an earlier transformer.")
 * 	}
 *
 * 	var statements []*ast.Statement
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		// export import m = require("mod");
 * 		statement := tx.Factory().NewExpressionStatement(
 * 			tx.createExportExpression(
 * 				node.Name(),
 * 				tx.createRequireCall(node.AsNode()),
 * 				&node.Loc,
 * 				false, /*liveBinding* /
 * 			),
 * 		)
 *
 * 		tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 		statements = append(statements, statement)
 * 	} else {
 * 		// import m = require("mod");
 * 		statement := tx.Factory().NewVariableStatement(
 * 			nil, /*modifiers* /
 * 			tx.Factory().NewVariableDeclarationList(
 * 				tx.Factory().NewNodeList([]*ast.VariableDeclarationNode{
 * 					tx.Factory().NewVariableDeclaration(
 * 						node.Name().Clone(tx.Factory()),
 * 						nil, /*exclamationToken* /
 * 						nil, /*typeNode* /
 * 						tx.createRequireCall(node.AsNode()),
 * 					),
 * 				}),
 * 				ast.NodeFlagsConst,
 * 			),
 * 		)
 * 		tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 		statements = append(statements, statement)
 * 	}
 *
 * 	statements = tx.appendExportsOfDeclaration(statements, node.AsNode(), nil /*seen* /, false /*liveBinding* /)
 * 	return transformers.SingleOrMany(statements, tx.Factory())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelImportEqualsDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ImportEqualsDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelExportDeclaration","kind":"method","status":"implemented","sigHash":"fdfebe3a88bb448d337734da3353ab512405e7fe7432673c461d7a65e23913c7","bodyHash":"fb4a1e3990403fe357a358602d5097a1641285b0f70adb5cc333e3d75fa3d61d"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelExportDeclaration(node *ast.ExportDeclaration) *ast.Node {
 * 	if node.ModuleSpecifier == nil {
 * 		// Elide export declarations with no module specifier as they are handled
 * 		// elsewhere.
 * 		return nil
 * 	}
 *
 * 	generatedName := tx.Factory().NewGeneratedNameForNode(node.AsNode())
 * 	if node.ExportClause != nil && ast.IsNamedExports(node.ExportClause) {
 * 		// export { x, y } from "mod";
 * 		var statements []*ast.Statement
 * 		varStatement := tx.Factory().NewVariableStatement(
 * 			nil, /*modifiers* /
 * 			tx.Factory().NewVariableDeclarationList(
 * 				tx.Factory().NewNodeList([]*ast.VariableDeclarationNode{
 * 					tx.Factory().NewVariableDeclaration(
 * 						generatedName,
 * 						nil, /*exclamationToken* /
 * 						nil, /*type* /
 * 						tx.createRequireCall(node.AsNode()),
 * 					),
 * 				}),
 * 				ast.NodeFlagsNone,
 * 			),
 * 		)
 * 		tx.EmitContext().SetOriginal(varStatement, node.AsNode())
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(varStatement, node.AsNode())
 * 		statements = append(statements, varStatement)
 *
 * 		for _, specifier := range node.ExportClause.Elements() {
 * 			specifierName := specifier.PropertyNameOrName()
 * 			exportNeedsImportDefault := ast.ModuleExportNameIsDefault(specifierName)
 *
 * 			var target *ast.Node
 * 			if exportNeedsImportDefault {
 * 				target = tx.Factory().NewImportDefaultHelper(generatedName)
 * 			} else {
 * 				target = generatedName
 * 			}
 *
 * 			var exportName *ast.Node
 * 			if ast.IsStringLiteral(specifier.Name()) {
 * 				exportName = tx.Factory().NewStringLiteralFromNode(specifier.Name())
 * 			} else {
 * 				exportName = tx.Factory().GetExportName(specifier.AsNode())
 * 			}
 *
 * 			var exportedValue *ast.Node
 * 			if ast.IsStringLiteral(specifierName) {
 * 				exportedValue = tx.Factory().NewElementAccessExpression(target, nil /*questionDotToken* /, specifierName, ast.NodeFlagsNone)
 * 			} else {
 * 				exportedValue = tx.Factory().NewPropertyAccessExpression(target, nil /*questionDotToken* /, specifierName, ast.NodeFlagsNone)
 * 			}
 * 			statement := tx.Factory().NewExpressionStatement(
 * 				tx.createExportExpression(
 * 					exportName,
 * 					exportedValue,
 * 					nil,  /*location* /
 * 					true, /*liveBinding* /
 * 				),
 * 			)
 * 			tx.EmitContext().SetOriginal(statement, specifier.AsNode())
 * 			tx.EmitContext().AssignCommentAndSourceMapRanges(statement, specifier.AsNode())
 * 			statements = append(statements, statement)
 * 		}
 *
 * 		return transformers.SingleOrMany(statements, tx.Factory())
 * 	}
 *
 * 	if node.ExportClause != nil {
 * 		// export * as ns from "mod";
 * 		// export * as default from "mod";
 * 		var exportName *ast.Node
 * 		if ast.IsStringLiteral(node.ExportClause.Name()) {
 * 			exportName = tx.Factory().NewStringLiteralFromNode(node.ExportClause.Name())
 * 		} else {
 * 			exportName = node.ExportClause.Name().Clone(tx.Factory())
 * 		}
 * 		statement := tx.Factory().NewExpressionStatement(
 * 			tx.createExportExpression(
 * 				exportName,
 * 				tx.getHelperExpressionForExport(
 * 					node,
 * 					tx.createRequireCall(node.AsNode()),
 * 				),
 * 				nil,   /*location* /
 * 				false, /*liveBinding* /
 * 			),
 * 		)
 * 		tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 		return statement
 * 	}
 *
 * 	// export * from "mod";
 * 	statement := tx.Factory().NewExpressionStatement(
 * 		tx.Visitor().VisitNode(tx.Factory().NewExportStarHelper(tx.createRequireCall(node.AsNode()), tx.Factory().NewIdentifier("exports"))),
 * 	)
 * 	tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 	return statement
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelExportDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ExportDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelExportAssignment","kind":"method","status":"implemented","sigHash":"0bc36049ab7c7f69b5984725b1066118de8f5618c8dd47016c8e8117d00bbb5e","bodyHash":"605bb1cdf6cccb225b17bbbb9311f4c189fc84bdf900ddf651909d0e681c9131"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelExportAssignment(node *ast.ExportAssignment) *ast.Node {
 * 	if node.IsExportEquals {
 * 		return nil
 * 	}
 *
 * 	return tx.createExportStatement(
 * 		tx.Factory().NewIdentifier("default"),
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		&node.Loc, /*location* /
 * 		true,      /*allowComments* /
 * 		false,     /*liveBinding* /
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelExportAssignment(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelFunctionDeclaration","kind":"method","status":"implemented","sigHash":"de1f742b46e9191f1ea4f977692958c63b4499a61f00662b9152f4a2c2b0afa9","bodyHash":"fdcdbf2e0ca135d35d9f507cfd600b7908e2011a2cb82ec2b26839d9c69f335c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelFunctionDeclaration(node *ast.FunctionDeclaration) *ast.Node {
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		return tx.Factory().UpdateFunctionDeclaration(
 * 			node,
 * 			transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), ^ast.ModifierFlagsExportDefault),
 * 			node.AsteriskToken,
 * 			tx.Factory().GetDeclarationName(node.AsNode()),
 * 			nil, /*typeParameters* /
 * 			tx.Visitor().VisitNodes(node.Parameters),
 * 			nil, /*type* /
 * 			nil, /*fullSignature* /
 * 			tx.Visitor().VisitNode(node.Body),
 * 		)
 * 	} else {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelFunctionDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<FunctionDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelClassDeclaration","kind":"method","status":"implemented","sigHash":"ce047fdd8c9d1a66249c19748b9a7ed52b86ac9de33c95e165f4f7bf98693352","bodyHash":"a572e71590e20f603d3eebdd74481caa16265568ca46b97ac07f20af18fb495b"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	var statements []*ast.Statement
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		statements = append(statements, tx.Factory().UpdateClassDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), ^ast.ModifierFlagsExportDefault)),
 * 			tx.Factory().GetDeclarationName(node.AsNode()),
 * 			nil, /*typeParameters* /
 * 			tx.Visitor().VisitNodes(node.HeritageClauses),
 * 			tx.Visitor().VisitNodes(node.Members),
 * 		))
 * 	} else {
 * 		statements = append(statements, tx.Visitor().VisitEachChild(node.AsNode()))
 * 	}
 * 	statements = tx.appendExportsOfClassOrFunctionDeclaration(statements, node.AsNode())
 * 	return transformers.SingleOrMany(statements, tx.Factory())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelClassDeclaration(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelVariableStatement","kind":"method","status":"implemented","sigHash":"a29bff1f93c9c07a6245772550ad5070a00163f12b909071c200969dc6db609f","bodyHash":"71c3fd54114af88b66e1ad76079edaea8bb83b37f5621c18ffb556ac8ff806c5"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	var statements []*ast.Statement
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		// export var a = b;
 * 		var variables []*ast.VariableDeclarationNode
 * 		var expressions []*ast.Expression
 * 		var modifiers *ast.ModifierList
 *
 * 		commitPendingVariables := func() {
 * 			if len(variables) > 0 {
 * 				variableList := tx.Factory().NewNodeList(variables)
 * 				statement := tx.Factory().UpdateVariableStatement(
 * 					node,
 * 					modifiers,
 * 					tx.Factory().UpdateVariableDeclarationList(
 * 						node.DeclarationList.AsVariableDeclarationList(),
 * 						variableList,
 * 						node.DeclarationList.Flags,
 * 					),
 * 				)
 * 				if len(statements) > 0 {
 * 					tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 				}
 * 				statements = append(statements, statement)
 * 				variables = nil
 * 			}
 * 		}
 *
 * 		commitPendingExpressions := func() {
 * 			if len(expressions) > 0 {
 * 				statement := tx.Factory().NewExpressionStatement(tx.Factory().InlineExpressions(expressions))
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(statement, node.AsNode())
 * 				if len(statements) > 0 {
 * 					tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 				}
 * 				statements = append(statements, statement)
 * 				expressions = nil
 * 			}
 * 		}
 *
 * 		pushVariable := func(variable *ast.VariableDeclarationNode) {
 * 			commitPendingExpressions()
 * 			variables = append(variables, variable)
 * 		}
 *
 * 		pushExpression := func(expression *ast.Expression) {
 * 			commitPendingVariables()
 * 			expressions = append(expressions, expression)
 * 		}
 *
 * 		// If we're exporting these variables, then these just become assignments to 'exports.x'.
 * 		for _, variable := range node.DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 			v := variable.AsVariableDeclaration()
 *
 * 			if ast.IsIdentifier(v.Name()) && transformers.IsLocalName(tx.EmitContext(), v.Name()) {
 * 				// A "local name" generally means a variable declaration that *shouldn't* be
 * 				// converted to `exports.x = ...`, even if the declaration is exported. This
 * 				// usually indicates a class or function declaration that was converted into
 * 				// a variable declaration, as most references to the declaration will remain
 * 				// untransformed (i.e., `new C` rather than `new exports.C`). In these cases,
 * 				// an `export { x }` declaration will follow.
 *
 * 				if modifiers == nil {
 * 					modifiers = transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), ^ast.ModifierFlagsExportDefault)
 * 				}
 *
 * 				if v.Initializer != nil {
 * 					variable = tx.Factory().UpdateVariableDeclaration(
 * 						v,
 * 						v.Name(),
 * 						nil, /*exclamationToken* /
 * 						nil, /*type* /
 * 						tx.createExportExpression(
 * 							v.Name(),
 * 							tx.Visitor().VisitNode(v.Initializer),
 * 							nil,
 * 							false, /*liveBinding* /
 * 						),
 * 					)
 * 				}
 *
 * 				pushVariable(variable)
 * 			} else if v.Initializer != nil && !ast.IsBindingPattern(v.Name()) && (ast.IsArrowFunction(v.Initializer) || ast.IsFunctionExpression(v.Initializer) || ast.IsClassExpression(v.Initializer)) {
 * 				// preserve variable declarations for functions and classes to assign names
 *
 * 				pushVariable(tx.Factory().NewVariableDeclaration(
 * 					v.Name(),
 * 					v.ExclamationToken,
 * 					v.Type,
 * 					tx.Visitor().VisitNode(v.Initializer),
 * 				))
 *
 * 				propertyAccess := tx.Factory().NewPropertyAccessExpression(
 * 					tx.Factory().NewIdentifier("exports"),
 * 					nil, /*questionDotToken* /
 * 					v.Name(),
 * 					ast.NodeFlagsNone,
 * 				)
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(propertyAccess, v.Name())
 *
 * 				pushExpression(tx.Factory().NewAssignmentExpression(
 * 					propertyAccess,
 * 					v.Name().Clone(tx.Factory()),
 * 				))
 * 			} else if ast.IsIdentifier(v.Name()) {
 * 				expression := tx.transformInitializedVariable(v)
 * 				if expression != nil {
 * 					pushExpression(tx.Visitor().VisitNode(expression))
 * 				}
 * 			} else if ast.IsBindingPattern(v.Name()) {
 * 				// For binding patterns with export modifier, use flattenDestructuringAssignment
 * 				// to decompose into individual export assignments
 * 				expression := tx.transformInitializedVariable(v)
 * 				if expression != nil {
 * 					pushExpression(expression)
 * 				}
 * 			} else {
 * 				// For binding patterns, we can't do exports.{pattern} = value
 * 				// Just emit the assignment and let appendExportsOfVariableStatement handle the exports
 * 				expression := transformers.ConvertVariableDeclarationToAssignmentExpression(tx.EmitContext(), v)
 * 				if expression != nil {
 * 					pushExpression(tx.Visitor().VisitNode(expression))
 * 				}
 * 			}
 * 		}
 *
 * 		commitPendingVariables()
 * 		commitPendingExpressions()
 * 		statements = tx.appendExportsOfVariableStatement(statements, node)
 * 		return transformers.SingleOrMany(statements, tx.Factory())
 * 	}
 * 	return tx.visitTopLevelNestedVariableStatement(node)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelVariableStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.transformInitializedVariable","kind":"method","status":"implemented","sigHash":"78eb78c1cdd835f3c0cb10f0e029f1cb6214f5b84486a1ef29b1f3f4a15bf6ec","bodyHash":"1bbbfa0fb36cc1f1fcaff7f32e8efd89bbf7d17dea09c76024e59a96d8629a77"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) transformInitializedVariable(node *ast.VariableDeclaration) *ast.Expression {
 * 	if node.Initializer == nil {
 * 		return nil
 * 	}
 * 	name := node.Name()
 * 	if ast.IsBindingPattern(name) {
 * 		// Convert the binding pattern into an equivalent assignment expression and visit it
 * 		// as a destructuring assignment. This preserves native destructuring (and therefore
 * 		// iterator semantics for array patterns) whenever each leaf identifier can be
 * 		// substituted to an export reference. Only when the destructuring would assign to
 * 		// re-aliased or multi-exported names (where native destructuring cannot update all
 * 		// targets) does `visitDestructuringAssignment` fall back to flattening.
 * 		assignment := transformers.ConvertVariableDeclarationToAssignmentExpression(tx.EmitContext(), node)
 * 		return tx.visitDestructuringAssignment(assignment.AsBinaryExpression(), true /*valueIsDiscarded* /)
 * 	}
 * 	propertyAccess := tx.Factory().NewPropertyAccessExpression(
 * 		tx.Factory().NewIdentifier("exports"),
 * 		nil, /*questionDotToken* /
 * 		name,
 * 		ast.NodeFlagsNone,
 * 	)
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(propertyAccess, name)
 * 	return tx.Factory().NewAssignmentExpression(propertyAccess, node.Initializer)
 * }
 */
export declare function CommonJSModuleTransformer_transformInitializedVariable(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedVariableStatement","kind":"method","status":"implemented","sigHash":"1a363a47920386cead9f0d57b2957b439fb6e35c573fe8d045714bd26f7cedf9","bodyHash":"cc1d544c444639fb5985e0e5424ba7f803be5a4b3f713759d29a05ec00f55919"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	var statements []*ast.Statement
 * 	statements = append(statements, tx.Visitor().VisitEachChild(node.AsNode()))
 * 	statements = tx.appendExportsOfVariableStatement(statements, node)
 * 	return transformers.SingleOrMany(statements, tx.Factory())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedVariableStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedForStatement","kind":"method","status":"implemented","sigHash":"e11fe067291537174074038cd2d5ecb433a475a49643a63b6c0f676b43d9de7b","bodyHash":"17d322823b747a6e1caf5224914176245b2f63e91ac2e1eff2e0b4b346e607de"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedForStatement(node *ast.ForStatement) *ast.Node {
 * 	if node.Initializer != nil && ast.IsVariableDeclarationList(node.Initializer) && node.Initializer.Flags&ast.NodeFlagsBlockScoped == 0 {
 * 		exportStatements := tx.appendExportsOfVariableDeclarationList(nil /*statements* /, node.Initializer.AsVariableDeclarationList(), false /*isForInOrOfInitializer* /)
 * 		if len(exportStatements) > 0 {
 * 			// given:
 * 			//   export { x }
 * 			//   for (var x = 0; ;) { }
 * 			// emits:
 * 			//   var x = 0;
 * 			//   exports.x = x;
 * 			//   for (; ;) { }
 *
 * 			var statements []*ast.Statement
 * 			varDeclList := tx.discardedValueVisitor.VisitNode(node.Initializer)
 * 			varStatement := tx.Factory().NewVariableStatement(nil /*modifiers* /, varDeclList)
 * 			statements = append(statements, varStatement)
 * 			statements = append(statements, exportStatements...)
 *
 * 			condition := tx.Visitor().VisitNode(node.Condition)
 * 			incrementor := tx.discardedValueVisitor.VisitNode(node.Incrementor)
 * 			body := tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor)
 * 			statements = append(statements, tx.Factory().UpdateForStatement(
 * 				node,
 * 				nil, /*initializer* /
 * 				condition,
 * 				incrementor,
 * 				body,
 * 			))
 * 			return transformers.SingleOrMany(statements, tx.Factory())
 * 		}
 * 	}
 * 	return tx.Factory().UpdateForStatement(
 * 		node,
 * 		tx.discardedValueVisitor.VisitNode(node.Initializer),
 * 		tx.Visitor().VisitNode(node.Condition),
 * 		tx.discardedValueVisitor.VisitNode(node.Incrementor),
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedForStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ForStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedForInOrOfStatement","kind":"method","status":"implemented","sigHash":"2d62dca89619ea627cf325e445abd410ca6379e554173c146849f780153ed365","bodyHash":"3153e801c264b7ee720fac8b0366723f7088405bb5c2ba56a3489af436ae4728"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedForInOrOfStatement(node *ast.ForInOrOfStatement) *ast.Node {
 * 	if ast.IsVariableDeclarationList(node.Initializer) && node.Initializer.Flags&ast.NodeFlagsBlockScoped == 0 {
 * 		exportStatements := tx.appendExportsOfVariableDeclarationList(nil /*statements* /, node.Initializer.AsVariableDeclarationList(), true /*isForInOrOfInitializer* /)
 * 		if len(exportStatements) > 0 {
 * 			// given:
 * 			//   export { x }
 * 			//   for (var x in y) {
 * 			//     ...
 * 			//   }
 * 			// emits:
 * 			//   for (var x in y) {
 * 			//     exports.x = x;
 * 			//     ...
 * 			//   }
 *
 * 			initializer := tx.discardedValueVisitor.VisitNode(node.Initializer)
 * 			expression := tx.Visitor().VisitNode(node.Expression)
 * 			body := tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor)
 * 			if ast.IsBlock(body) {
 * 				block := body.AsBlock()
 * 				bodyStatements := append(exportStatements, block.Statements.Nodes...)
 * 				bodyStatementList := tx.Factory().NewNodeList(bodyStatements)
 * 				bodyStatementList.Loc = block.Statements.Loc
 * 				body = tx.Factory().UpdateBlock(block, bodyStatementList, block.MultiLine)
 * 			} else {
 * 				bodyStatements := append(exportStatements, body)
 * 				body = tx.Factory().NewBlock(tx.Factory().NewNodeList(bodyStatements), true /*multiLine* /)
 * 			}
 * 			return tx.Factory().UpdateForInOrOfStatement(node, node.AwaitModifier, initializer, expression, body)
 * 		}
 * 	}
 * 	return tx.Factory().UpdateForInOrOfStatement(
 * 		node,
 * 		node.AwaitModifier,
 * 		tx.discardedValueVisitor.VisitNode(node.Initializer),
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedForInOrOfStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedDoStatement","kind":"method","status":"implemented","sigHash":"1a52fc21cd5ce909ac3ab23bc1e5abdfa2b87e2e9ddf3e2ff35339ab516fbacd","bodyHash":"4ee7d3c0d3b489ff733cc292f74e35a9d7189e333a9a2c5adcef7a8ab8c68808"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedDoStatement(node *ast.DoStatement) *ast.Node {
 * 	return tx.Factory().UpdateDoStatement(
 * 		node,
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 		tx.Visitor().VisitNode(node.Expression),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedDoStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<DoStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedWhileStatement","kind":"method","status":"implemented","sigHash":"40e2156ed78130149b6523f0763980721783bf2de23b444485afb6a3b4bd2da9","bodyHash":"b2f2910693e9c9a62091bd2fe534e04d48c1ca5383e0dda6bb1952808ec70704"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedWhileStatement(node *ast.WhileStatement) *ast.Node {
 * 	return tx.Factory().UpdateWhileStatement(
 * 		node,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedWhileStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<WhileStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedLabeledStatement","kind":"method","status":"implemented","sigHash":"5bc10d83027114b85d93f1452423f91dc7bcbd9cbc9be0bf8e1ba2d27f6f1b6a","bodyHash":"06669a1a51c62daa8a73b01c0cee971491651e683d1923c02d1b2fe352f9d028"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedLabeledStatement(node *ast.LabeledStatement) *ast.Node {
 * 	statement := tx.topLevelNestedVisitor.VisitEmbeddedStatement(node.Statement)
 * 	if statement == nil {
 * 		statement = tx.Factory().NewEmptyStatement()
 * 	}
 * 	return tx.Factory().UpdateLabeledStatement(node, node.Label, statement)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedLabeledStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<LabeledStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedWithStatement","kind":"method","status":"implemented","sigHash":"9c3410cb74cd179c7ac033a34b20d846a3da4272ecd4b80772c694aa17f7d3b0","bodyHash":"b475283f5d63df03124ebc6af55f85d419db38f35b73591ec83344ea2fdf6a0c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedWithStatement(node *ast.WithStatement) *ast.Node {
 * 	return tx.Factory().UpdateWithStatement(
 * 		node,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.topLevelNestedVisitor.VisitEmbeddedStatement(node.Statement),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedWithStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<WithStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedIfStatement","kind":"method","status":"implemented","sigHash":"9274818fdb55e5799f6d9f624a4d6d5bca70e339112f39f72800e749a9ba1e74","bodyHash":"255692db810da3db98ec30e1a4cce90f753078c7cea6d312b525af24f546e6ac"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedIfStatement(node *ast.IfStatement) *ast.Node {
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	thenStatement := tx.topLevelNestedVisitor.VisitEmbeddedStatement(node.ThenStatement)
 * 	if thenStatement == nil {
 * 		thenStatement = tx.Factory().NewBlock(tx.Factory().NewNodeList(nil), false /*multiLine* /)
 * 	}
 * 	elseStatement := tx.topLevelNestedVisitor.VisitEmbeddedStatement(node.ElseStatement)
 * 	return tx.Factory().UpdateIfStatement(node, expression, thenStatement, elseStatement)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedIfStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<IfStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedSwitchStatement","kind":"method","status":"implemented","sigHash":"5690037136edbf04fe9d590917deffe4d76ebd22fe9338b6c8ebe622ff3df814","bodyHash":"4871fa5cd22342494e45f13dd07545affd021919ed55edae51415278e73cd96d"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedSwitchStatement(node *ast.SwitchStatement) *ast.Node {
 * 	return tx.Factory().UpdateSwitchStatement(
 * 		node,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.topLevelNestedVisitor.VisitNode(node.CaseBlock),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedSwitchStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<SwitchStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedCaseBlock","kind":"method","status":"implemented","sigHash":"8d1144ae9b9882e5f1f24c82a4e565821fe4cf01969499ceb94137ab337ce803","bodyHash":"d30d9c7de117eb32386e9693c9431c1545685ad42ddd806547da930695db36fb"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedCaseBlock(node *ast.CaseBlock) *ast.Node {
 * 	return tx.topLevelNestedVisitor.VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedCaseBlock(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CaseBlock>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedCaseOrDefaultClause","kind":"method","status":"implemented","sigHash":"4f48c07d1c4f9c70d057607c2fa7ab3d741f3481e614ea38ccd62a06690e9e4e","bodyHash":"b2601e94979e5a08d7a15f0aba221cbd9afab9eb21b34ffbbbd163c7f14f4531"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedCaseOrDefaultClause(node *ast.CaseOrDefaultClause) *ast.Node {
 * 	return tx.Factory().UpdateCaseOrDefaultClause(
 * 		node,
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.topLevelNestedVisitor.VisitNodes(node.Statements),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedCaseOrDefaultClause(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CaseOrDefaultClause>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedTryStatement","kind":"method","status":"implemented","sigHash":"b2a286556dbef83a3bb26af004f6d39ba1c5228f9a2875905dd64d4718f3a188","bodyHash":"3018fd293aa755f84d43f299273fd37189e55147f967967ba86db5d747cb285a"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedTryStatement(node *ast.TryStatement) *ast.Node {
 * 	return tx.topLevelNestedVisitor.VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedTryStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<TryStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedCatchClause","kind":"method","status":"implemented","sigHash":"7c0ce1f0522e5dd82646a57e9dfb5edecef01686cbf47d79ecfb9b3b7ffbc558","bodyHash":"13f0328ebc8cfc2900c1e6ae8c2fb98ef3fabf4dfa66ab14859fa24c71315856"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedCatchClause(node *ast.CatchClause) *ast.Node {
 * 	return tx.Factory().UpdateCatchClause(
 * 		node,
 * 		node.VariableDeclaration,
 * 		tx.topLevelNestedVisitor.VisitNode(node.Block),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedCatchClause(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CatchClause>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTopLevelNestedBlock","kind":"method","status":"implemented","sigHash":"5ab40b31872c201cd4c5a187a04f9a0a1ec60cde40152659459e3ae3ca24155d","bodyHash":"53c738876f7055367b41589288a7802feec5151b3d7c2edfdd0c8242869d7599"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTopLevelNestedBlock(node *ast.Block) *ast.Node {
 * 	return tx.topLevelNestedVisitor.VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitTopLevelNestedBlock(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Block>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitForStatement","kind":"method","status":"implemented","sigHash":"4df9513ebbb9418bb32655184f34ff57355b332b1397a0752150de5326a7161a","bodyHash":"89bc826335cb09685c6cc347fe68ac311f91795f00f1db1f27826dcaff2b374b"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitForStatement(node *ast.ForStatement) *ast.Node {
 * 	return tx.Factory().UpdateForStatement(
 * 		node,
 * 		tx.discardedValueVisitor.VisitNode(node.Initializer),
 * 		tx.Visitor().VisitNode(node.Condition),
 * 		tx.discardedValueVisitor.VisitNode(node.Incrementor),
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitForStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ForStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitForInOrOfStatement","kind":"method","status":"implemented","sigHash":"f7138ab7d95abae13dacf66bdaac1c431e09d8d45e9927460354007f6a760c91","bodyHash":"d430bf88ca8f813a3c42326be7be33d033189246eb6c8a18b3cbc7c1285608d1"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitForInOrOfStatement(node *ast.ForInOrOfStatement) *ast.Node {
 * 	return tx.Factory().UpdateForInOrOfStatement(
 * 		node,
 * 		node.AwaitModifier,
 * 		tx.discardedValueVisitor.VisitNode(node.Initializer),
 * 		tx.Visitor().VisitNode(node.Expression),
 * 		tx.EmitContext().VisitIterationBody(node.Statement, tx.topLevelNestedVisitor),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitForInOrOfStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitExpressionStatement","kind":"method","status":"implemented","sigHash":"20e09d1699dc55ec9d8fd34a7555f8b885451e84152c6710ccd567ca2935b194","bodyHash":"7db14343cbb225156063f0d032163a474b5057d0e3c7a1c986779cd85c27dfa1"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitExpressionStatement(node *ast.ExpressionStatement) *ast.Node {
 * 	return tx.discardedValueVisitor.VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitExpressionStatement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ExpressionStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitVoidExpression","kind":"method","status":"implemented","sigHash":"94c63df2d9bfa43acd675ae4a08e32de6abac114cfd0887f3957e407abbeabc4","bodyHash":"95182af303d252acd4f02dd4ff6a416a0cf7fc55146c07ea083cb1a4e2334f8c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitVoidExpression(node *ast.VoidExpression) *ast.Node {
 * 	return tx.discardedValueVisitor.VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitVoidExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<VoidExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"cd60b5689766090e1c17c5a1ec727e684469909242db867d28116028266c7f77","bodyHash":"84e07e9e35fd99241e531cb083780b63a23428871e41812ec5fbe2b336e2846c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitParenthesizedExpression(node *ast.ParenthesizedExpression, resultIsDiscarded bool) *ast.Node {
 * 	expression := core.IfElse(resultIsDiscarded, tx.discardedValueVisitor, tx.Visitor()).VisitNode(node.Expression)
 * 	return tx.Factory().UpdateParenthesizedExpression(node, expression)
 * }
 */
export declare function CommonJSModuleTransformer_visitParenthesizedExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ParenthesizedExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitPartiallyEmittedExpression","kind":"method","status":"implemented","sigHash":"5c569e9e2f3c21578aa6fe1895c43064cc5312f395a849399528595055065035","bodyHash":"83bef4bd1816165c70c0f4c014ce6a82db27bfeac6768116e1ed595f950d2829"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitPartiallyEmittedExpression(node *ast.PartiallyEmittedExpression, resultIsDiscarded bool) *ast.Node {
 * 	expression := core.IfElse(resultIsDiscarded, tx.discardedValueVisitor, tx.Visitor()).VisitNode(node.Expression)
 * 	return tx.Factory().UpdatePartiallyEmittedExpression(node, expression)
 * }
 */
export declare function CommonJSModuleTransformer_visitPartiallyEmittedExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<PartiallyEmittedExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"f5c0156063fdd9afb250e6b8d7f76019e8acc2c9647f1159df7543eeedf2737c","bodyHash":"cf244677585c77433a0f3d90bc8ba995a8376ea7919021e767c789e02c93385e"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitBinaryExpression(node *ast.BinaryExpression, resultIsDiscarded bool) *ast.Node {
 * 	if ast.IsDestructuringAssignment(node.AsNode()) {
 * 		return tx.visitDestructuringAssignment(node, resultIsDiscarded)
 * 	}
 *
 * 	if ast.IsAssignmentExpression(node.AsNode(), false /*excludeCompoundAssignment* /) {
 * 		return tx.visitAssignmentExpression(node)
 * 	}
 *
 * 	if ast.IsCommaExpression(node.AsNode()) {
 * 		return tx.visitCommaExpression(node, resultIsDiscarded)
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitBinaryExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<BinaryExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentExpression","kind":"method","status":"implemented","sigHash":"f4b5a459376d3e4d78b75de87709f424a409c30e1f775c8bf361ce2ea24657db","bodyHash":"4d19b0b7301b30a970efcb7adc74b16024942b9015334e642f1b37e8e6bea7a8"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentExpression(node *ast.BinaryExpression) *ast.Node {
 * 	// When we see an assignment expression whose left-hand side is an exported symbol,
 * 	// we should ensure all exports of that symbol are updated with the correct value.
 * 	//
 * 	// - We do not transform generated identifiers unless they are file-level reserved names.
 * 	// - We do not transform identifiers tagged with the LocalName flag.
 * 	// - We only transform identifiers that are exported at the top level.
 * 	if ast.IsIdentifier(node.Left) &&
 * 		(!transformers.IsGeneratedIdentifier(tx.EmitContext(), node.Left) || isFileLevelReservedGeneratedIdentifier(tx.EmitContext(), node.Left)) &&
 * 		!transformers.IsLocalName(tx.EmitContext(), node.Left) {
 * 		exportedNames := tx.getExports(node.Left)
 * 		if len(exportedNames) > 0 {
 * 			// For each additional export of the declaration, apply an export assignment.
 * 			expression := tx.Visitor().VisitEachChild(node.AsNode())
 * 			for _, exportName := range exportedNames {
 * 				expression = tx.createExportExpression(exportName, expression, &node.Loc /*location* /, false /*liveBinding* /)
 * 			}
 * 			return expression
 * 		}
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitDestructuringAssignment","kind":"method","status":"implemented","sigHash":"c85f0fdd62fe6256735882d0c11757427073a58efff3ed3539acf5915c1e4966","bodyHash":"2d20b469b0c85335097a43c6a387072b0a8dd2abe6f8d94d1d67dde434f699c9"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitDestructuringAssignment(node *ast.BinaryExpression, valueIsDiscarded bool) *ast.Node {
 * 	if tx.destructuringNeedsFlattening(node.Left) {
 * 		return transformers.FlattenDestructuringAssignment(
 * 			&tx.Transformer,
 * 			node.AsNode(),
 * 			!valueIsDiscarded, /*needsValue* /
 * 			transformers.FlattenLevelAll,
 * 			tx.createAllExportExpressions,
 * 		)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitDestructuringAssignment(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<BinaryExpression>, valueIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.destructuringNeedsFlattening","kind":"method","status":"implemented","sigHash":"eed0d8a80cbac31da6548beea1813aaba3c53c8245df06a4c1a3d5a1cc06db9f","bodyHash":"f4e8340be77aef3a540af98bf22a52f0f01a21eb219d50d26ff8ff565e6a6c84"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) destructuringNeedsFlattening(node *ast.Node) bool {
 * 	if ast.IsObjectLiteralExpression(node) {
 * 		for _, elem := range node.Properties() {
 * 			switch elem.Kind {
 * 			case ast.KindPropertyAssignment:
 * 				if tx.destructuringNeedsFlattening(elem.Initializer()) {
 * 					return true
 * 				}
 * 			case ast.KindShorthandPropertyAssignment:
 * 				if tx.destructuringNeedsFlattening(elem.Name()) {
 * 					return true
 * 				}
 * 			case ast.KindSpreadAssignment:
 * 				if tx.destructuringNeedsFlattening(elem.Expression()) {
 * 					return true
 * 				}
 * 			case ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 				return false
 * 			}
 * 		}
 * 	} else if ast.IsArrayLiteralExpression(node) {
 * 		for _, elem := range node.AsArrayLiteralExpression().Elements.Nodes {
 * 			if ast.IsSpreadElement(elem) {
 * 				if tx.destructuringNeedsFlattening(elem.Expression()) {
 * 					return true
 * 				}
 * 			} else if tx.destructuringNeedsFlattening(elem) {
 * 				return true
 * 			}
 * 		}
 * 	} else if ast.IsIdentifier(node) {
 * 		exportedNames := tx.getExports(node)
 * 		if transformers.IsExportName(tx.EmitContext(), node) {
 * 			// The identifier is already wrapped to be an export reference; tolerate up to one
 * 			// matching export.
 * 			return len(exportedNames) > 1
 * 		}
 * 		if len(exportedNames) == 0 {
 * 			return false
 * 		}
 * 		// A single direct export whose export name matches the identifier text can be handled
 * 		// natively: substitution will rewrite the identifier to `exports.X`, so no flattening
 * 		// is needed. Re-aliased exports (where the export name differs from the local name) or
 * 		// multi-exported names cannot be expressed natively in a destructuring assignment.
 * 		if len(exportedNames) == 1 && tx.isDirectExport(node) && exportedNames[0].Text() == node.Text() {
 * 			return false
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function CommonJSModuleTransformer_destructuringNeedsFlattening(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createAllExportExpressions","kind":"method","status":"implemented","sigHash":"af9f96aa074eefbf95fb16a86a8f0d82e21b6ff518b7a4a49d8fc8542cb1b272","bodyHash":"824570576eb02c5291628d3b4ed3edd40ab27f0c5bd44c45214906b5102f6ad3"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createAllExportExpressions(name *ast.IdentifierNode, value *ast.Expression, location *core.TextRange) *ast.Expression {
 * 	exportedNames := tx.getExports(name)
 * 	if len(exportedNames) > 0 {
 * 		// If the name is directly exported (i.e., `export let x`), assign to exports.name directly.
 * 		// Otherwise, assign to the local binding first (i.e., `let x; export { x }`).
 * 		var expression *ast.Expression
 * 		if tx.isDirectExport(name) {
 * 			// Create exports.name = value to handle the direct export assignment,
 * 			// since the Go port doesn't have an onSubstituteNode mechanism to rewrite identifiers.
 * 			exportName := name.Clone(tx.Factory())
 * 			tx.EmitContext().AddEmitFlags(exportName, printer.EFNoComments|printer.EFNoSourceMap)
 * 			propertyAccess := tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("exports"),
 * 				nil, /*questionDotToken* /
 * 				exportName,
 * 				ast.NodeFlagsNone,
 * 			)
 * 			tx.EmitContext().AddEmitFlags(propertyAccess, printer.EFNoComments)
 * 			expression = tx.Factory().NewAssignmentExpression(propertyAccess, value)
 * 			tx.EmitContext().AssignCommentAndSourceMapRanges(expression, name)
 * 		} else {
 * 			expression = tx.Factory().NewAssignmentExpression(name, value)
 * 		}
 * 		for _, exportName := range exportedNames {
 * 			expression = tx.createExportExpression(exportName, expression, location, false /*liveBinding* /)
 * 		}
 * 		return expression
 * 	}
 * 	// If the identifier is directly exported but has no additional export aliases,
 * 	// still write to exports.name.
 * 	if tx.isDirectExport(name) {
 * 		exportName := name.Clone(tx.Factory())
 * 		tx.EmitContext().AddEmitFlags(exportName, printer.EFNoComments|printer.EFNoSourceMap)
 * 		propertyAccess := tx.Factory().NewPropertyAccessExpression(
 * 			tx.Factory().NewIdentifier("exports"),
 * 			nil, /*questionDotToken* /
 * 			exportName,
 * 			ast.NodeFlagsNone,
 * 		)
 * 		tx.EmitContext().AddEmitFlags(propertyAccess, printer.EFNoComments)
 * 		result := tx.Factory().NewAssignmentExpression(propertyAccess, value)
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(result, name)
 * 		return result
 * 	}
 * 	return tx.Factory().NewAssignmentExpression(name, value)
 * }
 */
export declare function CommonJSModuleTransformer_createAllExportExpressions(receiver: GoPtr<CommonJSModuleTransformer>, name: GoPtr<IdentifierNode>, value: GoPtr<Expression>, location: GoPtr<TextRange>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.isDirectExport","kind":"method","status":"implemented","sigHash":"5144d6a695c361c83c6ebff5a82968d5c27daf02d5546c124ecf02d544f20906","bodyHash":"01b62bd786c90da4e3ef250047affca91763a134d71d58c1e27ac4e471ba01bb"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) isDirectExport(name *ast.IdentifierNode) bool {
 * 	exportContainer := tx.resolver.GetReferencedExportContainer(tx.EmitContext().MostOriginal(name), false /*prefixLocals* /)
 * 	return exportContainer != nil && ast.IsSourceFile(exportContainer)
 * }
 */
export declare function CommonJSModuleTransformer_isDirectExport(receiver: GoPtr<CommonJSModuleTransformer>, name: GoPtr<IdentifierNode>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentProperty","kind":"method","status":"implemented","sigHash":"a9813cbc8a2e4d483da46a576162c3164fb354e2867e43e12681cfa44109013e","bodyHash":"44963748e6c3b674ce6cd3fc8563d7f39d047f912f2dbb09f7d5b0001495b9c7"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentProperty(node *ast.PropertyAssignment) *ast.Node {
 * 	return tx.Factory().UpdatePropertyAssignment(
 * 		node,
 * 		nil, /*modifiers* /
 * 		tx.Visitor().VisitNode(node.Name()),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		tx.assignmentPatternVisitor.VisitNode(node.Initializer),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentProperty(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<PropertyAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitShorthandAssignmentProperty","kind":"method","status":"implemented","sigHash":"f1fab4c9d293b81138bdb6770f7156083332665349883e0af7e42fe42c634da8","bodyHash":"e16246b3bac443abae173fca13701f4d0149fba6d1f9bea7c13a7980b2d6467f"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitShorthandAssignmentProperty(node *ast.ShorthandPropertyAssignment) *ast.Node {
 * 	target := tx.visitDestructuringAssignmentTargetNoStack(node.Name())
 * 	if ast.IsIdentifier(target) {
 * 		return tx.Factory().UpdateShorthandPropertyAssignment(
 * 			node,
 * 			nil, /*modifiers* /
 * 			target,
 * 			nil, /*postfixToken* /
 * 			nil, /*typeNode* /
 * 			node.EqualsToken,
 * 			tx.Visitor().VisitNode(node.ObjectAssignmentInitializer),
 * 		)
 * 	}
 * 	if node.ObjectAssignmentInitializer != nil {
 * 		equalsToken := node.EqualsToken
 * 		if equalsToken == nil {
 * 			equalsToken = tx.Factory().NewToken(ast.KindEqualsToken)
 * 		}
 * 		target = tx.Factory().NewBinaryExpression(
 * 			nil, /*modifiers* /
 * 			target,
 * 			nil, /*typeNode* /
 * 			equalsToken,
 * 			tx.Visitor().VisitNode(node.ObjectAssignmentInitializer),
 * 		)
 * 	}
 * 	updated := tx.Factory().NewPropertyAssignment(
 * 		nil, /*modifiers* /
 * 		node.Name(),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		target,
 * 	)
 * 	tx.EmitContext().SetOriginal(updated, node.AsNode())
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(updated, node.AsNode())
 * 	return updated
 * }
 */
export declare function CommonJSModuleTransformer_visitShorthandAssignmentProperty(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ShorthandPropertyAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentRestProperty","kind":"method","status":"implemented","sigHash":"03f2fcdd023a70936ca658338f86ff98a7113aebc9c8a903ea2514ec6b667ba4","bodyHash":"6ef63d664d379a7d95d090ca489a6718c5d2e6bb679aa06b80345c71a3bf4416"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentRestProperty(node *ast.SpreadAssignment) *ast.Node {
 * 	return tx.Factory().UpdateSpreadAssignment(
 * 		node,
 * 		tx.visitDestructuringAssignmentTarget(node.Expression),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentRestProperty(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<SpreadAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentRestElement","kind":"method","status":"implemented","sigHash":"d8497cbde4bb9a7c3db622398304e70d29bc3d2d622655bf785a465bc0f6a460","bodyHash":"63c6ab617562f8a7d89040f9dcc334a7c63b9f7eed8d98a8777c5c21848ff186"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentRestElement(node *ast.SpreadElement) *ast.Node {
 * 	return tx.Factory().UpdateSpreadElement(
 * 		node,
 * 		tx.visitDestructuringAssignmentTarget(node.Expression),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentRestElement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<SpreadElement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitAssignmentElement","kind":"method","status":"implemented","sigHash":"0e5945b78898fc076456bbc20c0fccb050df039db6bd6e3a03eb2e61ad26ed69","bodyHash":"f63bddbeb7e8b5a641f9cefdea33f448cb0f90b38b9a0018d9a2406d52f24a0b"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitAssignmentElement(node *ast.Node) *ast.Node {
 * 	if ast.IsBinaryExpression(node) {
 * 		n := node.AsBinaryExpression()
 * 		if n.OperatorToken.Kind == ast.KindEqualsToken {
 * 			return tx.Factory().UpdateBinaryExpression(
 * 				n,
 * 				nil, /*modifiers* /
 * 				tx.visitDestructuringAssignmentTarget(n.Left),
 * 				nil, /*typeNode* /
 * 				n.OperatorToken,
 * 				tx.Visitor().VisitNode(n.Right),
 * 			)
 * 		}
 * 	}
 *
 * 	return tx.visitDestructuringAssignmentTargetNoStack(node)
 * }
 */
export declare function CommonJSModuleTransformer_visitAssignmentElement(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitDestructuringAssignmentTarget","kind":"method","status":"implemented","sigHash":"98dba6c5b0baaf6285c123643cfe898ee516cd4bb757bd972294ca5b30f2371b","bodyHash":"87653f4dcb7582fbf39bff06e2e1a0950c9af48dcc9aa6c0734c58bb4c871db1"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitDestructuringAssignmentTarget(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	switch node.Kind {
 * 	case ast.KindObjectLiteralExpression, ast.KindArrayLiteralExpression:
 * 		node = tx.visitAssignmentPatternNoStack(node)
 * 	default:
 * 		node = tx.visitDestructuringAssignmentTargetNoStack(node)
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitDestructuringAssignmentTarget(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitDestructuringAssignmentTargetNoStack","kind":"method","status":"implemented","sigHash":"ceb44a68d1ba7b2da06d6bd94c523dd8d5579a9a22ca36ce30da47edc6d7cd60","bodyHash":"43cd266e5e6c444a27ba74e44abb7181863bedcd1bba5a38d58dca45b1fdc666"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitDestructuringAssignmentTargetNoStack(node *ast.Node) *ast.Node {
 * 	if ast.IsIdentifier(node) &&
 * 		(!transformers.IsGeneratedIdentifier(tx.EmitContext(), node) || isFileLevelReservedGeneratedIdentifier(tx.EmitContext(), node)) &&
 * 		!transformers.IsLocalName(tx.EmitContext(), node) {
 * 		expression := tx.visitExpressionIdentifier(node)
 * 		exportedNames := tx.getExports(node)
 * 		if len(exportedNames) > 0 {
 * 			// transforms:
 * 			//  var x;
 * 			//  export { x }
 * 			//  { x: x } = y
 * 			// to:
 * 			//  { x: { set value(v) { exports.x = x = v; } }.value } = y
 *
 * 			value := tx.Factory().NewUniqueNameEx("value", printer.AutoGenerateOptions{
 * 				Flags: printer.GeneratedIdentifierFlagsOptimistic,
 * 			})
 * 			expression = tx.Factory().NewAssignmentExpression(expression, value)
 *
 * 			for _, exportName := range exportedNames {
 * 				expression = tx.createExportExpression(exportName, expression, nil /*location* /, false /*liveBinding* /)
 * 			}
 *
 * 			statement := tx.Factory().NewExpressionStatement(expression)
 * 			statementList := tx.Factory().NewNodeList([]*ast.Node{statement})
 * 			param := tx.Factory().NewParameterDeclaration(
 * 				nil, /*modifiers* /
 * 				nil, /*dotDotDotToken* /
 * 				value,
 * 				nil, /*questionToken* /
 * 				nil, /*type* /
 * 				nil, /*initializer* /
 * 			)
 * 			valueSetter := tx.Factory().NewSetAccessorDeclaration(
 * 				nil, /*modifiers* /
 * 				tx.Factory().NewIdentifier("value"),
 * 				nil, /*typeParameters* /
 * 				tx.Factory().NewNodeList([]*ast.Node{param}),
 * 				nil, /*returnType* /
 * 				nil, /*fullSignature* /
 * 				tx.Factory().NewBlock(statementList, false /*multiLine* /),
 * 			)
 * 			propertyList := tx.Factory().NewNodeList([]*ast.Node{valueSetter})
 * 			expression = tx.Factory().NewObjectLiteralExpression(propertyList, false /*multiLine* /)
 * 			expression = tx.Factory().NewPropertyAccessExpression(expression, nil /*questionDotToken* /, tx.Factory().NewIdentifier("value"), ast.NodeFlagsNone)
 * 		}
 * 		return expression
 * 	}
 *
 * 	return tx.visitNoStack(node, false /*resultIsDiscarded* /)
 * }
 */
export declare function CommonJSModuleTransformer_visitDestructuringAssignmentTargetNoStack(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitCommaExpression","kind":"method","status":"implemented","sigHash":"06435417edd8dd54849bef70ac07a19799c0b23181fa72607e70ed06cd377980","bodyHash":"5e26d57484319ff35b8b076d8de3bb87e28afed5750917b0ddebadc58d27d4c0"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitCommaExpression(node *ast.BinaryExpression, resultIsDiscarded bool) *ast.Node {
 * 	left := tx.discardedValueVisitor.VisitNode(node.Left)
 * 	right := core.IfElse(resultIsDiscarded, tx.discardedValueVisitor, tx.Visitor()).VisitNode(node.Right)
 * 	return tx.Factory().UpdateBinaryExpression(node, nil /*modifiers* /, left, nil /*typeNode* /, node.OperatorToken, right)
 * }
 */
export declare function CommonJSModuleTransformer_visitCommaExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<BinaryExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitPrefixUnaryExpression","kind":"method","status":"implemented","sigHash":"44c4626c1ccf5e2a12515ddef537c3956297ab0db487c1158fc6753aaf09550b","bodyHash":"703e9830960edc2527ee2c987b27a80c0f6fc90cc5b0e8875c3f6ea381a70c6d"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitPrefixUnaryExpression(node *ast.PrefixUnaryExpression, resultIsDiscarded bool) *ast.Node {
 * 	// When we see a prefix increment expression whose operand is an exported
 * 	// symbol, we should ensure all exports of that symbol are updated with the correct
 * 	// value.
 * 	//
 * 	// - We do not transform generated identifiers for any reason.
 * 	// - We do not transform identifiers tagged with the LocalName flag.
 * 	// - We do not transform identifiers that were originally the name of an enum or
 * 	//   namespace due to how they are transformed in TypeScript.
 * 	// - We only transform identifiers that are exported at the top level.
 * 	if (node.Operator == ast.KindPlusPlusToken || node.Operator == ast.KindMinusMinusToken) &&
 * 		ast.IsIdentifier(node.Operand) &&
 * 		!transformers.IsLocalName(tx.EmitContext(), node.Operand) {
 * 		exportedNames := tx.getExports(node.Operand)
 * 		if len(exportedNames) > 0 {
 * 			// given:
 * 			//   var x = 0;
 * 			//   export { x }
 * 			//   ++x;
 * 			// emits:
 * 			//   var x = 0;
 * 			//   exports.x = x;
 * 			//   exports.x = ++x;
 * 			// note:
 * 			//   after the operation, `exports.x` will hold the value of `x` after the increment.
 *
 * 			expression := tx.Factory().UpdatePrefixUnaryExpression(node, node.Operator, tx.Visitor().VisitNode(node.Operand))
 * 			for _, exportName := range exportedNames {
 * 				expression = tx.createExportExpression(exportName, expression, nil /*location* /, false /*liveBinding* /)
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(expression, node.AsNode())
 * 			}
 * 			return expression
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitPrefixUnaryExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<PrefixUnaryExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitPostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"fa2d1663c3cdcbc47cae86b3201ba29bea58c6461e7479e1a08b9f93d0021bc7","bodyHash":"b411efb137006917b8262fa53f2e9de849f283fb09ffed463aa023ffb7b90d37"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitPostfixUnaryExpression(node *ast.PostfixUnaryExpression, resultIsDiscarded bool) *ast.Node {
 * 	// When we see a postfix increment expression whose operand is an exported
 * 	// symbol, we should ensure all exports of that symbol are updated with the correct
 * 	// value.
 * 	//
 * 	// - We do not transform generated identifiers for any reason.
 * 	// - We do not transform identifiers tagged with the LocalName flag.
 * 	// - We do not transform identifiers that were originally the name of an enum or
 * 	//   namespace due to how they are transformed in TypeScript.
 * 	// - We only transform identifiers that are exported at the top level.
 * 	if (node.Operator == ast.KindPlusPlusToken || node.Operator == ast.KindMinusMinusToken) &&
 * 		ast.IsIdentifier(node.Operand) &&
 * 		!transformers.IsLocalName(tx.EmitContext(), node.Operand) {
 * 		exportedNames := tx.getExports(node.Operand)
 * 		if len(exportedNames) > 0 {
 * 			// given (value is discarded):
 * 			//   var x = 0;
 * 			//   export { x }
 * 			//   x++;
 * 			// emits:
 * 			//   var x = 0, y;
 * 			//   exports.x = x;
 * 			//   exports.x = (x++, x);
 * 			// note:
 * 			//   after the operation, `exports.x` will hold the value of `x` after the increment.
 * 			//
 * 			// given (value is not discarded):
 * 			//   var x = 0, y;
 * 			//   export { x }
 * 			//   y = x++;
 * 			// emits:
 * 			//   var _a;
 * 			//   var x = 0, y;
 * 			//   exports.x = x;
 * 			//   y = (exports.x = (_a = x++, x), _a);
 * 			// note:
 * 			//   after the operation, `exports.x` will hold the value of `x` after the increment, while
 * 			//   `y` will hold the value of `x` before the increment.
 *
 * 			var temp *ast.IdentifierNode
 * 			expression := tx.Factory().UpdatePostfixUnaryExpression(node, tx.Visitor().VisitNode(node.Operand), node.Operator)
 * 			if !resultIsDiscarded {
 * 				temp = tx.Factory().NewTempVariable()
 * 				tx.EmitContext().AddVariableDeclaration(temp)
 *
 * 				expression = tx.Factory().NewAssignmentExpression(temp, expression)
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(expression, node.AsNode())
 * 			}
 *
 * 			expression = tx.Factory().NewCommaExpression(expression, node.Operand.Clone(tx.Factory()))
 * 			tx.EmitContext().AssignCommentAndSourceMapRanges(expression, node.AsNode())
 *
 * 			for _, exportName := range exportedNames {
 * 				expression = tx.createExportExpression(exportName, expression, nil /*location* /, false /*liveBinding* /)
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(expression, node.AsNode())
 * 			}
 *
 * 			if temp != nil {
 * 				expression = tx.Factory().NewCommaExpression(expression, temp.AsNode())
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(expression, node.AsNode())
 * 			}
 *
 * 			return expression
 * 		}
 * 	}
 *
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitPostfixUnaryExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<PostfixUnaryExpression>, resultIsDiscarded: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"20118c281a35afab38890a291dc5b7b3431a7d12e4ca6377e0d2e67b9529c6b2","bodyHash":"bc2124cae19d19c5baeb151a14019c22d3583fcb59febfa4e3e0c72bfa61e446"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitCallExpression(node *ast.CallExpression) *ast.Node {
 * 	needsRewrite := false
 * 	if tx.compilerOptions.RewriteRelativeImportExtensions.IsTrue() {
 * 		if ast.IsImportCall(node.AsNode()) && len(node.Arguments.Nodes) > 0 ||
 * 			ast.IsInJSFile(node.AsNode()) && ast.IsRequireCall(node.AsNode(), false /*requireStringLiteralLikeArgument* /) {
 * 			needsRewrite = true
 * 		}
 * 	}
 * 	if ast.IsImportCall(node.AsNode()) && tx.shouldTransformImportCall() {
 * 		return tx.visitImportCallExpression(node, needsRewrite)
 * 	}
 * 	if needsRewrite {
 * 		return tx.shimOrRewriteImportOrRequireCall(node.AsCallExpression())
 * 	}
 * 	if ast.IsIdentifier(node.Expression) {
 * 		// given:
 * 		//   import { f } from "mod";
 * 		//   f();
 * 		// emits:
 * 		//   const mod_1 = require("mod");
 * 		//   (0, mod_1.f)();
 * 		// note:
 * 		//   the indirect call is applied by the printer by way of the `EFIndirectCall` emit flag.
 * 		expression := tx.visitExpressionIdentifier(node.Expression)
 * 		updated := tx.Factory().UpdateCallExpression(
 * 			node,
 * 			expression,
 * 			node.QuestionDotToken,
 * 			nil, /*typeArguments* /
 * 			tx.Visitor().VisitNodes(node.Arguments),
 * 			node.Flags,
 * 		)
 * 		if !ast.IsIdentifier(expression) && !transformers.IsHelperName(tx.EmitContext(), node.Expression) {
 * 			tx.EmitContext().AddEmitFlags(updated, printer.EFIndirectCall)
 * 		}
 * 		return updated
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitCallExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.shouldTransformImportCall","kind":"method","status":"implemented","sigHash":"284051ca1c178f531186b1db86d14cdec447b153d7665a0845f0b045f1a59f12","bodyHash":"07b02d0147a55c838e4ec857edf85f0758ff9a14d36e0d167b06a22d4ba60aa3"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) shouldTransformImportCall() bool {
 * 	return ast.ShouldTransformImportCall(tx.currentSourceFile.FileName(), tx.compilerOptions, tx.getEmitModuleFormatOfFile(tx.currentSourceFile))
 * }
 */
export declare function CommonJSModuleTransformer_shouldTransformImportCall(receiver: GoPtr<CommonJSModuleTransformer>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitImportCallExpression","kind":"method","status":"implemented","sigHash":"9fe9fd62e26001e71284a9a1a0fa49470f5c1cd349b45d59b591a98105ec87e6","bodyHash":"cc64c3a2de6c056e355a5dd266c8ccf0bb39816a6b64df9472e5a5a2ec118d6c"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitImportCallExpression(node *ast.CallExpression, rewriteOrShim bool) *ast.Node {
 * 	if tx.moduleKind == core.ModuleKindNone && tx.languageVersion >= core.ScriptTargetES2020 {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	externalModuleName := getExternalModuleNameLiteral(tx.Factory(), node.AsNode(), tx.currentSourceFile, nil /*host* /, nil /*resolver* /, tx.compilerOptions)
 * 	firstArgument := tx.Visitor().VisitNode(core.FirstOrNil(node.Arguments.Nodes))
 *
 * 	// Only use the external module name if it differs from the first argument. This allows us to preserve the quote style of the argument on output.
 * 	var argument *ast.Expression
 * 	if externalModuleName != nil && (firstArgument == nil || !ast.IsStringLiteral(firstArgument) || firstArgument.Text() != externalModuleName.Text()) {
 * 		argument = externalModuleName
 * 	} else if firstArgument != nil && rewriteOrShim {
 * 		if ast.IsStringLiteral(firstArgument) {
 * 			argument = rewriteModuleSpecifier(tx.EmitContext(), firstArgument, tx.compilerOptions)
 * 		} else {
 * 			argument = tx.Factory().NewRewriteRelativeImportExtensionsHelper(firstArgument, tx.compilerOptions.Jsx == core.JsxEmitPreserve)
 * 		}
 * 	} else {
 * 		argument = firstArgument
 * 	}
 * 	return tx.createImportCallExpressionCommonJS(argument)
 * }
 */
export declare function CommonJSModuleTransformer_visitImportCallExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CallExpression>, rewriteOrShim: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.createImportCallExpressionCommonJS","kind":"method","status":"implemented","sigHash":"866b1ace8f07ae83cfa328d7c43e63151a6ea678c4ee55947f21dd3bb4097ebc","bodyHash":"35d335f954d3067403672277b3ebd52f618699e919e43de059b34cd6891c7373"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) createImportCallExpressionCommonJS(arg *ast.Expression) *ast.Expression {
 * 	// import(x)
 * 	// emit as
 * 	// Promise.resolve(`${x}`).then((s) => require(s)) /*CommonJS Require* /
 * 	// We have to wrap require in then callback so that require is done in asynchronously
 * 	// if we simply do require in resolve callback in Promise constructor. We will execute the loading immediately
 * 	// If the arg is not inlineable, we have to evaluate and ToString() it in the current scope
 * 	// Otherwise, we inline it in require() so that it's statically analyzable
 *
 * 	needSyncEval := arg != nil && !isSimpleInlineableExpression(arg)
 *
 * 	var promiseResolveArguments []*ast.Expression
 * 	if needSyncEval {
 * 		promiseResolveArguments = []*ast.Expression{
 * 			tx.Factory().NewTemplateExpression(
 * 				tx.Factory().NewTemplateHead("", "", ast.TokenFlagsNone),
 * 				tx.Factory().NewNodeList([]*ast.TemplateSpanNode{
 * 					tx.Factory().NewTemplateSpan(arg, tx.Factory().NewTemplateTail("", "", ast.TokenFlagsNone)),
 * 				}),
 * 			),
 * 		}
 * 	}
 * 	promiseResolveCall := tx.Factory().NewCallExpression(
 * 		tx.Factory().NewPropertyAccessExpression(
 * 			tx.Factory().NewIdentifier("Promise"),
 * 			nil, /*questionDotToken* /
 * 			tx.Factory().NewIdentifier("resolve"),
 * 			ast.NodeFlagsNone,
 * 		),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		tx.Factory().NewNodeList(promiseResolveArguments),
 * 		ast.NodeFlagsNone,
 * 	)
 *
 * 	var requireArguments []*ast.Expression
 * 	if needSyncEval {
 * 		requireArguments = []*ast.Expression{
 * 			tx.Factory().NewIdentifier("s"),
 * 		}
 * 	} else if arg != nil {
 * 		requireArguments = []*ast.Expression{arg}
 * 	}
 *
 * 	requireCall := tx.Factory().NewImportStarHelper(
 * 		tx.Factory().NewCallExpression(
 * 			tx.Factory().NewIdentifier("require"),
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Factory().NewNodeList(requireArguments),
 * 			ast.NodeFlagsNone,
 * 		),
 * 	)
 *
 * 	var parameters []*ast.ParameterDeclarationNode
 * 	if needSyncEval {
 * 		parameters = []*ast.ParameterDeclarationNode{
 * 			tx.Factory().NewParameterDeclaration(
 * 				nil, /*modifiers* /
 * 				nil, /*dotDotDotToken* /
 * 				tx.Factory().NewIdentifier("s"),
 * 				nil, /*questionToken* /
 * 				nil, /*type* /
 * 				nil, /*initializer* /
 * 			),
 * 		}
 * 	}
 *
 * 	function := tx.Factory().NewArrowFunction(
 * 		nil, /*modifiers* /
 * 		nil, /*typeParameters* /
 * 		tx.Factory().NewNodeList(parameters),
 * 		nil, /*type* /
 * 		nil, /*fullSignature* /
 * 		tx.Factory().NewToken(ast.KindEqualsGreaterThanToken), /*equalsGreaterThanToken* /
 * 		requireCall,
 * 	)
 *
 * 	downleveledImport := tx.Factory().NewCallExpression(
 * 		tx.Factory().NewPropertyAccessExpression(
 * 			promiseResolveCall,
 * 			nil, /*questionDotToken* /
 * 			tx.Factory().NewIdentifier("then"),
 * 			ast.NodeFlagsNone,
 * 		),
 * 		nil, /*questionDotToken* /
 * 		nil, /*typeArguments* /
 * 		tx.Factory().NewNodeList([]*ast.Expression{function}),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	return downleveledImport
 * }
 */
export declare function CommonJSModuleTransformer_createImportCallExpressionCommonJS(receiver: GoPtr<CommonJSModuleTransformer>, arg: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.shimOrRewriteImportOrRequireCall","kind":"method","status":"implemented","sigHash":"3cbd9de93cac0b716f261687c9bd8447b5f112742fa2e86e576f4dfe5bb53ce2","bodyHash":"af1d81a27a89a309d2b56dd543854763d03b3e8b4fa5732e1e73134095254683"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) shimOrRewriteImportOrRequireCall(node *ast.CallExpression) *ast.Node {
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	argumentsList := node.Arguments
 * 	if len(node.Arguments.Nodes) > 0 {
 * 		firstArgument := node.Arguments.Nodes[0]
 * 		firstArgumentChanged := false
 * 		if ast.IsStringLiteralLike(firstArgument) {
 * 			rewritten := rewriteModuleSpecifier(tx.EmitContext(), firstArgument, tx.compilerOptions)
 * 			firstArgumentChanged = rewritten != firstArgument
 * 			firstArgument = rewritten
 * 		} else {
 * 			firstArgument = tx.Factory().NewRewriteRelativeImportExtensionsHelper(firstArgument, tx.compilerOptions.Jsx == core.JsxEmitPreserve)
 * 			firstArgumentChanged = true
 * 		}
 *
 * 		rest, restChanged := tx.Visitor().VisitSlice(node.Arguments.Nodes[1:])
 * 		if firstArgumentChanged || restChanged {
 * 			arguments := append([]*ast.Expression{firstArgument}, rest...)
 * 			argumentsList = tx.Factory().NewNodeList(arguments)
 * 			argumentsList.Loc = node.Arguments.Loc
 * 		}
 * 	}
 *
 * 	return tx.Factory().UpdateCallExpression(
 * 		node,
 * 		expression,
 * 		node.QuestionDotToken,
 * 		nil, /*typeArguments* /
 * 		argumentsList,
 * 		node.Flags,
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_shimOrRewriteImportOrRequireCall(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"5342bd9c513c5512d6e7d31aadf5219bc1bd47e75408355efd49a062d3b17ffc","bodyHash":"4b6d4f396bf2b9cbf2866bfc1d4f85da979c73f198eca0444d6e5cafd3227b31"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitTaggedTemplateExpression(node *ast.TaggedTemplateExpression) *ast.Node {
 * 	if ast.IsIdentifier(node.Tag) {
 * 		// given:
 * 		//   import { f } from "mod";
 * 		//   f``;
 * 		// emits:
 * 		//   const mod_1 = require("mod");
 * 		//   (0, mod_1.f) ``;
 * 		// note:
 * 		//   the indirect call is applied by the printer by way of the `EFIndirectCall` emit flag.
 *
 * 		expression := tx.visitExpressionIdentifier(node.Tag)
 * 		updated := tx.Factory().UpdateTaggedTemplateExpression(
 * 			node,
 * 			expression,
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Visitor().VisitNode(node.Template),
 * 			node.Flags,
 * 		)
 * 		if !ast.IsIdentifier(expression) && !transformers.IsHelperName(tx.EmitContext(), node.Tag) {
 * 			tx.EmitContext().AddEmitFlags(updated, printer.EFIndirectCall)
 * 		}
 * 		return updated
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function CommonJSModuleTransformer_visitTaggedTemplateExpression(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<TaggedTemplateExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"5b04c73512d9044f3a54e7d344c8dee5ad4bc39856a89e35e61d48ba62a7cac2","bodyHash":"e953cf921191590e24056eef612dc379bb7f66bcfb8157866f5334edcc13b4e3"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitShorthandPropertyAssignment(node *ast.ShorthandPropertyAssignment) *ast.Node {
 * 	name := node.Name()
 * 	exportedOrImportedName := tx.visitExpressionIdentifier(name)
 * 	if exportedOrImportedName != name {
 * 		// A shorthand property with an assignment initializer is probably part of a
 * 		// destructuring assignment
 * 		expression := exportedOrImportedName
 * 		if node.ObjectAssignmentInitializer != nil {
 * 			expression = tx.Factory().NewAssignmentExpression(
 * 				expression,
 * 				tx.Visitor().VisitNode(node.ObjectAssignmentInitializer),
 * 			)
 * 		}
 * 		assignment := tx.Factory().NewPropertyAssignment(nil /*modifiers* /, name, nil /*postfixToken* /, nil /*typeNode* /, expression)
 * 		assignment.Loc = node.Loc
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(assignment, node.AsNode())
 * 		return assignment
 * 	}
 * 	return tx.Factory().UpdateShorthandPropertyAssignment(node,
 * 		nil, /*modifiers* /
 * 		exportedOrImportedName,
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		node.EqualsToken,
 * 		tx.Visitor().VisitNode(node.ObjectAssignmentInitializer),
 * 	)
 * }
 */
export declare function CommonJSModuleTransformer_visitShorthandPropertyAssignment(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<ShorthandPropertyAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitIdentifier","kind":"method","status":"implemented","sigHash":"0a9397a2da1422d0327138c5a6a5fe93127d4337df6bdf252829023237c60878","bodyHash":"eedce2d4994c0d9e71746f782b129fb67b0485274f605a6c9bf38da1f8aaecba"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	if transformers.IsIdentifierReference(node, tx.parentNode) {
 * 		return tx.visitExpressionIdentifier(node)
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitIdentifier(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.visitExpressionIdentifier","kind":"method","status":"implemented","sigHash":"d01af9be4738da617017078d8c96a6932a8357dc54a0dd29cf1f63178bb7af14","bodyHash":"a557f00334bb4adc9c5dd248486d9687ce6f6f5901b682b220930f533dac4e13"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) visitExpressionIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	if info := tx.EmitContext().GetAutoGenerateInfo(node); !(info != nil && !info.Flags.HasAllowNameSubstitution()) &&
 * 		!transformers.IsHelperName(tx.EmitContext(), node) &&
 * 		!transformers.IsLocalName(tx.EmitContext(), node) &&
 * 		!isDeclarationNameOfEnumOrNamespace(tx.EmitContext(), node) {
 * 		exportContainer := tx.resolver.GetReferencedExportContainer(tx.EmitContext().MostOriginal(node), transformers.IsExportName(tx.EmitContext(), node))
 * 		if exportContainer != nil && ast.IsSourceFile(exportContainer) {
 * 			reference := tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("exports"),
 * 				nil, /*questionDotToken* /
 * 				node.Clone(tx.Factory()),
 * 				ast.NodeFlagsNone,
 * 			)
 * 			tx.EmitContext().AssignCommentAndSourceMapRanges(reference, node)
 * 			reference.Loc = node.Loc
 * 			return reference
 * 		}
 *
 * 		importDeclaration := tx.resolver.GetReferencedImportDeclaration(tx.EmitContext().MostOriginal(node))
 * 		if importDeclaration != nil {
 * 			if ast.IsImportClause(importDeclaration) {
 * 				reference := tx.Factory().NewPropertyAccessExpression(
 * 					tx.Factory().NewGeneratedNameForNode(importDeclaration.Parent), //nolint:customlint // Resolver returns parse-tree declarations; Parent is used to find the owning import declaration.
 * 					nil, /*questionDotToken* /
 * 					tx.Factory().NewIdentifier("default"),
 * 					ast.NodeFlagsNone,
 * 				)
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(reference, node)
 * 				reference.Loc = node.Loc
 * 				return reference
 * 			}
 * 			if ast.IsImportSpecifier(importDeclaration) {
 * 				name := importDeclaration.AsImportSpecifier().PropertyNameOrName()
 * 				decl := ast.FindAncestor(importDeclaration, ast.IsImportDeclaration)
 * 				target := tx.Factory().NewGeneratedNameForNode(core.Coalesce(decl, importDeclaration))
 * 				var reference *ast.Node
 * 				if ast.IsStringLiteral(name) {
 * 					reference = tx.Factory().NewElementAccessExpression(
 * 						target,
 * 						nil, /*questionDotToken* /
 * 						tx.Factory().NewStringLiteralFromNode(name),
 * 						ast.NodeFlagsNone,
 * 					)
 * 				} else {
 * 					referenceName := name.Clone(tx.Factory())
 * 					tx.EmitContext().AddEmitFlags(referenceName, printer.EFNoSourceMap|printer.EFNoComments)
 * 					reference = tx.Factory().NewPropertyAccessExpression(
 * 						target,
 * 						nil, /*questionDotToken* /
 * 						referenceName,
 * 						ast.NodeFlagsNone,
 * 					)
 * 				}
 * 				tx.EmitContext().AssignCommentAndSourceMapRanges(reference, node)
 * 				reference.Loc = node.Loc
 * 				return reference
 * 			}
 * 		}
 * 	}
 * 	return node
 * }
 */
export declare function CommonJSModuleTransformer_visitExpressionIdentifier(receiver: GoPtr<CommonJSModuleTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/commonjsmodule.go::method::CommonJSModuleTransformer.getExports","kind":"method","status":"implemented","sigHash":"8fb5874af1703bbfe2b108cf4d439033709a48e8c74c7d577f8a0f6aae158d45","bodyHash":"7e0a2fc9612905c1f02039004b054cd586b3a916f01daede37f73d61ad0c69dd"}
 *
 * Go source:
 * func (tx *CommonJSModuleTransformer) getExports(name *ast.IdentifierNode) []*ast.ModuleExportName {
 * 	if !transformers.IsGeneratedIdentifier(tx.EmitContext(), name) {
 * 		importDeclaration := tx.resolver.GetReferencedImportDeclaration(tx.EmitContext().MostOriginal(name))
 * 		if importDeclaration != nil {
 * 			return tx.currentModuleInfo.exportedBindings.Get(importDeclaration)
 * 		}
 *
 * 		// An exported namespace or enum may merge with an ambient declaration, which won't show up in .js emit, so
 * 		// we analyze all value exports of a symbol.
 * 		var bindingsSet collections.Set[*ast.ModuleExportName]
 * 		var bindings []*ast.ModuleExportName
 * 		declarations := tx.resolver.GetReferencedValueDeclarations(tx.EmitContext().MostOriginal(name))
 * 		if declarations != nil {
 * 			for _, declaration := range declarations {
 * 				exportedBindings := tx.currentModuleInfo.exportedBindings.Get(declaration)
 * 				for _, binding := range exportedBindings {
 * 					if !bindingsSet.Has(binding) {
 * 						bindingsSet.Add(binding)
 * 						bindings = append(bindings, binding)
 * 					}
 * 				}
 * 			}
 * 			return bindings
 * 		}
 * 	} else if isFileLevelReservedGeneratedIdentifier(tx.EmitContext(), name) {
 * 		exportSpecifiers := tx.currentModuleInfo.exportSpecifiers.Get(name.Text())
 * 		if exportSpecifiers != nil {
 * 			var exportedNames []*ast.ModuleExportName
 * 			for _, exportSpecifier := range exportSpecifiers {
 * 				exportedNames = append(exportedNames, exportSpecifier.Name())
 * 			}
 * 			return exportedNames
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function CommonJSModuleTransformer_getExports(receiver: GoPtr<CommonJSModuleTransformer>, name: GoPtr<IdentifierNode>): GoSlice<GoPtr<ModuleExportName>>;
//# sourceMappingURL=commonjsmodule.d.ts.map