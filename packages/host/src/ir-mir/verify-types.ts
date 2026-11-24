import type { Violation } from "../diag/contract.js";
import type { KeyData, SigId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { TypeComponent, TypeTable, TypeTerm } from "../ir-types/contract.js";
import type { MirRule, MirViolationSite } from "./contract.js";
import { chargeWork, densePosition } from "./verify-control.js";
import type { WorkMeter } from "./verify-control.js";
import { childPath, rootPath, showPath } from "./text.js";
import type { TextPath } from "./text.js";

export interface SignatureReference {
  readonly signature: SigId;
  readonly site: MirViolationSite;
}

export interface TypeReference {
  readonly type: TyId;
  readonly site: MirViolationSite;
}

type GraphReference =
  | { readonly kind: "type"; readonly value: TyId }
  | { readonly kind: "signature"; readonly value: SigId };

interface TypeGraphNode {
  readonly reference: GraphReference;
  readonly parents: TypeGraphNode[];
  unresolved: boolean;
  open: boolean;
}

export function componentReferences(component: TypeComponent, at: TextPath, meter: WorkMeter, references: GraphReference[]): readonly GraphReference[] {
  const active = new Set<TypeComponent>();
  const pending: { readonly component: TypeComponent; readonly path: TextPath; readonly leave: boolean }[] = [];
  chargeWork(meter, 1);
  if (meter.exhausted) return references;
  pending.push({ component, path: at, leave: false });
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      if (current.leave) { active.delete(current.component); continue; }
      if (active.has(current.component)) throw new TypeError(`Cyclic MIR value at ${showPath(current.path)}`);
      chargeWork(meter, 2);
      if (meter.exhausted) return [];
      active.add(current.component);
      pending.push({ ...current, leave: true });
      for (let index = current.component.path.length - 1; index >= 0; index -= 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const selector = current.component.path[index];
        if (selector === undefined) throw new TypeError(`Sparse MIR value at ${showPath(current.path)}.path[${index}]`);
        switch (selector.kind) {
          case "sum-arm":
            for (let position = 0; position < selector.family.roles.length; position += 1) {
              chargeWork(meter, 1);
              if (meter.exhausted) return [];
              const role = selector.family.roles[position];
              if (role === undefined) throw new TypeError(`Sparse MIR value at ${showPath(current.path)}.family.roles[${position}]`);
              references.push({ kind: "type", value: role.member });
            }
            chargeWork(meter, 1);
            if (meter.exhausted) return [];
            pending.push({ component: selector.family.component,
              path: childPath(childPath(current.path, `.path[${index}]`), ".family.component"), leave: false });
            break;
          case "parameter": case "receiver": case "signature-tail": case "result":
            chargeWork(meter, 1);
            if (meter.exhausted) return [];
            references.push({ kind: "signature", value: selector.signature });
            break;
          case "index-key": case "index-value":
            chargeWork(meter, 1);
            if (meter.exhausted) return [];
            references.push({ kind: "type", value: selector.key });
            break;
          case "class-value": case "construction-argument": case "optional-value": case "array-element":
          case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
          case "intersection-member": case "intersection-result": case "argument-tail": case "parameter-tail":
          case "member": case "projection-source": case "tuple-slice":
          case "type-argument": case "awaited": break;
        }
      }
  }
  return references;
}

