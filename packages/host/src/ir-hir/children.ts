import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { ChildrenOfSyntax, IterateChildrenOfSyntax, IterateSyntaxChildEdges, NullableInitializerPhase, Phase, SyntaxNode, NodeList, SyntaxChild } from "./contract.js";
import type { IterateFunctionHeaderSlots, IterateParameterHeaderSlots, IterateSourceFileHeaderSlots, IterateSyntaxChildSlots,
  AsteriskToken, EndOfFile, FunctionDeclaration, FunctionDeclarationFields, FunctionDeclarationHeader, FunctionExpression, Identifier, ParameterDeclaration,
  PreparedFunctionHeader, PreparedSourceFileHeader, PrepareFunctionHeader, PrepareSourceFileHeader, SourceFileHeader,
  SyntaxChildSlot, TypeParameterDeclaration } from "./contract.js";
import type { ApplicationSyntaxReceipt, BinaryExpression, BinaryOperatorToken, BinarySyntaxReceipt, Block, BlockSyntaxReceipt,
  AccessSyntaxFields, AnnotatedExpressionSyntax, AnnotatedExpressionSyntaxReceipt, ArrayLiteralExpression, ArraySyntaxReceipt,
  ColonToken, ConditionalExpression, ConditionalSyntaxReceipt, ElementAccessExpression, ElementSyntaxReceipt,
  BindingName, BlockOrExpression, CallOrNewExpression, DotDotDotToken, Expression, FunctionSyntaxReceipt,
  BindingElement, BindingElementSyntaxFields, BindingElementSyntaxReceipt, BindingPattern, BindingPatternSyntaxReceipt,
  IfStatement, IfSyntaxReceipt, MemberName, ObjectLiteralElementLike, ObjectLiteralExpression, ObjectSyntaxReceipt,
  PropertyAccessExpression, PropertySyntaxReceipt, UnarySyntax, UnarySyntaxReceipt,
  ModifierLike, ModifierList, ParameterSyntaxReceipt, SourceFile, SourceFileSyntaxReceipt, SyntaxChildListField,
  PrepareSyntaxStructure, QuestionDotToken, QuestionToken, RetainedSyntaxNode,
  ReturnStatement, ReturnSyntaxReceipt, SingleExpressionReceipt, SingleExpressionSyntax,
  Statement, SyntaxCopyResult, TextRange, TypeNode, VariableDeclaration, VariableDeclarationList, VariableDeclarationSyntaxFields,
  VariableDeclarationSyntaxReceipt, VariableListSyntaxReceipt, VariableStatement, VariableStatementSyntaxReceipt } from "./contract.js";
import { syntaxHeader } from "./copy-node.js";
import type { AwaitKeyword, CaseBlock, CaseClause, CaseOrDefaultClause, CatchClause, ControlSyntax, ControlSyntaxReceipt,
  DefaultClause, DoStatement, ForInitializer, ForInOrOfStatement, ForStatement, LabeledStatement, SwitchStatement,
  TryStatement, WhileStatement, WithStatement } from "./contract.js";
import type { ClassDeclaration, ClassElement, ClassExpression, DeclarationStructureReceipt, DeclarationStructureSyntax, EnumDeclaration,
  EnumMember, ExclamationToken, ExpressionWithTypeArguments, HeritageClause, InterfaceDeclaration, PropertyName, TypeAliasDeclaration,
  TypeElement } from "./contract.js";
import type { ArrayTypeNode, ConditionalTypeNode, EntityName, IndexedAccessTypeNode, InferTypeNode, LiteralTypeChild, LiteralTypeNode,
  NamedTupleMember, TypeQueryNode, TypeReferenceNode, TypeStructureReceipt, TypeStructureSyntax, WrappedTypeSyntax } from "./contract.js";
import type { AssertsKeyword, ConstructorTypeNode, FunctionTypeNode, ImportAttribute, ImportAttributeName, MappedTypeNode, MinusToken,
  PlusToken, ReadonlyKeyword, TemplateHead, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, TemplateMiddleOrTail,
  TypePredicateNode, TypePredicateParameterName } from "./contract.js";
import type { ArrowFunction, CallableSyntaxFields, EqualsGreaterThanToken, EqualsToken, ExpressionStructureReceipt, ExpressionStructureSyntax,
  MetaProperty, PropertyAssignment, QualifiedName, ShorthandPropertyAssignment, SyntheticReferenceExpression, TaggedTemplateExpression,
  TemplateExpression, TemplateLiteral, TemplateSpan, TypeAssertion, YieldExpression } from "./contract.js";
import type { ClassStaticBlockDeclaration, ConstructorDeclaration, GetAccessorDeclaration, MethodDeclaration,
  MethodSignatureDeclaration, PropertyDeclaration, PropertySignatureDeclaration, SetAccessorDeclaration, SignatureSyntaxFields } from "./contract.js";
import type { ExportAssignment, ExportDeclaration, ExportSpecifier, ImportAttributes, ImportClause, ImportDeclaration,
  ImportEqualsDeclaration, ImportSpecifier, ImportTypeNode, ModuleDeclaration, ModuleExportName, ModuleName, ModuleReference,
  ModuleStructureReceipt, ModuleStructureSyntax, NamedExportBindings, NamedImportBindings, NodeBody, NamespaceExport,
  NamespaceExportDeclaration, NamespaceImport } from "./contract.js";
import type { JsxAttribute, JsxAttributeLike, JsxAttributeName, JsxAttributeValue, JsxAttributes, JsxChild, JsxClosingElement,
  JsxClosingFragment, JsxElement, JsxExpression, JsxFragment, JsxNamespacedName, JsxOpeningElement, JsxOpeningFragment,
  JsxSelfClosingElement, JsxStructureReceipt, JsxStructureSyntax, JsxTagNameExpression } from "./contract.js";
export type { SyntaxChildSlot } from "./contract.js";

const emptyChildren: readonly never[] = ([]);
const missingChild: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A syntax list must retain its actual dense child vector." };
const missingStructure: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "Syntax materialization requires its actual admitted field and child receipt." };

type ChildPart<PhaseType extends Phase> =
  | readonly [field: string, kind: "required", read: () => SyntaxNode<PhaseType>]
  | readonly [field: string, kind: "nullable", read: () => SyntaxNode<PhaseType> | null]
  | readonly [field: string, kind: "list", read: () => NodeList<SyntaxNode<PhaseType>> | null]
  | readonly [field: string, kind: "array", read: () => readonly SyntaxNode<PhaseType>[] | null];

type SlotKind = ChildPart<Phase>[1];

type FieldKind<Value> = [Value] extends [never] ? "not-child"
  : undefined extends Value ? "not-child"
  : [Value] extends [null] ? "nullable"
  : NonNullable<Value> extends NodeList<unknown> ? "list"
  : NonNullable<Value> extends readonly unknown[] ? "array"
  : NonNullable<Value> extends { readonly kind: string } ? null extends Value ? "nullable" : "required"
  : "not-child";

type FieldKinds<Node, Field extends keyof Node> = Node extends object ? FieldKind<Node[Field]> : never;

type ExactPart<Node> = {
  [Field in keyof Node & string]: {
    [Kind in SlotKind]: [FieldKinds<Node, Field>] extends [Kind] ? readonly [Field, Kind, () => Node[Field]] : never
  }[SlotKind]
}[keyof Node & string];

function* children<PhaseType extends Phase, Node>(
  ...parts: readonly (ChildPart<PhaseType> & ExactPart<Node>)[]
): Generator<SyntaxChildSlot<PhaseType>, void, undefined> {
  for (const [field, kind, read] of parts) {
    switch (kind) {
      case "required": yield { fields: [field], read }; break;
      case "nullable": {
        const child = read();
        if (child !== null) yield { fields: [field], read: () => child };
        break;
      }
      case "list":
      case "array": {
        const list = kind === "list" ? read()?.nodes : read();
        if (list === null || list === undefined) break;
        const length = list.length;
        for (let index = 0; index < length; index += 1) {
          const position = index;
          yield { fields: kind === "list" ? [field, "nodes", position] : [field, position],
            read: () => requirePresent(list[position], missingChild) };
        }
        break;
      }
    }
  }
}

function sameSlot<P extends Phase>(slot: SyntaxChildSlot<P>): SyntaxChildSlot<P> {
  return slot;
}

interface RetainedSyntaxList<Value> {
  readonly loc: TextRange;
  readonly nodes: Value[];
}

function* readRetainedList<P extends Phase, Value extends SyntaxNode<P>>(field: string, list: NodeList<Value>,
  retain: (list: RetainedSyntaxList<Value>, count: number) => void): Generator<SyntaxChildSlot<P>> {
  const raw = list.nodes;
  const length = raw.length;
  const admitted: Value[] = [];
  retain({ loc: list.loc, nodes: admitted }, length);
  for (let index = 0; index < length; index += 1) {
    const position = index;
    yield { fields: [field, "nodes", position], read: () => {
      const child = requirePresent(raw[position], missingChild);
      admitted.push(child);
      return child;
    } };
  }
}

function materializeList<Value>(list: RetainedSyntaxList<Value>, count: number, image: (node: Value) => Value): NodeList<Value> {
  if (list.nodes.length !== count) return throwInvariant(missingStructure);
  for (let position = 0; position < list.nodes.length; position += 1)
    list.nodes[position] = image(requirePresent(list.nodes[position], missingStructure));
  return list;
}

