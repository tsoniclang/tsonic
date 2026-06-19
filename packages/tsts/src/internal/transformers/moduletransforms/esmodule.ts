import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { bool } from "../../../go/scalars.js";
import type { HasFileName, Node, SourceFile } from "../../ast/ast.js";
import {
  AsSourceFile, SourceFile_FileName, SourceFile_Path,
  NodeFactory_UpdateImportDeclaration, NodeFactory_UpdateExportDeclaration,
  NodeFactory_UpdateCallExpression, NodeFactory_UpdateSourceFile,
} from "../../ast/ast.js";
import type { CallExpression, ExportAssignment, ExportDeclaration, Expression, IdentifierNode, ImportDeclaration, ImportEqualsDeclaration, Statement } from "../../ast/ast_generated.js";
import {
  AsCallExpression, AsExportAssignment, AsExportDeclaration, AsImportDeclaration, AsImportEqualsDeclaration,
} from "../../ast/ast_generated.js";
import {
  IsExternalModule, IsExternalModuleImportEqualsDeclaration, IsExternalModuleIndicator,
  HasSyntacticModifier, IsExportNamespaceAsDefaultDeclaration, IsStringLiteralLike,
  IsImportCall, IsInJSFile, IsRequireCall,
} from "../../ast/utilities.js";
import { IsNamespaceExport } from "../../ast/generated/predicates.js";
import {
  NewCallExpression, NewExportAssignment, NewExportDeclaration, NewExportSpecifier,
  NewExpressionStatement, NewIdentifier, NewImportClause, NewImportDeclaration,
  NewImportSpecifier, NewMetaProperty, NewNamedExports, NewNamedImports,
  NewNamespaceImport, NewPropertyAccessExpression, NewStringLiteral,
  NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement,
} from "../../ast/generated/factory.js";
import {
  KindCallExpression, KindExportAssignment, KindExportDeclaration, KindImportDeclaration,
  KindImportEqualsDeclaration, KindImportKeyword, KindSourceFile, KindUnknown,
} from "../../ast/generated/kinds.js";
import { NodeFlagsConst, NodeFlagsNone } from "../../ast/generated/flags.js";
import { ModifierFlagsExport } from "../../ast/modifierflags.js";
import { Node_Clone, Node_Name, NodeFactory_AsNodeFactory, NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { NodeFactoryCoercible } from "../../ast/spine.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import {
  NodeVisitor_VisitEachChild, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitSlice,
} from "../../ast/visitor.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { CompilerOptions, ModuleKind } from "../../core/compileroptions.js";
import {
  CompilerOptions_GetEmitModuleKind, CompilerOptions_GetIsolatedModules,
  JsxEmitPreserve, ModuleKindES2015, ModuleKindNode16, ModuleKindPreserve,
} from "../../core/compileroptions.js";
import { FirstResult, Some } from "../../core/core.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import {
  EmitContext_AddEmitFlags, EmitContext_AddEmitHelper, EmitContext_AssignCommentAndSourceMapRanges,
  EmitContext_ReadEmitHelpers, EmitContext_SetOriginal,
} from "../../printer/emitcontext.js";
import { EFCustomPrologue } from "../../printer/emitflags.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { GeneratedIdentifierFlagsFileLevel, GeneratedIdentifierFlagsOptimistic } from "../../printer/generatedidentifierflags.js";
import {
  NodeFactory_NewAssignmentExpression, NodeFactory_NewGeneratedNameForNode,
  NodeFactory_NewRewriteRelativeImportExtensionsHelper,
  NodeFactory_NewUniqueNameEx, NodeFactory_SplitCustomPrologue, NodeFactory_SplitStandardPrologue,
} from "../../printer/factory.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { TransformOptions } from "../chain.js";
import { SingleOrMany } from "../utilities.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { createExternalHelpersImportDeclarationIfNeeded } from "./externalmoduleinfo.js";
import { createEmptyImports, getExternalModuleNameLiteral, rewriteModuleSpecifier } from "./utilities.js";

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

