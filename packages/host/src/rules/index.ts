import type { Result } from "../diag/contract.js";
import type { Constraint, ConstraintScheme, RuleContext, RuleOutcome, RuleTable, VariableRule } from "../ir-infer/contract.js";
import type { CreateRuleTable } from "./contract.js";
import { decideEmbedding } from "./embed.js";
import { notDecidedYet } from "./frontier.js";
import { decideOperator } from "./operators.js";
import { flowScheme, operatorScheme } from "./schemes.js";
import { localVariableRule, signatureVariableRule } from "./variables.js";

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

export const createRuleTable: CreateRuleTable = (deps): RuleTable => ({
  embed: input => decided(decideEmbedding(deps, input.from.type, input.to.type, input.role, input.context.occurrence, input.context.origin)),
  domainFit: atContext("domain-fit"),
  memoryEquivalent: atContext("memory-equivalent"),
  member: atContext("member"),
  index: atContext("index"),
  constructLiteral: atContext("literal-construction"),
  candidate: atContext("candidate"),
  operator: input => decided(decideOperator(deps, input.operator, input.operands, input.context.occurrence, input.context.origin)),
  literalFit: atContext("literal-fit"),
  protocol: atContext("protocol"),
  refinement: atContext("refinement"),
  library: atContext("library"),
  core: atContext("core"),
  closure: atContext("closure"),
  variables: { signature: signatureVariableRule(deps), local: localVariableRule(deps), binder: atVariable("binder"), literal: atVariable("literal") },
  constraints: {
    eq: atConstraint("equality"),
    flow: flowScheme(deps),
    literal: atConstraint("literal"),
    op: operatorScheme(deps),
    member: atConstraint("member"),
    index: atConstraint("index"),
    call: atConstraint("call"),
    construct: atConstraint("construct"),
    constructLiteral: atConstraint("literal-construction"),
    protocol: atConstraint("protocol"),
    refine: atConstraint("refinement"),
    discharge: atConstraint("discharge"),
    default: atConstraint("default"),
  },
});
