import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { ChildrenOfSyntax, IterateChildrenOfSyntax, IterateSyntaxChildEdges, NullableInitializerPhase, Phase, SyntaxNode, NodeList, SyntaxChild } from "./contract.js";
import type { IterateFunctionHeaderSlots, IterateParameterHeaderSlots, IterateSourceFileHeaderSlots, IterateSyntaxChildSlots,
  AsteriskToken, EndOfFile, FunctionDeclaration, FunctionDeclarationFields, FunctionDeclarationHeader, FunctionExpression, Identifier, ParameterDeclaration,
  PreparedFunctionHeader, PreparedSourceFileHeader, PrepareFunctionHeader, PrepareSourceFileHeader, SourceFileHeader,
  SyntaxChildSlot, TypeParameterDeclaration } from "./contract.js";
import type { ApplicationSyntaxReceipt, BinaryExpression, BinaryOperatorToken, BinarySyntaxReceipt, Block, BlockSyntaxReceipt,
  BindingName, BlockOrExpression, CallOrNewExpression, DotDotDotToken, Expression, FunctionSyntaxReceipt,
  ModifierLike, ModifierList, ParameterSyntaxReceipt, SourceFile, SourceFileSyntaxReceipt, SyntaxChildListField,
  PrepareSyntaxStructure, QuestionDotToken, QuestionToken, RetainedSyntaxNode,
  ReturnStatement, ReturnSyntaxReceipt, SingleExpressionReceipt, SingleExpressionSyntax,
  Statement, SyntaxCopyResult, TextRange, TypeNode } from "./contract.js";
