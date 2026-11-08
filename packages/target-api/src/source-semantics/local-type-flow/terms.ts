import type { AstReader, Node } from "@tsonic/tsts";
import { freezeSourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import type {
  SourceTypeDescriptor, SourceTypeDescriptorIndex, SourceTypeDescriptorSignature,
} from "./types.js";

export function sourceTypeDescriptorsEqual(left: SourceTypeDescriptor, right: SourceTypeDescriptor): boolean {
  if (left === right) return true;
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "primitive": return right.kind === "primitive" && left.primitive === right.primitive;
    case "string": return right.kind === "string";
    case "intrinsic": return right.kind === "intrinsic" && left.intrinsic === right.intrinsic;
    case "union": return right.kind === "union" && left.types.length === right.types.length &&
      left.types.every(type => right.types.some(selected => sourceTypeDescriptorsEqual(type, selected)));
    case "callable": return right.kind === "callable" && signaturesEqual(left.calls, right.calls) &&
      signaturesEqual(left.constructs, right.constructs);
    case "optional": return right.kind === "optional" && sourceTypeDescriptorsEqual(left.value, right.value);
    case "array": return right.kind === "array" && left.readonly === right.readonly &&
      sourceTypeDescriptorsEqual(left.element, right.element);
    case "tuple": return right.kind === "tuple" && left.readonly === right.readonly &&
      left.elements.length === right.elements.length && left.elements.every((element, index) =>
        element.kind === right.elements[index]?.kind && sourceTypeDescriptorsEqual(element.type, right.elements[index]!.type));
    case "declared": return right.kind === "declared" && left.declaration === right.declaration &&
      left.typeArguments.length === right.typeArguments.length &&
      left.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, right.typeArguments[index]!));
    case "shape": return right.kind === "shape" && left.members.length === right.members.length &&
      indexesEqual(left.indexes, right.indexes) && signaturesEqual(left.calls, right.calls) && signaturesEqual(left.constructs, right.constructs) &&
      left.members.every(member => {
        const selected = right.members.find(candidate => candidate.name === member.name);
        return selected !== undefined && member.optional === selected.optional && !!member.readonly === !!selected.readonly &&
          sourceTypeDescriptorsEqual(member.type, selected.type);
      });
  }
}

function indexesEqual(left: readonly SourceTypeDescriptorIndex[], right: readonly SourceTypeDescriptorIndex[]): boolean {
  return left.length === right.length && left.every(index => right.some(selected =>
    index.readonly === selected.readonly && sourceTypeDescriptorsEqual(index.key, selected.key) &&
    sourceTypeDescriptorsEqual(index.value, selected.value)));
}

export function sourceTypeDescriptorUnion(types: readonly SourceTypeDescriptor[]): SourceTypeDescriptor | undefined {
  const members: SourceTypeDescriptor[] = [];
  let absent = false;
  const pending = [...types];
  while (pending.length > 0) {
    const selected = pending.shift()!;
    if (selected.kind === "union") pending.unshift(...selected.types);
    else if (selected.kind === "optional") { absent = true; pending.unshift(selected.value); }
    else if (selected.kind === "intrinsic" && selected.intrinsic === "absence") absent = true;
    else if (!members.some(member => sourceTypeDescriptorsEqual(member, selected))) members.push(selected);
  }
  const value: SourceTypeDescriptor | undefined = members.length === 0 ? undefined
    : members.length === 1 ? members[0] : { kind: "union", types: members };
  return absent ? value === undefined ? { kind: "intrinsic", intrinsic: "absence" } : { kind: "optional", value } : value;
}

function signaturesEqual(left: readonly SourceTypeDescriptorSignature[], right: readonly SourceTypeDescriptorSignature[]): boolean {
  return left.length === right.length && left.every((signature, index) => {
    const selected = right[index]!;
    return signature.typeParameters.length === selected.typeParameters.length &&
      signature.typeParameters.every((parameter, offset) => parameter === selected.typeParameters[offset]) &&
      signature.parameters.length === selected.parameters.length && signature.parameters.every((parameter, offset) =>
        parameter.kind === selected.parameters[offset]?.kind &&
        sourceTypeDescriptorsEqual(parameter.type, selected.parameters[offset]!.type)) &&
      sourceTypeDescriptorsEqual(signature.result, selected.result);
  });
}

