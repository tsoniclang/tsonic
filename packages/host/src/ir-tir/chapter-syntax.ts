import { requirePresent } from "../diag/index.js";
import { decodeBodyId } from "../ids/index.js";
import type { InvariantFailure } from "../diag/contract.js";
import type { NodeList, SyntaxChildSlot } from "../ir-hir/contract.js";
import { iterateFunctionHeaderSlots, iterateSourceFileHeaderSlots, iterateSyntaxChildSlots, unparenthesizedExpression } from "../ir-hir/index.js";
import type { LayoutBindingOf, LayoutObservationOf, RawValueTypeOf } from "./contract.js";
import type { IsLayoutOperandBody, LayoutArgumentSlots, TirLayoutArguments, TirLayoutArgumentSlot, TirTypedSyntax } from "./contract.js";
import type { AdmitFormalInitializer, BodyOccurrenceSlots, ChapterStatementSyntax, ChapterSyntaxSlots, FormalInitializerSlot, FormalInitializerSyntax, IndexChapterSyntax, ReadChapterSyntaxSlot, TirBodySyntaxOf, TirChapterSyntax, TirChapterSyntaxSlot, TirFormalInitializer, TirFormalInitializerRead, TirModuleStatement, TypedPhase } from "./contract.js";

const missingChild: InvariantFailure = { owner: "ir-tir", query: null, origin: null,
  message: "An authored chapter role must retain its actual dense child vector." };

export const layoutBindingOf: LayoutBindingOf = initializer => {
  if (initializer === null) return null;
  const expression = unparenthesizedExpression<TypedPhase>(initializer);
  if (expression.kind !== "CallExpression" || !("layout" in expression.tsonic)) return null;
  const selected = expression.tsonic;
  return selected.layout === "value-layout" || selected.layout === "array-layout" || selected.layout === "field-layout" ? selected : null;
};

export const layoutObservationOf: LayoutObservationOf = node => {
  if (node.kind !== "CallExpression" || !("layout" in node.tsonic)) return null;
  const selected = node.tsonic;
  return selected.layout === "size" || selected.layout === "alignment" || selected.layout === "stride"
    || selected.layout === "field-offset" ? selected : null;
};

export const rawValueTypeOf: RawValueTypeOf = payload =>
  payload.narrowing !== null && payload.narrowing.kind === "narrowed" ? payload.narrowing.source : payload.type;

export const isLayoutOperandBody: IsLayoutOperandBody = body => {
  const decoded = decodeBodyId(body);
  return decoded.kind === "decoded" && decoded.value.role === "layout-operand";
};

function ordinarySlot(slot: SyntaxChildSlot<TypedPhase>): TirChapterSyntaxSlot {
  return { kind: "syntax", fields: slot.fields, read: () => {
    const node = slot.read();
    return node.kind === "Parameter" ? { kind: "formal", node } : { kind: "ordinary", node };
  } };
}

function* listSlots<Value>(field: string, list: NodeList<Value>, select: (value: Value) => TirChapterSyntax): Generator<TirChapterSyntaxSlot> {
  const nodes = list.nodes;
  const length = nodes.length;
  for (let index = 0; index < length; index += 1) {
    const position = index;
    yield { kind: "syntax", fields: [field, "nodes", position], read: () => select(requirePresent(nodes[position], missingChild)) };
  }
}

export const chapterStatementSyntax: ChapterStatementSyntax = statement => {
  if (statement.kind === "checked-declaration") return { kind: "checked", node: statement.node };
  if (statement.kind === "ready-callable") return { kind: "ready-callable", node: statement.node };
  return { kind: "ordinary", node: statement.node };
};

function* moduleStatements(field: "statements", list: NodeList<TirModuleStatement>): Generator<TirChapterSyntaxSlot> {
  const nodes = list.nodes;
  const length = nodes.length;
  for (let index = 0; index < length; index += 1) {
    const position = index;
    yield { kind: "statement", fields: [field, "nodes", position], read: () => requirePresent(nodes[position], missingChild) };
  }
}

export const formalInitializerSlot: FormalInitializerSlot = node =>
  ({ kind: "formal-initializer", fields: ["initializer"], read: () => {
    const actual = node.initializer;
    switch (actual.kind) {
      case "none": return { kind: "none" };
      case "checked-default": return { kind: "checked-default", root: () => actual.root };
      case "ready-default": return { kind: "ready-default", root: () => actual.root };
    }
  } });

function readInitializer(initializer: TirFormalInitializerRead): TirFormalInitializer {
  if (initializer.kind === "none") return initializer;
  return initializer.kind === "checked-default"
    ? { kind: "checked-default", root: initializer.root() } : { kind: "ready-default", root: initializer.root() };
}

