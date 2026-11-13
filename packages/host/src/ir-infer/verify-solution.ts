import type { Violation } from "../diag/contract.js";
import type { BodyId, DefId, NodeRef } from "../ids/contract.js";
import type { BindingVector, TypeEvidence } from "../ir-types/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type {
  ApplicationArgument, ApplicationDecision, BodyTyping, ConstraintDecision, ConstraintRef, DeferredDecision, EmbeddingDecision, EmbeddingProof, InferRule, InferSite,
  InferVerificationInput, MemberDecision, OperationDecision, SolvedConstraint,
} from "./contract.js";
import { callableEndpointKey, hasOverloadEndpoints, selectedEndpointRoleFaults } from "../ir-hir/index.js";
import { printDocument } from "./print.js";
import { candidateKey, compareContribution, compareNumber, compareText, constraintKey, contributionKey, emit, nodeKey, ordinal } from "./verify-contributions.js";
import type { Inventory, OwnedConstraint } from "./verify-contributions.js";

function proofReferences(proof: EmbeddingProof, constraint: ConstraintRef,
  output: Violation<InferRule, InferSite>[]): void {
  for (const [index, step] of proof.steps.entries()) {
    const site: InferSite = { kind: "proof", constraint, step: index };
    for (const premise of step.premises) {
      if (!ordinal(premise) || premise >= proof.steps.length) emit(output, "proof-reference", site, "premises");
      else if (premise >= index) emit(output, "proof-order", site, "premises");
    }
  }
  if (!ordinal(proof.conclusion) || proof.conclusion >= proof.steps.length)
    emit(output, "proof-reference", { kind: "proof", constraint, step: proof.conclusion }, "conclusion");
}

function actualEndpoint(input: InferVerificationInput, endpoint: HirCallableEndpoint,
  endpoints: Map<DefId, ReadonlySet<string>>, owner: DefId = endpoint.declaration): boolean {
  let values = endpoints.get(owner);
  if (values === undefined) {
    const declaration = input.declarationOf(owner);
    values = new Set(declaration === null ? [] : declaration.endpoints.map(endpoint => callableEndpointKey(endpoint)));
    endpoints.set(owner, values);
  }
  return values.has(callableEndpointKey(endpoint));
}

function overloadedDeclaration(input: InferVerificationInput, owner: DefId, overloads: Map<DefId, boolean>): boolean {
  let overloaded = overloads.get(owner);
  if (overloaded === undefined) {
    const declaration = input.declarationOf(owner);
    overloaded = declaration !== null && hasOverloadEndpoints(declaration.endpoints);
    overloads.set(owner, overloaded);
  }
  return overloaded;
}

function memberReferences(input: InferVerificationInput, member: MemberDecision, site: InferSite,
  endpoints: Map<DefId, ReadonlySet<string>>, output: Violation<InferRule, InferSite>[]): void {
  if (member.primary !== null && !member.selectedDeclarations.includes(member.primary))
    emit(output, "endpoint-agreement", site, "primary");
  if (member.getter !== null && !actualEndpoint(input, member.getter, endpoints))
    emit(output, "endpoint-agreement", site, "getter");
  if (member.setter !== null && !actualEndpoint(input, member.setter, endpoints))
    emit(output, "endpoint-agreement", site, "setter");
  if ((member.location.kind === "accessor") !== (member.getter !== null || member.setter !== null))
    emit(output, "access-location", site, "location");
}

