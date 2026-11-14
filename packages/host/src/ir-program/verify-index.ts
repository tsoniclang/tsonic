import { orderDiagnostics } from "../diag/index.js";
import type { DefId, ModuleId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { verifyMetadata, verifySummary } from "../ir-facts/index.js";
import { indexSyntaxTree } from "../ir-hir/index.js";
import { artifactBindingsData, artifactBindingsKey, instanceKey, printTypes, verifyTypes } from "../ir-types/index.js";
import type { TirVerifierInput } from "../ir-tir/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { BindingVerificationInput, BodyInstance, TypeRule, TypeSite } from "../ir-types/contract.js";
import type { Violation } from "../diag/contract.js";
import type {
  ProgramIndex,
  ProgramSite,
  ProgramVerificationContext,
  SignatureRecord,
  VerifyProgramIndex,
} from "./contract.js";

import type { ProgramLookup, ProgramViolation } from "./program-values.js";
import { artifactEnvironmentKey, compareInstances, compareText, numberDetail, programChildRule, programLookup, requireInstantiationMaximum, textDetail, uniqueRows } from "./program-values.js";
import { verifyBindingBounds, verifyBodyInventory, verifyModules, verifyPackages } from "./verify-structure.js";

function numericPosition(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;
}

function signatureKey(record: SignatureRecord): string {
  return encodeKey([artifactBindingsData(record.bindings), record.kind, record.ordinal]);
}

function compareSignature(left: SignatureRecord, right: SignatureRecord): number {
  return compareText(left.definition, right.definition) || compareText(signatureKey(left), signatureKey(right));
}

function verifySignatures(
  lookup: ProgramLookup,
  index: ProgramIndex,
  context: ProgramVerificationContext,
  modules: ReadonlyMap<ModuleId, TirVerifierInput | null>,
  bindings: BindingVerificationInput[],
  bindingSites: ProgramSite[],
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  interface EndpointRoles {
    readonly advertised: HirCallableEndpoint[];
    readonly "api-signature": HirCallableEndpoint[];
    readonly "api-body": HirCallableEndpoint[];
  }
  const endpoints = new Map<DefId, EndpointRoles | null>();
  let previous: SignatureRecord | null = null;
  for (const record of index.signatures) {
    const site: ProgramSite = { kind: "signature", signature: record.signature };
    if (previous !== null && compareSignature(previous, record) >= 0) {
      violations.push({ rule: "signatures-order", site, detail: [textDetail(previous.definition), textDetail(signatureKey(previous)), textDetail(record.definition), textDetail(signatureKey(record))] });
    }
    previous = record;
    if (!numericPosition(record.signature, index.types.signatures.length)) {
      violations.push({ rule: "signature-reference-resolves", site, detail: [numberDetail(record.signature)] });
    }
    let roles = endpoints.get(record.definition);
    if (roles === undefined) {
      const owner = lookup.definitions.get(record.definition);
      const input = owner === undefined || owner === null ? null : modules.get(owner.module);
      const declaration = input === undefined || input === null ? null : input.declarationOf(record.definition);
      if (declaration === null) roles = null;
      else {
        roles = { advertised: [], "api-signature": [], "api-body": [] };
        for (const endpoint of declaration.endpoints) roles[endpoint.role].push(endpoint);
      }
      endpoints.set(record.definition, roles);
    }
    const ordinalValid = Number.isSafeInteger(record.ordinal) && record.ordinal >= 0 && !Object.is(record.ordinal, -0);
    const answer = ordinalValid ? context.signatureIdOf(record.definition, record.kind, record.ordinal, record.bindings) : null;
    const endpoint = roles === null ? undefined : roles[record.kind][record.ordinal];
    if (endpoint === undefined || endpoint.declaration !== record.definition || !ordinalValid
      || answer === null || !Object.is(answer, record.signature)
      || (record.kind === "api-body" && endpoint.body !== record.body)) {
      violations.push({ rule: "signature-endpoints-exact", site, detail: [textDetail(record.definition), textDetail(record.kind), numberDetail(record.ordinal)] });
    }
    switch (record.bindings.kind) {
      case "parametric": break;
      case "instantiated": {
        const scope = context.facts.bindingScopeOf(record.definition);
        if (scope === null) {
          violations.push({ rule: "bindings-complete", site, detail: [textDetail(record.definition)] });
        } else {
          bindings.push({ vector: record.bindings.bindings, scope });
          bindingSites.push(site);
        }
        break;
      }
    }
  }
  return violations;
}

function verifySourceInventory(
  index: ProgramIndex,
  modules: ReadonlyMap<ModuleId, TirVerifierInput | null>,
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  const nodeCounts = new Map<ModuleId, number>();
  for (const record of index.modules) {
    const input = modules.get(record.module);
    if (input === undefined || input === null) {
      violations.push({ rule: "tir-valid", site: { kind: "module", module: record.module }, detail: [textDetail("missing-module-data")] });
      continue;
    }
    const nodes = indexSyntaxTree(input.module.tree);
    nodeCounts.set(record.module, nodes.length);
    const byId = uniqueRows(nodes, node => node.id);
    const definitions = uniqueRows(input.source.items, item => item.definition);
    for (const [position, node] of nodes.entries()) {
      if (node.id !== position || Object.is(node.id, -0)) {
        violations.push({ rule: "module-node-id-dense", site: { kind: "node", module: record.module, node: node.id }, detail: [numberDetail(position), numberDetail(node.id)] });
      }
    }
    for (const item of record.items) {
      const site: ProgramSite = { kind: "definition", definition: item.definition };
      const original = definitions.get(item.definition);
      if (original === undefined || original === null || !Object.is(original.node, item.node)) {
        violations.push({ rule: "item-definition-resolves", site, detail: [numberDetail(item.node)] });
      }
      const node = byId.get(item.node);
      if (!numericPosition(item.node, nodes.length) || node === undefined || node === null) {
        violations.push({ rule: "definition-node-resolves", site, detail: [numberDetail(item.node)] });
      } else if (node.origin.module !== record.module) {
        violations.push({ rule: "definition-node-owner-exact", site, detail: [textDetail(node.origin.module), numberDetail(node.id)] });
      }
    }
  }
  for (const record of index.bodies) {
    const input = modules.get(record.module);
    const site: ProgramSite = { kind: "body", instance: record.instance };
    const body = input === undefined || input === null ? null : input.bodyOf(record.instance);
    const count = nodeCounts.get(record.module);
    if (count === undefined || !numericPosition(record.root, count) || body === null || !Object.is(body.root.id, record.root)) {
      violations.push({ rule: "body-root-resolves", site, detail: [numberDetail(record.root)] });
    } else if (body.owner !== record.owner || body.body !== record.instance.body || body.root.origin.module !== record.module) {
      violations.push({ rule: "node-body-ownership", site, detail: [textDetail(body.owner), textDetail(body.body), numberDetail(body.root.id)] });
    }
  }
  return violations;
}

function verifyBodyBindings(
  index: ProgramIndex, context: ProgramVerificationContext,
  bindings: BindingVerificationInput[], sites: ProgramSite[],
): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  for (const record of index.bodies) {
    switch (record.instance.bindings.kind) {
      case "parametric": break;
      case "instantiated": {
        const site: ProgramSite = { kind: "body", instance: record.instance };
        const scope = context.facts.bindingScopeOf(record.owner);
        if (scope === null) violations.push({ rule: "bindings-complete", site, detail: [textDetail(record.owner)] });
        else {
          bindings.push({ vector: record.instance.bindings.bindings, scope });
          sites.push(site);
        }
        break;
      }
    }
  }
  for (const constant of index.constants) {
    const site: ProgramSite = { kind: "body", instance: constant.initializer };
    const owner = context.facts.bodyOwner(constant.initializer.body);
    if (owner === null) {
      violations.push({ rule: "cross-owner-reference-resolves", site, detail: [textDetail(constant.initializer.body)] });
    } else if (constant.initializer.bindings.kind === "instantiated") {
      const scope = context.facts.bindingScopeOf(owner);
      if (scope === null) violations.push({ rule: "bindings-complete", site, detail: [textDetail(owner)] });
      else {
        bindings.push({ vector: constant.initializer.bindings.bindings, scope });
        sites.push(site);
      }
    }
  }
  return violations;
}