const descriptorSnapshots = new WeakMap<SourceTypeDescriptor, SourceTypeDescriptor>();

export function substituteSourceTypeDescriptor(type: SourceTypeDescriptor,
  bindings: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor {
  const substitute = (selected: SourceTypeDescriptor): SourceTypeDescriptor => substituteSourceTypeDescriptor(selected, bindings);
  const signatures = (values: readonly SourceTypeDescriptorSignature[]): readonly SourceTypeDescriptorSignature[] => values.map(signature => {
    const parameters = signature.parameters.map(parameter => ({ ...parameter, type: substitute(parameter.type) }));
    const result = substitute(signature.result);
    return result === signature.result && parameters.every((parameter, index) => parameter.type === signature.parameters[index]!.type)
      ? signature : { ...signature, parameters, result };
  });
  switch (type.kind) {
    case "primitive": case "intrinsic": case "string": return type;
    case "declared": {
      const argument = bindings.get(type.declaration);
      if (argument !== undefined && type.typeArguments.length === 0) return argument;
      const typeArguments = type.typeArguments.map(substitute);
      const definition = type.definition === undefined ? undefined : substitute(type.definition);
      return definition === type.definition && typeArguments.every((argument, index) => argument === type.typeArguments[index])
        ? type : { ...type, typeArguments, ...(definition === undefined ? {} : { definition }) };
    }
    case "optional": {
      const value = substitute(type.value);
      return value === type.value ? type : { ...type, value };
    }
    case "array": {
      const element = substitute(type.element);
      return element === type.element ? type : { ...type, element };
    }
    case "tuple": {
      const elements = type.elements.map(element => ({ ...element, type: substitute(element.type) }));
      return elements.every((element, index) => element.type === type.elements[index]!.type) ? type : { ...type, elements };
    }
    case "union": {
      const types = type.types.map(substitute);
      if (types.every((selected, index) => selected === type.types[index])) return type;
      const result = sourceTypeDescriptorUnion(types);
      if (result === undefined) throw new Error("Substituting an inhabited Source union requires an inhabited result.");
      return result;
    }
    case "callable": case "shape": {
      const calls = signatures(type.calls);
      const constructs = signatures(type.constructs);
      const unchanged = calls.every((signature, index) => signature === type.calls[index]) &&
        constructs.every((signature, index) => signature === type.constructs[index]);
      if (type.kind === "callable") return unchanged ? type : { ...type, calls, constructs };
      const members = type.members.map(member => ({ ...member, type: substitute(member.type) }));
      const indexes = type.indexes.map(index => ({ ...index, key: substitute(index.key), value: substitute(index.value) }));
      return unchanged && members.every((member, index) => member.type === type.members[index]!.type) &&
        indexes.every((selected, index) => selected.key === type.indexes[index]!.key && selected.value === type.indexes[index]!.value)
        ? type : { ...type, calls, constructs, members, indexes };
    }
  }
}

export function freezeSourceTypeDescriptor(type: SourceTypeDescriptor): SourceTypeDescriptor {
  const existing = descriptorSnapshots.get(type);
  if (existing !== undefined) return existing;
  const frozen = snapshotSourceTypeDescriptor(type);
  descriptorSnapshots.set(type, frozen);
  descriptorSnapshots.set(frozen, frozen);
  return frozen;
}

function snapshotSourceTypeDescriptor(type: SourceTypeDescriptor): SourceTypeDescriptor {
  const indexes = (values: readonly SourceTypeDescriptorIndex[]) => Object.freeze(values.map(index =>
    Object.freeze({ ...index, key: freezeSourceTypeDescriptor(index.key), value: freezeSourceTypeDescriptor(index.value) })));
  const signatures = (values: readonly SourceTypeDescriptorSignature[]) => Object.freeze(values.map(signature =>
    Object.freeze({ ...signature, typeParameters: Object.freeze([...signature.typeParameters]),
      parameters: Object.freeze(signature.parameters.map(parameter => Object.freeze({ ...parameter,
        type: freezeSourceTypeDescriptor(parameter.type) }))), result: freezeSourceTypeDescriptor(signature.result) })));
  switch (type.kind) {
    case "primitive": case "string": case "intrinsic": return Object.freeze({ ...type });
    case "union": return Object.freeze({ ...type, types: Object.freeze(type.types.map(freezeSourceTypeDescriptor)) });
    case "callable": return Object.freeze({ ...type, calls: signatures(type.calls), constructs: signatures(type.constructs) });
    case "array": return Object.freeze({ ...type, element: freezeSourceTypeDescriptor(type.element) });
    case "optional": return Object.freeze({ ...type, value: freezeSourceTypeDescriptor(type.value) });
    case "tuple": return Object.freeze({ ...type, elements: Object.freeze(type.elements.map(element =>
      Object.freeze({ ...element, type: freezeSourceTypeDescriptor(element.type) }))) });
    case "declared": return Object.freeze({ kind: "declared", declaration: type.declaration,
      typeArguments: Object.freeze(type.typeArguments.map(freezeSourceTypeDescriptor)),
      ...(type.definition === undefined ? {} : { definition: freezeSourceTypeDescriptor(type.definition) }),
      ...(type.cut === undefined ? {} : { cut: type.cut }) });
    case "shape": return Object.freeze({ ...type, indexes: indexes(type.indexes), calls: signatures(type.calls), constructs: signatures(type.constructs),
      members: Object.freeze(type.members.map(member => Object.freeze({ ...member, origin: freezeSourceTypeDescriptorMemberOrigin(member.origin),
        type: freezeSourceTypeDescriptor(member.type) }))) });
  }
}

export function sourceTypeDescriptorDepth(type: SourceTypeDescriptor): number {
  const children = type.kind === "array" ? [type.element] : type.kind === "optional" ? [type.value]
    : type.kind === "union" ? type.types : type.kind === "callable" ? [...type.calls, ...type.constructs]
      .flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])
    : type.kind === "tuple" ? type.elements.map(element => element.type) : type.kind === "declared" ? type.typeArguments
    : type.kind === "shape" ? [...type.members.map(member => member.type), ...type.indexes.flatMap(index => [index.key, index.value]),
      ...[...type.calls, ...type.constructs].flatMap(signature => [...signature.parameters.map(parameter => parameter.type), signature.result])] : [];
  let depth = -1;
  for (const child of children) depth = Math.max(depth, sourceTypeDescriptorDepth(child));
  return depth + 1;
}