function mappingReferences(input: InferVerificationInput, decision: ApplicationDecision, site: InferSite,
  arguments_: readonly ApplicationArgument[] | null, operandCount: number | null, endpoints: Map<DefId, ReadonlySet<string>>,
  overloads: Map<DefId, boolean>, bodies: ReadonlyMap<BodyId, BodyTyping>,
  output: Violation<InferRule, InferSite>[]): void {
  const signature = ordinal(decision.api.signature) ? input.types.signatures[decision.api.signature] : undefined;
  if (!actualEndpoint(input, decision.advertised, endpoints) ||
    !actualEndpoint(input, decision.api, endpoints, decision.advertised.declaration))
    emit(output, "endpoint-agreement", site, "endpoints");
  if (signature === undefined || decision.parameters.length !== signature.parameters.length)
    emit(output, "parameter-mapping-total", site, "parameters");
  let previous: number | null = null;
  for (const [index, parameter] of decision.parameters.entries()) {
    const formal = signature?.parameters[index];
    if (!ordinal(parameter.parameter) || previous !== null && compareNumber(parameter.parameter, previous) <= 0)
      emit(output, "parameter-mapping-total", site, "parameters");
    if (parameter.parameter !== index || formal === undefined ||
      parameter.kind === "default" && (formal.kind !== "default" || parameter.initializer !== formal.initializer) ||
      parameter.kind === "omitted" && (formal.kind !== "optional" || parameter.type !== formal.type) ||
      parameter.kind === "rest" && (formal.kind !== "rest" || formal.passing !== parameter.passing) ||
      parameter.kind === "argument" && (formal.kind === "rest" || formal.passing !== parameter.passing))
      emit(output, "parameter-mapping-total", site, "formal");
    previous = parameter.parameter;
    if (parameter.kind === "argument" && (!ordinal(parameter.argument) ||
      operandCount !== null && parameter.argument >= operandCount ||
      parameter.component !== null && (!ordinal(parameter.component) || arguments_ !== null &&
        (arguments_[parameter.argument]?.tuple === null || arguments_[parameter.argument]?.tuple?.[parameter.component] === undefined))))
      emit(output, "parameter-mapping-total", site, "arguments");
    if (parameter.kind === "rest") {
      let previousArgument: number | null = null;
      for (const argument of parameter.arguments) {
        if (!ordinal(argument) || previousArgument !== null && compareNumber(argument, previousArgument) <= 0 ||
          operandCount !== null && argument >= operandCount)
          emit(output, "parameter-mapping-total", site, "arguments");
        previousArgument = argument;
      }
    }
  }
  const roles = selectedEndpointRoleFaults(overloadedDeclaration(input, decision.advertised.declaration, overloads),
    decision.advertised, decision.api);
  if ((roles & 1) !== 0) emit(output, "api-endpoint-role", site, "advertised");
  if ((roles & 2) !== 0) emit(output, "api-endpoint-role", site, "api");
  if (decision.completion.signature !== decision.api.signature) emit(output, "endpoint-agreement", site, "completion");
  if (decision.api.body !== null) {
    const body = bodies.get(decision.api.body);
    if (body !== undefined && (body.signature !== decision.completion.signature || body.completion !== decision.completion.completion ||
      body.yielded !== decision.completion.yielded || body.sent !== decision.completion.sent))
      emit(output, "body-completion-endpoints", site, "completion");
  }
}

type DecisionWork =
  | { readonly kind: "embedding"; readonly value: EmbeddingDecision }
  | { readonly kind: "application"; readonly value: ApplicationDecision;
      readonly arguments: readonly ApplicationArgument[] | null; readonly operandCount: number | null }
  | { readonly kind: "operation"; readonly value: OperationDecision }
  | { readonly kind: "proof"; readonly value: EmbeddingProof };

interface SolutionContext {
  readonly input: InferVerificationInput;
  readonly inventory: Inventory;
  readonly endpoints: Map<DefId, ReadonlySet<string>>;
  readonly overloads: Map<DefId, boolean>;
  readonly bodies: ReadonlyMap<BodyId, BodyTyping>;
}

function sameNode(left: NodeRef | null, right: NodeRef | null): boolean {
  return left === null ? right === null : right !== null && nodeKey(left) === nodeKey(right);
}