function* blockFields<P extends Phase>(node: Block<P>,
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

function* binaryFields<P extends Phase>(node: BinaryExpression<P>, modifiers: () => ModifierList<P> | null,
  fields: BinaryFields<P>): Generator<SyntaxChildSlot<P>> {
  yield* fields.modifiers("modifiers", modifiers());
  yield* children<P, BinaryExpression<P>>(["left", "required", () => fields.left(node.left)],
    ["type", "nullable", () => fields.type(node.type)], ["operatorToken", "required", () => fields.operator(node.operatorToken)],
    ["right", "required", () => fields.right(node.right)]);
}

function prepareBlockStructure<P extends Phase>(
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

function prepareBinaryStructure<P extends Phase, Stop>(
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

function isSingleExpressionSyntax<P extends Phase>(node: SyntaxNode<P>): node is SingleExpressionSyntax<P> {
  switch (node.kind) {
    case "AwaitExpression": case "ComputedPropertyName": case "DeleteExpression": case "ExpressionStatement":
    case "ExternalModuleReference": case "JsxSpreadAttribute": case "NonNullExpression":
    case "ParenthesizedExpression": case "PartiallyEmittedExpression": case "SpreadAssignment": case "SpreadElement":
    case "ThrowStatement": case "TypeOfExpression": case "VoidExpression": return true;
    default: return false;
  }
}

function singleExpressionSlots<P extends Phase>(node: SingleExpressionSyntax<P>, retain: (child: Expression<P>) => Expression<P>):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, SingleExpressionSyntax<P>>(["expression", "required", () => retain(node.expression)]);
}

function prepareSingleExpression<P extends Phase>(node: SingleExpressionSyntax<P>, ordinal: number): SingleExpressionReceipt<P> {
  let expression: Expression<P> | undefined;
  return { kind: "single-expression", ordinal,
    slots: singleExpressionSlots<P>(node, child => (expression = child)),
    expression: () => requirePresent(expression, missingStructure) };
}

function returnSlots<P extends Phase>(node: ReturnStatement<P>, retain: (child: Expression<P> | null) => Expression<P> | null):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, ReturnStatement<P>>(["expression", "nullable", () => retain(node.expression)]);
}

function prepareReturnStructure<P extends Phase>(node: ReturnStatement<P>, ordinal: number): ReturnSyntaxReceipt<P> {
  let expression: Expression<P> | null | undefined;
  return { kind: "return", ordinal, slots: returnSlots<P>(node, child => (expression = child)),
    expression: () => requirePresent(expression, missingStructure) };
}

function heldChild<Value>(source: () => Value): { readonly pull: () => Value; readonly read: () => Value } {
  let held: Value | undefined;
  return { pull: () => (held = source()), read: () => requirePresent(held, missingStructure) };
}

function heldList<P extends Phase, Value extends SyntaxNode<P>>(field: string, source: () => NodeList<Value>) {
  let list: RetainedSyntaxList<Value> | undefined;
  let length = 0;
  return {
    slots: function* () {
      yield* readRetainedList<P, Value>(field, source(), (retained, count) => {
        list = retained;
        length = count;
      });
    },
    finish: (read: (node: Value) => Value) => materializeList(requirePresent(list, missingStructure), length, read),
  };
}

function isControlSyntax<P extends Phase>(node: SyntaxNode<P>): node is ControlSyntax<P> {
  switch (node.kind) {
    case "DoStatement": case "WhileStatement": case "WithStatement": case "ForStatement": case "ForInStatement": case "ForOfStatement":
    case "BreakStatement": case "ContinueStatement": case "SwitchStatement": case "CaseBlock": case "CaseClause":
    case "DefaultClause": case "TryStatement": case "CatchClause": case "LabeledStatement": return true;
    default: return false;
  }
}

function testedStatementSlots<P extends Phase>(bodyFirst: boolean, statement: () => Statement<P>, expression: () => Expression<P>) {
  const body = ["statement", "required", statement] satisfies ExactPart<DoStatement<P>>;
  const test = ["expression", "required", expression] satisfies ExactPart<DoStatement<P>>;
  return bodyFirst ? children<P, DoStatement<P>>(body, test) : children<P, WhileStatement<P> | WithStatement<P>>(test, body);
}

function forSlots<P extends Phase>(initializer: () => ForInitializer<P> | null, condition: () => Expression<P> | null,
  incrementor: () => Expression<P> | null, statement: () => Statement<P>) {
  return children<P, ForStatement<P>>(["initializer", "nullable", initializer], ["condition", "nullable", condition],
    ["incrementor", "nullable", incrementor], ["statement", "required", statement]);
}

function forInOrOfSlots<P extends Phase>(awaitModifier: () => AwaitKeyword<P> | null, initializer: () => ForInitializer<P>,
  expression: () => Expression<P>, statement: () => Statement<P>) {
  return children<P, ForInOrOfStatement<P>>(["awaitModifier", "nullable", awaitModifier], ["initializer", "required", initializer],
    ["expression", "required", expression], ["statement", "required", statement]);
}

type JumpSyntax<P extends Phase> = Extract<ControlSyntax<P>, { readonly kind: "BreakStatement" | "ContinueStatement" }>;

function jumpSlots<P extends Phase>(label: () => Identifier<P> | null) {
  return children<P, JumpSyntax<P>>(["label", "nullable", label]);
}

function switchSlots<P extends Phase>(expression: () => Expression<P>, caseBlock: () => CaseBlock<P>) {
  return children<P, SwitchStatement<P>>(["expression", "required", expression], ["caseBlock", "required", caseBlock]);
}

function* caseClauseSlots<P extends Phase>(node: CaseOrDefaultClause<P>, expression: (value: Expression<P> | null) => unknown,
  statements: () => Iterable<SyntaxChildSlot<P>>) {
  if (node.kind === "CaseClause") yield { fields: ["expression"], read: () => {
    const value = node.expression;
    expression(value);
    return value;
  } } satisfies SyntaxChildSlot<P>;
  else expression(node.expression);
  yield* statements();
}

function trySlots<P extends Phase>(tryBlock: () => Block<P>, catchClause: () => CatchClause<P> | null,
  finallyBlock: () => Block<P> | null) {
  return children<P, TryStatement<P>>(["tryBlock", "required", tryBlock], ["catchClause", "nullable", catchClause],
    ["finallyBlock", "nullable", finallyBlock]);
}

function catchSlots<P extends Phase>(variableDeclaration: () => VariableDeclaration<P> | null, block: () => Block<P>) {
  return children<P, CatchClause<P>>(["variableDeclaration", "nullable", variableDeclaration], ["block", "required", block]);
}

function labeledSlots<P extends Phase>(label: () => Identifier<P>, statement: () => Statement<P>) {
  return children<P, LabeledStatement<P>>(["label", "required", label], ["statement", "required", statement]);
}

function prepareControl<P extends Phase, Stop>(node: ControlSyntax<P>, ordinal: number,
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

function heldOptionalList<P extends Phase, Value extends SyntaxNode<P>>(field: string, source: NodeList<Value> | null) {
  const present = source === null ? null : heldList<P, Value>(field, () => source);
  return { slots: () => present?.slots() ?? [], finish: (read: (node: Value) => Value) => present?.finish(read) ?? null };
}

function isTypeStructure<P extends Phase>(node: SyntaxNode<P>): node is TypeStructureSyntax<P> {
  switch (node.kind) {
    case "TypeOperator": case "OptionalType": case "RestType": case "ParenthesizedType": case "ArrayType":
    case "UnionType": case "IntersectionType": case "TupleType": case "TypeLiteral": case "ConditionalType":
    case "IndexedAccessType": case "TypeReference": case "TypeQuery": case "LiteralType": case "InferType": case "NamedTupleMember":
    case "TypePredicate": case "ImportAttribute": case "ImportAttributes": case "MappedType": case "TypeParameter":
    case "FunctionType": case "ConstructorType": case "TemplateLiteralType": case "TemplateLiteralTypeSpan":
      return true;
    default: return false;
  }
}

function wrappedTypeSlots<P extends Phase>(type: () => TypeNode<P>) {
  return children<P, WrappedTypeSyntax<P>>(["type", "required", type]);
}

function arrayTypeSlots<P extends Phase>(element: () => TypeNode<P>) {
  return children<P, ArrayTypeNode<P>>(["elementType", "required", element]);
}

function conditionalTypeSlots<P extends Phase>(check: () => TypeNode<P>, bound: () => TypeNode<P>,
  whenTrue: () => TypeNode<P>, whenFalse: () => TypeNode<P>) {
  return children<P, ConditionalTypeNode<P>>(["checkType", "required", check], ["extendsType", "required", bound],
    ["trueType", "required", whenTrue], ["falseType", "required", whenFalse]);
}

function indexedTypeSlots<P extends Phase>(object: () => TypeNode<P>, index: () => TypeNode<P>) {
  return children<P, IndexedAccessTypeNode<P>>(["objectType", "required", object], ["indexType", "required", index]);
}

function* namedTypeSlots<P extends Phase>(field: "typeName" | "exprName", name: () => EntityName<P>,
  args: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  if (field === "typeName") yield* children<P, TypeReferenceNode<P>>([field, "required", name]);
  else yield* children<P, TypeQueryNode<P>>([field, "required", name]);
  yield* args();
}

function literalTypeSlots<P extends Phase>(literal: () => LiteralTypeChild<P>) {
  return children<P, LiteralTypeNode<P>>(["literal", "required", literal]);
}

function inferTypeSlots<P extends Phase>(parameter: () => TypeParameterDeclaration<P>) {
  return children<P, InferTypeNode<P>>(["typeParameter", "required", parameter]);
}

function namedTupleSlots<P extends Phase>(dots: () => DotDotDotToken<P> | null, name: () => Identifier<P>,
  question: () => QuestionToken<P> | null, type: () => TypeNode<P>) {
  return children<P, NamedTupleMember<P>>(["dotDotDotToken", "nullable", dots], ["name", "required", name],
    ["questionToken", "nullable", question], ["type", "required", type]);
}

function typePredicateSlots<P extends Phase>(asserts: () => AssertsKeyword<P> | null,
  name: () => TypePredicateParameterName<P>, type: () => TypeNode<P> | null) {
  return children<P, TypePredicateNode<P>>(["assertsModifier", "nullable", asserts], ["parameterName", "required", name],
    ["type", "nullable", type]);
}

function importAttributeSlots<P extends Phase>(name: () => ImportAttributeName<P>, value: () => Expression<P>) {
  return children<P, ImportAttribute<P>>(["name", "required", name], ["value", "required", value]);
}

function* mappedTypeSlots<P extends Phase>(readonlyToken: () => ReadonlyKeyword<P> | PlusToken<P> | MinusToken<P> | null,
  parameter: () => TypeParameterDeclaration<P>, nameType: () => TypeNode<P> | null,
  question: () => QuestionToken<P> | PlusToken<P> | MinusToken<P> | null, type: () => TypeNode<P> | null,
  members: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, MappedTypeNode<P>>(["readonlyToken", "nullable", readonlyToken], ["typeParameter", "required", parameter],
    ["nameType", "nullable", nameType], ["questionToken", "nullable", question], ["type", "nullable", type]);
  yield* members();
}

function* signatureSlots<P extends Phase>(
  typeParameters: () => Iterable<SyntaxChildSlot<P>>, parameters: () => Iterable<SyntaxChildSlot<P>>,
  type: () => TypeNode<P> | null, full: () => TypeNode<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* typeParameters();
  yield* parameters();
  yield* children<P, FunctionTypeNode<P> | ConstructorTypeNode<P>>(["type", "nullable", type], ["fullSignature", "nullable", full]);
}

function* typeParameterSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>, name: () => Identifier<P>,
  constraint: () => TypeNode<P> | null, expression: () => Expression<P> | null,
  defaultType: () => TypeNode<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, TypeParameterDeclaration<P>>(["name", "required", name], ["constraint", "nullable", constraint],
    ["expression", "nullable", expression], ["defaultType", "nullable", defaultType]);
}

function* templateHeadSlots<P extends Phase>(head: () => TemplateHead<P>,
  spans: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, TemplateLiteralTypeNode<P> | TemplateExpression<P>>(["head", "required", head]);
  yield* spans();
}

function templateTypeSpanSlots<P extends Phase>(type: () => TypeNode<P>, literal: () => TemplateMiddleOrTail<P>) {
  return children<P, TemplateLiteralTypeSpan<P>>(["type", "required", type], ["literal", "required", literal]);
}

type SignatureOperands<P extends Phase> = Pick<FunctionTypeNode<P>, "typeParameters" | "parameters" | "type" | "fullSignature">;

function rawSignatureSlots<P extends Phase>(node: SignatureOperands<P>) {
  return signatureSlots<P>(() => children<P, SignatureOperands<P>>(["typeParameters", "list", () => node.typeParameters]),
    () => children<P, SignatureOperands<P>>(["parameters", "list", () => node.parameters]), () => node.type, () => node.fullSignature);
}

function prepareSignatureStructure<P extends Phase, Stop>(node: SignatureOperands<P>,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<SignatureSyntaxFields<P> & { readonly slots: Iterable<SyntaxChildSlot<P>> }, Stop> {
  const rawTypeParameters = node.typeParameters;
  const stop = (rawTypeParameters === null ? null : admitList("typeParameters")) ?? admitList("parameters");
  if (stop !== null) return { kind: "refused", stop };
  const typeParameters = heldOptionalList<P, TypeParameterDeclaration<P>>("typeParameters", rawTypeParameters);
  const parameters = heldList<P, ParameterDeclaration<P>>("parameters", () => node.parameters);
  const type = heldChild(() => node.type);
  const full = heldChild(() => node.fullSignature);
  return { kind: "copied", value: { slots: signatureSlots<P>(typeParameters.slots, parameters.slots, type.pull, full.pull),
    typeParameters: typeParameters.finish, parameters: parameters.finish, type: type.read, full: full.read } };
}

function* prependSlots<P extends Phase>(first: Iterable<SyntaxChildSlot<P>>, rest: Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* first;
  yield* rest;
}

function prepareCallableStructure<P extends Phase, Stop>(node: FunctionTypeNode<P> | ConstructorTypeNode<P> | ArrowFunction<P>,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<CallableSyntaxFields<P> & { readonly slots: Iterable<SyntaxChildSlot<P>> }, Stop> {
  const rawModifiers = node.modifiers;
  const modifierStop = rawModifiers === null ? null : admitList("modifiers");
  if (modifierStop !== null) return { kind: "refused", stop: modifierStop };
  const signature = prepareSignatureStructure<P, Stop>(node, admitList);
  if (signature.kind === "refused") return signature;
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  return { kind: "copied", value: { ...signature.value, modifiers: modifiers.finish,
    slots: prependSlots<P>(modifiers.slots(), signature.value.slots) } };
}

function prepareTypeStructure<P extends Phase, Stop>(node: TypeStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<TypeStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "TypeOperator": case "OptionalType": case "RestType": case "ParenthesizedType": {
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "type-wrapper", ordinal, slots: wrappedTypeSlots<P>(type.pull), value: type.read } };
    }
    case "ArrayType": {
      const element = heldChild(() => node.elementType);
      return { kind: "copied", value: { kind: "type-wrapper", ordinal, slots: arrayTypeSlots<P>(element.pull), value: element.read } };
    }
    case "UnionType": case "IntersectionType": {
      const stop = admitList("types");
      if (stop !== null) return { kind: "refused", stop };
      const types = heldList<P, TypeNode<P>>("types", () => node.types);
      return { kind: "copied", value: { kind: "type-vector", ordinal, slots: types.slots(), values: types.finish } };
    }
    case "TupleType": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, TypeNode<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "type-vector", ordinal, slots: elements.slots(), values: elements.finish } };
    }
    case "TypeLiteral": {
      const stop = admitList("members");
      if (stop !== null) return { kind: "refused", stop };
      const members = heldList<P, TypeElement<P>>("members", () => node.members);
      return { kind: "copied", value: { kind: "type-members", ordinal, slots: members.slots(), members: members.finish } };
    }
    case "ConditionalType": {
      const check = heldChild(() => node.checkType);
      const bound = heldChild(() => node.extendsType);
      const whenTrue = heldChild(() => node.trueType);
      const whenFalse = heldChild(() => node.falseType);
      return { kind: "copied", value: { kind: "conditional-type", ordinal,
        slots: conditionalTypeSlots<P>(check.pull, bound.pull, whenTrue.pull, whenFalse.pull),
        check: check.read, extends: bound.read, whenTrue: whenTrue.read, whenFalse: whenFalse.read } };
    }
    case "IndexedAccessType": {
      const object = heldChild(() => node.objectType);
      const index = heldChild(() => node.indexType);
      return { kind: "copied", value: { kind: "indexed-type", ordinal, slots: indexedTypeSlots<P>(object.pull, index.pull),
        object: object.read, index: index.read } };
    }
    case "TypeReference": case "TypeQuery": {
      const rawArguments = node.typeArguments;
      if (rawArguments !== null) {
        const stop = admitList("typeArguments");
        if (stop !== null) return { kind: "refused", stop };
      }
      const reference = node.kind === "TypeReference";
      const name = reference ? heldChild(() => node.typeName) : heldChild(() => node.exprName);
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      return { kind: "copied", value: { kind: "named-type", ordinal,
        slots: namedTypeSlots<P>(reference ? "typeName" : "exprName", name.pull, args.slots),
        name: name.read, arguments: args.finish } };
    }
    case "LiteralType": {
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "literal-type", ordinal, slots: literalTypeSlots<P>(literal.pull), literal: literal.read } };
    }
    case "InferType": {
      const parameter = heldChild(() => node.typeParameter);
      return { kind: "copied", value: { kind: "infer-type", ordinal, slots: inferTypeSlots<P>(parameter.pull), parameter: parameter.read } };
    }
    case "NamedTupleMember": {
      const dots = heldChild(() => node.dotDotDotToken);
      const name = heldChild(() => node.name);
      const question = heldChild(() => node.questionToken);
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "named-tuple", ordinal, slots: namedTupleSlots<P>(dots.pull, name.pull, question.pull, type.pull),
        dots: dots.read, name: name.read, question: question.read, type: type.read } };
    }
    case "TypePredicate": {
      const asserts = heldChild(() => node.assertsModifier);
      const name = heldChild(() => node.parameterName);
      const type = heldChild(() => node.type);
      return { kind: "copied", value: { kind: "type-predicate", ordinal, slots: typePredicateSlots<P>(asserts.pull, name.pull, type.pull),
        asserts: asserts.read, name: name.read, type: type.read } };
    }
    case "ImportAttribute": {
      const name = heldChild(() => node.name);
      const value = heldChild(() => node.value);
      return { kind: "copied", value: { kind: "import-attribute", ordinal, slots: importAttributeSlots<P>(name.pull, value.pull),
        name: name.read, value: value.read } };
    }
    case "ImportAttributes": {
      const stop = admitList("attributes");
      if (stop !== null) return { kind: "refused", stop };
      const attributes = heldList<P, ImportAttribute<P>>("attributes", () => node.attributes);
      return { kind: "copied", value: { kind: "import-attributes", ordinal, slots: attributes.slots(), attributes: attributes.finish } };
    }
    case "MappedType": {
      const rawMembers = node.members;
      const stop = rawMembers === null ? null : admitList("members");
      if (stop !== null) return { kind: "refused", stop };
      const readonlyToken = heldChild(() => node.readonlyToken);
      const parameter = heldChild(() => node.typeParameter);
      const nameType = heldChild(() => node.nameType);
      const question = heldChild(() => node.questionToken);
      const type = heldChild(() => node.type);
      const members = heldOptionalList<P, TypeElement<P>>("members", rawMembers);
      return { kind: "copied", value: { kind: "mapped-type", ordinal,
        slots: mappedTypeSlots<P>(readonlyToken.pull, parameter.pull, nameType.pull, question.pull, type.pull, members.slots),
        readonlyToken: readonlyToken.read, parameter: parameter.read, nameType: nameType.read, question: question.read,
        type: type.read, members: members.finish } };
    }
    case "FunctionType": case "ConstructorType": {
      const prepared = prepareCallableStructure<P, Stop>(node, admitList);
      return prepared.kind === "refused" ? prepared : { kind: "copied", value: { kind: "callable-type", ordinal, ...prepared.value } };
    }
    case "TypeParameter": {
      const rawModifiers = node.modifiers;
      const stop = rawModifiers === null ? null : admitList("modifiers");
      if (stop !== null) return { kind: "refused", stop };
      const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
      const name = heldChild(() => node.name);
      const constraint = heldChild(() => node.constraint);
      const expression = heldChild(() => node.expression);
      const defaultType = heldChild(() => node.defaultType);
      return { kind: "copied", value: { kind: "type-parameter", ordinal,
        slots: typeParameterSlots<P>(modifiers.slots, name.pull, constraint.pull, expression.pull, defaultType.pull),
        modifiers: modifiers.finish, name: name.read, constraint: constraint.read, expression: expression.read, defaultType: defaultType.read } };
    }
    case "TemplateLiteralType": {
      const stop = admitList("templateSpans");
      if (stop !== null) return { kind: "refused", stop };
      const head = heldChild(() => node.head);
      const spans = heldList<P, TemplateLiteralTypeSpan<P>>("templateSpans", () => node.templateSpans);
      return { kind: "copied", value: { kind: "template-type", ordinal, slots: templateHeadSlots<P>(head.pull, spans.slots),
        head: head.read, spans: spans.finish } };
    }
    case "TemplateLiteralTypeSpan": {
      const type = heldChild(() => node.type);
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "template-type-span", ordinal, slots: templateTypeSpanSlots<P>(type.pull, literal.pull),
        type: type.read, literal: literal.read } };
    }
  }
}

