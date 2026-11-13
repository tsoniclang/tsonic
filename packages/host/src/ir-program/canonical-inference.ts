import type {
  ApplicationDecision,
  ClosureDecision,
  ConstructionPartDecision,
  DeferredDecision,
  DeferredInvocation,
  EmbeddingDecision,
  EmbeddingProof,
  MemberDecision,
  OperationDecision,
  OperationIdentity,
  ParameterMapping,
  ProtocolStepDecision,
  RefinementDecision,
  RuleContext,
  RuleOutcome,
} from "../ir-infer/contract.js";
import type { TypeRewrite } from "./canonical-types.js";
import { rewriteBindings, rewriteComponent, rewriteCoreCapture, rewriteEndpoint, rewriteEvidence } from "./canonical-types.js";

export function rewriteEmbeddingProof(rewrite: TypeRewrite, proof: EmbeddingProof, at: string): EmbeddingProof {
  return {
    steps: proof.steps.map((step, position) => ({
      from: rewriteComponent(rewrite, step.from, `${at}.steps[${position}].from`),
      to: rewriteComponent(rewrite, step.to, `${at}.steps[${position}].to`),
      rule: step.rule,
      premises: step.premises,
    })),
    conclusion: proof.conclusion,
  };
}

export function rewriteEmbedding(rewrite: TypeRewrite, decision: EmbeddingDecision, at: string): EmbeddingDecision {
  switch (decision.kind) {
    case "identity":
    case "refused":
      return decision;
    case "conversion":
      return {
        kind: "conversion", conversion: decision.conversion,
        proof: rewriteEmbeddingProof(rewrite, decision.proof, `${at}.proof`),
        check: decision.check,
      };
  }
}

export function rewriteMember(rewrite: TypeRewrite, member: MemberDecision): MemberDecision {
  return {
    key: member.key,
    origins: member.origins,
    selectedDeclarations: member.selectedDeclarations,
    primary: member.primary,
    read: member.read === null ? null : rewrite.type(member.read),
    write: member.write === null ? null : rewrite.type(member.write),
    getter: member.getter === null ? null : rewriteEndpoint(rewrite, member.getter),
    setter: member.setter === null ? null : rewriteEndpoint(rewrite, member.setter),
    bindings: rewriteBindings(rewrite, member.bindings),
    location: member.location,
  };
}

function rewriteParameterMapping(rewrite: TypeRewrite, parameter: ParameterMapping): ParameterMapping {
  switch (parameter.kind) {
    case "argument":
    case "default":
    case "rest":
      return parameter;
    case "omitted":
      return { kind: "omitted", parameter: parameter.parameter, type: rewrite.type(parameter.type) };
  }
}

export function rewriteApplication(rewrite: TypeRewrite, application: ApplicationDecision): ApplicationDecision {
  return {
    candidate: application.candidate,
    advertised: rewriteEndpoint(rewrite, application.advertised),
    api: rewriteEndpoint(rewrite, application.api),
    bindings: rewriteBindings(rewrite, application.bindings),
    implementationBindings: rewriteBindings(rewrite, application.implementationBindings),
    parameters: application.parameters.map(parameter => rewriteParameterMapping(rewrite, parameter)),
    completion: {
      signature: rewrite.signature(application.completion.signature),
      completion: rewrite.type(application.completion.completion),
      yielded: application.completion.yielded === null ? null : rewrite.type(application.completion.yielded),
      sent: application.completion.sent === null ? null : rewrite.type(application.completion.sent),
    },
    result: rewrite.type(application.result),
    activation: application.activation,
  };
}

export function rewriteConstructionPart(
  rewrite: TypeRewrite,
  part: ConstructionPartDecision,
  at: string,
): ConstructionPartDecision {
  return {
    part: part.part,
    source: part.source,
    destination: rewriteComponent(rewrite, part.destination, `${at}.destination`),
    member: part.member === null ? null : rewriteMember(rewrite, part.member),
    embedding: rewriteEmbedding(rewrite, part.embedding, `${at}.embedding`),
  };
}

function rewriteProtocolStep(rewrite: TypeRewrite, step: ProtocolStepDecision): ProtocolStepDecision {
  const operands = step.operands.map(operand => rewrite.type(operand));
  const result = rewrite.type(step.result);
  switch (step.operation.kind) {
    case "call":
      return {
        role: step.role,
        operation: { kind: "call", application: rewriteApplication(rewrite, step.operation.application) },
        operands,
        result,
      };
    case "core":
      return {
        role: step.role,
        operation: {
          kind: "core", declaration: step.operation.declaration,
          bindings: rewriteBindings(rewrite, step.operation.bindings),
        },
        operands,
        result,
      };
    case "completion":
      return { role: step.role, operation: { kind: "completion" }, operands, result };
  }
}