function deferredReferences(context: SolutionContext, record: DeferredDecision, constraint: OwnedConstraint | undefined,
  site: InferSite, output: Violation<InferRule, InferSite>[]): void {
  if (constraint === undefined) return;
  const { input, inventory, endpoints, overloads } = context;
  const value = constraint.value;
  const invocation = record.invocation;
  const ruleContext = invocation.input.context;
  if (!sameNode(ruleContext.occurrence, value.occurrence))
    emit(output, "deferred-invocation", site, "occurrence");
  let matches = false;
  switch (invocation.rule) {
    case "embed": matches = value.kind === "flow" && invocation.input.role === value.role; break;
    case "domain-fit": matches = value.kind === "flow" || value.kind === "eq"; break;
    case "memory-equivalent": matches = value.kind === "eq"; break;
    case "member": matches = value.kind === "member" && invocation.input.access === value.access &&
      printDocument({ kind: "MemberKey", value: invocation.input.key }) === printDocument({ kind: "MemberKey", value: value.key }) &&
      invocation.input.origins.length === value.origins.length && invocation.input.origins.every((origin, index) => {
        const original = value.origins[index];
        return original !== undefined && printDocument({ kind: "MemberOrigin", value: origin }) === printDocument({ kind: "MemberOrigin", value: original });
      }); break;
    case "index": matches = value.kind === "index" && invocation.input.access === value.access; break;
    case "construct-literal": matches = value.kind === "construct-literal" && invocation.input.construction === value.construction &&
      (invocation.input.destination === null) === (value.destination === null) && invocation.input.parts.length === value.parts.length &&
      invocation.input.parts.every((part, index) => {
        const original = value.parts[index];
        return original !== undefined && part.kind === original.kind && sameNode(part.occurrence, original.occurrence) &&
          (part.kind !== "property" || original.kind === "property" &&
            printDocument({ kind: "MemberKey", value: part.key }) === printDocument({ kind: "MemberKey", value: original.key }));
      }); break;
    case "candidate": {
      const candidateInput = invocation.input;
      matches = candidateInput.candidates.every(candidate => ordinal(candidate.ordinal) &&
        candidate.advertised.declaration === candidate.declaration &&
        selectedEndpointRoleFaults(overloadedDeclaration(input, candidate.declaration, overloads), candidate.advertised, candidate.api) === 0 &&
        actualEndpoint(input, candidate.advertised, endpoints, candidate.declaration) &&
        actualEndpoint(input, candidate.api, endpoints, candidate.declaration));
      if (candidateInput.kind === "accessor-get" || candidateInput.kind === "accessor-set") break;
      if (value.kind !== "call" && value.kind !== "construct") {
        matches = false;
        break;
      }
      const application = value.application;
      const candidates = inventory.candidates.get(candidateKey(constraint.set.body, application.candidates));
      matches = matches && candidateInput.kind === value.kind && (candidateInput.receiver === null) === (application.receiver === null) &&
        candidateInput.typeArguments.length === application.typeArguments.length &&
        candidateInput.arguments.length === application.arguments.length && candidateInput.arguments.every((argument, index) => {
          const original = application.arguments[index];
          return original !== undefined && argument.kind === original.kind && sameNode(argument.occurrence, original.occurrence) &&
            (original.tuple === null ? argument.tuple === null : argument.tuple !== null && argument.tuple.length === original.tuple.length);
        }) && candidates !== undefined && candidateInput.candidates.length === candidates.candidates.length &&
        candidateInput.candidates.every((candidate, index) => {
          const original = candidates.candidates[index];
          return original !== undefined && candidate.ordinal === original.ordinal && candidate.declaration === original.declaration &&
            candidate.advertised.declaration === original.declaration && actualEndpoint(input, candidate.advertised, endpoints) &&
              actualEndpoint(input, candidate.api, endpoints, original.declaration);
        });
      break;
    }
    case "operator": matches = value.kind === "op" && invocation.input.operator === value.operator &&
      invocation.input.operands.length === value.operands.length && sameNode(invocation.input.permissionScope, value.permissionScope); break;
    case "literal-fit": matches = value.kind === "literal" &&
      printDocument({ kind: "LiteralValue", value: invocation.input.literal }) === printDocument({ kind: "LiteralValue", value: value.value }); break;
    case "protocol": matches = value.kind === "protocol" && invocation.input.kind === value.protocol && invocation.input.asynchronous === value.asynchronous &&
      (invocation.input.subject === null) === (value.subject === null) && invocation.input.operands.length === value.operands.length; break;
    case "refinement": matches = value.kind === "refine"; break;
    case "closure": matches = value.kind === "closure" && invocation.input.captures.length === value.captures.length; break;
    case "library": case "core": {
      matches = true;
      if (invocation.rule === "core" && (value.kind === "call" || value.kind === "construct"))
        matches = sameNode(invocation.input.permissionScope, value.application.permissionScope);
      break;
    }
  }
  if (!matches) emit(output, "deferred-invocation", site, "input");
}

