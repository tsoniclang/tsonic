import type { Node, Signature, Type } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputComponentPart, SourceInputSignature } from "./identities.js";

export interface SourceInputIdentityOwner {
  assertComponent(component: SourceInputComponent): void;
  assertSignature(signature: SourceInputSignature): void;
  checkedComponent(component: SourceInputComponent): Type;
  checkedSignature(signature: SourceInputSignature): Signature;
  component(root: Node, path: readonly SourceInputComponentPart[], terminal: Type): SourceInputComponent;
  signature(owner: Node, kind: "call" | "construct", original: Signature,
    declaration: Node | undefined, parameters: readonly Node[]): SourceInputSignature;
}

export function createSourceInputIdentityOwner(assertNode: (node: Node) => void): SourceInputIdentityOwner {
  const componentTypes = new WeakMap<SourceInputComponent, Type>();
  const signatureTypes = new WeakMap<SourceInputSignature, Signature>();
  const components = new WeakMap<Node, WeakMap<Type, Map<string, SourceInputComponent>>>();
  const signatures = new WeakMap<Signature, Map<string, SourceInputSignature>>();
  const ids = new WeakMap<object, number>();
  let nextId = 0;

  function id(value: object): number {
    const previous = ids.get(value);
    if (previous !== undefined) return previous;
    const selected = nextId++;
    ids.set(value, selected);
    return selected;
  }

  function nodeId(node: Node): number {
    assertNode(node);
    return id(node);
  }

  function checkedComponent(component: SourceInputComponent): Type {
    const selected = componentTypes.get(component);
    if (selected === undefined) throw new Error("An original Source component must belong to this exact input view.");
    return selected;
  }

  function checkedSignature(signature: SourceInputSignature): Signature {
    const selected = signatureTypes.get(signature);
    if (selected === undefined) throw new Error("An original Source signature must belong to this exact input view.");
    return selected;
  }

  function signatureId(signature: SourceInputSignature): number {
    checkedSignature(signature);
    return id(signature);
  }

  function pathKey(path: readonly SourceInputComponentPart[]): string {
    return JSON.stringify(path.map(part => {
      switch (part.kind) {
        case "member": return [part.kind, nodeId(part.declaration), part.access];
        case "parameter": return [part.kind, signatureId(part.signature), part.index];
        case "receiver": case "result": return [part.kind, signatureId(part.signature)];
        case "type-argument": return [part.kind, nodeId(part.declaration), part.index];
        case "index-key": case "index-value": return [part.kind, nodeId(part.declaration)];
        case "argument-place": case "parameter-place": return [part.kind, part.index];
        case "argument-tail": case "parameter-tail": return [part.kind, part.start];
        case "element": case "optional-value": return [part.kind];
        case "tuple-element": case "union-member": return [part.kind, part.index];
        case "tuple-slice": return [part.kind, part.start, part.readonly];
        case "signature-tail": return [part.kind, signatureId(part.signature), part.start, part.readonly];
      }
    }));
  }

  return Object.freeze({
    assertComponent: (component: SourceInputComponent): void => { checkedComponent(component); },
    assertSignature: (signature: SourceInputSignature): void => { checkedSignature(signature); },
    checkedComponent,
    checkedSignature,
    component: (root: Node, path: readonly SourceInputComponentPart[], terminal: Type): SourceInputComponent => {
      nodeId(root);
      const identity = pathKey(path);
      let byType = components.get(root);
      if (byType === undefined) { byType = new WeakMap(); components.set(root, byType); }
      let byPath = byType.get(terminal);
      if (byPath === undefined) { byPath = new Map(); byType.set(terminal, byPath); }
      const existing = byPath.get(identity);
      if (existing !== undefined) return existing;
      const selected: SourceInputComponent = Object.freeze({ kind: "component", root,
        path: Object.freeze(path.map(part => Object.freeze({ ...part }))) });
      componentTypes.set(selected, terminal);
      byPath.set(identity, selected);
      return selected;
    },
    signature: (owner: Node, kind: "call" | "construct", original: Signature,
      declaration: Node | undefined, parameters: readonly Node[]): SourceInputSignature => {
      const identity = JSON.stringify([nodeId(owner), kind, declaration === undefined ? null : nodeId(declaration), parameters.map(nodeId)]);
      let choices = signatures.get(original);
      if (choices === undefined) { choices = new Map(); signatures.set(original, choices); }
      const existing = choices.get(identity);
      if (existing !== undefined) return existing;
      const selected: SourceInputSignature = Object.freeze({ kind: "signature", owner, signatureKind: kind,
        declaration, typeParameters: Object.freeze([...parameters]) });
      signatureTypes.set(selected, original);
      choices.set(identity, selected);
      return selected;
    },
  });
}
