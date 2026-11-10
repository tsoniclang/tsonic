import type { Violation } from "../diag/contract.js";
import type { DefId, LocalRef, NodeRef, SourceNodeRef } from "../ids/contract.js";
import { decodeBodyId, decodeDefId, encodeDefId } from "../ids/index.js";
import type { BindingVector, BindingVerificationInput, TypeRule } from "../ir-types/contract.js";
import { verifyTypes } from "../ir-types/index.js";
import type { HirModule, HirNode, HirRule, HirSite, HirVerificationContext } from "./contract.js";
import type { HirDataRoot, HirInventory, HirReport } from "./verify-syntax.js";
import { checkHirShape, walkHirData } from "./verify-syntax.js";
import { hirSchema } from "./verify-captures.js";

export interface HirBindingRequest {
  readonly definition: DefId;
  readonly vector: BindingVector;
  readonly site: HirSite;
}

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
    default: return "binding-vector-complete";
  }
}

export function verifyBindingVectors(
  requests: readonly HirBindingRequest[],
  context: HirVerificationContext,
): readonly Violation<HirRule, HirSite>[] {
  const selected: HirBindingRequest[] = [];
  const inputs: BindingVerificationInput[] = [];
  const results = new Map<HirBindingRequest, Violation<HirRule, HirSite>[]>();
  for (const request of requests) {
    const scope = context.bindingScopeOf(request.definition);
    if (scope === null) {
      results.set(request, [{ rule: "binding-vector-complete", site: request.site,
        detail: [{ kind: "text", value: "bindingScopeOf" }, { kind: "text", value: request.definition }] }]);
    } else {
      selected.push(request);
      inputs.push({ vector: request.vector, scope });
    }
  }
  if (inputs.length > 0) {
    const grouped = new Map<number, BindingFailure[]>();
    for (const violation of verifyTypes({ table: context.types, bindings: inputs, evidence: [],
      nominalOf: context.nominalOf, nodeExists: context.nodeExists, localExists: context.localExists })) {
      if (violation.site.kind !== "binding") continue;
      const failure: BindingFailure = { rule: violation.rule, family: violation.site.family,
        position: violation.site.position, detail: violation.detail };
      const previous = grouped.get(violation.site.vector);
      if (previous === undefined) grouped.set(violation.site.vector, [failure]);
      else previous.push(failure);
    }
    selected.forEach((request, ordinal) => {
      const violations: Violation<HirRule, HirSite>[] = [];
      for (const violation of grouped.get(ordinal) ?? []) {
        violations.push({ rule: bindingRule(violation.rule), site: request.site,
          detail: [{ kind: "text", value: violation.family },
            { kind: "text", value: violation.position === null ? "complete" : String(violation.position) },
            ...violation.detail] });
      }
      results.set(request, violations);
    });
  }
  return Object.freeze(requests.flatMap(request => results.get(request) ?? []));
}

export function isSourceNodeRef(value: unknown): value is SourceNodeRef {
  return checkHirShape(value, "SourceNodeRef", hirSchema);
}

function isNodeRef(value: unknown): value is NodeRef {
  return checkHirShape(value, "NodeRef", hirSchema);
}

function isLocalRef(value: unknown): value is LocalRef {
  return checkHirShape(value, "LocalRef", hirSchema);
}

export function validHirIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function sourceNodeExists(reference: SourceNodeRef, module: HirModule,
  inventory: HirInventory, context: HirVerificationContext): boolean {
  if (!validHirIndex(reference.value.node)) return false;
  if (reference.kind === "body") {
    const path = decodeBodyId(reference.value.body);
    if (path.kind === "invalid") return false;
    const owner = decodeDefId(path.value.owner);
    if (owner.kind === "invalid") return false;
    if (owner.value.module !== module.module) return context.nodeExists(reference);
    const body = inventory.bodies.get(reference.value.body);
    const node = inventory.nodesById.get(reference.value.node);
    return body !== undefined && node !== undefined && inventory.owners.get(node) === body;
  }
  const path = decodeDefId(reference.value.owner);
  if (path.kind === "invalid") return false;
  if (path.value.module !== module.module) return context.nodeExists(reference);
  const node = inventory.nodesById.get(reference.value.node);
  return node !== undefined && inventory.itemOwners.get(node) === reference.value.owner;
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
  const body = reference.kind === "body" ? decodeBodyId(reference.value.body) : null;
  const definition = reference.kind === "item" ? reference.value.owner : body?.kind === "decoded" ? body.value.owner : null;
  if (definition === null) return null;
  const path = decodeDefId(definition);
  if (path.kind === "invalid" || path.value.module !== module.module || !validHirIndex(reference.value.node)) return null;
  return inventory.nodesById.get(reference.value.node) ?? null;
}

