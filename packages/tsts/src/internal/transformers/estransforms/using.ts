import type { bool, uint } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { NodeFactory_NewNodeList, NodeFactory_NewModifierList, Node_Name } from "../../ast/spine.js";
import { Node_Elements, Node_Text, Node_Initializer, Node_StatementList, Node_Statements, NodeFactory_UpdateBlock, NodeFactory_UpdateForStatement, NodeFactory_UpdateForInOrOfStatement, NodeFactory_UpdateVariableDeclaration, NodeFactory_UpdateVariableStatement, NodeFactory_UpdateSourceFile, NodeFactory_NewModifier } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Block, ClassDeclaration, ExportAssignment, ForInOrOfStatement, ForStatement, VariableDeclaration, VariableDeclarationList, VariableStatement } from "../../ast/generated/data.js";
import type { BindingPattern } from "../../ast/generated/data.js";
import type { Declaration, ExportSpecifierNode, Expression, ForInitializer, IdentifierNode, Statement, VariableDeclarationNode } from "../../ast/generated/unions.js";
import { NodeFlagsAwaitUsing, NodeFlagsBlockScoped, NodeFlagsConst, NodeFlagsLet, NodeFlagsUsing } from "../../ast/generated/flags.js";
import { IsVariableDeclarationList, IsVariableStatement, IsBlock, IsIdentifier } from "../../ast/generated/predicates.js";
import { AsVariableDeclaration, AsVariableDeclarationList, AsVariableStatement, AsForStatement, AsForInOrOfStatement, AsBlock, AsSyntaxList, AsClassDeclaration, AsExportAssignment } from "../../ast/generated/casts.js";
import { KindSourceFile, KindBlock, KindForStatement, KindForOfStatement, KindSyntaxList, KindImportDeclaration, KindImportEqualsDeclaration, KindExportDeclaration, KindFunctionDeclaration, KindExportAssignment, KindClassDeclaration, KindVariableStatement, KindExportKeyword } from "../../ast/generated/kinds.js";
import { IsBindingPattern, HasSyntacticModifier, SkipOuterExpressions, OEKAll } from "../../ast/utilities.js";
import { ModifierFlagsExport } from "../../ast/modifierflags.js";
import { Node_SubtreeFacts } from "../../ast/spine.js";
import { SubtreeContainsUsing } from "../../ast/subtreefacts.js";
import { NewArrayLiteralExpression, NewAwaitExpression, NewBlock, NewCatchClause, NewExpressionStatement, NewExportAssignment, NewExportDeclaration, NewExportSpecifier, NewFunctionExpression, NewIdentifier, NewIfStatement, NewNamedExports, NewObjectLiteralExpression, NewPropertyAssignment, NewPropertyAccessExpression, NewToken, NewTryStatement, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement } from "../../ast/generated/factory.js";
import { NodeFlagsNone } from "../../ast/generated/flags.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewDisposeResourcesHelper, NodeFactory_NewFalseExpression, NodeFactory_NewTrueExpression, NodeFactory_NewUniqueNameEx, NodeFactory_NewUniqueName, NodeFactory_NewVoidZeroExpression, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewTempVariable, NodeFactory_SplitStandardPrologue, NodeFactory_InlineExpressions, NodeFactory_GetLocalName, NodeFactory_GetDeclarationName, NodeFactory_RestoreOuterExpressions, NodeFactory_NewAddDisposableResourceHelper } from "../../printer/factory.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { EmitContext_AddVariableDeclaration, EmitContext_EndVariableEnvironment, EmitContext_NewNodeVisitor, EmitContext_ReadEmitHelpers, EmitContext_SetCommentRange, EmitContext_SetEmitFlags, EmitContext_SetOriginal, EmitContext_SetSourceMapRange, EmitContext_StartVariableEnvironment, EmitContext_AddEmitHelper, EmitContext_EmitFlags } from "../../printer/emitcontext.js";
import { EFExportName, EFLocalName } from "../../printer/emitflags.js";
import { GeneratedIdentifierFlagsFileLevel, GeneratedIdentifierFlagsOptimistic, GeneratedIdentifierFlagsReservedInNestedScopes } from "../../printer/generatedidentifierflags.js";
import { Node_Clone } from "../../ast/spine.js";
import { ConvertBindingPatternToAssignmentPattern } from "../utilities.js";
import { IsGeneratedIdentifier, IsLocalName } from "../utilities.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { FirstOrNil } from "../../core/core.js";
import { FirstResult } from "../../core/core.js";
import { convertClassDeclarationToClassExpression } from "./utilities.js";
import { isNamedEvaluation, transformNamedEvaluation } from "./namedevaluation.js";
import type { OuterExpressionKinds } from "../../ast/utilities.js";
import { ModifierFlagsDefault } from "../../ast/modifierflags.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::type::usingDeclarationTransformer","kind":"type","status":"implemented","sigHash":"c11288edbfe88aa16e8c945b427708e30a077c4eb0bdebe1f153d608e1a48b4a","bodyHash":"0addd17cbd05c759570d5e61185fa027e4ed776acbfe2fb0877d7cb0ee0f79e9"}
 *
 * Go source:
 * usingDeclarationTransformer struct {
 * 	transformers.Transformer
 * 
 * 	exportBindings       map[string]*ast.ExportSpecifierNode
 * 	exportVars           []*ast.VariableDeclarationNode
 * 	defaultExportBinding *ast.IdentifierNode
 * 	exportEqualsBinding  *ast.IdentifierNode
 * }
 */
export interface usingDeclarationTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  exportBindings: GoMap<string, GoPtr<ExportSpecifierNode>>;
  exportVars: GoSlice<GoPtr<VariableDeclarationNode>>;
  defaultExportBinding: GoPtr<IdentifierNode>;
  exportEqualsBinding: GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::newUsingDeclarationTransformer","kind":"func","status":"implemented","sigHash":"4ee7638a696234bba634c87c82b6af3538595f8d73289a212f9617f1ecd507d9","bodyHash":"3e91cd537636c3fce6678bb5d11617218f13d0c2b876a8286d96485fb84e8f22"}
 *
 * Go source:
 * func newUsingDeclarationTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &usingDeclarationTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newUsingDeclarationTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const tx: usingDeclarationTransformer = {
    __tsgoEmbedded0: {} as Transformer,
    exportBindings: new globalThis.Map<string, GoPtr<ExportSpecifierNode>>(),
    exportVars: [],
    defaultExportBinding: undefined,
    exportEqualsBinding: undefined,
  };
  const result = Transformer_NewTransformer(tx.__tsgoEmbedded0!, (node) => usingDeclarationTransformer_visit(tx, node), opts!.Context);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::type::usingKind","kind":"type","status":"implemented","sigHash":"bc3c4141be5dc6263c88473c07bd84f86ce4de8a839a9c0b7869e79c0b00cf5a","bodyHash":"2ca9ed38fce3bbf8730146254bb9d05b482256b52d07afcc0a83c1256a95a1bd"}
 *
 * Go source:
 * usingKind uint
 */
export type usingKind = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::constGroup::usingKindNone+usingKindSync+usingKindAsync","kind":"constGroup","status":"implemented","sigHash":"1feb19b35c70f9ee8bc2bb2cf1bfd18e7b26e90064c0a87e3146844f21febc56","bodyHash":"38def6799b23c2bbf55bcf4d79effe88e0dafe4d2822e8b2577d109cd1f208bf"}
 *
 * Go source:
 * const (
 * 	usingKindNone usingKind = iota
 * 	usingKindSync
 * 	usingKindAsync
 * )
 */
export const usingKindNone: usingKind = 0;
export const usingKindSync: usingKind = 1;
export const usingKindAsync: usingKind = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.visit","kind":"method","status":"implemented","sigHash":"0ec45aa1a601652d7759164d8eb3367eebd1e558eac0943d6a242428bce4e58f","bodyHash":"98267ce09a3e7ad95b88b01a50c9364c00247c8dc92874e442b7a4e1eabe1982"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsUsing == 0 {
 * 		return node
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		node = tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindBlock:
 * 		node = tx.visitBlock(node.AsBlock())
 * 	case ast.KindForStatement:
 * 		node = tx.visitForStatement(node.AsForStatement())
 * 	case ast.KindForOfStatement:
 * 		node = tx.visitForOfStatement(node.AsForInOrOfStatement())
 * 	default:
 * 		node = tx.Visitor().VisitEachChild(node)
 * 	}
 * 	return node
 * }
 */
