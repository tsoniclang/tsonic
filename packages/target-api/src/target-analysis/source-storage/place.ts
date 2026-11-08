import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclaredSlot, SourceDescriptorView, SourcePresence, SourceRefusal, SourceResult, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import type { SourceMemberUse } from "../../source-semantics/member-use.js";
import type { SourceProductionResult } from "../../source-semantics/descriptor-contracts.js";
import type { SourceInputProtocolQueries } from "../../host-input/protocol-input.js";
import type { SourceStoragePlace } from "../../source-model/protocols.js";
import { sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";

export interface SourceStoragePlaceInput {
  readonly ast: AstReader;
  readonly view: SourceDescriptorView;
  readonly navigation: SourceNodeNavigationFacts;
  readonly assertNode: (node: Node) => void;
  readonly declared: (declaration: Node) => SourceProductionResult<SourceDeclaredSlot>;
  readonly argumentPassing: SourceInputProtocolQueries["argumentPassing"];
  readonly member: (occurrence: Node) => SourceProductionResult<SourceMemberUse>;
  readonly unavailable: (node: Node, reason: string) => SourceRefusal;
}

export interface SourceStoragePlaceQueries {
  storage(occurrence: Node): SourceProductionResult<SourcePresence<SourceStoragePlace>>;
  writable(occurrence: Node, operation: string): SourceProductionResult<SourceStoragePlace>;
}

export function createSourceStoragePlaceQueries(input: SourceStoragePlaceInput): SourceStoragePlaceQueries {
  const { ast, view, navigation, assertNode, declared, member, unavailable } = input;
  const retained = new WeakMap<Node, SourceResult<SourcePresence<SourceStoragePlace>>>();
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const none = Object.freeze({ kind: "none" } as const);
  const present = (value: SourceStoragePlace): SourcePresence<SourceStoragePlace> => Object.freeze({ kind: "present", value: Object.freeze(value) });
  const bindingWritable = (declaration: Node): boolean => {
    assertNode(declaration);
    let owner = declaration;
    const visited = new Set<Node>();
    while (ast.is.IsBindingElement(owner)) {
      if (visited.has(owner)) throw new Error("A Source binding place requires acyclic original declaration ownership.");
      visited.add(owner);
      const pattern = ast.parent(owner);
      const parent = pattern === undefined ? undefined : ast.parent(pattern);
      if (parent === undefined) return false;
      owner = parent;
      assertNode(owner);
    }
    if (ast.is.IsVariableDeclaration(owner)) {
      const kind = ast.variableDeclarationKind(owner);
      return kind === "var" || kind === "let";
    }
    if (ast.is.IsParameterDeclaration(owner)) {
      const passing = input.argumentPassing(owner);
      return passing.kind === "none" || passing.value.role !== "declaration" ||
        passing.value.mode !== "byref-readonly" && passing.value.mode !== "borrow-shared";
    }
    return false;
  };
  const build = (occurrence: Node): SourceProductionResult<SourcePresence<SourceStoragePlace>> => {
    let storage = occurrence;
    const visited = new Set<Node>();
    for (;;) {
      if (visited.has(storage)) throw new Error("A Source place requires acyclic original expression identities.");
      visited.add(storage);
      const operand = sourceTransparentExpressionOperand(ast, storage);
      if (operand === undefined) break;
      assertNode(operand);
      storage = operand;
    }
    if (ast.is.IsIdentifier(storage)) {
      const reference = navigation.sourceReferenceFor(storage);
      if (reference === undefined) return resolved(none);
      assertNode(reference.declaration);
      if (!ast.is.IsVariableDeclaration(reference.declaration) && !ast.is.IsParameterDeclaration(reference.declaration) &&
        !ast.is.IsBindingElement(reference.declaration)) return resolved(none);
      const slot = declared(reference.declaration);
      if (slot.kind !== "resolved") return slot;
      view.assertEvidence(slot.value.type);
      return resolved(present({ kind: "binding", occurrence, storage, value: slot.value.type,
        declaration: reference.declaration, writable: bindingWritable(reference.declaration) }));
    }
    if (!ast.is.IsPropertyAccessExpression(storage) && !ast.is.IsElementAccessExpression(storage)) return resolved(none);
    const selected = member(storage);
    if (selected.kind !== "resolved") return selected;
    if (selected.value.occurrence !== storage) throw new Error("A Source place requires the same canonical member-use occurrence.");
    if (selected.value.optionalChain || selected.value.chainContinuation) return resolved(none);
    const value: SourceTypeEvidence | undefined = selected.value.writeType ?? selected.value.readType;
    if (value === undefined) return unavailable(occurrence, "The original Source member has no available storage component.");
    view.assertEvidence(value);
    const writable = selected.value.writeType !== undefined && selected.value.arms.every(arm =>
      arm.writeType !== undefined && (arm.kind !== "index" || !arm.readonly));
    const receiver = Object.freeze({ occurrence: selected.value.receiver.occurrence, value: selected.value.receiver.value });
    if (selected.value.key.kind === "present" && selected.value.arms.some(arm => arm.kind === "index")) return resolved(present({ kind: "element", occurrence, storage,
      value, writable, receiver, key: selected.value.key.value }));
    return resolved(present({ kind: "member", occurrence, storage, value, writable, receiver,
      declarations: selected.value.selectedDeclarations }));
  };
  const storage = (occurrence: Node): SourceProductionResult<SourcePresence<SourceStoragePlace>> => {
    assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const selected = build(occurrence);
    if (selected.kind !== "pending") retained.set(occurrence, selected);
    return selected;
  };
  return Object.freeze({ storage,
    writable(occurrence: Node, operation: string): SourceProductionResult<SourceStoragePlace> {
      const selected = storage(occurrence);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind === "none" || !selected.value.value.writable)
        return unavailable(occurrence, `${operation}(...) requires writable storage, not a constant, readonly member, or value expression.`);
      return resolved(selected.value.value);
    } });
}
