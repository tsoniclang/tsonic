import {
  requirePresent,
} from "../diag/index.js";
import type {
  AsteriskToken, BindingName, BlockOrExpression, DotDotDotToken, EndOfFile, FunctionDeclaration,
  FunctionDeclarationFields, FunctionDeclarationHeader, FunctionExpression, FunctionSyntaxReceipt, Identifier,
  IterateFunctionHeaderSlots, IterateParameterHeaderSlots, IterateSourceFileHeaderSlots, ModifierLike,
  ParameterDeclaration, ParameterSyntaxReceipt, Phase, PrepareFunctionHeader, PrepareSourceFileHeader,
  PreparedFunctionHeader, PreparedSourceFileHeader, QuestionToken, SourceFile, SourceFileHeader,
  SourceFileSyntaxReceipt, Statement, SyntaxChildSlot, SyntaxCopyResult, TypeNode, TypeParameterDeclaration,
} from "./contract.js";
import { syntaxHeader } from "./copy-node.js";
import type { RetainedSyntaxList } from "./child-slot-storage.js";
import { children, materializeList, missingStructure, readRetainedList, sameSlot } from "./child-slot-storage.js";

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

export function prepareSourceFileStructure<P extends Phase>(node: SourceFile<P>, ordinal: number): SourceFileSyntaxReceipt<P> {
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

export function prepareParameterStructure<P extends Phase, Stop>(node: ParameterDeclaration<P>, ordinal: number, admitModifiers: () => Stop | null):
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

export function prepareFunctionStructure<P extends Phase, Stop>(node: FunctionDeclaration<P> | FunctionExpression<P>, ordinal: number,
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