export function usingDeclarationTransformer_visit(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if ((Node_SubtreeFacts(node) & SubtreeContainsUsing) === 0) {
    return node;
  }
  switch (node!.Kind) {
    case KindSourceFile:
      return usingDeclarationTransformer_visitSourceFile(receiver, node as GoPtr<SourceFile>);
    case KindBlock:
      return usingDeclarationTransformer_visitBlock(receiver, AsBlock(node));
    case KindForStatement:
      return usingDeclarationTransformer_visitForStatement(receiver, AsForStatement(node));
    case KindForOfStatement:
      return usingDeclarationTransformer_visitForOfStatement(receiver, AsForInOrOfStatement(node));
    default:
      return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"0f892a8bcc3d43aa052b0fc7ecc716ec3396e38da72f6893ba94487faae0b315","bodyHash":"a0903ac1eeac4af01a9e8e2cbb3e321656dca561f96df905c8916c698042d32a"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile {
 * 		return node.AsNode()
 * 	}
 * 
 * 	var visited *ast.SourceFileNode
 * 	usingKind := getUsingKindOfStatements(node.Statements.Nodes)
 * 	if usingKind != usingKindNone {
 * 		// Imports and exports must stay at the top level. This means we must hoist all imports, exports, and
 * 		// top-level function declarations and bindings out of the `try` statements we generate. For example:
 * 		//
 * 		// given:
 * 		//
 * 		//  import { w } from "mod";
 * 		//  const x = expr1;
 * 		//  using y = expr2;
 * 		//  const z = expr3;
 * 		//  export function f() {
 * 		//    console.log(z);
 * 		//  }
 * 		//
 * 		// produces:
 * 		//
 * 		//  import { x } from "mod";        // <-- preserved
 * 		//  const x = expr1;                // <-- preserved
 * 		//  var y, z;                       // <-- hoisted
 * 		//  export function f() {           // <-- hoisted
 * 		//    console.log(z);
 * 		//  }
 * 		//  const env_1 = { stack: [], error: void 0, hasError: false };
 * 		//  try {
 * 		//    y = __addDisposableResource(env_1, expr2, false);
 * 		//    z = expr3;
 * 		//  }
 * 		//  catch (e_1) {
 * 		//    env_1.error = e_1;
 * 		//    env_1.hasError = true;
 * 		//  }
 * 		//  finally {
 * 		//    __disposeResource(env_1);
 * 		//  }
 * 		//
 * 		// In this transformation, we hoist `y`, `z`, and `f` to a new outer statement list while moving all other
 * 		// statements in the source file into the `try` block, which is the same approach we use for System module
 * 		// emit. Unlike System module emit, we attempt to preserve all statements prior to the first top-level
 * 		// `using` to isolate the complexity of the transformed output to only where it is necessary.
 * 		tx.EmitContext().StartVariableEnvironment()
 * 
 * 		tx.exportBindings = make(map[string]*ast.ExportSpecifierNode)
 * 		tx.exportVars = nil
 * 
 * 		prologue, rest := tx.Factory().SplitStandardPrologue(node.Statements.Nodes)
 * 		var topLevelStatements []*ast.Statement
 * 		topLevelStatements = append(topLevelStatements, core.FirstResult(tx.Visitor().VisitSlice(prologue))...)
 * 
 * 		// Collect and transform any leading statements up to the first `using` or `await using`. This preserves
 * 		// the original statement order much as is possible.
 * 
 * 		pos := 0
 * 		for pos < len(rest) {
 * 			statement := rest[pos]
 * 			if getUsingKind(statement) != usingKindNone {
 * 				if pos > 0 {
 * 					topLevelStatements = append(topLevelStatements, core.FirstResult(tx.Visitor().VisitSlice(rest[:pos]))...)
 * 				}
 * 				break
 * 			}
 * 			pos++
 * 		}
 * 
 * 		if pos >= len(rest) {
 * 			panic("Should have encountered at least one 'using' statement.")
 * 		}
 * 
 * 		// transform the rest of the body
 * 		envBinding := tx.createEnvBinding()
 * 		bodyStatements := tx.transformUsingDeclarations(rest[pos:], envBinding, &topLevelStatements)
 * 
 * 		// add `export {}` declarations for any hoisted bindings.
 * 		if len(tx.exportBindings) > 0 {
 * 			topLevelStatements = append(
 * 				topLevelStatements,
 * 				tx.Factory().NewExportDeclaration(
 * 					nil,   /*modifiers* /
 * 					false, /*isTypeOnly* /
 * 					tx.Factory().NewNamedExports(
 * 						tx.Factory().NewNodeList(
 * 							slices.Collect(maps.Values(tx.exportBindings)),
 * 						),
 * 					),
 * 					nil, /*moduleSpecifier* /
 * 					nil, /*attributes* /
 * 				),
 * 			)
 * 		}
 * 
 * 		topLevelStatements = append(topLevelStatements, tx.EmitContext().EndVariableEnvironment()...)
 * 		if len(tx.exportVars) > 0 {
 * 			topLevelStatements = append(topLevelStatements, tx.Factory().NewVariableStatement(
 * 				tx.Factory().NewModifierList([]*ast.Node{
 * 					tx.Factory().NewModifier(ast.KindExportKeyword),
 * 				}),
 * 				tx.Factory().NewVariableDeclarationList(
 * 					tx.Factory().NewNodeList(tx.exportVars),
 * 					ast.NodeFlagsLet,
 * 				),
 * 			))
 * 		}
 * 		topLevelStatements = append(topLevelStatements, tx.createDownlevelUsingStatements(bodyStatements, envBinding, usingKind == usingKindAsync)...)
 * 
 * 		if tx.exportEqualsBinding != nil {
 * 			topLevelStatements = append(topLevelStatements, tx.Factory().NewExportAssignment(
 * 				nil,  /*modifiers* /
 * 				true, /*isExportEquals* /
 * 				nil,  /*typeNode* /
 * 				tx.exportEqualsBinding,
 * 			))
 * 		}
 * 
 * 		visited = tx.Factory().UpdateSourceFile(node, tx.Factory().NewNodeList(topLevelStatements), node.EndOfFileToken)
 * 	} else {
 * 		visited = tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	tx.exportVars = nil
 * 	tx.exportBindings = nil
 * 	tx.defaultExportBinding = nil
 * 	tx.exportEqualsBinding = nil
 * 	return visited
 * }
 */
export function usingDeclarationTransformer_visitSourceFile(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  if (node!.IsDeclarationFile) {
    return node as GoPtr<Node>;
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!);
  let visited: GoPtr<Node>;
  const usingKind = getUsingKindOfStatements(node!.Statements!.Nodes!);
  if (usingKind !== usingKindNone) {
    EmitContext_StartVariableEnvironment(emitContext);
    receiver!.exportBindings = new globalThis.Map<string, GoPtr<ExportSpecifierNode>>();
    receiver!.exportVars = [];
    const [prologue, rest] = NodeFactory_SplitStandardPrologue(printerFactory, node!.Statements!.Nodes!);
    let topLevelStatements: GoSlice<GoPtr<Statement>> = [];
    const prologueVisited = NodeVisitor_VisitSlice((visitor as ConcreteNodeVisitor), prologue as GoSlice<GoPtr<Node>>)[0];
    topLevelStatements = [...topLevelStatements, ...prologueVisited as GoSlice<GoPtr<Statement>>];
    let pos = 0;
    while (pos < rest.length) {
      const statement = rest[pos];
      if (getUsingKind(statement as GoPtr<Node>) !== usingKindNone) {
        if (pos > 0) {
          const leadingVisited = NodeVisitor_VisitSlice((visitor as ConcreteNodeVisitor), rest.slice(0, pos) as GoSlice<GoPtr<Node>>)[0];
          topLevelStatements = [...topLevelStatements, ...leadingVisited as GoSlice<GoPtr<Statement>>];
        }
        break;
      }
      pos++;
    }
    if (pos >= rest.length) {
      throw new globalThis.Error("Should have encountered at least one 'using' statement.");
    }
    const envBinding = usingDeclarationTransformer_createEnvBinding(receiver);
    const topLevelStatementsRef = topLevelStatements;
    const bodyStatements = usingDeclarationTransformer_transformUsingDeclarations(receiver, rest.slice(pos) as GoSlice<GoPtr<Statement>>, envBinding, topLevelStatementsRef);
    topLevelStatements = topLevelStatementsRef;
    if (receiver!.exportBindings!.size > 0) {
      topLevelStatements = [...topLevelStatements, NewExportDeclaration(factory,
        undefined, false,
        NewNamedExports(factory, NodeFactory_NewNodeList(factory, Array.from(receiver!.exportBindings!.values()) as GoSlice<GoPtr<Node>>)),
        undefined, undefined,
      ) as GoPtr<Statement>];
    }
    const envVarDecls = EmitContext_EndVariableEnvironment(emitContext);
    topLevelStatements = [...topLevelStatements, ...envVarDecls as GoSlice<GoPtr<Statement>>];
    if (receiver!.exportVars!.length > 0) {
      topLevelStatements = [...topLevelStatements, NewVariableStatement(factory,
        NodeFactory_NewModifierList(factory, [NewToken(factory, KindExportKeyword)] as GoSlice<GoPtr<Node>>),
        NewVariableDeclarationList(factory, NodeFactory_NewNodeList(factory, receiver!.exportVars! as GoSlice<GoPtr<Node>>), NodeFlagsLet),
      ) as GoPtr<Statement>];
    }
    const downlevel = usingDeclarationTransformer_createDownlevelUsingStatements(receiver, bodyStatements, envBinding, usingKind === usingKindAsync);
    topLevelStatements = [...topLevelStatements, ...downlevel as GoSlice<GoPtr<Statement>>];
    if (receiver!.exportEqualsBinding !== undefined) {
      topLevelStatements = [...topLevelStatements, NewExportAssignment(factory,
        undefined, true, undefined, receiver!.exportEqualsBinding,
      ) as GoPtr<Statement>];
    }
    visited = NodeFactory_UpdateSourceFile(factory, node, NodeFactory_NewNodeList(factory, topLevelStatements as GoSlice<GoPtr<Node>>), node!.EndOfFileToken);
  } else {
    visited = NodeVisitor_VisitEachChild((visitor as ConcreteNodeVisitor), node as GoPtr<Node>);
  }
  EmitContext_AddEmitHelper(emitContext, visited, ...EmitContext_ReadEmitHelpers(emitContext)!);
  receiver!.exportVars = [];
  receiver!.exportBindings = new globalThis.Map();
  receiver!.defaultExportBinding = undefined;
  receiver!.exportEqualsBinding = undefined;
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.visitBlock","kind":"method","status":"implemented","sigHash":"1dde7e27f3055bb2167947cfdf7d5cf54f92b2b370eace58ff7bf173b2e2d8bf","bodyHash":"e400c6ef8e6332161aaff7f075f4d9214f80d8af8c7260d10beb75f0a44f5b49"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) visitBlock(node *ast.Block) *ast.Node {
 * 	usingKind := getUsingKindOfStatements(node.Statements.Nodes)
 * 	if usingKind != usingKindNone {
 * 		prologue, rest := tx.Factory().SplitStandardPrologue(node.Statements.Nodes)
 * 		envBinding := tx.createEnvBinding()
 * 		statements := make([]*ast.Statement, 0, len(prologue)+2)
 * 		statements = append(statements, core.FirstResult(tx.Visitor().VisitSlice(prologue))...)
 * 		statements = append(statements, tx.createDownlevelUsingStatements(
 * 			tx.transformUsingDeclarations(rest, envBinding, nil /*topLevelStatements* /),
 * 			envBinding,
 * 			usingKind == usingKindAsync,
 * 		)...)
 * 		statementList := tx.Factory().NewNodeList(statements)
 * 		statementList.Loc = node.Statements.Loc
 * 		return tx.Factory().UpdateBlock(node, statementList, node.MultiLine)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function usingDeclarationTransformer_visitBlock(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<Block>): GoPtr<Node> {
  const usingKind = getUsingKindOfStatements(node!.Statements!.Nodes!);
  if (usingKind !== usingKindNone) {
    const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
    const factory = printerFactory!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!);
    const [prologue, rest] = NodeFactory_SplitStandardPrologue(printerFactory, node!.Statements!.Nodes!);
    const envBinding = usingDeclarationTransformer_createEnvBinding(receiver);
    let statements: GoSlice<GoPtr<Node>> = [];
    const prologueVisited = NodeVisitor_VisitSlice((visitor as ConcreteNodeVisitor), prologue as GoSlice<GoPtr<Node>>)[0];
    statements = [...statements, ...prologueVisited];
    const downlevel = usingDeclarationTransformer_createDownlevelUsingStatements(
      receiver,
      usingDeclarationTransformer_transformUsingDeclarations(receiver, rest as GoSlice<GoPtr<Statement>>, envBinding, undefined),
      envBinding,
      usingKind === usingKindAsync,
    );
    statements = [...statements, ...downlevel];
    const statementList = NodeFactory_NewNodeList(factory, statements);
    statementList!.Loc = node!.Statements!.Loc;
    return NodeFactory_UpdateBlock(factory, node, statementList, node!.MultiLine);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.visitForStatement","kind":"method","status":"implemented","sigHash":"b03812826ee6392a57e3f903218bd4fdbf8682674be72f1f513291aed42acdcd","bodyHash":"7fef34f19ecabf35f7e947c01fc7f6edf8f14a2ad6352dc5979264bfa5477946"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) visitForStatement(node *ast.ForStatement) *ast.Node {
 * 	if node.Initializer != nil && isUsingVariableDeclarationList(node.Initializer) {
 * 		// given:
 * 		//
 * 		//  for (using x = expr; cond; incr) { ... }
 * 		//
 * 		// produces a shallow transformation to:
 * 		//
 * 		//  {
 * 		//    using x = expr;
 * 		//    for (; cond; incr) { ... }
 * 		//  }
 * 		//
 * 		// before handing the shallow transformation back to the visitor for an in-depth transformation.
 * 		return tx.Visitor().VisitNode(
 * 			tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Statement{
 * 				tx.Factory().NewVariableStatement(nil /*modifiers* /, node.Initializer),
 * 				tx.Factory().UpdateForStatement(
 * 					node,
 * 					nil, /*initializer* /
 * 					node.Condition,
 * 					node.Incrementor,
 * 					node.Statement,
 * 				),
 * 			}), false /*multiLine* /),
 * 		)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function usingDeclarationTransformer_visitForStatement(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ForStatement>): GoPtr<Node> {
  if (node!.Initializer !== undefined && isUsingVariableDeclarationList(node!.Initializer)) {
    const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
    const factory = printerFactory!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!);
    const newBlock = NewBlock(factory,
      NodeFactory_NewNodeList(factory, [
        NewVariableStatement(factory, undefined, node!.Initializer) as GoPtr<Node>,
        NodeFactory_UpdateForStatement(factory, node, undefined, node!.Condition, node!.Incrementor, node!.Statement) as GoPtr<Node>,
      ] as GoSlice<GoPtr<Node>>),
      false,
    );
    return NodeVisitor_VisitNode((visitor as ConcreteNodeVisitor), newBlock);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.visitForOfStatement","kind":"method","status":"implemented","sigHash":"38c80559a1cd8ee4ef613b695e184d4202876e40536cd842e37737e2acaa621f","bodyHash":"0bc493ee867e8010de3cead2a42726708ee1cc8d0c6a5d24418d6a9f82389847"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) visitForOfStatement(node *ast.ForInOrOfStatement) *ast.Node {
 * 	if isUsingVariableDeclarationList(node.Initializer) {
 * 		// given:
 * 		//
 * 		//  for (using x of y) { ... }
 * 		//
 * 		// produces a shallow transformation to:
 * 		//
 * 		//  for (const x_1 of y) {
 * 		//    using x = x;
 * 		//    ...
 * 		//  }
 * 		//
 * 		// before handing the shallow transformation back to the visitor for an in-depth transformation.
 * 		forInitializer := node.Initializer.AsVariableDeclarationList()
 * 		forDecl := core.FirstOrNil(forInitializer.Declarations.Nodes)
 * 		if forDecl == nil {
 * 			forDecl = tx.Factory().NewVariableDeclaration(tx.Factory().NewTempVariable(), nil, nil, nil)
 * 		}
 * 
 * 		isAwaitUsing := getUsingKindOfVariableDeclarationList(forInitializer) == usingKindAsync
 * 		temp := tx.Factory().NewGeneratedNameForNode(forDecl.Name())
 * 		usingVar := tx.Factory().UpdateVariableDeclaration(forDecl.AsVariableDeclaration(), forDecl.Name(), nil /*exclamationToken* /, nil /*type* /, temp)
 * 		usingVarList := tx.Factory().NewVariableDeclarationList(
 * 			tx.Factory().NewNodeList([]*ast.Node{usingVar}),
 * 			core.IfElse(isAwaitUsing, ast.NodeFlagsAwaitUsing, ast.NodeFlagsUsing),
 * 		)
 * 		usingVarStatement := tx.Factory().NewVariableStatement(nil /*modifiers* /, usingVarList)
 * 		var statement *ast.Statement
 * 		if ast.IsBlock(node.Statement) {
 * 			statements := make([]*ast.Statement, 0, len(node.Statement.Statements())+1)
 * 			statements = append(statements, usingVarStatement)
 * 			statements = append(statements, node.Statement.Statements()...)
 * 			statement = tx.Factory().UpdateBlock(
 * 				node.Statement.AsBlock(),
 * 				tx.Factory().NewNodeList(statements),
 * 				node.Statement.AsBlock().MultiLine,
 * 			)
 * 		} else {
 * 			statement = tx.Factory().NewBlock(
 * 				tx.Factory().NewNodeList([]*ast.Statement{
 * 					usingVarStatement,
 * 					node.Statement,
 * 				}),
 * 				true, /*multiLine* /
 * 			)
 * 		}
 * 		return tx.Visitor().VisitNode(
 * 			tx.Factory().UpdateForInOrOfStatement(
 * 				node,
 * 				node.AwaitModifier,
 * 				tx.Factory().NewVariableDeclarationList(
 * 					tx.Factory().NewNodeList([]*ast.VariableDeclarationNode{
 * 						tx.Factory().NewVariableDeclaration(temp, nil /*exclamationToken* /, nil /*type* /, nil),
 * 					}),
 * 					ast.NodeFlagsConst,
 * 				),
 * 				node.Expression,
 * 				statement,
 * 			),
 * 		)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function usingDeclarationTransformer_visitForOfStatement(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ForInOrOfStatement>): GoPtr<Node> {
  if (isUsingVariableDeclarationList(node!.Initializer)) {
    const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
    const factory = printerFactory!.__tsgoEmbedded0!;
    const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!);
    const forInitializer = AsVariableDeclarationList(node!.Initializer);
    let forDecl = FirstOrNil(forInitializer!.Declarations!.Nodes) as GoPtr<Node>;
    if (forDecl === undefined) {
      forDecl = NewVariableDeclaration(factory, NodeFactory_NewTempVariable(printerFactory), undefined, undefined, undefined) as GoPtr<Node>;
    }
    const isAwaitUsing = getUsingKindOfVariableDeclarationList(forInitializer) === usingKindAsync;
    const temp = NodeFactory_NewGeneratedNameForNode(printerFactory, Node_Name(forDecl));
    const usingVar = NodeFactory_UpdateVariableDeclaration(factory, AsVariableDeclaration(forDecl), Node_Name(forDecl), undefined, undefined, temp) as GoPtr<VariableDeclaration>;
    const usingVarList = NewVariableDeclarationList(factory,
      NodeFactory_NewNodeList(factory, [usingVar] as GoSlice<GoPtr<Node>>),
      isAwaitUsing ? NodeFlagsAwaitUsing : NodeFlagsUsing,
    );
    const usingVarStatement = NewVariableStatement(factory, undefined, usingVarList) as GoPtr<Node>;
    let statement: GoPtr<Node>;
    if (IsBlock(node!.Statement)) {
      const stmts = Node_Statements(node!.Statement) ?? [];
      const newStatements = [usingVarStatement, ...stmts] as GoSlice<GoPtr<Node>>;
      statement = NodeFactory_UpdateBlock(factory, AsBlock(node!.Statement), NodeFactory_NewNodeList(factory, newStatements), AsBlock(node!.Statement)!.MultiLine);
    } else {
      statement = NewBlock(factory,
        NodeFactory_NewNodeList(factory, [usingVarStatement, node!.Statement] as GoSlice<GoPtr<Node>>),
        true,
      );
    }
    return NodeVisitor_VisitNode((visitor as ConcreteNodeVisitor),
      NodeFactory_UpdateForInOrOfStatement(factory, node, node!.AwaitModifier, NewVariableDeclarationList(factory,
        NodeFactory_NewNodeList(factory, [
          NewVariableDeclaration(factory, temp, undefined, undefined, undefined) as GoPtr<Node>,
        ] as GoSlice<GoPtr<Node>>),
        NodeFlagsConst,
      ) as GoPtr<ForInitializer>, node!.Expression, statement) as GoPtr<Node>,
    );
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.transformUsingDeclarations","kind":"method","status":"implemented","sigHash":"e137108edef541b74d5b6b8689eeedf0b64de92d3ae43996f75c79b6238fa0f2","bodyHash":"9b861724387da300d39313e4a0ad9652495b5c3cc0087862e91145dffcb98634"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) transformUsingDeclarations(statementsIn []*ast.Statement, envBinding *ast.IdentifierNode, topLevelStatements *[]*ast.Statement) []*ast.Node {
 * 	var statements []*ast.Statement
 * 
 * 	hoist := func(node *ast.Statement) *ast.Statement {
 * 		if topLevelStatements == nil {
 * 			return node
 * 		}
 * 
 * 		switch node.Kind {
 * 		case ast.KindImportDeclaration,
 * 			ast.KindImportEqualsDeclaration,
 * 			ast.KindExportDeclaration,
 * 			ast.KindFunctionDeclaration:
 * 			tx.hoistImportOrExportOrHoistedDeclaration(node, topLevelStatements)
 * 			return nil
 * 		case ast.KindExportAssignment:
 * 			return tx.hoistExportAssignment(node.AsExportAssignment())
 * 		case ast.KindClassDeclaration:
 * 			return tx.hoistClassDeclaration(node.AsClassDeclaration())
 * 		case ast.KindVariableStatement:
 * 			return tx.hoistVariableStatement(node.AsVariableStatement())
 * 		}
 * 
 * 		return node
 * 	}
 * 
 * 	hoistOrAppendNode := func(node *ast.Node) {
 * 		node = hoist(node)
 * 		if node != nil {
 * 			statements = append(statements, node)
 * 		}
 * 	}
 * 
 * 	for _, statement := range statementsIn {
 * 		usingKind := getUsingKind(statement)
 * 		if usingKind != usingKindNone {
 * 			varStatement := statement.AsVariableStatement()
 * 			declarationList := varStatement.DeclarationList
 * 			var declarations []*ast.VariableDeclarationNode
 * 			for _, declaration := range declarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 				if !ast.IsIdentifier(declaration.Name()) {
 * 					// Since binding patterns are a grammar error, we reset `declarations` so we don't process this as a `using`.
 * 					declarations = nil
 * 					break
 * 				}
 * 
 * 				// perform a shallow transform for any named evaluation
 * 				if isNamedEvaluation(tx.EmitContext(), declaration) {
 * 					declaration = transformNamedEvaluation(tx.EmitContext(), declaration, false /*ignoreEmptyStringLiteral* /, "" /*assignedName* /)
 * 				}
 * 
 * 				initializer := tx.Visitor().VisitNode(declaration.Initializer())
 * 				if initializer == nil {
 * 					initializer = tx.Factory().NewVoidZeroExpression()
 * 				}
 * 				declarations = append(declarations, tx.Factory().UpdateVariableDeclaration(
 * 					declaration.AsVariableDeclaration(),
 * 					declaration.Name(),
 * 					nil, /*exclamationToken* /
 * 					nil, /*type* /
 * 					tx.Factory().NewAddDisposableResourceHelper(
 * 						envBinding,
 * 						initializer,
 * 						usingKind == usingKindAsync,
 * 					),
 * 				))
 * 			}
 * 
 * 			// Only replace the statement if it was valid.
 * 			if len(declarations) > 0 {
 * 				varList := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList(declarations), ast.NodeFlagsConst)
 * 				tx.EmitContext().SetOriginal(varList, declarationList)
 * 				varList.Loc = declarationList.Loc
 * 				hoistOrAppendNode(tx.Factory().UpdateVariableStatement(varStatement, nil /*modifiers* /, varList))
 * 				continue
 * 			}
 * 		}
 * 
 * 		if result := tx.visit(statement); result != nil {
 * 			if result.Kind == ast.KindSyntaxList {
 * 				for _, node := range result.AsSyntaxList().Children {
 * 					hoistOrAppendNode(node)
 * 				}
 * 			} else {
 * 				hoistOrAppendNode(result)
 * 			}
 * 		}
 * 	}
 * 	return statements
 * }
 */
export function usingDeclarationTransformer_transformUsingDeclarations(receiver: GoPtr<usingDeclarationTransformer>, statementsIn: GoSlice<GoPtr<Statement>>, envBinding: GoPtr<IdentifierNode>, topLevelStatements: GoPtr<GoSlice<GoPtr<Statement>>>): GoSlice<GoPtr<Node>> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0!);

  let statements: GoSlice<GoPtr<Statement>> = [];

  const hoist = (node: GoPtr<Statement>): GoPtr<Statement> => {
    if (topLevelStatements === undefined) {
      return node;
    }
    switch (node!.Kind) {
      case KindImportDeclaration:
      case KindImportEqualsDeclaration:
      case KindExportDeclaration:
      case KindFunctionDeclaration:
        usingDeclarationTransformer_hoistImportOrExportOrHoistedDeclaration(receiver, node, topLevelStatements);
        return undefined;
      case KindExportAssignment:
        return usingDeclarationTransformer_hoistExportAssignment(receiver, AsExportAssignment(node)) as GoPtr<Statement>;
      case KindClassDeclaration:
        return usingDeclarationTransformer_hoistClassDeclaration(receiver, AsClassDeclaration(node)) as GoPtr<Statement>;
      case KindVariableStatement:
        return usingDeclarationTransformer_hoistVariableStatement(receiver, AsVariableStatement(node)) as GoPtr<Statement>;
    }
    return node;
  };

  const hoistOrAppendNode = (node: GoPtr<Node>): void => {
    const hoisted = hoist(node as GoPtr<Statement>);
    if (hoisted !== undefined) {
      statements = [...statements, hoisted as GoPtr<Statement>];
    }
  };

  for (const statement of statementsIn) {
    const usingKind = getUsingKind(statement as GoPtr<Node>);
    if (usingKind !== usingKindNone) {
      const varStatement = AsVariableStatement(statement as GoPtr<Node>);
      const declarationList = varStatement!.DeclarationList;
      let declarations: GoSlice<GoPtr<VariableDeclaration>> = [];
      let invalid = false;
      for (const declaration of AsVariableDeclarationList(declarationList)!.Declarations!.Nodes!) {
        if (!IsIdentifier(Node_Name(declaration as GoPtr<Node>))) {
          declarations = [];
          invalid = true;
          break;
        }
        let decl = declaration as GoPtr<Node>;
        if (isNamedEvaluation(emitContext, decl)) {
          decl = transformNamedEvaluation(emitContext, decl, false, "") as GoPtr<Node>;
        }
        let initializer = NodeVisitor_VisitNode((visitor as ConcreteNodeVisitor), Node_Initializer(decl) as GoPtr<Node>);
        if (initializer === undefined) {
          initializer = NodeFactory_NewVoidZeroExpression(printerFactory) as GoPtr<Node>;
        }
        declarations = [...declarations, NodeFactory_UpdateVariableDeclaration(factory,
          AsVariableDeclaration(decl),
          Node_Name(decl),
          undefined,
          undefined,
          NodeFactory_NewAddDisposableResourceHelper(printerFactory, envBinding as GoPtr<Expression>, initializer as GoPtr<Expression>, usingKind === usingKindAsync),
        ) as GoPtr<VariableDeclaration>];
      }
      if (!invalid && declarations.length > 0) {
        const varList = NewVariableDeclarationList(factory, NodeFactory_NewNodeList(factory, declarations as GoSlice<GoPtr<Node>>), NodeFlagsConst);
        EmitContext_SetOriginal(emitContext, varList, declarationList);
        varList!.Loc = declarationList!.Loc;
        hoistOrAppendNode(NodeFactory_UpdateVariableStatement(factory, varStatement, undefined, varList) as GoPtr<Node>);
        continue;
      }
    }

    const result = usingDeclarationTransformer_visit(receiver, statement as GoPtr<Node>);
    if (result !== undefined) {
      if (result!.Kind === KindSyntaxList) {
        for (const node of AsSyntaxList(result)!.Children!) {
          hoistOrAppendNode(node);
        }
      } else {
        hoistOrAppendNode(result);
      }
    }
  }
  return statements as GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistImportOrExportOrHoistedDeclaration","kind":"method","status":"implemented","sigHash":"698df36df6048032bfa8ba30d851a32762b2512f5d9bd18169b3914b9b8255aa","bodyHash":"682e8669b392057aa443dc84016095878cd0d29b2cded30b5f4c24ef6966aa1b"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistImportOrExportOrHoistedDeclaration(node *ast.Statement, topLevelStatements *[]*ast.Statement) {
 * 	// NOTE: `node` has already been visited
 * 	*topLevelStatements = append(*topLevelStatements, node)
 * }
 */
export function usingDeclarationTransformer_hoistImportOrExportOrHoistedDeclaration(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<Statement>, topLevelStatements: GoPtr<GoSlice<GoPtr<Statement>>>): void {
  topLevelStatements!.push(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistExportAssignment","kind":"method","status":"implemented","sigHash":"7f5edcf6fd63869fe6a3a2ed6e7320afe8aafc84dbe12cd2fca8a215c4847ce0","bodyHash":"03adc42d7960c6bec553f83eaaae8348ac250c33f4f72a6c912220fc2d717a4a"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistExportAssignment(node *ast.ExportAssignment) *ast.Statement {
 * 	if node.IsExportEquals {
 * 		return tx.hoistExportEquals(node)
 * 	} else {
 * 		return tx.hoistExportDefault(node)
 * 	}
 * }
 */
export function usingDeclarationTransformer_hoistExportAssignment(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Statement> {
  if (node!.IsExportEquals) {
    return usingDeclarationTransformer_hoistExportEquals(receiver, node);
  } else {
    return usingDeclarationTransformer_hoistExportDefault(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistExportDefault","kind":"method","status":"implemented","sigHash":"ee67a3ba2153b028ea365e1a91613e0f32095b378be08884d552974a9d685f9c","bodyHash":"8234427be4928079ef1ce06ddd57bcfe5b112d66bcf5b49e8d456456e71922c8"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistExportDefault(node *ast.ExportAssignment) *ast.Statement {
 * 	// NOTE: `node` has already been visited
 * 	if tx.defaultExportBinding != nil {
 * 		// invalid case of multiple `export default` declarations. Don't assert here, just pass it through
 * 		return node.AsNode()
 * 	}
 * 
 * 	// given:
 * 	//
 * 	//   export default expr;
 * 	//
 * 	// produces:
 * 	//
 * 	//   // top level
 * 	//   var default_1;
 * 	//   export { default_1 as default };
 * 	//
 * 	//   // body
 * 	//   default_1 = expr;
 * 
 * 	tx.defaultExportBinding = tx.Factory().NewUniqueNameEx("_default", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes | printer.GeneratedIdentifierFlagsFileLevel | printer.GeneratedIdentifierFlagsOptimistic})
 * 	tx.hoistBindingIdentifier(tx.defaultExportBinding /*isExport* /, true, tx.Factory().NewIdentifier("default"), node.AsNode())
 * 
 * 	// give a class or function expression an assigned name, if needed.
 * 	expression := node.Expression
 * 	innerExpression := ast.SkipOuterExpressions(expression, ast.OEKAll)
 * 	if isNamedEvaluation(tx.EmitContext(), innerExpression) {
 * 		innerExpression = transformNamedEvaluation(tx.EmitContext(), innerExpression /*ignoreEmptyStringLiteral* /, false, "default")
 * 		expression = tx.Factory().RestoreOuterExpressions(expression, innerExpression, ast.OEKAll)
 * 	}
 * 
 * 	assignment := tx.Factory().NewAssignmentExpression(tx.defaultExportBinding, expression)
 * 	return tx.Factory().NewExpressionStatement(assignment)
 * }
 */
export function usingDeclarationTransformer_hoistExportDefault(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Statement> {
  if (receiver!.defaultExportBinding !== undefined) {
    return node as GoPtr<Statement>;
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  receiver!.defaultExportBinding = NodeFactory_NewUniqueNameEx(printerFactory, "_default", { Flags: GeneratedIdentifierFlagsReservedInNestedScopes | GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsOptimistic } as AutoGenerateOptions);
  usingDeclarationTransformer_hoistBindingIdentifier(receiver, receiver!.defaultExportBinding, true, NewIdentifier(factory, "default"), node as GoPtr<Node>);
  let expression = node!.Expression as GoPtr<Expression>;
  const innerExpression = SkipOuterExpressions(expression, OEKAll as OuterExpressionKinds);
  if (isNamedEvaluation(emitContext, innerExpression as GoPtr<Node>)) {
    const transformedInner = transformNamedEvaluation(emitContext, innerExpression as GoPtr<Node>, false, "default") as GoPtr<Expression>;
    expression = NodeFactory_RestoreOuterExpressions(printerFactory, expression, transformedInner, OEKAll as OuterExpressionKinds) as GoPtr<Expression>;
  }
  const assignment = NodeFactory_NewAssignmentExpression(printerFactory, receiver!.defaultExportBinding as GoPtr<Expression>, expression);
  return NewExpressionStatement(factory, assignment as GoPtr<Expression>) as GoPtr<Statement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistExportEquals","kind":"method","status":"implemented","sigHash":"64e70f427c9b6355af53c6d971f82c17c56f4b98ceda60f5590ae934354150ed","bodyHash":"ee088ada485c866d8bc28ed04ae093b0a44954db32e46cdbf0119e8b5fdbfe37"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistExportEquals(node *ast.ExportAssignment) *ast.Statement {
 * 	// NOTE: `node` has already been visited
 * 	if tx.exportEqualsBinding != nil {
 * 		// invalid case of multiple `export default` declarations. Don't assert here, just pass it through
 * 		return node.AsNode()
 * 	}
 *
 * 	// given:
 * 	//
 * 	//   export = expr;
 * 	//
 * 	// produces:
 * 	//
 * 	//   // top level
 * 	//   var default_1;
 * 	//
 * 	//   try {
 * 	//       // body
 * 	//       default_1 = expr;
 * 	//   } ...
 * 	//
 * 	//   // top level suffix
 * 	//   export = default_1;
 *
 * 	tx.exportEqualsBinding = tx.Factory().NewUniqueNameEx("_default", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes | printer.GeneratedIdentifierFlagsFileLevel | printer.GeneratedIdentifierFlagsOptimistic})
 * 	tx.EmitContext().AddVariableDeclaration(tx.exportEqualsBinding)
 *
 * 	// give a class or function expression an assigned name, if needed.
 * 	assignment := tx.Factory().NewAssignmentExpression(tx.exportEqualsBinding, node.Expression)
 * 	return tx.Factory().NewExpressionStatement(assignment)
 * }
 */
export function usingDeclarationTransformer_hoistExportEquals(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Statement> {
  if (receiver!.exportEqualsBinding !== undefined) {
    return node as GoPtr<Statement>;
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  receiver!.exportEqualsBinding = NodeFactory_NewUniqueNameEx(printerFactory, "_default", { Flags: GeneratedIdentifierFlagsReservedInNestedScopes | GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsOptimistic } as AutoGenerateOptions);
  EmitContext_AddVariableDeclaration(emitContext, receiver!.exportEqualsBinding);
  const assignment = NodeFactory_NewAssignmentExpression(printerFactory, receiver!.exportEqualsBinding, node!.Expression);
  const factory = printerFactory!.__tsgoEmbedded0!;
  return NewExpressionStatement(factory, assignment) as GoPtr<Statement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistClassDeclaration","kind":"method","status":"implemented","sigHash":"6385542115b382d175ac2fa6eb83c33a83583321ae920dea73c982ae2fa1f4e4","bodyHash":"e8db6edf436f51432c0cd5023d8b8fc9136c08db2260410f55d169c3467df1f3"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistClassDeclaration(node *ast.ClassDeclaration) *ast.Statement {
 * 	// NOTE: `node` has already been visited
 * 	if node.Name() == nil && tx.defaultExportBinding != nil {
 * 		// invalid case of multiple `export default` declarations. Don't assert here, just pass it through
 * 		return node.AsNode()
 * 	}
 * 
 * 	isExported := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport)
 * 	isDefault := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsDefault)
 * 
 * 	// When hoisting a class declaration at the top level of a file containing a top-level `using` statement, we
 * 	// must first convert it to a class expression so that we can hoist the binding outside of the `try`.
 * 	expression := convertClassDeclarationToClassExpression(tx.EmitContext(), node)
 * 	if node.Name() != nil {
 * 		// given:
 * 		//
 * 		//  using x = expr;
 * 		//  class C {}
 * 		//
 * 		// produces:
 * 		//
 * 		//  var x, C;
 * 		//  const env_1 = { ... };
 * 		//  try {
 * 		//    x = __addDisposableResource(env_1, expr, false);
 * 		//    C = class {};
 * 		//  }
 * 		//  catch (e_1) {
 * 		//    env_1.error = e_1;
 * 		//    env_1.hasError = true;
 * 		//  }
 * 		//  finally {
 * 		//    __disposeResources(env_1);
 * 		//  }
 * 		//
 * 		// If the class is exported, we also produce an `export { C };`
 * 		tx.hoistBindingIdentifier(tx.Factory().GetLocalName(node.AsNode()), isExported && !isDefault, nil /*exportAlias* /, node.AsNode())
 * 		expression = tx.Factory().NewAssignmentExpression(tx.Factory().GetDeclarationName(node.AsNode()), expression)
 * 		tx.EmitContext().SetOriginal(expression, node.AsNode())
 * 		tx.EmitContext().SetSourceMapRange(expression, node.Loc)
 * 		tx.EmitContext().SetCommentRange(expression, node.Loc)
 * 		if isNamedEvaluation(tx.EmitContext(), expression) {
 * 			expression = transformNamedEvaluation(tx.EmitContext(), expression, false /*ignoreEmptyStringLiteral* /, "" /*assignedName* /)
 * 		}
 * 	}
 * 
 * 	if isDefault && tx.defaultExportBinding == nil {
 * 		// In the case of a default export, we create a temporary variable that we export as the default and then
 * 		// assign to that variable.
 * 		//
 * 		// given:
 * 		//
 * 		//  using x = expr;
 * 		//  export default class C {}
 * 		//
 * 		// produces:
 * 		//
 * 		//  export { default_1 as default };
 * 		//  var x, C, default_1;
 * 		//  const env_1 = { ... };
 * 		//  try {
 * 		//    x = __addDisposableResource(env_1, expr, false);
 * 		//    default_1 = C = class {};
 * 		//  }
 * 		//  catch (e_1) {
 * 		//    env_1.error = e_1;
 * 		//    env_1.hasError = true;
 * 		//  }
 * 		//  finally {
 * 		//    __disposeResources(env_1);
 * 		//  }
 * 		//
 * 		// Though we will never reassign `default_1`, this most closely matches the specified runtime semantics.
 * 		tx.defaultExportBinding = tx.Factory().NewUniqueNameEx("_default", printer.AutoGenerateOptions{Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes | printer.GeneratedIdentifierFlagsFileLevel | printer.GeneratedIdentifierFlagsOptimistic})
 * 		tx.hoistBindingIdentifier(tx.defaultExportBinding /*isExport* /, true, tx.Factory().NewIdentifier("default"), node.AsNode())
 * 		expression = tx.Factory().NewAssignmentExpression(tx.defaultExportBinding, expression)
 * 		tx.EmitContext().SetOriginal(expression, node.AsNode())
 * 		if isNamedEvaluation(tx.EmitContext(), expression) {
 * 			expression = transformNamedEvaluation(tx.EmitContext(), expression /*ignoreEmptyStringLiteral* /, false, "default")
 * 		}
 * 	}
 * 
 * 	return tx.Factory().NewExpressionStatement(expression)
 * }
 */
export function usingDeclarationTransformer_hoistClassDeclaration(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Statement> {
  if (Node_Name(node as GoPtr<Node>) === undefined && receiver!.defaultExportBinding !== undefined) {
    return node as GoPtr<Statement>;
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const isExported = HasSyntacticModifier(node as GoPtr<Node>, ModifierFlagsExport) as bool;
  const isDefault = HasSyntacticModifier(node as GoPtr<Node>, ModifierFlagsDefault) as bool;
  let expression: GoPtr<Expression> = convertClassDeclarationToClassExpression(emitContext, node) as GoPtr<Expression>;
  if (Node_Name(node as GoPtr<Node>) !== undefined) {
    usingDeclarationTransformer_hoistBindingIdentifier(receiver, NodeFactory_GetLocalName(printerFactory, node as GoPtr<Declaration>), isExported && !isDefault, undefined, node as GoPtr<Node>);
    expression = NodeFactory_NewAssignmentExpression(printerFactory, NodeFactory_GetDeclarationName(printerFactory, node as GoPtr<Declaration>) as GoPtr<Expression>, expression) as GoPtr<Expression>;
    EmitContext_SetOriginal(emitContext, expression as GoPtr<Node>, node as GoPtr<Node>);
    EmitContext_SetSourceMapRange(emitContext, expression as GoPtr<Node>, node!.Loc);
    EmitContext_SetCommentRange(emitContext, expression as GoPtr<Node>, node!.Loc);
    if (isNamedEvaluation(emitContext, expression as GoPtr<Node>)) {
      expression = transformNamedEvaluation(emitContext, expression as GoPtr<Node>, false, "") as GoPtr<Expression>;
    }
  }
  if (isDefault && receiver!.defaultExportBinding === undefined) {
    receiver!.defaultExportBinding = NodeFactory_NewUniqueNameEx(printerFactory, "_default", { Flags: GeneratedIdentifierFlagsReservedInNestedScopes | GeneratedIdentifierFlagsFileLevel | GeneratedIdentifierFlagsOptimistic } as AutoGenerateOptions);
    usingDeclarationTransformer_hoistBindingIdentifier(receiver, receiver!.defaultExportBinding, true, NewIdentifier(factory, "default"), node as GoPtr<Node>);
    expression = NodeFactory_NewAssignmentExpression(printerFactory, receiver!.defaultExportBinding as GoPtr<Expression>, expression) as GoPtr<Expression>;
    EmitContext_SetOriginal(emitContext, expression as GoPtr<Node>, node as GoPtr<Node>);
    if (isNamedEvaluation(emitContext, expression as GoPtr<Node>)) {
      expression = transformNamedEvaluation(emitContext, expression as GoPtr<Node>, false, "default") as GoPtr<Expression>;
    }
  }
  return NewExpressionStatement(factory, expression) as GoPtr<Statement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistVariableStatement","kind":"method","status":"implemented","sigHash":"a4d152ddb307c0facca6478e050495ab3ed16092731aa895eb7fd126efa30037","bodyHash":"2132c1b93228c98bb224510eebfdd103ce44ab49ad4a8ab2c542cd0c374dea6d"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistVariableStatement(node *ast.VariableStatement) *ast.Statement {
 * 	// NOTE: `node` has already been visited
 * 	var expressions []*ast.Expression
 * 	isExported := ast.HasSyntacticModifier(node.AsNode(), ast.ModifierFlagsExport)
 * 	for _, variable := range node.DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 		tx.hoistBindingElement(variable, isExported, variable)
 * 		if variable.Initializer() != nil {
 * 			expressions = append(expressions, tx.hoistInitializedVariable(variable.AsVariableDeclaration()))
 * 		}
 * 	}
 * 	if len(expressions) > 0 {
 * 		statement := tx.Factory().NewExpressionStatement(tx.Factory().InlineExpressions(expressions))
 * 		tx.EmitContext().SetOriginal(statement, node.AsNode())
 * 		tx.EmitContext().SetCommentRange(statement, node.Loc)
 * 		tx.EmitContext().SetSourceMapRange(statement, node.Loc)
 * 		return statement
 * 	}
 * 	return nil
 * }
 */
export function usingDeclarationTransformer_hoistVariableStatement(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<VariableStatement>): GoPtr<Statement> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const expressions: GoSlice<GoPtr<Expression>> = [];
  const isExported = HasSyntacticModifier(node as GoPtr<Node>, ModifierFlagsExport) as bool;
  for (const variable of AsVariableDeclarationList(node!.DeclarationList)!.Declarations!.Nodes!) {
    usingDeclarationTransformer_hoistBindingElement(receiver, variable as GoPtr<Node>, isExported, variable as GoPtr<Node>);
    if ((variable as GoPtr<VariableDeclaration>)!.Initializer !== undefined) {
      expressions.push(usingDeclarationTransformer_hoistInitializedVariable(receiver, AsVariableDeclaration(variable as GoPtr<Node>)));
    }
  }
  if (expressions.length > 0) {
    const statement = NewExpressionStatement(factory, NodeFactory_InlineExpressions(printerFactory, expressions) as GoPtr<Expression>);
    EmitContext_SetOriginal(emitContext, statement as GoPtr<Node>, node as GoPtr<Node>);
    EmitContext_SetCommentRange(emitContext, statement as GoPtr<Node>, node!.Loc);
    EmitContext_SetSourceMapRange(emitContext, statement as GoPtr<Node>, node!.Loc);
    return statement as GoPtr<Statement>;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistInitializedVariable","kind":"method","status":"implemented","sigHash":"f4462687c50a369280f8df2e41ce67dc40bffe0d67bb297a4a0cb7721f48b259","bodyHash":"7a8d9ccc699d736a907807f645f8476c71a22a19818215f170807663d73fda36"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistInitializedVariable(node *ast.VariableDeclaration) *ast.Expression {
 * 	// NOTE: `node` has already been visited
 * 	if node.Initializer == nil {
 * 		panic("Expected initializer")
 * 	}
 * 	var target *ast.Expression
 * 	if ast.IsIdentifier(node.Name()) {
 * 		target = node.Name().Clone(tx.Factory())
 * 		tx.EmitContext().SetEmitFlags(target, tx.EmitContext().EmitFlags(target) & ^(printer.EFLocalName|printer.EFExportName))
 * 	} else {
 * 		target = transformers.ConvertBindingPatternToAssignmentPattern(tx.EmitContext(), node.Name().AsBindingPattern())
 * 	}
 * 
 * 	assignment := tx.Factory().NewAssignmentExpression(target, node.Initializer)
 * 	tx.EmitContext().SetOriginal(assignment, node.AsNode())
 * 	tx.EmitContext().SetCommentRange(assignment, node.Loc)
 * 	tx.EmitContext().SetSourceMapRange(assignment, node.Loc)
 * 	return assignment
 * }
 */
export function usingDeclarationTransformer_hoistInitializedVariable(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Expression> {
  if (node!.Initializer === undefined) {
    throw new globalThis.Error("Expected initializer");
  }
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  const nodeName = Node_Name(node as GoPtr<Node>);
  let target: GoPtr<Expression>;
  if (IsIdentifier(nodeName)) {
    const coercible = { AsNodeFactory: () => factory };
    const cloned = Node_Clone(nodeName, coercible) as GoPtr<Expression>;
    EmitContext_SetEmitFlags(emitContext, cloned as GoPtr<Node>, EmitContext_EmitFlags(emitContext, cloned as GoPtr<Node>) & ~(EFLocalName | EFExportName));
    target = cloned;
  } else {
    target = ConvertBindingPatternToAssignmentPattern(emitContext, nodeName as GoPtr<BindingPattern>);
  }
  const assignment = NodeFactory_NewAssignmentExpression(printerFactory, target, node!.Initializer);
  EmitContext_SetOriginal(emitContext, assignment as GoPtr<Node>, node as GoPtr<Node>);
  EmitContext_SetCommentRange(emitContext, assignment as GoPtr<Node>, node!.Loc);
  EmitContext_SetSourceMapRange(emitContext, assignment as GoPtr<Node>, node!.Loc);
  return assignment as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistBindingElement","kind":"method","status":"implemented","sigHash":"0febb86655d86aedc8a682101212c07e33767756a2db50061fc91dc14b926f27","bodyHash":"3d1e9fd86b8d1365ceec6a506ee59da270684adacab11b79b8b475af56c2d85d"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistBindingElement(node *ast.Node /*VariableDeclaration|BindingElement* /, isExportedDeclaration bool, original *ast.Node) {
 * 	// NOTE: `node` has already been visited
 * 	if ast.IsBindingPattern(node.Name()) {
 * 		for _, element := range node.Name().Elements() {
 * 			if element.Name() != nil {
 * 				tx.hoistBindingElement(element, isExportedDeclaration, original)
 * 			}
 * 		}
 * 	} else {
 * 		tx.hoistBindingIdentifier(node.Name(), isExportedDeclaration, nil /*exportAlias* /, original)
 * 	}
 * }
 */
export function usingDeclarationTransformer_hoistBindingElement(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<Node>, isExportedDeclaration: bool, original: GoPtr<Node>): void {
  const nodeName = Node_Name(node);
  if (IsBindingPattern(nodeName)) {
    for (const element of (Node_Elements(nodeName) ?? [])) {
      if (Node_Name(element) !== undefined) {
        usingDeclarationTransformer_hoistBindingElement(receiver, element, isExportedDeclaration, original);
      }
    }
  } else {
    usingDeclarationTransformer_hoistBindingIdentifier(receiver, nodeName as GoPtr<IdentifierNode>, isExportedDeclaration, undefined, original);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.hoistBindingIdentifier","kind":"method","status":"implemented","sigHash":"53984d8c03f91be8d642184ebca420bf77d90f9f1a278295c8c2a3ea79b741c0","bodyHash":"8f2a6c8c6a4da6c2e051a995e065a9fe0b7341344e0770f93fb92c495301dd01"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) hoistBindingIdentifier(node *ast.IdentifierNode, isExport bool, exportAlias *ast.IdentifierNode, original *ast.Node) {
 * 	// NOTE: `node` has already been visited
 * 	name := node
 * 	if !transformers.IsGeneratedIdentifier(tx.EmitContext(), node) {
 * 		name = name.Clone(tx.Factory())
 * 	}
 * 	if isExport {
 * 		if exportAlias == nil && !transformers.IsLocalName(tx.EmitContext(), name) {
 * 			varDecl := tx.Factory().NewVariableDeclaration(name, nil /*exclamationToken* /, nil /*type* /, nil /*initializer* /)
 * 			if original != nil {
 * 				tx.EmitContext().SetOriginal(varDecl, original)
 * 			}
 * 			tx.exportVars = append(tx.exportVars, varDecl)
 * 			return
 * 		}
 * 
 * 		var localName *ast.ModuleExportName
 * 		var exportName *ast.ModuleExportName
 * 		if exportAlias != nil {
 * 			localName = name
 * 			exportName = exportAlias
 * 		} else {
 * 			exportName = name
 * 		}
 * 		specifier := tx.Factory().NewExportSpecifier( /*isTypeOnly* / false, localName, exportName)
 * 		if original != nil {
 * 			tx.EmitContext().SetOriginal(specifier, original)
 * 		}
 * 		if tx.exportBindings == nil {
 * 			tx.exportBindings = make(map[string]*ast.ExportSpecifierNode)
 * 		}
 * 		tx.exportBindings[name.Text()] = specifier
 * 	}
 * 	tx.EmitContext().AddVariableDeclaration(name)
 * }
 */
export function usingDeclarationTransformer_hoistBindingIdentifier(receiver: GoPtr<usingDeclarationTransformer>, node: GoPtr<IdentifierNode>, isExport: bool, exportAlias: GoPtr<IdentifierNode>, original: GoPtr<Node>): void {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const emitContext = Transformer_EmitContext(receiver!.__tsgoEmbedded0!);
  let name = node;
  if (!IsGeneratedIdentifier(emitContext, node)) {
    const cloneCoercible = { AsNodeFactory: () => factory };
    name = Node_Clone(node, cloneCoercible) as GoPtr<IdentifierNode>;
  }
  if (isExport) {
    if (exportAlias === undefined && !IsLocalName(emitContext, name)) {
      const varDecl = NewVariableDeclaration(factory, name as GoPtr<Node>, undefined, undefined, undefined);
      if (original !== undefined) {
        EmitContext_SetOriginal(emitContext, varDecl, original);
      }
      receiver!.exportVars = [...receiver!.exportVars, varDecl as GoPtr<VariableDeclarationNode>];
      return;
    }
    const localName: GoPtr<IdentifierNode> = exportAlias !== undefined ? name : undefined;
    const exportName: GoPtr<IdentifierNode> = exportAlias !== undefined ? exportAlias : name;
    const specifier = NewExportSpecifier(factory, false as bool, localName as GoPtr<Node>, exportName as GoPtr<Node>);
    if (original !== undefined) {
      EmitContext_SetOriginal(emitContext, specifier, original);
    }
    if (receiver!.exportBindings === undefined) {
      receiver!.exportBindings = new globalThis.Map<string, GoPtr<ExportSpecifierNode>>();
    }
    receiver!.exportBindings!.set(Node_Text(name as GoPtr<Node>) ?? "", specifier as GoPtr<ExportSpecifierNode>);
  }
  EmitContext_AddVariableDeclaration(emitContext, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.createEnvBinding","kind":"method","status":"implemented","sigHash":"07f6a9b02e58536d3781a66dfac125c12953d02016688b9b0efb4c1bef5aeeea","bodyHash":"01f263b1076dc8865f5d06d8a2a3b793894ca7d1a181ee7ea5fcceaa21a3efc6"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) createEnvBinding() *ast.IdentifierNode {
 * 	return tx.Factory().NewUniqueName("env")
 * }
 */
export function usingDeclarationTransformer_createEnvBinding(receiver: GoPtr<usingDeclarationTransformer>): GoPtr<IdentifierNode> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  return NodeFactory_NewUniqueName(printerFactory, "env");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::method::usingDeclarationTransformer.createDownlevelUsingStatements","kind":"method","status":"implemented","sigHash":"47d3e63afdfe557e293701d2156c29250020e6e149bf45e3fe00371032dd5c1e","bodyHash":"c0ec58ac569feef5af9d1f7c03593c6a9d12fb4761a9d8fce2732c4a42b766d2"}
 *
 * Go source:
 * func (tx *usingDeclarationTransformer) createDownlevelUsingStatements(bodyStatements []*ast.Node, envBinding *ast.IdentifierNode, async bool) []*ast.Statement {
 * 	statements := make([]*ast.Statement, 0, 2)
 * 
 * 	// produces:
 * 	//
 * 	//  const env_1 = { stack: [], error: void 0, hasError: false };
 * 	//
 * 	envObject := tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Expression{
 * 		tx.Factory().NewPropertyAssignment(nil /*modifiers* /, tx.Factory().NewIdentifier("stack"), nil /*postfixToken* /, nil /*typeNode* /, tx.Factory().NewArrayLiteralExpression(nil, false /*multiLine* /)),
 * 		tx.Factory().NewPropertyAssignment(nil /*modifiers* /, tx.Factory().NewIdentifier("error"), nil /*postfixToken* /, nil /*typeNode* /, tx.Factory().NewVoidZeroExpression()),
 * 		tx.Factory().NewPropertyAssignment(nil /*modifiers* /, tx.Factory().NewIdentifier("hasError"), nil /*postfixToken* /, nil /*typeNode* /, tx.Factory().NewFalseExpression()),
 * 	}), false /*multiLine* /)
 * 	envVar := tx.Factory().NewVariableDeclaration(envBinding, nil /*exclamationToken* /, nil /*typeNode* /, envObject)
 * 	envVarList := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.VariableDeclarationNode{envVar}), ast.NodeFlagsConst)
 * 	envVarStatement := tx.Factory().NewVariableStatement(nil /*modifiers* /, envVarList)
 * 	statements = append(statements, envVarStatement)
 * 
 * 	// when `async` is `false`, produces:
 * 	//
 * 	//  try {
 * 	//    <bodyStatements>
 * 	//  }
 * 	//  catch (e_1) {
 * 	//      env_1.error = e_1;
 * 	//      env_1.hasError = true;
 * 	//  }
 * 	//  finally {
 * 	//    __disposeResources(env_1);
 * 	//  }
 * 
 * 	// when `async` is `true`, produces:
 * 	//
 * 	//  try {
 * 	//    <bodyStatements>
 * 	//  }
 * 	//  catch (e_1) {
 * 	//      env_1.error = e_1;
 * 	//      env_1.hasError = true;
 * 	//  }
 * 	//  finally {
 * 	//    const result_1 = __disposeResources(env_1);
 * 	//    if (result_1) {
 * 	//      await result_1;
 * 	//    }
 * 	//  }
 * 
 * 	// Unfortunately, it is necessary to use two properties to indicate an error because `throw undefined` is legal
 * 	// JavaScript.
 * 	tryBlock := tx.Factory().NewBlock(tx.Factory().NewNodeList(bodyStatements), true /*multiLine* /)
 * 	bodyCatchBinding := tx.Factory().NewUniqueName("e")
 * 	catchClause := tx.Factory().NewCatchClause(
 * 		tx.Factory().NewVariableDeclaration(
 * 			bodyCatchBinding,
 * 			nil, /*exclamationToken* /
 * 			nil, /*type* /
 * 			nil, /*initializer* /
 * 		),
 * 		tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Statement{
 * 			tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewAssignmentExpression(
 * 					tx.Factory().NewPropertyAccessExpression(envBinding, nil, tx.Factory().NewIdentifier("error"), ast.NodeFlagsNone),
 * 					bodyCatchBinding,
 * 				),
 * 			),
 * 			tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewAssignmentExpression(
 * 					tx.Factory().NewPropertyAccessExpression(envBinding, nil, tx.Factory().NewIdentifier("hasError"), ast.NodeFlagsNone),
 * 					tx.Factory().NewTrueExpression(),
 * 				),
 * 			),
 * 		}), true /*multiLine* /),
 * 	)
 * 
 * 	var finallyBlock *ast.BlockNode
 * 	if async {
 * 		result := tx.Factory().NewUniqueName("result")
 * 		finallyBlock = tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Statement{
 * 			tx.Factory().NewVariableStatement(
 * 				nil, /*modifiers* /
 * 				tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.VariableDeclarationNode{
 * 					tx.Factory().NewVariableDeclaration(
 * 						result,
 * 						nil, /*exclamationToken* /
 * 						nil, /*type* /
 * 						tx.Factory().NewDisposeResourcesHelper(envBinding),
 * 					),
 * 				}), ast.NodeFlagsConst),
 * 			),
 * 			tx.Factory().NewIfStatement(result, tx.Factory().NewExpressionStatement(tx.Factory().NewAwaitExpression(result)), nil /*elseStatement* /),
 * 		}), true /*multiLine* /)
 * 	} else {
 * 		finallyBlock = tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Statement{
 * 			tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewDisposeResourcesHelper(envBinding),
 * 			),
 * 		}), true /*multiLine* /)
 * 	}
 * 
 * 	tryStatement := tx.Factory().NewTryStatement(tryBlock, catchClause, finallyBlock)
 * 	statements = append(statements, tryStatement)
 * 	return statements
 * }
 */
export function usingDeclarationTransformer_createDownlevelUsingStatements(receiver: GoPtr<usingDeclarationTransformer>, bodyStatements: GoSlice<GoPtr<Node>>, envBinding: GoPtr<IdentifierNode>, async: bool): GoSlice<GoPtr<Statement>> {
  const printerFactory = Transformer_Factory(receiver!.__tsgoEmbedded0!);
  const factory = printerFactory!.__tsgoEmbedded0!;
  const statements: GoSlice<GoPtr<Statement>> = [];

  // const env_1 = { stack: [], error: void 0, hasError: false };
  const envObject = NewObjectLiteralExpression(
    factory,
    NodeFactory_NewNodeList(factory, [
      NewPropertyAssignment(factory, undefined, NewIdentifier(factory, "stack"), undefined, undefined, NewArrayLiteralExpression(factory, undefined, false as bool) as GoPtr<Expression>),
      NewPropertyAssignment(factory, undefined, NewIdentifier(factory, "error"), undefined, undefined, NodeFactory_NewVoidZeroExpression(printerFactory) as GoPtr<Expression>),
      NewPropertyAssignment(factory, undefined, NewIdentifier(factory, "hasError"), undefined, undefined, NodeFactory_NewFalseExpression(printerFactory) as GoPtr<Expression>),
    ]),
    false as bool,
  );
  const envVar = NewVariableDeclaration(factory, envBinding as GoPtr<Node>, undefined, undefined, envObject as GoPtr<Expression>);
  const envVarList = NewVariableDeclarationList(
    factory,
    NodeFactory_NewNodeList(factory, [envVar]),
    NodeFlagsConst,
  );
  const envVarStatement = NewVariableStatement(factory, undefined, envVarList as GoPtr<Node>);
  statements.push(envVarStatement as GoPtr<Statement>);

  const tryBlock = NewBlock(factory, NodeFactory_NewNodeList(factory, bodyStatements as GoSlice<GoPtr<Node>>), true as bool);
  const bodyCatchBinding = NodeFactory_NewUniqueName(printerFactory, "e");
  const catchClause = NewCatchClause(
    factory,
    NewVariableDeclaration(factory, bodyCatchBinding as GoPtr<Node>, undefined, undefined, undefined) as GoPtr<Node>,
    NewBlock(
      factory,
      NodeFactory_NewNodeList(factory, [
        NewExpressionStatement(
          factory,
          NodeFactory_NewAssignmentExpression(
            printerFactory,
            NewPropertyAccessExpression(factory, envBinding as GoPtr<Expression>, undefined, NewIdentifier(factory, "error") as GoPtr<Node>, NodeFlagsNone) as GoPtr<Expression>,
            bodyCatchBinding as GoPtr<Expression>,
          ) as GoPtr<Expression>,
        ),
        NewExpressionStatement(
          factory,
          NodeFactory_NewAssignmentExpression(
            printerFactory,
            NewPropertyAccessExpression(factory, envBinding as GoPtr<Expression>, undefined, NewIdentifier(factory, "hasError") as GoPtr<Node>, NodeFlagsNone) as GoPtr<Expression>,
            NodeFactory_NewTrueExpression(printerFactory) as GoPtr<Expression>,
          ) as GoPtr<Expression>,
        ),
      ] as GoSlice<GoPtr<Node>>),
      true as bool,
    ) as GoPtr<Node>,
  );

  const finallyBlock = async
    ? (() => {
        const result = NodeFactory_NewUniqueName(printerFactory, "result");
        return NewBlock(
          factory,
          NodeFactory_NewNodeList(factory, [
            NewVariableStatement(
              factory,
              undefined,
              NewVariableDeclarationList(
                factory,
                NodeFactory_NewNodeList(factory, [
                  NewVariableDeclaration(factory, result as GoPtr<Node>, undefined, undefined, NodeFactory_NewDisposeResourcesHelper(printerFactory, envBinding) as GoPtr<Expression>),
                ]),
                NodeFlagsConst,
              ) as GoPtr<Node>,
            ),
            NewIfStatement(
              factory,
              result as GoPtr<Expression>,
              NewExpressionStatement(factory, NewAwaitExpression(factory, result as GoPtr<Expression>) as GoPtr<Expression>) as GoPtr<Statement>,
              undefined,
            ),
          ] as GoSlice<GoPtr<Node>>),
          true as bool,
        );
      })()
    : NewBlock(
        factory,
        NodeFactory_NewNodeList(factory, [
          NewExpressionStatement(factory, NodeFactory_NewDisposeResourcesHelper(printerFactory, envBinding) as GoPtr<Expression>),
        ] as GoSlice<GoPtr<Node>>),
        true as bool,
      );

  const tryStatement = NewTryStatement(factory, tryBlock as GoPtr<Node>, catchClause as GoPtr<Node>, finallyBlock as GoPtr<Node>);
  statements.push(tryStatement as GoPtr<Statement>);
  return statements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::isUsingVariableDeclarationList","kind":"func","status":"implemented","sigHash":"d855d3b000d954422cab765f073b1716de272cb8db2615d7ca203e90941f5296","bodyHash":"26809ea13cefa4ff440bac658f30f2acb640387d73b5f6ee02379ad795948780"}
 *
 * Go source:
 * func isUsingVariableDeclarationList(node *ast.ForInitializer) bool {
 * 	return ast.IsVariableDeclarationList(node) && getUsingKindOfVariableDeclarationList(node.AsVariableDeclarationList()) != usingKindNone
 * }
 */
export function isUsingVariableDeclarationList(node: GoPtr<ForInitializer>): bool {
  return (IsVariableDeclarationList(node) && getUsingKindOfVariableDeclarationList(AsVariableDeclarationList(node)) !== usingKindNone) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::getUsingKindOfVariableDeclarationList","kind":"func","status":"implemented","sigHash":"cdb8d320d65ec73ec6e6a2f41527bb4aa226e0835997f2f9d3d5111753cf7147","bodyHash":"418b4c962905ee1195d5d8e8269182ec737d8b924bbd78213189a4707487c0ea"}
 *
 * Go source:
 * func getUsingKindOfVariableDeclarationList(node *ast.VariableDeclarationList) usingKind {
 * 	switch node.Flags & ast.NodeFlagsBlockScoped {
 * 	case ast.NodeFlagsAwaitUsing:
 * 		return usingKindAsync
 * 	case ast.NodeFlagsUsing:
 * 		return usingKindSync
 * 	default:
 * 		return usingKindNone
 * 	}
 * }
 */
export function getUsingKindOfVariableDeclarationList(node: GoPtr<VariableDeclarationList>): usingKind {
  switch (node!.Flags & NodeFlagsBlockScoped) {
    case NodeFlagsAwaitUsing:
      return usingKindAsync;
    case NodeFlagsUsing:
      return usingKindSync;
    default:
      return usingKindNone;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::getUsingKindOfVariableStatement","kind":"func","status":"implemented","sigHash":"744f2b6b395b397e2a115bccab0830e97acda6ebe0035913cdc1616f8b6b20c5","bodyHash":"0a5b8eacca6feb03b5a7994af6d998569553de9a14427ff8545b77f844a05785"}
 *
 * Go source:
 * func getUsingKindOfVariableStatement(node *ast.VariableStatement) usingKind {
 * 	return getUsingKindOfVariableDeclarationList(node.DeclarationList.AsVariableDeclarationList())
 * }
 */
export function getUsingKindOfVariableStatement(node: GoPtr<VariableStatement>): usingKind {
  return getUsingKindOfVariableDeclarationList(AsVariableDeclarationList(node!.DeclarationList));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::getUsingKind","kind":"func","status":"implemented","sigHash":"f5e6c0edffb37381cda6a2535956e599633b60e90ba206f9f02dbb02cd359595","bodyHash":"ba33cee7cfce24c08a7568990afa0215bc01657c42dc6ffe5b2143a9550f8139"}
 *
 * Go source:
 * func getUsingKind(statement *ast.Node) usingKind {
 * 	if ast.IsVariableStatement(statement) {
 * 		return getUsingKindOfVariableStatement(statement.AsVariableStatement())
 * 	}
 * 	return usingKindNone
 * }
 */
export function getUsingKind(statement: GoPtr<Node>): usingKind {
  if (IsVariableStatement(statement)) {
    return getUsingKindOfVariableStatement(AsVariableStatement(statement));
  }
  return usingKindNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/using.go::func::getUsingKindOfStatements","kind":"func","status":"implemented","sigHash":"5af21f743c80ad3a07ab71d1b784d1b00d30511fc9f03e16c4ff7d9505027b47","bodyHash":"0d6cb25517c1643f058093093a0168dc5d9f0a6033e2a63fa1c31d007adb5d11"}
 *
 * Go source:
 * func getUsingKindOfStatements(statements []*ast.Node) usingKind {
 * 	result := usingKindNone
 * 	for _, statement := range statements {
 * 		usingKind := getUsingKind(statement)
 * 		if usingKind == usingKindAsync {
 * 			return usingKindAsync
 * 		}
 * 		if usingKind > result {
 * 			result = usingKind
 * 		}
 * 	}
 * 	return result
 * }
 */
export function getUsingKindOfStatements(statements: GoSlice<GoPtr<Node>>): usingKind {
  let result: usingKind = usingKindNone;
  for (const statement of statements) {
    const usingKind = getUsingKind(statement);
    if (usingKind === usingKindAsync) {
      return usingKindAsync;
    }
    if (usingKind > result) {
      result = usingKind;
    }
  }
  return result;
}
