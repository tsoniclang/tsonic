import {
  requirePresent,
} from "../diag/index.js";
import type {
  AccessSyntaxFields, AnnotatedExpressionSyntax, AnnotatedExpressionSyntaxReceipt, ApplicationSyntaxReceipt,
  ArrayLiteralExpression, ArraySyntaxReceipt, AwaitKeyword, BinaryExpression, BinaryOperatorToken,
  BinarySyntaxReceipt, BindingElement, BindingElementSyntaxFields, BindingElementSyntaxReceipt, BindingPattern,
  BindingPatternSyntaxReceipt, Block, BlockSyntaxReceipt, CallOrNewExpression, CaseBlock, CaseOrDefaultClause,
  CatchClause, ColonToken, ConditionalExpression, ConditionalSyntaxReceipt, ControlSyntax, ControlSyntaxReceipt,
  DoStatement, ElementAccessExpression, ElementSyntaxReceipt, Expression, ForInOrOfStatement, ForInitializer,
  ForStatement, Identifier, IfStatement, IfSyntaxReceipt, LabeledStatement, MemberName, ModifierLike, ModifierList,
  NodeList, ObjectLiteralElementLike, ObjectLiteralExpression, ObjectSyntaxReceipt, Phase, PrepareSyntaxArgumentList,
  PropertyAccessExpression, PropertySyntaxReceipt, QuestionDotToken, QuestionToken, ReturnStatement,
  ReturnSyntaxReceipt, SingleExpressionReceipt, SingleExpressionSyntax, Statement, SwitchStatement, SyntaxArgumentListReceipt,
  SyntaxChildSlot, SyntaxCopyResult, SyntaxNode, TryStatement, TypeNode, UnarySyntax, UnarySyntaxReceipt,
  VariableDeclaration, VariableDeclarationList, VariableDeclarationSyntaxFields, VariableDeclarationSyntaxReceipt,
  VariableListSyntaxReceipt, VariableStatement, VariableStatementSyntaxReceipt, WhileStatement, WithStatement,
} from "./contract.js";
import { syntaxHeader } from "./copy-node.js";
import type { ExactPart, RetainedSyntaxList } from "./child-slot-storage.js";
import {
  children, emptyChildren, heldChild, heldList, materializeList, missingStructure, readRetainedList,
} from "./child-slot-storage.js";

