import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { HasFileName, Node, SourceFile } from "../../ast/ast.js";
import type { CallExpression, ExportAssignment, ExportDeclaration, Expression, IdentifierNode, ImportDeclaration, ImportEqualsDeclaration, Statement } from "../../ast/ast_generated.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { CompilerOptions, ModuleKind } from "../../core/compileroptions.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::type::ESModuleTransformer","kind":"type","status":"implemented","sigHash":"6c77421ab1341d88600cefbfeedc8e8c71434d5c3b8b2e093627623459e1354e","bodyHash":"604c7a0ae11037259df4b4db8955cc610f2e95f77176d6bce970398cdc41f572"}
 *
 * Go source:
 * ESModuleTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions           *core.CompilerOptions
 * 	resolver                  binder.ReferenceResolver
 * 	getEmitModuleFormatOfFile func(file ast.HasFileName) core.ModuleKind
 * 	currentSourceFile         *ast.SourceFile
 * 	importRequireStatements   *importRequireStatements
 * 	helperNameSubstitutions   map[string]*ast.IdentifierNode
 * }
 */
export interface ESModuleTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    resolver: ReferenceResolver;
    getEmitModuleFormatOfFile: (file: HasFileName) => ModuleKind;
    currentSourceFile: GoPtr<SourceFile>;
    importRequireStatements: GoPtr<importRequireStatements>;
    helperNameSubstitutions: GoMap<string, GoPtr<IdentifierNode>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::type::importRequireStatements","kind":"type","status":"implemented","sigHash":"41fb7a91a9ec1916a7753b16ebf45f9c52d827c42a9f8a24f64351b8a18ae871","bodyHash":"f6d97b8dfeb17579411e8e57f9f5471107fa16315d7b27fdf2b9e61292eb6a5e"}
 *
 * Go source:
 * importRequireStatements struct {
 * 	statements        []*ast.Statement
 * 	requireHelperName *ast.IdentifierNode
 * }
 */
export interface importRequireStatements {
    statements: GoSlice<GoPtr<Statement>>;
    requireHelperName: GoPtr<IdentifierNode>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::func::NewESModuleTransformer","kind":"func","status":"implemented","sigHash":"07a6fdf6da302091c6c0a082a9144139b59c7e4accd721eff596e57b9afb12bc","bodyHash":"642a888570c3c2275caa85b219b5b8923f43f9fd7b1f7ef80765ea509109380c"}
 *
 * Go source:
 * func NewESModuleTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opts.CompilerOptions
 * 	tx := &ESModuleTransformer{compilerOptions: compilerOptions, resolver: opts.Resolver, getEmitModuleFormatOfFile: opts.GetEmitModuleFormatOfFile}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function NewESModuleTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visit","kind":"method","status":"implemented","sigHash":"68009ebc3d37e1c86b102a70e313c4b1445af0dfc43595caab302b07c2f66c2e","bodyHash":"17074bc440b9f23fdb064f56bba116169a840a96aab2be70e55dfb1301c03351"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visit(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		node = tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindImportDeclaration:
 * 		node = tx.visitImportDeclaration(node.AsImportDeclaration())
 * 	case ast.KindImportEqualsDeclaration:
 * 		node = tx.visitImportEqualsDeclaration(node.AsImportEqualsDeclaration())
 * 	case ast.KindExportAssignment:
 * 		node = tx.visitExportAssignment(node.AsExportAssignment())
 * 	case ast.KindExportDeclaration:
 * 		node = tx.visitExportDeclaration(node.AsExportDeclaration())
 * 	case ast.KindCallExpression:
 * 		node = tx.visitCallExpression(node.AsCallExpression())
 * 	default:
 * 		node = tx.Visitor().VisitEachChild(node)
 * 	}
 * 	return node
 * }
 */
