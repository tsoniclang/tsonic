import type {
  EmptyStatement, IfStatement, DoStatement, WhileStatement, ForStatement,
  ForInStatement, ForOfStatement, BreakStatement, ContinueStatement, ReturnStatement,
  WithStatement, SwitchStatement, CaseBlock, CaseClause, DefaultClause,
  ThrowStatement, TryStatement, CatchClause, DebuggerStatement, LabeledStatement,
  ExpressionStatement, Block, BlockSyntaxReceipt, VariableStatement, VariableDeclaration, VariableDeclarationList,
  BindingPattern, ParameterDeclaration, ParameterSyntaxReceipt, BindingElement, MissingDeclaration, FunctionDeclaration, FunctionSyntaxReceipt,
  ClassDeclaration, ClassExpression, HeritageClause, InterfaceDeclaration, TypeAliasDeclaration,
  EnumMember, EnumDeclaration, ModuleBlock, NotEmittedStatement, NotEmittedTypeElement,
  CallSignatureDeclaration, ConstructSignatureDeclaration, ConstructorDeclaration, GetAccessorDeclaration, SetAccessorDeclaration,
  IndexSignatureDeclaration, MethodSignatureDeclaration, MethodDeclaration, PropertySignatureDeclaration, PropertyDeclaration,
  SemicolonClassElement, ClassStaticBlockDeclaration,
  Expression, Phase, SingleExpressionSyntax, SyntaxInitializerImage, SyntaxPhaseCopy,
} from "./contract.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { copied, holdSyntaxPayload, copyNodeList, finishFunctionSyntax, memoSyntaxPlan, syntaxHeader, withSyntaxPayload } from "./copy-node.js";

