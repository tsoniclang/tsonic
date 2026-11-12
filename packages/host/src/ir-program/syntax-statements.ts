import type {
  EmptyStatement, IfStatement, DoStatement, WhileStatement, ForStatement,
  ForInStatement, ForOfStatement, BreakStatement, ContinueStatement, ReturnStatement,
  WithStatement, SwitchStatement, CaseBlock, CaseClause, DefaultClause,
  ThrowStatement, TryStatement, CatchClause, DebuggerStatement, LabeledStatement,
  ExpressionStatement, Block, VariableStatement, VariableDeclaration, VariableDeclarationList,
  BindingPattern, ParameterDeclaration, BindingElement, MissingDeclaration, FunctionDeclaration,
  ClassDeclaration, ClassExpression, HeritageClause, InterfaceDeclaration, TypeAliasDeclaration,
  EnumMember, EnumDeclaration, ModuleBlock, NotEmittedStatement, NotEmittedTypeElement,
  CallSignatureDeclaration, ConstructSignatureDeclaration, ConstructorDeclaration, GetAccessorDeclaration, SetAccessorDeclaration,
  IndexSignatureDeclaration, MethodSignatureDeclaration, MethodDeclaration, PropertySignatureDeclaration, PropertyDeclaration,
  SemicolonClassElement, ClassStaticBlockDeclaration,
} from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./syntax-arena.js";
import { copyNodeList, memoSyntaxPlan, syntaxHeader } from "./syntax-arena.js";
import {
  rewriteIteration, rewriteBinding, rewriteBindingElement, rewriteVariableList, rewriteOmission, rewriteTypedParameter,
  rewriteCallable, rewriteClass, rewriteClassValue, rewriteHeritage, rewriteInterface,
  rewriteAlias, rewriteStorage, rewriteEnum, rewriteIndexDeclaration, rewriteStaticBlock,
} from "./canonical-phase.js";