function termReferences(term: TypeTerm, path: TextPath, meter: WorkMeter, missing: () => void, open: () => void): GraphReference[] {
  const references: GraphReference[] = [];
  const appendType = (value: TyId | undefined): void => {
    chargeWork(meter, 1);
    if (meter.exhausted) return;
    if (value === undefined) { missing(); return; }
    references.push({ kind: "type", value });
  };
  const appendTypes = (values: readonly TyId[]): void => {
    for (let position = 0; position < values.length; position += 1) {
      chargeWork(meter, 1);
      if (meter.exhausted) return;
      appendType(values[position]);
      if (meter.exhausted) return;
    }
  };
  const appendSignature = (value: SigId | undefined): void => {
    chargeWork(meter, 1);
    if (meter.exhausted) return;
    if (value === undefined) { missing(); return; }
    references.push({ kind: "signature", value });
  };
  const appendSignatures = (values: readonly SigId[]): void => {
    for (let position = 0; position < values.length; position += 1) {
      chargeWork(meter, 1);
      if (meter.exhausted) return;
      appendSignature(values[position]);
      if (meter.exhausted) return;
    }
  };
  switch (term.kind) {
    case "literal": appendType(term.base); break;
    case "template-literal":
      for (let position = 0; position < term.spans.length; position += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        appendType(term.spans[position]?.type);
        if (meter.exhausted) return [];
      }
      break;
    case "union": case "intersection": appendTypes(term.members); break;
    case "optional": appendType(term.value); break;
    case "array": case "fixed-array": appendType(term.element); break;
    case "tuple":
      for (let position = 0; position < term.elements.length; position += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const element = term.elements[position];
        if (element === undefined) throw new TypeError(`Sparse MIR tuple at ${showPath(path)}[${position}]`);
        if (element.kind === "variadic") open();
        appendType(element.type);
        if (meter.exhausted) return [];
      }
      break;
    case "shape":
      for (let position = 0; position < term.members.length; position += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const member = term.members[position];
        if (member === undefined) throw new TypeError(`Sparse MIR member at ${showPath(path)}[${position}]`);
        if (member.read !== null) appendType(member.read);
        if (meter.exhausted) return [];
        if (member.write !== null) appendType(member.write);
        if (meter.exhausted) return [];
      }
      for (let position = 0; position < term.indexes.length; position += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const index = term.indexes[position];
        if (index === undefined) throw new TypeError(`Sparse MIR index at ${showPath(path)}[${position}]`);
        appendType(index.key);
        if (meter.exhausted) return [];
        appendType(index.read);
        if (meter.exhausted) return [];
        if (index.write !== null) appendType(index.write);
        if (meter.exhausted) return [];
      }
      appendSignatures(term.calls);
      if (meter.exhausted) return [];
      appendSignatures(term.constructs);
      break;
    case "callable":
      appendSignatures(term.calls);
      if (meter.exhausted) return [];
      appendSignatures(term.constructs);
      break;
    case "declared": case "merged-interface": case "alias-application": case "construction-reference": appendTypes(term.arguments); break;
    case "projection":
      appendType(term.source);
      if (meter.exhausted) return [];
      if (term.projection.kind === "component") {
        componentReferences(term.projection.component, childPath(path, ".projection.component"), meter, references);
        if (meter.exhausted) return [];
      } else if (term.projection.kind === "mapped") {
        if (term.projection.remap !== null) appendType(term.projection.remap);
        if (meter.exhausted) return [];
        appendType(term.projection.value);
        if (meter.exhausted) return [];
      }
      break;
    case "primitive": case "string": case "intrinsic": case "enum": case "param": case "merged-parameter":
    case "self": case "open": case "error": break;
  }
  return references;
}