export interface StatementsPlans<P extends Phase, Stop, Image> {
  readonly EmptyStatement: (node: EmptyStatement<P>) => SyntaxPlan<EmptyStatement<P>, Stop, Image>;
  readonly IfStatement: (node: IfStatement<P>) => SyntaxPlan<IfStatement<P>, Stop, Image>;
  readonly DoStatement: (node: DoStatement<P>) => SyntaxPlan<DoStatement<P>, Stop, Image>;
  readonly WhileStatement: (node: WhileStatement<P>) => SyntaxPlan<WhileStatement<P>, Stop, Image>;
  readonly ForStatement: (node: ForStatement<P>) => SyntaxPlan<ForStatement<P>, Stop, Image>;
  readonly ForInStatement: (node: ForInStatement<P>) => SyntaxPlan<ForInStatement<P>, Stop, Image>;
  readonly ForOfStatement: (node: ForOfStatement<P>) => SyntaxPlan<ForOfStatement<P>, Stop, Image>;
  readonly BreakStatement: (node: BreakStatement<P>) => SyntaxPlan<BreakStatement<P>, Stop, Image>;
  readonly ContinueStatement: (node: ContinueStatement<P>) => SyntaxPlan<ContinueStatement<P>, Stop, Image>;
  readonly ReturnStatement: (node: ReturnStatement<P>) => SyntaxPlan<ReturnStatement<P>, Stop, Image>;
  readonly WithStatement: (node: WithStatement<P>) => SyntaxPlan<WithStatement<P>, Stop, Image>;
  readonly SwitchStatement: (node: SwitchStatement<P>) => SyntaxPlan<SwitchStatement<P>, Stop, Image>;
  readonly CaseBlock: (node: CaseBlock<P>) => SyntaxPlan<CaseBlock<P>, Stop, Image>;
  readonly CaseClause: (node: CaseClause<P>) => SyntaxPlan<CaseClause<P>, Stop, Image>;
  readonly DefaultClause: (node: DefaultClause<P>) => SyntaxPlan<DefaultClause<P>, Stop, Image>;
  readonly ThrowStatement: (node: ThrowStatement<P>) => SyntaxPlan<ThrowStatement<P>, Stop, Image>;
  readonly TryStatement: (node: TryStatement<P>) => SyntaxPlan<TryStatement<P>, Stop, Image>;
  readonly CatchClause: (node: CatchClause<P>) => SyntaxPlan<CatchClause<P>, Stop, Image>;
  readonly DebuggerStatement: (node: DebuggerStatement<P>) => SyntaxPlan<DebuggerStatement<P>, Stop, Image>;
  readonly LabeledStatement: (node: LabeledStatement<P>) => SyntaxPlan<LabeledStatement<P>, Stop, Image>;
  readonly ExpressionStatement: (node: ExpressionStatement<P>) => SyntaxPlan<ExpressionStatement<P>, Stop, Image>;
  readonly Block: (node: Block<P>) => SyntaxPlan<Block<P>, Stop, Image>;
  readonly VariableStatement: (node: VariableStatement<P>) => SyntaxPlan<VariableStatement<P>, Stop, Image>;
  readonly VariableDeclaration: (node: VariableDeclaration<P>) => SyntaxPlan<VariableDeclaration<P>, Stop, Image>;
  readonly VariableDeclarationList: (node: VariableDeclarationList<P>) => SyntaxPlan<VariableDeclarationList<P>, Stop, Image>;
  readonly BindingPattern: (node: BindingPattern<P>) => SyntaxPlan<BindingPattern<P>, Stop, Image>;
  readonly ParameterDeclaration: (node: ParameterDeclaration<P>) => SyntaxPlan<ParameterDeclaration<P>, Stop, Image>;
  readonly BindingElement: (node: BindingElement<P>) => SyntaxPlan<BindingElement<P>, Stop, Image>;
  readonly MissingDeclaration: (node: MissingDeclaration<P>) => SyntaxPlan<MissingDeclaration<P>, Stop, Image>;
  readonly FunctionDeclaration: (node: FunctionDeclaration<P>) => SyntaxPlan<FunctionDeclaration<P>, Stop, Image>;
  readonly ClassDeclaration: (node: ClassDeclaration<P>) => SyntaxPlan<ClassDeclaration<P>, Stop, Image>;
  readonly ClassExpression: (node: ClassExpression<P>) => SyntaxPlan<ClassExpression<P>, Stop, Image>;
  readonly HeritageClause: (node: HeritageClause<P>) => SyntaxPlan<HeritageClause<P>, Stop, Image>;
  readonly InterfaceDeclaration: (node: InterfaceDeclaration<P>) => SyntaxPlan<InterfaceDeclaration<P>, Stop, Image>;
  readonly TypeAliasDeclaration: (node: TypeAliasDeclaration<P>) => SyntaxPlan<TypeAliasDeclaration<P>, Stop, Image>;
  readonly EnumMember: (node: EnumMember<P>) => SyntaxPlan<EnumMember<P>, Stop, Image>;
  readonly EnumDeclaration: (node: EnumDeclaration<P>) => SyntaxPlan<EnumDeclaration<P>, Stop, Image>;
  readonly ModuleBlock: (node: ModuleBlock<P>) => SyntaxPlan<ModuleBlock<P>, Stop, Image>;
  readonly NotEmittedStatement: (node: NotEmittedStatement<P>) => SyntaxPlan<NotEmittedStatement<P>, Stop, Image>;
  readonly NotEmittedTypeElement: (node: NotEmittedTypeElement<P>) => SyntaxPlan<NotEmittedTypeElement<P>, Stop, Image>;
  readonly CallSignatureDeclaration: (node: CallSignatureDeclaration<P>) => SyntaxPlan<CallSignatureDeclaration<P>, Stop, Image>;
  readonly ConstructSignatureDeclaration: (node: ConstructSignatureDeclaration<P>) => SyntaxPlan<ConstructSignatureDeclaration<P>, Stop, Image>;
  readonly ConstructorDeclaration: (node: ConstructorDeclaration<P>) => SyntaxPlan<ConstructorDeclaration<P>, Stop, Image>;
  readonly GetAccessorDeclaration: (node: GetAccessorDeclaration<P>) => SyntaxPlan<GetAccessorDeclaration<P>, Stop, Image>;
  readonly SetAccessorDeclaration: (node: SetAccessorDeclaration<P>) => SyntaxPlan<SetAccessorDeclaration<P>, Stop, Image>;
  readonly IndexSignatureDeclaration: (node: IndexSignatureDeclaration<P>) => SyntaxPlan<IndexSignatureDeclaration<P>, Stop, Image>;
  readonly MethodSignatureDeclaration: (node: MethodSignatureDeclaration<P>) => SyntaxPlan<MethodSignatureDeclaration<P>, Stop, Image>;
  readonly MethodDeclaration: (node: MethodDeclaration<P>) => SyntaxPlan<MethodDeclaration<P>, Stop, Image>;
  readonly PropertySignatureDeclaration: (node: PropertySignatureDeclaration<P>) => SyntaxPlan<PropertySignatureDeclaration<P>, Stop, Image>;
  readonly PropertyDeclaration: (node: PropertyDeclaration<P>) => SyntaxPlan<PropertyDeclaration<P>, Stop, Image>;
  readonly SemicolonClassElement: (node: SemicolonClassElement<P>) => SyntaxPlan<SemicolonClassElement<P>, Stop, Image>;
  readonly ClassStaticBlockDeclaration: (node: ClassStaticBlockDeclaration<P>) => SyntaxPlan<ClassStaticBlockDeclaration<P>, Stop, Image>;
}