export function verifyHirReferences(roots: readonly HirDataRoot[], module: HirModule,
  inventory: HirInventory, context: HirVerificationContext, report: HirReport): void {
  const definitions = new Set<string>([module.tree.tsonic.definition, ...module.items.map(item => item.definition)]);
  const checkedDefinitions = new Set<string>();
  const checkedBodies = new Set<string>();
  const scopeExists = new Map<string, boolean>();
  for (const root of roots) walkHirData(root, hirSchema, data => {
    const value = data.value;
    if (data.shape === "NodeRef" && isNodeRef(value)) {
      const reference: SourceNodeRef = { kind: "body", value };
      if (!sourceNodeExists(reference, module, inventory, context))
        report("cross-owner-qualified", data.site, "qualified body node must exist in its named owner");
    } else if (data.shape === "ItemNodeRef" && data.parent !== null && isSourceNodeRef(data.parent)) {
      if (!sourceNodeExists(data.parent, module, inventory, context))
        report("cross-owner-qualified", data.site, "qualified item node must exist in its named owner");
    } else if (data.shape === "LocalRef" && isLocalRef(value)) {
      if (!localExists(value, module, inventory, context))
        report("local-reference", data.site, "qualified local must exist in its named body");
    }
    if (typeof data.selected !== "string" && data.selected.kind === "identity") {
      const prefix = data.selected.prefix;
      if (typeof value === "number") {
        if (prefix === "t" && (!validHirIndex(value) || context.types.terms[value] === undefined))
          report("type-reference", data.site, "type must exist in the supplied table");
        else if (prefix === "sig" && (!validHirIndex(value) || context.types.signatures[value] === undefined))
          report("signature-reference", data.site, "signature must exist in the supplied table");
        else if (prefix === "n" && data.field !== "id" && data.shape === "NodeId" &&
          (!validHirIndex(value) || !inventory.nodesById.has(value)))
          report("node-reference", data.site, "node must exist in the module arena");
        else if (prefix === "cand" && data.field !== "id" &&
          (!validHirIndex(value) || data.body === null || data.body.candidateLists[value] === undefined))
          report("candidate-list-reference", data.site, "candidate list must exist in the containing body");
        else if (prefix === "l" && data.shape === "LocalId" && data.field !== "id" && data.field !== "local" &&
          (!validHirIndex(value) || data.body === null || data.body.locals[value] === undefined))
          report("local-reference", data.site, "local must exist in the containing body");
      } else if (typeof value === "string" && prefix === "def") {
        const path = decodeDefId(value);
        if (path.kind === "invalid") report("definition-reference", data.site, "invalid definition identity");
        else {
          if (!checkedDefinitions.has(value)) {
            checkedDefinitions.add(value);
            for (const segment of path.value.segments) if (!validHirIndex(segment.ordinal))
              report("ordinal-domain", data.site, "definition segment ordinal must be a nonnegative safe integer other than negative zero");
          }
          if (!definitions.has(value) && data.shape === "DefId") {
            let exists = scopeExists.get(value);
            if (exists === undefined) { exists = context.bindingScopeOf(encodeDefId(path.value)) !== null; scopeExists.set(value, exists); }
            if (!exists) report("definition-reference", data.site, "definition must exist in the canonical declaration inventory");
          }
        }
      } else if (typeof value === "string" && prefix === "body" && !checkedBodies.has(value)) {
        checkedBodies.add(value);
        const path = decodeBodyId(value);
        if (path.kind === "invalid") report("body-owner", data.site, "invalid body identity");
        else if (!validHirIndex(path.value.ordinal))
          report("ordinal-domain", data.site, "body ordinal must be a nonnegative safe integer other than negative zero");
      }
    }
  });
}