export declare function ESModuleTransformer_visit(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"04698977e3c4dfcb186b029e68105aaaeca0e8db95c9ca03fb481f10cee2563e","bodyHash":"523269839f128f247ce744f1e1620299bc781d4d282130d1809015b39a1c5530"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile ||
 * 		!(ast.IsExternalModule(node) || tx.compilerOptions.GetIsolatedModules()) {
 * 		return node.AsNode()
 * 	}
 *
 * 	tx.currentSourceFile = node
 * 	tx.importRequireStatements = nil
 *
 * 	result := tx.Visitor().VisitEachChild(node.AsNode()).AsSourceFile()
 * 	tx.EmitContext().AddEmitHelper(result.AsNode(), tx.EmitContext().ReadEmitHelpers()...)
 *
 * 	externalHelpersImportDeclaration := createExternalHelpersImportDeclarationIfNeeded(tx.EmitContext(), result, tx.compilerOptions, tx.getEmitModuleFormatOfFile(node), false /*hasExportStarsToExportValues* /, false /*hasImportStar* /, false /*hasImportDefault* /)
 * 	if externalHelpersImportDeclaration != nil || tx.importRequireStatements != nil {
 * 		prologue, rest := tx.Factory().SplitStandardPrologue(result.Statements.Nodes)
 * 		custom, rest := tx.Factory().SplitCustomPrologue(rest)
 * 		statements := slices.Clone(prologue)
 * 		statements = append(statements, custom...)
 * 		if externalHelpersImportDeclaration != nil {
 * 			statements = append(statements, tx.Visitor().VisitNode(externalHelpersImportDeclaration))
 * 		}
 * 		if tx.importRequireStatements != nil {
 * 			statements = append(statements, tx.importRequireStatements.statements...)
 * 		}
 * 		statements = append(statements, rest...)
 * 		statementList := tx.Factory().NewNodeList(statements)
 * 		statementList.Loc = result.Statements.Loc
 * 		result = tx.Factory().UpdateSourceFile(result, statementList, node.EndOfFileToken).AsSourceFile()
 * 	}
 *
 * 	if ast.IsExternalModule(result) &&
 * 		tx.compilerOptions.GetEmitModuleKind() != core.ModuleKindPreserve &&
 * 		!core.Some(result.Statements.Nodes, ast.IsExternalModuleIndicator) {
 * 		statements := slices.Clone(result.Statements.Nodes)
 * 		statements = append(statements, createEmptyImports(tx.Factory()))
 * 		statementList := tx.Factory().NewNodeList(statements)
 * 		statementList.Loc = result.Statements.Loc
 * 		result = tx.Factory().UpdateSourceFile(result, statementList, node.EndOfFileToken).AsSourceFile()
 * 	}
 *
 * 	tx.importRequireStatements = nil
 * 	tx.currentSourceFile = nil
 * 	return result.AsNode()
 * }
 */
export declare function ESModuleTransformer_visitSourceFile(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitImportDeclaration","kind":"method","status":"implemented","sigHash":"3e603a88d691e18210a61bdadced69800497ce64e339d9793d10e51bda61c14f","bodyHash":"def9fa1a7d8ac645ff000f0d74e1e2529707e937b678f989f7c7d48dcf741dc8"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitImportDeclaration(node *ast.ImportDeclaration) *ast.Node {
 * 	if !tx.compilerOptions.RewriteRelativeImportExtensions.IsTrue() {
 * 		return node.AsNode()
 * 	}
 * 	updatedModuleSpecifier := rewriteModuleSpecifier(tx.EmitContext(), node.ModuleSpecifier, tx.compilerOptions)
 * 	return tx.Factory().UpdateImportDeclaration(
 * 		node,
 * 		nil, /*modifiers* /
 * 		tx.Visitor().VisitNode(node.ImportClause),
 * 		updatedModuleSpecifier,
 * 		tx.Visitor().VisitNode(node.Attributes),
 * 	)
 * }
 */
export declare function ESModuleTransformer_visitImportDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ImportDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"7de3de168f0e745d04e34e91e03e17f0800d0f462fbd77871442eeaed35e0ae7","bodyHash":"d2646e1ffc79106e93d3f5d0f1cd0eec2e5d9be1e34258a1a5c9396813d1a054"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) *ast.Node {
 * 	if tx.compilerOptions.GetEmitModuleKind() < core.ModuleKindNode16 {
 * 		return nil
 * 	}
 *
 * 	if !ast.IsExternalModuleImportEqualsDeclaration(node.AsNode()) {
 * 		panic("import= for internal module references should be handled in an earlier transformer.")
 * 	}
 *
 * 	varStatement := tx.Factory().NewVariableStatement(...)
 * 	tx.EmitContext().SetOriginal(varStatement, node.AsNode())
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(varStatement, node.AsNode())
 *
 * 	var statements []*ast.Statement
 * 	statements = append(statements, varStatement)
 * 	statements = tx.appendExportsOfImportEqualsDeclaration(statements, node)
 * 	return transformers.SingleOrMany(statements, tx.Factory())
 * }
 */
export declare function ESModuleTransformer_visitImportEqualsDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ImportEqualsDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.appendExportsOfImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"6558a12f09dc0241d7ad5d45d257a2bb33c072c77471d796b947ec2b7547cbcc","bodyHash":"1fb9ff5ee6b33a90e15140eba794bb0ea1bb835e9480ac4a505dd2b579c38a9d"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) appendExportsOfImportEqualsDeclaration(statements []*ast.Statement, node *ast.ImportEqualsDeclaration) []*ast.Statement {
 * 	if ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport) {
 * 		statements = append(statements, tx.Factory().NewExportDeclaration(
 * 			nil, false, tx.Factory().NewNamedExports(...), nil, nil,
 * 		))
 * 	}
 * 	return statements
 * }
 */
export declare function ESModuleTransformer_appendExportsOfImportEqualsDeclaration(receiver: GoPtr<ESModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<ImportEqualsDeclaration>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitExportAssignment","kind":"method","status":"implemented","sigHash":"bbade563ba2711e8adcafd6386343b0c11c6ce3f2c5c28c9c723d88ed5dc9764","bodyHash":"8b8df468a410f914693a055297b6b4bf60a820fd65cd922b321b9556c2958772"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitExportAssignment(node *ast.ExportAssignment) *ast.Node {
 * 	if !node.IsExportEquals {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	if tx.compilerOptions.GetEmitModuleKind() != core.ModuleKindPreserve {
 * 		return nil
 * 	}
 * 	statement := tx.Factory().NewExpressionStatement(
 * 		tx.Factory().NewAssignmentExpression(
 * 			tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewIdentifier("module"), nil,
 * 				tx.Factory().NewIdentifier("exports"), ast.NodeFlagsNone,
 * 			),
 * 			tx.Visitor().VisitNode(node.Expression),
 * 		),
 * 	)
 * 	tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 	return statement
 * }
 */
export declare function ESModuleTransformer_visitExportAssignment(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitExportDeclaration","kind":"method","status":"implemented","sigHash":"b0db251d935be86442ca373636f92f073cd4099b321a2c6efb1f8aaeb86e11e9","bodyHash":"d487036b777af300e9e16f54ff1d3cd7a5e777bf479ec5b46b150b6601eb7050"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitExportDeclaration(node *ast.ExportDeclaration) *ast.Node {
 * 	if node.ModuleSpecifier == nil { return node.AsNode() }
 *
 * 	updatedModuleSpecifier := rewriteModuleSpecifier(...)
 * 	if tx.compilerOptions.Module > core.ModuleKindES2015 || node.ExportClause == nil || !ast.IsNamespaceExport(node.ExportClause) {
 * 		return tx.Factory().UpdateExportDeclaration(...)
 * 	}
 *
 * 	oldIdentifier := node.ExportClause.Name()
 * 	synthName := tx.Factory().NewGeneratedNameForNode(oldIdentifier)
 * 	importDecl := tx.Factory().NewImportDeclaration(...)
 * 	tx.EmitContext().SetOriginal(importDecl, node.ExportClause)
 *
 * 	var exportDecl *ast.Node
 * 	if ast.IsExportNamespaceAsDefaultDeclaration(node.AsNode()) {
 * 		exportDecl = tx.Factory().NewExportAssignment(nil, false, nil, synthName)
 * 	} else {
 * 		exportDecl = tx.Factory().NewExportDeclaration(...)
 * 	}
 * 	tx.EmitContext().SetOriginal(exportDecl, node.AsNode())
 * 	return transformers.SingleOrMany([]*ast.Statement{importDecl, exportDecl}, tx.Factory())
 * }
 */
export declare function ESModuleTransformer_visitExportDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ExportDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"e51744528e06a0b0be040cb75259c140f93bc41d6387debe8119cd4643e6f5ea","bodyHash":"b709171f306fa6eea49030f26ee9bcfae174df4a215cb8a197482bb5bd52a0cc"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitCallExpression(node *ast.CallExpression) *ast.Node {
 * 	if tx.compilerOptions.RewriteRelativeImportExtensions.IsTrue() {
 * 		if ast.IsImportCall(node.AsNode()) && len(node.Arguments.Nodes) > 0 ||
 * 			ast.IsInJSFile(node.AsNode()) && ast.IsRequireCall(node.AsNode(), false) {
 * 			return tx.visitImportOrRequireCall(node)
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function ESModuleTransformer_visitCallExpression(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.visitImportOrRequireCall","kind":"method","status":"implemented","sigHash":"6eda03400ba9afce4c86fabb23aea0eada82dfb85e8b7f8585076a25afa80cf3","bodyHash":"b9662b871de971e1f01b74d5ac708fbd8618b816e767c68dba30045d62b114db"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) visitImportOrRequireCall(node *ast.CallExpression) *ast.Node {
 * 	if len(node.Arguments.Nodes) == 0 {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 *
 * 	var argument *ast.Expression
 * 	if ast.IsStringLiteralLike(node.Arguments.Nodes[0]) {
 * 		argument = rewriteModuleSpecifier(tx.EmitContext(), node.Arguments.Nodes[0], tx.compilerOptions)
 * 	} else {
 * 		argument = tx.Factory().NewRewriteRelativeImportExtensionsHelper(node.Arguments.Nodes[0], tx.compilerOptions.Jsx == core.JsxEmitPreserve)
 * 	}
 *
 * 	var arguments []*ast.Expression
 * 	arguments = append(arguments, argument)
 *
 * 	rest := core.FirstResult(tx.Visitor().VisitSlice(node.Arguments.Nodes[1:]))
 * 	arguments = append(arguments, rest...)
 *
 * 	argumentList := tx.Factory().NewNodeList(arguments)
 * 	argumentList.Loc = node.Arguments.Loc
 * 	return tx.Factory().UpdateCallExpression(
 * 		node, expression, node.QuestionDotToken, nil, argumentList, node.Flags,
 * 	)
 * }
 */
export declare function ESModuleTransformer_visitImportOrRequireCall(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/esmodule.go::method::ESModuleTransformer.createRequireCall","kind":"method","status":"implemented","sigHash":"d16211b5fbb64896681a42fffde5a6838900f6d989e294fa10836aaacc1d7584","bodyHash":"54a8c85d50261ca111892be89647b6327d9b2bf77f01991483a3df8003871abc"}
 *
 * Go source:
 * func (tx *ESModuleTransformer) createRequireCall(node *ast.Node) *ast.Expression {
 * 	moduleName := getExternalModuleNameLiteral(tx.Factory(), node, tx.currentSourceFile, nil, nil, tx.compilerOptions)
 *
 * 	var args []*ast.Expression
 * 	if moduleName != nil {
 * 		args = append(args, rewriteModuleSpecifier(tx.EmitContext(), moduleName, tx.compilerOptions))
 * 	}
 *
 * 	if tx.compilerOptions.GetEmitModuleKind() == core.ModuleKindPreserve {
 * 		return tx.Factory().NewCallExpression(
 * 			tx.Factory().NewIdentifier("require"), nil, nil,
 * 			tx.Factory().NewNodeList(args), ast.NodeFlagsNone,
 * 		)
 * 	}
 *
 * 	if tx.importRequireStatements == nil {
 * 		createRequireName := tx.Factory().NewUniqueNameEx("_createRequire", {...})
 * 		importStatement := tx.Factory().NewImportDeclaration(...)
 * 		tx.EmitContext().AddEmitFlags(importStatement, printer.EFCustomPrologue)
 *
 * 		requireHelperName := tx.Factory().NewUniqueNameEx("__require", {...})
 * 		requireStatement := tx.Factory().NewVariableStatement(...)
 * 		tx.EmitContext().AddEmitFlags(requireStatement, printer.EFCustomPrologue)
 * 		tx.importRequireStatements = &importRequireStatements{
 * 			statements: [...], requireHelperName: requireHelperName,
 * 		}
 * 	}
 *
 * 	return tx.Factory().NewCallExpression(
 * 		tx.importRequireStatements.requireHelperName.Clone(tx.Factory()), nil, nil,
 * 		tx.Factory().NewNodeList(args), ast.NodeFlagsNone,
 * 	)
 * }
 */
export declare function ESModuleTransformer_createRequireCall(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<Node>): GoPtr<Expression>;
//# sourceMappingURL=esmodule.d.ts.map