function decisionRecords(context: SolutionContext, record: SolvedConstraint, constraint: OwnedConstraint | undefined,
  output: Violation<InferRule, InferSite>[]): void {
  const { input, inventory, endpoints, overloads, bodies } = context;
  const decision = record.decision;
  const site: InferSite = { kind: "constraint", constraint: record.constraint };
  const pending: DecisionWork[] = [];
  switch (decision.kind) {
    case "flow": case "literal": pending.push({ kind: "embedding", value: decision.embedding }); break;
    case "call": case "construct":
      {
        const arguments_ = constraint?.value.kind === "call" || constraint?.value.kind === "construct"
          ? constraint.value.application.arguments : null;
        pending.push({ kind: "application", value: decision.application, arguments: arguments_, operandCount: arguments_?.length ?? null });
        if (constraint?.value.kind === "call" || constraint?.value.kind === "construct") {
          const list = inventory.candidates.get(candidateKey(constraint.set.body, constraint.value.application.candidates));
          const candidate = ordinal(decision.application.candidate) && list !== undefined
            ? inventory.originalCandidates.get(list)?.get(decision.application.candidate) : undefined;
          if (candidate === undefined || candidate === null) emit(output, "candidate-reference", site, "candidate");
          else if (candidate.declaration !== decision.application.advertised.declaration)
            emit(output, "endpoint-agreement", site, "candidate");
        }
      }
      if (decision.operation?.kind === "decided") pending.push({ kind: "operation", value: decision.operation.decision });
      else if (decision.operation?.kind === "deferred") deferredReferences(context, decision.operation.deferred, constraint, site, output);
      break;
    case "op": case "construct-literal": case "protocol": pending.push({ kind: "operation", value: decision.operation }); break;
    case "member": case "index": memberReferences(input, decision.member, site, endpoints, output); break;
    case "refine": if (decision.refinement.kind === "narrowed") pending.push({ kind: "proof", value: decision.refinement.proof }); break;
    case "discharge":
      if (constraint?.value.kind === "discharge" &&
        (decision.proof.checkerDiagnostic !== constraint.value.checkerDiagnostic ||
          decision.proof.obligations.length !== constraint.value.obligations.length))
        emit(output, "proof-reference", site, "obligations");
      for (const [index, obligation] of decision.proof.obligations.entries())
        if (obligation.ordinal !== index || Object.is(obligation.ordinal, -0))
          emit(output, "proof-reference", site, "ordinal");
      for (const obligation of decision.proof.obligations) pending.push({ kind: "proof", value: obligation.evidence });
      break;
    case "closure":
      if (constraint?.value.kind === "closure" && decision.closure.captures.length !== constraint.value.captures.length)
        emit(output, "closure-capture-total", site, "captures");
      break;
    case "deferred": deferredReferences(context, decision.deferred, constraint, site, output); break;
  }
  for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
    if (task.kind === "proof") proofReferences(task.value, record.constraint, output);
    else if (task.kind === "embedding") {
      if (task.value.kind === "conversion") pending.push({ kind: "proof", value: task.value.proof });
    } else if (task.kind === "application") mappingReferences(input, task.value, site, task.arguments, task.operandCount, endpoints, overloads, bodies, output);
    else {
      const operation = task.value.operation;
      if (operation.kind === "conversion") pending.push({ kind: "embedding", value: operation.embedding });
      if (operation.kind === "object-construction" || operation.kind === "array-construction") {
        const original = constraint?.value.kind === "construct-literal" ? constraint.value : null;
        if (original !== null && (original.parts.length !== operation.parts.length ||
          operation.kind !== `${original.construction}-construction`)) emit(output, "construction-part-total", site, "parts");
        for (const [index, part] of operation.parts.entries()) {
          const source = original?.parts[index];
          if (part.part !== index || Object.is(part.part, -0) || source !== undefined &&
            (part.source.body !== source.occurrence.body || part.source.node !== source.occurrence.node))
            emit(output, "construction-part-total", site, "parts");
          if (part.member !== null) memberReferences(input, part.member, site, endpoints, output);
          pending.push({ kind: "embedding", value: part.embedding });
        }
      }
      if (operation.kind === "protocol") {
        const original = constraint?.value.kind === "protocol" ? constraint.value : null;
        if (original !== null && (operation.protocol !== original.protocol || operation.asynchronous !== original.asynchronous))
          emit(output, "protocol-channels", site, "protocol");
        for (const step of operation.steps) {
          if (step.operation.kind === "call") {
            if (step.result !== step.operation.application.result) emit(output, "protocol-channels", site, "result");
            pending.push({ kind: "application", value: step.operation.application, arguments: null, operandCount: step.operands.length });
          }
          if (step.role === "completion" && step.result !== operation.completion)
            emit(output, "protocol-channels", site, "completion");
          if (step.role === "value" && step.result !== operation.value)
            emit(output, "protocol-channels", site, "value");
        }
      }
    }
  }
}