export function* blockFields<P extends Phase>(node: Block<P>,
  statements: (field: "statements", list: NodeList<Statement<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* statements("statements", node.statements);
}

interface BinaryFields<P extends Phase> {
  readonly modifiers: (field: "modifiers", list: ModifierList<P> | null) => Iterable<SyntaxChildSlot<P>>;
  readonly left: (node: Expression<P>) => Expression<P>;
  readonly type: (node: TypeNode<P> | null) => TypeNode<P> | null;
  readonly operator: (node: BinaryOperatorToken<P>) => BinaryOperatorToken<P>;
  readonly right: (node: Expression<P>) => Expression<P>;
}

export function* binaryFields<P extends Phase>(node: BinaryExpression<P>, modifiers: () => ModifierList<P> | null,
  fields: BinaryFields<P>): Generator<SyntaxChildSlot<P>> {
  yield* fields.modifiers("modifiers", modifiers());
  yield* children<P, BinaryExpression<P>>(["left", "required", () => fields.left(node.left)],
    ["type", "nullable", () => fields.type(node.type)], ["operatorToken", "required", () => fields.operator(node.operatorToken)],
    ["right", "required", () => fields.right(node.right)]);
}

export function prepareBlockStructure<P extends Phase>(
  node: Block<P>, ordinal: number,
): BlockSyntaxReceipt<P> {
  let list: RetainedSyntaxList<Statement<P>> | undefined;
  let length = 0;
  return { kind: "block", ordinal, header: syntaxHeader(node), multiLine: node.multiLine,
    slots: blockFields<P>(node, (field, original) => readRetainedList<P, Statement<P>>(field, original, (admitted, count) => {
      list = admitted;
      length = count;
    })),
    statements: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

export function prepareBinaryStructure<P extends Phase, Stop>(
  node: BinaryExpression<P>, ordinal: number, admitModifiers: () => Stop | null,
): SyntaxCopyResult<BinarySyntaxReceipt<P>, Stop> {
  const modifiers = node.modifiers;
  if (modifiers !== null) {
    const stop = admitModifiers();
    if (stop !== null) return { kind: "refused", stop };
  }
  let list: RetainedSyntaxList<ModifierLike<P>> | undefined;
  let length = 0;
  let left: Expression<P> | undefined;
  let right: Expression<P> | undefined;
  let type: TypeNode<P> | null | undefined;
  let operator: BinaryOperatorToken<P> | undefined;
  const slots = binaryFields<P>(node, () => modifiers, {
    modifiers: (field, original) => original === null ? [] : readRetainedList<P, ModifierLike<P>>(field, original, (admitted, count) => {
      list = admitted;
      length = count;
    }),
    left: value => (left = value), right: value => (right = value), type: value => (type = value), operator: value => (operator = value),
  });
  return { kind: "copied", value: {
    kind: "binary", ordinal, header: syntaxHeader(node), slots,
    modifiers: read => modifiers === null ? null : materializeList(requirePresent(list, missingStructure), length, read),
    left: () => requirePresent(left, missingStructure),
    type: () => requirePresent(type, missingStructure),
    operator: () => requirePresent(operator, missingStructure),
    right: () => requirePresent(right, missingStructure),
  } };
}

export function isSingleExpressionSyntax<P extends Phase>(node: SyntaxNode<P>): node is SingleExpressionSyntax<P> {
  switch (node.kind) {
    case "AwaitExpression": case "ComputedPropertyName": case "DeleteExpression": case "ExpressionStatement":
    case "ExternalModuleReference": case "JsxSpreadAttribute": case "NonNullExpression":
    case "ParenthesizedExpression": case "PartiallyEmittedExpression": case "SpreadAssignment": case "SpreadElement":
    case "ThrowStatement": case "TypeOfExpression": case "VoidExpression": return true;
    default: return false;
  }
}

export function singleExpressionSlots<P extends Phase>(node: SingleExpressionSyntax<P>, retain: (child: Expression<P>) => Expression<P>):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, SingleExpressionSyntax<P>>(["expression", "required", () => retain(node.expression)]);
}

export function prepareSingleExpression<P extends Phase>(node: SingleExpressionSyntax<P>, ordinal: number): SingleExpressionReceipt<P> {
  let expression: Expression<P> | undefined;
  return { kind: "single-expression", ordinal,
    slots: singleExpressionSlots<P>(node, child => (expression = child)),
    expression: () => requirePresent(expression, missingStructure) };
}

export function returnSlots<P extends Phase>(node: ReturnStatement<P>, retain: (child: Expression<P> | null) => Expression<P> | null):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, ReturnStatement<P>>(["expression", "nullable", () => retain(node.expression)]);
}

export function prepareReturnStructure<P extends Phase>(node: ReturnStatement<P>, ordinal: number): ReturnSyntaxReceipt<P> {
  let expression: Expression<P> | null | undefined;
  return { kind: "return", ordinal, slots: returnSlots<P>(node, child => (expression = child)),
    expression: () => requirePresent(expression, missingStructure) };
}

export function isControlSyntax<P extends Phase>(node: SyntaxNode<P>): node is ControlSyntax<P> {
  switch (node.kind) {
    case "DoStatement": case "WhileStatement": case "WithStatement": case "ForStatement": case "ForInStatement": case "ForOfStatement":
    case "BreakStatement": case "ContinueStatement": case "SwitchStatement": case "CaseBlock": case "CaseClause":
    case "DefaultClause": case "TryStatement": case "CatchClause": case "LabeledStatement": return true;
    default: return false;
  }
}

export function testedStatementSlots<P extends Phase>(bodyFirst: boolean, statement: () => Statement<P>, expression: () => Expression<P>) {
  const body = ["statement", "required", statement] satisfies ExactPart<DoStatement<P>>;
  const test = ["expression", "required", expression] satisfies ExactPart<DoStatement<P>>;
  return bodyFirst ? children<P, DoStatement<P>>(body, test) : children<P, WhileStatement<P> | WithStatement<P>>(test, body);
}

export function forSlots<P extends Phase>(initializer: () => ForInitializer<P> | null, condition: () => Expression<P> | null,
  incrementor: () => Expression<P> | null, statement: () => Statement<P>) {
  return children<P, ForStatement<P>>(["initializer", "nullable", initializer], ["condition", "nullable", condition],
    ["incrementor", "nullable", incrementor], ["statement", "required", statement]);
}

export function forInOrOfSlots<P extends Phase>(awaitModifier: () => AwaitKeyword<P> | null, initializer: () => ForInitializer<P>,
  expression: () => Expression<P>, statement: () => Statement<P>) {
  return children<P, ForInOrOfStatement<P>>(["awaitModifier", "nullable", awaitModifier], ["initializer", "required", initializer],
    ["expression", "required", expression], ["statement", "required", statement]);
}

type JumpSyntax<P extends Phase> = Extract<ControlSyntax<P>, { readonly kind: "BreakStatement" | "ContinueStatement" }>;

export function jumpSlots<P extends Phase>(label: () => Identifier<P> | null) {
  return children<P, JumpSyntax<P>>(["label", "nullable", label]);
}

export function switchSlots<P extends Phase>(expression: () => Expression<P>, caseBlock: () => CaseBlock<P>) {
  return children<P, SwitchStatement<P>>(["expression", "required", expression], ["caseBlock", "required", caseBlock]);
}

export function* caseClauseSlots<P extends Phase>(node: CaseOrDefaultClause<P>, expression: (value: Expression<P> | null) => unknown,
  statements: () => Iterable<SyntaxChildSlot<P>>) {
  if (node.kind === "CaseClause") yield { fields: ["expression"], read: () => {
    const value = node.expression;
    expression(value);
    return value;
  } } satisfies SyntaxChildSlot<P>;
  else expression(node.expression);
  yield* statements();
}

export function trySlots<P extends Phase>(tryBlock: () => Block<P>, catchClause: () => CatchClause<P> | null,
  finallyBlock: () => Block<P> | null) {
  return children<P, TryStatement<P>>(["tryBlock", "required", tryBlock], ["catchClause", "nullable", catchClause],
    ["finallyBlock", "nullable", finallyBlock]);
}

export function catchSlots<P extends Phase>(variableDeclaration: () => VariableDeclaration<P> | null, block: () => Block<P>) {
  return children<P, CatchClause<P>>(["variableDeclaration", "nullable", variableDeclaration], ["block", "required", block]);
}

export function labeledSlots<P extends Phase>(label: () => Identifier<P>, statement: () => Statement<P>) {
  return children<P, LabeledStatement<P>>(["label", "required", label], ["statement", "required", statement]);
}

export function prepareControl<P extends Phase, Stop>(node: ControlSyntax<P>, ordinal: number,
  admitList: (field: "clauses" | "statements") => Stop | null): SyntaxCopyResult<ControlSyntaxReceipt<P>, Stop> {
  switch (node.kind) {
    case "DoStatement": case "WhileStatement": case "WithStatement": {
      const statement = heldChild(() => node.statement);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "tested-statement", ordinal,
        slots: testedStatementSlots<P>(node.kind === "DoStatement", statement.pull, expression.pull),
        statement: statement.read, expression: expression.read } };
    }
    case "ForStatement": {
      const initializer = heldChild(() => node.initializer);
      const condition = heldChild(() => node.condition);
      const incrementor = heldChild(() => node.incrementor);
      const statement = heldChild(() => node.statement);
      return { kind: "copied", value: { kind: "for", ordinal, slots: forSlots<P>(initializer.pull, condition.pull, incrementor.pull, statement.pull),
        initializer: initializer.read, condition: condition.read, incrementor: incrementor.read, statement: statement.read } };
    }
    case "ForInStatement": case "ForOfStatement": {
      const awaitModifier = heldChild(() => node.awaitModifier);
      const initializer = heldChild(() => node.initializer);
      const expression = heldChild(() => node.expression);
      const statement = heldChild(() => node.statement);
      return { kind: "copied", value: { kind: "for-in-or-of", ordinal,
        slots: forInOrOfSlots<P>(awaitModifier.pull, initializer.pull, expression.pull, statement.pull),
        awaitModifier: awaitModifier.read, initializer: initializer.read, expression: expression.read, statement: statement.read } };
    }
    case "BreakStatement": case "ContinueStatement": {
      const label = heldChild(() => node.label);
      return { kind: "copied", value: { kind: "jump", ordinal, slots: jumpSlots<P>(label.pull), label: label.read } };
    }
    case "SwitchStatement": {
      const expression = heldChild(() => node.expression);
      const caseBlock = heldChild(() => node.caseBlock);
      return { kind: "copied", value: { kind: "switch", ordinal, slots: switchSlots<P>(expression.pull, caseBlock.pull),
        expression: expression.read, caseBlock: caseBlock.read } };
    }
    case "CaseBlock": {
      const stop = admitList("clauses");
      if (stop !== null) return { kind: "refused", stop };
      const clauses = heldList<P, CaseOrDefaultClause<P>>("clauses", () => node.clauses);
      return { kind: "copied", value: { kind: "case-block", ordinal, slots: clauses.slots(), clauses: clauses.finish } };
    }
    case "CaseClause": case "DefaultClause": {
      const stop = admitList("statements");
      if (stop !== null) return { kind: "refused", stop };
      let expression: Expression<P> | null | undefined;
      const statements = heldList<P, Statement<P>>("statements", () => node.statements);
      return { kind: "copied", value: { kind: "case-clause", ordinal,
        slots: caseClauseSlots<P>(node, value => { expression = value; }, statements.slots),
        expression: () => requirePresent(expression, missingStructure), statements: statements.finish } };
    }
    case "TryStatement": {
      const tryBlock = heldChild(() => node.tryBlock);
      const catchClause = heldChild(() => node.catchClause);
      const finallyBlock = heldChild(() => node.finallyBlock);
      return { kind: "copied", value: { kind: "try", ordinal, slots: trySlots<P>(tryBlock.pull, catchClause.pull, finallyBlock.pull),
        tryBlock: tryBlock.read, catchClause: catchClause.read, finallyBlock: finallyBlock.read } };
    }
    case "CatchClause": {
      const variableDeclaration = heldChild(() => node.variableDeclaration);
      const block = heldChild(() => node.block);
      return { kind: "copied", value: { kind: "catch", ordinal, slots: catchSlots<P>(variableDeclaration.pull, block.pull),
        variableDeclaration: variableDeclaration.read, block: block.read } };
    }
    case "LabeledStatement": {
      const label = heldChild(() => node.label);
      const statement = heldChild(() => node.statement);
      return { kind: "copied", value: { kind: "labeled", ordinal, slots: labeledSlots<P>(label.pull, statement.pull),
        label: label.read, statement: statement.read } };
    }
  }
}