function isExpressionStructure<P extends Phase>(node: SyntaxNode<P>): node is ExpressionStructureSyntax<P> {
  switch (node.kind) {
    case "QualifiedName": case "YieldExpression": case "ArrowFunction": case "MetaProperty": case "TemplateExpression":
    case "TemplateSpan": case "TaggedTemplateExpression": case "PropertyAssignment": case "ShorthandPropertyAssignment":
    case "TypeAssertionExpression": case "ExpressionWithTypeArguments": case "SyntheticReferenceExpression": return true;
    default: return false;
  }
}

function qualifiedNameSlots<P extends Phase>(left: () => EntityName<P>, right: () => Identifier<P>) {
  return children<P, QualifiedName<P>>(["left", "required", left], ["right", "required", right]);
}

function yieldSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null, expression: () => Expression<P> | null) {
  return children<P, YieldExpression<P>>(["asteriskToken", "nullable", asterisk], ["expression", "nullable", expression]);
}

function* arrowSlots<P extends Phase>(signature: Iterable<SyntaxChildSlot<P>>, asterisk: () => AsteriskToken<P> | null,
  arrow: () => EqualsGreaterThanToken<P>, body: () => BlockOrExpression<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* signature;
  yield* children<P, ArrowFunction<P>>(["asteriskToken", "nullable", asterisk], ["equalsGreaterThanToken", "required", arrow], ["body", "nullable", body]);
}

function metaPropertySlots<P extends Phase>(name: () => Identifier<P>) {
  return children<P, MetaProperty<P>>(["name", "required", name]);
}

function templateSpanSlots<P extends Phase>(expression: () => Expression<P>, literal: () => TemplateMiddleOrTail<P>) {
  return children<P, TemplateSpan<P>>(["expression", "required", expression], ["literal", "required", literal]);
}

function* taggedTemplateSlots<P extends Phase>(tag: () => Expression<P>, question: () => QuestionDotToken<P> | null,
  args: () => Iterable<SyntaxChildSlot<P>>, template: () => TemplateLiteral<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, TaggedTemplateExpression<P>>(["tag", "required", tag], ["questionDotToken", "nullable", question]);
  yield* args();
  yield* children<P, TaggedTemplateExpression<P>>(["template", "required", template]);
}

function* propertyAssignmentSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>, name: () => PropertyName<P>,
  postfix: () => QuestionToken<P> | ExclamationToken<P> | null, type: () => TypeNode<P> | null,
  tail: Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, PropertyAssignment<P> | ShorthandPropertyAssignment<P>>(["name", "required", name],
    ["postfixToken", "nullable", postfix], ["type", "nullable", type]);
  yield* tail;
}

function initializerSlots<P extends Phase>(initializer: () => Expression<P>) {
  return children<P, PropertyAssignment<P>>(["initializer", "required", initializer]);
}

function shorthandSlots<P extends Phase>(equals: () => EqualsToken<P> | null, initializer: () => Expression<P> | null) {
  return children<P, ShorthandPropertyAssignment<P>>(["equalsToken", "nullable", equals], ["objectAssignmentInitializer", "nullable", initializer]);
}

function assertionSlots<P extends Phase>(type: () => TypeNode<P>, expression: () => Expression<P>) {
  return children<P, TypeAssertion<P>>(["type", "required", type], ["expression", "required", expression]);
}

function* expressionArgumentsSlots<P extends Phase>(expression: () => Expression<P>,
  args: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, ExpressionWithTypeArguments<P>>(["expression", "required", expression]);
  yield* args();
}

function syntheticReferenceSlots<P extends Phase>(expression: () => Expression<P>, thisArg: () => Expression<P>) {
  return children<P, SyntheticReferenceExpression<P>>(["expression", "required", expression], ["thisArg", "required", thisArg]);
}

function prepareExpressionStructure<P extends Phase, Stop>(node: ExpressionStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<ExpressionStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "QualifiedName": {
      const left = heldChild(() => node.left);
      const right = heldChild(() => node.right);
      return { kind: "copied", value: { kind: "qualified-name", ordinal, slots: qualifiedNameSlots<P>(left.pull, right.pull), left: left.read, right: right.read } };
    }
    case "YieldExpression": {
      const asterisk = heldChild(() => node.asteriskToken);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "yield", ordinal, slots: yieldSlots<P>(asterisk.pull, expression.pull), asterisk: asterisk.read, expression: expression.read } };
    }
    case "ArrowFunction": {
      const signature = prepareCallableStructure<P, Stop>(node, admitList);
      if (signature.kind === "refused") return signature;
      const asterisk = heldChild(() => node.asteriskToken);
      const arrow = heldChild(() => node.equalsGreaterThanToken);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "arrow", ordinal, ...signature.value,
        slots: arrowSlots<P>(signature.value.slots, asterisk.pull, arrow.pull, body.pull), asterisk: asterisk.read, arrow: arrow.read, body: body.read } };
    }
    case "MetaProperty": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "meta-property", ordinal, slots: metaPropertySlots<P>(name.pull), name: name.read } };
    }
    case "TemplateExpression": {
      const stop = admitList("templateSpans");
      if (stop !== null) return { kind: "refused", stop };
      const head = heldChild(() => node.head);
      const spans = heldList<P, TemplateSpan<P>>("templateSpans", () => node.templateSpans);
      return { kind: "copied", value: { kind: "template-expression", ordinal, slots: templateHeadSlots<P>(head.pull, spans.slots), head: head.read, spans: spans.finish } };
    }
    case "TemplateSpan": {
      const expression = heldChild(() => node.expression);
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "template-span", ordinal, slots: templateSpanSlots<P>(expression.pull, literal.pull),
        expression: expression.read, literal: literal.read } };
    }
    case "TaggedTemplateExpression": case "ExpressionWithTypeArguments": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      if (node.kind === "TaggedTemplateExpression") {
        const tag = heldChild(() => node.tag);
        const question = heldChild(() => node.questionDotToken);
        const template = heldChild(() => node.template);
        return { kind: "copied", value: { kind: "tagged-template", ordinal, slots: taggedTemplateSlots<P>(tag.pull, question.pull, args.slots, template.pull),
          tag: tag.read, question: question.read, args: args.finish, template: template.read } };
      }
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "expression-type-arguments", ordinal,
        slots: expressionArgumentsSlots<P>(expression.pull, args.slots), expression: expression.read, args: args.finish } };
    }
    case "PropertyAssignment": case "ShorthandPropertyAssignment": {
      const rawModifiers = node.modifiers;
      const stop = rawModifiers === null ? null : admitList("modifiers");
      if (stop !== null) return { kind: "refused", stop };
      const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
      const name = heldChild(() => node.name);
      const postfix = heldChild(() => node.postfixToken);
      const type = heldChild(() => node.type);
      if (node.kind === "PropertyAssignment") {
        const initializer = heldChild(() => node.initializer);
        return { kind: "copied", value: { kind: "property-assignment", ordinal,
          slots: propertyAssignmentSlots<P>(modifiers.slots, name.pull, postfix.pull, type.pull, initializerSlots<P>(initializer.pull)),
          modifiers: modifiers.finish, name: name.read, postfix: postfix.read, type: type.read, initializer: initializer.read } };
      }
      const equals = heldChild(() => node.equalsToken);
      const initializer = heldChild(() => node.objectAssignmentInitializer);
      return { kind: "copied", value: { kind: "shorthand-assignment", ordinal,
        slots: propertyAssignmentSlots<P>(modifiers.slots, name.pull, postfix.pull, type.pull, shorthandSlots<P>(equals.pull, initializer.pull)),
        modifiers: modifiers.finish, name: name.read, postfix: postfix.read, type: type.read, equals: equals.read, initializer: initializer.read } };
    }
    case "TypeAssertionExpression": {
      const type = heldChild(() => node.type);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "type-assertion", ordinal, slots: assertionSlots<P>(type.pull, expression.pull),
        type: type.read, expression: expression.read } };
    }
    case "SyntheticReferenceExpression": {
      const expression = heldChild(() => node.expression);
      const thisArg = heldChild(() => node.thisArg);
      return { kind: "copied", value: { kind: "synthetic-reference", ordinal, slots: syntheticReferenceSlots<P>(expression.pull, thisArg.pull),
        expression: expression.read, thisArg: thisArg.read } };
    }
  }
}

function isModuleStructure<P extends Phase>(node: SyntaxNode<P>): node is ModuleStructureSyntax<P> {
  switch (node.kind) {
    case "ImportDeclaration": case "JSImportDeclaration": case "ExportDeclaration": case "ImportEqualsDeclaration":
    case "ModuleDeclaration": case "ImportType": case "ImportClause": case "ImportSpecifier": case "ExportSpecifier":
    case "NamespaceImport": case "NamespaceExport": case "NamespaceExportDeclaration":
    case "NamedImports": case "NamedExports": case "ExportAssignment": return true;
    default: return false;
  }
}

function importDeclarationSlots<P extends Phase>(clause: () => ImportClause<P> | null, specifier: () => Expression<P>,
  attributes: () => ImportAttributes<P> | null) {
  return children<P, ImportDeclaration<P>>(["importClause", "nullable", clause], ["moduleSpecifier", "required", specifier], ["attributes", "nullable", attributes]);
}

function exportDeclarationSlots<P extends Phase>(clause: () => NamedExportBindings<P> | null, specifier: () => Expression<P> | null,
  attributes: () => ImportAttributes<P> | null) {
  return children<P, ExportDeclaration<P>>(["exportClause", "nullable", clause], ["moduleSpecifier", "nullable", specifier], ["attributes", "nullable", attributes]);
}

function importEqualsSlots<P extends Phase>(name: () => Identifier<P>, reference: () => ModuleReference<P>) {
  return children<P, ImportEqualsDeclaration<P>>(["name", "required", name], ["moduleReference", "required", reference]);
}

function namespaceSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null, name: () => ModuleName<P>, body: () => NodeBody<P> | null) {
  return children<P, ModuleDeclaration<P>>(["asteriskToken", "nullable", asterisk], ["name", "required", name], ["body", "nullable", body]);
}