function verifyPublishedRecords(index: ProgramIndex, context: ProgramVerificationContext): readonly ProgramViolation[] {
  const violations: ProgramViolation[] = [];
  let previousMetadata: { readonly definition: DefId; readonly environment: string } | null = null;
  const metadataKeys = new Set<string>();
  for (const record of index.metadata) {
    const environment = artifactBindingsKey(record.key.bindings);
    const key = artifactEnvironmentKey(record.key.definition, record.key.bindings);
    const site: ProgramSite = { kind: "artifact", artifact: { kind: "metadata", definition: record.key.definition }, bindings: record.key.bindings };
    if (previousMetadata !== null && (compareText(previousMetadata.definition, record.key.definition) || compareText(previousMetadata.environment, environment)) > 0) {
      violations.push({ rule: "metadata-order", site, detail: [textDetail(previousMetadata.definition), textDetail(previousMetadata.environment), textDetail(key)] });
    }
    if (metadataKeys.has(key)) violations.push({ rule: "metadata-key-unique", site, detail: [textDetail(key)] });
    metadataKeys.add(key);
    previousMetadata = { definition: record.key.definition, environment };
    for (const child of verifyMetadata(record, context.facts)) {
      violations.push({ rule: programChildRule("metadata-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  let previousSummary: { readonly definition: DefId; readonly environment: string } | null = null;
  const summaryKeys = new Set<string>();
  for (const summary of index.summaries) {
    const environment = artifactBindingsKey(summary.key.bindings);
    const key = artifactEnvironmentKey(summary.key.definition, summary.key.bindings);
    const site: ProgramSite = { kind: "artifact", artifact: { kind: "summary", definition: summary.key.definition }, bindings: summary.key.bindings };
    if (previousSummary !== null && (compareText(previousSummary.definition, summary.key.definition) || compareText(previousSummary.environment, environment)) > 0) {
      violations.push({ rule: "summaries-order", site, detail: [textDetail(previousSummary.definition), textDetail(previousSummary.environment), textDetail(key)] });
    }
    if (summaryKeys.has(key)) violations.push({ rule: "summary-key-unique", site, detail: [textDetail(key)] });
    summaryKeys.add(key);
    previousSummary = { definition: summary.key.definition, environment };
    for (const child of verifySummary(summary, context.facts)) {
      violations.push({ rule: programChildRule("summary-valid", child.rule), site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  let previousConstant: BodyInstance | null = null;
  const constantKeys = new Set<string>();
  for (const constant of index.constants) {
    const key = instanceKey(constant.initializer);
    const site: ProgramSite = { kind: "body", instance: constant.initializer };
    if (previousConstant !== null && compareInstances(previousConstant, constant.initializer) > 0) {
      violations.push({ rule: "constants-order", site, detail: [textDetail(instanceKey(previousConstant)), textDetail(key)] });
    }
    if (constantKeys.has(key)) violations.push({ rule: "constant-key-unique", site, detail: [textDetail(key)] });
    constantKeys.add(key);
    previousConstant = constant.initializer;
    if (!numericPosition(constant.value.type, index.types.terms.length)) {
      violations.push({ rule: "constant-type-resolves", site, detail: [numberDetail(constant.value.type)] });
    }
  }
  const ordered = orderDiagnostics(index.diagnostics);
  if (ordered.some((diagnostic, position) => diagnostic !== index.diagnostics[position])) {
    violations.push({ rule: "diagnostics-order", site: { kind: "index" }, detail: [] });
  }
  return violations;
}

export const verifyProgramIndex: VerifyProgramIndex = (index, context) => {
  requireInstantiationMaximum(context.limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  const lookup = programLookup(index);
  const violations: ProgramViolation[] = [];
  if (index.schema !== 1) violations.push({ rule: "schema-supported", site: { kind: "index" }, detail: [numberDetail(index.schema)] });
  for (const group of [verifyPackages(lookup, index), verifyModules(lookup, index, context), verifyBodyInventory(lookup, index, context)]) {
    for (const violation of group) violations.push(violation);
  }
  if (printTypes(index.types) !== printTypes(context.facts.types)) {
    violations.push({ rule: "shared-type-table", site: { kind: "index" }, detail: [] });
  }
  const modules = new Map<ModuleId, TirVerifierInput | null>();
  for (const record of index.modules) modules.set(record.module, context.tirOf(record.module));
  const bindings: BindingVerificationInput[] = [];
  const bindingSites: ProgramSite[] = [];
  for (const group of [verifySourceInventory(index, modules), verifySignatures(lookup, index, context, modules, bindings, bindingSites), verifyBodyBindings(index, context, bindings, bindingSites), verifyPublishedRecords(index, context), verifyBindingBounds(index, context)]) {
    for (const violation of group) violations.push(violation);
  }
  const bindingViolations = new Map<number, Violation<TypeRule, TypeSite>[]>();
  for (const child of verifyTypes({
    table: index.types, bindings, evidence: [], nominalOf: context.facts.nominalOf,
    nodeExists: context.facts.nodeExists, localExists: context.facts.localExists,
  })) {
    if (child.site.kind === "binding") {
      const previous = bindingViolations.get(child.site.vector);
      if (previous === undefined) bindingViolations.set(child.site.vector, [child]);
      else previous.push(child);
    } else violations.push({ rule: "types-valid", site: { kind: "index" }, detail: [textDetail(child.rule), ...child.detail] });
  }
  for (const [position, site] of bindingSites.entries()) {
    for (const child of bindingViolations.get(position) ?? []) {
      const rule = child.rule === "binding-vector-complete" || child.rule === "self-binding-order" ? "bindings-complete" : "types-valid";
      violations.push({ rule, site, detail: [textDetail(child.rule), ...child.detail] });
    }
  }
  return violations;
};
