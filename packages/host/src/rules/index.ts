import type { Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { Constraint, ConstraintScheme, RuleContext, RuleOutcome, ThrowOperandUseInput, VariableRule } from "../ir-infer/contract.js";
import { readType } from "../ir-types/index.js";
import type { CreateRuleTable, RulesDeps, TypePatternMatch } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { decideOperator } from "./operators.js";
import { decideIndex, flowScheme, indexScheme, memberRules, narrowOptionalRead, operatorScheme } from "./schemes.js";
import { localVariableRule, signatureVariableRule } from "./variables.js";
import { defaultScheme, literalVariableRule } from "./literal-default.js";
import { decideLiteralFit, literalScheme } from "./literal-fit.js";
import { callScheme, decideCandidate } from "./candidates.js";
import { decideCaptureModes } from "./captures.js";
import { matchTypePattern as matchPattern } from "./type-pattern.js";

export { decideCaptureModes };
export const matchTypePattern: TypePatternMatch = matchPattern;

const decided = <Decision>(decision: Decision): Result<RuleOutcome<Decision>> =>
  ({ kind: "ok", value: { kind: "decided", decision }, diagnostics: [] });

const atContext = (rule: string) => (input: { readonly context: RuleContext }): never =>
  notDecidedYet(`the ${rule} rule`, input.context.origin);

const atConstraint = <Kind extends Constraint>(name: string): ConstraintScheme<Kind> => ({
  enumerate: input => notDecidedYet(`the enumeration of the ${name} constraint at node ${input.constraint.occurrence.node} of ${input.constraint.occurrence.body}`, null),
  evaluate: input => notDecidedYet(`the evaluation of the ${name} constraint at node ${input.constraint.occurrence.node} of ${input.constraint.occurrence.body}`, null),
});

const atVariable = (kind: string): VariableRule => ({
  finalize: input => notDecidedYet(`the finalisation of the ${kind} variable ${input.variable.id}`, null),
  check: input => notDecidedYet(`the bound check of the ${kind} variable ${input.variable.id}`, null),
});

function checkThrowOperandUse(deps: RulesDeps, { instance, statement, operand, origin, selected }: ThrowOperandUseInput): Result<null> {
  if (statement.body !== instance.body || operand.body !== instance.body || selected.producer.body !== instance.body)
    return callerDefect("a throw use requires its actual operand and producer in the same body instance", origin);
  const type = readType(deps.types, selected.kind === "application" ? selected.decision.result : selected.type);
  if (type.kind !== "intrinsic" || type.intrinsic !== "void") return { kind: "ok", value: null, diagnostics: [] };
  const code = hostDiagnosticCode("TSONIC_EFFECT_ONLY_THROW_OPERAND");
  return { kind: "refused", diagnostics: [{
    code: { kind: "host", name: code, rendered: code }, severity: "error", site: { kind: "source", origin },
    source: "rules", evidence: [], message: "An effect-only expression does not supply a value to throw.",
    arguments: [], related: [], fix: null,
  }] };
}

export const createRuleTable: CreateRuleTable = deps => {
  const { member, resumeMember, scheme } = memberRules(deps);
  return {
    decideCaptureModes: input => decideCaptureModes(deps, input),
    checkThrowOperandUse: input => checkThrowOperandUse(deps, input),
    embed: input => decided(decideEmbedding(deps, input.from, input.to, input.role, input.context.occurrence, input.context.origin)),
    domainFit: atContext("domain-fit"),
    memoryEquivalent: atContext("memory-equivalent"),
    member,
    resumeMember,
    index: input => decided(decideIndex(deps, input)),
    constructLiteral: atContext("literal-construction"),
    candidate: input => {
      const selected = decideCandidate(deps, input);
      return selected.kind === "refused" ? selected : decided(selected.value);
    },
    operator: input => decided(decideOperator(deps, input.operator, input.operands, input.context.occurrence, input.context.origin)),
    literalFit: input => decided(decideLiteralFit(deps, input.literal, input.destination.type, input.context.origin)),
    protocol: atContext("protocol"),
    refinement: input => {
      if (input.source.type === input.checked.type) return decided({ kind: "identity", type: input.source.type });
      const refinement = narrowOptionalRead(deps, input.context.occurrence, input.source.type, input.checked.type);
      return refinement === null ? notDecidedYet("the refinement rule", input.context.origin) : decided(refinement);
    },
    library: atContext("library"),
    core: atContext("core"),
    closure: atContext("closure"),
    variables: { signature: signatureVariableRule(deps), local: localVariableRule(deps), binder: atVariable("binder"), literal: literalVariableRule(deps) },
    constraints: {
      eq: atConstraint("equality"),
      flow: flowScheme(deps),
      literal: literalScheme(deps),
      op: operatorScheme(deps),
      member: scheme,
      index: indexScheme(deps),
      call: callScheme(deps),
      construct: atConstraint("construct"),
      constructLiteral: atConstraint("literal-construction"),
      protocol: atConstraint("protocol"),
      refine: atConstraint("refinement"),
      discharge: atConstraint("discharge"),
      default: defaultScheme,
    },
  };
};