function importTypeSlots<P extends Phase>(argument: () => TypeNode<P>, attributes: () => ImportAttributes<P> | null,
  qualifier: () => EntityName<P> | null) {
  return children<P, ImportTypeNode<P>>(["argument", "required", argument], ["attributes", "nullable", attributes], ["qualifier", "nullable", qualifier]);
}

function importClauseSlots<P extends Phase>(name: () => Identifier<P> | null, bindings: () => NamedImportBindings<P> | null) {
  return children<P, ImportClause<P>>(["name", "nullable", name], ["namedBindings", "nullable", bindings]);
}

function importExportSpecifierSlots<P extends Phase>(property: () => ModuleExportName<P> | null, name: () => ModuleExportName<P>) {
  return children<P, ExportSpecifier<P>>(["propertyName", "nullable", property], ["name", "required", name]);
}

function namespaceNameSlots<P extends Phase>(name: () => ModuleExportName<P>) {
  return children<P, NamespaceImport<P> | NamespaceExport<P> | NamespaceExportDeclaration<P>>(["name", "required", name]);
}

function exportAssignmentSlots<P extends Phase>(type: () => TypeNode<P> | null, expression: () => Expression<P>) {
  return children<P, ExportAssignment<P>>(["type", "nullable", type], ["expression", "required", expression]);
}

function prepareModuleStructure<P extends Phase, Stop>(node: ModuleStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<ModuleStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "ImportType": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      const argument = heldChild(() => node.argument);
      const attributes = heldChild(() => node.attributes);
      const qualifier = heldChild(() => node.qualifier);
      return { kind: "copied", value: { kind: "import-type", ordinal,
        slots: prependSlots<P>(importTypeSlots<P>(argument.pull, attributes.pull, qualifier.pull), args.slots()),
        argument: argument.read, attributes: attributes.read, qualifier: qualifier.read, args: args.finish } };
    }
    case "ImportClause": {
      const name = heldChild(() => node.name);
      const bindings = heldChild(() => node.namedBindings);
      return { kind: "copied", value: { kind: "import-clause", ordinal, slots: importClauseSlots<P>(name.pull, bindings.pull), name: name.read, bindings: bindings.read } };
    }
    case "ImportSpecifier": case "ExportSpecifier": {
      if (node.kind === "ImportSpecifier") {
        const property = heldChild(() => node.propertyName);
        const name = heldChild(() => node.name);
        return { kind: "copied", value: { kind: "import-specifier", ordinal, slots: importExportSpecifierSlots<P>(property.pull, name.pull),
          property: property.read, name: name.read } };
      }
      const property = heldChild(() => node.propertyName);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "export-specifier", ordinal, slots: importExportSpecifierSlots<P>(property.pull, name.pull),
        property: property.read, name: name.read } };
    }
    case "NamespaceImport": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-import", ordinal, slots: namespaceNameSlots<P>(name.pull), name: name.read } };
    }
    case "NamespaceExport": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-export", ordinal, slots: namespaceNameSlots<P>(name.pull), name: name.read } };
    }
    case "NamedImports": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, ImportSpecifier<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "named-imports", ordinal, slots: elements.slots(), elements: elements.finish } };
    }
    case "NamedExports": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, ExportSpecifier<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "named-exports", ordinal, slots: elements.slots(), elements: elements.finish } };
    }
  }
  const rawModifiers = node.modifiers;
  const stop = rawModifiers === null ? null : admitList("modifiers");
  if (stop !== null) return { kind: "refused", stop };
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  switch (node.kind) {
    case "ImportDeclaration": case "JSImportDeclaration": {
      const clause = heldChild(() => node.importClause);
      const specifier = heldChild(() => node.moduleSpecifier);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "import-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), importDeclarationSlots<P>(clause.pull, specifier.pull, attributes.pull)),
        clause: clause.read, specifier: specifier.read, attributes: attributes.read } };
    }
    case "ExportDeclaration": {
      const clause = heldChild(() => node.exportClause);
      const specifier = heldChild(() => node.moduleSpecifier);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "export-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), exportDeclarationSlots<P>(clause.pull, specifier.pull, attributes.pull)),
        clause: clause.read, specifier: specifier.read, attributes: attributes.read } };
    }
    case "ImportEqualsDeclaration": {
      const name = heldChild(() => node.name);
      const reference = heldChild(() => node.moduleReference);
      return { kind: "copied", value: { kind: "import-equals", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), importEqualsSlots<P>(name.pull, reference.pull)), name: name.read, reference: reference.read } };
    }
    case "ModuleDeclaration": {
      const asterisk = heldChild(() => node.asteriskToken);
      const name = heldChild(() => node.name);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "namespace", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), namespaceSlots<P>(asterisk.pull, name.pull, body.pull)), asterisk: asterisk.read, name: name.read, body: body.read } };
    }
    case "NamespaceExportDeclaration": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-export-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), namespaceNameSlots<P>(name.pull)), name: name.read } };
    }
    case "ExportAssignment": {
      const type = heldChild(() => node.type);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "export-assignment", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), exportAssignmentSlots<P>(type.pull, expression.pull)), type: type.read, expression: expression.read } };
    }
  }
}

function isJsxStructure<P extends Phase>(node: SyntaxNode<P>): node is JsxStructureSyntax<P> {
  switch (node.kind) {
    case "JsxElement": case "JsxAttributes": case "JsxNamespacedName": case "JsxOpeningElement": case "JsxSelfClosingElement":
    case "JsxFragment": case "JsxAttribute": case "JsxClosingElement": case "JsxExpression": return true;
    default: return false;
  }
}

function* jsxElementSlots<P extends Phase>(opening: () => JsxOpeningElement<P>, inner: () => Iterable<SyntaxChildSlot<P>>,
  closing: () => JsxClosingElement<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, JsxElement<P>>(["openingElement", "required", opening]);
  yield* inner();
  yield* children<P, JsxElement<P>>(["closingElement", "required", closing]);
}

function* jsxFragmentSlots<P extends Phase>(opening: () => JsxOpeningFragment<P>, inner: () => Iterable<SyntaxChildSlot<P>>,
  closing: () => JsxClosingFragment<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, JsxFragment<P>>(["openingFragment", "required", opening]);
  yield* inner();
  yield* children<P, JsxFragment<P>>(["closingFragment", "required", closing]);
}

function jsxNameSlots<P extends Phase>(namespace: () => Identifier<P>, name: () => Identifier<P>) {
  return children<P, JsxNamespacedName<P>>(["namespace", "required", namespace], ["name", "required", name]);
}

function jsxTagSlots<P extends Phase>(name: () => JsxTagNameExpression<P>) {
  return children<P, JsxOpeningElement<P> | JsxSelfClosingElement<P> | JsxClosingElement<P>>(["tagName", "required", name]);
}

function* jsxOpeningSlots<P extends Phase>(name: () => JsxTagNameExpression<P>, args: () => Iterable<SyntaxChildSlot<P>>,
  attributes: () => JsxAttributes<P>): Generator<SyntaxChildSlot<P>> {
  yield* jsxTagSlots<P>(name);
  yield* args();
  yield* children<P, JsxOpeningElement<P> | JsxSelfClosingElement<P>>(["attributes", "required", attributes]);
}

function jsxAttributeSlots<P extends Phase>(name: () => JsxAttributeName<P>, initializer: () => JsxAttributeValue<P> | null) {
  return children<P, JsxAttribute<P>>(["name", "required", name], ["initializer", "nullable", initializer]);
}

function jsxExpressionSlots<P extends Phase>(dots: () => DotDotDotToken<P> | null, expression: () => Expression<P> | null) {
  return children<P, JsxExpression<P>>(["dotDotDotToken", "nullable", dots], ["expression", "nullable", expression]);
}

function prepareJsxStructure<P extends Phase, Stop>(node: JsxStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<JsxStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "JsxElement": case "JsxFragment": {
      const stop = admitList("children");
      if (stop !== null) return { kind: "refused", stop };
      const inner = heldList<P, JsxChild<P>>("children", () => node.children);
      if (node.kind === "JsxElement") {
        const opening = heldChild(() => node.openingElement);
        const closing = heldChild(() => node.closingElement);
        return { kind: "copied", value: { kind: "jsx-element", ordinal, slots: jsxElementSlots<P>(opening.pull, inner.slots, closing.pull),
          opening: opening.read, closing: closing.read, children: inner.finish } };
      }
      const opening = heldChild(() => node.openingFragment);
      const closing = heldChild(() => node.closingFragment);
      return { kind: "copied", value: { kind: "jsx-fragment", ordinal, slots: jsxFragmentSlots<P>(opening.pull, inner.slots, closing.pull),
        opening: opening.read, closing: closing.read, children: inner.finish } };
    }
    case "JsxAttributes": {
      const stop = admitList("properties");
      if (stop !== null) return { kind: "refused", stop };
      const properties = heldList<P, JsxAttributeLike<P>>("properties", () => node.properties);
      return { kind: "copied", value: { kind: "jsx-attributes", ordinal, slots: properties.slots(), properties: properties.finish } };
    }
    case "JsxNamespacedName": {
      const namespace = heldChild(() => node.namespace);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "jsx-name", ordinal, slots: jsxNameSlots<P>(namespace.pull, name.pull), namespace: namespace.read, name: name.read } };
    }
    case "JsxOpeningElement": case "JsxSelfClosingElement": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      const name = heldChild(() => node.tagName);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "jsx-opening", ordinal, slots: jsxOpeningSlots<P>(name.pull, args.slots, attributes.pull),
        name: name.read, args: args.finish, attributes: attributes.read } };
    }
    case "JsxAttribute": {
      const name = heldChild(() => node.name);
      const initializer = heldChild(() => node.initializer);
      return { kind: "copied", value: { kind: "jsx-attribute", ordinal, slots: jsxAttributeSlots<P>(name.pull, initializer.pull),
        name: name.read, initializer: initializer.read } };
    }
    case "JsxClosingElement": {
      const name = heldChild(() => node.tagName);
      return { kind: "copied", value: { kind: "jsx-closing", ordinal, slots: jsxTagSlots<P>(name.pull), name: name.read } };
    }
    case "JsxExpression": {
      const dots = heldChild(() => node.dotDotDotToken);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "jsx-expression", ordinal, slots: jsxExpressionSlots<P>(dots.pull, expression.pull), dots: dots.read, expression: expression.read } };
    }
  }
}

function isDeclarationStructure<P extends Phase>(node: SyntaxNode<P>): node is DeclarationStructureSyntax<P> {
  switch (node.kind) {
    case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration": case "HeritageClause":
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": case "EnumDeclaration": case "EnumMember":
    case "ModuleBlock": case "MissingDeclaration": case "CallSignature": case "ConstructSignature": case "Constructor":
    case "GetAccessor": case "SetAccessor": case "IndexSignature": case "MethodSignature": case "MethodDeclaration":
    case "PropertySignature": case "PropertyDeclaration": case "ClassStaticBlockDeclaration": return true;
    default: return false;
  }
}

type ClassSyntax<P extends Phase> = ClassDeclaration<P> | ClassExpression<P>;

function* declarationSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>,
  name: () => Iterable<SyntaxChildSlot<P>>, ...rest: readonly (() => Iterable<SyntaxChildSlot<P>>)[]): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* name();
  for (const slots of rest) yield* slots();
}

function classNameSlots<P extends Phase>(name: () => Identifier<P> | null) {
  return children<P, ClassSyntax<P>>(["name", "nullable", name]);
}

function declarationNameSlots<P extends Phase>(name: () => Identifier<P>) {
  return children<P, InterfaceDeclaration<P> | TypeAliasDeclaration<P> | EnumDeclaration<P>>(["name", "required", name]);
}

function aliasTypeSlots<P extends Phase>(type: () => TypeNode<P>) {
  return children<P, TypeAliasDeclaration<P>>(["type", "required", type]);
}

function enumMemberSlots<P extends Phase>(name: () => PropertyName<P>, postfix: () => QuestionToken<P> | ExclamationToken<P> | null,
  initializer: () => Expression<P> | null) {
  return children<P, EnumMember<P>>(["name", "required", name], ["postfixToken", "nullable", postfix], ["initializer", "nullable", initializer]);
}

type MethodSyntax<P extends Phase> = MethodDeclaration<P> | GetAccessorDeclaration<P> | SetAccessorDeclaration<P>;
type NamedMemberSyntax<P extends Phase> = MethodSyntax<P> | MethodSignatureDeclaration<P> | PropertyDeclaration<P> | PropertySignatureDeclaration<P>;

function memberNameSlots<P extends Phase>(name: () => PropertyName<P>, postfix: () => QuestionToken<P> | ExclamationToken<P> | null) {
  return children<P, NamedMemberSyntax<P>>(["name", "required", name], ["postfixToken", "nullable", postfix]);
}

function memberAsteriskSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null) {
  return children<P, MethodSyntax<P> | ConstructorDeclaration<P>>(["asteriskToken", "nullable", asterisk]);
}

function memberBodySlots<P extends Phase>(body: () => BlockOrExpression<P> | null) {
  return children<P, MethodSyntax<P> | ConstructorDeclaration<P>>(["body", "nullable", body]);
}

function propertyMemberSlots<P extends Phase>(type: () => TypeNode<P> | null, initializer: () => Expression<P> | null) {
  return children<P, PropertyDeclaration<P> | PropertySignatureDeclaration<P>>(["type", "nullable", type], ["initializer", "nullable", initializer]);
}

function staticBlockSlots<P extends Phase>(body: () => Block<P>) {
  return children<P, ClassStaticBlockDeclaration<P>>(["body", "required", body]);
}

