import type { SourceNodeRef } from "../ids/contract.js";
import type { ComponentSelector, ConstructionDefinition, MemberKey, MemberOrigin, Signature, SumFamily, TypeComponent, TypeTerm } from "./contract.js";

const copySource = (value: SourceNodeRef): SourceNodeRef => value.kind === "body"
  ? { kind: "body", value: { ...value.value } } : { kind: "item", value: { ...value.value } };

const copyKey = (value: MemberKey): MemberKey => value.kind === "number"
  ? { ...value, value: { ...value.value } } : { ...value };

const copyOrigin = (value: MemberOrigin): MemberOrigin => value.kind === "mapped"
  ? { ...value, owner: copySource(value.owner), key: copyKey(value.key) } : { ...value };

const copyConstruction = (value: ConstructionDefinition): ConstructionDefinition =>
  ({ occurrence: { ...value.occurrence }, captures: value.captures.map(capture => ({ ...capture })) });

function copyComponent(value: TypeComponent): TypeComponent {
  interface Frame {
    readonly source: TypeComponent;
    readonly path: ComponentSelector[];
    position: number;
    readonly parent: { readonly frame: Frame; readonly family: SumFamily; readonly index: number } | null;
  }
  let frame: Frame = { source: value, path: [], position: 0, parent: null };
  for (;;) {
    const selector = frame.source.path[frame.position++];
    if (selector === undefined) {
      const component: TypeComponent = { root: copySource(frame.source.root), path: frame.path };
      const parent = frame.parent;
      if (parent === null) return component;
      const family: SumFamily = { origin: parent.family.origin, component,
        parameters: parent.family.parameters.map(parameter => ({ ...parameter })),
        roles: parent.family.roles.map(role => ({ ...role, component: copySource(role.component) })) };
      frame = parent.frame;
      frame.path.push({ kind: "sum-arm", family, index: parent.index });
    } else if (selector.kind === "sum-arm") {
      frame = { source: selector.family.component, path: [], position: 0,
        parent: { frame, family: selector.family, index: selector.index } };
    } else if (selector.kind === "construction-argument") {
      frame.path.push({ ...selector, definition: copyConstruction(selector.definition) });
    } else if (selector.kind === "member") {
      frame.path.push({ ...selector, origin: copyOrigin(selector.origin) });
    } else frame.path.push({ ...selector });
  }
}

export function copyType(value: TypeTerm): TypeTerm {
  switch (value.kind) {
    case "primitive": case "string": case "intrinsic": case "optional": case "array":
    case "enum": case "self": case "open": case "error": return { ...value };
    case "literal": return { ...value, value: value.value.kind === "number"
      ? { ...value.value, value: { ...value.value.value } } : { ...value.value } };
    case "union": case "intersection": return { ...value, members: [...value.members] };
    case "tuple": return { ...value, elements: value.elements.map(element => ({ ...element })) };
    case "fixed-array": return { ...value, extent: { ...value.extent } };
    case "shape": return { ...value, members: value.members.map(member => ({ ...member, key: copyKey(member.key),
      origins: member.origins.map(copyOrigin), readOrigins: member.readOrigins.map(copyOrigin),
      writeOrigins: member.writeOrigins.map(copyOrigin) })), indexes: value.indexes.map(index => ({ ...index })),
      calls: [...value.calls], constructs: [...value.constructs] };
    case "callable": return { ...value, calls: [...value.calls], constructs: [...value.constructs] };
    case "declared": return { ...value, arguments: [...value.arguments], extent: value.extent === null ? null : { ...value.extent } };
    case "construction-reference": return { ...value, definition: copyConstruction(value.definition), arguments: [...value.arguments] };
    case "param": return { ...value, parameter: { ...value.parameter } };
    case "projection": return { ...value, projection: value.projection.kind === "awaited"
      ? { ...value.projection } : { ...value.projection, component: copyComponent(value.projection.component) } };
  }
}

export const copySignature = (value: Signature): Signature => ({ ...value,
  owner: value.owner === null ? null : copySource(value.owner),
  composition: value.composition === null ? null : { ...value.composition, signatures: [...value.composition.signatures] },
  typeParameters: value.typeParameters.map(parameter => ({ ...parameter, identity: { ...parameter.identity } })),
  parameters: value.parameters.map(parameter => ({ ...parameter })),
});
