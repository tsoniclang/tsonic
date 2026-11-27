import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Violation } from "../diag/contract.js";
import type { ArtifactBindings, BindingVector, Execution, MemberKey, MemberStorageSelection, TypeBinding } from "../ir-types/contract.js";
import { artifactBindingsKey } from "../ir-types/index.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { MemberSelection, ResolvedCallee } from "../ir-tir/contract.js";
import type { EscapeTarget, FactsSite, FactsVerificationContext, RelationalOwner } from "./contract.js";

export function admitEscapeIdentity(target: EscapeTarget, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
  if (initial !== null) return initial;
  switch (target.kind) {
    case "return": case "throw": case "parameter": case "receiver": case "capture": case "external": return null;
    case "shared": return chargeWork(account, target.definition.length);
    case "callback": case "suspension": {
      const site = target.at;
      if (site.kind === "node") return chargeWork(account, site.node.kind === "body"
        ? site.node.value.body.length : site.node.value.owner.length);
      const identity = site.identity;
      const module = identity.module;
      return chargeWork(account, module.providerId.length + module.providerVersion.length + (module.packageName?.length ?? 0)
        + module.moduleSpecifier.length + module.providerModuleId.length + identity.exportId.length
        + (identity.memberId?.length ?? 0) + (identity.signatureId?.length ?? 0)) ?? chargeResultEntries(account, 9);
    }
  }
}

export function recordFinding<Rule extends string>(account: DataflowAccount, violations: Violation<Rule, FactsSite>[],
  placement: "first" | "last", rule: Rule, site: FactsSite, text: string): DataflowStop | null {
  const stop = chargeWork(account, 1 + (placement === "first" ? violations.length : 0)) ?? chargeResultEntries(account, 3);
  if (stop !== null) return stop;
  const finding: Violation<Rule, FactsSite> = { rule, site, detail: [{ kind: "text", value: text }] };
  if (placement === "first") violations.unshift(finding);
  else violations.push(finding);
  return null;
}

export function admitBindingIdentity(bindings: BindingVector, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
  if (initial !== null) return initial;
  function family(rows: readonly TypeBinding[]): DataflowStop | null {
    for (let position = 0; position < rows.length; position += 1) {
      const step = chargeWork(account, 1);
      if (step !== null) return step;
      const binding = rows[position];
      if (binding === undefined) continue;
      const stop = chargeWork(account, binding.parameter.length) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
    }
    return null;
  }
  const parameters = family(bindings.classBindings) ?? family(bindings.methodBindings) ?? family(bindings.capturedBindings);
  if (parameters !== null) return parameters;
  const selves = bindings.selfBindings;
  for (let position = 0; position < selves.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const binding = selves[position];
    if (binding === undefined) continue;
    const stop = chargeWork(account, binding.owner.length) ?? chargeResultEntries(account, 1);
    if (stop !== null) return stop;
  }
  return null;
}

export function admitArtifactIdentity(bindings: ArtifactBindings, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (initial !== null) return initial;
  return bindings.kind === "parametric" ? null : admitBindingIdentity(bindings.bindings, account);
}

export function admitExecutionIdentity(execution: Execution, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  return chargeWork(account, execution.instance.body.length) ?? admitArtifactIdentity(execution.instance.bindings, account);
}

export function admitOwnerIdentity(owner: RelationalOwner, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (initial !== null) return initial;
  if (owner.kind === "body") return admitExecutionIdentity(owner.execution, account);
  if (owner.key.kind === "body") return admitExecutionIdentity(owner.key.execution, account);
  return chargeWork(account, owner.key.execution.request.definition.length)
    ?? admitArtifactIdentity(owner.key.execution.request.bindings, account);
}

function admitMemberKey(key: MemberKey, account: DataflowAccount): DataflowStop | null {
  const work = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
  if (work !== null) return work;
  return key.kind === "text" ? chargeWork(account, key.value.length)
    : key.kind === "symbol" ? chargeWork(account, key.declaration.length) : null;
}