export function sourceTypeDescriptorHasTypeVariables(ast: AstReader, type: SourceTypeDescriptor,
  bound: ReadonlySet<Node> = new Set()): boolean {
  const visit = (selected: SourceTypeDescriptor): boolean => sourceTypeDescriptorHasTypeVariables(ast, selected, bound);
  if (type.kind === "declared") {
    if (ast.is.IsTypeParameterDeclaration(type.declaration) && !bound.has(type.declaration)) return true;
    return type.typeArguments.some(visit) || type.definition !== undefined && visit(type.definition);
  }
  if (type.kind === "array") return visit(type.element);
  if (type.kind === "tuple") return type.elements.some(element => visit(element.type));
  if (type.kind === "optional") return visit(type.value);
  if (type.kind === "union") return type.types.some(visit);
  if (type.kind === "shape" && (type.members.some(member => visit(member.type)) ||
    type.indexes.some(index => visit(index.key) || visit(index.value)))) return true;
  if (type.kind === "callable" || type.kind === "shape") return [...type.calls, ...type.constructs].some(signature => {
    const scope = new Set([...bound, ...signature.typeParameters]);
    return signature.parameters.some(parameter => sourceTypeDescriptorHasTypeVariables(ast, parameter.type, scope)) ||
      sourceTypeDescriptorHasTypeVariables(ast, signature.result, scope);
  });
  return false;
}

export function sourceTypeDescriptorTupleValue(type: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>,
  index: number): SourceTypeDescriptor | undefined {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("A Source tuple position must be a nonnegative safe integer.");
  const element = type.elements[index];
  if (element !== undefined) return element.type;
  const last = type.elements[type.elements.length - 1];
  return last?.kind === "rest" ? last.type : undefined;
}

export function sourceTypeDescriptorStructure(type: SourceTypeDescriptor): SourceTypeDescriptor {
  let selected = type;
  while (selected.kind === "declared" && selected.definition !== undefined) selected = selected.definition;
  return selected;
}
