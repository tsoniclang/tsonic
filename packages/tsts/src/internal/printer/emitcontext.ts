import type { bool, int, uint } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Pool } from "../../go/sync.js";
import { Uint32 } from "../../go/sync/atomic.js";
import * as maps from "../../go/maps.js";
import * as slices from "../../go/slices.js";
import type { Node, NodeVisitor } from "../ast/spine.js";
import type { NodeFactoryCoercible } from "../ast/spine.js";
import { Node_AsNode, Node_Clone, Node_Modifiers, Node_Name, NodeFactory_AsNodeFactory, NodeFactory_NewNodeList } from "../ast/spine.js";
import type { BlockOrExpression, Expression, FunctionDeclarationNode, IdentifierNode, MemberName, ParameterList, Statement, StatementList, StringLiteralNode, TypeNode, VariableDeclarationNode } from "../ast/generated/unions.js";
import type { ParameterDeclaration } from "../ast/generated/data.js";
import type { SourceFile } from "../ast/ast.js";
import { NodeFactory_UpdateBlock, NodeFactory_UpdateParameterDeclaration } from "../ast/ast.js";
import type { Kind } from "../ast/generated/kinds.js";
import { KindColonToken, KindQuestionToken } from "../ast/generated/kinds.js";
import { NodeFlagsLet, NodeFlagsNone, NodeFlagsSynthesized } from "../ast/generated/flags.js";
import { IsBlock, IsCallExpression, IsFunctionDeclaration, IsIdentifier, IsNotEmittedStatement, IsPrivateIdentifier, IsVariableStatement } from "../ast/generated/predicates.js";
import { AsBlock, AsVariableDeclarationList, AsVariableStatement } from "../ast/generated/casts.js";
import { NewBlock, NewConditionalExpression, NewEmptyStatement, NewExpressionStatement, NewIfStatement, NewReturnStatement, NewNotEmittedStatement, NewToken, NewVariableDeclaration, NewVariableDeclarationList, NewVariableStatement } from "../ast/generated/factory.js";
import { IsParseTreeNode, IsMemberName, IsBindingPattern } from "../ast/utilities.js";
import { Node_Expression, Node_StatementList, Node_Statements, Node_Text, Node_Initializer } from "../ast/ast.js";
import { findSpanEnd, findSpanEndWithEmitContext } from "./utilities.js";
import type { OrderedSet } from "../collections/ordered_set.js";
import { OrderedSet_Add, OrderedSet_Clear, OrderedSet_Values } from "../collections/ordered_set.js";
import type { Set } from "../collections/set.js";
import { Set_Add, Set_Has } from "../collections/set.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has, LinkStore_TryGet } from "../core/linkstore.js";
import type { Stack } from "../core/stack.js";
import { Stack_Peek, Stack_Pop, Stack_Push } from "../core/stack.js";
import { AppendIfUnique, Concatenate, Every, Splice } from "../core/core.js";
import type { TextRange } from "../core/text.js";
import { NewTextRange } from "../core/text.js";
import { IsPrologueDirective } from "../ast/utilities.js";
import type { EmitFlags as EmitFlags_30313d69 } from "./emitflags.js";
import { EFCustomPrologue, EFExternalHelpers, EFHelperName, EFNone, EFNoComments, EFNoNestedSourceMaps, EFNoSourceMap, EFNoTrailingSourceMap, EFNoTokenSourceMaps, EFSingleLine } from "./emitflags.js";
import type { NodeFactory } from "./factory.js";
import { NewNodeFactory, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewAssignmentExpression, NodeFactory_NewStrictEqualityExpression, NodeFactory_NewVoidZeroExpression, NodeFactory_NewTypeCheck } from "./factory.js";
import { NewNodeVisitor, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitEmbeddedStatement } from "../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor, NodeVisitorHooks } from "../ast/visitor.js";
import type { GeneratedIdentifierFlags } from "./generatedidentifierflags.js";
import { GeneratedIdentifierFlags_IsNode } from "./generatedidentifierflags.js";
import type { EmitHelper } from "./helpers.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::EmitContext","kind":"type","status":"implemented","sigHash":"6d5f48a2b47922c7624b8c9a29245f8616e2ace7e8c5704549fa66ece9746147","bodyHash":"b083d2b71a33dd0938a450bcb8507be1d6919e9ba4428dd4671613a61c5bb95b"}
 *
 * Go source:
 * EmitContext struct {
 * 	Factory       *NodeFactory // Required. The NodeFactory to use to create new nodes
 * 	autoGenerate  map[*ast.MemberName]*AutoGenerateInfo
 * 	textSource    map[*ast.StringLiteralNode]*ast.Node
 * 	original      map[*ast.Node]*ast.Node
 * 	emitNodes     core.LinkStore[*ast.Node, emitNode]
 * 	assignedName  map[*ast.Node]*ast.Expression
 * 	classThis     map[*ast.Node]*ast.IdentifierNode
 * 	varScopeStack core.Stack[*varScope]
 * 	letScopeStack core.Stack[*varScope]
 * 	emitHelpers   collections.OrderedSet[*EmitHelper]
 * }
 */