function prepareDeclaration<P extends Phase, Stop>(node: DeclarationStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<DeclarationStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "ModuleBlock": {
      const stop = admitList("statements");
      if (stop !== null) return { kind: "refused", stop };
      const statements = heldList<P, Statement<P>>("statements", () => node.statements);
      return { kind: "copied", value: { kind: "module-block", ordinal, slots: statements.slots(), statements: statements.finish } };
    }
    case "HeritageClause": {
      const stop = admitList("types");
      if (stop !== null) return { kind: "refused", stop };
      const types = heldList<P, ExpressionWithTypeArguments<P>>("types", () => node.types);
      return { kind: "copied", value: { kind: "heritage", ordinal, slots: types.slots(), types: types.finish } };
    }
    case "CallSignature": case "ConstructSignature": {
      const signature = prepareSignatureStructure<P, Stop>(node, admitList);
      return signature.kind === "refused" ? signature : { kind: "copied", value: { kind: "bare-signature", ordinal, ...signature.value } };
    }
  }
  const rawModifiers = node.modifiers;
  if (rawModifiers !== null) {
    const stop = admitList("modifiers");
    if (stop !== null) return { kind: "refused", stop };
  }
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  if (node.kind === "IndexSignature" || node.kind === "Constructor" || node.kind === "MethodSignature" ||
    node.kind === "MethodDeclaration" || node.kind === "GetAccessor" || node.kind === "SetAccessor") {
    const signature = prepareSignatureStructure<P, Stop>(node, admitList);
    if (signature.kind === "refused") return signature;
    if (node.kind === "IndexSignature") return { kind: "copied", value: { kind: "modified-signature", ordinal,
      ...signature.value, modifiers: modifiers.finish, slots: prependSlots<P>(modifiers.slots(), signature.value.slots) } };
    if (node.kind === "Constructor") {
      const asterisk = heldChild(() => node.asteriskToken);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "constructor", ordinal, ...signature.value, modifiers: modifiers.finish,
        slots: declarationSlots<P>(modifiers.slots, () => signature.value.slots, () => memberAsteriskSlots<P>(asterisk.pull), () => memberBodySlots<P>(body.pull)),
        asterisk: asterisk.read, body: body.read } };
    }
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const member = () => memberNameSlots<P>(name.pull, postfix.pull);
    if (node.kind === "MethodSignature") return { kind: "copied", value: { kind: "method-signature", ordinal,
      ...signature.value, modifiers: modifiers.finish, slots: declarationSlots<P>(modifiers.slots, member, () => signature.value.slots),
      name: name.read, postfix: postfix.read } };
    const asterisk = heldChild(() => node.asteriskToken);
    const body = heldChild(() => node.body);
    return { kind: "copied", value: { kind: "method", ordinal, ...signature.value, modifiers: modifiers.finish,
      slots: declarationSlots<P>(modifiers.slots, () => memberAsteriskSlots<P>(asterisk.pull), member, () => signature.value.slots, () => memberBodySlots<P>(body.pull)),
      name: name.read, postfix: postfix.read, asterisk: asterisk.read, body: body.read } };
  }
  if (node.kind === "PropertySignature" || node.kind === "PropertyDeclaration") {
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const type = heldChild(() => node.type);
    const initializer = heldChild(() => node.initializer);
    return { kind: "copied", value: { kind: "property-member", ordinal, modifiers: modifiers.finish,
      slots: declarationSlots<P>(modifiers.slots, () => memberNameSlots<P>(name.pull, postfix.pull), () => propertyMemberSlots<P>(type.pull, initializer.pull)),
      name: name.read, postfix: postfix.read, type: type.read, initializer: initializer.read } };
  }
  if (node.kind === "ClassStaticBlockDeclaration") {
    const body = heldChild(() => node.body);
    return { kind: "copied", value: { kind: "static-block", ordinal, modifiers: modifiers.finish,
      slots: prependSlots<P>(modifiers.slots(), staticBlockSlots<P>(body.pull)), body: body.read } };
  }
  if (node.kind === "MissingDeclaration")
    return { kind: "copied", value: { kind: "missing-declaration", ordinal, slots: modifiers.slots(), modifiers: modifiers.finish } };
  if (node.kind === "EnumMember") {
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const initializer = heldChild(() => node.initializer);
    return { kind: "copied", value: { kind: "enum-member", ordinal,
      slots: declarationSlots<P>(modifiers.slots, () => enumMemberSlots<P>(name.pull, postfix.pull, initializer.pull)),
      modifiers: modifiers.finish, name: name.read, postfix: postfix.read, initializer: initializer.read } };
  }
  if (node.kind === "EnumDeclaration") {
    const stop = admitList("members");
    if (stop !== null) return { kind: "refused", stop };
    const name = heldChild(() => node.name);
    const members = heldList<P, EnumMember<P>>("members", () => node.members);
    return { kind: "copied", value: { kind: "enum", ordinal,
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), members.slots),
      modifiers: modifiers.finish, name: name.read, members: members.finish } };
  }
  const rawParameters = node.typeParameters;
  if (rawParameters !== null) {
    const stop = admitList("typeParameters");
    if (stop !== null) return { kind: "refused", stop };
  }
  const typeParameters = heldOptionalList<P, TypeParameterDeclaration<P>>("typeParameters", rawParameters);
  const common = { ordinal, modifiers: modifiers.finish, typeParameters: typeParameters.finish };
  if (node.kind === "TypeAliasDeclaration" || node.kind === "JSTypeAliasDeclaration") {
    const name = heldChild(() => node.name);
    const type = heldChild(() => node.type);
    return { kind: "copied", value: { ...common, kind: "type-alias",
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), typeParameters.slots, () => aliasTypeSlots<P>(type.pull)),
      name: name.read, type: type.read } };
  }
  if (node.kind !== "ClassDeclaration" && node.kind !== "ClassExpression" && node.kind !== "InterfaceDeclaration")
    return throwInvariant(missingStructure);
  const rawHeritage = node.heritageClauses;
  if (rawHeritage !== null) {
    const stop = admitList("heritageClauses");
    if (stop !== null) return { kind: "refused", stop };
  }
  const stop = admitList("members");
  if (stop !== null) return { kind: "refused", stop };
  const heritage = heldOptionalList<P, HeritageClause<P>>("heritageClauses", rawHeritage);
  const aggregate = { ...common, heritageClauses: heritage.finish };
  if (node.kind === "InterfaceDeclaration") {
    const name = heldChild(() => node.name);
    const members = heldList<P, TypeElement<P>>("members", () => node.members);
    return { kind: "copied", value: { ...aggregate, kind: "interface",
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), typeParameters.slots, heritage.slots, members.slots),
      name: name.read, members: members.finish } };
  }
  const name = heldChild(() => node.name);
  const members = heldList<P, ClassElement<P>>("members", () => node.members);
  return { kind: "copied", value: { ...aggregate, kind: "class",
    slots: declarationSlots<P>(modifiers.slots, () => classNameSlots<P>(name.pull), typeParameters.slots, heritage.slots, members.slots),
    name: name.read, members: members.finish } };
}

function unarySlots<P extends Phase>(operand: () => Expression<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, UnarySyntax<P>>(["operand", "required", operand]);
}

function prepareUnary<P extends Phase>(node: UnarySyntax<P>, ordinal: number): UnarySyntaxReceipt<P> {
  const operand = heldChild(() => node.operand);
  return { kind: "unary", ordinal, slots: unarySlots<P>(operand.pull), operand: operand.read };
}

function annotatedExpressionSlots<P extends Phase>(expression: () => Expression<P>, type: () => TypeNode<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, AnnotatedExpressionSyntax<P>>(["expression", "required", expression], ["type", "required", type]);
}

function prepareAnnotatedExpression<P extends Phase>(node: AnnotatedExpressionSyntax<P>, ordinal: number): AnnotatedExpressionSyntaxReceipt<P> {
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

function conditionalSlots<P extends Phase>(fields: ConditionalFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, ConditionalExpression<P>>(["condition", "required", fields.condition], ["questionToken", "required", fields.question],
    ["whenTrue", "required", fields.whenTrue], ["colonToken", "required", fields.colon], ["whenFalse", "required", fields.whenFalse]);
}

function prepareConditional<P extends Phase>(node: ConditionalExpression<P>, ordinal: number): ConditionalSyntaxReceipt<P> {
  const condition = heldChild(() => node.condition);
  const question = heldChild(() => node.questionToken);
  const whenTrue = heldChild(() => node.whenTrue);
  const colon = heldChild(() => node.colonToken);
  const whenFalse = heldChild(() => node.whenFalse);
  return { kind: "conditional", ordinal, slots: conditionalSlots<P>({
    condition: condition.pull, question: question.pull, whenTrue: whenTrue.pull, colon: colon.pull, whenFalse: whenFalse.pull,
  }), condition: condition.read, question: question.read, whenTrue: whenTrue.read, colon: colon.read, whenFalse: whenFalse.read };
}

function ifSlots<P extends Phase>(expression: () => Expression<P>, thenStatement: () => Statement<P>, elseStatement: () => Statement<P> | null):
  Iterable<SyntaxChildSlot<P>> {
  return children<P, IfStatement<P>>(["expression", "required", expression], ["thenStatement", "required", thenStatement],
    ["elseStatement", "nullable", elseStatement]);
}

function prepareIf<P extends Phase>(node: IfStatement<P>, ordinal: number): IfSyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const thenStatement = heldChild(() => node.thenStatement);
  const elseStatement = heldChild(() => node.elseStatement);
  return { kind: "if", ordinal, slots: ifSlots<P>(expression.pull, thenStatement.pull, elseStatement.pull),
    expression: expression.read, thenStatement: thenStatement.read, elseStatement: elseStatement.read };
}

function* propertySlots<P extends Phase>(fields: AccessSyntaxFields<P>, name: () => MemberName<P>): Generator<SyntaxChildSlot<P>> {
  yield* accessSlots<P>(fields);
  yield* children<P, PropertyAccessExpression<P>>(["name", "required", name]);
}

function* elementSlots<P extends Phase>(fields: AccessSyntaxFields<P>, argument: () => Expression<P>): Generator<SyntaxChildSlot<P>> {
  yield* accessSlots<P>(fields);
  yield* children<P, ElementAccessExpression<P>>(["argumentExpression", "required", argument]);
}

function accessSlots<P extends Phase>(fields: AccessSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, PropertyAccessExpression<P> | ElementAccessExpression<P>>(
    ["expression", "required", fields.expression], ["questionDotToken", "nullable", fields.questionDotToken]);
}

function prepareProperty<P extends Phase>(node: PropertyAccessExpression<P>, ordinal: number): PropertySyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const question = heldChild(() => node.questionDotToken);
  const name = heldChild(() => node.name);
  return { kind: "property-access", ordinal,
    slots: propertySlots<P>({ expression: expression.pull, questionDotToken: question.pull }, name.pull),
    expression: expression.read, questionDotToken: question.read, name: name.read };
}

function prepareElement<P extends Phase>(node: ElementAccessExpression<P>, ordinal: number): ElementSyntaxReceipt<P> {
  const expression = heldChild(() => node.expression);
  const question = heldChild(() => node.questionDotToken);
  const argument = heldChild(() => node.argumentExpression);
  return { kind: "element-access", ordinal,
    slots: elementSlots<P>({ expression: expression.pull, questionDotToken: question.pull }, argument.pull),
    expression: expression.read, questionDotToken: question.read, argument: argument.read };
}