function decisionMatches(decision: ConstraintDecision, constraint: OwnedConstraint): boolean {
  return decision.kind === "deferred" || decision.kind === constraint.value.kind;
}

export function verifySolution(input: InferVerificationInput, inventory: Inventory,
  output: Violation<InferRule, InferSite>[]): void {
  const solution = input.solution;
  if (solution === null) return;
  const groupSite: InferSite = { kind: "group", group: input.group.id };
  const endpoints = new Map<DefId, ReadonlySet<string>>();
  const bodies = new Map<BodyId, BodyTyping>();
  for (const body of solution.bodies) if (!bodies.has(body.body)) bodies.set(body.body, body);
  const context: SolutionContext = { input, inventory, endpoints, overloads: new Map(), bodies };
  if (solution.group !== input.group.id) emit(output, "group-ownership", groupSite, "solution");
  const published = new Set<number>();
  let previousVariable: number | null = null;
  for (const variable of solution.variables) {
    const site: InferSite = { kind: "variable", group: input.group.id, variable: variable.variable };
    if (published.has(variable.variable)) emit(output, "one-publication-per-variable", site, "variables");
    published.add(variable.variable);
    if (!ordinal(variable.variable) || !inventory.variables.has(variable.variable)) emit(output, "solution-total", site, "variables");
    if (previousVariable !== null && compareNumber(variable.variable, previousVariable) <= 0)
      emit(output, "solution-order", site, "variables");
    previousVariable = variable.variable;
  }
  for (const variable of inventory.variables.keys()) if (!published.has(variable))
    emit(output, "solution-total", { kind: "variable", group: input.group.id, variable }, "variables");
  const solved = new Set<string>();
  let previous: SolvedConstraint | null = null;
  for (const record of solution.constraints) {
    const site: InferSite = { kind: "constraint", constraint: record.constraint };
    const key = constraintKey(record.constraint);
    const target = inventory.constraints.get(key);
    if (target === undefined || !ordinal(record.constraint.index)) emit(output, "constraint-reference", site, "constraint");
    else if (!decisionMatches(record.decision, target)) emit(output, "decision-kind", site, "decision");
    if (solved.has(key) || previous !== null && (compareText(previous.constraint.body, record.constraint.body) ||
      compareNumber(previous.constraint.index, record.constraint.index)) >= 0) emit(output, "solution-order", site, "constraints");
    solved.add(key); previous = record;
    decisionRecords(context, record, target, output);
  }
  for (const [key, value] of inventory.constraints) if (!solved.has(key))
    emit(output, "solution-total", { kind: "constraint", constraint: value.reference }, "constraints");
  let previousCheck: typeof solution.checks[number] | null = null;
  for (const [index, check] of solution.checks.entries()) {
    const site: InferSite = { kind: "check", index };
    const contribution = inventory.contributions.get(contributionKey(check.contribution));
    if (!ordinal(check.variable) || !ordinal(check.bound.variable) || check.bound.variable !== check.variable ||
      contributionKey(check.bound.contribution) !== contributionKey(check.contribution) ||
      contribution === undefined || !contribution.bounds.has(check.variable) || !published.has(check.variable) ||
      check.outcome.kind === "satisfied" && check.outcome.embedding.kind === "refused")
      emit(output, "check-recorded", site, "bound");
    if (contribution !== undefined && check.outcome.kind === "satisfied" && check.outcome.embedding.kind === "conversion")
      proofReferences(check.outcome.embedding.proof, contribution.value.constraint, output);
    if (previousCheck !== null && (compareNumber(previousCheck.variable, check.variable) ||
      compareContribution(previousCheck.contribution, check.contribution)) >= 0) emit(output, "solution-order", site, "checks");
    previousCheck = check;
  }
  const bodyIds = new Set<string>();
  let previousBody: string | null = null;
  for (const body of solution.bodies) {
    const site: InferSite = { kind: "body", body: body.body };
    if (bodyIds.has(body.body) || previousBody !== null && compareText(previousBody, body.body) >= 0)
      emit(output, "solution-order", site, "bodies");
    if (!inventory.sets.has(body.body)) emit(output, "body-completion-endpoints", site, "body");
    const signature = ordinal(body.signature) ? input.types.signatures[body.signature] : undefined;
    if (signature === undefined) emit(output, "body-completion-endpoints", site, "signature");
    else if (signature.declaration !== null) {
      const declaration = input.declarationOf(signature.declaration);
      if (declaration === null || declaration.parameterCount !== null && !actualEndpoint(input,
        { declaration: signature.declaration, role: "api-body", signature: body.signature, body: body.body }, endpoints))
        emit(output, "body-completion-endpoints", site, "endpoint");
    }
    bodyIds.add(body.body); previousBody = body.body;
  }
  for (const body of input.group.bodies) if (!bodyIds.has(body))
    emit(output, "body-completion-endpoints", { kind: "body", body }, "body");
}