import { syntaxHeader } from "./copy-node.js";
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
  if (node.kind !== "Block" && node.kind !== "BinaryExpression" && node.kind !== "ReturnStatement" &&
      node.kind !== "CallExpression" && node.kind !== "NewExpression" && node.kind !== "Parameter" &&
      node.kind !== "SourceFile" && node.kind !== "FunctionDeclaration" && node.kind !== "FunctionExpression" && !isSingleExpressionSyntax<P>(node))
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
      return children<PhaseType, typeof node>(["left", "required", () => node.left], ["right", "required", () => node.right]);
    case "Decorator":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression]);
    case "ReturnStatement":
      return returnSlots<PhaseType>(node, child => child);
    case "IfStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["thenStatement", "required", () => node.thenStatement], ["elseStatement", "nullable", () => node.elseStatement]);
    case "DoStatement":
      return children<PhaseType, typeof node>(["statement", "required", () => node.statement], ["expression", "required", () => node.expression]);
    case "WhileStatement":
    case "WithStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["statement", "required", () => node.statement]);
    case "ForStatement":
      return children<PhaseType, typeof node>(["initializer", "nullable", () => node.initializer], ["condition", "nullable", () => node.condition], ["incrementor", "nullable", () => node.incrementor], ["statement", "required", () => node.statement]);
    case "ForInStatement":
    case "ForOfStatement":
      return children<PhaseType, typeof node>(["awaitModifier", "nullable", () => node.awaitModifier], ["initializer", "required", () => node.initializer], ["expression", "required", () => node.expression], ["statement", "required", () => node.statement]);
    case "BreakStatement":
    case "ContinueStatement":
      return children<PhaseType, typeof node>(["label", "nullable", () => node.label]);
    case "SwitchStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["caseBlock", "required", () => node.caseBlock]);
    case "CaseBlock":
      return children<PhaseType, typeof node>(["clauses", "list", () => node.clauses]);
    case "CaseClause":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["statements", "list", () => node.statements]);
    case "DefaultClause":
      return children<PhaseType, typeof node>(["expression", "nullable", () => node.expression], ["statements", "list", () => node.statements]);
    case "TryStatement":
      return children<PhaseType, typeof node>(["tryBlock", "required", () => node.tryBlock], ["catchClause", "nullable", () => node.catchClause], ["finallyBlock", "nullable", () => node.finallyBlock]);
    case "CatchClause":
      return children<PhaseType, typeof node>(["variableDeclaration", "nullable", () => node.variableDeclaration], ["block", "required", () => node.block]);
    case "LabeledStatement":
      return children<PhaseType, typeof node>(["label", "required", () => node.label], ["statement", "required", () => node.statement]);
    case "Block":
      return blockFields<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ModuleBlock":
      return children<PhaseType, typeof node>(["statements", "list", () => node.statements]);
    case "VariableStatement":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["declarationList", "required", () => node.declarationList]);
    case "VariableDeclaration":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["exclamationToken", "nullable", () => node.exclamationToken], ["type", "nullable", () => node.type], ["initializer", "nullable", () => node.initializer]);
    case "VariableDeclarationList":
      return children<PhaseType, typeof node>(["declarations", "list", () => node.declarations]);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "BindingElement":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["propertyName", "nullable", () => node.propertyName], ["name", "nullable", () => node.name], ["initializer", "nullable", () => node.initializer]);
    case "MissingDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return iterateFunctionHeaderSlots(node, sameSlot<PhaseType>,
        field => children<PhaseType, typeof node>([field, "list", () => node.parameters]),
        field => children<PhaseType, typeof node>([field, "nullable", () => node.body]));
    case "ClassDeclaration":
    case "ClassExpression":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "nullable", () => node.name], ["typeParameters", "list", () => node.typeParameters],
        ["heritageClauses", "list", () => node.heritageClauses], ["members", "list", () => node.members]);
    case "InterfaceDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["typeParameters", "list", () => node.typeParameters],
        ["heritageClauses", "list", () => node.heritageClauses], ["members", "list", () => node.members]);
    case "HeritageClause":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["typeParameters", "list", () => node.typeParameters], ["type", "required", () => node.type]);
    case "EnumMember":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["initializer", "nullable", () => node.initializer]);
    case "EnumDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["members", "list", () => node.members]);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["importClause", "nullable", () => node.importClause], ["moduleSpecifier", "required", () => node.moduleSpecifier], ["attributes", "nullable", () => node.attributes]);
    case "NamespaceImport":
    case "NamespaceExport":
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
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["type", "nullable", () => node.type], ["expression", "required", () => node.expression]);
    case "NamespaceExportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name]);
    case "ExportSpecifier":
    case "ImportSpecifier":
      return children<PhaseType, typeof node>(["propertyName", "nullable", () => node.propertyName], ["name", "required", () => node.name]);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "FunctionType":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "Constructor":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters],
        ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["asteriskToken", "nullable", () => node.asteriskToken], ["body", "nullable", () => node.body]);
    case "GetAccessor":
    case "SetAccessor":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["body", "nullable", () => node.body]);
    case "IndexSignature":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "MethodSignature":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "MethodDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["body", "nullable", () => node.body]);
    case "PropertySignature":
    case "PropertyDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type], ["initializer", "nullable", () => node.initializer]);
    case "PropertyAssignment":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type], ["initializer", "required", () => node.initializer]);
    case "ClassStaticBlockDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["body", "required", () => node.body]);
    case "BinaryExpression":
      return binaryFields<PhaseType>(node, () => node.modifiers, {
        modifiers: (field, list) => children<PhaseType, typeof node>([field, "list", () => list]),
        left: value => value, right: value => value, type: value => value, operator: value => value,
      });
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return children<PhaseType, typeof node>(["operand", "required", () => node.operand]);
    case "YieldExpression":
      return children<PhaseType, typeof node>(["asteriskToken", "nullable", () => node.asteriskToken], ["expression", "nullable", () => node.expression]);
    case "ArrowFunction":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters],
        ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["asteriskToken", "nullable", () => node.asteriskToken], ["equalsGreaterThanToken", "required", () => node.equalsGreaterThanToken], ["body", "nullable", () => node.body]);
    case "AsExpression":
    case "SatisfiesExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["type", "required", () => node.type]);
    case "ConditionalExpression":
      return children<PhaseType, typeof node>(["condition", "required", () => node.condition], ["questionToken", "required", () => node.questionToken], ["whenTrue", "required", () => node.whenTrue], ["colonToken", "required", () => node.colonToken], ["whenFalse", "required", () => node.whenFalse]);
    case "PropertyAccessExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["questionDotToken", "nullable", () => node.questionDotToken], ["name", "required", () => node.name]);
    case "ElementAccessExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["questionDotToken", "nullable", () => node.questionDotToken], ["argumentExpression", "required", () => node.argumentExpression]);
    case "CallExpression":
    case "NewExpression":
      return applicationSlots<PhaseType>(node, value => value, value => value,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]),
        () => children<PhaseType, typeof node>(["arguments", "list", () => node.arguments]));
    case "MetaProperty":
      return children<PhaseType, typeof node>(["name", "required", () => node.name]);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return children<PhaseType, typeof node>(["head", "required", () => node.head], ["templateSpans", "list", () => node.templateSpans]);
    case "TemplateSpan":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["literal", "required", () => node.literal]);
    case "TaggedTemplateExpression":
      return children<PhaseType, typeof node>(["tag", "required", () => node.tag], ["questionDotToken", "nullable", () => node.questionDotToken], ["typeArguments", "list", () => node.typeArguments], ["template", "required", () => node.template]);
    case "ArrayLiteralExpression":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "ObjectLiteralExpression":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "ShorthandPropertyAssignment":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type],
        ["equalsToken", "nullable", () => node.equalsToken], ["objectAssignmentInitializer", "nullable", () => node.objectAssignmentInitializer]);
    case "TypeAssertionExpression":
      return children<PhaseType, typeof node>(["type", "required", () => node.type], ["expression", "required", () => node.expression]);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "ConditionalType":
      return children<PhaseType, typeof node>(["checkType", "required", () => node.checkType], ["extendsType", "required", () => node.extendsType], ["trueType", "required", () => node.trueType], ["falseType", "required", () => node.falseType]);
    case "TypeOperator":
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return children<PhaseType, typeof node>(["type", "required", () => node.type]);
    case "InferType":
      return children<PhaseType, typeof node>(["typeParameter", "required", () => node.typeParameter]);
    case "ArrayType":
      return children<PhaseType, typeof node>(["elementType", "required", () => node.elementType]);
    case "IndexedAccessType":
      return children<PhaseType, typeof node>(["objectType", "required", () => node.objectType], ["indexType", "required", () => node.indexType]);
    case "TypeReference":
      return children<PhaseType, typeof node>(["typeName", "required", () => node.typeName], ["typeArguments", "list", () => node.typeArguments]);
    case "ExpressionWithTypeArguments":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["typeArguments", "list", () => node.typeArguments]);
    case "LiteralType":
      return children<PhaseType, typeof node>(["literal", "required", () => node.literal]);
    case "TypePredicate":
      return children<PhaseType, typeof node>(["assertsModifier", "nullable", () => node.assertsModifier], ["parameterName", "required", () => node.parameterName], ["type", "nullable", () => node.type]);
    case "ImportAttribute":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["value", "required", () => node.value]);
    case "ImportAttributes":
      return children<PhaseType, typeof node>(["attributes", "list", () => node.attributes]);
    case "TypeQuery":
      return children<PhaseType, typeof node>(["exprName", "required", () => node.exprName], ["typeArguments", "list", () => node.typeArguments]);
    case "MappedType":
      return children<PhaseType, typeof node>(["readonlyToken", "nullable", () => node.readonlyToken], ["typeParameter", "required", () => node.typeParameter], ["nameType", "nullable", () => node.nameType],
        ["questionToken", "nullable", () => node.questionToken], ["type", "nullable", () => node.type], ["members", "list", () => node.members]);
    case "TypeLiteral":
      return children<PhaseType, typeof node>(["members", "list", () => node.members]);
    case "TupleType":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "NamedTupleMember":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["name", "required", () => node.name], ["questionToken", "nullable", () => node.questionToken], ["type", "required", () => node.type]);
    case "ConstructorType":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "TemplateLiteralTypeSpan":
      return children<PhaseType, typeof node>(["type", "required", () => node.type], ["literal", "required", () => node.literal]);
    case "JsxElement":
      return children<PhaseType, typeof node>(["openingElement", "required", () => node.openingElement], ["children", "list", () => node.children], ["closingElement", "required", () => node.closingElement]);
    case "JsxAttributes":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "JsxNamespacedName":
      return children<PhaseType, typeof node>(["namespace", "required", () => node.namespace], ["name", "required", () => node.name]);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeArguments", "list", () => node.typeArguments], ["attributes", "required", () => node.attributes]);
    case "JsxFragment":
      return children<PhaseType, typeof node>(["openingFragment", "required", () => node.openingFragment], ["children", "list", () => node.children], ["closingFragment", "required", () => node.closingFragment]);
    case "JsxAttribute":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["initializer", "nullable", () => node.initializer]);
    case "JsxClosingElement":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName]);
    case "JsxExpression":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["expression", "nullable", () => node.expression]);
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
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["body", "nullable", () => node.body]);
    case "ImportEqualsDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["moduleReference", "required", () => node.moduleReference]);
    case "ExportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["exportClause", "nullable", () => node.exportClause], ["moduleSpecifier", "nullable", () => node.moduleSpecifier], ["attributes", "nullable", () => node.attributes]);
    case "ImportType":
      return children<PhaseType, typeof node>(["argument", "required", () => node.argument], ["attributes", "nullable", () => node.attributes], ["qualifier", "nullable", () => node.qualifier], ["typeArguments", "list", () => node.typeArguments]);
    case "ImportClause":
      return children<PhaseType, typeof node>(["name", "nullable", () => node.name], ["namedBindings", "nullable", () => node.namedBindings]);
    case "TypeParameter":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["constraint", "nullable", () => node.constraint], ["expression", "nullable", () => node.expression], ["defaultType", "nullable", () => node.defaultType]);
    case "SyntheticReferenceExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["thisArg", "required", () => node.thisArg]);
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