function* arraySlots<P extends Phase>(node: ArrayLiteralExpression<P>,
  read: (field: "elements", list: NodeList<Expression<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* read("elements", node.elements);
}

function* objectSlots<P extends Phase>(node: ObjectLiteralExpression<P>,
  read: (field: "properties", list: NodeList<ObjectLiteralElementLike<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* read("properties", node.properties);
}

function prepareArray<P extends Phase>(node: ArrayLiteralExpression<P>, ordinal: number): ArraySyntaxReceipt<P> {
  let list: RetainedSyntaxList<Expression<P>> | undefined;
  let length = 0;
  const slots = arraySlots<P>(node, (field, raw) => readRetainedList<P, Expression<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "array-literal", ordinal, slots, elements: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

function prepareObject<P extends Phase>(node: ObjectLiteralExpression<P>, ordinal: number): ObjectSyntaxReceipt<P> {
  let list: RetainedSyntaxList<ObjectLiteralElementLike<P>> | undefined;
  let length = 0;
  const slots = objectSlots<P>(node, (field, raw) => readRetainedList<P, ObjectLiteralElementLike<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "object-literal", ordinal, slots, properties: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

function* variableStatementSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>,
  declarationList: () => VariableDeclarationList<P>): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, VariableStatement<P>>(["declarationList", "required", declarationList]);
}

function prepareVariableStatement<P extends Phase, Stop>(node: VariableStatement<P>, ordinal: number, admitModifiers: () => Stop | null):
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

function variableDeclarationSlots<P extends Phase>(fields: VariableDeclarationSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, VariableDeclaration<P>>(["name", "required", fields.name], ["exclamationToken", "nullable", fields.exclamationToken],
    ["type", "nullable", fields.type], ["initializer", "nullable", fields.initializer]);
}

function prepareVariableDeclaration<P extends Phase>(node: VariableDeclaration<P>, ordinal: number): VariableDeclarationSyntaxReceipt<P> {
  const name = heldChild(() => node.name);
  const exclamationToken = heldChild(() => node.exclamationToken);
  const type = heldChild(() => node.type);
  const initializer = heldChild(() => node.initializer);
  return { kind: "variable-declaration", ordinal, slots: variableDeclarationSlots<P>({
    name: name.pull, exclamationToken: exclamationToken.pull, type: type.pull, initializer: initializer.pull,
  }), name: name.read, exclamationToken: exclamationToken.read, type: type.read, initializer: initializer.read };
}

function* variableListSlots<P extends Phase>(node: VariableDeclarationList<P>,
  list: (field: "declarations", values: NodeList<VariableDeclaration<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* list("declarations", node.declarations);
}

function prepareVariableList<P extends Phase>(node: VariableDeclarationList<P>, ordinal: number): VariableListSyntaxReceipt<P> {
  let list: RetainedSyntaxList<VariableDeclaration<P>> | undefined;
  let length = 0;
  const slots = variableListSlots<P>(node, (field, raw) => readRetainedList<P, VariableDeclaration<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "variable-list", ordinal, slots, declarations: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

function* bindingPatternSlots<P extends Phase>(node: BindingPattern<P>,
  list: (field: "elements", values: NodeList<BindingElement<P>>) => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* list("elements", node.elements);
}

function prepareBindingPattern<P extends Phase>(node: BindingPattern<P>, ordinal: number): BindingPatternSyntaxReceipt<P> {
  let list: RetainedSyntaxList<BindingElement<P>> | undefined;
  let length = 0;
  const slots = bindingPatternSlots<P>(node, (field, raw) => readRetainedList<P, BindingElement<P>>(field, raw,
    (value, count) => { list = value; length = count; }));
  return { kind: "binding-pattern", ordinal, slots, elements: read => materializeList(requirePresent(list, missingStructure), length, read) };
}

function bindingElementSlots<P extends Phase>(fields: BindingElementSyntaxFields<P>): Iterable<SyntaxChildSlot<P>> {
  return children<P, BindingElement<P>>(["dotDotDotToken", "nullable", fields.dotDotDotToken], ["propertyName", "nullable", fields.propertyName],
    ["name", "nullable", fields.name], ["initializer", "nullable", fields.initializer]);
}

function prepareBindingElement<P extends Phase>(node: BindingElement<P>, ordinal: number): BindingElementSyntaxReceipt<P> {
  const dotDotDotToken = heldChild(() => node.dotDotDotToken);
  const propertyName = heldChild(() => node.propertyName);
  const name = heldChild(() => node.name);
  const initializer = heldChild(() => node.initializer);
  return { kind: "binding-element", ordinal, slots: bindingElementSlots<P>({
    dotDotDotToken: dotDotDotToken.pull, propertyName: propertyName.pull, name: name.pull, initializer: initializer.pull,
  }), dotDotDotToken: dotDotDotToken.read, propertyName: propertyName.read, name: name.read, initializer: initializer.read };
}

function* applicationSlots<P extends Phase>(node: CallOrNewExpression<P>,
  expression: (value: Expression<P>) => Expression<P>,
  questionDot: (value: QuestionDotToken<P> | null) => QuestionDotToken<P> | null,
  typeArguments: () => Iterable<SyntaxChildSlot<P>>, callArguments: () => Iterable<SyntaxChildSlot<P>>,
): Generator<SyntaxChildSlot<P>> {
  yield* children<P, typeof node>(["expression", "required", () => expression(node.expression)]);
  if (node.kind === "CallExpression") {
    yield* children<P, typeof node>(["questionDotToken", "nullable", () => questionDot(node.questionDotToken)]);
  }
  yield* typeArguments();
  yield* callArguments();
}

function prepareApplicationStructure<P extends Phase, Stop>(node: CallOrNewExpression<P>, ordinal: number,
  admitList: (field: "typeArguments" | "arguments") => Stop | null,
): SyntaxCopyResult<ApplicationSyntaxReceipt<P>, Stop> {
  const typeArguments = node.typeArguments;
  if (typeArguments !== null) {
    const stop = admitList("typeArguments");
    if (stop !== null) return { kind: "refused", stop };
  }
  let callArguments: NodeList<Expression<P>> | null;
  if (node.kind === "CallExpression") {
    const stop = admitList("arguments");
    if (stop !== null) return { kind: "refused", stop };
    callArguments = node.arguments;
  } else {
    callArguments = node.arguments;
    if (callArguments !== null) {
      const stop = admitList("arguments");
      if (stop !== null) return { kind: "refused", stop };
    }
  }
  let expression: Expression<P> | undefined;
  let questionDot: QuestionDotToken<P> | null = null;
  let types: RetainedSyntaxList<TypeNode<P>> | undefined;
  let values: RetainedSyntaxList<Expression<P>> | undefined;
  let typeCount = 0;
  let valueCount = 0;
  const slots = applicationSlots<P>(node, value => (expression = value), value => (questionDot = value),
    () => typeArguments === null ? [] : readRetainedList<P, TypeNode<P>>("typeArguments", typeArguments, (list, count) => {
      types = list;
      typeCount = count;
    }),
    () => callArguments === null ? [] : readRetainedList<P, Expression<P>>("arguments", callArguments, (list, count) => {
      values = list;
      valueCount = count;
    }));
  return { kind: "copied", value: { kind: "application", ordinal, header: syntaxHeader(node), slots,
    expression: () => requirePresent(expression, missingStructure), questionDotToken: () => questionDot,
    typeArguments: read => typeArguments === null ? null : materializeList(requirePresent(types, missingStructure), typeCount, read),
    arguments: read => callArguments === null ? null : materializeList(requirePresent(values, missingStructure), valueCount, read),
  } };
}

export const prepareSyntaxStructure: PrepareSyntaxStructure = <P extends Phase, Stop>(
  node: SyntaxNode<P>, ordinal: number, reserve: (node: RetainedSyntaxNode<P>) => Stop | null,
  admitList: (node: RetainedSyntaxNode<P>, field: SyntaxChildListField) => Stop | null,
) => {
  if (isTypeStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareTypeStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isExpressionStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareExpressionStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isModuleStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareModuleStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isJsxStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareJsxStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isDeclarationStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareDeclaration<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (node.kind !== "Block" && node.kind !== "BinaryExpression" && node.kind !== "ReturnStatement" &&
      node.kind !== "CallExpression" && node.kind !== "NewExpression" && node.kind !== "Parameter" &&
      node.kind !== "SourceFile" && node.kind !== "FunctionDeclaration" && node.kind !== "FunctionExpression" &&
      node.kind !== "PrefixUnaryExpression" && node.kind !== "PostfixUnaryExpression" && node.kind !== "AsExpression" &&
      node.kind !== "SatisfiesExpression" && node.kind !== "ConditionalExpression" && node.kind !== "IfStatement" &&
      node.kind !== "PropertyAccessExpression" && node.kind !== "ElementAccessExpression" &&
      node.kind !== "ArrayLiteralExpression" && node.kind !== "ObjectLiteralExpression" &&
      node.kind !== "VariableStatement" && node.kind !== "VariableDeclaration" && node.kind !== "VariableDeclarationList" &&
      node.kind !== "ObjectBindingPattern" && node.kind !== "ArrayBindingPattern" && node.kind !== "BindingElement" &&
      !isControlSyntax<P>(node) && !isSingleExpressionSyntax<P>(node))
    return { kind: "copied", value: null };
  const stop = reserve(node);
  if (stop !== null) return { kind: "refused", stop };
  if (node.kind === "Block") return { kind: "copied", value: prepareBlockStructure<P>(node, ordinal) };
  if (node.kind === "ReturnStatement") return { kind: "copied", value: prepareReturnStructure<P>(node, ordinal) };
  if (node.kind === "BinaryExpression") return prepareBinaryStructure<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "CallExpression" || node.kind === "NewExpression")
    return prepareApplicationStructure<P, Stop>(node, ordinal, field => admitList(node, field));
  if (node.kind === "Parameter") return prepareParameterStructure<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "SourceFile") {
    const listStop = admitList(node, "statements");
    return listStop === null ? { kind: "copied", value: prepareSourceFileStructure<P>(node, ordinal) } : { kind: "refused", stop: listStop };
  }
  if (node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression")
    return prepareFunctionStructure<P, Stop>(node, ordinal, field => admitList(node, field));
  if (node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") return { kind: "copied", value: prepareUnary<P>(node, ordinal) };
  if (node.kind === "AsExpression" || node.kind === "SatisfiesExpression") return { kind: "copied", value: prepareAnnotatedExpression<P>(node, ordinal) };
  if (node.kind === "ConditionalExpression") return { kind: "copied", value: prepareConditional<P>(node, ordinal) };
  if (node.kind === "IfStatement") return { kind: "copied", value: prepareIf<P>(node, ordinal) };
  if (node.kind === "PropertyAccessExpression") return { kind: "copied", value: prepareProperty<P>(node, ordinal) };
  if (node.kind === "ElementAccessExpression") return { kind: "copied", value: prepareElement<P>(node, ordinal) };
  if (node.kind === "ArrayLiteralExpression") {
    const list = admitList(node, "elements");
    return list === null ? { kind: "copied", value: prepareArray<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "ObjectLiteralExpression") {
    const list = admitList(node, "properties");
    return list === null ? { kind: "copied", value: prepareObject<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "VariableStatement") return prepareVariableStatement<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "VariableDeclaration") return { kind: "copied", value: prepareVariableDeclaration<P>(node, ordinal) };
  if (node.kind === "VariableDeclarationList") {
    const list = admitList(node, "declarations");
    return list === null ? { kind: "copied", value: prepareVariableList<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "ObjectBindingPattern" || node.kind === "ArrayBindingPattern") {
    const list = admitList(node, "elements");
    return list === null ? { kind: "copied", value: prepareBindingPattern<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "BindingElement") return { kind: "copied", value: prepareBindingElement<P>(node, ordinal) };
  if (isControlSyntax<P>(node)) return prepareControl<P, Stop>(node, ordinal, field => admitList(node, field));
  if (!isSingleExpressionSyntax<P>(node)) return throwInvariant(missingStructure);
  return { kind: "copied", value: prepareSingleExpression<P>(node, ordinal) };
};

export const iterateSourceFileHeaderSlots: IterateSourceFileHeaderSlots = function* <P extends Phase, Slot>(node: SourceFileHeader<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, statements: (field: "statements") => Iterable<Slot>) {
  yield* sourceFileFields<P, Slot>(ordinary, statements, () => node.endOfFileToken);
};

function* sourceFileFields<P extends Phase, Slot>(ordinary: (slot: SyntaxChildSlot<P>) => Slot,
  statements: (field: "statements") => Iterable<Slot>, endOfFileToken: () => EndOfFile<P>): Generator<Slot> {
  yield* statements("statements");
  yield ordinary({ fields: ["endOfFileToken"], read: endOfFileToken });
}

export const prepareSourceFileHeader: PrepareSourceFileHeader = <P extends Phase, Slot>(node: SourceFileHeader<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, statements: (field: "statements") => Iterable<Slot>,
): PreparedSourceFileHeader<P, Slot> => {
  const header = syntaxHeader(node);
  const { languageVariant, scriptKind, commentDirectives, pragmas, checkJsDirective } = node;
  let endOfFileToken: EndOfFile<P> | undefined;
  return {
    slots: sourceFileFields<P, Slot>(ordinary, statements, () => (endOfFileToken = node.endOfFileToken)),
    finish: (statements, endOfFile) => ({ ...header, statements,
      endOfFileToken: endOfFile(requirePresent(endOfFileToken, missingStructure)), languageVariant, scriptKind,
      commentDirectives, pragmas, checkJsDirective }),
  };
};

function prepareSourceFileStructure<P extends Phase>(node: SourceFile<P>, ordinal: number): SourceFileSyntaxReceipt<P> {
  let list: RetainedSyntaxList<Statement<P>> | undefined;
  let length = 0;
  const { slots, finish } = prepareSourceFileHeader<P, SyntaxChildSlot<P>>(node, sameSlot<P>,
    field => readRetainedList<P, Statement<P>>(field, node.statements, (admitted, count) => {
      list = admitted;
      length = count;
    }));
  return { kind: "source-header", ordinal, slots,
    finish: statement => finish(materializeList(requirePresent(list, missingStructure), length, statement), token => token) };
}

interface ParameterFields<P extends Phase> {
  readonly modifiers: () => Iterable<SyntaxChildSlot<P>>;
  readonly dots: () => DotDotDotToken<P> | null;
  readonly name: () => BindingName<P>;
  readonly question: () => QuestionToken<P> | null;
  readonly type: () => TypeNode<P> | null;
}

function* parameterFields<P extends Phase>(fields: ParameterFields<P>): Generator<SyntaxChildSlot<P>> {
  yield* fields.modifiers();
  yield* children<P, ParameterDeclaration<P>>(["dotDotDotToken", "nullable", fields.dots], ["name", "required", fields.name],
    ["questionToken", "nullable", fields.question], ["type", "nullable", fields.type]);
}

export const iterateParameterHeaderSlots: IterateParameterHeaderSlots = function* <P extends Phase, Slot>(node: ParameterDeclaration<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, initializer: (field: "initializer") => Iterable<Slot>) {
  for (const slot of parameterFields<P>({ modifiers: () => children<P, typeof node>(["modifiers", "list", () => node.modifiers]),
    dots: () => node.dotDotDotToken, name: () => node.name, question: () => node.questionToken, type: () => node.type })) yield ordinary(slot);
  yield* initializer("initializer");
};

function prepareParameterStructure<P extends Phase, Stop>(node: ParameterDeclaration<P>, ordinal: number, admitModifiers: () => Stop | null):
  SyntaxCopyResult<ParameterSyntaxReceipt<P>, Stop> {
  const modifiers = node.modifiers;
  const stop = modifiers === null ? null : admitModifiers();
  if (stop !== null) return { kind: "refused", stop };
  let list: RetainedSyntaxList<ModifierLike<P>> | undefined;
  let length = 0;
  let dots: DotDotDotToken<P> | null | undefined;
  let name: BindingName<P> | undefined;
  let question: QuestionToken<P> | null | undefined;
  let type: TypeNode<P> | null | undefined;
  const slots = parameterFields<P>({
    modifiers: () => modifiers === null ? [] : readRetainedList<P, ModifierLike<P>>("modifiers", modifiers, (admitted, count) => {
      list = admitted;
      length = count;
    }),
    dots: () => (dots = node.dotDotDotToken), name: () => (name = node.name),
    question: () => (question = node.questionToken), type: () => (type = node.type),
  });
  return { kind: "copied", value: { kind: "formal-header", ordinal, header: syntaxHeader(node), slots,
    modifiers: read => modifiers === null ? null : materializeList(requirePresent(list, missingStructure), length, read),
    dotDotDotToken: () => requirePresent(dots, missingStructure), name: () => requirePresent(name, missingStructure),
    questionToken: () => requirePresent(question, missingStructure), type: () => requirePresent(type, missingStructure),
  } };
}

export const iterateFunctionHeaderSlots: IterateFunctionHeaderSlots = function* <P extends Phase, Slot>(node: FunctionDeclarationHeader<P> | FunctionExpression<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, parameters: (field: "parameters") => Iterable<Slot>, body: (field: "body") => Iterable<Slot>) {
  yield* functionFields<P, Slot>(ordinary, parameters, body, {
    modifiers: () => children<P, typeof node>(["modifiers", "list", () => node.modifiers]),
    asterisk: () => node.asteriskToken, name: () => node.name,
    typeParameters: () => children<P, typeof node>(["typeParameters", "list", () => node.typeParameters]),
    type: () => node.type, fullSignature: () => node.fullSignature,
  });
};

interface FunctionHeaderFields<P extends Phase> {
  readonly modifiers: () => Iterable<SyntaxChildSlot<P>>;
  readonly asterisk: () => AsteriskToken<P> | null;
  readonly name: () => Identifier<P> | null;
  readonly typeParameters: () => Iterable<SyntaxChildSlot<P>>;
  readonly type: () => TypeNode<P> | null;
  readonly fullSignature: () => TypeNode<P> | null;
}

function* functionFields<P extends Phase, Slot>(ordinary: (slot: SyntaxChildSlot<P>) => Slot,
  parameters: (field: "parameters") => Iterable<Slot>, body: (field: "body") => Iterable<Slot>,
  fields: FunctionHeaderFields<P>): Generator<Slot> {
  for (const slot of fields.modifiers()) yield ordinary(slot);
  for (const slot of children<P, FunctionDeclarationHeader<P>>(["asteriskToken", "nullable", fields.asterisk],
    ["name", "nullable", fields.name])) yield ordinary(slot);
  for (const slot of fields.typeParameters()) yield ordinary(slot);
  yield* parameters("parameters");
  for (const slot of children<P, FunctionDeclarationHeader<P>>(["type", "nullable", fields.type], ["fullSignature", "nullable", fields.fullSignature]))
    yield ordinary(slot);
  yield* body("body");
}

export const prepareFunctionHeader: PrepareFunctionHeader = <P extends Phase, Slot, Stop>(node: FunctionDeclarationFields<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot, parameters: (field: "parameters") => Iterable<Slot>,
  body: (field: "body") => Iterable<Slot>, admitList: (field: "modifiers" | "typeParameters" | "parameters") => Stop | null,
): SyntaxCopyResult<PreparedFunctionHeader<P, Slot>, Stop> => {
  const modifiers = node.modifiers;
  const modifierStop = modifiers === null ? null : admitList("modifiers");
  if (modifierStop !== null) return { kind: "refused", stop: modifierStop };
  const typeParameters = node.typeParameters;
  const typeParameterStop = typeParameters === null ? null : admitList("typeParameters");
  if (typeParameterStop !== null) return { kind: "refused", stop: typeParameterStop };
  const parameterStop = admitList("parameters");
  if (parameterStop !== null) return { kind: "refused", stop: parameterStop };
  const header = syntaxHeader(node);
  let retainedModifiers: RetainedSyntaxList<ModifierLike<P>> | undefined;
  let modifierCount = 0;
  let retainedTypes: RetainedSyntaxList<TypeParameterDeclaration<P>> | undefined;
  let typeCount = 0;
  let asterisk: AsteriskToken<P> | null | undefined;
  let name: Identifier<P> | null | undefined;
  let type: TypeNode<P> | null | undefined;
  let fullSignature: TypeNode<P> | null | undefined;
  return { kind: "copied", value: {
    slots: functionFields<P, Slot>(ordinary, parameters, body, {
      modifiers: () => modifiers === null ? [] : readRetainedList<P, ModifierLike<P>>("modifiers", modifiers, (list, count) => {
        retainedModifiers = list;
        modifierCount = count;
      }),
      typeParameters: () => typeParameters === null ? [] : readRetainedList<P, TypeParameterDeclaration<P>>("typeParameters", typeParameters, (list, count) => {
        retainedTypes = list;
        typeCount = count;
      }),
      asterisk: () => (asterisk = node.asteriskToken), name: () => (name = node.name),
      type: () => (type = node.type), fullSignature: () => (fullSignature = node.fullSignature),
    }),
    finish: (parameters, body, modifier, parameter, typeImage, nameImage, asteriskImage) => {
      const sourceName = requirePresent(name, missingStructure);
      const sourceType = requirePresent(type, missingStructure);
      const sourceFullSignature = requirePresent(fullSignature, missingStructure);
      const sourceAsterisk = requirePresent(asterisk, missingStructure);
      return { ...header,
        modifiers: modifiers === null ? null : materializeList(requirePresent(retainedModifiers, missingStructure), modifierCount, modifier),
        typeParameters: typeParameters === null ? null : materializeList(requirePresent(retainedTypes, missingStructure), typeCount, parameter),
        parameters, type: sourceType === null ? null : typeImage(sourceType),
        fullSignature: sourceFullSignature === null ? null : typeImage(sourceFullSignature),
        asteriskToken: sourceAsterisk === null ? null : asteriskImage(sourceAsterisk),
        body, name: sourceName === null ? null : nameImage(sourceName) };
    },
  } };
};

function prepareFunctionStructure<P extends Phase, Stop>(node: FunctionDeclaration<P> | FunctionExpression<P>, ordinal: number,
  admitList: (field: "modifiers" | "typeParameters" | "parameters") => Stop | null,
): SyntaxCopyResult<FunctionSyntaxReceipt<P>, Stop> {
  let list: RetainedSyntaxList<ParameterDeclaration<P>> | undefined;
  let length = 0;
  let body: BlockOrExpression<P> | null | undefined;
  const prepared = prepareFunctionHeader<P, SyntaxChildSlot<P>, Stop>(node, sameSlot<P>,
    field => readRetainedList<P, ParameterDeclaration<P>>(field, node.parameters, (admitted, count) => {
      list = admitted;
      length = count;
    }),
    field => children<P, typeof node>([field, "nullable", () => (body = node.body)]), admitList);
  if (prepared.kind === "refused") return prepared;
  const { slots, finish } = prepared.value;
  return { kind: "copied", value: { kind: "function-header", ordinal, slots,
    finish: (formal, expression, modifier, typeParameter, type, name) => {
      const original = requirePresent(body, missingStructure);
      return finish(materializeList(requirePresent(list, missingStructure), length, formal),
        original === null ? null : expression(original), modifier, typeParameter, type, name, token => token);
    } } };
}

export const iterateChildrenOfSyntax: IterateChildrenOfSyntax = function* <PhaseType extends NullableInitializerPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxNode<PhaseType>, void, undefined> {
  for (const slot of iterateNullableSyntaxSlots(node)) yield slot.read();
};

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends NullableInitializerPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => [...iterateChildrenOfSyntax(node)];

export function syntaxChildEdges<PhaseType extends NullableInitializerPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxChild<PhaseType>[] {
  return [...iterateSyntaxChildEdges(node)];
}

export const iterateSyntaxChildEdges: IterateSyntaxChildEdges = function* <PhaseType extends NullableInitializerPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxChild<PhaseType>, void, undefined> {
  for (const slot of iterateNullableSyntaxSlots(node)) yield { node: slot.read(), fields: slot.fields };
};

export function iterateNullableSyntaxSlots<P extends NullableInitializerPhase<P>>(node: SyntaxNode<P>): Iterable<SyntaxChildSlot<P>> {
  return iterateSyntaxChildSlots<P, SyntaxChildSlot<P>>(node, sameSlot, function* (parameter, field) {
    const initializer = parameter.initializer;
    if (initializer !== null) yield { fields: [field], read: () => initializer };
  });
}

export const iterateSyntaxChildSlots: IterateSyntaxChildSlots = function* (node, ordinary, initializer) {
  if (node.kind === "Parameter") {
    yield* iterateParameterHeaderSlots(node, ordinary, field => initializer(node, field));
  } else {
    for (const slot of ordinarySlots(node)) yield ordinary(slot);
  }
};

function ordinarySlots<PhaseType extends Phase>(
  node: Exclude<SyntaxNode<PhaseType>, { readonly kind: "Parameter" }>,
): Iterable<SyntaxChildSlot<PhaseType>> {
  if (isSingleExpressionSyntax<PhaseType>(node)) return singleExpressionSlots<PhaseType>(node, child => child);
  switch (node.kind) {
    case "QualifiedName":
      return qualifiedNameSlots<PhaseType>(() => node.left, () => node.right);
    case "Decorator":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression]);
    case "ReturnStatement":
      return returnSlots<PhaseType>(node, child => child);
    case "IfStatement":
      return ifSlots<PhaseType>(() => node.expression, () => node.thenStatement, () => node.elseStatement);
    case "DoStatement":
    case "WhileStatement":
    case "WithStatement":
      return testedStatementSlots<PhaseType>(node.kind === "DoStatement", () => node.statement, () => node.expression);
    case "ForStatement":
      return forSlots<PhaseType>(() => node.initializer, () => node.condition, () => node.incrementor, () => node.statement);
    case "ForInStatement":
    case "ForOfStatement":
      return forInOrOfSlots<PhaseType>(() => node.awaitModifier, () => node.initializer, () => node.expression, () => node.statement);
    case "BreakStatement":
    case "ContinueStatement":
      return jumpSlots<PhaseType>(() => node.label);
    case "SwitchStatement":
      return switchSlots<PhaseType>(() => node.expression, () => node.caseBlock);
    case "CaseBlock":
      return children<PhaseType, typeof node>(["clauses", "list", () => node.clauses]);
    case "CaseClause":
    case "DefaultClause":
      return caseClauseSlots<PhaseType>(node, () => undefined,
        () => children<PhaseType, CaseClause<PhaseType> | DefaultClause<PhaseType>>(["statements", "list", () => node.statements]));
    case "TryStatement":
      return trySlots<PhaseType>(() => node.tryBlock, () => node.catchClause, () => node.finallyBlock);
    case "CatchClause":
      return catchSlots<PhaseType>(() => node.variableDeclaration, () => node.block);
    case "LabeledStatement":
      return labeledSlots<PhaseType>(() => node.label, () => node.statement);
    case "Block":
      return blockFields<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ModuleBlock":
      return children<PhaseType, typeof node>(["statements", "list", () => node.statements]);
    case "VariableStatement":
      return variableStatementSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.declarationList);
    case "VariableDeclaration":
      return variableDeclarationSlots<PhaseType>({ name: () => node.name, exclamationToken: () => node.exclamationToken,
        type: () => node.type, initializer: () => node.initializer });
    case "VariableDeclarationList":
      return variableListSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return bindingPatternSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "BindingElement":
      return bindingElementSlots<PhaseType>({ dotDotDotToken: () => node.dotDotDotToken, propertyName: () => node.propertyName,
        name: () => node.name, initializer: () => node.initializer });
    case "MissingDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return iterateFunctionHeaderSlots(node, sameSlot<PhaseType>,
        field => children<PhaseType, typeof node>([field, "list", () => node.parameters]),
        field => children<PhaseType, typeof node>([field, "nullable", () => node.body]));
    case "ClassDeclaration":
    case "ClassExpression":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => classNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["heritageClauses", "list", () => node.heritageClauses],
          ["members", "list", () => node.members]));
    case "InterfaceDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["heritageClauses", "list", () => node.heritageClauses],
          ["members", "list", () => node.members]));
    case "HeritageClause":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters]),
        () => aliasTypeSlots<PhaseType>(() => node.type));
    case "EnumMember":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => enumMemberSlots<PhaseType>(() => node.name, () => node.postfixToken, () => node.initializer));
    case "EnumDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["members", "list", () => node.members]));
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        importDeclarationSlots<PhaseType>(() => node.importClause, () => node.moduleSpecifier, () => node.attributes));
    case "NamespaceImport":
    case "NamespaceExport":
      return namespaceNameSlots<PhaseType>(() => node.name);
    case "JSDocNameReference":
      return children<PhaseType, typeof node>(["name", "required", () => node.name]);
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return children<PhaseType, typeof node>(["name", "nullable", () => node.name]);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "ExportAssignment":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        exportAssignmentSlots<PhaseType>(() => node.type, () => node.expression));
    case "NamespaceExportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), namespaceNameSlots<PhaseType>(() => node.name));
    case "ExportSpecifier":
    case "ImportSpecifier":
      return importExportSpecifierSlots<PhaseType>(() => node.propertyName, () => node.name);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return rawSignatureSlots<PhaseType>(node);
    case "FunctionType": case "ConstructorType": case "IndexSignature":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), rawSignatureSlots<PhaseType>(node));
    case "Constructor":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => rawSignatureSlots<PhaseType>(node),
        () => memberAsteriskSlots<PhaseType>(() => node.asteriskToken), () => memberBodySlots<PhaseType>(() => node.body));
    case "GetAccessor":
    case "SetAccessor":
    case "MethodDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => memberAsteriskSlots<PhaseType>(() => node.asteriskToken),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => rawSignatureSlots<PhaseType>(node), () => memberBodySlots<PhaseType>(() => node.body));
    case "MethodSignature":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => rawSignatureSlots<PhaseType>(node));
    case "PropertySignature":
    case "PropertyDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => propertyMemberSlots<PhaseType>(() => node.type, () => node.initializer));
    case "PropertyAssignment":
      return propertyAssignmentSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.name, () => node.postfixToken, () => node.type, initializerSlots<PhaseType>(() => node.initializer));
    case "ClassStaticBlockDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), staticBlockSlots<PhaseType>(() => node.body));
    case "BinaryExpression":
      return binaryFields<PhaseType>(node, () => node.modifiers, {
        modifiers: (field, list) => children<PhaseType, typeof node>([field, "list", () => list]),
        left: value => value, right: value => value, type: value => value, operator: value => value,
      });
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return unarySlots<PhaseType>(() => node.operand);
    case "YieldExpression":
      return yieldSlots<PhaseType>(() => node.asteriskToken, () => node.expression);
    case "ArrowFunction":
      return arrowSlots<PhaseType>(prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), rawSignatureSlots<PhaseType>(node)),
      () => node.asteriskToken, () => node.equalsGreaterThanToken, () => node.body);
    case "AsExpression":
    case "SatisfiesExpression":
      return annotatedExpressionSlots<PhaseType>(() => node.expression, () => node.type);
    case "ConditionalExpression":
      return conditionalSlots<PhaseType>({ condition: () => node.condition, question: () => node.questionToken, whenTrue: () => node.whenTrue,
        colon: () => node.colonToken, whenFalse: () => node.whenFalse });
    case "PropertyAccessExpression":
      return propertySlots<PhaseType>({ expression: () => node.expression, questionDotToken: () => node.questionDotToken }, () => node.name);
    case "ElementAccessExpression":
      return elementSlots<PhaseType>({ expression: () => node.expression, questionDotToken: () => node.questionDotToken }, () => node.argumentExpression);
    case "CallExpression":
    case "NewExpression":
      return applicationSlots<PhaseType>(node, value => value, value => value,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]),
        () => children<PhaseType, typeof node>(["arguments", "list", () => node.arguments]));
    case "MetaProperty":
      return metaPropertySlots<PhaseType>(() => node.name);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return templateHeadSlots<PhaseType>(() => node.head, () => children<PhaseType, typeof node>(["templateSpans", "list", () => node.templateSpans]));
    case "TemplateSpan":
      return templateSpanSlots<PhaseType>(() => node.expression, () => node.literal);
    case "TaggedTemplateExpression":
      return taggedTemplateSlots<PhaseType>(() => node.tag, () => node.questionDotToken,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]), () => node.template);
    case "ArrayLiteralExpression":
      return arraySlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ObjectLiteralExpression":
      return objectSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ShorthandPropertyAssignment":
      return propertyAssignmentSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.name, () => node.postfixToken, () => node.type, shorthandSlots<PhaseType>(() => node.equalsToken, () => node.objectAssignmentInitializer));
    case "TypeAssertionExpression":
      return assertionSlots<PhaseType>(() => node.type, () => node.expression);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "ConditionalType":
      return conditionalTypeSlots<PhaseType>(() => node.checkType, () => node.extendsType, () => node.trueType, () => node.falseType);
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
      return children<PhaseType, typeof node>(["type", "required", () => node.type]);
    case "TypeOperator":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return wrappedTypeSlots<PhaseType>(() => node.type);
    case "InferType":
      return inferTypeSlots<PhaseType>(() => node.typeParameter);
    case "ArrayType":
      return arrayTypeSlots<PhaseType>(() => node.elementType);
    case "IndexedAccessType":
      return indexedTypeSlots<PhaseType>(() => node.objectType, () => node.indexType);
    case "TypeReference":
      return namedTypeSlots<PhaseType>("typeName", () => node.typeName,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "ExpressionWithTypeArguments":
      return expressionArgumentsSlots<PhaseType>(() => node.expression, () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "LiteralType":
      return literalTypeSlots<PhaseType>(() => node.literal);
    case "TypePredicate":
      return typePredicateSlots<PhaseType>(() => node.assertsModifier, () => node.parameterName, () => node.type);
    case "ImportAttribute":
      return importAttributeSlots<PhaseType>(() => node.name, () => node.value);
    case "ImportAttributes":
      return children<PhaseType, typeof node>(["attributes", "list", () => node.attributes]);
    case "TypeQuery":
      return namedTypeSlots<PhaseType>("exprName", () => node.exprName,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "MappedType":
      return mappedTypeSlots<PhaseType>(() => node.readonlyToken, () => node.typeParameter, () => node.nameType, () => node.questionToken,
        () => node.type, () => children<PhaseType, typeof node>(["members", "list", () => node.members]));
    case "TypeLiteral":
      return children<PhaseType, typeof node>(["members", "list", () => node.members]);
    case "TupleType":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "NamedTupleMember":
      return namedTupleSlots<PhaseType>(() => node.dotDotDotToken, () => node.name, () => node.questionToken, () => node.type);
    case "TemplateLiteralTypeSpan":
      return templateTypeSpanSlots<PhaseType>(() => node.type, () => node.literal);
    case "JsxElement":
      return jsxElementSlots<PhaseType>(() => node.openingElement, () => children<PhaseType, typeof node>(["children", "list", () => node.children]), () => node.closingElement);
    case "JsxAttributes":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "JsxNamespacedName":
      return jsxNameSlots<PhaseType>(() => node.namespace, () => node.name);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return jsxOpeningSlots<PhaseType>(() => node.tagName, () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]), () => node.attributes);
    case "JsxFragment":
      return jsxFragmentSlots<PhaseType>(() => node.openingFragment, () => children<PhaseType, typeof node>(["children", "list", () => node.children]), () => node.closingFragment);
    case "JsxAttribute":
      return jsxAttributeSlots<PhaseType>(() => node.name, () => node.initializer);
    case "JsxClosingElement":
      return jsxTagSlots<PhaseType>(() => node.tagName);
    case "JsxExpression":
      return jsxExpressionSlots<PhaseType>(() => node.dotDotDotToken, () => node.expression);
    case "SyntaxList":
      return children<PhaseType, typeof node>(["children", "array", () => node.children]);
    case "JSDoc":
      return children<PhaseType, typeof node>(["comment", "list", () => node.comment], ["tags", "list", () => node.tags]);
    case "JSDocTypeTag":
    case "JSDocSatisfiesTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "required", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "JSDocReturnTag":
    case "JSDocThrowsTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "nullable", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["comment", "list", () => node.comment]);
    case "JSDocSeeTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["nameExpression", "required", () => node.nameExpression], ["comment", "list", () => node.comment]);
    case "JSDocTemplateTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["constraint", "required", () => node.constraint], ["typeParameters", "list", () => node.typeParameters], ["comment", "list", () => node.comment]);
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["className", "required", () => node.className], ["comment", "list", () => node.comment]);
    case "JSDocImportTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["importClause", "nullable", () => node.importClause], ["moduleSpecifier", "required", () => node.moduleSpecifier],
        ["attributes", "nullable", () => node.attributes], ["comment", "list", () => node.comment]);
    case "JSDocCallbackTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "required", () => node.typeExpression], ["name", "nullable", () => node.name], ["comment", "list", () => node.comment]);
    case "JSDocTypedefTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "nullable", () => node.typeExpression], ["name", "nullable", () => node.name], ["comment", "list", () => node.comment]);
    case "SourceFile":
      return iterateSourceFileHeaderSlots(node, sameSlot<PhaseType>, field => children<PhaseType, typeof node>([field, "list", () => node.statements]));
    case "ModuleDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        namespaceSlots<PhaseType>(() => node.asteriskToken, () => node.name, () => node.body));
    case "ImportEqualsDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        importEqualsSlots<PhaseType>(() => node.name, () => node.moduleReference));
    case "ExportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        exportDeclarationSlots<PhaseType>(() => node.exportClause, () => node.moduleSpecifier, () => node.attributes));
    case "ImportType":
      return prependSlots<PhaseType>(importTypeSlots<PhaseType>(() => node.argument, () => node.attributes, () => node.qualifier),
        children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "ImportClause":
      return importClauseSlots<PhaseType>(() => node.name, () => node.namedBindings);
    case "TypeParameter":
      return typeParameterSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => node.name,
        () => node.constraint, () => node.expression, () => node.defaultType);
    case "SyntheticReferenceExpression":
      return syntheticReferenceSlots<PhaseType>(() => node.expression, () => node.thisArg);
    case "JSDocTypeLiteral":
      return children<PhaseType, typeof node>(["jsDocPropertyTags", "array", () => node.jsDocPropertyTags]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["name", "required", () => node.name], ["typeExpression", "nullable", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "AnyKeyword":
    case "BigIntKeyword":
    case "BooleanKeyword":
    case "IntrinsicKeyword":
    case "NeverKeyword":
    case "NumberKeyword":
    case "ObjectKeyword":
    case "StringKeyword":
    case "SymbolKeyword":
    case "UndefinedKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
    case "NullKeyword":
    case "TrueKeyword":
    case "FalseKeyword":
    case "ThisKeyword":
    case "SuperKeyword":
    case "ImportKeyword":
    case "Unknown":
    case "EndOfFile":
    case "SingleLineCommentTrivia":
    case "MultiLineCommentTrivia":
    case "NewLineTrivia":
    case "WhitespaceTrivia":
    case "ConflictMarkerTrivia":
    case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces":
    case "OpenBraceToken":
    case "CloseBraceToken":
    case "OpenParenToken":
    case "CloseParenToken":
    case "OpenBracketToken":
    case "CloseBracketToken":
    case "DotToken":
    case "DotDotDotToken":
    case "SemicolonToken":
    case "CommaToken":
    case "QuestionDotToken":
    case "LessThanToken":
    case "LessThanSlashToken":
    case "GreaterThanToken":
    case "LessThanEqualsToken":
    case "GreaterThanEqualsToken":
    case "EqualsEqualsToken":
    case "ExclamationEqualsToken":
    case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken":
    case "EqualsGreaterThanToken":
    case "PlusToken":
    case "MinusToken":
    case "AsteriskToken":
    case "AsteriskAsteriskToken":
    case "SlashToken":
    case "PercentToken":
    case "PlusPlusToken":
    case "MinusMinusToken":
    case "LessThanLessThanToken":
    case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken":
    case "AmpersandToken":
    case "BarToken":
    case "CaretToken":
    case "ExclamationToken":
    case "TildeToken":
    case "AmpersandAmpersandToken":
    case "BarBarToken":
    case "QuestionToken":
    case "ColonToken":
    case "AtToken":
    case "QuestionQuestionToken":
    case "BacktickToken":
    case "HashToken":
    case "EqualsToken":
    case "PlusEqualsToken":
    case "MinusEqualsToken":
    case "AsteriskEqualsToken":
    case "AsteriskAsteriskEqualsToken":
    case "SlashEqualsToken":
    case "PercentEqualsToken":
    case "LessThanLessThanEqualsToken":
    case "GreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken":
    case "BarEqualsToken":
    case "BarBarEqualsToken":
    case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken":
    case "CaretEqualsToken":
    case "JSDocCommentTextToken":
    case "BreakKeyword":
    case "CaseKeyword":
    case "CatchKeyword":
    case "ClassKeyword":
    case "ConstKeyword":
    case "ContinueKeyword":
    case "DebuggerKeyword":
    case "DefaultKeyword":
    case "DeleteKeyword":
    case "DoKeyword":
    case "ElseKeyword":
    case "EnumKeyword":
    case "ExportKeyword":
    case "ExtendsKeyword":
    case "FinallyKeyword":
    case "ForKeyword":
    case "FunctionKeyword":
    case "IfKeyword":
    case "InKeyword":
    case "InstanceOfKeyword":
    case "NewKeyword":
    case "ReturnKeyword":
    case "SwitchKeyword":
    case "ThrowKeyword":
    case "TryKeyword":
    case "TypeOfKeyword":
    case "VarKeyword":
    case "WhileKeyword":
    case "WithKeyword":
    case "ImplementsKeyword":
    case "InterfaceKeyword":
    case "LetKeyword":
    case "PackageKeyword":
    case "PrivateKeyword":
    case "ProtectedKeyword":
    case "PublicKeyword":
    case "StaticKeyword":
    case "YieldKeyword":
    case "AbstractKeyword":
    case "AccessorKeyword":
    case "AsKeyword":
    case "AssertsKeyword":
    case "AssertKeyword":
    case "AsyncKeyword":
    case "AwaitKeyword":
    case "ConstructorKeyword":
    case "DeclareKeyword":
    case "GetKeyword":
    case "ImmediateKeyword":
    case "InferKeyword":
    case "IsKeyword":
    case "KeyOfKeyword":
    case "ModuleKeyword":
    case "NamespaceKeyword":
    case "OutKeyword":
    case "ReadonlyKeyword":
    case "RequireKeyword":
    case "SatisfiesKeyword":
    case "SetKeyword":
    case "TypeKeyword":
    case "UniqueKeyword":
    case "UsingKeyword":
    case "FromKeyword":
    case "GlobalKeyword":
    case "OverrideKeyword":
    case "OfKeyword":
    case "DeferKeyword":
    case "Identifier":
    case "PrivateIdentifier":
    case "EmptyStatement":
    case "DebuggerStatement":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "SemicolonClassElement":
    case "OmittedExpression":
    case "StringLiteral":
    case "NumericLiteral":
    case "BigIntLiteral":
    case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral":
    case "ThisType":
    case "TemplateHead":
    case "TemplateMiddle":
    case "TemplateTail":
    case "JsxText":
    case "JsxOpeningFragment":
    case "JsxClosingFragment":
    case "JSDocAllType":
    case "JSDocText":
      return emptyChildren;
  }
}