export function unarySlots<P extends Phase>(operand: () => Expression<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, UnarySyntax<P>>(["operand", "required", operand]);
}

export function prepareUnary<P extends Phase>(node: UnarySyntax<P>, ordinal: number): UnarySyntaxReceipt<P> {
  const operand = heldChild(() => node.operand);
  return { kind: "unary", ordinal, slots: unarySlots<P>(operand.pull), operand: operand.read };
}

export function annotatedExpressionSlots<P extends Phase>(expression: () => Expression<P>, type: () => TypeNode<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, AnnotatedExpressionSyntax<P>>(["expression", "required", expression], ["type", "required", type]);
}

export function prepareAnnotatedExpression<P extends Phase>(node: AnnotatedExpressionSyntax<P>, ordinal: number): AnnotatedExpressionSyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const type = heldChild(() => node.type);
  return { kind: "annotated-expression", ordinal, slots: annotatedExpressionSlots<P>(expression.pull, type.pull),
    expression: expression.read, type: type.read };
}

interface ConditionalFields<P extends Phase> {
  readonly condition: () => Expression<P>;
  readonly question: () => QuestionToken<P>;
  readonly whenTrue: () => Expression<P>;
  readonly colon: () => ColonToken<P>;
  readonly whenFalse: () => Expression<P>;
}

