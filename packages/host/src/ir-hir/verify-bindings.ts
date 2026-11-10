import type { Violation } from "../diag/contract.js";
import type { DefId, LocalRef, SourceNodeRef } from "../ids/contract.js";
import { decodeBodyId, decodeDefId, encodeBodyId, encodeDefId } from "../ids/index.js";
import type { BindingVector, BindingVerificationInput, TypeRule } from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type { HirBody, HirModule, HirNode, HirRule, HirSite, HirVerificationContext } from "./contract.js";
import type { HirDataRoot, HirInventory, HirNodeEntry, HirReport } from "./verify-syntax.js";
import { walkHirData } from "./verify-syntax.js";

export type HirBindingRequest = {
  readonly vector: BindingVector;
  readonly site: HirSite;
} & (
  | { readonly kind: "definition"; readonly definition: DefId }
  | { readonly kind: "occurrence"; readonly occurrence: SourceNodeRef }
);

interface BindingFailure {
  readonly rule: TypeRule;
  readonly family: string;
  readonly position: number | null;
  readonly detail: Violation<TypeRule, never>["detail"];
}

function bindingRule(rule: TypeRule): HirRule {
  switch (rule) {
    case "type-reference": return "type-reference";
    case "signature-reference": return "signature-reference";
    case "cross-owner-qualified": return "cross-owner-qualified";
    case "nominal-definition": case "union-order": case "intersection-order": case "member-order":
    case "member-origins": case "index-order": case "signature-order": case "parameter-order":
    case "parameter-identity": case "binding-vector-complete": case "tuple-rest-order":
    case "rational-normalized": case "literal-value-exact": case "extent-exact":
    case "construction-captures-qualified": case "self-owner": case "self-binding-order":
    case "projection-owner": case "sum-arm-order": case "evidence-type": return "binding-vector-complete";
  }
}

export function verifyBindingVectors(
  requests: readonly HirBindingRequest[],
  context: HirVerificationContext,
  nodeOf: (reference: SourceNodeRef) => HirNode | null,
): readonly Violation<HirRule, HirSite>[] {
  const selected: { readonly site: HirSite; readonly violations: Violation<HirRule, HirSite>[] }[] = [];
  const inputs: BindingVerificationInput[] = [];
  const results: Violation<HirRule, HirSite>[][] = [];
  for (const request of requests) {
    const violations: Violation<HirRule, HirSite>[] = [];
    results.push(violations);
    const scope = request.kind === "definition" ? context.bindingScopeOf(request.definition) : context.bindingScopeAt(request.occurrence);
    if (scope === null) {
      const detail: Violation<HirRule, HirSite>["detail"] = request.kind === "definition"
        ? [{ kind: "text", value: "bindingScopeOf" }, { kind: "text", value: request.definition }]
        : [{ kind: "text", value: "bindingScopeAt" }, { kind: "text", value: request.occurrence.kind },
          { kind: "text", value: request.occurrence.kind === "body" ? request.occurrence.value.body : request.occurrence.value.owner },
          { kind: "number", value: request.occurrence.value.node }];
      violations.push({ rule: "binding-vector-complete", site: request.site, detail });
    } else {
      selected.push({ site: request.site, violations });
      inputs.push({ vector: request.vector, scope });
    }
  }
  if (inputs.length > 0) {
    const grouped = new Map<number, BindingFailure[]>();
    for (const violation of verifyTypes({ table: context.types, bindings: inputs, evidence: [],
      nominalOf: context.nominalOf, nodeExists: reference => nodeOf(reference) !== null, localExists: context.localExists })) {
      if (violation.site.kind !== "binding") continue;
      const failure: BindingFailure = { rule: violation.rule, family: violation.site.family,
        position: violation.site.position, detail: violation.detail };
      const previous = grouped.get(violation.site.vector);
      if (previous === undefined) grouped.set(violation.site.vector, [failure]);
      else previous.push(failure);
    }
    selected.forEach((request, ordinal) => {
      for (const violation of grouped.get(ordinal) ?? []) {
        request.violations.push({ rule: bindingRule(violation.rule), site: request.site,
          detail: [{ kind: "text", value: violation.family },
            { kind: "text", value: violation.position === null ? "complete" : String(violation.position) },
            ...violation.detail] });
      }
    });
  }
  return Object.freeze(results.flat());
}

export function validHirIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function sourceNodeExists(reference: SourceNodeRef, module: HirModule,
  inventory: HirInventory, context: HirVerificationContext): boolean {
  return sourceNodeOf(reference, module, inventory, context) !== null;
}

export function sourceNodeOf(reference: SourceNodeRef, module: HirModule,
  inventory: HirInventory, context: HirVerificationContext): HirNode | null {
  if (!validHirIndex(reference.value.node)) return null;
  const body = reference.kind === "body" ? decodeBodyId(reference.value.body) : null;
  const definition = reference.kind === "item" ? reference.value.owner : body?.kind === "decoded" ? body.value.owner : null;
  if (definition === null) return null;
  const owner = decodeDefId(definition);
  if (owner.kind === "invalid") return null;
  return owner.value.module === module.module ? localSourceNode(reference, module, inventory) : context.nodeOf(reference);
}