export interface StatementsPlans {
  readonly EmptyStatement: (node: EmptyStatement<TypedPhase>) => SyntaxPlan<EmptyStatement<TypedPhase>>;
  readonly IfStatement: (node: IfStatement<TypedPhase>) => SyntaxPlan<IfStatement<TypedPhase>>;
  readonly DoStatement: (node: DoStatement<TypedPhase>) => SyntaxPlan<DoStatement<TypedPhase>>;
  readonly WhileStatement: (node: WhileStatement<TypedPhase>) => SyntaxPlan<WhileStatement<TypedPhase>>;
  readonly ForStatement: (node: ForStatement<TypedPhase>) => SyntaxPlan<ForStatement<TypedPhase>>;
  readonly ForInStatement: (node: ForInStatement<TypedPhase>) => SyntaxPlan<ForInStatement<TypedPhase>>;
  readonly ForOfStatement: (node: ForOfStatement<TypedPhase>) => SyntaxPlan<ForOfStatement<TypedPhase>>;
  readonly BreakStatement: (node: BreakStatement<TypedPhase>) => SyntaxPlan<BreakStatement<TypedPhase>>;
  readonly ContinueStatement: (node: ContinueStatement<TypedPhase>) => SyntaxPlan<ContinueStatement<TypedPhase>>;
  readonly ReturnStatement: (node: ReturnStatement<TypedPhase>) => SyntaxPlan<ReturnStatement<TypedPhase>>;
  readonly WithStatement: (node: WithStatement<TypedPhase>) => SyntaxPlan<WithStatement<TypedPhase>>;
  readonly SwitchStatement: (node: SwitchStatement<TypedPhase>) => SyntaxPlan<SwitchStatement<TypedPhase>>;
  readonly CaseBlock: (node: CaseBlock<TypedPhase>) => SyntaxPlan<CaseBlock<TypedPhase>>;
  readonly CaseClause: (node: CaseClause<TypedPhase>) => SyntaxPlan<CaseClause<TypedPhase>>;
  readonly DefaultClause: (node: DefaultClause<TypedPhase>) => SyntaxPlan<DefaultClause<TypedPhase>>;
  readonly ThrowStatement: (node: ThrowStatement<TypedPhase>) => SyntaxPlan<ThrowStatement<TypedPhase>>;
  readonly TryStatement: (node: TryStatement<TypedPhase>) => SyntaxPlan<TryStatement<TypedPhase>>;
  readonly CatchClause: (node: CatchClause<TypedPhase>) => SyntaxPlan<CatchClause<TypedPhase>>;
  readonly DebuggerStatement: (node: DebuggerStatement<TypedPhase>) => SyntaxPlan<DebuggerStatement<TypedPhase>>;
  readonly LabeledStatement: (node: LabeledStatement<TypedPhase>) => SyntaxPlan<LabeledStatement<TypedPhase>>;
  readonly ExpressionStatement: (node: ExpressionStatement<TypedPhase>) => SyntaxPlan<ExpressionStatement<TypedPhase>>;
  readonly Block: (node: Block<TypedPhase>) => SyntaxPlan<Block<TypedPhase>>;
  readonly VariableStatement: (node: VariableStatement<TypedPhase>) => SyntaxPlan<VariableStatement<TypedPhase>>;
  readonly VariableDeclaration: (node: VariableDeclaration<TypedPhase>) => SyntaxPlan<VariableDeclaration<TypedPhase>>;
  readonly VariableDeclarationList: (node: VariableDeclarationList<TypedPhase>) => SyntaxPlan<VariableDeclarationList<TypedPhase>>;
  readonly BindingPattern: (node: BindingPattern<TypedPhase>) => SyntaxPlan<BindingPattern<TypedPhase>>;
  readonly ParameterDeclaration: (node: ParameterDeclaration<TypedPhase>) => SyntaxPlan<ParameterDeclaration<TypedPhase>>;
  readonly BindingElement: (node: BindingElement<TypedPhase>) => SyntaxPlan<BindingElement<TypedPhase>>;
  readonly MissingDeclaration: (node: MissingDeclaration<TypedPhase>) => SyntaxPlan<MissingDeclaration<TypedPhase>>;
  readonly FunctionDeclaration: (node: FunctionDeclaration<TypedPhase>) => SyntaxPlan<FunctionDeclaration<TypedPhase>>;
  readonly ClassDeclaration: (node: ClassDeclaration<TypedPhase>) => SyntaxPlan<ClassDeclaration<TypedPhase>>;
  readonly ClassExpression: (node: ClassExpression<TypedPhase>) => SyntaxPlan<ClassExpression<TypedPhase>>;
  readonly HeritageClause: (node: HeritageClause<TypedPhase>) => SyntaxPlan<HeritageClause<TypedPhase>>;
  readonly InterfaceDeclaration: (node: InterfaceDeclaration<TypedPhase>) => SyntaxPlan<InterfaceDeclaration<TypedPhase>>;
  readonly TypeAliasDeclaration: (node: TypeAliasDeclaration<TypedPhase>) => SyntaxPlan<TypeAliasDeclaration<TypedPhase>>;
  readonly EnumMember: (node: EnumMember<TypedPhase>) => SyntaxPlan<EnumMember<TypedPhase>>;
  readonly EnumDeclaration: (node: EnumDeclaration<TypedPhase>) => SyntaxPlan<EnumDeclaration<TypedPhase>>;
  readonly ModuleBlock: (node: ModuleBlock<TypedPhase>) => SyntaxPlan<ModuleBlock<TypedPhase>>;
  readonly NotEmittedStatement: (node: NotEmittedStatement<TypedPhase>) => SyntaxPlan<NotEmittedStatement<TypedPhase>>;
  readonly NotEmittedTypeElement: (node: NotEmittedTypeElement<TypedPhase>) => SyntaxPlan<NotEmittedTypeElement<TypedPhase>>;
  readonly CallSignatureDeclaration: (node: CallSignatureDeclaration<TypedPhase>) => SyntaxPlan<CallSignatureDeclaration<TypedPhase>>;
  readonly ConstructSignatureDeclaration: (node: ConstructSignatureDeclaration<TypedPhase>) => SyntaxPlan<ConstructSignatureDeclaration<TypedPhase>>;
  readonly ConstructorDeclaration: (node: ConstructorDeclaration<TypedPhase>) => SyntaxPlan<ConstructorDeclaration<TypedPhase>>;
  readonly GetAccessorDeclaration: (node: GetAccessorDeclaration<TypedPhase>) => SyntaxPlan<GetAccessorDeclaration<TypedPhase>>;
  readonly SetAccessorDeclaration: (node: SetAccessorDeclaration<TypedPhase>) => SyntaxPlan<SetAccessorDeclaration<TypedPhase>>;
  readonly IndexSignatureDeclaration: (node: IndexSignatureDeclaration<TypedPhase>) => SyntaxPlan<IndexSignatureDeclaration<TypedPhase>>;
  readonly MethodSignatureDeclaration: (node: MethodSignatureDeclaration<TypedPhase>) => SyntaxPlan<MethodSignatureDeclaration<TypedPhase>>;
  readonly MethodDeclaration: (node: MethodDeclaration<TypedPhase>) => SyntaxPlan<MethodDeclaration<TypedPhase>>;
  readonly PropertySignatureDeclaration: (node: PropertySignatureDeclaration<TypedPhase>) => SyntaxPlan<PropertySignatureDeclaration<TypedPhase>>;
  readonly PropertyDeclaration: (node: PropertyDeclaration<TypedPhase>) => SyntaxPlan<PropertyDeclaration<TypedPhase>>;
  readonly SemicolonClassElement: (node: SemicolonClassElement<TypedPhase>) => SyntaxPlan<SemicolonClassElement<TypedPhase>>;
  readonly ClassStaticBlockDeclaration: (node: ClassStaticBlockDeclaration<TypedPhase>) => SyntaxPlan<ClassStaticBlockDeclaration<TypedPhase>>;
}