export function conditionalSlots<P extends Phase>(fields: ConditionalFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, ConditionalExpression<P>>(["condition", "required", fields.condition], ["questionToken", "required", fields.question],
    ["whenTrue", "required", fields.whenTrue], ["colonToken", "required", fields.colon], ["whenFalse", "required", fields.whenFalse]);
}

export function prepareConditional<P extends Phase>(node: ConditionalExpression<P>, ordinal: number): ConditionalSyntaxReceipt<P> {
  const condition = heldChild(() => node.condition);
  const question = heldChild(() => node.questionToken);
  const whenTrue = heldChild(() => node.whenTrue);
  const colon = heldChild(() => node.colonToken);
  const whenFalse = heldChild(() => node.whenFalse);
  return { kind: "conditional", ordinal, slots: conditionalSlots<P>({
    condition: condition.pull, question: question.pull, whenTrue: whenTrue.pull, colon: colon.pull, whenFalse: whenFalse.pull,
  }), condition: condition.read, question: question.read, whenTrue: whenTrue.read, colon: colon.read, whenFalse: whenFalse.read };
}

export function ifSlots<P extends Phase>(expression: () => Expression<P>, thenStatement: () => Statement<P>, elseStatement: () => Statement<P> | null):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, IfStatement<P>>(["expression", "required", expression], ["thenStatement", "required", thenStatement],
    ["elseStatement", "nullable", elseStatement]);
}