export interface EmitContext {
  Factory: GoPtr<NodeFactory>;
  autoGenerate: GoMap<GoPtr<MemberName>, GoPtr<AutoGenerateInfo>>;
  textSource: GoMap<GoPtr<StringLiteralNode>, GoPtr<Node>>;
  original: GoMap<GoPtr<Node>, GoPtr<Node>>;
  emitNodes: LinkStore<GoPtr<Node>, emitNode>;
  assignedName: GoMap<GoPtr<Node>, GoPtr<Expression>>;
  classThis: GoMap<GoPtr<Node>, GoPtr<IdentifierNode>>;
  varScopeStack: Stack<GoPtr<varScope>>;
  letScopeStack: Stack<GoPtr<varScope>>;
  emitHelpers: OrderedSet<GoPtr<EmitHelper>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::environmentFlags","kind":"type","status":"implemented","sigHash":"5c402b92fe7a3c9460624a9c34785d02bbbf1877e43007cea315e1296fc9391e","bodyHash":"ac3a922abcf83e92c419d043fbb489cc539c9d5d80fbcea4775bd53b1cc8f9fa"}
 *
 * Go source:
 * environmentFlags int
 */
export type environmentFlags = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::constGroup::environmentFlagsNone+environmentFlagsInParameters+environmentFlagsVariablesHoistedInParameters","kind":"constGroup","status":"implemented","sigHash":"cc24add154434ca0dbc8005182e589bc68292a9cea57504f25fa8daebb5290bf","bodyHash":"10eb0123674a891cc6fec306160b7881fc0a561032e5a8f1d74b533363db034a"}
 *
 * Go source:
 * const (
 * 	environmentFlagsNone                         environmentFlags = 0
 * 	environmentFlagsInParameters                 environmentFlags = 1 << 0 // currently visiting a parameter list
 * 	environmentFlagsVariablesHoistedInParameters environmentFlags = 1 << 1 // a temp variable was hoisted while visiting a parameter list
 * )
 */
export const environmentFlagsNone: environmentFlags = 0;
export const environmentFlagsInParameters: environmentFlags = 1 << 0; // currently visiting a parameter list
export const environmentFlagsVariablesHoistedInParameters: environmentFlags = 1 << 1; // a temp variable was hoisted while visiting a parameter list

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::varScope","kind":"type","status":"implemented","sigHash":"1aba1a18b011caf135d9fc5e200b6c504db0f22cb8c0063626d1d36fd7e75e68","bodyHash":"646291e63051089401a309685fe402e8964e761ceeb0598368c5848215be48de"}
 *
 * Go source:
 * varScope struct {
 * 	variables                []*ast.VariableDeclarationNode
 * 	functions                []*ast.FunctionDeclarationNode
 * 	flags                    environmentFlags
 * 	initializationStatements []*ast.Node
 * }
 */
export interface varScope {
  variables: GoSlice<GoPtr<VariableDeclarationNode>>;
  functions: GoSlice<GoPtr<FunctionDeclarationNode>>;
  flags: environmentFlags;
  initializationStatements: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::func::NewEmitContext","kind":"func","status":"implemented","sigHash":"0b395d75652f56838e777b2197f5c70872381af6c11730065114c0423830c168","bodyHash":"ffca9a64d7a4b9fe59567a0bf8437c0d078bb11abca7488990c14f1adc9d8b4a"}
 *
 * Go source:
 * func NewEmitContext() *EmitContext {
 * 	c := &EmitContext{}
 * 	c.Factory = NewNodeFactory(c)
 * 	return c
 * }
 */
export function NewEmitContext(): GoPtr<EmitContext> {
  const c: EmitContext = {
    Factory: undefined,
    autoGenerate: new globalThis.Map(),
    textSource: new globalThis.Map(),
    original: new globalThis.Map(),
    emitNodes: { entries: new globalThis.Map(), arena: { data: [] } },
    assignedName: new globalThis.Map(),
    classThis: new globalThis.Map(),
    varScopeStack: { data: [] },
    letScopeStack: { data: [] },
    emitHelpers: { m: { __tsgoBlank0: {}, keys: [], mp: new globalThis.Map() } },
  };
  c.Factory = NewNodeFactory(c);
  return c;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::varGroup::emitContextPool","kind":"varGroup","status":"implemented","sigHash":"5a60168a529115de856d1bf442db6aa4469fb20bee512d531b3531b9a47a29df","bodyHash":"db9d999dd8fb35432e1e19fadd8624323bc5d5934c2cfdf85949fa5336a2f625"}
 *
 * Go source:
 * var emitContextPool = sync.Pool{
 * 	New: func() any {
 * 		return NewEmitContext()
 * 	},
 * }
 */
export const emitContextPool: Pool<GoPtr<EmitContext>> = (() => {
  const p = new Pool<GoPtr<EmitContext>>();
  p.New = () => NewEmitContext();
  return p;
})();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::func::GetEmitContext","kind":"func","status":"implemented","sigHash":"262e5bdbc4909895c8eeba2e455361f11a519c90925fa3ca63c47afb4e4b3306","bodyHash":"f95c0eee382091d36bbcf65efb5d516086d4881f87e45114a658ac85087ef1dd"}
 *
 * Go source:
 * func GetEmitContext() (*EmitContext, func()) {
 * 	c := emitContextPool.Get().(*EmitContext)
 * 	return c, func() {
 * 		c.Reset()
 * 		emitContextPool.Put(c)
 * 	}
 * }
 */
export function GetEmitContext(): [GoPtr<EmitContext>, () => void] {
  const c = emitContextPool.Get()!;
  return [c, () => {
    EmitContext_Reset(c);
    emitContextPool.Put(c);
  }];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.Reset","kind":"method","status":"implemented","sigHash":"9537686805d81d76695f9add429d7b078c87fc4f434f2a0b064fee59ff36e444","bodyHash":"8f6519f9a7f1f348b11db0a30ef11e7fca5dd0f159ca97b4ecb11ec0de61058e"}
 *
 * Go source:
 * func (c *EmitContext) Reset() {
 * 	*c = EmitContext{
 * 		Factory: c.Factory,
 * 	}
 * }
 */
export function EmitContext_Reset(receiver: GoPtr<EmitContext>): void {
  const c = receiver!;
  const factory = c.Factory;
  c.autoGenerate = new globalThis.Map();
  c.textSource = new globalThis.Map();
  c.original = new globalThis.Map();
  c.emitNodes = { entries: new globalThis.Map(), arena: { data: [] } };
  c.assignedName = new globalThis.Map();
  c.classThis = new globalThis.Map();
  c.varScopeStack = { data: [] };
  c.letScopeStack = { data: [] };
  c.emitHelpers = { m: { __tsgoBlank0: {}, keys: [], mp: new globalThis.Map() } };
  c.Factory = factory;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.onCreate","kind":"method","status":"implemented","sigHash":"3fea21ea58188f5f5d4f4189719d5d476b4782b607610ec92c7670053464ba77","bodyHash":"2e9d01c5145bbeeae475ae9e5c8ceefc85851989dbee0f1d601f320ba7f58a6c"}
 *
 * Go source:
 * func (c *EmitContext) onCreate(node *ast.Node) {
 * 	node.Flags |= ast.NodeFlagsSynthesized
 * }
 */
export function EmitContext_onCreate(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): void {
  node!.Flags = (node!.Flags | NodeFlagsSynthesized) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.onUpdate","kind":"method","status":"implemented","sigHash":"dded69733c4b88de1ca90eecfc340cfa25cfe3f2fe81635672ceb4ac4d93b800","bodyHash":"ba37d186157a9f54c49a5a713905662473375f5efbd7f642b75b777358604659"}
 *
 * Go source:
 * func (c *EmitContext) onUpdate(updated *ast.Node, original *ast.Node) {
 * 	c.SetOriginal(updated, original)
 * }
 */
export function EmitContext_onUpdate(receiver: GoPtr<EmitContext>, updated: GoPtr<Node>, original: GoPtr<Node>): void {
  EmitContext_SetOriginal(receiver, updated, original);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.onClone","kind":"method","status":"implemented","sigHash":"cecd37c0056aa40a667368e957cec8d5948034c6aa478f9901e5f06df7fc89b3","bodyHash":"43e528aa6677734ecb502aaf669b8a1633b9da5019a7463db38aff7326d75ec4"}
 *
 * Go source:
 * func (c *EmitContext) onClone(updated *ast.Node, original *ast.Node) {
 * 	c.SetOriginal(updated, original)
 * 	if ast.IsIdentifier(updated) || ast.IsPrivateIdentifier(updated) {
 * 		if autoGenerate := c.autoGenerate[original]; autoGenerate != nil {
 * 			autoGenerateCopy := *autoGenerate
 * 			c.autoGenerate[updated] = &autoGenerateCopy
 * 		}
 * 	}
 * }
 */
export function EmitContext_onClone(receiver: GoPtr<EmitContext>, updated: GoPtr<Node>, original: GoPtr<Node>): void {
  const c = receiver!;
  EmitContext_SetOriginal(receiver, updated, original);
  if (IsIdentifier(updated) || IsPrivateIdentifier(updated)) {
    const autoGenerate = c.autoGenerate.get(original);
    if (autoGenerate !== undefined) {
      const autoGenerateCopy: AutoGenerateInfo = { ...autoGenerate };
      c.autoGenerate.set(updated, autoGenerateCopy);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.NewNodeVisitor","kind":"method","status":"implemented","sigHash":"a47365cc4bb72f274a8084ec61475526e0f07ab233a715f166b747316f8c212d","bodyHash":"f2bc514c5b66dc5df85cd27bdcac31f39fc7a51a87a3d58a8cccfa77a93d68f3"}
 *
 * Go source:
 * func (c *EmitContext) NewNodeVisitor(visit func(node *ast.Node) *ast.Node) *ast.NodeVisitor {
 * 	return ast.NewNodeVisitor(visit, c.Factory.AsNodeFactory(), ast.NodeVisitorHooks{
 * 		VisitParameters:         c.VisitParameters,
 * 		VisitFunctionBody:       c.VisitFunctionBody,
 * 		VisitIterationBody:      c.VisitIterationBody,
 * 		VisitTopLevelStatements: c.VisitVariableEnvironment,
 * 		VisitEmbeddedStatement:  c.VisitEmbeddedStatement,
 * 	})
 * }
 */
export function EmitContext_NewNodeVisitor(receiver: GoPtr<EmitContext>, visit: (node: GoPtr<Node>) => GoPtr<Node>): GoPtr<ConcreteNodeVisitor> {
  const hooks: NodeVisitorHooks = {
    VisitParameters: (nodes, visitor) => EmitContext_VisitParameters(receiver, nodes, visitor as GoPtr<NodeVisitor>),
    VisitFunctionBody: (node, visitor) => EmitContext_VisitFunctionBody(receiver, node, visitor as GoPtr<NodeVisitor>),
    VisitIterationBody: (body, visitor) => EmitContext_VisitIterationBody(receiver, body, visitor as GoPtr<NodeVisitor>),
    VisitTopLevelStatements: (nodes, visitor) => EmitContext_VisitVariableEnvironment(receiver, nodes, visitor as GoPtr<NodeVisitor>),
    VisitEmbeddedStatement: (node, visitor) => EmitContext_VisitEmbeddedStatement(receiver, node, visitor as GoPtr<NodeVisitor>),
  } as NodeVisitorHooks;
  return NewNodeVisitor(visit, NodeFactory_AsNodeFactory(receiver!.Factory!.__tsgoEmbedded0!), hooks);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.StartVariableEnvironment","kind":"method","status":"implemented","sigHash":"3823124abd2df1785258bbd7cd3ea18e2c45a5271aff6c43f584c412c6cfe6b5","bodyHash":"1be357d4a7f55cf3964a3736a303ed7ac25f49274b74d53fa3eebcdd603df0fd"}
 *
 * Go source:
 * func (c *EmitContext) StartVariableEnvironment() {
 * 	c.varScopeStack.Push(&varScope{})
 * 	c.StartLexicalEnvironment()
 * }
 */
export function EmitContext_StartVariableEnvironment(receiver: GoPtr<EmitContext>): void {
  const c = receiver!;
  const scope: varScope = { variables: [], functions: [], flags: environmentFlagsNone, initializationStatements: [] };
  Stack_Push(c.varScopeStack, scope);
  EmitContext_StartLexicalEnvironment(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndVariableEnvironment","kind":"method","status":"implemented","sigHash":"44e1cc0a2848d6394b23c5adfb4fe045d357aaab41d1cd8e654a0630bbdce6c4","bodyHash":"66f24f7ce0b25f7cb2e6340539a140eff3cbd5d6cb19321e3affd441bfa90c0c"}
 *
 * Go source:
 * func (c *EmitContext) EndVariableEnvironment() []*ast.Statement {
 * 	scope := c.varScopeStack.Pop()
 * 	var statements []*ast.Statement
 * 	if len(scope.functions) > 0 {
 * 		statements = slices.Clone(scope.functions)
 * 	}
 * 	if len(scope.variables) > 0 {
 * 		varDeclList := c.Factory.NewVariableDeclarationList(c.Factory.NewNodeList(scope.variables), ast.NodeFlagsNone)
 * 		varStatement := c.Factory.NewVariableStatement(nil /*modifiers* /, varDeclList)
 * 		c.SetEmitFlags(varStatement, EFCustomPrologue)
 * 		statements = append(statements, varStatement)
 * 	}
 * 	if len(scope.initializationStatements) > 0 {
 * 		statements = append(statements, scope.initializationStatements...)
 * 	}
 * 	return append(statements, c.EndLexicalEnvironment()...)
 * }
 */
export function EmitContext_EndVariableEnvironment(receiver: GoPtr<EmitContext>): GoSlice<GoPtr<Statement>> {
  const c = receiver!;
  const scope = Stack_Pop(c.varScopeStack)!;
  const baseFunctions = scope.functions.length > 0 ? slices.Clone(scope.functions)! : ([] as GoSlice<GoPtr<Statement>>);
  const withVariables = scope.variables.length > 0 ? (() => {
    const f = c.Factory!.__tsgoEmbedded0!;
    const varDeclList = NewVariableDeclarationList(f, NodeFactory_NewNodeList(f, scope.variables), NodeFlagsNone);
    const varStatement = NewVariableStatement(f, undefined, varDeclList);
    EmitContext_SetEmitFlags(receiver, varStatement, EFCustomPrologue);
    return [...baseFunctions, varStatement];
  })() : baseFunctions;
  const withInit = scope.initializationStatements.length > 0
    ? [...withVariables, ...scope.initializationStatements]
    : withVariables;
  return [...withInit, ...EmitContext_EndLexicalEnvironment(receiver)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndAndMergeVariableEnvironmentList","kind":"method","status":"implemented","sigHash":"4571c60554643237a1f3e3ec7ecbf39a31dcf482f6558a8bc7ed9bf884a03549","bodyHash":"6e05947764c62e8567003ff8c374671e3c9cb8906121f233bb5cc5c9c6306d13"}
 *
 * Go source:
 * func (c *EmitContext) EndAndMergeVariableEnvironmentList(statements *ast.StatementList) *ast.StatementList {
 * 	var nodes []*ast.Statement
 * 	if statements != nil {
 * 		nodes = statements.Nodes
 * 	}
 * 
 * 	if result, changed := c.endAndMergeVariableEnvironment(nodes); changed {
 * 		list := c.Factory.NewNodeList(result)
 * 		list.Loc = statements.Loc
 * 		return list
 * 	}
 * 
 * 	return statements
 * }
 */
export function EmitContext_EndAndMergeVariableEnvironmentList(receiver: GoPtr<EmitContext>, statements: GoPtr<StatementList>): GoPtr<StatementList> {
  const c = receiver!;
  const nodes: GoSlice<GoPtr<Statement>> = statements !== undefined ? statements.Nodes : [];

  const [result, changed] = EmitContext_endAndMergeVariableEnvironment(receiver, nodes);
  if (changed) {
    const list = NodeFactory_NewNodeList(c.Factory!.__tsgoEmbedded0!, result)!;
    list.Loc = statements!.Loc;
    return list;
  }

  return statements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndAndMergeVariableEnvironment","kind":"method","status":"implemented","sigHash":"004436f3bbe8757a004f9ec65ce015d9c855f39d7b30a02d08dcb7f05904fd62","bodyHash":"f4cb8793a0a7d1ca1bca0b73ffb69eed96ccc9ebb151007e1d6871c642836ad9"}
 *
 * Go source:
 * func (c *EmitContext) EndAndMergeVariableEnvironment(statements []*ast.Statement) []*ast.Statement {
 * 	result, _ := c.endAndMergeVariableEnvironment(statements)
 * 	return result
 * }
 */
export function EmitContext_EndAndMergeVariableEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  const [result] = EmitContext_endAndMergeVariableEnvironment(receiver, statements);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.endAndMergeVariableEnvironment","kind":"method","status":"implemented","sigHash":"afa40f52ad272e35371f2ee79c0b74ab2abcd2fbeb81d05e3741021f05f92cf9","bodyHash":"4fa22dac65a303d763395ed0d6436ba05e5004894a33a1a8f384d029660ef671"}
 *
 * Go source:
 * func (c *EmitContext) endAndMergeVariableEnvironment(statements []*ast.Statement) ([]*ast.Statement, bool) {
 * 	return c.mergeEnvironment(statements, c.EndVariableEnvironment())
 * }
 */
export function EmitContext_endAndMergeVariableEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>): [GoSlice<GoPtr<Statement>>, bool] {
  return EmitContext_mergeEnvironment(receiver, statements, EmitContext_EndVariableEnvironment(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddVariableDeclaration","kind":"method","status":"implemented","sigHash":"1e47d5c4beb99b1e7fe925e23b107d8dc80d231ba2a5d7f5697a2e7155a7e0e5","bodyHash":"6f3e3cc38ed0567db736693c410dca2e82f68c0c665422dd39308014f139d0ee"}
 *
 * Go source:
 * func (c *EmitContext) AddVariableDeclaration(name *ast.IdentifierNode) {
 * 	varDecl := c.Factory.NewVariableDeclaration(name, nil /*exclamationToken* /, nil /*typeNode* /, nil /*initializer* /)
 * 	c.SetEmitFlags(varDecl, EFNoNestedSourceMaps)
 * 	scope := c.varScopeStack.Peek()
 * 	scope.variables = append(scope.variables, varDecl)
 * 	if scope.flags&environmentFlagsInParameters != 0 {
 * 		scope.flags |= environmentFlagsVariablesHoistedInParameters
 * 	}
 * }
 */
export function EmitContext_AddVariableDeclaration(receiver: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): void {
  const c = receiver!;
  const varDecl = NewVariableDeclaration(c.Factory!.__tsgoEmbedded0!, name, undefined, undefined, undefined);
  EmitContext_SetEmitFlags(receiver, varDecl, EFNoNestedSourceMaps);
  const scope = Stack_Peek(c.varScopeStack)!;
  scope.variables = [...scope.variables, varDecl];
  if ((scope.flags & environmentFlagsInParameters) !== 0) {
    scope.flags = scope.flags | environmentFlagsVariablesHoistedInParameters;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddHoistedFunctionDeclaration","kind":"method","status":"implemented","sigHash":"4c97a0839da40d9d838c0fb8603f86ad13e668394136ee75cbfb8f91b4902102","bodyHash":"af9318567d75e1a71663d2009d0d38120e8ae38513d5c1cb8cacd22bb0cb471b"}
 *
 * Go source:
 * func (c *EmitContext) AddHoistedFunctionDeclaration(node *ast.FunctionDeclarationNode) {
 * 	c.SetEmitFlags(node, EFCustomPrologue)
 * 	scope := c.varScopeStack.Peek()
 * 	scope.functions = append(scope.functions, node)
 * }
 */
export function EmitContext_AddHoistedFunctionDeclaration(receiver: GoPtr<EmitContext>, node: GoPtr<FunctionDeclarationNode>): void {
  const c = receiver!;
  EmitContext_SetEmitFlags(receiver, node, EFCustomPrologue);
  const scope = Stack_Peek(c.varScopeStack)!;
  scope.functions = [...scope.functions, node];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.StartLexicalEnvironment","kind":"method","status":"implemented","sigHash":"26ca7a85315d92d070842842786349c81ecc90acac2c8d42edb088332838ba78","bodyHash":"893aab5c790bfa65db5ec6bcc41784852cf87e13f915dff26a14a93eae26bd62"}
 *
 * Go source:
 * func (c *EmitContext) StartLexicalEnvironment() {
 * 	c.letScopeStack.Push(&varScope{})
 * }
 */
export function EmitContext_StartLexicalEnvironment(receiver: GoPtr<EmitContext>): void {
  const c = receiver!;
  const scope: varScope = { variables: [], functions: [], flags: environmentFlagsNone, initializationStatements: [] };
  Stack_Push(c.letScopeStack, scope);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndLexicalEnvironment","kind":"method","status":"implemented","sigHash":"b00848bf5bc8b33c5266ae922fcb68504068ebd089b75cb8d5d237266e2096ed","bodyHash":"a2ece5870ac636d419cbabf4926dc705be28987de7500f7154e5e9ccd078fda3"}
 *
 * Go source:
 * func (c *EmitContext) EndLexicalEnvironment() []*ast.Statement {
 * 	scope := c.letScopeStack.Pop()
 * 	var statements []*ast.Statement
 * 	if len(scope.variables) > 0 {
 * 		varDeclList := c.Factory.NewVariableDeclarationList(c.Factory.NewNodeList(scope.variables), ast.NodeFlagsLet)
 * 		varStatement := c.Factory.NewVariableStatement(nil /*modifiers* /, varDeclList)
 * 		c.SetEmitFlags(varStatement, EFCustomPrologue)
 * 		statements = append(statements, varStatement)
 * 	}
 * 	return statements
 * }
 */
export function EmitContext_EndLexicalEnvironment(receiver: GoPtr<EmitContext>): GoSlice<GoPtr<Statement>> {
  const c = receiver!;
  const scope = Stack_Pop(c.letScopeStack)!;
  if (scope.variables.length === 0) return [];
  const f = c.Factory!.__tsgoEmbedded0!;
  const varDeclList = NewVariableDeclarationList(f, NodeFactory_NewNodeList(f, scope.variables), NodeFlagsLet);
  const varStatement = NewVariableStatement(f, undefined, varDeclList);
  EmitContext_SetEmitFlags(receiver, varStatement, EFCustomPrologue);
  return [varStatement];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndAndMergeLexicalEnvironmentList","kind":"method","status":"implemented","sigHash":"90d7a8f91047db988046504b07d462707d33099bcfdc431c499f4c7d76a04279","bodyHash":"56ef7355afd72e9f0bd3aba9e1dcf5b206be92863fb35e72fe5b61fc36db088d"}
 *
 * Go source:
 * func (c *EmitContext) EndAndMergeLexicalEnvironmentList(statements *ast.StatementList) *ast.StatementList {
 * 	var nodes []*ast.Statement
 * 	if statements != nil {
 * 		nodes = statements.Nodes
 * 	}
 * 
 * 	if result, changed := c.endAndMergeLexicalEnvironment(nodes); changed {
 * 		list := c.Factory.NewNodeList(result)
 * 		list.Loc = statements.Loc
 * 		return list
 * 	}
 * 
 * 	return statements
 * }
 */
export function EmitContext_EndAndMergeLexicalEnvironmentList(receiver: GoPtr<EmitContext>, statements: GoPtr<StatementList>): GoPtr<StatementList> {
  const c = receiver!;
  const nodes: GoSlice<GoPtr<Statement>> = statements !== undefined ? statements.Nodes : [];

  const [result, changed] = EmitContext_endAndMergeLexicalEnvironment(receiver, nodes);
  if (changed) {
    const list = NodeFactory_NewNodeList(c.Factory!.__tsgoEmbedded0!, result)!;
    list.Loc = statements!.Loc;
    return list;
  }

  return statements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EndAndMergeLexicalEnvironment","kind":"method","status":"implemented","sigHash":"0306276ccfd7be4c64c5b598b44606bea87ca58369b7ecc835ffa9b5d484bb38","bodyHash":"522926f80847d50de79786829a621a5d183f03025136a62587b007d77d0a6953"}
 *
 * Go source:
 * func (c *EmitContext) EndAndMergeLexicalEnvironment(statements []*ast.Statement) []*ast.Statement {
 * 	result, _ := c.endAndMergeLexicalEnvironment(statements)
 * 	return result
 * }
 */
export function EmitContext_EndAndMergeLexicalEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  const [result] = EmitContext_endAndMergeLexicalEnvironment(receiver, statements);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.endAndMergeLexicalEnvironment","kind":"method","status":"implemented","sigHash":"c48c7ee54db71c784de5da0b383b8548188a971a6389b893840b7a442bef0c0f","bodyHash":"879ef05d915661629603b9a402a808b61608d777adff3e24c28e5341c59cbd91"}
 *
 * Go source:
 * func (c *EmitContext) endAndMergeLexicalEnvironment(statements []*ast.Statement) ([]*ast.Statement, bool) {
 * 	return c.mergeEnvironment(statements, c.EndLexicalEnvironment())
 * }
 */
export function EmitContext_endAndMergeLexicalEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>): [GoSlice<GoPtr<Statement>>, bool] {
  return EmitContext_mergeEnvironment(receiver, statements, EmitContext_EndLexicalEnvironment(receiver));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddLexicalDeclaration","kind":"method","status":"implemented","sigHash":"ca168535efb00c472a550bfcffe77c8a8e25f67b8c79498aa3cfc86bcf1559eb","bodyHash":"e32f6aa8b3c04254eed040fd930f49ab74db80a2e15a27c0ccbbd86a0c9fd8cc"}
 *
 * Go source:
 * func (c *EmitContext) AddLexicalDeclaration(name *ast.IdentifierNode) {
 * 	varDecl := c.Factory.NewVariableDeclaration(name, nil /*exclamationToken* /, nil /*typeNode* /, nil /*initializer* /)
 * 	c.SetEmitFlags(varDecl, EFNoNestedSourceMaps)
 * 	scope := c.letScopeStack.Peek()
 * 	scope.variables = append(scope.variables, varDecl)
 * }
 */
export function EmitContext_AddLexicalDeclaration(receiver: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): void {
  const c = receiver!;
  const varDecl = NewVariableDeclaration(c.Factory!.__tsgoEmbedded0!, name, undefined, undefined, undefined);
  EmitContext_SetEmitFlags(receiver, varDecl, EFNoNestedSourceMaps);
  const scope = Stack_Peek(c.letScopeStack)!;
  scope.variables = [...scope.variables, varDecl];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.MergeEnvironmentList","kind":"method","status":"implemented","sigHash":"e4124126e4036e288523c6bd7ae459863a2e24dc9ab7663c395600fb6b84b23f","bodyHash":"081375e67b69010bd2b6bdfd88b047c3deab9be08194449863c2305efb7b15ee"}
 *
 * Go source:
 * func (c *EmitContext) MergeEnvironmentList(statements *ast.StatementList, declarations []*ast.Statement) *ast.StatementList {
 * 	if result, changed := c.mergeEnvironment(statements.Nodes, declarations); changed {
 * 		list := c.Factory.NewNodeList(result)
 * 		list.Loc = statements.Loc
 * 		return list
 * 	}
 * 	return statements
 * }
 */
export function EmitContext_MergeEnvironmentList(receiver: GoPtr<EmitContext>, statements: GoPtr<StatementList>, declarations: GoSlice<GoPtr<Statement>>): GoPtr<StatementList> {
  const c = receiver!;
  const [result, changed] = EmitContext_mergeEnvironment(receiver, statements!.Nodes, declarations);
  if (changed) {
    const list = NodeFactory_NewNodeList(c.Factory!.__tsgoEmbedded0!, result)!;
    list.Loc = statements!.Loc;
    return list;
  }
  return statements;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.MergeEnvironment","kind":"method","status":"implemented","sigHash":"2e155ebb7597f5b89c77384b2dcd1104185b1e97dd56be106768af7346592f15","bodyHash":"b60cd704f073e356b601fc870de7dcbef4bf741ed0ea752f3d90856ce7227db0"}
 *
 * Go source:
 * func (c *EmitContext) MergeEnvironment(statements []*ast.Statement, declarations []*ast.Statement) []*ast.Statement {
 * 	result, _ := c.mergeEnvironment(statements, declarations)
 * 	return result
 * }
 */
export function EmitContext_MergeEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>, declarations: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  const [result] = EmitContext_mergeEnvironment(receiver, statements, declarations);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.mergeEnvironment","kind":"method","status":"implemented","sigHash":"313e7c2d060583f6bf51d6478f2f67c374bbf3eb68f4dc683dac0152254e90de","bodyHash":"7a954754899712663ae43da17cc3d7dcb258993aca4bde7c26c9fbe500259a4a"}
 *
 * Go source:
 * func (c *EmitContext) mergeEnvironment(statements []*ast.Statement, declarations []*ast.Statement) ([]*ast.Statement, bool) {
 * 	if len(declarations) == 0 {
 * 		return statements, false
 * 	}
 * 
 * 	// When we merge new lexical statements into an existing statement list, we merge them in the following manner:
 * 	//
 * 	// Given:
 * 	//
 * 	// | Left                               | Right                               |
 * 	// |------------------------------------|-------------------------------------|
 * 	// | [standard prologues (left)]        | [standard prologues (right)]        |
 * 	// | [hoisted functions (left)]         | [hoisted functions (right)]         |
 * 	// | [hoisted variables (left)]         | [hoisted variables (right)]         |
 * 	// | [lexical init statements (left)]   | [lexical init statements (right)]   |
 * 	// | [other statements (left)]          |                                     |
 * 	//
 * 	// The resulting statement list will be:
 * 	//
 * 	// | Result                              |
 * 	// |-------------------------------------|
 * 	// | [standard prologues (right)]        |
 * 	// | [standard prologues (left)]         |
 * 	// | [hoisted functions (right)]         |
 * 	// | [hoisted functions (left)]          |
 * 	// | [hoisted variables (right)]         |
 * 	// | [hoisted variables (left)]          |
 * 	// | [lexical init statements (right)]   |
 * 	// | [lexical init statements (left)]    |
 * 	// | [other statements (left)]           |
 * 	//
 * 	// NOTE: It is expected that new lexical init statements must be evaluated before existing lexical init statements,
 * 	// as the prior transformation may depend on the evaluation of the lexical init statements to be in the correct state.
 * 
 * 	changed := false
 * 
 * 	// find standard prologues on left in the following order: standard directives, hoisted functions, hoisted variables, other custom
 * 	leftStandardPrologueEnd := findSpanEnd(statements, ast.IsPrologueDirective, 0)
 * 	leftHoistedFunctionsEnd := findSpanEndWithEmitContext(c, statements, (*EmitContext).isHoistedFunction, leftStandardPrologueEnd)
 * 	leftHoistedVariablesEnd := findSpanEndWithEmitContext(c, statements, (*EmitContext).isHoistedVariableStatement, leftHoistedFunctionsEnd)
 * 
 * 	// find standard prologues on right in the following order: standard directives, hoisted functions, hoisted variables, other custom
 * 	rightStandardPrologueEnd := findSpanEnd(declarations, ast.IsPrologueDirective, 0)
 * 	rightHoistedFunctionsEnd := findSpanEndWithEmitContext(c, declarations, (*EmitContext).isHoistedFunction, rightStandardPrologueEnd)
 * 	rightHoistedVariablesEnd := findSpanEndWithEmitContext(c, declarations, (*EmitContext).isHoistedVariableStatement, rightHoistedFunctionsEnd)
 * 	rightCustomPrologueEnd := findSpanEndWithEmitContext(c, declarations, (*EmitContext).isCustomPrologue, rightHoistedVariablesEnd)
 * 	if rightCustomPrologueEnd != len(declarations) {
 * 		panic("Expected declarations to be valid standard or custom prologues")
 * 	}
 * 
 * 	left := statements
 * 
 * 	// splice other custom prologues from right into left
 * 	if rightCustomPrologueEnd > rightHoistedVariablesEnd {
 * 		left = core.Splice(left, leftHoistedVariablesEnd, 0, declarations[rightHoistedVariablesEnd:rightCustomPrologueEnd]...)
 * 		changed = true
 * 	}
 * 
 * 	// splice hoisted variables from right into left
 * 	if rightHoistedVariablesEnd > rightHoistedFunctionsEnd {
 * 		left = core.Splice(left, leftHoistedFunctionsEnd, 0, declarations[rightHoistedFunctionsEnd:rightHoistedVariablesEnd]...)
 * 		changed = true
 * 	}
 * 
 * 	// splice hoisted functions from right into left
 * 	if rightHoistedFunctionsEnd > rightStandardPrologueEnd {
 * 		left = core.Splice(left, leftStandardPrologueEnd, 0, declarations[rightStandardPrologueEnd:rightHoistedFunctionsEnd]...)
 * 		changed = true
 * 	}
 * 
 * 	// splice standard prologues from right into left (that are not already in left)
 * 	if rightStandardPrologueEnd > 0 {
 * 		if leftStandardPrologueEnd == 0 {
 * 			left = core.Splice(left, 0, 0, declarations[:rightStandardPrologueEnd]...)
 * 			changed = true
 * 		} else {
 * 			var leftPrologues collections.Set[string]
 * 			for i := range leftStandardPrologueEnd {
 * 				leftPrologue := statements[i]
 * 				leftPrologues.Add(leftPrologue.Expression().Text())
 * 			}
 * 			for i := rightStandardPrologueEnd - 1; i >= 0; i-- {
 * 				rightPrologue := declarations[i]
 * 				if !leftPrologues.Has(rightPrologue.Expression().Text()) {
 * 					left = core.Concatenate([]*ast.Statement{rightPrologue}, left)
 * 					changed = true
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	return left, changed
 * }
 */
export function EmitContext_mergeEnvironment(receiver: GoPtr<EmitContext>, statements: GoSlice<GoPtr<Statement>>, declarations: GoSlice<GoPtr<Statement>>): [GoSlice<GoPtr<Statement>>, bool] {
  if (declarations.length === 0) {
    return [statements, false];
  }

  let changed = false;

  // find standard prologues on left in the following order: standard directives, hoisted functions, hoisted variables, other custom
  const leftStandardPrologueEnd = findSpanEnd(statements, IsPrologueDirective, 0);
  const leftHoistedFunctionsEnd = findSpanEndWithEmitContext(receiver, statements, EmitContext_isHoistedFunction, leftStandardPrologueEnd);
  const leftHoistedVariablesEnd = findSpanEndWithEmitContext(receiver, statements, EmitContext_isHoistedVariableStatement, leftHoistedFunctionsEnd);

  // find standard prologues on right in the following order: standard directives, hoisted functions, hoisted variables, other custom
  const rightStandardPrologueEnd = findSpanEnd(declarations, IsPrologueDirective, 0);
  const rightHoistedFunctionsEnd = findSpanEndWithEmitContext(receiver, declarations, EmitContext_isHoistedFunction, rightStandardPrologueEnd);
  const rightHoistedVariablesEnd = findSpanEndWithEmitContext(receiver, declarations, EmitContext_isHoistedVariableStatement, rightHoistedFunctionsEnd);
  const rightCustomPrologueEnd = findSpanEndWithEmitContext(receiver, declarations, EmitContext_isCustomPrologue, rightHoistedVariablesEnd);
  if (rightCustomPrologueEnd !== declarations.length) {
    throw new globalThis.Error("Expected declarations to be valid standard or custom prologues");
  }

  let left = statements;

  // splice other custom prologues from right into left
  if (rightCustomPrologueEnd > rightHoistedVariablesEnd) {
    left = Splice(left, leftHoistedVariablesEnd, 0, ...declarations.slice(rightHoistedVariablesEnd, rightCustomPrologueEnd));
    changed = true;
  }

  // splice hoisted variables from right into left
  if (rightHoistedVariablesEnd > rightHoistedFunctionsEnd) {
    left = Splice(left, leftHoistedFunctionsEnd, 0, ...declarations.slice(rightHoistedFunctionsEnd, rightHoistedVariablesEnd));
    changed = true;
  }

  // splice hoisted functions from right into left
  if (rightHoistedFunctionsEnd > rightStandardPrologueEnd) {
    left = Splice(left, leftStandardPrologueEnd, 0, ...declarations.slice(rightStandardPrologueEnd, rightHoistedFunctionsEnd));
    changed = true;
  }

  // splice standard prologues from right into left (that are not already in left)
  if (rightStandardPrologueEnd > 0) {
    if (leftStandardPrologueEnd === 0) {
      left = Splice(left, 0, 0, ...declarations.slice(0, rightStandardPrologueEnd));
      changed = true;
    } else {
      const leftPrologues: Set<string> = { M: new globalThis.Map() };
      for (let i = 0; i < leftStandardPrologueEnd; i++) {
        const leftPrologue = statements[i]!;
        Set_Add(leftPrologues, Node_Text(leftPrologue));
      }
      for (let i = rightStandardPrologueEnd - 1; i >= 0; i--) {
        const rightPrologue = declarations[i]!;
        if (!Set_Has(leftPrologues, Node_Text(rightPrologue))) {
          left = Concatenate([rightPrologue], left);
          changed = true;
        }
      }
    }
  }

  return [left, changed];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.isCustomPrologue","kind":"method","status":"implemented","sigHash":"8a37baf3df6e0c83d52627f0df8ac65ee674d70e3ab5d04e76f8dbebe99460f3","bodyHash":"39c2473b8bfc40cd159dfd79a0d23f40537883df67e9b10da5c4ce4d61da0b54"}
 *
 * Go source:
 * func (c *EmitContext) isCustomPrologue(node *ast.Statement) bool {
 * 	return c.EmitFlags(node)&EFCustomPrologue != 0
 * }
 */
export function EmitContext_isCustomPrologue(receiver: GoPtr<EmitContext>, node: GoPtr<Statement>): bool {
  return ((EmitContext_EmitFlags(receiver, node) & EFCustomPrologue) >>> 0) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.isHoistedFunction","kind":"method","status":"implemented","sigHash":"38ebe34ca88cc99f2a00b87002e16b258560ff415a2dcd0162e6a408ecff92e2","bodyHash":"c351a96b79c1da07b23fb005d5b14aff3699e937ac6d32a3fc29a6b8e4abbae1"}
 *
 * Go source:
 * func (c *EmitContext) isHoistedFunction(node *ast.Statement) bool {
 * 	return c.isCustomPrologue(node) && ast.IsFunctionDeclaration(node)
 * }
 */
export function EmitContext_isHoistedFunction(receiver: GoPtr<EmitContext>, node: GoPtr<Statement>): bool {
  return EmitContext_isCustomPrologue(receiver, node) && IsFunctionDeclaration(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::func::isHoistedVariable","kind":"func","status":"implemented","sigHash":"d0321ac6cb99f8fcfcd24f88b1d1b26238b740bb4d7c3a49af28b6d8a7f6c28e","bodyHash":"2ee491c5d383207f9393a83df980285addb6b734d2374f3075a9ef0defb63f41"}
 *
 * Go source:
 * func isHoistedVariable(node *ast.VariableDeclarationNode) bool {
 * 	return ast.IsIdentifier(node.Name()) && node.Initializer() == nil
 * }
 */
export function isHoistedVariable(node: GoPtr<VariableDeclarationNode>): bool {
  return IsIdentifier(Node_Name(node)) && Node_Initializer(node) === undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.isHoistedVariableStatement","kind":"method","status":"implemented","sigHash":"1af9c1cbf030d26ba4910c7fee4b79fa83881984ff7916e59aaa6f25f592eccc","bodyHash":"7844a5a8a92826ed1186ee99e5db9a3f19c7e38836629b3ad08e01558d1a7dda"}
 *
 * Go source:
 * func (c *EmitContext) isHoistedVariableStatement(node *ast.Statement) bool {
 * 	return c.isCustomPrologue(node) &&
 * 		ast.IsVariableStatement(node) &&
 * 		core.Every(node.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes, isHoistedVariable)
 * }
 */
export function EmitContext_isHoistedVariableStatement(receiver: GoPtr<EmitContext>, node: GoPtr<Statement>): bool {
  return EmitContext_isCustomPrologue(receiver, node) &&
    IsVariableStatement(node) &&
    Every(AsVariableDeclarationList(AsVariableStatement(node)!.DeclarationList)!.Declarations!.Nodes, isHoistedVariable);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.HasAutoGenerateInfo","kind":"method","status":"implemented","sigHash":"fabd5e9009cdb12522da26c32e9705ac0d747915f5cc2204b89d400b430be247","bodyHash":"40827c7b8c5560e57e3c2d4d4c9284fc0b2f77aeada809575f6201d4dce32040"}
 *
 * Go source:
 * func (c *EmitContext) HasAutoGenerateInfo(node *ast.MemberName) bool {
 * 	if node != nil {
 * 		_, ok := c.autoGenerate[node]
 * 		return ok
 * 	}
 * 	return false
 * }
 */
export function EmitContext_HasAutoGenerateInfo(receiver: GoPtr<EmitContext>, node: GoPtr<MemberName>): bool {
  const c = receiver!;
  if (node !== undefined) {
    const ok = c.autoGenerate.has(node);
    return ok;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetAutoGenerateInfo","kind":"method","status":"implemented","sigHash":"1f71c3550925fae1ee3875500ba02d97085f8963fc9f6f1dbed539f58969fe2d","bodyHash":"938b197749c924c720fc1852aae85e5f468e890bc9f24b1c73c524e449018472"}
 *
 * Go source:
 * func (c *EmitContext) GetAutoGenerateInfo(name *ast.MemberName) *AutoGenerateInfo {
 * 	if name == nil {
 * 		return nil
 * 	}
 * 	return c.autoGenerate[name]
 * }
 */
export function EmitContext_GetAutoGenerateInfo(receiver: GoPtr<EmitContext>, name: GoPtr<MemberName>): GoPtr<AutoGenerateInfo> {
  const c = receiver!;
  if (name === undefined) {
    return undefined;
  }
  return c.autoGenerate.get(name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetNodeForGeneratedName","kind":"method","status":"implemented","sigHash":"9e312f26426b305a943c8c676e757362e745a9ef49254d9dddfae5d231e4ae17","bodyHash":"8faa38285b5115365a3cced6cc20e40ad219317ff2ca63149865cf16d38ca91f"}
 *
 * Go source:
 * func (c *EmitContext) GetNodeForGeneratedName(name *ast.MemberName) *ast.Node {
 * 	if autoGenerate := c.autoGenerate[name]; autoGenerate != nil && autoGenerate.Flags.IsNode() {
 * 		return c.getNodeForGeneratedNameWorker(autoGenerate.Node, autoGenerate.Id)
 * 	}
 * 	return name
 * }
 */
export function EmitContext_GetNodeForGeneratedName(receiver: GoPtr<EmitContext>, name: GoPtr<MemberName>): GoPtr<Node> {
  const c = receiver!;
  const autoGenerate = c.autoGenerate.get(name);
  if (autoGenerate !== undefined && GeneratedIdentifierFlags_IsNode(autoGenerate.Flags)) {
    return EmitContext_getNodeForGeneratedNameWorker(receiver, autoGenerate.Node, autoGenerate.Id);
  }
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.getNodeForGeneratedNameWorker","kind":"method","status":"implemented","sigHash":"5007c00bdccc08b6e8094c7aa6d3cd67d2a43747f705902538d0bb5caf0c4011","bodyHash":"430e73e92bfe88a14228fe3e989539db3100e3bdf7318bdc457a16b2804d2b5e"}
 *
 * Go source:
 * func (c *EmitContext) getNodeForGeneratedNameWorker(node *ast.Node, autoGenerateId AutoGenerateId) *ast.Node {
 * 	original := c.Original(node)
 * 	for original != nil {
 * 		node = original
 * 		if ast.IsMemberName(node) {
 * 			// if "node" is a different generated name (having a different "autoGenerateId"), use it and stop traversing.
 * 			autoGenerate := c.autoGenerate[node]
 * 			if autoGenerate == nil || autoGenerate.Flags.IsNode() && autoGenerate.Id != autoGenerateId {
 * 				break
 * 			}
 * 			if autoGenerate.Flags.IsNode() {
 * 				original = autoGenerate.Node
 * 				continue
 * 			}
 * 		}
 * 		original = c.Original(node)
 * 	}
 * 	return node
 * }
 */
export function EmitContext_getNodeForGeneratedNameWorker(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, autoGenerateId: AutoGenerateId): GoPtr<Node> {
  const c = receiver!;
  let original = EmitContext_Original(receiver, node);
  while (original !== undefined) {
    node = original;
    if (IsMemberName(node)) {
      // if "node" is a different generated name (having a different "autoGenerateId"), use it and stop traversing.
      const autoGenerate = c.autoGenerate.get(node);
      if (autoGenerate === undefined || (GeneratedIdentifierFlags_IsNode(autoGenerate.Flags) && autoGenerate.Id !== autoGenerateId)) {
        break;
      }
      if (GeneratedIdentifierFlags_IsNode(autoGenerate.Flags)) {
        original = autoGenerate.Node;
        continue;
      }
    }
    original = EmitContext_Original(receiver, node);
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::AutoGenerateOptions","kind":"type","status":"implemented","sigHash":"dd43c52864172fc1078fa1874ed8556bd9abfa69c82d4af5934a125db3611230","bodyHash":"93ac5fe93ba61dfbc68b7439b02b888874a5245ef5b426a808230fd631fbd894"}
 *
 * Go source:
 * AutoGenerateOptions struct {
 * 	Flags  GeneratedIdentifierFlags
 * 	Prefix string
 * 	Suffix string
 * }
 */
export interface AutoGenerateOptions {
  Flags: GeneratedIdentifierFlags;
  Prefix: string;
  Suffix: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::varGroup::nextAutoGenerateId","kind":"varGroup","status":"implemented","sigHash":"3b3400c9f408ee9815adc16f1cea91f820190f2948e945187a7cc586f0011030","bodyHash":"f7de593be0bdedf02ccb5bf0e4b6a0a98ea37bcbcfce6e71752c760debb63b04"}
 *
 * Go source:
 * var nextAutoGenerateId atomic.Uint32
 */
export const nextAutoGenerateId: Uint32 = new Uint32();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::AutoGenerateId","kind":"type","status":"implemented","sigHash":"22b430b286a3594ead6596c4569e738bac99d6628924f6ca4f0ce42f95246271","bodyHash":"9f2be36e96e0cbe37d003c9ab771d961db8d8c50827b81f4b4d389759cc3e672"}
 *
 * Go source:
 * AutoGenerateId uint32
 */
export type AutoGenerateId = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::AutoGenerateInfo","kind":"type","status":"implemented","sigHash":"8e07756aa8fdb3679b58a34c78d90856754cc16a2185e236ae3a08e1536db1d3","bodyHash":"188eeae350882738e4392b3f33a138a792fee49dd957410124167d7f6decffce"}
 *
 * Go source:
 * AutoGenerateInfo struct {
 * 	Flags  GeneratedIdentifierFlags // Specifies whether to auto-generate the text for an identifier.
 * 	Id     AutoGenerateId           // Ensures unique generated identifiers get unique names, but clones get the same name.
 * 	Prefix string                   // Optional prefix to apply to the start of the generated name
 * 	Suffix string                   // Optional suffix to apply to the end of the generated name
 * 	Node   *ast.Node                // For a GeneratedIdentifierFlagsNode, the node from which to generate an identifier
 * }
 */
export interface AutoGenerateInfo {
  Flags: GeneratedIdentifierFlags;
  Id: AutoGenerateId;
  Prefix: string;
  Suffix: string;
  Node: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetOriginal","kind":"method","status":"implemented","sigHash":"d13f80af92def58079ab734c5f71c518e38f21629f60fc83691fbbcb1405d445","bodyHash":"5180bb09df38f087a1920fc4a1846975bcd4fa311c987ae7ebd240280306cbf7"}
 *
 * Go source:
 * func (c *EmitContext) SetOriginal(node *ast.Node, original *ast.Node) {
 * 	c.SetOriginalEx(node, original, false)
 * }
 */
export function EmitContext_SetOriginal(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, original: GoPtr<Node>): void {
  EmitContext_SetOriginalEx(receiver, node, original, false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.UnsetOriginal","kind":"method","status":"implemented","sigHash":"f6a5adee9360daf82b7d6af5a7313526eaec74dde362963aca29ad5f6a76c07c","bodyHash":"12a6403638622d05cf8dca8be77e4115a93efc12f4e793c13d4f0a5cc7e7001c"}
 *
 * Go source:
 * func (c *EmitContext) UnsetOriginal(node *ast.Node) {
 * 	delete(c.original, node)
 * }
 */
export function EmitContext_UnsetOriginal(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): void {
  const c = receiver!;
  c.original.delete(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetOriginalEx","kind":"method","status":"implemented","sigHash":"6573b67875730d0b0333c59a886c70a2722aa875814a8c36fc6c3557a07e1cb3","bodyHash":"de26fbde64ae15c3126bf17d7ddcee5d8a4d6e61ca84ff0aab3c7b242b435811"}
 *
 * Go source:
 * func (c *EmitContext) SetOriginalEx(node *ast.Node, original *ast.Node, allowOverwrite bool) {
 * 	if original == nil {
 * 		panic("Original cannot be nil.")
 * 	}
 * 
 * 	if c.original == nil {
 * 		c.original = make(map[*ast.Node]*ast.Node)
 * 	}
 * 
 * 	existing, ok := c.original[node]
 * 	if !ok {
 * 		c.original[node] = original
 * 		if emitNode := c.emitNodes.TryGet(original); emitNode != nil {
 * 			c.emitNodes.Get(node).copyFrom(emitNode)
 * 		}
 * 	} else if !allowOverwrite && existing != original {
 * 		panic("Original node already set.")
 * 	} else if allowOverwrite {
 * 		c.original[node] = original
 * 	}
 * }
 */
export function EmitContext_SetOriginalEx(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, original: GoPtr<Node>, allowOverwrite: bool): void {
  const c = receiver!;
  if (original === undefined) {
    throw new globalThis.Error("Original cannot be nil.");
  }

  const existing = c.original.get(node);
  const ok = c.original.has(node);
  if (!ok) {
    c.original.set(node, original);
    const emitNode = LinkStore_TryGet(c.emitNodes, original);
    if (emitNode !== undefined) {
      emitNode_copyFrom(LinkStore_Get(c.emitNodes, node), emitNode);
    }
  } else if (!allowOverwrite && existing !== original) {
    throw new globalThis.Error("Original node already set.");
  } else if (allowOverwrite) {
    c.original.set(node, original);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.Original","kind":"method","status":"implemented","sigHash":"d17f623ec9f52dfd5fcadadd23cebb3c9472e03ffa279be456d8abb96060e5d1","bodyHash":"dbbe5dba3be5a881303cdc1c2fc819672af46f598773ee3073c8cf3f101ad0c5"}
 *
 * Go source:
 * func (c *EmitContext) Original(node *ast.Node) *ast.Node {
 * 	return c.original[node]
 * }
 */
export function EmitContext_Original(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Node> {
  const c = receiver!;
  return c.original.get(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.MostOriginal","kind":"method","status":"implemented","sigHash":"5ccab8ba2d726e6f19c9ac3e9ea828af5d83bb2f0575e8360ec5aeb093632066","bodyHash":"ed056a2bc212d093bf98fdcc71980fa54876615a48bd11825e8564420baca1eb"}
 *
 * Go source:
 * func (c *EmitContext) MostOriginal(node *ast.Node) *ast.Node {
 * 	if node != nil {
 * 		original := c.Original(node)
 * 		for original != nil {
 * 			node = original
 * 			original = c.Original(node)
 * 		}
 * 	}
 * 	return node
 * }
 */
export function EmitContext_MostOriginal(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Node> {
  if (node === undefined) return undefined;
  const original = EmitContext_Original(receiver, node);
  if (original === undefined) return node;
  return EmitContext_MostOriginal(receiver, original);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.ParseNode","kind":"method","status":"implemented","sigHash":"dde033a8ad1ac5cddb2a4e683928de72856dd82d3a502809b307bb046d1ae312","bodyHash":"239530f8601c561e0e4fd0d2e17c2e082d111f99f5c28cad284b5a7d0fc08ae8"}
 *
 * Go source:
 * func (c *EmitContext) ParseNode(node *ast.Node) *ast.Node {
 * 	node = c.MostOriginal(node)
 * 	if node != nil && ast.IsParseTreeNode(node) {
 * 		return node
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_ParseNode(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Node> {
  node = EmitContext_MostOriginal(receiver, node);
  if (node !== undefined && IsParseTreeNode(node)) {
    return node;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::emitNodeFlags","kind":"type","status":"implemented","sigHash":"b073a332896d32f7cd131dac9bf400a781d542c8f058946630926efca14dcd60","bodyHash":"1bbf6b651231fc3b25b6d637c247cbe48b6155ea2f789d32718edb28355d17be"}
 *
 * Go source:
 * emitNodeFlags uint32
 */
export type emitNodeFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::constGroup::hasCommentRange+hasSourceMapRange","kind":"constGroup","status":"implemented","sigHash":"3387601d5cdba3d897322bb992cfa22500307b4dde7fc620af7814c866180634","bodyHash":"7826d463200fb50935941e63ac77b821b70fc1a5c28456b9be246ca62661c2e6"}
 *
 * Go source:
 * const (
 * 	hasCommentRange emitNodeFlags = 1 << iota
 * 	hasSourceMapRange
 * )
 */
export const hasCommentRange: emitNodeFlags = 1 << 0;
export const hasSourceMapRange: emitNodeFlags = 1 << 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::SynthesizedComment","kind":"type","status":"implemented","sigHash":"e1a9f2a8e8b53cbe4055fc124853ded15b11939bda1f3ceafd3bf5c6e2da3ed0","bodyHash":"3679d9505845263e8f1f6a525b83930f43dbdd4f9fde99d4d3208fd3c69fc0ca"}
 *
 * Go source:
 * SynthesizedComment struct {
 * 	Kind               ast.Kind
 * 	Loc                core.TextRange
 * 	HasLeadingNewLine  bool
 * 	HasTrailingNewLine bool
 * 	Text               string
 * }
 */
export interface SynthesizedComment {
  Kind: Kind;
  Loc: TextRange;
  HasLeadingNewLine: bool;
  HasTrailingNewLine: bool;
  Text: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::type::emitNode","kind":"type","status":"implemented","sigHash":"3991ab9fd28c20522a3ae6e491ea9a17ec1ad7abce8d7ea49aeebee472ea27d2","bodyHash":"a2b06ff0ce65fced978221748549ff4ffd530c55a6e4960793156f505bbf2cf3"}
 *
 * Go source:
 * emitNode struct {
 * 	flags                     emitNodeFlags
 * 	emitFlags                 EmitFlags
 * 	commentRange              core.TextRange
 * 	sourceMapRange            core.TextRange
 * 	tokenSourceMapRanges      map[ast.Kind]core.TextRange
 * 	helpers                   []*EmitHelper
 * 	externalHelpersModuleName *ast.IdentifierNode
 * 	leadingComments           []SynthesizedComment
 * 	trailingComments          []SynthesizedComment
 * 	typeNode                  *ast.TypeNode
 * }
 */
export interface emitNode {
  flags: emitNodeFlags;
  emitFlags: EmitFlags_30313d69;
  commentRange: TextRange;
  sourceMapRange: TextRange;
  tokenSourceMapRanges: GoMap<Kind, TextRange>;
  helpers: GoSlice<GoPtr<EmitHelper>>;
  externalHelpersModuleName: GoPtr<IdentifierNode>;
  leadingComments: GoSlice<SynthesizedComment>;
  trailingComments: GoSlice<SynthesizedComment>;
  typeNode: GoPtr<TypeNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::emitNode.copyFrom","kind":"method","status":"implemented","sigHash":"cc75feaad7db8124f1a46e4007f67ccc16af8aec2165c6d5e9d56f7a05adb68e","bodyHash":"fc12fdcdfa37b24dfedaaf5c4a4784ab0d7cac537c2417aa7cdcfa30a388a175"}
 *
 * Go source:
 * func (e *emitNode) copyFrom(source *emitNode) {
 * 	e.flags = source.flags
 * 	e.emitFlags = source.emitFlags
 * 	e.commentRange = source.commentRange
 * 	e.sourceMapRange = source.sourceMapRange
 * 	e.tokenSourceMapRanges = maps.Clone(source.tokenSourceMapRanges)
 * 	e.helpers = slices.Clone(source.helpers)
 * 	e.externalHelpersModuleName = source.externalHelpersModuleName
 * }
 */
export function emitNode_copyFrom(receiver: GoPtr<emitNode>, source: GoPtr<emitNode>): void {
  const e = receiver!;
  const src = source!;
  e.flags = src.flags;
  e.emitFlags = src.emitFlags;
  e.commentRange = src.commentRange;
  e.sourceMapRange = src.sourceMapRange;
  e.tokenSourceMapRanges = maps.Clone(src.tokenSourceMapRanges)!;
  e.helpers = slices.Clone(src.helpers)!;
  e.externalHelpersModuleName = src.externalHelpersModuleName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.EmitFlags","kind":"method","status":"implemented","sigHash":"9a1b7e0f203cf21c9f5e11a7d9c09d631ddb0465a87f7b9e61e2e559d6304959","bodyHash":"39cea1a4e69fd1aeab6828df66dd270869eebbcf688f36b25ab13f83946a409f"}
 *
 * Go source:
 * func (c *EmitContext) EmitFlags(node *ast.Node) EmitFlags {
 * 	if emitNode := c.emitNodes.TryGet(node); emitNode != nil {
 * 		return emitNode.emitFlags
 * 	}
 * 	return EFNone
 * }
 */
export function EmitContext_EmitFlags(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): EmitFlags_30313d69 {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined) {
    return emitNode.emitFlags;
  }
  return EFNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetEmitFlags","kind":"method","status":"implemented","sigHash":"fa984389f2cfced438fbce09703d9fee518f31fd1aa7cb4e15c3629b0ad09bae","bodyHash":"15ca83a898c8458b878b7ed9ec1d25d440247f5651052367abc62cc15e66d187"}
 *
 * Go source:
 * func (c *EmitContext) SetEmitFlags(node *ast.Node, flags EmitFlags) {
 * 	c.emitNodes.Get(node).emitFlags = flags
 * }
 */
export function EmitContext_SetEmitFlags(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, flags: EmitFlags_30313d69): void {
  const c = receiver!;
  LinkStore_Get(c.emitNodes, node)!.emitFlags = flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddEmitFlags","kind":"method","status":"implemented","sigHash":"1edbfcf4d5e13d95ca9e877c1f2fa059711288b1becdaa7648d1d8717df547c6","bodyHash":"2e6790e4aea1fc146aaed390106cca62ddbc80c34c6cee06307967b505e32b0d"}
 *
 * Go source:
 * func (c *EmitContext) AddEmitFlags(node *ast.Node, flags EmitFlags) {
 * 	c.emitNodes.Get(node).emitFlags |= flags
 * }
 */
export function EmitContext_AddEmitFlags(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, flags: EmitFlags_30313d69): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.emitFlags = (emitNode.emitFlags | flags) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.CommentRange","kind":"method","status":"implemented","sigHash":"622c188754991eff06506ea93c9f2907af5d22422d103a18587884f4d8f2e417","bodyHash":"e39645336a66e57f1df480289804a271c1774c0eef54924da9b3535e69014115"}
 *
 * Go source:
 * func (c *EmitContext) CommentRange(node *ast.Node) core.TextRange {
 * 	if emitNode := c.emitNodes.TryGet(node); emitNode != nil && emitNode.flags&hasCommentRange != 0 {
 * 		return emitNode.commentRange
 * 	}
 * 	return node.Loc
 * }
 */
export function EmitContext_CommentRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): TextRange {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined && ((emitNode.flags & hasCommentRange) >>> 0) !== 0) {
    return emitNode.commentRange;
  }
  return node!.Loc;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetCommentRange","kind":"method","status":"implemented","sigHash":"dc63c1e18a932531b44d58f09a546fef48d3b706bf980b3f68ab87c09eee6b96","bodyHash":"e0a2a33e7f53e5b0f6b0d657e705141229f17d504cf194bf7187474054066e57"}
 *
 * Go source:
 * func (c *EmitContext) SetCommentRange(node *ast.Node, loc core.TextRange) {
 * 	emitNode := c.emitNodes.Get(node)
 * 	emitNode.commentRange = loc
 * 	emitNode.flags |= hasCommentRange
 * }
 */
export function EmitContext_SetCommentRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, loc: TextRange): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.commentRange = loc;
  emitNode.flags = (emitNode.flags | hasCommentRange) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AssignCommentRange","kind":"method","status":"implemented","sigHash":"9819faee90842dc8cc2c0e03946bad809d7b4152b440e882666a2675eea81a06","bodyHash":"f12a23dc9bf6f97844efc3467afcec9861d1ddaea88308592c3c901d3f71e001"}
 *
 * Go source:
 * func (c *EmitContext) AssignCommentRange(to *ast.Node, from *ast.Node) {
 * 	c.SetCommentRange(to, c.CommentRange(from))
 * }
 */
export function EmitContext_AssignCommentRange(receiver: GoPtr<EmitContext>, to: GoPtr<Node>, from_: GoPtr<Node>): void {
  EmitContext_SetCommentRange(receiver, to, EmitContext_CommentRange(receiver, from_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SourceMapRange","kind":"method","status":"implemented","sigHash":"2a75a57914d771c5ec58d47aca28be64f98584d13302da8a8eec8b3d840ed0b2","bodyHash":"8e198fd7d6c2721dc72ab97b9bdbe86eb88999d67ef4b3585f2aa164b8de70bc"}
 *
 * Go source:
 * func (c *EmitContext) SourceMapRange(node *ast.Node) core.TextRange {
 * 	if emitNode := c.emitNodes.TryGet(node); emitNode != nil && emitNode.flags&hasSourceMapRange != 0 {
 * 		return emitNode.sourceMapRange
 * 	}
 * 	return node.Loc
 * }
 */
export function EmitContext_SourceMapRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): TextRange {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined && ((emitNode.flags & hasSourceMapRange) >>> 0) !== 0) {
    return emitNode.sourceMapRange;
  }
  return node!.Loc;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetSourceMapRange","kind":"method","status":"implemented","sigHash":"08013f3ece937a6cf62679883f49f79d7949cbb0c6c02b7d51df2db08e9db034","bodyHash":"8d7f126cc182eaab15cf7ae1ad0f5592e630bcedf1945e71e55712337661a4d6"}
 *
 * Go source:
 * func (c *EmitContext) SetSourceMapRange(node *ast.Node, loc core.TextRange) {
 * 	emitNode := c.emitNodes.Get(node)
 * 	emitNode.sourceMapRange = loc
 * 	emitNode.flags |= hasSourceMapRange
 * }
 */
export function EmitContext_SetSourceMapRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, loc: TextRange): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.sourceMapRange = loc;
  emitNode.flags = (emitNode.flags | hasSourceMapRange) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AssignSourceMapRange","kind":"method","status":"implemented","sigHash":"9e60352db98078d141e8e388c9915a021f7bb9dc35c59c653f90f807932db41b","bodyHash":"ef8368b87cf26013b02d34af199e74db88be7100e79b439b15ba951c8391b0f8"}
 *
 * Go source:
 * func (c *EmitContext) AssignSourceMapRange(to *ast.Node, from *ast.Node) {
 * 	c.SetSourceMapRange(to, c.SourceMapRange(from))
 * }
 */
export function EmitContext_AssignSourceMapRange(receiver: GoPtr<EmitContext>, to: GoPtr<Node>, from_: GoPtr<Node>): void {
  EmitContext_SetSourceMapRange(receiver, to, EmitContext_SourceMapRange(receiver, from_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AssignCommentAndSourceMapRanges","kind":"method","status":"implemented","sigHash":"bd124fa7c9e623e8ce8a0b873abba1affb786edb02f44f03438756d13bd4cff6","bodyHash":"d46b7382c8c2ebf132cdc26195cdb60d63e1749117a5e9bd9715c692ea85e121"}
 *
 * Go source:
 * func (c *EmitContext) AssignCommentAndSourceMapRanges(to *ast.Node, from *ast.Node) {
 * 	emitNode := c.emitNodes.Get(to)
 * 	commentRange := c.CommentRange(from)
 * 	sourceMapRange := c.SourceMapRange(from)
 * 	emitNode.commentRange = commentRange
 * 	emitNode.sourceMapRange = sourceMapRange
 * 	emitNode.flags |= hasCommentRange | hasSourceMapRange
 * }
 */
export function EmitContext_AssignCommentAndSourceMapRanges(receiver: GoPtr<EmitContext>, to: GoPtr<Node>, from_: GoPtr<Node>): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, to)!;
  const commentRange = EmitContext_CommentRange(receiver, from_);
  const sourceMapRange = EmitContext_SourceMapRange(receiver, from_);
  emitNode.commentRange = commentRange;
  emitNode.sourceMapRange = sourceMapRange;
  emitNode.flags = (emitNode.flags | ((hasCommentRange | hasSourceMapRange) >>> 0)) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.TokenSourceMapRange","kind":"method","status":"implemented","sigHash":"b8494d9bc4261bcec133e2df0e647c737304b505f462aa27d6af94e0647139b8","bodyHash":"7190a1b9781f56cdcb9c26f44143387e01fe86c59745b2978951b35593b4373f"}
 *
 * Go source:
 * func (c *EmitContext) TokenSourceMapRange(node *ast.Node, kind ast.Kind) (core.TextRange, bool) {
 * 	if emitNode := c.emitNodes.TryGet(node); emitNode != nil && emitNode.tokenSourceMapRanges != nil {
 * 		if loc, ok := emitNode.tokenSourceMapRanges[kind]; ok {
 * 			return loc, true
 * 		}
 * 	}
 * 	return core.TextRange{}, false
 * }
 */
export function EmitContext_TokenSourceMapRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, kind: Kind): [TextRange, bool] {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined && emitNode.tokenSourceMapRanges !== undefined) {
    const loc = emitNode.tokenSourceMapRanges.get(kind);
    const ok = emitNode.tokenSourceMapRanges.has(kind);
    if (ok) {
      return [loc!, true];
    }
  }
  return [{ pos: 0, end: 0 }, false];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetTokenSourceMapRange","kind":"method","status":"implemented","sigHash":"4f9151bafc3ab212477464b3103054feec00be35f47cad0786c078066997721b","bodyHash":"311e16e3f956a12a9a0f06ebd5148d539ee14795d420b4393579b2a51bbaf0f4"}
 *
 * Go source:
 * func (c *EmitContext) SetTokenSourceMapRange(node *ast.Node, kind ast.Kind, loc core.TextRange) {
 * 	emitNode := c.emitNodes.Get(node)
 * 	if emitNode.tokenSourceMapRanges == nil {
 * 		emitNode.tokenSourceMapRanges = make(map[ast.Kind]core.TextRange)
 * 	}
 * 	emitNode.tokenSourceMapRanges[kind] = loc
 * }
 */
export function EmitContext_SetTokenSourceMapRange(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, kind: Kind, loc: TextRange): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  if (emitNode.tokenSourceMapRanges === undefined) {
    emitNode.tokenSourceMapRanges = new globalThis.Map<Kind, TextRange>();
  }
  emitNode.tokenSourceMapRanges.set(kind, loc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AssignedName","kind":"method","status":"implemented","sigHash":"3d6c395965d3dfb72e710ea3e38e1283c3f09cd2aa5d4a0d05cf89f5a4ba8317","bodyHash":"34912e16dd4673559e2ce544fbde18f7698a6f73f7bdd2c514d18a175ebf6362"}
 *
 * Go source:
 * func (c *EmitContext) AssignedName(node *ast.Node) *ast.Expression {
 * 	return c.assignedName[node]
 * }
 */
export function EmitContext_AssignedName(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Expression> {
  const c = receiver!;
  return c.assignedName.get(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.TextSource","kind":"method","status":"implemented","sigHash":"00f4c1ae8507167124ff3af2e95940f51f3b8e1a0d018bc2f351a63b89034fa6","bodyHash":"118e45294d2f3dccff9e4780cdc4c9d79d2654f6828d30c8b78ebbe7a77c4d2d"}
 *
 * Go source:
 * func (c *EmitContext) TextSource(node *ast.StringLiteralNode) *ast.Node {
 * 	return c.textSource[node]
 * }
 */
export function EmitContext_TextSource(receiver: GoPtr<EmitContext>, node: GoPtr<StringLiteralNode>): GoPtr<Node> {
  const c = receiver!;
  return c.textSource.get(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetAssignedName","kind":"method","status":"implemented","sigHash":"629d3007ca5e1f8a4eda594cb5b6d969e80a02979c239ca2da9ba9bbd2125e19","bodyHash":"c5907818a37304067d95015b3d0590161994fc4444abf885cbc8b2d0819ab009"}
 *
 * Go source:
 * func (c *EmitContext) SetAssignedName(node *ast.Node, name *ast.Expression) {
 * 	if c.assignedName == nil {
 * 		c.assignedName = make(map[*ast.Node]*ast.Expression)
 * 	}
 * 	c.assignedName[node] = name
 * }
 */
export function EmitContext_SetAssignedName(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, name: GoPtr<Expression>): void {
  const c = receiver!;
  c.assignedName.set(node, name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.ClassThis","kind":"method","status":"implemented","sigHash":"d8127ab9fccff5241289759359d47b140d0de31f8a1ba13d496ba7eefb19cfd4","bodyHash":"274e578ff65ff38e36c502cfddab966d980bb311b946fae29e091888fdd21535"}
 *
 * Go source:
 * func (c *EmitContext) ClassThis(node *ast.Node) *ast.Expression {
 * 	return c.classThis[node]
 * }
 */
export function EmitContext_ClassThis(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Expression> {
  const c = receiver!;
  return c.classThis.get(node) as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetClassThis","kind":"method","status":"implemented","sigHash":"42bdf6c5a3e3f359dfba72ff6aff2c8983911220f19685d3c97cf37e6737b18c","bodyHash":"ad034cd77b13c662f81e514c91382d2d6e9c8cd6f8049eeae90e5f0284bbe89f"}
 *
 * Go source:
 * func (c *EmitContext) SetClassThis(node *ast.Node, classThis *ast.IdentifierNode) {
 * 	if c.classThis == nil {
 * 		c.classThis = make(map[*ast.Node]*ast.Expression)
 * 	}
 * 	c.classThis[node] = classThis
 * }
 */
export function EmitContext_SetClassThis(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, classThis: GoPtr<IdentifierNode>): void {
  const c = receiver!;
  c.classThis.set(node, classThis);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.RequestEmitHelper","kind":"method","status":"implemented","sigHash":"36a1619c12a9c0d21adb2ccbf4162ea70bdd7332df7bba5eb35757a9fcd6bb07","bodyHash":"0436b942c150d8be06be59461a73bf16b07c3c4c7da3328046004326bdb6316d"}
 *
 * Go source:
 * func (c *EmitContext) RequestEmitHelper(helper *EmitHelper) {
 * 	if helper.Scoped {
 * 		panic("Cannot request a scoped emit helper")
 * 	}
 * 	for _, h := range helper.Dependencies {
 * 		c.RequestEmitHelper(h)
 * 	}
 * 	c.emitHelpers.Add(helper)
 * }
 */
export function EmitContext_RequestEmitHelper(receiver: GoPtr<EmitContext>, helper: GoPtr<EmitHelper>): void {
  const c = receiver!;
  if (helper!.Scoped) {
    throw new globalThis.Error("Cannot request a scoped emit helper");
  }
  const deps = helper!.Dependencies;
  if (deps !== undefined) {
    for (const h of deps) {
      EmitContext_RequestEmitHelper(receiver, h);
    }
  }
  OrderedSet_Add(c.emitHelpers, helper);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.ReadEmitHelpers","kind":"method","status":"implemented","sigHash":"434de5157e89c2ce3f092a3cf1c99c653f1d4edd19278f254ad77c49418339a4","bodyHash":"ee251177699a9182a98aa351d9a4543e9ea0067542fcaa421627c2d13326a480"}
 *
 * Go source:
 * func (c *EmitContext) ReadEmitHelpers() []*EmitHelper {
 * 	helpers := slices.Collect(c.emitHelpers.Values())
 * 	c.emitHelpers.Clear()
 * 	return helpers
 * }
 */
export function EmitContext_ReadEmitHelpers(receiver: GoPtr<EmitContext>): GoSlice<GoPtr<EmitHelper>> {
  const c = receiver!;
  const helpers: GoSlice<GoPtr<EmitHelper>> = [];
  OrderedSet_Values(c.emitHelpers)((v) => { helpers.push(v); return true; });
  OrderedSet_Clear(c.emitHelpers);
  return helpers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddEmitHelper","kind":"method","status":"implemented","sigHash":"d77caffb3482f84957b3aa79243d52daa87cd32a5b59457c8069067c84e9733b","bodyHash":"3a24d60280817f64cb795b4c6cb734837f1b5e8d6ab4ca9e4452c346b72e83f6"}
 *
 * Go source:
 * func (c *EmitContext) AddEmitHelper(node *ast.Node, helper ...*EmitHelper) {
 * 	emitNode := c.emitNodes.Get(node)
 * 	for _, h := range helper {
 * 		emitNode.helpers = core.AppendIfUnique(emitNode.helpers, h)
 * 	}
 * }
 */
export function EmitContext_AddEmitHelper(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, ...helper: Array<GoPtr<EmitHelper>>): void {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.helpers ??= [];
  for (const h of helper) {
    emitNode.helpers = AppendIfUnique(emitNode.helpers, h);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.MoveEmitHelpers","kind":"method","status":"implemented","sigHash":"975dda94367778ea1934b3713d646d2c87975ccc1fd96f5155d72ce9379fa469","bodyHash":"5b38eda6687bb7b6801723d048fff3533950789306f2b2a946124cf8a360b302"}
 *
 * Go source:
 * func (c *EmitContext) MoveEmitHelpers(source *ast.Node, target *ast.Node, predicate func(helper *EmitHelper) bool) {
 * 	sourceEmitNode := c.emitNodes.TryGet(source)
 * 	if sourceEmitNode == nil {
 * 		return
 * 	}
 * 	sourceEmitHelpers := sourceEmitNode.helpers
 * 	if len(sourceEmitHelpers) == 0 {
 * 		return
 * 	}
 * 
 * 	targetEmitNode := c.emitNodes.Get(target)
 * 	helpersRemoved := 0
 * 	for i := range sourceEmitHelpers {
 * 		helper := sourceEmitHelpers[i]
 * 		if predicate(helper) {
 * 			helpersRemoved++
 * 			targetEmitNode.helpers = core.AppendIfUnique(targetEmitNode.helpers, helper)
 * 		} else if helpersRemoved > 0 {
 * 			sourceEmitHelpers[i-helpersRemoved] = helper
 * 		}
 * 	}
 * 
 * 	if helpersRemoved > 0 {
 * 		sourceEmitHelpers = sourceEmitHelpers[:len(sourceEmitHelpers)-helpersRemoved]
 * 		sourceEmitNode.helpers = sourceEmitHelpers
 * 	}
 * }
 */
export function EmitContext_MoveEmitHelpers(receiver: GoPtr<EmitContext>, source: GoPtr<Node>, target: GoPtr<Node>, predicate: (helper: GoPtr<EmitHelper>) => bool): void {
  const c = receiver!;
  const sourceEmitNode = LinkStore_TryGet(c.emitNodes, source);
  if (sourceEmitNode === undefined) {
    return;
  }
  const sourceEmitHelpers = sourceEmitNode.helpers ?? [];
  if (sourceEmitHelpers.length === 0) {
    return;
  }

  const targetEmitNode = LinkStore_Get(c.emitNodes, target)!;
  targetEmitNode.helpers ??= [];
  let helpersRemoved = 0;
  for (let i = 0; i < sourceEmitHelpers.length; i++) {
    const helper = sourceEmitHelpers[i]!;
    if (predicate(helper)) {
      helpersRemoved++;
      targetEmitNode.helpers = AppendIfUnique(targetEmitNode.helpers, helper);
    } else if (helpersRemoved > 0) {
      sourceEmitHelpers[i - helpersRemoved] = helper;
    }
  }

  if (helpersRemoved > 0) {
    sourceEmitNode.helpers = sourceEmitHelpers.slice(0, sourceEmitHelpers.length - helpersRemoved);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetEmitHelpers","kind":"method","status":"implemented","sigHash":"6edd816d1a5f024108169764638e1424079610caebb1ef548c3aee761f1565e9","bodyHash":"33fdefda7a6b9eafbd389f2a49205c87158a6ac619454639bdcc09954cdd22da"}
 *
 * Go source:
 * func (c *EmitContext) GetEmitHelpers(node *ast.Node) []*EmitHelper {
 * 	emitNode := c.emitNodes.TryGet(node)
 * 	if emitNode != nil {
 * 		return emitNode.helpers
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_GetEmitHelpers(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoSlice<GoPtr<EmitHelper>> {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined) {
    return emitNode.helpers ?? [];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetExternalHelpersModuleName","kind":"method","status":"implemented","sigHash":"0e99a13bee3dd282fa3df055ea62d3b1163604eb0c8b1a0d168752ef146a1088","bodyHash":"321fa49ab101d757d75ebc1e1e9dd09bfd7fb1ea47a9e578366a99c90b706b11"}
 *
 * Go source:
 * func (c *EmitContext) GetExternalHelpersModuleName(node *ast.SourceFile) *ast.IdentifierNode {
 * 	if parseNode := c.ParseNode(node.AsNode()); parseNode != nil {
 * 		if emitNode := c.emitNodes.TryGet(parseNode); emitNode != nil {
 * 			return emitNode.externalHelpersModuleName
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_GetExternalHelpersModuleName(receiver: GoPtr<EmitContext>, node: GoPtr<SourceFile>): GoPtr<IdentifierNode> {
  const c = receiver!;
  const parseNode = EmitContext_ParseNode(receiver, Node_AsNode(node));
  if (parseNode !== undefined) {
    const emitNode = LinkStore_TryGet(c.emitNodes, parseNode);
    if (emitNode !== undefined) {
      return emitNode.externalHelpersModuleName;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetExternalHelpersModuleName","kind":"method","status":"implemented","sigHash":"51245dbb9dcd87deede7a1041b113ea2da6ac60e71ace0d73f271f5d72f66452","bodyHash":"95e402590e2d92b688f50eded2a240e560ce901a7fd6895336a5092eeb87453c"}
 *
 * Go source:
 * func (c *EmitContext) SetExternalHelpersModuleName(node *ast.SourceFile, name *ast.IdentifierNode) {
 * 	parseNode := c.ParseNode(node.AsNode())
 * 	if parseNode == nil {
 * 		panic("Node must be a parse tree node or have an Original pointer to a parse tree node.")
 * 	}
 * 
 * 	emitNode := c.emitNodes.Get(parseNode)
 * 	emitNode.externalHelpersModuleName = name
 * }
 */
export function EmitContext_SetExternalHelpersModuleName(receiver: GoPtr<EmitContext>, node: GoPtr<SourceFile>, name: GoPtr<IdentifierNode>): void {
  const c = receiver!;
  const parseNode = EmitContext_ParseNode(receiver, Node_AsNode(node));
  if (parseNode === undefined) {
    throw new globalThis.Error("Node must be a parse tree node or have an Original pointer to a parse tree node.");
  }
  const emitNode = LinkStore_Get(c.emitNodes, parseNode)!;
  emitNode.externalHelpersModuleName = name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.HasRecordedExternalHelpers","kind":"method","status":"implemented","sigHash":"8a3796726d552ddd59d4de89d58a0b2c35418078f7127bde997c7ecc0447df8f","bodyHash":"a2c4fd3152ea1d4b265802115b69be16bfa2d0d99622886af3bd9dabe22b974b"}
 *
 * Go source:
 * func (c *EmitContext) HasRecordedExternalHelpers(node *ast.SourceFile) bool {
 * 	if parseNode := c.ParseNode(node.AsNode()); parseNode != nil {
 * 		emitNode := c.emitNodes.TryGet(parseNode)
 * 		return emitNode != nil && (emitNode.externalHelpersModuleName != nil || emitNode.emitFlags&EFExternalHelpers != 0)
 * 	}
 * 	return false
 * }
 */
export function EmitContext_HasRecordedExternalHelpers(receiver: GoPtr<EmitContext>, node: GoPtr<SourceFile>): bool {
  const c = receiver!;
  const parseNode = EmitContext_ParseNode(receiver, Node_AsNode(node));
  if (parseNode !== undefined) {
    const emitNode = LinkStore_TryGet(c.emitNodes, parseNode);
    return emitNode !== undefined && (emitNode.externalHelpersModuleName !== undefined || (emitNode.emitFlags & EFExternalHelpers) !== 0);
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.IsCallToHelper","kind":"method","status":"implemented","sigHash":"a60f98bbb3d4fa4800f427b840d32e65c13f71d6282e80bd11b69ef033b8ceec","bodyHash":"9f37331c6b87337eae6d012b3b0ab71502dd1dad2ef7e6d1b75a7ef7a6b1e50a"}
 *
 * Go source:
 * func (c *EmitContext) IsCallToHelper(firstSegment *ast.Expression, helperName string) bool {
 * 	return ast.IsCallExpression(firstSegment) &&
 * 		ast.IsIdentifier(firstSegment.Expression()) &&
 * 		(c.EmitFlags(firstSegment.Expression())&EFHelperName) != 0 &&
 * 		firstSegment.Expression().Text() == helperName
 * }
 */
export function EmitContext_IsCallToHelper(receiver: GoPtr<EmitContext>, firstSegment: GoPtr<Expression>, helperName: string): bool {
  return IsCallExpression(firstSegment) &&
    IsIdentifier(Node_Expression(firstSegment)) &&
    ((EmitContext_EmitFlags(receiver, Node_Expression(firstSegment)) & EFHelperName) !== 0) &&
    Node_Text(Node_Expression(firstSegment)) === helperName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.VisitVariableEnvironment","kind":"method","status":"implemented","sigHash":"2c8f0313fb4bfb5fb8f720eab4a970561796057d0028915d9443e9d1e01287ae","bodyHash":"090193da9275291f4b880613e7d477647c5a317ce820c39dd875c97bfc4323d5"}
 *
 * Go source:
 * func (c *EmitContext) VisitVariableEnvironment(nodes *ast.StatementList, visitor *ast.NodeVisitor) *ast.StatementList {
 * 	c.StartVariableEnvironment()
 * 	return c.EndAndMergeVariableEnvironmentList(visitor.VisitNodes(nodes))
 * }
 */
export function EmitContext_VisitVariableEnvironment(receiver: GoPtr<EmitContext>, nodes: GoPtr<StatementList>, visitor: GoPtr<NodeVisitor>): GoPtr<StatementList> {
  EmitContext_StartVariableEnvironment(receiver);
  return EmitContext_EndAndMergeVariableEnvironmentList(receiver, NodeVisitor_VisitNodes(visitor as GoPtr<ConcreteNodeVisitor>, nodes));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.VisitParameters","kind":"method","status":"implemented","sigHash":"df09d7f38f30c81195b4cd77a4bef46896020d320d2c34a68486db1ff8cc90e1","bodyHash":"e5fa54917c336d5851e76147a1cde32bcd104a22cf2589731da3517b64fbe72b"}
 *
 * Go source:
 * func (c *EmitContext) VisitParameters(nodes *ast.ParameterList, visitor *ast.NodeVisitor) *ast.ParameterList {
 * 	c.StartVariableEnvironment()
 * 	scope := c.varScopeStack.Peek()
 * 	oldFlags := scope.flags
 * 	scope.flags |= environmentFlagsInParameters
 * 	nodes = visitor.VisitNodes(nodes)
 * 
 * 	// As of ES2015, any runtime execution of that occurs in for a parameter (such as evaluating an
 * 	// initializer or a binding pattern), occurs in its own lexical scope. As a result, any expression
 * 	// that we might transform that introduces a temporary variable would fail as the temporary variable
 * 	// exists in a different lexical scope. To address this, we move any binding patterns and initializers
 * 	// in a parameter list to the body if we detect a variable being hoisted while visiting a parameter list
 * 	// when the emit target is greater than ES2015. (Which is now all targets.)
 * 	if scope.flags&environmentFlagsVariablesHoistedInParameters != 0 {
 * 		nodes = c.addDefaultValueAssignmentsIfNeeded(nodes)
 * 	}
 * 	scope.flags = oldFlags
 * 	// !!! c.suspendVariableEnvironment()
 * 	return nodes
 * }
 */
export function EmitContext_VisitParameters(receiver: GoPtr<EmitContext>, nodes: GoPtr<ParameterList>, visitor: GoPtr<NodeVisitor>): GoPtr<ParameterList> {
  const c = receiver!;
  EmitContext_StartVariableEnvironment(receiver);
  const scope = Stack_Peek(c.varScopeStack)!;
  const oldFlags = scope.flags;
  scope.flags = scope.flags | environmentFlagsInParameters;
  let visitedNodes = NodeVisitor_VisitNodes(visitor as GoPtr<ConcreteNodeVisitor>, nodes);

  // As of ES2015, any runtime execution of that occurs in for a parameter (such as evaluating an
  // initializer or a binding pattern), occurs in its own lexical scope. As a result, any expression
  // that we might transform that introduces a temporary variable would fail as the temporary variable
  // exists in a different lexical scope. To address this, we move any binding patterns and initializers
  // in a parameter list to the body if we detect a variable being hoisted while visiting a parameter list
  // when the emit target is greater than ES2015. (Which is now all targets.)
  if ((scope.flags & environmentFlagsVariablesHoistedInParameters) !== 0) {
    visitedNodes = EmitContext_addDefaultValueAssignmentsIfNeeded(receiver, visitedNodes);
  }
  scope.flags = oldFlags;
  // !!! c.suspendVariableEnvironment()
  return visitedNodes;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.addDefaultValueAssignmentsIfNeeded","kind":"method","status":"implemented","sigHash":"83971d7fab08ad3309d4ea27364e9698c86e8608f5960290d0782be0ac755f9b","bodyHash":"5c9f6abe843d9ddf646faf62335fe3c284ef88361adaf5afaac74c4a86faadec"}
 *
 * Go source:
 * func (c *EmitContext) addDefaultValueAssignmentsIfNeeded(nodeList *ast.ParameterList) *ast.ParameterList {
 * 	if nodeList == nil {
 * 		return nodeList
 * 	}
 * 	var result []*ast.Node
 * 	nodes := nodeList.Nodes
 * 	for i, parameter := range nodes {
 * 		updated := c.addDefaultValueAssignmentIfNeeded(parameter.AsParameterDeclaration())
 * 		if updated != parameter {
 * 			if result == nil {
 * 				result = slices.Clone(nodes)
 * 			}
 * 			result[i] = updated
 * 		}
 * 	}
 * 	if result != nil {
 * 		res := c.Factory.NewNodeList(result)
 * 		res.Loc = nodeList.Loc
 * 		return res
 * 	}
 * 	return nodeList
 * }
 */
export function EmitContext_addDefaultValueAssignmentsIfNeeded(receiver: GoPtr<EmitContext>, nodeList: GoPtr<ParameterList>): GoPtr<ParameterList> {
  if (nodeList === undefined) {
    return nodeList;
  }
  const c = receiver!;
  const nodes = nodeList.Nodes;
  let result: GoSlice<GoPtr<Node>> | undefined = undefined;
  for (let i = 0; i < nodes.length; i++) {
    const parameter = nodes[i]!;
    const updated = EmitContext_addDefaultValueAssignmentIfNeeded(receiver, parameter as GoPtr<ParameterDeclaration>);
    if (updated !== parameter) {
      if (result === undefined) {
        result = slices.Clone(nodes);
      }
      result![i] = updated;
    }
  }
  if (result !== undefined) {
    const res = NodeFactory_NewNodeList(c.Factory!.__tsgoEmbedded0!, result)!;
    res.Loc = nodeList.Loc;
    return res;
  }
  return nodeList;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.addDefaultValueAssignmentIfNeeded","kind":"method","status":"implemented","sigHash":"54a45c7637281de3554421a5cdca632d2ef1da7207a2eecfe4c2f07eacfeb89f","bodyHash":"ce67093c7b6d8528348d9ae43fac8b947cbf0fd29bfaf23d8fbbc0a9058e1750"}
 *
 * Go source:
 * func (c *EmitContext) addDefaultValueAssignmentIfNeeded(parameter *ast.ParameterDeclaration) *ast.Node {
 * 	// A rest parameter cannot have a binding pattern or an initializer,
 * 	// so let's just ignore it.
 * 	if parameter.DotDotDotToken != nil {
 * 		return parameter.AsNode()
 * 	} else if ast.IsBindingPattern(parameter.Name()) {
 * 		return c.addDefaultValueAssignmentForBindingPattern(parameter)
 * 	} else if parameter.Initializer != nil {
 * 		return c.addDefaultValueAssignmentForInitializer(parameter, parameter.Name(), parameter.Initializer)
 * 	}
 * 	return parameter.AsNode()
 * }
 */
export function EmitContext_addDefaultValueAssignmentIfNeeded(receiver: GoPtr<EmitContext>, parameter: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  // A rest parameter cannot have a binding pattern or an initializer,
  // so let's just ignore it.
  if (parameter!.DotDotDotToken !== undefined) {
    return Node_AsNode(parameter);
  } else if (IsBindingPattern(Node_Name(parameter))) {
    return EmitContext_addDefaultValueAssignmentForBindingPattern(receiver, parameter);
  } else if (parameter!.Initializer !== undefined) {
    return EmitContext_addDefaultValueAssignmentForInitializer(receiver, parameter, Node_Name(parameter), parameter!.Initializer);
  }
  return Node_AsNode(parameter);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.addDefaultValueAssignmentForBindingPattern","kind":"method","status":"implemented","sigHash":"bcee5e66bb42102ac6dda70ba66279c411bf394807db205a8d8f75b3a8747b9f","bodyHash":"1ada008778c12d0c8763c7901298d00d2f0b6a667a97fecd900351d538845dfd"}
 *
 * Go source:
 * func (c *EmitContext) addDefaultValueAssignmentForBindingPattern(parameter *ast.ParameterDeclaration) *ast.Node {
 * 	var initNode *ast.Node
 * 	if parameter.Initializer != nil {
 * 		initNode = c.Factory.NewConditionalExpression(
 * 			c.Factory.NewStrictEqualityExpression(
 * 				c.Factory.NewGeneratedNameForNode(parameter.AsNode()),
 * 				c.Factory.NewVoidZeroExpression(),
 * 			),
 * 			c.Factory.NewToken(ast.KindQuestionToken),
 * 			parameter.Initializer,
 * 			c.Factory.NewToken(ast.KindColonToken),
 * 			c.Factory.NewGeneratedNameForNode(parameter.AsNode()),
 * 		)
 * 	} else {
 * 		initNode = c.Factory.NewGeneratedNameForNode(parameter.AsNode())
 * 	}
 * 	c.AddInitializationStatement(c.Factory.NewVariableStatement(
 * 		nil,
 * 		c.Factory.NewVariableDeclarationList(c.Factory.NewNodeList([]*ast.Node{c.Factory.NewVariableDeclaration(
 * 			parameter.Name(),
 * 			nil,
 * 			parameter.Type,
 * 			initNode,
 * 		)}), ast.NodeFlagsNone),
 * 	))
 * 	return c.Factory.UpdateParameterDeclaration(
 * 		parameter,
 * 		parameter.Modifiers(),
 * 		parameter.DotDotDotToken,
 * 		c.Factory.NewGeneratedNameForNode(parameter.AsNode()),
 * 		parameter.QuestionToken,
 * 		parameter.Type,
 * 		nil,
 * 	)
 * }
 */
export function EmitContext_addDefaultValueAssignmentForBindingPattern(receiver: GoPtr<EmitContext>, parameter: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  const c = receiver!;
  const f = c.Factory!;
  const baseF = f.__tsgoEmbedded0!;
  let initNode: GoPtr<Node>;
  if (parameter!.Initializer !== undefined) {
    initNode = NewConditionalExpression(
      baseF,
      NodeFactory_NewStrictEqualityExpression(f, NodeFactory_NewGeneratedNameForNode(f, Node_AsNode(parameter)), NodeFactory_NewVoidZeroExpression(f)) as GoPtr<Expression>,
      NewToken(baseF, KindQuestionToken),
      parameter!.Initializer as GoPtr<Expression>,
      NewToken(baseF, KindColonToken),
      NodeFactory_NewGeneratedNameForNode(f, Node_AsNode(parameter)) as GoPtr<Expression>,
    );
  } else {
    initNode = NodeFactory_NewGeneratedNameForNode(f, Node_AsNode(parameter));
  }
  EmitContext_AddInitializationStatement(receiver, NewVariableStatement(
    baseF,
    undefined,
    NewVariableDeclarationList(
      baseF,
      NodeFactory_NewNodeList(baseF, [NewVariableDeclaration(
        baseF,
        Node_Name(parameter),
        undefined,
        parameter!.Type,
        initNode as GoPtr<Expression>,
      )]),
      NodeFlagsNone,
    ),
  ));
  return NodeFactory_UpdateParameterDeclaration(
    baseF,
    parameter,
    Node_Modifiers(Node_AsNode(parameter)),
    parameter!.DotDotDotToken,
    NodeFactory_NewGeneratedNameForNode(f, Node_AsNode(parameter)),
    parameter!.QuestionToken,
    parameter!.Type,
    undefined,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.addDefaultValueAssignmentForInitializer","kind":"method","status":"implemented","sigHash":"b1932ca7d46fc7be423ca82e9d7b552b201ef58128884f1622fa55f4cac4d334","bodyHash":"e4cdae889f6fd3193659630800b7cf88ccd717291a43541d0e82da4034e0935b"}
 *
 * Go source:
 * func (c *EmitContext) addDefaultValueAssignmentForInitializer(parameter *ast.ParameterDeclaration, name *ast.Node, initializer *ast.Node) *ast.Node {
 * 	c.AddEmitFlags(initializer, EFNoSourceMap|EFNoComments)
 * 	nameClone := name.Clone(c.Factory)
 * 	c.AddEmitFlags(nameClone, EFNoSourceMap)
 * 	initAssignment := c.Factory.NewAssignmentExpression(
 * 		nameClone,
 * 		initializer,
 * 	)
 * 	initAssignment.Loc = parameter.Loc
 * 	c.AddEmitFlags(initAssignment, EFNoComments)
 * 	initBlock := c.Factory.NewBlock(c.Factory.NewNodeList([]*ast.Node{c.Factory.NewExpressionStatement(initAssignment)}), false)
 * 	initBlock.Loc = parameter.Loc
 * 	c.AddEmitFlags(initBlock, EFSingleLine|EFNoTrailingSourceMap|EFNoTokenSourceMaps|EFNoComments)
 * 	c.AddInitializationStatement(c.Factory.NewIfStatement(
 * 		c.Factory.NewTypeCheck(name.Clone(c.Factory), "undefined"),
 * 		initBlock,
 * 		nil,
 * 	))
 * 	return c.Factory.UpdateParameterDeclaration(
 * 		parameter,
 * 		parameter.Modifiers(),
 * 		parameter.DotDotDotToken,
 * 		parameter.Name(),
 * 		parameter.QuestionToken,
 * 		parameter.Type,
 * 		nil,
 * 	)
 * }
 */
export function EmitContext_addDefaultValueAssignmentForInitializer(receiver: GoPtr<EmitContext>, parameter: GoPtr<ParameterDeclaration>, name: GoPtr<Node>, initializer: GoPtr<Node>): GoPtr<Node> {
  const c = receiver!;
  const f = c.Factory!;
  const baseF = f.__tsgoEmbedded0!;
  EmitContext_AddEmitFlags(receiver, initializer, EFNoSourceMap | EFNoComments);
  const nameClone = Node_Clone(name, baseF as unknown as NodeFactoryCoercible);
  EmitContext_AddEmitFlags(receiver, nameClone, EFNoSourceMap);
  const initAssignment = NodeFactory_NewAssignmentExpression(f, nameClone as GoPtr<Expression>, initializer as GoPtr<Expression>);
  initAssignment!.Loc = parameter!.Loc;
  EmitContext_AddEmitFlags(receiver, initAssignment, EFNoComments);
  const initBlock = NewBlock(baseF, NodeFactory_NewNodeList(baseF, [NewExpressionStatement(baseF, initAssignment as GoPtr<Expression>)]), false as bool);
  initBlock!.Loc = parameter!.Loc;
  EmitContext_AddEmitFlags(receiver, initBlock, EFSingleLine | EFNoTrailingSourceMap | EFNoTokenSourceMaps | EFNoComments);
  EmitContext_AddInitializationStatement(receiver, NewIfStatement(
    baseF,
    NodeFactory_NewTypeCheck(f, Node_Clone(name, baseF as unknown as NodeFactoryCoercible), "undefined") as GoPtr<Expression>,
    initBlock as GoPtr<Statement>,
    undefined,
  ));
  return NodeFactory_UpdateParameterDeclaration(
    baseF,
    parameter,
    Node_Modifiers(Node_AsNode(parameter)),
    parameter!.DotDotDotToken,
    Node_Name(parameter),
    parameter!.QuestionToken,
    parameter!.Type,
    undefined,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddInitializationStatement","kind":"method","status":"implemented","sigHash":"0b1597abb20576ead3f02d6d433a6a3204ff9e986ce30dc548b2e448bd602551","bodyHash":"10996bec8e6b385fa6601cbb21b1cd2ba411ed11e8ebb91e2af2abf3092a4577"}
 *
 * Go source:
 * func (c *EmitContext) AddInitializationStatement(node *ast.Node) {
 * 	scope := c.varScopeStack.Peek()
 * 	if scope == nil {
 * 		panic("Tried to add an initialization statement without a surrounding variable scope")
 * 	}
 * 	c.AddEmitFlags(node, EFCustomPrologue)
 * 	scope.initializationStatements = append(scope.initializationStatements, node)
 * }
 */
export function EmitContext_AddInitializationStatement(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): void {
  const c = receiver!;
  const scope = Stack_Peek(c.varScopeStack);
  if (scope === undefined) {
    throw new globalThis.Error("Tried to add an initialization statement without a surrounding variable scope");
  }
  EmitContext_AddEmitFlags(receiver, node, EFCustomPrologue);
  scope!.initializationStatements = [...scope!.initializationStatements, node];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.VisitFunctionBody","kind":"method","status":"implemented","sigHash":"a9f372489f08f40d50cc506fbd8011d19fd7d6349d065c988991af987259a35c","bodyHash":"a1c11fbc0fb8868065ccb85922e10e2bdd630cec219dad01b1190ddf1f5dab98"}
 *
 * Go source:
 * func (c *EmitContext) VisitFunctionBody(node *ast.BlockOrExpression, visitor *ast.NodeVisitor) *ast.BlockOrExpression {
 * 	// !!! c.resumeVariableEnvironment()
 * 	updated := visitor.VisitNode(node)
 * 	declarations := c.EndVariableEnvironment()
 * 	if len(declarations) == 0 {
 * 		return updated
 * 	}
 * 
 * 	if updated == nil {
 * 		return c.Factory.NewBlock(c.Factory.NewNodeList(declarations), true /*multiLine* /)
 * 	}
 * 
 * 	if !ast.IsBlock(updated) {
 * 		statements := c.MergeEnvironment([]*ast.Statement{c.Factory.NewReturnStatement(updated)}, declarations)
 * 		return c.Factory.NewBlock(c.Factory.NewNodeList(statements), false /*multiLine* /)
 * 	}
 * 
 * 	return c.Factory.UpdateBlock(
 * 		updated.AsBlock(),
 * 		c.MergeEnvironmentList(updated.StatementList(), declarations),
 * 		updated.AsBlock().MultiLine,
 * 	)
 * }
 */
export function EmitContext_VisitFunctionBody(receiver: GoPtr<EmitContext>, node: GoPtr<BlockOrExpression>, visitor: GoPtr<NodeVisitor>): GoPtr<BlockOrExpression> {
  const c = receiver!;
  // !!! c.resumeVariableEnvironment()
  const updated = NodeVisitor_VisitNode(visitor as GoPtr<ConcreteNodeVisitor>, node);
  const declarations = EmitContext_EndVariableEnvironment(receiver);
  if (declarations.length === 0) {
    return updated as GoPtr<BlockOrExpression>;
  }

  const f = c.Factory!.__tsgoEmbedded0!;

  if (updated === undefined) {
    return NewBlock(f, NodeFactory_NewNodeList(f, declarations as GoSlice<GoPtr<Node>>), true as bool) as GoPtr<BlockOrExpression>;
  }

  if (!IsBlock(updated)) {
    const statements = EmitContext_MergeEnvironment(receiver, [NewReturnStatement(f, updated as GoPtr<Expression>)] as GoSlice<GoPtr<Statement>>, declarations);
    return NewBlock(f, NodeFactory_NewNodeList(f, statements as GoSlice<GoPtr<Node>>), false as bool) as GoPtr<BlockOrExpression>;
  }

  return NodeFactory_UpdateBlock(
    f,
    AsBlock(updated)!,
    EmitContext_MergeEnvironmentList(receiver, Node_StatementList(updated), declarations),
    AsBlock(updated)!.MultiLine,
  ) as GoPtr<BlockOrExpression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.VisitIterationBody","kind":"method","status":"implemented","sigHash":"5462ce0c3535dea91d2b4e80d5d92a79ee46c6d7562470fe03affa88e857fc7c","bodyHash":"1c14809ce3ed5111aebe7b2b49a542e581fcc9178e9d58779b6e2ebcce540cc8"}
 *
 * Go source:
 * func (c *EmitContext) VisitIterationBody(body *ast.Statement, visitor *ast.NodeVisitor) *ast.Statement {
 * 	if body == nil {
 * 		return nil
 * 	}
 * 
 * 	c.StartLexicalEnvironment()
 * 	updated := c.VisitEmbeddedStatement(body, visitor)
 * 	if updated == nil {
 * 		panic("Expected visitor to return a statement.")
 * 	}
 * 
 * 	statements := c.EndLexicalEnvironment()
 * 	if len(statements) > 0 {
 * 		if ast.IsBlock(updated) {
 * 			statements = append(statements, updated.Statements()...)
 * 			statementsList := c.Factory.NewNodeList(statements)
 * 			statementsList.Loc = updated.StatementList().Loc
 * 			return c.Factory.UpdateBlock(updated.AsBlock(), statementsList, updated.AsBlock().MultiLine)
 * 		}
 * 		statements = append(statements, updated)
 * 		return c.Factory.NewBlock(c.Factory.NewNodeList(statements), true /*multiLine* /)
 * 	}
 * 
 * 	return updated
 * }
 */
export function EmitContext_VisitIterationBody(receiver: GoPtr<EmitContext>, body: GoPtr<Statement>, visitor: GoPtr<NodeVisitor>): GoPtr<Statement> {
  if (body === undefined) {
    return undefined;
  }

  const c = receiver!;
  EmitContext_StartLexicalEnvironment(receiver);
  const updated = EmitContext_VisitEmbeddedStatement(receiver, body, visitor);
  if (updated === undefined) {
    throw new globalThis.Error("Expected visitor to return a statement.");
  }

  const statements = EmitContext_EndLexicalEnvironment(receiver);
  if (statements.length > 0) {
    const f = c.Factory!.__tsgoEmbedded0!;
    if (IsBlock(updated)) {
      const updatedStatements = [...statements, ...Node_Statements(updated)!] as GoSlice<GoPtr<Node>>;
      const statementsList = NodeFactory_NewNodeList(f, updatedStatements)!;
      statementsList.Loc = Node_StatementList(updated)!.Loc;
      return NodeFactory_UpdateBlock(f, AsBlock(updated)!, statementsList, AsBlock(updated)!.MultiLine) as GoPtr<Statement>;
    }
    const combined = [...statements, updated] as GoSlice<GoPtr<Node>>;
    return NewBlock(f, NodeFactory_NewNodeList(f, combined), true as bool) as GoPtr<Statement>;
  }

  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.VisitEmbeddedStatement","kind":"method","status":"implemented","sigHash":"0e03657ed41915ab365f277e9ff6069944c743a3818ee9a70badfae3bf0a31dd","bodyHash":"4f1ce05a8f71f9416700170cd0887fa3fb14db7eeceb059d6c94be3500cbc06d"}
 *
 * Go source:
 * func (c *EmitContext) VisitEmbeddedStatement(node *ast.Statement, visitor *ast.NodeVisitor) *ast.Statement {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	embeddedStatement := visitor.VisitEmbeddedStatement(node)
 * 	if embeddedStatement == nil || ast.IsNotEmittedStatement(embeddedStatement) {
 * 		emptyStatement := visitor.Factory.NewEmptyStatement()
 * 		emptyStatement.Loc = node.Loc
 * 		c.SetOriginal(emptyStatement, node)
 * 		c.AssignCommentRange(emptyStatement, node)
 * 		return emptyStatement
 * 	}
 * 	return embeddedStatement
 * }
 */
export function EmitContext_VisitEmbeddedStatement(receiver: GoPtr<EmitContext>, node: GoPtr<Statement>, visitor: GoPtr<NodeVisitor>): GoPtr<Statement> {
  if (node === undefined) {
    return undefined;
  }
  const concreteVisitor = visitor as GoPtr<ConcreteNodeVisitor>;
  const embeddedStatement = NodeVisitor_VisitEmbeddedStatement(concreteVisitor, node);
  if (embeddedStatement === undefined || IsNotEmittedStatement(embeddedStatement)) {
    const emptyStatement = NewEmptyStatement(concreteVisitor!.Factory)!;
    emptyStatement.Loc = node!.Loc;
    EmitContext_SetOriginal(receiver, emptyStatement, node);
    EmitContext_AssignCommentRange(receiver, emptyStatement, node);
    return emptyStatement as GoPtr<Statement>;
  }
  return embeddedStatement as GoPtr<Statement>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetSyntheticLeadingComments","kind":"method","status":"implemented","sigHash":"d23ef93161bd703c1b799e867c26613b5bd43fae4b27728c4f51c380c85e7d30","bodyHash":"31e2b1420348224071c43edc388f44dfab7f1a69b2c7f7916983e1fdfbadf1c1"}
 *
 * Go source:
 * func (c *EmitContext) SetSyntheticLeadingComments(node *ast.Node, comments []SynthesizedComment) *ast.Node {
 * 	c.emitNodes.Get(node).leadingComments = comments
 * 	return node
 * }
 */
export function EmitContext_SetSyntheticLeadingComments(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, comments: GoSlice<SynthesizedComment>): GoPtr<Node> {
  const c = receiver!;
  LinkStore_Get(c.emitNodes, node)!.leadingComments = comments;
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddSyntheticLeadingComment","kind":"method","status":"implemented","sigHash":"bfbf2cf672ddcbd5d85fe4663a046b55630eb08428dc792e33708101c6cf1a5e","bodyHash":"943a8791791f1c2c5ecf36949568befa9b9576ce955d20e766176e7052107fe4"}
 *
 * Go source:
 * func (c *EmitContext) AddSyntheticLeadingComment(node *ast.Node, kind ast.Kind, text string, hasTrailingNewLine bool) *ast.Node {
 * 	c.emitNodes.Get(node).leadingComments = append(c.emitNodes.Get(node).leadingComments, SynthesizedComment{Kind: kind, Loc: core.NewTextRange(-1, -1), HasTrailingNewLine: hasTrailingNewLine, Text: text})
 * 	return node
 * }
 */
export function EmitContext_AddSyntheticLeadingComment(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, kind: Kind, text: string, hasTrailingNewLine: bool): GoPtr<Node> {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.leadingComments = [...(emitNode.leadingComments ?? []), { Kind: kind, Loc: NewTextRange(-1 as int, -1 as int), HasLeadingNewLine: false, HasTrailingNewLine: hasTrailingNewLine, Text: text }];
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetSyntheticLeadingComments","kind":"method","status":"implemented","sigHash":"e01deefc2f083661e490ceaccd0c704644f86143b4c0e890ad77eb32cc8f2075","bodyHash":"4040811e9ce89a33f0aa36969956238e895dbf537818b2b56e1e4833b65b7dd4"}
 *
 * Go source:
 * func (c *EmitContext) GetSyntheticLeadingComments(node *ast.Node) []SynthesizedComment {
 * 	if c.emitNodes.Has(node) {
 * 		return c.emitNodes.Get(node).leadingComments
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_GetSyntheticLeadingComments(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoSlice<SynthesizedComment> {
  const c = receiver!;
  if (LinkStore_Has(c.emitNodes, node)) {
    return LinkStore_Get(c.emitNodes, node)!.leadingComments ?? [];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetSyntheticTrailingComments","kind":"method","status":"implemented","sigHash":"67a1dde12919c47a14bbffea70b579ab0e595aa2799c2e136116230ba6463a68","bodyHash":"01ae68a8ae8ac4298ec433bbe6104a64d4486e6cd6356e9792a989416207aad7"}
 *
 * Go source:
 * func (c *EmitContext) SetSyntheticTrailingComments(node *ast.Node, comments []SynthesizedComment) *ast.Node {
 * 	c.emitNodes.Get(node).trailingComments = comments
 * 	return node
 * }
 */
export function EmitContext_SetSyntheticTrailingComments(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, comments: GoSlice<SynthesizedComment>): GoPtr<Node> {
  const c = receiver!;
  LinkStore_Get(c.emitNodes, node)!.trailingComments = comments;
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.AddSyntheticTrailingComment","kind":"method","status":"implemented","sigHash":"28c17007fc3ebfd64c74ae61d5cd49d9f107209e8ccf40de263d55fb5659d270","bodyHash":"6acbf3ea97e068c0da17cdd115ebc1681ba9f4c215cd5b67ba6fef12bce98010"}
 *
 * Go source:
 * func (c *EmitContext) AddSyntheticTrailingComment(node *ast.Node, kind ast.Kind, text string, hasTrailingNewLine bool) *ast.Node {
 * 	c.emitNodes.Get(node).trailingComments = append(c.emitNodes.Get(node).trailingComments, SynthesizedComment{Kind: kind, Loc: core.NewTextRange(-1, -1), HasTrailingNewLine: hasTrailingNewLine, Text: text})
 * 	return node
 * }
 */
export function EmitContext_AddSyntheticTrailingComment(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, kind: Kind, text: string, hasTrailingNewLine: bool): GoPtr<Node> {
  const c = receiver!;
  const emitNode = LinkStore_Get(c.emitNodes, node)!;
  emitNode.trailingComments = [...(emitNode.trailingComments ?? []), { Kind: kind, Loc: NewTextRange(-1 as int, -1 as int), HasLeadingNewLine: false, HasTrailingNewLine: hasTrailingNewLine, Text: text }];
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetSyntheticTrailingComments","kind":"method","status":"implemented","sigHash":"ef2de6437943b2f8394e16fdb7933a770cc3143a531070e527fbbec33bf91eb9","bodyHash":"d513b8893abe43a9d8c36d45babcdb44ffafeafd93ddb2bfe98c6ec885f9fc90"}
 *
 * Go source:
 * func (c *EmitContext) GetSyntheticTrailingComments(node *ast.Node) []SynthesizedComment {
 * 	if c.emitNodes.Has(node) {
 * 		return c.emitNodes.Get(node).trailingComments
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_GetSyntheticTrailingComments(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoSlice<SynthesizedComment> {
  const c = receiver!;
  if (LinkStore_Has(c.emitNodes, node)) {
    return LinkStore_Get(c.emitNodes, node)!.trailingComments ?? [];
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.SetTypeNode","kind":"method","status":"implemented","sigHash":"ffd76d4ada4d1be019a515200b872887dfd8ddefa2e50b9dce4964ff96f566e3","bodyHash":"86fab9087213c87981142dbff3f96ad19a819cd2a86c7fc9e5c71b42a2f75ba5"}
 *
 * Go source:
 * func (c *EmitContext) SetTypeNode(node *ast.Node, typeNode *ast.TypeNode) {
 * 	c.emitNodes.Get(node).typeNode = typeNode
 * }
 */
export function EmitContext_SetTypeNode(receiver: GoPtr<EmitContext>, node: GoPtr<Node>, typeNode: GoPtr<TypeNode>): void {
  const c = receiver!;
  LinkStore_Get(c.emitNodes, node)!.typeNode = typeNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.GetTypeNode","kind":"method","status":"implemented","sigHash":"947b85fab2df5b3954ab43f5be8715e4f098cde9fce979600ac1982d5ce3b2dc","bodyHash":"81921c9e138965fcfd9ea96a7f0ac36a6d37251ba2d8ff85b13cae63259b3a6a"}
 *
 * Go source:
 * func (c *EmitContext) GetTypeNode(node *ast.Node) *ast.TypeNode {
 * 	if emitNode := c.emitNodes.TryGet(node); emitNode != nil {
 * 		return emitNode.typeNode
 * 	}
 * 	return nil
 * }
 */
export function EmitContext_GetTypeNode(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<TypeNode> {
  const c = receiver!;
  const emitNode = LinkStore_TryGet(c.emitNodes, node);
  if (emitNode !== undefined) {
    return emitNode.typeNode;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitcontext.go::method::EmitContext.NewNotEmittedStatement","kind":"method","status":"implemented","sigHash":"d3ca4d9957a1696f8965f25a4eb77d3b1963a1cf7b3a091764598f237be9598d","bodyHash":"5cd43486c664764fb0c7fb6626c02eb7b64fab97ef715f3f92d1bf4a95cf888e"}
 *
 * Go source:
 * func (c *EmitContext) NewNotEmittedStatement(node *ast.Node) *ast.Statement {
 * 	statement := c.Factory.NewNotEmittedStatement()
 * 	statement.Loc = node.Loc
 * 	c.SetOriginal(statement, node)
 * 	c.AssignCommentRange(statement, node)
 * 	return statement
 * }
 */
export function EmitContext_NewNotEmittedStatement(receiver: GoPtr<EmitContext>, node: GoPtr<Node>): GoPtr<Statement> {
  const c = receiver!;
  const f = c.Factory!.__tsgoEmbedded0!;
  const statement = NewNotEmittedStatement(f)!;
  statement.Loc = node!.Loc;
  EmitContext_SetOriginal(receiver, statement, node);
  EmitContext_AssignCommentRange(receiver, statement, node);
  return statement as GoPtr<Statement>;
}