function rewriteOperationIdentity(rewrite: TypeRewrite, operation: OperationIdentity, at: string): OperationIdentity {
  switch (operation.kind) {
    case "native-operator":
    case "bigint-operator":
    case "string-operator":
    case "boolean-operator":
    case "absence-test":
    case "pointer-address":
    case "pointer-read":
    case "pointer-write":
    case "pointer-offset":
    case "type-query":
    case "discard":
      return operation;
    case "object-construction":
    case "array-construction":
      return {
        kind: operation.kind,
        parts: operation.parts.map((part, position) => rewriteConstructionPart(rewrite, part, `${at}.parts[${position}]`)),
      };
    case "protocol":
      return {
        kind: "protocol",
        protocol: operation.protocol,
        asynchronous: operation.asynchronous,
        steps: operation.steps.map(step => rewriteProtocolStep(rewrite, step)),
        value: rewrite.type(operation.value),
        completion: rewrite.type(operation.completion),
        yielded: operation.yielded === null ? null : rewrite.type(operation.yielded),
        sent: operation.sent === null ? null : rewrite.type(operation.sent),
        thrown: rewrite.type(operation.thrown),
      };
    case "conversion":
      return {
        kind: "conversion", from: rewrite.type(operation.from), to: rewrite.type(operation.to),
        embedding: rewriteEmbedding(rewrite, operation.embedding, `${at}.embedding`),
      };
    case "library":
    case "core":
      return {
        kind: operation.kind, declaration: operation.declaration,
        bindings: rewriteBindings(rewrite, operation.bindings),
      };
  }
}

export function rewriteOperation(rewrite: TypeRewrite, operation: OperationDecision, at: string): OperationDecision {
  return {
    kind: "selected",
    operation: rewriteOperationIdentity(rewrite, operation.operation, `${at}.operation`),
    operands: operation.operands.map(operand => rewrite.type(operand)),
    result: rewrite.type(operation.result),
    execution: operation.execution,
  };
}

function rewriteContext(rewrite: TypeRewrite, context: RuleContext): RuleContext {
  return { occurrence: context.occurrence, origin: context.origin, bindings: rewriteBindings(rewrite, context.bindings) };
}