export function prepareIf<P extends Phase>(node: IfStatement<P>, ordinal: number): IfSyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const thenStatement = heldChild(() => node.thenStatement);
  const elseStatement = heldChild(() => node.elseStatement);
  return { kind: "if", ordinal, slots: ifSlots<P>(expression.pull, thenStatement.pull, elseStatement.pull),
    expression: expression.read, thenStatement: thenStatement.read, elseStatement: elseStatement.read };
}

export function* propertySlots<P extends Phase>(fields: AccessSyntaxFields<P>, name: () => MemberName<P>): Generator<SyntaxChildSlot<P>> {
  yield* accessSlots<P>(fields);
  yield* children<P, PropertyAccessExpression<P>>(["name", "required", name]);
}

export function* elementSlots<P extends Phase>(fields: AccessSyntaxFields<P>, argument: () => Expression<P>): Generator<SyntaxChildSlot<P>> {
  yield* accessSlots<P>(fields);
  yield* children<P, ElementAccessExpression<P>>(["argumentExpression", "required", argument]);
}

function accessSlots<P extends Phase>(fields: AccessSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, PropertyAccessExpression<P> | ElementAccessExpression<P>>(
    ["expression", "required", fields.expression], ["questionDotToken", "nullable", fields.questionDotToken]);
}

export function prepareProperty<P extends Phase>(node: PropertyAccessExpression<P>, ordinal: number): PropertySyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const question = heldChild(() => node.questionDotToken);
  const name = heldChild(() => node.name);
  return { kind: "property-access", ordinal,
    slots: propertySlots<P>({ expression: expression.pull, questionDotToken: question.pull }, name.pull),
    expression: expression.read, questionDotToken: question.read, name: name.read };
}

export function prepareElement<P extends Phase>(node: ElementAccessExpression<P>, ordinal: number): ElementSyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const question = heldChild(() => node.questionDotToken);
  const argument = heldChild(() => node.argumentExpression);
  return { kind: "element-access", ordinal,
    slots: elementSlots<P>({ expression: expression.pull, questionDotToken: question.pull }, argument.pull),
    expression: expression.read, questionDotToken: question.read, argument: argument.read };
}