export function localExists(reference: LocalRef, module: HirModule,
  inventory: HirInventory, context: HirVerificationContext): boolean {
  if (!validHirIndex(reference.local)) return false;
  const path = decodeBodyId(reference.body);
  if (path.kind === "invalid") return false;
  const owner = decodeDefId(path.value.owner);
  if (owner.kind === "invalid") return false;
  if (owner.value.module !== module.module) return context.localExists(reference);
  return inventory.bodies.get(reference.body)?.locals[reference.local] !== undefined;
}

export function localSourceNode(reference: SourceNodeRef, module: HirModule, inventory: HirInventory): HirNode | null {
  const entry = localSourceEntry(reference, module, inventory);
  return entry === null ? null : entry.node;
}

export function localSourceEntry(reference: SourceNodeRef, module: HirModule, inventory: HirInventory): HirNodeEntry | null {
  const body = reference.kind === "body" ? decodeBodyId(reference.value.body) : null;
  const definition = reference.kind === "item" ? reference.value.owner : body?.kind === "decoded" ? body.value.owner : null;
  if (definition === null) return null;
  const path = decodeDefId(definition);
  if (path.kind === "invalid" || path.value.module !== module.module || !validHirIndex(reference.value.node)) return null;
  const entry = inventory.entriesById.get(reference.value.node);
  if (entry === undefined) return null;
  if (reference.kind === "body") {
    const owner = inventory.bodies.get(reference.value.body);
    return owner !== undefined && entry.body === owner ? entry : null;
  }
  return entry.item === reference.value.owner ? entry : null;
}

interface BodyScopeRange { readonly body: HirBody; readonly start: number; readonly end: number }
interface MutableBodyScopeRange { readonly body: HirBody; start: number; end: number }
type BodyScopeVisit = (
  | { readonly kind: "enter"; readonly range: MutableBodyScopeRange }
  | { readonly kind: "leave"; readonly range: MutableBodyScopeRange }
) & { readonly next: BodyScopeVisit | null };

export function hirLexicalBodyRanges(module: HirModule, inventory: HirInventory): readonly BodyScopeRange[] {
  const declarations = new Map<DefId, HirNode>();
  for (const item of module.items) {
    const node = inventory.nodesById.get(item.node);
    if (node !== undefined) declarations.set(item.definition, node);
  }
  const parents = new Map<HirBody, HirBody | null>();
  const parameterOwners = new Map<HirNode, HirBody>();
  for (const body of module.bodies) for (const parameter of body.params) {
    const node = declarations.get(parameter.declaration);
    if (node?.kind !== "Parameter" || node.tsonic.parent !== body.owner) continue;
    const declaration = inventory.parents.get(node);
    if (declaration !== undefined && declaration !== null && declaration.tsonic !== null && "body" in declaration.tsonic &&
      declaration.tsonic.body === body.body) parameterOwners.set(node, body);
  }
  const parameterEnvironments = new Map<HirNode, HirBody>();
  for (const node of inventory.nodes) {
    const parent = inventory.parents.get(node);
    const environment = parameterOwners.get(node) ?? (parent === undefined || parent === null ? undefined : parameterEnvironments.get(parent));
    if (environment !== undefined) parameterEnvironments.set(node, environment);
  }
  for (const body of module.bodies) {
    const identity = decodeBodyId(body.body);
    if (identity.kind !== "decoded" || identity.value.role !== "default-argument") continue;
    const node = inventory.parents.get(body.root);
    if (node === undefined || node === null || declarations.get(body.owner) !== node ||
      (node.kind !== "Parameter" && node.kind !== "BindingElement") || node.initializer !== body.root) continue;
    if (node.kind === "Parameter" && node.tsonic.initializer !== body.body) continue;
    const environment = parameterEnvironments.get(node);
    if (environment !== undefined) parents.set(body, environment);
  }
  const ranges: MutableBodyScopeRange[] = [];
  const byBody = new Map<HirBody, MutableBodyScopeRange>();
  for (const body of module.bodies) {
    const previous = byBody.get(body);
    const range = previous ?? { body, start: 0, end: 0 };
    if (previous === undefined) byBody.set(body, range);
    ranges.push(range);
  }
  const children = new Map<HirBody | null, MutableBodyScopeRange[]>();
  for (const range of byBody.values()) {
    const parent = parents.get(range.body) ?? inventory.bodyParents.get(range.body) ?? null;
    const previous = children.get(parent);
    if (previous === undefined) children.set(parent, [range]);
    else previous.push(range);
  }
  const seen = new Set<MutableBodyScopeRange>();
  let ordinal = 0;
  const roots = [...(children.get(null) ?? []), ...ranges];
  for (const root of roots) {
    if (seen.has(root)) continue;
    let pending: BodyScopeVisit | null = { kind: "enter", range: root, next: null };
    while (pending !== null) {
      const frame = pending;
      pending = frame.next;
      if (frame.kind === "leave") {
        frame.range.end = ordinal;
        continue;
      }
      if (seen.has(frame.range)) continue;
      seen.add(frame.range);
      const range = frame.range;
      range.start = ordinal;
      range.end = ordinal;
      ordinal += 1;
      pending = { kind: "leave", range, next: pending };
      for (const child of children.get(range.body) ?? []) pending = { kind: "enter", range: child, next: pending };
    }
  }
  return ranges;
}