export const admitFormalInitializer: AdmitFormalInitializer = (slot, field, edge) => {
  const admitted = field();
  if (admitted !== null) return { kind: "refused", stop: admitted };
  const initializer = slot.read();
  const read = initializer.kind === "none" ? null : edge();
  if (read !== null) return { kind: "refused", stop: read };
  return { kind: "complete", value: readInitializer(initializer) };
};

export const formalInitializerSyntax: FormalInitializerSyntax = initializer => {
  switch (initializer.kind) {
    case "none": return null;
    case "checked-default": return { kind: "checked", node: initializer.root };
    case "ready-default": return { kind: "ordinary", node: initializer.root };
  }
};

function layoutDescriptorSlot(arguments_: TirLayoutArguments): TirLayoutArgumentSlot {
  return { kind: "layout-descriptor", fields: ["arguments", "descriptor"], read: () => arguments_.descriptor };
}

export const layoutArgumentSlots: LayoutArgumentSlots = function* (arguments_) {
  yield layoutDescriptorSlot(arguments_);
  const operands = arguments_.operands;
  for (let position = 0; position < operands.length; position += 1) {
    const index = position;
    yield { kind: "layout-operand", fields: ["arguments", "operands", index],
      read: () => requirePresent(operands[index], missingChild) };
  }
};

export const readChapterSyntaxSlot: ReadChapterSyntaxSlot = slot => {
  switch (slot.kind) {
    case "syntax": return slot.read();
    case "statement": return chapterStatementSyntax(slot.read());
    case "formal-initializer": return formalInitializerSyntax(readInitializer(slot.read()));
    case "layout-descriptor": return { kind: "checked", node: slot.read() };
    case "layout-operand": return { kind: "ordinary", node: slot.read().root };
  }
};

function* syntaxSlots(subject: TirTypedSyntax, layout: LayoutArgumentSlots): Generator<TirChapterSyntaxSlot> {
  switch (subject.kind) {
    case "ordinary":
    case "formal":
      yield* iterateSyntaxChildSlots<TypedPhase, TirChapterSyntaxSlot>(subject.node, ordinarySlot,
        parameter => [formalInitializerSlot(parameter)], (call, field) => {
          const arguments_ = call.arguments;
          return "kind" in arguments_ ? layout(arguments_) : listSlots(field, arguments_, node => ({ kind: "ordinary", node }));
        });
      return;
    case "module-root":
      yield* iterateSourceFileHeaderSlots<TypedPhase, TirChapterSyntaxSlot>(subject.node, ordinarySlot,
        field => moduleStatements(field, subject.node.statements));
      return;
    case "ready-callable":
      yield* iterateFunctionHeaderSlots<TypedPhase, TirChapterSyntaxSlot>(subject.node, ordinarySlot,
        field => listSlots(field, subject.node.parameters, node => ({ kind: "formal", node })),
        field => [{ kind: "syntax", fields: [field], read: () => ({ kind: "ordinary", node: subject.node.body }) }]);
      return;
  }
}

export const chapterSyntaxSlots: ChapterSyntaxSlots = subject => syntaxSlots(subject, args => [layoutDescriptorSlot(args)]);
export const chapterTransportSlots: ChapterSyntaxSlots = subject => syntaxSlots(subject, layoutArgumentSlots);

export const tirBodySyntaxOf: TirBodySyntaxOf = node =>
  node.kind === "SourceFile" ? { kind: "module-root", node } : { kind: "ordinary", node };

export const indexChapterSyntax: IndexChapterSyntax = function* (roots, slots) {
  const seen = new Set<object>();
  for (const root of roots) {
    if (seen.has(root.node)) continue;
    seen.add(root.node);
    yield root;
    if (root.kind === "checked") continue;
    const stack: Iterator<TirChapterSyntaxSlot>[] = [slots(root)[Symbol.iterator]()];
    for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
      const next = frame.next();
      if (next.done) continue;
      stack.push(frame);
      const child = readChapterSyntaxSlot(next.value);
      if (child === null || seen.has(child.node)) continue;
      seen.add(child.node);
      yield child;
      if (child.kind !== "checked") stack.push(slots(child)[Symbol.iterator]());
    }
  }
};

export const bodyOccurrenceSlots: BodyOccurrenceSlots = function* (subject, containsNested) {
  const node = subject.node;
  if (subject.kind === "ordinary" && subject.node.kind === "CallExpression" && "layout" in subject.node.tsonic) return;
  const annotation = node.tsonic;
  const template = annotation !== null && "callable" in annotation ? annotation.callable.template
    : annotation !== null && "template" in annotation ? annotation.template : null;
  const detached = template !== null && containsNested(template.body);
  const initializes = annotation !== null && "initializer" in annotation && annotation.initializer !== null;
  for (const slot of chapterSyntaxSlots(subject)) {
    const field = slot.fields[0];
    if (field === "parameters" && "parameters" in node && "body" in node
      || field === "body" && detached || field === "initializer" && initializes) {
      yield { kind: "syntax", fields: slot.fields, read: () => null };
    } else yield slot;
  }
};