export function* arraySlots<P extends Phase>(node: ArrayLiteralExpression<P>,
  read: (field: "elements", list: NodeList<Expression<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* read("elements", node.elements);
}

export function* objectSlots<P extends Phase>(node: ObjectLiteralExpression<P>,
  read: (field: "properties", list: NodeList<ObjectLiteralElementLike<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* read("properties", node.properties);
}

export function prepareArray<P extends Phase>(node: ArrayLiteralExpression<P>, ordinal: number): ArraySyntaxReceipt<P> {
  let list: RetainedSyntaxList<Expression<P>> | undefined;
  let length = 0;
  const slots = arraySlots<P>(node, (field, raw) => readRetainedList<P, Expression<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "array-literal", ordinal, slots, elements: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

export function prepareObject<P extends Phase>(node: ObjectLiteralExpression<P>, ordinal: number): ObjectSyntaxReceipt<P> {
  let list: RetainedSyntaxList<ObjectLiteralElementLike<P>> | undefined;
  let length = 0;
  const slots = objectSlots<P>(node, (field, raw) => readRetainedList<P, ObjectLiteralElementLike<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "object-literal", ordinal, slots, properties: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

export function* variableStatementSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>,
  declarationList: () => VariableDeclarationList<P>): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, VariableStatement<P>>(["declarationList", "required", declarationList]);
}

export function prepareVariableStatement<P extends Phase, Stop>(node: VariableStatement<P>, ordinal: number, admitModifiers: () => Stop | null):
  SyntaxCopyResult<VariableStatementSyntaxReceipt<P>, Stop> {
  const modifiers = node.modifiers;
  const stop = modifiers === null ? null : admitModifiers();
  if (stop !== null) return { kind: "refused", stop };
  let list: RetainedSyntaxList<ModifierLike<P>> | undefined;
  let length = 0;
  const declarations = heldChild(() => node.declarationList);
  const slots = variableStatementSlots<P>(() => modifiers === null ? emptyChildren :
    readRetainedList<P, ModifierLike<P>>("modifiers", modifiers, (value, count) => { list = value; length = count; }), declarations.pull);
  return { kind: "copied", value: { kind: "variable-statement", ordinal, slots, declarationList: declarations.read,
    modifiers: read => modifiers === null ? null : materializeList(requirePresent(list, missingStructure), length, read) } };
}

export function variableDeclarationSlots<P extends Phase>(fields: VariableDeclarationSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, VariableDeclaration<P>>(["name", "required", fields.name], ["exclamationToken", "nullable", fields.exclamationToken],
    ["type", "nullable", fields.type], ["initializer", "nullable", fields.initializer]);
}

export function prepareVariableDeclaration<P extends Phase>(node: VariableDeclaration<P>, ordinal: number): VariableDeclarationSyntaxReceipt<P> {
  const name = heldChild(() => node.name);
  const exclamationToken = heldChild(() => node.exclamationToken);
  const type = heldChild(() => node.type);
  const initializer = heldChild(() => node.initializer);
  return { kind: "variable-declaration", ordinal, slots: variableDeclarationSlots<P>({
    name: name.pull, exclamationToken: exclamationToken.pull, type: type.pull, initializer: initializer.pull,
  }), name: name.read, exclamationToken: exclamationToken.read, type: type.read, initializer: initializer.read };
}

export function* variableListSlots<P extends Phase>(node: VariableDeclarationList<P>,
  list: (field: "declarations", values: NodeList<VariableDeclaration<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* list("declarations", node.declarations);
}

export function prepareVariableList<P extends Phase>(node: VariableDeclarationList<P>, ordinal: number): VariableListSyntaxReceipt<P> {
  let list: RetainedSyntaxList<VariableDeclaration<P>> | undefined;
  let length = 0;
  const slots = variableListSlots<P>(node, (field, raw) => readRetainedList<P, VariableDeclaration<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "variable-list", ordinal, slots, declarations: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

export function* bindingPatternSlots<P extends Phase>(node: BindingPattern<P>,
  list: (field: "elements", values: NodeList<BindingElement<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* list("elements", node.elements);
}

export function prepareBindingPattern<P extends Phase>(node: BindingPattern<P>, ordinal: number): BindingPatternSyntaxReceipt<P> {
  let list: RetainedSyntaxList<BindingElement<P>> | undefined;
  let length = 0;
  const slots = bindingPatternSlots<P>(node, (field, raw) => readRetainedList<P, BindingElement<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "binding-pattern", ordinal, slots, elements: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

export function bindingElementSlots<P extends Phase>(fields: BindingElementSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, BindingElement<P>>(["dotDotDotToken", "nullable", fields.dotDotDotToken], ["propertyName", "nullable", fields.propertyName],
    ["name", "nullable", fields.name], ["initializer", "nullable", fields.initializer]);
}

export function prepareBindingElement<P extends Phase>(node: BindingElement<P>, ordinal: number): BindingElementSyntaxReceipt<P> {
  const dotDotDotToken = heldChild(() => node.dotDotDotToken);
  const propertyName = heldChild(() => node.propertyName);
  const name = heldChild(() => node.name);
  const initializer = heldChild(() => node.initializer);
  return { kind: "binding-element", ordinal, slots: bindingElementSlots<P>({
    dotDotDotToken: dotDotDotToken.pull, propertyName: propertyName.pull, name: name.pull, initializer: initializer.pull,
  }), dotDotDotToken: dotDotDotToken.read, propertyName: propertyName.read, name: name.read, initializer: initializer.read };
}

export function* applicationSlots<P extends Phase, Slot>(node: CallOrNewExpression<P>,
  expression: (value: Expression<P>) => Expression<P>,
  questionDot: (value: QuestionDotToken<P> | null) => QuestionDotToken<P> | null,
  typeArguments: () => Iterable<SyntaxChildSlot<P>>, ordinary: (slot: SyntaxChildSlot<P>) => Slot,
  callArguments: () => Iterable<Slot>,
): Generator<Slot> {
  for (const slot of children<P, typeof node>(["expression", "required", () => expression(node.expression)])) yield ordinary(slot);
  if (node.kind === "CallExpression") {
    for (const slot of children<P, typeof node>(["questionDotToken", "nullable", () => questionDot(node.questionDotToken)]))
      yield ordinary(slot);
  }
  for (const slot of typeArguments()) yield ordinary(slot);
  yield* callArguments();
}

export const prepareSyntaxArgumentList: PrepareSyntaxArgumentList = <P extends Phase>(value: NodeList<Expression<P>>): SyntaxArgumentListReceipt<P> => {
  let retained: RetainedSyntaxList<Expression<P>> | undefined;
  let count = 0;
  const slots = readRetainedList<P, Expression<P>>("arguments", value, (list, length) => {
    retained = list;
    count = length;
  });
  return { slots, copy: read => materializeList<Expression<P>>(requirePresent(retained, missingStructure), count, read) };
};

export function prepareApplicationStructure<P extends Phase, Stop>(node: CallOrNewExpression<P>, ordinal: number,
  admitList: (field: "typeArguments" | "arguments") => Stop | null,
): SyntaxCopyResult<ApplicationSyntaxReceipt<P>, Stop> {
  const typeArguments = node.typeArguments;
  if (typeArguments !== null) {
    const stop = admitList("typeArguments");
    if (stop !== null) return { kind: "refused", stop };
  }
  if (node.kind === "CallExpression") {
    const stop = admitList("arguments");
    if (stop !== null) return { kind: "refused", stop };
  }
  const newArguments = node.kind === "NewExpression" ? node.arguments : null;
  if (newArguments !== null) {
    const stop = admitList("arguments");
    if (stop !== null) return { kind: "refused", stop };
  }
  const values = newArguments === null ? null : prepareSyntaxArgumentList<P>(newArguments);
  let expression: Expression<P> | undefined;
  let questionDot: QuestionDotToken<P> | null = null;
  let types: RetainedSyntaxList<TypeNode<P>> | undefined;
  let typeCount = 0;
  const slots = applicationSlots<P, SyntaxChildSlot<P>>(node, value => (expression = value), value => (questionDot = value),
    () => typeArguments === null ? [] : readRetainedList<P, TypeNode<P>>("typeArguments", typeArguments, (list, count) => {
      types = list;
      typeCount = count;
    }), slot => slot, () => values === null ? [] : values.slots);
  const header = { ordinal, header: syntaxHeader(node), slots,
    expression: () => requirePresent(expression, missingStructure), questionDotToken: () => questionDot,
    typeArguments: (read: (item: TypeNode<P>) => TypeNode<P>) =>
      typeArguments === null ? null : materializeList(requirePresent(types, missingStructure), typeCount, read),
  };
  if (node.kind === "CallExpression") {
    const arguments_ = node.arguments;
    return { kind: "copied", value: { ...header, kind: "application", form: "call", arguments: () => arguments_ } };
  }
  return { kind: "copied", value: { ...header, kind: "application", form: "new",
    arguments: read => values === null ? null : values.copy(read) } };
}