export function createStatementsPlans(rewrite: TypeRewrite, ports: () => SyntaxCopyPorts, at: string): StatementsPlans {
  const EmptyStatement = new Map<EmptyStatement<TypedPhase>, SyntaxPlan<EmptyStatement<TypedPhase>>>();
  const IfStatement = new Map<IfStatement<TypedPhase>, SyntaxPlan<IfStatement<TypedPhase>>>();
  const DoStatement = new Map<DoStatement<TypedPhase>, SyntaxPlan<DoStatement<TypedPhase>>>();
  const WhileStatement = new Map<WhileStatement<TypedPhase>, SyntaxPlan<WhileStatement<TypedPhase>>>();
  const ForStatement = new Map<ForStatement<TypedPhase>, SyntaxPlan<ForStatement<TypedPhase>>>();
  const ForInStatement = new Map<ForInStatement<TypedPhase>, SyntaxPlan<ForInStatement<TypedPhase>>>();
  const ForOfStatement = new Map<ForOfStatement<TypedPhase>, SyntaxPlan<ForOfStatement<TypedPhase>>>();
  const BreakStatement = new Map<BreakStatement<TypedPhase>, SyntaxPlan<BreakStatement<TypedPhase>>>();
  const ContinueStatement = new Map<ContinueStatement<TypedPhase>, SyntaxPlan<ContinueStatement<TypedPhase>>>();
  const ReturnStatement = new Map<ReturnStatement<TypedPhase>, SyntaxPlan<ReturnStatement<TypedPhase>>>();
  const WithStatement = new Map<WithStatement<TypedPhase>, SyntaxPlan<WithStatement<TypedPhase>>>();
  const SwitchStatement = new Map<SwitchStatement<TypedPhase>, SyntaxPlan<SwitchStatement<TypedPhase>>>();
  const CaseBlock = new Map<CaseBlock<TypedPhase>, SyntaxPlan<CaseBlock<TypedPhase>>>();
  const CaseClause = new Map<CaseClause<TypedPhase>, SyntaxPlan<CaseClause<TypedPhase>>>();
  const DefaultClause = new Map<DefaultClause<TypedPhase>, SyntaxPlan<DefaultClause<TypedPhase>>>();
  const ThrowStatement = new Map<ThrowStatement<TypedPhase>, SyntaxPlan<ThrowStatement<TypedPhase>>>();
  const TryStatement = new Map<TryStatement<TypedPhase>, SyntaxPlan<TryStatement<TypedPhase>>>();
  const CatchClause = new Map<CatchClause<TypedPhase>, SyntaxPlan<CatchClause<TypedPhase>>>();
  const DebuggerStatement = new Map<DebuggerStatement<TypedPhase>, SyntaxPlan<DebuggerStatement<TypedPhase>>>();
  const LabeledStatement = new Map<LabeledStatement<TypedPhase>, SyntaxPlan<LabeledStatement<TypedPhase>>>();
  const ExpressionStatement = new Map<ExpressionStatement<TypedPhase>, SyntaxPlan<ExpressionStatement<TypedPhase>>>();
  const Block = new Map<Block<TypedPhase>, SyntaxPlan<Block<TypedPhase>>>();
  const VariableStatement = new Map<VariableStatement<TypedPhase>, SyntaxPlan<VariableStatement<TypedPhase>>>();
  const VariableDeclaration = new Map<VariableDeclaration<TypedPhase>, SyntaxPlan<VariableDeclaration<TypedPhase>>>();
  const VariableDeclarationList = new Map<VariableDeclarationList<TypedPhase>, SyntaxPlan<VariableDeclarationList<TypedPhase>>>();
  const BindingPattern = new Map<BindingPattern<TypedPhase>, SyntaxPlan<BindingPattern<TypedPhase>>>();
  const ParameterDeclaration = new Map<ParameterDeclaration<TypedPhase>, SyntaxPlan<ParameterDeclaration<TypedPhase>>>();
  const BindingElement = new Map<BindingElement<TypedPhase>, SyntaxPlan<BindingElement<TypedPhase>>>();
  const MissingDeclaration = new Map<MissingDeclaration<TypedPhase>, SyntaxPlan<MissingDeclaration<TypedPhase>>>();
  const FunctionDeclaration = new Map<FunctionDeclaration<TypedPhase>, SyntaxPlan<FunctionDeclaration<TypedPhase>>>();
  const ClassDeclaration = new Map<ClassDeclaration<TypedPhase>, SyntaxPlan<ClassDeclaration<TypedPhase>>>();
  const ClassExpression = new Map<ClassExpression<TypedPhase>, SyntaxPlan<ClassExpression<TypedPhase>>>();
  const HeritageClause = new Map<HeritageClause<TypedPhase>, SyntaxPlan<HeritageClause<TypedPhase>>>();
  const InterfaceDeclaration = new Map<InterfaceDeclaration<TypedPhase>, SyntaxPlan<InterfaceDeclaration<TypedPhase>>>();
  const TypeAliasDeclaration = new Map<TypeAliasDeclaration<TypedPhase>, SyntaxPlan<TypeAliasDeclaration<TypedPhase>>>();
  const EnumMember = new Map<EnumMember<TypedPhase>, SyntaxPlan<EnumMember<TypedPhase>>>();
  const EnumDeclaration = new Map<EnumDeclaration<TypedPhase>, SyntaxPlan<EnumDeclaration<TypedPhase>>>();
  const ModuleBlock = new Map<ModuleBlock<TypedPhase>, SyntaxPlan<ModuleBlock<TypedPhase>>>();
  const NotEmittedStatement = new Map<NotEmittedStatement<TypedPhase>, SyntaxPlan<NotEmittedStatement<TypedPhase>>>();
  const NotEmittedTypeElement = new Map<NotEmittedTypeElement<TypedPhase>, SyntaxPlan<NotEmittedTypeElement<TypedPhase>>>();
  const CallSignatureDeclaration = new Map<CallSignatureDeclaration<TypedPhase>, SyntaxPlan<CallSignatureDeclaration<TypedPhase>>>();
  const ConstructSignatureDeclaration = new Map<ConstructSignatureDeclaration<TypedPhase>, SyntaxPlan<ConstructSignatureDeclaration<TypedPhase>>>();
  const ConstructorDeclaration = new Map<ConstructorDeclaration<TypedPhase>, SyntaxPlan<ConstructorDeclaration<TypedPhase>>>();
  const GetAccessorDeclaration = new Map<GetAccessorDeclaration<TypedPhase>, SyntaxPlan<GetAccessorDeclaration<TypedPhase>>>();
  const SetAccessorDeclaration = new Map<SetAccessorDeclaration<TypedPhase>, SyntaxPlan<SetAccessorDeclaration<TypedPhase>>>();
  const IndexSignatureDeclaration = new Map<IndexSignatureDeclaration<TypedPhase>, SyntaxPlan<IndexSignatureDeclaration<TypedPhase>>>();
  const MethodSignatureDeclaration = new Map<MethodSignatureDeclaration<TypedPhase>, SyntaxPlan<MethodSignatureDeclaration<TypedPhase>>>();
  const MethodDeclaration = new Map<MethodDeclaration<TypedPhase>, SyntaxPlan<MethodDeclaration<TypedPhase>>>();
  const PropertySignatureDeclaration = new Map<PropertySignatureDeclaration<TypedPhase>, SyntaxPlan<PropertySignatureDeclaration<TypedPhase>>>();
  const PropertyDeclaration = new Map<PropertyDeclaration<TypedPhase>, SyntaxPlan<PropertyDeclaration<TypedPhase>>>();
  const SemicolonClassElement = new Map<SemicolonClassElement<TypedPhase>, SyntaxPlan<SemicolonClassElement<TypedPhase>>>();
  const ClassStaticBlockDeclaration = new Map<ClassStaticBlockDeclaration<TypedPhase>, SyntaxPlan<ClassStaticBlockDeclaration<TypedPhase>>>();
  return {
    EmptyStatement: node => memoSyntaxPlan(EmptyStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    IfStatement: node => memoSyntaxPlan(IfStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      thenStatement: ports().Statement(node.thenStatement)(),
      elseStatement: node.elseStatement === null ? null : ports().Statement(node.elseStatement)(),
      tsonic: node.tsonic,
    })),
    DoStatement: node => memoSyntaxPlan(DoStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statement: ports().Statement(node.statement)(),
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    WhileStatement: node => memoSyntaxPlan(WhileStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statement: ports().Statement(node.statement)(),
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    ForStatement: node => memoSyntaxPlan(ForStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statement: ports().Statement(node.statement)(),
      initializer: node.initializer === null ? null : ports().ForInitializer(node.initializer)(),
      condition: node.condition === null ? null : ports().Expression(node.condition)(),
      incrementor: node.incrementor === null ? null : ports().Expression(node.incrementor)(),
      tsonic: node.tsonic,
    })),
    ForInStatement: node => memoSyntaxPlan(ForInStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      awaitModifier: node.awaitModifier,
      initializer: ports().ForInitializer(node.initializer)(),
      expression: ports().Expression(node.expression)(),
      statement: ports().Statement(node.statement)(),
      tsonic: rewriteIteration(rewrite, node.tsonic, at + ".ForInStatement.tsonic"),
    })),
    ForOfStatement: node => memoSyntaxPlan(ForOfStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      awaitModifier: node.awaitModifier,
      initializer: ports().ForInitializer(node.initializer)(),
      expression: ports().Expression(node.expression)(),
      statement: ports().Statement(node.statement)(),
      tsonic: rewriteIteration(rewrite, node.tsonic, at + ".ForOfStatement.tsonic"),
    })),
    BreakStatement: node => memoSyntaxPlan(BreakStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      label: node.label === null ? null : ports().Identifier(node.label)(),
      tsonic: node.tsonic,
    })),
    ContinueStatement: node => memoSyntaxPlan(ContinueStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      label: node.label === null ? null : ports().Identifier(node.label)(),
      tsonic: node.tsonic,
    })),
    ReturnStatement: node => memoSyntaxPlan(ReturnStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: node.expression === null ? null : ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    WithStatement: node => memoSyntaxPlan(WithStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      statement: ports().Statement(node.statement)(),
      tsonic: node.tsonic,
    })),
    SwitchStatement: node => memoSyntaxPlan(SwitchStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      caseBlock: ports().CaseBlock(node.caseBlock)(),
      tsonic: node.tsonic,
    })),
    CaseBlock: node => memoSyntaxPlan(CaseBlock, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      clauses: copyNodeList(node.clauses, item => ports().CaseOrDefaultClause(item)()),
      tsonic: node.tsonic,
    })),
    CaseClause: node => memoSyntaxPlan(CaseClause, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      statements: copyNodeList(node.statements, item => ports().Statement(item)()),
      tsonic: node.tsonic,
    })),
    DefaultClause: node => memoSyntaxPlan(DefaultClause, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: node.expression,
      statements: copyNodeList(node.statements, item => ports().Statement(item)()),
      tsonic: node.tsonic,
    })),
    ThrowStatement: node => memoSyntaxPlan(ThrowStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    TryStatement: node => memoSyntaxPlan(TryStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tryBlock: ports().Block(node.tryBlock)(),
      catchClause: node.catchClause === null ? null : ports().CatchClause(node.catchClause)(),
      finallyBlock: node.finallyBlock === null ? null : ports().Block(node.finallyBlock)(),
      tsonic: node.tsonic,
    })),
    CatchClause: node => memoSyntaxPlan(CatchClause, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      variableDeclaration: node.variableDeclaration === null ? null : ports().VariableDeclaration(node.variableDeclaration)(),
      block: ports().Block(node.block)(),
      tsonic: node.tsonic,
    })),
    DebuggerStatement: node => memoSyntaxPlan(DebuggerStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    LabeledStatement: node => memoSyntaxPlan(LabeledStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      label: ports().Identifier(node.label)(),
      statement: ports().Statement(node.statement)(),
      tsonic: node.tsonic,
    })),
    ExpressionStatement: node => memoSyntaxPlan(ExpressionStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      expression: ports().Expression(node.expression)(),
      tsonic: node.tsonic,
    })),
    Block: node => memoSyntaxPlan(Block, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statements: copyNodeList(node.statements, item => ports().Statement(item)()),
      multiLine: node.multiLine,
      tsonic: node.tsonic,
    })),
    VariableStatement: node => memoSyntaxPlan(VariableStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      declarationList: ports().VariableDeclarationList(node.declarationList)(),
      tsonic: node.tsonic,
    })),
    VariableDeclaration: node => memoSyntaxPlan(VariableDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      name: ports().BindingName(node.name)(),
      exclamationToken: node.exclamationToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteBinding(rewrite, node.tsonic),
    })),
    VariableDeclarationList: node => memoSyntaxPlan(VariableDeclarationList, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      declarations: copyNodeList(node.declarations, item => ports().VariableDeclaration(item)()),
      tsonic: rewriteVariableList(rewrite, node.tsonic, at + ".VariableDeclarationList.tsonic"),
    })),
    BindingPattern: node => memoSyntaxPlan(BindingPattern, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      elements: copyNodeList(node.elements, item => ports().BindingElement(item)()),
      tsonic: rewriteOmission(rewrite, node.tsonic),
    })),
    ParameterDeclaration: node => memoSyntaxPlan(ParameterDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      dotDotDotToken: node.dotDotDotToken,
      name: ports().BindingName(node.name)(),
      questionToken: node.questionToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteTypedParameter(rewrite, node.tsonic),
    })),
    BindingElement: node => memoSyntaxPlan(BindingElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      dotDotDotToken: node.dotDotDotToken,
      propertyName: node.propertyName === null ? null : ports().PropertyName(node.propertyName)(),
      name: node.name === null ? null : ports().BindingName(node.name)(),
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteBindingElement(rewrite, node.tsonic),
    })),
    MissingDeclaration: node => memoSyntaxPlan(MissingDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      tsonic: node.tsonic,
    })),
    FunctionDeclaration: node => memoSyntaxPlan(FunctionDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      name: node.name === null ? null : ports().Identifier(node.name)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    ClassDeclaration: node => memoSyntaxPlan(ClassDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: node.name === null ? null : ports().Identifier(node.name)(),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item)()),
      members: copyNodeList(node.members, item => ports().ClassElement(item)()),
      tsonic: rewriteClass(rewrite, node.tsonic),
    })),
    ClassExpression: node => memoSyntaxPlan(ClassExpression, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: node.name === null ? null : ports().Identifier(node.name)(),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item)()),
      members: copyNodeList(node.members, item => ports().ClassElement(item)()),
      tsonic: rewriteClassValue(rewrite, node.tsonic, at + ".ClassExpression.tsonic"),
    })),
    HeritageClause: node => memoSyntaxPlan(HeritageClause, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      token: node.token,
      types: copyNodeList(node.types, item => ports().ExpressionWithTypeArguments(item)()),
      tsonic: rewriteHeritage(rewrite, node.tsonic),
    })),
    InterfaceDeclaration: node => memoSyntaxPlan(InterfaceDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().Identifier(node.name)(),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item)()),
      members: copyNodeList(node.members, item => ports().TypeElement(item)()),
      tsonic: rewriteInterface(rewrite, node.tsonic),
    })),
    TypeAliasDeclaration: node => memoSyntaxPlan(TypeAliasDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().Identifier(node.name)(),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      type: ports().TypeNode(node.type)(),
      tsonic: rewriteAlias(rewrite, node.tsonic),
    })),
    EnumMember: node => memoSyntaxPlan(EnumMember, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteStorage(rewrite, node.tsonic),
    })),
    EnumDeclaration: node => memoSyntaxPlan(EnumDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().Identifier(node.name)(),
      members: copyNodeList(node.members, item => ports().EnumMember(item)()),
      tsonic: rewriteEnum(rewrite, node.tsonic),
    })),
    ModuleBlock: node => memoSyntaxPlan(ModuleBlock, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      statements: copyNodeList(node.statements, item => ports().Statement(item)()),
      tsonic: node.tsonic,
    })),
    NotEmittedStatement: node => memoSyntaxPlan(NotEmittedStatement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    NotEmittedTypeElement: node => memoSyntaxPlan(NotEmittedTypeElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    CallSignatureDeclaration: node => memoSyntaxPlan(CallSignatureDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    ConstructSignatureDeclaration: node => memoSyntaxPlan(ConstructSignatureDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    ConstructorDeclaration: node => memoSyntaxPlan(ConstructorDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    GetAccessorDeclaration: node => memoSyntaxPlan(GetAccessorDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    SetAccessorDeclaration: node => memoSyntaxPlan(SetAccessorDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    IndexSignatureDeclaration: node => memoSyntaxPlan(IndexSignatureDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteIndexDeclaration(rewrite, node.tsonic),
    })),
    MethodSignatureDeclaration: node => memoSyntaxPlan(MethodSignatureDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    MethodDeclaration: node => memoSyntaxPlan(MethodDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item)()),
      parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item)()),
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature)(),
      asteriskToken: node.asteriskToken,
      body: node.body === null ? null : ports().BlockOrExpression(node.body)(),
      tsonic: rewriteCallable(rewrite, node.tsonic),
    })),
    PropertySignatureDeclaration: node => memoSyntaxPlan(PropertySignatureDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteStorage(rewrite, node.tsonic),
    })),
    PropertyDeclaration: node => memoSyntaxPlan(PropertyDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      name: ports().PropertyName(node.name)(),
      postfixToken: node.postfixToken,
      type: node.type === null ? null : ports().TypeNode(node.type)(),
      initializer: node.initializer === null ? null : ports().Expression(node.initializer)(),
      tsonic: rewriteStorage(rewrite, node.tsonic),
    })),
    SemicolonClassElement: node => memoSyntaxPlan(SemicolonClassElement, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      tsonic: node.tsonic,
    })),
    ClassStaticBlockDeclaration: node => memoSyntaxPlan(ClassStaticBlockDeclaration, node, () => ({
      ...syntaxHeader(node),
      kind: node.kind,
      modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item)()),
      body: ports().Block(node.body)(),
      tsonic: rewriteStaticBlock(rewrite, node.tsonic),
    })),
  };
}