function admitCalleeIdentity(callee: ResolvedCallee | null, account: DataflowAccount): DataflowStop | null {
  const work = chargeWork(account, 1);
  if (work !== null || callee === null) return work;
  const decision = callee.decision;
  const initial = chargeWork(account, decision.advertised.declaration.length + decision.api.declaration.length)
    ?? chargeResultEntries(account, 5)
    ?? admitBindingIdentity(decision.bindings, account) ?? admitBindingIdentity(decision.implementationBindings, account);
  if (initial !== null) return initial;
  for (const parameter of decision.parameters) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    if (parameter === undefined) continue;
    if (parameter.kind === "rest") for (const _argument of parameter.arguments) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
    }
  }
  if (callee.activation !== null) {
    const stop = chargeWork(account, callee.activation.body.length)
      ?? admitArtifactIdentity(callee.activation.bindings, account);
    if (stop !== null) return stop;
  }
  return null;
}

export function admitStorageIdentity(member: MemberStorageSelection, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
  if (initial !== null) return initial;
  const key = admitMemberKey(member.key, account);
  if (key !== null) return key;
  const origins = member.origins;
  for (let index = 0; index < origins.length; index += 1) {
    const step = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (step !== null) return step;
    const origin = origins[index];
    if (origin === undefined) continue;
    const stop = origin.kind === "declared" ? chargeWork(account, origin.declaration.length)
      : origin.kind === "class-prototype" ? chargeWork(account, origin.owner.length)
        : origin.kind === "intrinsic" ? chargeWork(account, origin.symbol.length)
          : origin.kind === "source-member" ? chargeWork(account, origin.occurrence.body.length)
            : chargeWork(account, origin.owner.kind === "body" ? origin.owner.value.body.length : origin.owner.value.owner.length)
              ?? admitMemberKey(origin.key, account);
    if (stop !== null) return stop;
  }
  const declarations = member.selectedDeclarations;
  for (let index = 0; index < declarations.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return read;
    const declaration = declarations[index];
    const stop = chargeWork(account, declaration?.length ?? 0) ?? chargeResultEntries(account, 1);
    if (stop !== null) return stop;
  }
  return admitBindingIdentity(member.bindings, account) ?? chargeWork(account, member.primary?.length ?? 0);
}

export function admitSelectionIdentity(selection: MemberSelection, account: DataflowAccount): DataflowStop | null {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 3)
    ?? admitStorageIdentity(selection.decision, account);
  if (initial !== null) return initial;
  const member = selection.decision;
  const bindings = chargeWork(account, (member.getter?.declaration.length ?? 0) + (member.setter?.declaration.length ?? 0));
  if (bindings !== null) return bindings;
  return admitCalleeIdentity(selection.getter, account) ?? admitCalleeIdentity(selection.setter, account);
}

export function selectedMirBody(execution: Execution, context: Pick<FactsVerificationContext, "mirBody">,
  account: DataflowAccount): DataflowResult<MirBody | null> {
  const initial = chargeWork(account, 1) ?? admitArtifactIdentity(execution.instance.bindings, account);
  if (initial !== null) return initial;
  const value = context.mirBody(execution.instance);
  if (value === null || value.body !== execution.instance.body) return { kind: "complete", value: null };
  const identity = admitArtifactIdentity(value.bindings, account);
  if (identity !== null) return identity;
  if (artifactBindingsKey(execution.instance.bindings) !== artifactBindingsKey(value.bindings)) return { kind: "complete", value: null };
  for (const entry of value.entries) {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    if (Object.is(entry.provided, execution.provided) && Number.isSafeInteger(entry.block) && entry.block >= 0
      && !Object.is(entry.block, -0) && entry.block < value.blocks.length) return { kind: "complete", value };
  }
  return { kind: "complete", value: null };
}