function rewriteInvocation(rewrite: TypeRewrite, invocation: DeferredInvocation, at: string): DeferredInvocation {
  const input = invocation.input;
  const context = rewriteContext(rewrite, input.context);
  switch (invocation.rule) {
    case "embed":
      return { rule: "embed", input: {
        context, from: rewriteEvidence(rewrite, invocation.input.from),
        to: rewriteEvidence(rewrite, invocation.input.to), role: invocation.input.role,
      } };
    case "domain-fit":
      return { rule: "domain-fit", input: {
        context, value: rewriteEvidence(rewrite, invocation.input.value),
        domain: rewriteEvidence(rewrite, invocation.input.domain),
      } };
    case "memory-equivalent":
      return { rule: "memory-equivalent", input: {
        context, left: rewriteEvidence(rewrite, invocation.input.left), right: rewriteEvidence(rewrite, invocation.input.right),
      } };
    case "member":
      return { rule: "member", input: {
        context, receiver: rewriteEvidence(rewrite, invocation.input.receiver), key: invocation.input.key,
        access: invocation.input.access, origins: invocation.input.origins,
      } };
    case "index":
      return { rule: "index", input: {
        context, receiver: rewriteEvidence(rewrite, invocation.input.receiver),
        key: rewriteEvidence(rewrite, invocation.input.key), access: invocation.input.access,
      } };
    case "construct-literal":
      return { rule: "construct-literal", input: {
        context, construction: invocation.input.construction,
        parts: invocation.input.parts.map(part => ({ ...part, value: rewriteEvidence(rewrite, part.value) })),
        destination: invocation.input.destination === null ? null : rewriteEvidence(rewrite, invocation.input.destination),
      } };
    case "candidate":
      return { rule: "candidate", input: {
        context, kind: invocation.input.kind, callee: rewriteEvidence(rewrite, invocation.input.callee),
        receiver: invocation.input.receiver === null ? null : rewriteEvidence(rewrite, invocation.input.receiver),
        typeArguments: invocation.input.typeArguments.map(argument => rewriteEvidence(rewrite, argument)),
        arguments: invocation.input.arguments.map(argument => ({
          occurrence: argument.occurrence, kind: argument.kind, value: rewriteEvidence(rewrite, argument.value),
          tuple: argument.tuple === null ? null : argument.tuple.map(element => rewriteEvidence(rewrite, element)),
        })),
        candidates: invocation.input.candidates.map(candidate => ({
          ordinal: candidate.ordinal, declaration: candidate.declaration,
          advertised: rewriteEndpoint(rewrite, candidate.advertised), api: rewriteEndpoint(rewrite, candidate.api),
          bindings: rewriteBindings(rewrite, candidate.bindings), conditionalFailure: candidate.conditionalFailure,
        })),
      } };
    case "operator":
      return { rule: "operator", input: {
        context, operator: invocation.input.operator,
        operands: invocation.input.operands.map(operand => rewriteEvidence(rewrite, operand)),
        permissionScope: invocation.input.permissionScope,
      } };
    case "literal-fit":
      return { rule: "literal-fit", input: {
        context, literal: invocation.input.literal, destination: rewriteEvidence(rewrite, invocation.input.destination),
      } };
    case "protocol":
      return { rule: "protocol", input: {
        context, kind: invocation.input.kind, asynchronous: invocation.input.asynchronous,
        subject: invocation.input.subject === null ? null : rewriteEvidence(rewrite, invocation.input.subject),
        operands: invocation.input.operands.map(operand => rewriteEvidence(rewrite, operand)),
        completion: invocation.input.completion === null ? null : rewriteEvidence(rewrite, invocation.input.completion),
        yielded: invocation.input.yielded === null ? null : rewriteEvidence(rewrite, invocation.input.yielded),
        sent: invocation.input.sent === null ? null : rewriteEvidence(rewrite, invocation.input.sent),
        thrown: rewriteEvidence(rewrite, invocation.input.thrown),
      } };
    case "refinement":
      return { rule: "refinement", input: {
        context, source: rewriteEvidence(rewrite, invocation.input.source), checked: rewriteEvidence(rewrite, invocation.input.checked),
      } };
    case "library":
      return { rule: "library", input: {
        context, declaration: invocation.input.declaration,
        receiver: invocation.input.receiver === null ? null : rewriteEvidence(rewrite, invocation.input.receiver),
        arguments: invocation.input.arguments.map(argument => rewriteEvidence(rewrite, argument)),
        result: rewriteEvidence(rewrite, invocation.input.result),
      } };
    case "core":
      return { rule: "core", input: {
        context, captured: rewriteCoreCapture(rewrite, invocation.input.captured, `${at}.input.captured`),
        declaration: invocation.input.declaration, operands: invocation.input.operands.map(operand => rewriteEvidence(rewrite, operand)),
        result: rewriteEvidence(rewrite, invocation.input.result), permissionScope: invocation.input.permissionScope,
      } };
    case "closure":
      return { rule: "closure", input: {
        context, callable: rewriteEvidence(rewrite, invocation.input.callable),
        captures: invocation.input.captures.map(capture => rewriteEvidence(rewrite, capture)),
      } };
  }
}

export function rewriteClosureDecision(rewrite: TypeRewrite, decision: ClosureDecision): ClosureDecision {
  return { carrier: rewrite.type(decision.carrier), captures: decision.captures, execution: decision.execution };
}

export function rewriteDeferred(rewrite: TypeRewrite, deferred: DeferredDecision, at: string): DeferredDecision {
  return { invocation: rewriteInvocation(rewrite, deferred.invocation, `${at}.invocation`), result: rewrite.type(deferred.result) };
}

export function rewriteOutcome<Decision>(
  rewrite: TypeRewrite,
  outcome: RuleOutcome<Decision>,
  transform: (decision: Decision) => Decision,
  at: string,
): RuleOutcome<Decision> {
  switch (outcome.kind) {
    case "decided": return { kind: "decided", decision: transform(outcome.decision) };
    case "deferred": return { kind: "deferred", deferred: rewriteDeferred(rewrite, outcome.deferred, `${at}.deferred`) };
  }
}

export function rewriteRefinement(rewrite: TypeRewrite, refinement: RefinementDecision, at: string): RefinementDecision {
  switch (refinement.kind) {
    case "identity": return { kind: "identity", type: rewrite.type(refinement.type) };
    case "narrowed": return {
      kind: "narrowed", source: rewrite.type(refinement.source), result: rewrite.type(refinement.result),
      proof: rewriteEmbeddingProof(rewrite, refinement.proof, `${at}.proof`),
      failure: refinement.failure,
    };
  }
}