function ESModuleTransformer_importRequireStatements(receiver: GoPtr<ESModuleTransformer>): GoPtr<importRequireStatements> {
  return receiver!.importRequireStatements;
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
export function NewESModuleTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const compilerOptions = opts!.CompilerOptions;
  const tx: ESModuleTransformer = {
    __tsgoEmbedded0: {} as Transformer,
    compilerOptions: compilerOptions,
    resolver: opts!.Resolver,
    getEmitModuleFormatOfFile: opts!.GetEmitModuleFormatOfFile,
    currentSourceFile: undefined,
    importRequireStatements: undefined,
    helperNameSubstitutions: new Map(),
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0!, (node) => ESModuleTransformer_visit(tx, node), opts!.Context);
}

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
export function ESModuleTransformer_visit(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  switch (node!.Kind) {
    case KindSourceFile:
      node = ESModuleTransformer_visitSourceFile(receiver, AsSourceFile(node));
      break;
    case KindImportDeclaration:
      node = ESModuleTransformer_visitImportDeclaration(receiver, AsImportDeclaration(node));
      break;
    case KindImportEqualsDeclaration:
      node = ESModuleTransformer_visitImportEqualsDeclaration(receiver, AsImportEqualsDeclaration(node));
      break;
    case KindExportAssignment:
      node = ESModuleTransformer_visitExportAssignment(receiver, AsExportAssignment(node));
      break;
    case KindExportDeclaration:
      node = ESModuleTransformer_visitExportDeclaration(receiver, AsExportDeclaration(node));
      break;
    case KindCallExpression:
      node = ESModuleTransformer_visitCallExpression(receiver, AsCallExpression(node));
      break;
    default:
      node = NodeVisitor_VisitEachChild(visitor, node);
      break;
  }
  return node;
}

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
export function ESModuleTransformer_visitSourceFile(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;

  if (node!.IsDeclarationFile || !(IsExternalModule(node) || CompilerOptions_GetIsolatedModules(receiver!.compilerOptions))) {
    return nodeAsNode;
  }

  receiver!.currentSourceFile = node;
  receiver!.importRequireStatements = undefined;

  let result = AsSourceFile(NodeVisitor_VisitEachChild(visitor, nodeAsNode));
  EmitContext_AddEmitHelper(emitContext, result as unknown as GoPtr<Node>, ...EmitContext_ReadEmitHelpers(emitContext));

  const externalHelpersImportDeclaration = createExternalHelpersImportDeclarationIfNeeded(
    emitContext, result, receiver!.compilerOptions,
    receiver!.getEmitModuleFormatOfFile({ FileName: () => SourceFile_FileName(node), Path: () => SourceFile_Path(node) }),
    false, /*hasExportStarsToExportValues*/
    false, /*hasImportStar*/
    false, /*hasImportDefault*/
  );
  if (externalHelpersImportDeclaration !== undefined || receiver!.importRequireStatements !== undefined) {
    const [prologue, rest0] = NodeFactory_SplitStandardPrologue(pf!, result!.Statements!.Nodes as GoSlice<GoPtr<Statement>>);
    const [custom, rest] = NodeFactory_SplitCustomPrologue(pf!, rest0);
    let statements: GoSlice<GoPtr<Node>> = [...prologue];
    statements = [...statements, ...custom];
    if (externalHelpersImportDeclaration !== undefined) {
      statements = [...statements, NodeVisitor_VisitNode(visitor, externalHelpersImportDeclaration)];
    }
    const importRequireStmts = ESModuleTransformer_importRequireStatements(receiver);
    if (importRequireStmts !== undefined) {
      statements = [...statements, ...importRequireStmts.statements];
    }
    statements = [...statements, ...rest];
    const statementList = NodeFactory_NewNodeList(af, statements);
    statementList!.Loc = result!.Statements!.Loc;
    result = AsSourceFile(NodeFactory_UpdateSourceFile(af, result, statementList, node!.EndOfFileToken));
  }

  if (IsExternalModule(result) &&
    CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) !== ModuleKindPreserve &&
    !Some(result!.Statements!.Nodes, IsExternalModuleIndicator)) {
    let statements2: GoSlice<GoPtr<Node>> = [...result!.Statements!.Nodes];
    statements2 = [...statements2, createEmptyImports(pf!)];
    const statementList2 = NodeFactory_NewNodeList(af, statements2);
    statementList2!.Loc = result!.Statements!.Loc;
    result = AsSourceFile(NodeFactory_UpdateSourceFile(af, result, statementList2, node!.EndOfFileToken));
  }

  receiver!.importRequireStatements = undefined;
  receiver!.currentSourceFile = undefined;
  return result as unknown as GoPtr<Node>;
}

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
export function ESModuleTransformer_visitImportDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ImportDeclaration>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!Tristate_IsTrue(receiver!.compilerOptions!.RewriteRelativeImportExtensions)) {
    return nodeAsNode;
  }
  const updatedModuleSpecifier = rewriteModuleSpecifier(emitContext, node!.ModuleSpecifier, receiver!.compilerOptions);
  return NodeFactory_UpdateImportDeclaration(
    af,
    node,
    undefined, /*modifiers*/
    NodeVisitor_VisitNode(visitor, node!.ImportClause),
    updatedModuleSpecifier,
    NodeVisitor_VisitNode(visitor, node!.Attributes),
  );
}

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
export function ESModuleTransformer_visitImportEqualsDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ImportEqualsDeclaration>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const nodeAsNode = node as unknown as GoPtr<Node>;

  if (CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) < ModuleKindNode16) {
    return undefined;
  }

  if (!IsExternalModuleImportEqualsDeclaration(nodeAsNode)) {
    throw new globalThis.Error("import= for internal module references should be handled in an earlier transformer.");
  }

  const clonedName = Node_Clone(Node_Name(nodeAsNode), NodeFactory_AsNodeFactory(af) as unknown as NodeFactoryCoercible);
  const varStatement = NewVariableStatement(
    af,
    undefined, /*modifiers*/
    NewVariableDeclarationList(
      af,
      NodeFactory_NewNodeList(af, [
        NewVariableDeclaration(
          af,
          clonedName as unknown as GoPtr<never>,
          undefined, /*exclamationToken*/
          undefined, /*type*/
          ESModuleTransformer_createRequireCall(receiver, nodeAsNode) as unknown as GoPtr<never>,
        ),
      ]),
      NodeFlagsConst,
    ) as unknown as GoPtr<never>,
  );
  EmitContext_SetOriginal(emitContext, varStatement, nodeAsNode);
  EmitContext_AssignCommentAndSourceMapRanges(emitContext, varStatement, nodeAsNode);

  let statements: GoSlice<GoPtr<Statement>> = [varStatement as unknown as GoPtr<Statement>];
  statements = ESModuleTransformer_appendExportsOfImportEqualsDeclaration(receiver, statements, node);
  return SingleOrMany(statements, pf!);
}

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
export function ESModuleTransformer_appendExportsOfImportEqualsDeclaration(receiver: GoPtr<ESModuleTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<ImportEqualsDeclaration>): GoSlice<GoPtr<Statement>> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (HasSyntacticModifier(nodeAsNode, ModifierFlagsExport)) {
    const clonedName = Node_Clone(Node_Name(nodeAsNode), NodeFactory_AsNodeFactory(af) as unknown as NodeFactoryCoercible);
    const exportDecl = NewExportDeclaration(
      af,
      undefined, /*modifiers*/
      false, /*isTypeOnly*/
      NewNamedExports(
        af,
        NodeFactory_NewNodeList(af, [
          NewExportSpecifier(
            af,
            false, /*isTypeOnly*/
            undefined, /*propertyName*/
            clonedName as unknown as GoPtr<never>,
          ),
        ]) as unknown as GoPtr<never>,
      ) as unknown as GoPtr<never>,
      undefined, /*moduleSpecifier*/
      undefined, /*attributes*/
    );
    statements = [...statements, exportDecl as unknown as GoPtr<Statement>];
  }
  return statements;
}

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
export function ESModuleTransformer_visitExportAssignment(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (!node!.IsExportEquals) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }
  if (CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) !== ModuleKindPreserve) {
    return undefined;
  }
  const statement = NewExpressionStatement(
    af,
    NodeFactory_NewAssignmentExpression(
      pf!,
      NewPropertyAccessExpression(
        af,
        NewIdentifier(af, "module") as unknown as GoPtr<Expression>,
        undefined, /*questionDotToken*/
        NewIdentifier(af, "exports") as unknown as GoPtr<never>,
        NodeFlagsNone,
      ) as unknown as GoPtr<Expression>,
      NodeVisitor_VisitNode(visitor, node!.Expression as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>,
    ) as unknown as GoPtr<Expression>,
  );
  EmitContext_SetOriginal(emitContext, statement, nodeAsNode);
  return statement;
}

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
export function ESModuleTransformer_visitExportDeclaration(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<ExportDeclaration>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;

  if (node!.ModuleSpecifier === undefined) {
    return nodeAsNode;
  }

  const updatedModuleSpecifier = rewriteModuleSpecifier(emitContext, node!.ModuleSpecifier, receiver!.compilerOptions);
  if (receiver!.compilerOptions!.Module > ModuleKindES2015 || node!.ExportClause === undefined || !IsNamespaceExport(node!.ExportClause)) {
    return NodeFactory_UpdateExportDeclaration(
      af,
      node,
      undefined, /*modifiers*/
      false, /*isTypeOnly*/
      node!.ExportClause,
      updatedModuleSpecifier,
      NodeVisitor_VisitNode(visitor, node!.Attributes),
    );
  }

  const oldIdentifier = Node_Name(node!.ExportClause);
  const synthName = NodeFactory_NewGeneratedNameForNode(pf!, oldIdentifier);
  const importDecl = NewImportDeclaration(
    af,
    undefined, /*modifiers*/
    NewImportClause(
      af,
      KindUnknown, /*phaseModifier*/
      undefined, /*name*/
      NewNamespaceImport(af, synthName) as unknown as GoPtr<never>,
    ) as unknown as GoPtr<never>,
    updatedModuleSpecifier,
    NodeVisitor_VisitNode(visitor, node!.Attributes),
  );
  EmitContext_SetOriginal(emitContext, importDecl, node!.ExportClause);

  let exportDecl: GoPtr<Node>;
  if (IsExportNamespaceAsDefaultDeclaration(nodeAsNode)) {
    exportDecl = NewExportAssignment(
      af,
      undefined, /*modifiers*/
      false, /*isExportEquals*/
      undefined, /*typeNode*/
      synthName as unknown as GoPtr<never>,
    );
  } else {
    exportDecl = NewExportDeclaration(
      af,
      undefined, /*modifiers*/
      false, /*isTypeOnly*/
      NewNamedExports(
        af,
        NodeFactory_NewNodeList(af, [
          NewExportSpecifier(
            af,
            false, /*isTypeOnly*/
            synthName as unknown as GoPtr<never>,
            oldIdentifier as unknown as GoPtr<never>,
          ),
        ]) as unknown as GoPtr<never>,
      ) as unknown as GoPtr<never>,
      undefined, /*moduleSpecifier*/
      undefined, /*attributes*/
    );
  }
  EmitContext_SetOriginal(emitContext, exportDecl, nodeAsNode);
  return SingleOrMany([importDecl as unknown as GoPtr<Statement>, exportDecl as unknown as GoPtr<Statement>], pf!);
}

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
export function ESModuleTransformer_visitCallExpression(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;
  if (Tristate_IsTrue(receiver!.compilerOptions!.RewriteRelativeImportExtensions)) {
    if ((IsImportCall(nodeAsNode) && node!.Arguments!.Nodes.length > 0) ||
      (IsInJSFile(nodeAsNode) && IsRequireCall(nodeAsNode, false))) {
      return ESModuleTransformer_visitImportOrRequireCall(receiver, node);
    }
  }
  return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}

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
export function ESModuleTransformer_visitImportOrRequireCall(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<CallExpression>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor;
  const nodeAsNode = node as unknown as GoPtr<Node>;

  if (node!.Arguments!.Nodes.length === 0) {
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
  }

  const expression = NodeVisitor_VisitNode(visitor, node!.Expression as unknown as GoPtr<Node>);

  let argument: GoPtr<Expression>;
  if (IsStringLiteralLike(node!.Arguments!.Nodes[0])) {
    argument = rewriteModuleSpecifier(emitContext, node!.Arguments!.Nodes[0] as unknown as GoPtr<Expression>, receiver!.compilerOptions);
  } else {
    argument = NodeFactory_NewRewriteRelativeImportExtensionsHelper(
      pf!,
      node!.Arguments!.Nodes[0],
      receiver!.compilerOptions!.Jsx === JsxEmitPreserve,
    );
  }

  let args: GoSlice<GoPtr<Node>> = [argument as unknown as GoPtr<Node>];
  const rest = NodeVisitor_VisitSlice(visitor, node!.Arguments!.Nodes.slice(1))[0];
  args = [...args, ...rest];

  const argumentList = NodeFactory_NewNodeList(af, args);
  argumentList!.Loc = node!.Arguments!.Loc;
  return NodeFactory_UpdateCallExpression(
    af,
    node,
    expression as unknown as GoPtr<Expression>,
    node!.QuestionDotToken,
    undefined, /*typeArguments*/
    argumentList,
    nodeAsNode!.Flags,
  );
}

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
export function ESModuleTransformer_createRequireCall(receiver: GoPtr<ESModuleTransformer>, node: GoPtr<Node>): GoPtr<Expression> {
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const af = pf!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);

  const moduleName = getExternalModuleNameLiteral(pf!, node, receiver!.currentSourceFile, undefined /*host*/, undefined as unknown as EmitResolver /*emitResolver*/, receiver!.compilerOptions);

  let args: GoSlice<GoPtr<Node>> = [];
  if (moduleName !== undefined) {
    args = [rewriteModuleSpecifier(emitContext, moduleName as unknown as GoPtr<Expression>, receiver!.compilerOptions) as unknown as GoPtr<Node>];
  }

  if (CompilerOptions_GetEmitModuleKind(receiver!.compilerOptions) === ModuleKindPreserve) {
    return NewCallExpression(
      af,
      NewIdentifier(af, "require") as unknown as GoPtr<Expression>,
      undefined, /*questionDotToken*/
      undefined, /*typeArguments*/
      NodeFactory_NewNodeList(af, args),
      NodeFlagsNone,
    ) as unknown as GoPtr<Expression>;
  }

  if (receiver!.importRequireStatements === undefined) {
    const autoGenOpts: AutoGenerateOptions = { Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsFileLevel, Prefix: "", Suffix: "" };
    const createRequireName = NodeFactory_NewUniqueNameEx(pf!, "_createRequire", autoGenOpts);
    const importStatement = NewImportDeclaration(
      af,
      undefined, /*modifiers*/
      NewImportClause(
        af,
        KindUnknown, /*phaseModifier*/
        undefined, /*name*/
        NewNamedImports(
          af,
          NodeFactory_NewNodeList(af, [
            NewImportSpecifier(
              af,
              false, /*isTypeOnly*/
              NewIdentifier(af, "createRequire") as unknown as GoPtr<never>,
              createRequireName as unknown as GoPtr<never>,
            ),
          ]) as unknown as GoPtr<never>,
        ) as unknown as GoPtr<never>,
      ) as unknown as GoPtr<never>,
      NewStringLiteral(af, "module", TokenFlagsNone) as unknown as GoPtr<Expression>,
      undefined, /*attributes*/
    );
    EmitContext_AddEmitFlags(emitContext, importStatement, EFCustomPrologue);

    const requireHelperName = NodeFactory_NewUniqueNameEx(pf!, "__require", autoGenOpts);
    const clonedCreateRequireName = Node_Clone(createRequireName as unknown as GoPtr<Node>, NodeFactory_AsNodeFactory(af) as unknown as NodeFactoryCoercible);
    const requireStatement = NewVariableStatement(
      af,
      undefined, /*modifiers*/
      NewVariableDeclarationList(
        af,
        NodeFactory_NewNodeList(af, [
          NewVariableDeclaration(
            af,
            requireHelperName as unknown as GoPtr<never>,
            undefined, /*exclamationToken*/
            undefined, /*type*/
            NewCallExpression(
              af,
              clonedCreateRequireName as unknown as GoPtr<Expression>,
              undefined, /*questionDotToken*/
              undefined, /*typeArguments*/
              NodeFactory_NewNodeList(af, [
                NewPropertyAccessExpression(
                  af,
                  NewMetaProperty(af, KindImportKeyword, NewIdentifier(af, "meta") as unknown as GoPtr<never>) as unknown as GoPtr<Expression>,
                  undefined, /*questionDotToken*/
                  NewIdentifier(af, "url") as unknown as GoPtr<never>,
                  NodeFlagsNone,
                ) as unknown as GoPtr<Node>,
              ]),
              NodeFlagsNone,
            ) as unknown as GoPtr<never>,
          ),
        ]),
        NodeFlagsConst,
      ) as unknown as GoPtr<never>,
    );
    EmitContext_AddEmitFlags(emitContext, requireStatement, EFCustomPrologue);
    receiver!.importRequireStatements = {
      statements: [importStatement as unknown as GoPtr<Statement>, requireStatement as unknown as GoPtr<Statement>],
      requireHelperName: requireHelperName,
    };
  }

  const clonedHelper = Node_Clone(receiver!.importRequireStatements!.requireHelperName as unknown as GoPtr<Node>, NodeFactory_AsNodeFactory(af) as unknown as NodeFactoryCoercible);
  return NewCallExpression(
    af,
    clonedHelper as unknown as GoPtr<Expression>,
    undefined, /*questionDotToken*/
    undefined, /*typeArguments*/
    NodeFactory_NewNodeList(af, args),
    NodeFlagsNone,
  ) as unknown as GoPtr<Expression>;
}