export function verifyTypeReferences(
  types: TypeTable, references: readonly TypeReference[], signatures: readonly SignatureReference[], meter: WorkMeter,
): readonly Violation<MirRule, MirViolationSite>[] {
  if (meter.exhausted) return [];
  const nodes = new Map<string, TypeGraphNode>();
  const pending: TypeGraphNode[] = [];
  const ensure = (reference: GraphReference): TypeGraphNode | null => {
    chargeWork(meter, 1);
    if (meter.exhausted) return null;
    const key = encodeKey([reference.kind, reference.value]);
    const known = nodes.get(key);
    if (known !== undefined) return known;
    chargeWork(meter, 2);
    if (meter.exhausted) return null;
    const node: TypeGraphNode = { reference, parents: [], unresolved: false, open: false };
    nodes.set(key, node);
    pending.push(node);
    return node;
  };
  const roots: { readonly site: MirViolationSite; readonly value: number; readonly node: TypeGraphNode }[] = [];
  const rootKeys = new Set<string>();
  const root = (reference: GraphReference, site: MirViolationSite): void => {
    chargeWork(meter, 1);
    if (meter.exhausted) return;
    const fields: KeyData[] = [site.kind, site.body];
    if ("local" in site) fields.push(site.local);
    if ("constant" in site) fields.push(site.constant);
    if ("place" in site) fields.push(site.place);
    if ("block" in site) fields.push(site.block);
    if ("statement" in site) fields.push(site.statement);
    fields.push(reference.kind, reference.value);
    const key = encodeKey(fields);
    if (rootKeys.has(key)) return;
    const node = ensure(reference);
    if (node === null) return;
    chargeWork(meter, 1);
    if (meter.exhausted) return;
    rootKeys.add(key);
    roots.push({ site, value: reference.value, node });
  };
  for (let position = 0; position < references.length; position += 1) {
    chargeWork(meter, 1);
    if (meter.exhausted) return [];
    const reference = references[position];
    if (reference === undefined) throw new TypeError("Sparse MIR type roots");
    root({ kind: "type", value: reference.type }, reference.site);
    if (meter.exhausted) return [];
  }
  for (let position = 0; position < signatures.length; position += 1) {
    chargeWork(meter, 1);
    if (meter.exhausted) return [];
    const reference = signatures[position];
    if (reference === undefined) throw new TypeError("Sparse MIR signature roots");
    root({ kind: "signature", value: reference.signature }, reference.site);
    if (meter.exhausted) return [];
  }
  for (const node of pending) {
    chargeWork(meter, 2);
    if (meter.exhausted) return [];
    const reference = node.reference;
    let children: GraphReference[] = [];
    if (reference.kind === "type") {
      const term = densePosition(reference.value, types.terms.length) ? types.terms[reference.value] : undefined;
      if (term === undefined) { node.unresolved = true; continue; }
      node.open = term.kind === "open" || term.kind === "error" || term.kind === "intrinsic" && term.intrinsic === "alias-marker";
      children = termReferences(term, childPath(rootPath, `.types.terms[${reference.value}]`), meter,
        () => { node.unresolved = true; }, () => { node.open = true; });
      if (meter.exhausted) return [];
    } else {
      const signature = densePosition(reference.value, types.signatures.length) ? types.signatures[reference.value] : undefined;
      if (signature === undefined || !Object.is(signature.id, reference.value)) { node.unresolved = true; continue; }
      chargeWork(meter, signature.receiver === null ? 1 : 2);
      if (meter.exhausted) return [];
      if (signature.receiver !== null) children.push({ kind: "type", value: signature.receiver });
      children.push({ kind: "type", value: signature.result });
      for (let index = 0; index < signature.parameters.length; index += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const parameter = signature.parameters[index];
        if (parameter === undefined) { node.unresolved = true; continue; }
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        children.push({ kind: "type", value: parameter.type });
      }
      for (let index = 0; index < signature.typeParameters.length; index += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const parameter = signature.typeParameters[index];
        if (parameter === undefined) { node.unresolved = true; continue; }
        if (parameter.constraint !== null) {
          chargeWork(meter, 1);
          if (meter.exhausted) return [];
          children.push({ kind: "type", value: parameter.constraint });
        }
        if (parameter.default !== null) {
          chargeWork(meter, 1);
          if (meter.exhausted) return [];
          children.push({ kind: "type", value: parameter.default });
        }
      }
      if (signature.composition !== null) for (let index = 0; index < signature.composition.signatures.length; index += 1) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        const composed = signature.composition.signatures[index];
        if (composed === undefined) { node.unresolved = true; continue; }
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        children.push({ kind: "signature", value: composed });
      }
    }
    for (const child of children) {
      const target = ensure(child);
      if (target === null) return [];
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      target.parents.push(node);
    }
  }
  for (const flag of ["unresolved", "open"]) {
    const waiting: TypeGraphNode[] = [];
    for (const node of nodes.values()) {
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      if (flag === "unresolved" ? node.unresolved : node.open) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        waiting.push(node);
      }
    }
    for (const node of waiting) {
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      for (const parent of node.parents) {
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        if (flag === "unresolved" ? parent.unresolved : parent.open) continue;
        chargeWork(meter, 1);
        if (meter.exhausted) return [];
        if (flag === "unresolved") parent.unresolved = true;
        else parent.open = true;
        waiting.push(parent);
      }
    }
  }
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  for (const { site, value, node } of roots) {
    chargeWork(meter, 1);
    if (meter.exhausted) return [];
    if (node.unresolved) {
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      violations.push({ rule: "type-resolves", site, detail: [{ kind: "number", value }] });
    }
    if (node.open) {
      chargeWork(meter, 1);
      if (meter.exhausted) return [];
      violations.push({ rule: "type-closed", site, detail: [{ kind: "number", value }] });
    }
  }
  return violations;
}
