import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputSignature } from "../host-input/identities.js";
import type {
  SourceConstructionDefinition, SourceDeclaredDescriptor, SourceDeferredProjection, SourceMemberOrigin, SourceReceiverOrigin,
  SourceParameterDescriptor, SourceSignatureIdentity, SourceTypeComponent,
  SourceTypeDescriptor, SourceTypeDescriptorIndex, SourceTypeDescriptorMember,
  SourceTypeDescriptorSignature,
} from "../public/source/contracts.js";
import { freezeSourceMemberKey, freezeSourceMemberOrigin, sourceMemberKeyIdentity, sourceMemberOriginKey } from "./descriptor-model.js";

export interface SourceDescriptorInternerInput {
  assertNode(node: Node): void;
  assertSignature(signature: SourceInputSignature): void;
  assertComponent(component: SourceTypeComponent): void;
}

export interface SourceDescriptorInterner {
  assertDescriptor(value: SourceTypeDescriptor): void;
  assertSignature(value: SourceSignatureIdentity): void;
  originalSignature(value: SourceSignatureIdentity): SourceInputSignature;
  assertConstruction(value: SourceConstructionDefinition): void;
  key(value: SourceTypeDescriptor): number;
  primitive(primitive: SourcePrimitiveKind): SourceTypeDescriptor;
  string(): SourceTypeDescriptor;
  intrinsic(intrinsic: Extract<SourceTypeDescriptor, { readonly kind: "intrinsic" }>["intrinsic"]): SourceTypeDescriptor;
  parameter(declaration: Node): SourceParameterDescriptor;
  optional(value: SourceTypeDescriptor): SourceTypeDescriptor;
  union(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor;
  intersection(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor;
  array(element: SourceTypeDescriptor, isReadonly: boolean): SourceTypeDescriptor;
  tuple(elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"], isReadonly: boolean): SourceTypeDescriptor;
  shape(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "shape" }>, "kind">): SourceTypeDescriptor;
  callable(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "callable" }>, "kind">): SourceTypeDescriptor;
  declared(value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor;
  constructionDefinition(occurrence: Node, captures: readonly Node[]): SourceConstructionDefinition;
  constructionReference(definition: SourceConstructionDefinition, arguments_: readonly SourceTypeDescriptor[]): Extract<SourceTypeDescriptor, { readonly kind: "construction-reference" }>;
  projection(source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor;
  signature(owner: Node | undefined, kind: "call" | "construct", original: SourceInputSignature,
    declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity;
}

export function createSourceDescriptorInterner(input: SourceDescriptorInternerInput): SourceDescriptorInterner {
  const descriptors = new Map<string, SourceTypeDescriptor>();
  const descriptorKeys = new WeakMap<SourceTypeDescriptor, number>();
  const signatures = new WeakMap<SourceInputSignature, SourceSignatureIdentity>();
  const activeSignatures = new Set<SourceInputSignature>();
  const signatureKeys = new WeakMap<SourceSignatureIdentity, { readonly key: number; readonly original: SourceInputSignature }>();
  const objectKeys = new WeakMap<object, number>();
  const constructions = new WeakMap<Node, SourceConstructionDefinition>();
  const constructionIdentities = new WeakSet<SourceConstructionDefinition>();
  let nextDescriptorKey = 0;
  let nextSignatureKey = 0;
  let nextObjectKey = 0;

  function objectKey(value: object): number {
    const existing = objectKeys.get(value);
    if (existing !== undefined) return existing;
    const selected = nextObjectKey++;
    objectKeys.set(value, selected);
    return selected;
  }

  function nodeKey(node: Node): number {
    input.assertNode(node);
    return objectKey(node);
  }

  function optionalNodeKey(node: Node | undefined): number | null {
    return node === undefined ? null : nodeKey(node);
  }

  function key(value: SourceTypeDescriptor): number {
    const selected = descriptorKeys.get(value);
    if (selected === undefined) throw new Error("A Source descriptor must belong to this exact program view.");
    return selected;
  }

  function signatureKey(value: SourceSignatureIdentity): number {
    const selected = signatureKeys.get(value);
    if (selected === undefined) throw new Error("A Source signature must belong to this exact program view.");
    return selected.key;
  }

  function intern<Descriptor extends SourceTypeDescriptor>(identity: string, create: () => Descriptor): Descriptor {
    const existing = descriptors.get(identity);
    if (existing !== undefined) return existing as Descriptor;
    const selected = create();
    Object.freeze(selected);
    descriptorKeys.set(selected, nextDescriptorKey++);
    descriptors.set(identity, selected);
    return selected;
  }

  function intrinsic(value: Extract<SourceTypeDescriptor, { readonly kind: "intrinsic" }>["intrinsic"]): SourceTypeDescriptor {
    return intern(JSON.stringify(["intrinsic", value]), () => ({ kind: "intrinsic", intrinsic: value }));
  }

  function optional(value: SourceTypeDescriptor): SourceTypeDescriptor {
    key(value);
    if (value.kind === "optional") return value;
    if (value.kind === "intrinsic" && (value.intrinsic === "absence" || value.intrinsic === "void" || value.intrinsic === "never")) {
      return intrinsic("absence");
    }
    return intern(JSON.stringify(["optional", key(value)]), () => ({ kind: "optional", value }));
  }

  function union(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor {
    values.forEach(key);
    if (values.length === 0) return intrinsic("never");
    if (values.length === 1) return values[0]!;
    const pending = [...values];
    const members: SourceTypeDescriptor[] = [];
    const seen = new Set<SourceTypeDescriptor>();
    let absent = false;
    for (let position = 0; position < pending.length; position += 1) {
      const selected = pending[position]!;
      if (selected.kind === "union") {
        pending.splice(position + 1, 0, ...selected.types);
      } else if (selected.kind === "optional") {
        absent = true;
        pending.splice(position + 1, 0, selected.value);
      } else if (selected.kind === "intrinsic" && (selected.intrinsic === "absence" || selected.intrinsic === "void")) {
        absent = true;
      } else if (!(selected.kind === "intrinsic" && selected.intrinsic === "never") && !seen.has(selected)) {
        seen.add(selected);
        members.push(selected);
      }
    }
    if (members.length === 0) return intrinsic(absent ? "absence" : "never");
    const value = members.length === 1 ? members[0]! : intern(
      JSON.stringify(["union", members.map(key)]),
      () => ({ kind: "union", types: Object.freeze(members) }),
    );
    return absent ? optional(value) : value;
  }

  function originKey(value: SourceMemberOrigin): readonly unknown[] {
    return sourceMemberOriginKey(value, nodeKey);
  }

  function freezeOrigin(value: SourceMemberOrigin): SourceMemberOrigin {
    originKey(value);
    return freezeSourceMemberOrigin(value);
  }

  function assertConstruction(value: SourceConstructionDefinition): void {
    if (!constructionIdentities.has(value)) throw new Error("A Source construction definition must belong to this exact descriptor view.");
  }

  function constructionDefinition(occurrence: Node, captures: readonly Node[]): SourceConstructionDefinition {
    nodeKey(occurrence);
    captures.forEach(nodeKey);
    if (new Set(captures).size !== captures.length) throw new Error("A Source construction requires one occurrence of every original captured binder.");
    const previous = constructions.get(occurrence);
    if (previous !== undefined) {
      if (previous.captures.length !== captures.length || previous.captures.some((value, index) => value !== captures[index]))
        throw new Error("An original construction has one complete ordered capture vector.");
      return previous;
    }
    const value = Object.freeze({ occurrence, captures: Object.freeze([...captures]) });
    constructionIdentities.add(value);
    constructions.set(occurrence, value);
    return value;
  }

  function receiverKey(value: SourceReceiverOrigin): readonly unknown[] {
    switch (value.kind) {
      case "explicit": return [value.kind, nodeKey(value.declaration)];
      case "instance": case "static": return [value.kind, nodeKey(value.owner)];
      case "object": assertConstruction(value.definition); return [value.kind, objectKey(value.definition)];
      case "lexical": return [value.kind, nodeKey(value.owner), signatureKey(value.signature)];
    }
  }

  function signatureShapeKey(value: SourceTypeDescriptorSignature): readonly unknown[] {
    return [signatureKey(value.identity), value.receiver === undefined ? null
      : [optionalNodeKey(value.receiver.declaration), receiverKey(value.receiver.origin), key(value.receiver.type)],
    value.parameters.map(parameter => [parameter.kind, optionalNodeKey(parameter.declaration), key(parameter.type),
      parameter.omission.acceptsOmission, parameter.omission.initializer.kind === "none" ? null : nodeKey(parameter.omission.initializer.value)]), key(value.result)];
  }

  function freezeSignature(value: SourceTypeDescriptorSignature): SourceTypeDescriptorSignature {
    signatureShapeKey(value);
    return Object.freeze({ identity: value.identity,
      ...(value.receiver === undefined ? {} : { receiver: Object.freeze({ ...value.receiver, origin: Object.freeze({ ...value.receiver.origin }) }) }),
      parameters: Object.freeze(value.parameters.map(parameter => Object.freeze({ ...parameter,
        omission: Object.freeze({ acceptsOmission: parameter.omission.acceptsOmission,
          initializer: Object.freeze({ ...parameter.omission.initializer }) }) }))), result: value.result });
  }

  function memberShapeKey(value: SourceTypeDescriptorMember): readonly unknown[] {
    return [value.name, sourceMemberKeyIdentity(value.key, nodeKey), originKey(value.origin), value.optional, value.readonly, key(value.type)];
  }

  function indexShapeKey(value: SourceTypeDescriptorIndex): readonly unknown[] {
    return [nodeKey(value.declaration), value.readonly, key(value.key), key(value.value)];
  }

  function signature(owner: Node | undefined, kind: "call" | "construct", original: SourceInputSignature,
    declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity {
    input.assertSignature(original);
    if (owner !== undefined) nodeKey(owner);
    if (declaration !== undefined) nodeKey(declaration);
    parameters.forEach(nodeKey);
    if (original.owner !== owner || original.signatureKind !== kind || original.declaration !== declaration ||
      original.typeParameters.length !== parameters.length || original.typeParameters.some((parameter, index) => parameter !== parameters[index]) ||
      (original.composition === undefined) === (owner === undefined)) {
      throw new Error("A Source signature requires its exact original owner, kind, declaration, composition and binder inventory.");
    }
    original.composition?.signatures.forEach(input.assertSignature);
    const existing = signatures.get(original);
    if (existing !== undefined) return existing;
    if (activeSignatures.has(original)) throw new Error("Original Source signature composition must be acyclic.");
    activeSignatures.add(original);
    try {
      const composition: SourceSignatureIdentity["composition"] = original.composition === undefined
        ? Object.freeze({ kind: "none" }) : Object.freeze({ kind: "present", value: Object.freeze({
          kind: original.composition.kind, signatures: Object.freeze(original.composition.signatures.map(part =>
            signature(part.owner, part.signatureKind, part, part.declaration, part.typeParameters))) }) });
      const selected: SourceSignatureIdentity = Object.freeze({ owner, kind,
        ...(declaration === undefined ? {} : { declaration }), typeParameters: Object.freeze([...parameters]), composition });
      signatureKeys.set(selected, Object.freeze({ key: nextSignatureKey++, original }));
      signatures.set(original, selected);
      return selected;
    } finally { activeSignatures.delete(original); }
  }

  return Object.freeze({
    assertDescriptor: (value: SourceTypeDescriptor): void => { key(value); },
    assertSignature: (value: SourceSignatureIdentity): void => { signatureKey(value); },
    originalSignature(value: SourceSignatureIdentity): SourceInputSignature {
      signatureKey(value);
      return signatureKeys.get(value)!.original;
    },
    assertConstruction,
    key,
    primitive: (primitive: SourcePrimitiveKind): SourceTypeDescriptor =>
      intern(JSON.stringify(["primitive", primitive]), () => ({ kind: "primitive", primitive })),
    string: (): SourceTypeDescriptor => intern("string", () => ({ kind: "string" })),
    intrinsic,
    parameter: (declaration: Node): SourceParameterDescriptor =>
      intern(JSON.stringify(["parameter", nodeKey(declaration)]), () => ({ kind: "parameter", declaration })),
    optional,
    union,
    intersection: (values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor => {
      if (values.length < 2) throw new Error("A Source conjunction requires its complete original ordered part vector.");
      const keys = values.map(key);
      return intern(JSON.stringify(["intersection", keys]),
        () => ({ kind: "intersection", types: Object.freeze([...values]) }));
    },
    array: (element: SourceTypeDescriptor, isReadonly: boolean): SourceTypeDescriptor =>
      intern(JSON.stringify(["array", isReadonly, key(element)]),
        () => ({ kind: "array", readonly: isReadonly, element })),
    tuple: (elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"], isReadonly: boolean): SourceTypeDescriptor =>
      intern(JSON.stringify(["tuple", isReadonly, elements.map(element =>
        [element.kind, optionalNodeKey(element.declaration), key(element.type)])]),
      () => ({ kind: "tuple", readonly: isReadonly,
        elements: Object.freeze(elements.map(element => Object.freeze({ ...element }))) })),
    callable: (value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "callable" }>, "kind">): SourceTypeDescriptor =>
      intern(JSON.stringify(["callable", value.calls.map(signatureShapeKey), value.constructs.map(signatureShapeKey)]),
        () => ({ kind: "callable", calls: Object.freeze(value.calls.map(freezeSignature)),
          constructs: Object.freeze(value.constructs.map(freezeSignature)) })),
    shape: (value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "shape" }>, "kind">): SourceTypeDescriptor =>
      intern(JSON.stringify(["shape", value.members.map(memberShapeKey), value.indexes.map(indexShapeKey),
        value.calls.map(signatureShapeKey), value.constructs.map(signatureShapeKey)]),
      () => ({ kind: "shape", members: Object.freeze(value.members.map(member => Object.freeze({ ...member, key: freezeSourceMemberKey(member.key), origin: freezeOrigin(member.origin) }))),
        indexes: Object.freeze(value.indexes.map(index => Object.freeze({ ...index }))),
        calls: Object.freeze(value.calls.map(freezeSignature)), constructs: Object.freeze(value.constructs.map(freezeSignature)) })),
    declared: (value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor =>
      intern(JSON.stringify(["declared", nodeKey(value.declaration), value.facet, value.typeArguments.map(key),
        value.extent === undefined ? null : [value.extent.length.toString(), value.extent.runtimeBase]]),
      () => ({ kind: "declared", declaration: value.declaration, facet: value.facet, typeArguments: Object.freeze([...value.typeArguments]),
        ...(value.extent === undefined ? {} : { extent: Object.freeze({ ...value.extent }) }) })),
    constructionDefinition,
    constructionReference: (definition: SourceConstructionDefinition, arguments_: readonly SourceTypeDescriptor[]): Extract<SourceTypeDescriptor, { readonly kind: "construction-reference" }> => {
      assertConstruction(definition);
      if (arguments_.length !== definition.captures.length) throw new Error("A Source construction reference requires every original capture argument.");
      return intern(JSON.stringify(["construction-reference", objectKey(definition), arguments_.map(key)]),
        () => ({ kind: "construction-reference", definition, typeArguments: Object.freeze([...arguments_]) }));
    },
    projection: (source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor => {
      key(source);
      if (projection.kind === "component") input.assertComponent(projection.component);
      return intern(JSON.stringify(["projection", key(source), projection.kind,
        projection.kind === "component" ? objectKey(projection.component) : null]),
      () => ({ kind: "projection", source, projection: Object.freeze({ ...projection }) }));
    },
    signature,
  });
}