type BindingTask = { readonly site: InferSite } & (
  | { readonly kind: "vector"; readonly value: BindingVector; readonly definition: DefId | null }
  | { readonly kind: "evidence"; readonly value: TypeEvidence }
  | { readonly kind: "decision"; readonly value: ConstraintDecision }
  | { readonly kind: "member"; readonly value: MemberDecision }
  | { readonly kind: "application"; readonly value: ApplicationDecision }
  | { readonly kind: "operation"; readonly value: OperationDecision }
  | { readonly kind: "deferred"; readonly value: DeferredDecision }
);

export function visitBindings(input: InferVerificationInput,
  visit: (vector: BindingVector, site: InferSite, definition: DefId | null) => void,
  visitEvidence: (value: TypeEvidence, site: InferSite) => void): void {
  const roots: BindingTask[] = [];
  for (const set of input.constraints) {
    const bodySite: InferSite = { kind: "body", body: set.body };
    for (const list of set.candidates) for (const candidate of list.candidates) {
      if (candidate.bindings.kind === "available") roots.push({ kind: "vector", value: candidate.bindings.value,
        definition: candidate.declaration, site: bodySite });
    }
    for (const evidence of set.evidence) roots.push({ kind: "evidence", value: evidence, site: bodySite });
    for (const [index, constraint] of set.constraints.entries()) {
      if (constraint.kind === "flow" || constraint.kind === "member" || constraint.kind === "index" || constraint.kind === "protocol" ||
        constraint.kind === "closure")
        roots.push({ kind: "vector", value: constraint.bindings, definition: null,
          site: { kind: "constraint", constraint: { body: set.body, index } } });
    }
  }
  const solution = input.solution;
  if (solution !== null) {
    for (const variable of solution.variables) roots.push({ kind: "evidence", value: variable.value,
      site: { kind: "variable", group: input.group.id, variable: variable.variable } });
    for (const constraint of solution.constraints) roots.push({ kind: "decision", value: constraint.decision,
      site: { kind: "constraint", constraint: constraint.constraint } });
    for (const [index, check] of solution.checks.entries()) roots.push({ kind: "evidence", value: check.bound.value,
      site: { kind: "check", index } });
  }
  const pending: BindingTask[] = [];
  const push = (tasks: readonly BindingTask[]) => {
    for (const task of [...tasks].reverse()) pending.push(task);
  };
  push(roots);
  for (let selected = pending.pop(); selected !== undefined; selected = pending.pop()) {
    const task = selected;
    const children: BindingTask[] = [];
    const evidence = (value: TypeEvidence | null) => {
      if (value !== null) children.push({ kind: "evidence", value, site: task.site });
    };
    const vector = (value: BindingVector, definition: DefId | null = null) => {
      children.push({ kind: "vector", value, definition, site: task.site });
    };
    if (task.kind === "vector") visit(task.value, task.site, task.definition);
    else if (task.kind === "evidence") {
      visitEvidence(task.value, task.site);
      if (task.value.sum !== null) vector(task.value.sum.bindings);
    } else if (task.kind === "member") vector(task.value.bindings);
    else if (task.kind === "application") {
      vector(task.value.bindings, task.value.advertised.declaration);
      vector(task.value.implementationBindings, task.value.api.declaration);
    } else if (task.kind === "decision") {
      const value = task.value;
      if (value.kind === "member" || value.kind === "index") children.push({ kind: "member", value: value.member, site: task.site });
      else if (value.kind === "call" || value.kind === "construct") {
        children.push({ kind: "application", value: value.application, site: task.site });
        if (value.operation?.kind === "decided") children.push({ kind: "operation", value: value.operation.decision, site: task.site });
        else if (value.operation?.kind === "deferred") children.push({ kind: "deferred", value: value.operation.deferred, site: task.site });
      } else if (value.kind === "op" || value.kind === "construct-literal" || value.kind === "protocol")
        children.push({ kind: "operation", value: value.operation, site: task.site });
      else if (value.kind === "deferred") children.push({ kind: "deferred", value: value.deferred, site: task.site });
    } else if (task.kind === "operation") {
      const operation = task.value.operation;
      if (operation.kind === "library" || operation.kind === "core") vector(operation.bindings, operation.declaration);
      else if (operation.kind === "object-construction" || operation.kind === "array-construction") {
        for (const part of operation.parts) if (part.member !== null) children.push({ kind: "member", value: part.member, site: task.site });
      } else if (operation.kind === "protocol") {
        for (const step of operation.steps) {
          if (step.operation.kind === "core") vector(step.operation.bindings, step.operation.declaration);
          else if (step.operation.kind === "call") children.push({ kind: "application", value: step.operation.application, site: task.site });
        }
      }
    } else {
      const invocation = task.value.invocation;
      vector(invocation.input.context.bindings);
      switch (invocation.rule) {
        case "embed": evidence(invocation.input.from); evidence(invocation.input.to); break;
        case "domain-fit": evidence(invocation.input.value); evidence(invocation.input.domain); break;
        case "memory-equivalent": evidence(invocation.input.left); evidence(invocation.input.right); break;
        case "member": evidence(invocation.input.receiver); break;
        case "index": evidence(invocation.input.receiver); evidence(invocation.input.key); break;
        case "construct-literal":
          for (const part of invocation.input.parts) evidence(part.value);
          evidence(invocation.input.destination); break;
        case "candidate":
          evidence(invocation.input.callee); evidence(invocation.input.receiver);
          for (const value of invocation.input.typeArguments) evidence(value);
          for (const argument of invocation.input.arguments) {
            evidence(argument.value);
            if (argument.tuple !== null) for (const value of argument.tuple) evidence(value);
          }
          for (const endpoint of invocation.input.candidates) vector(endpoint.bindings, endpoint.declaration);
          break;
        case "operator": for (const operand of invocation.input.operands) evidence(operand); break;
        case "literal-fit": evidence(invocation.input.destination); break;
        case "protocol":
          evidence(invocation.input.subject);
          for (const operand of invocation.input.operands) evidence(operand);
          evidence(invocation.input.completion); evidence(invocation.input.yielded);
          evidence(invocation.input.sent); evidence(invocation.input.thrown); break;
        case "refinement": evidence(invocation.input.source); evidence(invocation.input.checked); break;
        case "library":
          evidence(invocation.input.receiver);
          for (const argument of invocation.input.arguments) evidence(argument);
          evidence(invocation.input.result); break;
        case "core":
          for (const operand of invocation.input.operands) evidence(operand);
          evidence(invocation.input.result); break;
        case "closure":
          evidence(invocation.input.callable);
          for (const capture of invocation.input.captures) evidence(capture);
          break;
      }
    }
    push(children);
  }
}