export function createStatementsPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>,
  ports: () => SyntaxCopyPorts<P, Stop, Image>, copyInitializer: SyntaxInitializerImage<P, Image>,
  blockOf: (node: Block<P>) => BlockSyntaxReceipt<P>, returned: (node: ReturnStatement<P>) => Expression<P> | null,
  expressionOf: (node: SingleExpressionSyntax<P>) => Expression<P>,
  parameterOf: (node: ParameterDeclaration<P>) => ParameterSyntaxReceipt<P>,
  functionOf: (node: FunctionDeclaration<P>) => FunctionSyntaxReceipt<P>):
  StatementsPlans<P, Stop, Image> {
  const EmptyStatement = new Map<EmptyStatement<P>, SyntaxPlan<EmptyStatement<P>, Stop, Image>>();
  const IfStatement = new Map<IfStatement<P>, SyntaxPlan<IfStatement<P>, Stop, Image>>();
  const DoStatement = new Map<DoStatement<P>, SyntaxPlan<DoStatement<P>, Stop, Image>>();
  const WhileStatement = new Map<WhileStatement<P>, SyntaxPlan<WhileStatement<P>, Stop, Image>>();
  const ForStatement = new Map<ForStatement<P>, SyntaxPlan<ForStatement<P>, Stop, Image>>();
  const ForInStatement = new Map<ForInStatement<P>, SyntaxPlan<ForInStatement<P>, Stop, Image>>();
  const ForOfStatement = new Map<ForOfStatement<P>, SyntaxPlan<ForOfStatement<P>, Stop, Image>>();
  const BreakStatement = new Map<BreakStatement<P>, SyntaxPlan<BreakStatement<P>, Stop, Image>>();
  const ContinueStatement = new Map<ContinueStatement<P>, SyntaxPlan<ContinueStatement<P>, Stop, Image>>();
  const ReturnStatement = new Map<ReturnStatement<P>, SyntaxPlan<ReturnStatement<P>, Stop, Image>>();
  const WithStatement = new Map<WithStatement<P>, SyntaxPlan<WithStatement<P>, Stop, Image>>();
  const SwitchStatement = new Map<SwitchStatement<P>, SyntaxPlan<SwitchStatement<P>, Stop, Image>>();
  const CaseBlock = new Map<CaseBlock<P>, SyntaxPlan<CaseBlock<P>, Stop, Image>>();
  const CaseClause = new Map<CaseClause<P>, SyntaxPlan<CaseClause<P>, Stop, Image>>();
  const DefaultClause = new Map<DefaultClause<P>, SyntaxPlan<DefaultClause<P>, Stop, Image>>();
  const ThrowStatement = new Map<ThrowStatement<P>, SyntaxPlan<ThrowStatement<P>, Stop, Image>>();
  const TryStatement = new Map<TryStatement<P>, SyntaxPlan<TryStatement<P>, Stop, Image>>();
  const CatchClause = new Map<CatchClause<P>, SyntaxPlan<CatchClause<P>, Stop, Image>>();
  const DebuggerStatement = new Map<DebuggerStatement<P>, SyntaxPlan<DebuggerStatement<P>, Stop, Image>>();
  const LabeledStatement = new Map<LabeledStatement<P>, SyntaxPlan<LabeledStatement<P>, Stop, Image>>();
  const ExpressionStatement = new Map<ExpressionStatement<P>, SyntaxPlan<ExpressionStatement<P>, Stop, Image>>();
  const Block = new Map<Block<P>, SyntaxPlan<Block<P>, Stop, Image>>();
  const VariableStatement = new Map<VariableStatement<P>, SyntaxPlan<VariableStatement<P>, Stop, Image>>();
  const VariableDeclaration = new Map<VariableDeclaration<P>, SyntaxPlan<VariableDeclaration<P>, Stop, Image>>();
  const VariableDeclarationList = new Map<VariableDeclarationList<P>, SyntaxPlan<VariableDeclarationList<P>, Stop, Image>>();
  const BindingPattern = new Map<BindingPattern<P>, SyntaxPlan<BindingPattern<P>, Stop, Image>>();
  const ParameterDeclaration = new Map<ParameterDeclaration<P>, SyntaxPlan<ParameterDeclaration<P>, Stop, Image>>();
  const BindingElement = new Map<BindingElement<P>, SyntaxPlan<BindingElement<P>, Stop, Image>>();
  const MissingDeclaration = new Map<MissingDeclaration<P>, SyntaxPlan<MissingDeclaration<P>, Stop, Image>>();
  const FunctionDeclaration = new Map<FunctionDeclaration<P>, SyntaxPlan<FunctionDeclaration<P>, Stop, Image>>();
  const ClassDeclaration = new Map<ClassDeclaration<P>, SyntaxPlan<ClassDeclaration<P>, Stop, Image>>();
  const ClassExpression = new Map<ClassExpression<P>, SyntaxPlan<ClassExpression<P>, Stop, Image>>();
  const HeritageClause = new Map<HeritageClause<P>, SyntaxPlan<HeritageClause<P>, Stop, Image>>();
  const InterfaceDeclaration = new Map<InterfaceDeclaration<P>, SyntaxPlan<InterfaceDeclaration<P>, Stop, Image>>();
  const TypeAliasDeclaration = new Map<TypeAliasDeclaration<P>, SyntaxPlan<TypeAliasDeclaration<P>, Stop, Image>>();
  const EnumMember = new Map<EnumMember<P>, SyntaxPlan<EnumMember<P>, Stop, Image>>();
  const EnumDeclaration = new Map<EnumDeclaration<P>, SyntaxPlan<EnumDeclaration<P>, Stop, Image>>();
  const ModuleBlock = new Map<ModuleBlock<P>, SyntaxPlan<ModuleBlock<P>, Stop, Image>>();
  const NotEmittedStatement = new Map<NotEmittedStatement<P>, SyntaxPlan<NotEmittedStatement<P>, Stop, Image>>();
  const NotEmittedTypeElement = new Map<NotEmittedTypeElement<P>, SyntaxPlan<NotEmittedTypeElement<P>, Stop, Image>>();
  const CallSignatureDeclaration = new Map<CallSignatureDeclaration<P>, SyntaxPlan<CallSignatureDeclaration<P>, Stop, Image>>();
  const ConstructSignatureDeclaration = new Map<ConstructSignatureDeclaration<P>, SyntaxPlan<ConstructSignatureDeclaration<P>, Stop, Image>>();
  const ConstructorDeclaration = new Map<ConstructorDeclaration<P>, SyntaxPlan<ConstructorDeclaration<P>, Stop, Image>>();
  const GetAccessorDeclaration = new Map<GetAccessorDeclaration<P>, SyntaxPlan<GetAccessorDeclaration<P>, Stop, Image>>();
  const SetAccessorDeclaration = new Map<SetAccessorDeclaration<P>, SyntaxPlan<SetAccessorDeclaration<P>, Stop, Image>>();
  const IndexSignatureDeclaration = new Map<IndexSignatureDeclaration<P>, SyntaxPlan<IndexSignatureDeclaration<P>, Stop, Image>>();
  const MethodSignatureDeclaration = new Map<MethodSignatureDeclaration<P>, SyntaxPlan<MethodSignatureDeclaration<P>, Stop, Image>>();
  const MethodDeclaration = new Map<MethodDeclaration<P>, SyntaxPlan<MethodDeclaration<P>, Stop, Image>>();
  const PropertySignatureDeclaration = new Map<PropertySignatureDeclaration<P>, SyntaxPlan<PropertySignatureDeclaration<P>, Stop, Image>>();
  const PropertyDeclaration = new Map<PropertyDeclaration<P>, SyntaxPlan<PropertyDeclaration<P>, Stop, Image>>();
  const SemicolonClassElement = new Map<SemicolonClassElement<P>, SyntaxPlan<SemicolonClassElement<P>, Stop, Image>>();
  const ClassStaticBlockDeclaration = new Map<ClassStaticBlockDeclaration<P>, SyntaxPlan<ClassStaticBlockDeclaration<P>, Stop, Image>>();
  return {
    EmptyStatement: node => memoSyntaxPlan(EmptyStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    IfStatement: node => memoSyntaxPlan(IfStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        thenStatement: ports().Statement(node.thenStatement).read(),
        elseStatement: node.elseStatement === null ? null : ports().Statement(node.elseStatement).read(),
        tsonic,
      });
    })),
    DoStatement: node => memoSyntaxPlan(DoStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        statement: ports().Statement(node.statement).read(),
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    WhileStatement: node => memoSyntaxPlan(WhileStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        statement: ports().Statement(node.statement).read(),
        expression: ports().Expression(node.expression).read(),
        tsonic,
      });
    })),
    ForStatement: node => memoSyntaxPlan(ForStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        statement: ports().Statement(node.statement).read(),
        initializer: node.initializer === null ? null : ports().ForInitializer(node.initializer).read(),
        condition: node.condition === null ? null : ports().Expression(node.condition).read(),
        incrementor: node.incrementor === null ? null : ports().Expression(node.incrementor).read(),
        tsonic,
      });
    })),
    ForInStatement: node => memoSyntaxPlan(ForInStatement, node, () => withSyntaxPayload(phase.ForInOrOfStatement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, awaitModifier } = node;
      return tsonic => ({
        ...header,
        kind,
        awaitModifier,
        initializer: ports().ForInitializer(node.initializer).read(),
        expression: ports().Expression(node.expression).read(),
        statement: ports().Statement(node.statement).read(),
        tsonic,
      });
    })),
    ForOfStatement: node => memoSyntaxPlan(ForOfStatement, node, () => withSyntaxPayload(phase.ForInOrOfStatement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, awaitModifier } = node;
      return tsonic => ({
        ...header,
        kind,
        awaitModifier,
        initializer: ports().ForInitializer(node.initializer).read(),
        expression: ports().Expression(node.expression).read(),
        statement: ports().Statement(node.statement).read(),
        tsonic,
      });
    })),
    BreakStatement: node => memoSyntaxPlan(BreakStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        label: node.label === null ? null : ports().Identifier(node.label).read(),
        tsonic,
      });
    })),
    ContinueStatement: node => memoSyntaxPlan(ContinueStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        label: node.label === null ? null : ports().Identifier(node.label).read(),
        tsonic,
      });
    })),
    ReturnStatement: node => memoSyntaxPlan(ReturnStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => {
        const expression = returned(node);
        return { ...header, kind, expression: expression === null ? null : ports().Expression(expression).read(), tsonic };
      };
    })),
    WithStatement: node => memoSyntaxPlan(WithStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        statement: ports().Statement(node.statement).read(),
        tsonic,
      });
    })),
    SwitchStatement: node => memoSyntaxPlan(SwitchStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        caseBlock: ports().CaseBlock(node.caseBlock).read(),
        tsonic,
      });
    })),
    CaseBlock: node => memoSyntaxPlan(CaseBlock, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        clauses: copyNodeList(node.clauses, item => ports().CaseOrDefaultClause(item).read()),
        tsonic,
      });
    })),
    CaseClause: node => memoSyntaxPlan(CaseClause, node, () => withSyntaxPayload(phase.CaseClause, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(node.expression).read(),
        statements: copyNodeList(node.statements, item => ports().Statement(item).read()),
        tsonic,
      });
    })),
    DefaultClause: node => memoSyntaxPlan(DefaultClause, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, expression } = node;
      return tsonic => ({
        ...header,
        kind,
        expression,
        statements: copyNodeList(node.statements, item => ports().Statement(item).read()),
        tsonic,
      });
    })),
    ThrowStatement: node => memoSyntaxPlan(ThrowStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    TryStatement: node => memoSyntaxPlan(TryStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tryBlock: ports().Block(node.tryBlock).read(),
        catchClause: node.catchClause === null ? null : ports().CatchClause(node.catchClause).read(),
        finallyBlock: node.finallyBlock === null ? null : ports().Block(node.finallyBlock).read(),
        tsonic,
      });
    })),
    CatchClause: node => memoSyntaxPlan(CatchClause, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        variableDeclaration: node.variableDeclaration === null ? null : ports().VariableDeclaration(node.variableDeclaration).read(),
        block: ports().Block(node.block).read(),
        tsonic,
      });
    })),
    DebuggerStatement: node => memoSyntaxPlan(DebuggerStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    LabeledStatement: node => memoSyntaxPlan(LabeledStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        label: ports().Identifier(node.label).read(),
        statement: ports().Statement(node.statement).read(),
        tsonic,
      });
    })),
    ExpressionStatement: node => memoSyntaxPlan(ExpressionStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        expression: ports().Expression(expressionOf(node)).read(),
        tsonic,
      });
    })),
    Block: node => memoSyntaxPlan(Block, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => tsonic => {
      const shape = blockOf(node);
      return { ...shape.header, kind: "Block", statements: shape.statements(item => ports().Statement(item).read()),
        multiLine: shape.multiLine, tsonic };
    })),
    VariableStatement: node => memoSyntaxPlan(VariableStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        declarationList: ports().VariableDeclarationList(node.declarationList).read(),
        tsonic,
      });
    })),
    VariableDeclaration: node => memoSyntaxPlan(VariableDeclaration, node, () => withSyntaxPayload(phase.VariableDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, exclamationToken } = node;
      return tsonic => ({
        ...header,
        kind,
        name: ports().BindingName(node.name).read(),
        exclamationToken,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        initializer: node.initializer === null ? null : ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    VariableDeclarationList: node => memoSyntaxPlan(VariableDeclarationList, node, () => withSyntaxPayload(phase.VariableDeclarationList, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        declarations: copyNodeList(node.declarations, item => ports().VariableDeclaration(item).read()),
        tsonic,
      });
    })),
    BindingPattern: node => memoSyntaxPlan(BindingPattern, node, () => withSyntaxPayload(phase.BindingPattern, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        elements: copyNodeList(node.elements, item => ports().BindingElement(item).read()),
        tsonic,
      });
    })),
    ParameterDeclaration: node => memoSyntaxPlan(ParameterDeclaration, node, () => {
      const payload = phase.ParameterDeclaration(node.tsonic);
      if (payload.kind === "refused") return payload;
      return copied(image => {
        const tsonic = payload.value(image);
        const shape = parameterOf(node);
        const type = shape.type();
        return {
          ...shape.header,
          kind: "Parameter",
          modifiers: shape.modifiers(item => ports().ModifierLike(item).read()),
          dotDotDotToken: shape.dotDotDotToken(),
          name: ports().BindingName(shape.name()).read(),
          questionToken: shape.questionToken(),
          type: type === null ? null : ports().TypeNode(type).read(),
          initializer: copyInitializer(node, child => ports().Expression(child).read(), image),
          tsonic,
        };
      });
    }),
    BindingElement: node => memoSyntaxPlan(BindingElement, node, () => withSyntaxPayload(phase.BindingElement, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, dotDotDotToken } = node;
      return tsonic => ({
        ...header,
        kind,
        dotDotDotToken,
        propertyName: node.propertyName === null ? null : ports().PropertyName(node.propertyName).read(),
        name: node.name === null ? null : ports().BindingName(node.name).read(),
        initializer: node.initializer === null ? null : ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    MissingDeclaration: node => memoSyntaxPlan(MissingDeclaration, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        tsonic,
      });
    })),
    FunctionDeclaration: node => memoSyntaxPlan(FunctionDeclaration, node, () => withSyntaxPayload(phase.FunctionDeclaration, node.tsonic, () => tsonic =>
      ({ kind: "FunctionDeclaration", ...finishFunctionSyntax(functionOf(node), ports()), tsonic }))),
    ClassDeclaration: node => memoSyntaxPlan(ClassDeclaration, node, () => withSyntaxPayload(phase.ClassDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: node.name === null ? null : ports().Identifier(node.name).read(),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item).read()),
        members: copyNodeList(node.members, item => ports().ClassElement(item).read()),
        tsonic,
      });
    })),
    ClassExpression: node => memoSyntaxPlan(ClassExpression, node, () => withSyntaxPayload(phase.ClassExpression, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: node.name === null ? null : ports().Identifier(node.name).read(),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item).read()),
        members: copyNodeList(node.members, item => ports().ClassElement(item).read()),
        tsonic,
      });
    })),
    HeritageClause: node => memoSyntaxPlan(HeritageClause, node, () => withSyntaxPayload(phase.HeritageClause, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, token } = node;
      return tsonic => ({
        ...header,
        kind,
        token,
        types: copyNodeList(node.types, item => ports().ExpressionWithTypeArguments(item).read()),
        tsonic,
      });
    })),
    InterfaceDeclaration: node => memoSyntaxPlan(InterfaceDeclaration, node, () => withSyntaxPayload(phase.InterfaceDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().Identifier(node.name).read(),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        heritageClauses: node.heritageClauses === null ? null : copyNodeList(node.heritageClauses, item => ports().HeritageClause(item).read()),
        members: copyNodeList(node.members, item => ports().TypeElement(item).read()),
        tsonic,
      });
    })),
    TypeAliasDeclaration: node => memoSyntaxPlan(TypeAliasDeclaration, node, () => withSyntaxPayload(phase.TypeAliasDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().Identifier(node.name).read(),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        type: ports().TypeNode(node.type).read(),
        tsonic,
      });
    })),
    EnumMember: node => memoSyntaxPlan(EnumMember, node, () => withSyntaxPayload(phase.EnumMember, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        initializer: node.initializer === null ? null : ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    EnumDeclaration: node => memoSyntaxPlan(EnumDeclaration, node, () => withSyntaxPayload(phase.EnumDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().Identifier(node.name).read(),
        members: copyNodeList(node.members, item => ports().EnumMember(item).read()),
        tsonic,
      });
    })),
    ModuleBlock: node => memoSyntaxPlan(ModuleBlock, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        statements: copyNodeList(node.statements, item => ports().Statement(item).read()),
        tsonic,
      });
    })),
    NotEmittedStatement: node => memoSyntaxPlan(NotEmittedStatement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    NotEmittedTypeElement: node => memoSyntaxPlan(NotEmittedTypeElement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    CallSignatureDeclaration: node => memoSyntaxPlan(CallSignatureDeclaration, node, () => withSyntaxPayload(phase.CallSignatureDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        tsonic,
      });
    })),
    ConstructSignatureDeclaration: node => memoSyntaxPlan(ConstructSignatureDeclaration, node, () => withSyntaxPayload(phase.ConstructSignatureDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        tsonic,
      });
    })),
    ConstructorDeclaration: node => memoSyntaxPlan(ConstructorDeclaration, node, () => withSyntaxPayload(phase.ConstructorDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        tsonic,
      });
    })),
    GetAccessorDeclaration: node => memoSyntaxPlan(GetAccessorDeclaration, node, () => withSyntaxPayload(phase.GetAccessorDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        tsonic,
      });
    })),
    SetAccessorDeclaration: node => memoSyntaxPlan(SetAccessorDeclaration, node, () => withSyntaxPayload(phase.SetAccessorDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        tsonic,
      });
    })),
    IndexSignatureDeclaration: node => memoSyntaxPlan(IndexSignatureDeclaration, node, () => withSyntaxPayload(phase.IndexSignatureDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        tsonic,
      });
    })),
    MethodSignatureDeclaration: node => memoSyntaxPlan(MethodSignatureDeclaration, node, () => withSyntaxPayload(phase.MethodSignatureDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        tsonic,
      });
    })),
    MethodDeclaration: node => memoSyntaxPlan(MethodDeclaration, node, () => withSyntaxPayload(phase.MethodDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken, asteriskToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        typeParameters: node.typeParameters === null ? null : copyNodeList(node.typeParameters, item => ports().TypeParameterDeclaration(item).read()),
        parameters: copyNodeList(node.parameters, item => ports().ParameterDeclaration(item).read()),
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        fullSignature: node.fullSignature === null ? null : ports().TypeNode(node.fullSignature).read(),
        asteriskToken,
        body: node.body === null ? null : ports().BlockOrExpression(node.body).read(),
        tsonic,
      });
    })),
    PropertySignatureDeclaration: node => memoSyntaxPlan(PropertySignatureDeclaration, node, () => withSyntaxPayload(phase.PropertySignatureDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        initializer: node.initializer === null ? null : ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    PropertyDeclaration: node => memoSyntaxPlan(PropertyDeclaration, node, () => withSyntaxPayload(phase.PropertyDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind, postfixToken } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        name: ports().PropertyName(node.name).read(),
        postfixToken,
        type: node.type === null ? null : ports().TypeNode(node.type).read(),
        initializer: node.initializer === null ? null : ports().Expression(node.initializer).read(),
        tsonic,
      });
    })),
    SemicolonClassElement: node => memoSyntaxPlan(SemicolonClassElement, node, () => withSyntaxPayload(holdSyntaxPayload, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        tsonic,
      });
    })),
    ClassStaticBlockDeclaration: node => memoSyntaxPlan(ClassStaticBlockDeclaration, node, () => withSyntaxPayload(phase.ClassStaticBlockDeclaration, node.tsonic, () => {
      const header = syntaxHeader(node);
      const { kind } = node;
      return tsonic => ({
        ...header,
        kind,
        modifiers: node.modifiers === null ? null : copyNodeList(node.modifiers, item => ports().ModifierLike(item).read()),
        body: ports().Block(node.body).read(),
        tsonic,
      });
    })),
  };
}