export function verifyHirReferences(roots: readonly HirDataRoot[], module: HirModule,
  inventory: HirInventory, context: HirVerificationContext, report: HirReport): void {
  const definitions = new Set<string>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  const checkedDefinitions = new Set<string>();
  const checkedBodies = new Set<string>();
  const scopeExists = new Map<string, boolean>();
  for (const root of roots) walkHirData(root, data => {
    const reference = data.reference;
    switch (reference.kind) {
      case "plain": case "SourceNodeRef": case "MemberKey": break;
      case "HirResolution": {
        const value = reference.value;
        if (value.kind === "unresolved" && value.checkerDiagnostic !== null &&
          (!validHirIndex(value.checkerDiagnostic) || module.checkerDiagnostics[value.checkerDiagnostic] === undefined))
          report("diagnostic-reference", data.site, "unresolved resolution must name an existing checker diagnostic");
        break;
      }
      case "NodeRef":
        if (!sourceNodeExists({ kind: "body", value: reference.value }, module, inventory, context))
          report("cross-owner-qualified", data.site, "qualified body node must exist in its named owner");
        break;
      case "ItemNodeRef":
        if (!sourceNodeExists({ kind: "item", value: reference.value }, module, inventory, context))
          report("cross-owner-qualified", data.site, "qualified item node must exist in its named owner");
        break;
      case "LocalRef":
        if (!localExists(reference.value, module, inventory, context))
          report("local-reference", data.site, "qualified local must exist in its named body");
        break;
      case "TyId":
        if (!validHirIndex(reference.value) || context.types.terms[reference.value] === undefined)
          report("type-reference", data.site, "type must exist in the supplied table");
        break;
      case "SigId":
        if (!validHirIndex(reference.value) || context.types.signatures[reference.value] === undefined)
          report("signature-reference", data.site, "signature must exist in the supplied table");
        break;
      case "NodeId":
        if (data.field !== "id" && !(data.field === "node" && (data.parent.kind === "NodeRef" || data.parent.kind === "ItemNodeRef")) &&
          (!validHirIndex(reference.value) || !inventory.nodesById.has(reference.value)))
          report("node-reference", data.site, "node must exist in the module arena");
        break;
      case "CandidateListId":
        if (data.field !== "id" && (!validHirIndex(reference.value) || data.body === null || data.body.candidateLists[reference.value] === undefined))
          report("candidate-list-reference", data.site, "candidate list must exist in the containing body");
        break;
      case "DefId": {
        const value = reference.value;
        const path = decodeDefId(value);
        if (path.kind === "invalid") report("definition-reference", data.site, "invalid definition identity");
        else {
          if (!checkedDefinitions.has(value)) {
            checkedDefinitions.add(value);
            for (const segment of path.value.segments) if (!validHirIndex(segment.ordinal))
              report("ordinal-domain", data.site, "definition segment ordinal must be a nonnegative safe integer other than negative zero");
          }
          if (!definitions.has(value)) {
            let exists = scopeExists.get(value);
            if (exists === undefined) { exists = context.bindingScopeOf(encodeDefId(path.value)) !== null; scopeExists.set(value, exists); }
            if (!exists) report("definition-reference", data.site, "definition must exist in the canonical declaration inventory");
          }
        }
        break;
      }
      case "BodyId": {
        const value = reference.value;
        if (checkedBodies.has(value)) break;
        checkedBodies.add(value);
        const path = decodeBodyId(value);
        if (path.kind === "invalid") report("body-owner", data.site, "invalid body identity");
        else {
          if (!validHirIndex(path.value.ordinal))
            report("ordinal-domain", data.site, "body ordinal must be a nonnegative safe integer other than negative zero");
          const owner = decodeDefId(path.value.owner);
          if (owner.kind === "decoded" && !checkedDefinitions.has(path.value.owner)) {
            checkedDefinitions.add(path.value.owner);
            for (const segment of owner.value.segments) if (!validHirIndex(segment.ordinal))
              report("ordinal-domain", data.site, "definition segment ordinal must be a nonnegative safe integer other than negative zero");
          }
          if (owner.kind === "decoded" && owner.value.module === module.module && !inventory.bodies.has(encodeBodyId(path.value)))
            report("body-owner", data.site, "body must exist in this module");
        }
      }
    }
  });
}
