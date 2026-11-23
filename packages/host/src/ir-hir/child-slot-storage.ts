import type { InvariantFailure } from "../diag/contract.js";
import {
  requirePresent, throwInvariant,
} from "../diag/index.js";
import type {
  NodeList, Phase, SyntaxChildSlot, SyntaxNode, TextRange,
} from "./contract.js";

export const emptyChildren: readonly never[] = [];

export function sameSlot<P extends Phase>(slot: SyntaxChildSlot<P>): SyntaxChildSlot<P> {
  return slot;
}

const missingChild: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A syntax list must retain its actual dense child vector." };
export const missingStructure: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
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

export type ExactPart<Node> = {
  [Field in keyof Node & string]: {
    [Kind in SlotKind]: [FieldKinds<Node, Field>] extends [Kind] ? readonly [Field, Kind, () => Node[Field]] : never
  }[SlotKind]
}[keyof Node & string];

export function* children<PhaseType extends Phase, Node>(
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

export interface RetainedSyntaxList<Value> {
  readonly loc: TextRange;
  readonly nodes: Value[];
}

export function* readRetainedList<P extends Phase, Value extends SyntaxNode<P>>(field: string, list: NodeList<Value>,
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

export function materializeList<Value>(list: RetainedSyntaxList<Value>, count: number, image: (node: Value) => Value): NodeList<Value> {
  if (list.nodes.length !== count) return throwInvariant(missingStructure);
  for (let position = 0; position < list.nodes.length; position += 1)
    list.nodes[position] = image(requirePresent(list.nodes[position], missingStructure));
  return list;
}

export function heldChild<Value>(source: () => Value): { readonly pull: () => Value; readonly read: () => Value } {
  let held: Value | undefined;
  return { pull: () => (held = source()), read: () => requirePresent(held, missingStructure) };
}

export function heldList<P extends Phase, Value extends SyntaxNode<P>>(field: string, source: () => NodeList<Value>) {
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

export function heldOptionalList<P extends Phase, Value extends SyntaxNode<P>>(field: string, source: NodeList<Value> | null) {
  const present = source === null ? null : heldList<P, Value>(field, () => source);
  return { slots: () => present?.slots() ?? [], finish: (read: (node: Value) => Value) => present?.finish(read) ?? null };
}

export function heldVector<P extends Phase, Value extends SyntaxNode<P>>(field: string, source: () => readonly Value[]) {
  let length: number | undefined;
  const admitted: Value[] = [];
  return {
    slots: function* (): Generator<SyntaxChildSlot<P>> {
      const raw = source();
      length = raw.length;
      for (let index = 0; index < length; index += 1) {
        const position = index;
        yield { fields: [field, position], read: () => {
          const value = requirePresent(raw[position], missingChild);
          admitted.push(value);
          return value;
        } };
      }
    },
    finish: (read: (value: Value) => Value): readonly Value[] => {
      if (admitted.length !== length) return throwInvariant(missingStructure);
      for (let index = 0; index < length; index += 1) admitted[index] = read(requirePresent(admitted[index], missingStructure));
      return admitted;
    },
  };
}

export function* prependSlots<P extends Phase>(first: Iterable<SyntaxChildSlot<P>>, rest: Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* first;
  yield* rest;
}
