import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceInputSignature } from "../host-input/identities.js";
import type {
  SourceDeclaredDescriptor, SourceDeferredProjection, SourceMemberOrigin,
  SourceParameterDescriptor, SourceSignatureIdentity, SourceTypeComponent,
  SourceTypeDescriptor, SourceTypeDescriptorIndex, SourceTypeDescriptorMember,
  SourceTypeDescriptorSignature,
} from "../public/source/contracts.js";
import { freezeSourceMemberOrigin, sourceMemberOriginKey } from "./descriptor-model.js";

export interface SourceDescriptorInternerInput {
  assertNode(node: Node): void;
  assertSignature(signature: SourceInputSignature): void;
  assertComponent(component: SourceTypeComponent): void;
}

export interface SourceDescriptorInterner {
  assertDescriptor(value: SourceTypeDescriptor): void;
  assertSignature(value: SourceSignatureIdentity): void;
  key(value: SourceTypeDescriptor): number;
  primitive(primitive: SourcePrimitiveKind): SourceTypeDescriptor;
  string(): SourceTypeDescriptor;
  intrinsic(intrinsic: Extract<SourceTypeDescriptor, { readonly kind: "intrinsic" }>["intrinsic"]): SourceTypeDescriptor;
  parameter(declaration: Node): SourceParameterDescriptor;
  optional(value: SourceTypeDescriptor): SourceTypeDescriptor;
  union(values: readonly SourceTypeDescriptor[]): SourceTypeDescriptor;
  array(element: SourceTypeDescriptor, isReadonly: boolean): SourceTypeDescriptor;
  tuple(elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"], isReadonly: boolean): SourceTypeDescriptor;
  shape(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "shape" }>, "kind">): SourceTypeDescriptor;
  callable(value: Omit<Extract<SourceTypeDescriptor, { readonly kind: "callable" }>, "kind">): SourceTypeDescriptor;
  declared(value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor;
  projection(source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor;
  signature(owner: Node, kind: "call" | "construct", original: SourceInputSignature,
    declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity;
}

export function createSourceDescriptorInterner(input: SourceDescriptorInternerInput): SourceDescriptorInterner {
  const descriptors = new Map<string, SourceTypeDescriptor>();
  const descriptorKeys = new WeakMap<SourceTypeDescriptor, number>();
  const signatures = new Map<string, SourceSignatureIdentity>();
  const signatureKeys = new WeakMap<SourceSignatureIdentity, number>();
  const objectKeys = new WeakMap<object, number>();
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
    return selected;
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

  function signatureShapeKey(value: SourceTypeDescriptorSignature): readonly unknown[] {
    return [signatureKey(value.identity), value.receiver === undefined ? null
      : [optionalNodeKey(value.receiver.declaration), key(value.receiver.type)],
    value.parameters.map(parameter => [parameter.kind, optionalNodeKey(parameter.declaration), key(parameter.type)]), key(value.result)];
  }

  function freezeSignature(value: SourceTypeDescriptorSignature): SourceTypeDescriptorSignature {
    signatureShapeKey(value);
    return Object.freeze({ identity: value.identity,
      ...(value.receiver === undefined ? {} : { receiver: Object.freeze({ ...value.receiver }) }),
      parameters: Object.freeze(value.parameters.map(parameter => Object.freeze({ ...parameter }))), result: value.result });
  }

  function memberShapeKey(value: SourceTypeDescriptorMember): readonly unknown[] {
    return [value.name, originKey(value.origin), value.optional, value.readonly, key(value.type)];
  }

  function indexShapeKey(value: SourceTypeDescriptorIndex): readonly unknown[] {
    return [nodeKey(value.declaration), value.readonly, key(value.key), key(value.value)];
  }

  return Object.freeze({
    assertDescriptor: (value: SourceTypeDescriptor): void => { key(value); },
    assertSignature: (value: SourceSignatureIdentity): void => { signatureKey(value); },
    key,
    primitive: (primitive: SourcePrimitiveKind): SourceTypeDescriptor =>
      intern(JSON.stringify(["primitive", primitive]), () => ({ kind: "primitive", primitive })),
    string: (): SourceTypeDescriptor => intern("string", () => ({ kind: "string" })),
    intrinsic,
    parameter: (declaration: Node): SourceParameterDescriptor =>
      intern(JSON.stringify(["parameter", nodeKey(declaration)]), () => ({ kind: "parameter", declaration })),
    optional,
    union,
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
      () => ({ kind: "shape", members: Object.freeze(value.members.map(member => Object.freeze({ ...member, origin: freezeOrigin(member.origin) }))),
        indexes: Object.freeze(value.indexes.map(index => Object.freeze({ ...index }))),
        calls: Object.freeze(value.calls.map(freezeSignature)), constructs: Object.freeze(value.constructs.map(freezeSignature)) })),
    declared: (value: Omit<SourceDeclaredDescriptor, "kind">): SourceDeclaredDescriptor =>
      intern(JSON.stringify(["declared", nodeKey(value.declaration), value.typeArguments.map(key),
        value.extent === undefined ? null : [value.extent.length.toString(), value.extent.runtimeBase]]),
      () => ({ kind: "declared", declaration: value.declaration, typeArguments: Object.freeze([...value.typeArguments]),
        ...(value.extent === undefined ? {} : { extent: Object.freeze({ ...value.extent }) }) })),
    projection: (source: SourceTypeDescriptor, projection: SourceDeferredProjection): SourceTypeDescriptor => {
      key(source);
      if (projection.kind === "component") input.assertComponent(projection.component);
      return intern(JSON.stringify(["projection", key(source), projection.kind,
        projection.kind === "component" ? objectKey(projection.component) : null]),
      () => ({ kind: "projection", source, projection: Object.freeze({ ...projection }) }));
    },
    signature: (owner: Node, kind: "call" | "construct", original: SourceInputSignature,
      declaration: Node | undefined, parameters: readonly Node[]): SourceSignatureIdentity => {
      input.assertSignature(original);
      const identity = JSON.stringify([nodeKey(owner), kind, objectKey(original), optionalNodeKey(declaration), parameters.map(nodeKey)]);
      const existing = signatures.get(identity);
      if (existing !== undefined) return existing;
      if (original.owner !== owner || original.signatureKind !== kind || original.declaration !== declaration ||
        original.typeParameters.length !== parameters.length || original.typeParameters.some((parameter, index) => parameter !== parameters[index])) {
        throw new Error("A Source signature requires its exact original owner, kind, declaration and binder vector.");
      }
      const selected: SourceSignatureIdentity = Object.freeze({ owner, kind,
        ...(declaration === undefined ? {} : { declaration }), typeParameters: Object.freeze([...parameters]) });
      signatureKeys.set(selected, nextSignatureKey++);
      signatures.set(identity, selected);
      return selected;
    },
  });
}
