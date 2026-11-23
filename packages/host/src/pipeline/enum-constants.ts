import type { Origin } from "../ids/contract.js";
import type { DataflowAccount } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { EnumMemberInput, EnumMemberReference, EnumOfDeps, EnumValueAnswer, EnumValuePause, EnumValueRequest } from "../decls/contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { Result, UnitErrorRead, UnitRef, UnitRequest, UnitResult } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import type { EvaluateAnswer, EvaluateDeps, EvaluateRequest, EvaluationPaused, EvaluationResult } from "../evaluate/contract.js";
import { admitArtifactIdentity } from "../ir-facts/index.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { ConstantRecord } from "../ir-program/contract.js";
import type { BodyInstance, ConstantContext, ConstantReference, ConstValue, TypeTable } from "../ir-types/contract.js";
import { constantReferenceKey, instanceKey, internType, readSignature, readType } from "../ir-types/index.js";
import type { Query } from "../query/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { Route } from "./driver.js";
import { defineQuery, factRoute } from "./driver.js";
import { analysisStop } from "./analysis-stop.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import { pipelineWiring } from "./wiring.js";

type ConstantQuery<Key, Value> = Query<SourceSemanticInputs, Key, Value, SourceSemanticWitness, DeclaredSignatureErrorData>;
type ConstantRoute<Answer> = Route<SourceSemanticInputs, Answer, SourceSemanticWitness, DeclaredSignatureErrorData>;
type Refusal = Extract<Result<never>, { readonly kind: "refused" }>;
interface NamedKey {
  readonly reference: EnumMemberReference;
  readonly key: string;
}
interface EvaluationKey {
  readonly instanceKey: string;
  readonly context: ConstantContext;
}

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function completed<Value>(value: Value): UnitResult<Value> {
  return { kind: "ok", value, diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] };
}

function readyError(read: (unit: UnitRef) => UnitErrorRead, unit: UnitRef) {
  const actual = read(unit);
  return actual.kind === "completed" ? actual.error : fail("A constant answer must retain its actual completed result position.");
}

export function produceEnumConstants(inputs: HostAnalysisInputs, typed: TypedSourceBarrier, table: TypeTable,
  mir: ReadonlyMap<string, MirBody>, constantMir: ReadonlyMap<string, MirBody> | null,
  account: DataflowAccount, unit: UnitRequest): Result<readonly ConstantRecord[]> {
  const { source, database } = typed;
  if (source.enums.length === 0) return { kind: "ok", value: [], diagnostics: [] };
  const admit = (work: number, records: number): Refusal | null => {
    const stop = chargeWork(account, work) ?? (records === 0 ? null : chargeResultEntries(account, records));
    return stop === null ? null : analysisStop(stop, unit);
  };
  const setup = admit(1, 2);
  if (setup !== null) return setup;
  const members = new Map<string, EnumMemberInput>();
  const roots: NamedKey[] = [];
  function name(reference: EnumMemberReference): Result<NamedKey> {
    const stop = chargeWork(account, reference.member.length) ?? admitArtifactIdentity(reference.bindings, account);
    return stop === null ? { kind: "ok", value: { reference, key: constantReferenceKey(reference) }, diagnostics: [] } : analysisStop(stop, unit);
  }
  for (let index = 0; index < source.enums.length; index += 1) {
    const row = admit(1, 0);
    if (row !== null) return row;
    const captured = source.enums[index];
    if (captured === undefined) return fail("The checked enum inventory must be dense.");
    const { declaration, module } = captured;
    const execution = typed.required.moduleExecutions.get(module.module.module);
    if (execution === undefined) continue;
    const chapter = typed.modules.get(module.module.module);
    if (chapter?.tree.kind !== "ready-root") return fail("An executing enum's module needs its actual ready chapter.");
    const scope = source.descriptions.get(declaration.tsonic.definition)?.generics;
    if (scope === undefined || scope.classParameters.length + scope.methodParameters.length + scope.capturedParameters.length + scope.selfOwners.length !== 0)
      return fail("A source module enum retains its actual non-generic artifact environment.");
    for (let ordinal = 0; ordinal < declaration.tsonic.members.length; ordinal += 1) {
      const retained = admit(1, 4);
      if (retained !== null) return retained;
      const member = declaration.tsonic.members[ordinal];
      if (member === undefined) return fail("An actual enum member inventory must be dense.");
      const reference: EnumMemberReference = { context: "enum-member", member, bindings: execution.instance.bindings };
      const keyed = name(reference);
      if (keyed.kind === "refused") return keyed;
      if (members.has(keyed.value.key)) return fail("One actual member has one enum constant producer.");
      members.set(keyed.value.key, { module, declaration, ordinal, reference });
      roots.push(keyed.value);
    }
  }
  if (roots.length === 0) return { kind: "ok", value: [], diagnostics: [] };
  const enumDeps: EnumOfDeps = { types: table, nativeFacts: inputs.snapshot.nativeFacts, admit,
    integerType: internType(source.types, { kind: "primitive", primitive: "int64" }) };
  const evaluateDeps: EvaluateDeps = { types: table, selectedNativeFacts: inputs.snapshot.nativeFacts, limits: inputs.limits.evaluation,
    typeOf: type => readType(source.types, type), signatureOf: signature => readSignature(source.types, signature) };
  function evaluationKey(instance: BodyInstance, context: ConstantContext): Result<EvaluationKey> {
    const stop = chargeWork(account, instance.body.length) ?? admitArtifactIdentity(instance.bindings, account);
    return stop === null ? { kind: "ok", value: { instanceKey: instanceKey(instance), context }, diagnostics: [] } : analysisStop(stop, unit);
  }
  const evaluationUnit = (key: EvaluationKey): UnitRef => ({ request: { query: "evaluateConstant", key: [key.instanceKey, key.context] },
    position: { kind: "result" } });
  const enumUnit = (key: NamedKey): UnitRef => ({ request: { query: "enumOf", key: key.key }, position: { kind: "result" } });
  const originOf = (result: Extract<EvaluationResult, { readonly kind: "not-constant" }>): Origin => {
    const node = source.checked.nodeOf({ kind: "body", value: result.at });
    return node === null ? fail("An evaluator refusal retains its actual qualified checked occurrence.") : node.origin;
  };
  const readyMir: ConstantQuery<string, MirBody> = {
    name: "constantMirBody", keyData: identity => identity, answerPolicy: { kind: "refusal-only" },
    compute: (context, identity) => {
      if (context.inputs !== database.inputs) return fail("A constant MIR lookup requires the actual prepared source database.");
      const value = mir.get(identity);
      if (value === undefined) return fail("Constant evaluation demands only an independently verified MIR execution.");
      return completed(value);
    },
  };

  const evaluate: ConstantQuery<EvaluationKey, EvaluationResult> = defineQuery<
    SourceSemanticInputs, EvaluationKey, EvaluationResult, EvaluateRequest, EvaluateAnswer, EvaluationPaused, SourceSemanticWitness, DeclaredSignatureErrorData
  >({
    name: "evaluateConstant", keyData: key => evaluationUnit(key).request.key, answerPolicy: { kind: "refusal-only" },
    producer: {
      start: (base, key) => {
        if (base !== database.inputs) return fail("Constant evaluation requires the actual prepared source database.");
        const body = key.context === "enum-member" ? constantMir?.get(key.instanceKey) : mir.get(key.instanceKey);
        if (body === undefined) return fail("Constant evaluation requires its already verified initializer MIR.");
        const instance = { body: body.body, bindings: body.bindings };
        return pipelineWiring.evaluate.evaluate(evaluateDeps, instance, body, [], key.context, evaluationUnit(key).request);
      },
      resume: (paused, answers) => pipelineWiring.evaluate.resumeEvaluate(evaluateDeps, paused, answers),
    },
    route: (request): ConstantRoute<EvaluateAnswer> => {
      switch (request.kind) {
        case "mir-body": {
          const key = evaluationKey(request.instance, "compile-time");
          return key.kind === "refused" ? { way: "abandon", diagnostics: key.diagnostics }
            : factRoute(readyMir, key.value.instanceKey, body => ({ kind: "mir-body", body }));
        }
        case "const-value": {
          const reference: ConstantReference = request.reference;
          if (reference.context === "enum-member") {
            const key = name(reference);
            if (key.kind === "refused") return { way: "abandon", diagnostics: key.diagnostics };
            const unit = enumUnit(key.value);
            return factRoute(enumeration, key.value, (result, read) => ({ kind: "const-value", unit,
              value: { value: { kind: "value", value: result }, positions: [{ position: unit.position, error: readyError(read, unit) }] } }));
          }
          const key = evaluationKey(reference.initializer, reference.context);
          if (key.kind === "refused") return { way: "abandon", diagnostics: key.diagnostics };
          const unit = evaluationUnit(key.value);
          return factRoute(evaluate, key.value, (result, read) => ({ kind: "const-value", unit,
            value: { value: result, positions: [{ position: unit.position, error: readyError(read, unit) }] } }));
        }
        case "observation-value": {
          const site = source.checked.nodeOf({ kind: "body", value: request.at })?.origin;
          if (site === undefined) return fail("A constant observation names its qualified checked source.");
          const code = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
          return { way: "abandon", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
            site: { kind: "source", origin: site }, source: "evaluate", evidence: [],
            message: "Constant evaluation requires the selected layout observation.", arguments: [], related: [], fix: null }] };
        }
      }
    },
    witness: (_request, paused) => ({ kind: "constant-demand", origin: paused.witness.site.origin }),
  });

  const enumeration: ConstantQuery<NamedKey, ConstValue> = defineQuery<
    SourceSemanticInputs, NamedKey, ConstValue, EnumValueRequest, EnumValueAnswer, EnumValuePause, SourceSemanticWitness, DeclaredSignatureErrorData
  >({
    name: "enumOf", keyData: key => key.key, answerPolicy: { kind: "refusal-only" },
    producer: {
      start: (base, key) => {
        const member = members.get(key.key);
        if (base !== database.inputs || member === undefined) return fail("An enum demand must name an actual admitted source member and binding environment.");
        return pipelineWiring.decls.enumOf(enumDeps, member);
      },
      resume: (paused, answers) => pipelineWiring.decls.resumeEnumOf(enumDeps, paused, answers),
    },
    route: (request): ConstantRoute<EnumValueAnswer> => {
      if (request.kind === "predecessor") {
        const key = name(request.reference);
        return key.kind === "refused" ? { way: "abandon", diagnostics: key.diagnostics }
          : factRoute(enumeration, key.value, result => ({ kind: "value", unit: enumUnit(key.value), result }));
      }
      const key = evaluationKey(request.instance, "enum-member");
      return key.kind === "refused" ? { way: "abandon", diagnostics: key.diagnostics }
        : factRoute(evaluate, key.value, result => result.kind === "value"
          ? { kind: "value", unit: evaluationUnit(key.value), result: result.value }
          : { kind: "not-constant", origin: originOf(result) });
    },
    witness: (_request, paused) => ({ kind: "constant-demand", origin: paused.origin }),
  });

  const retained = admit(0, 1);
  if (retained !== null) return retained;
  const constants: ConstantRecord[] = [];
  for (let index = 0; index < roots.length; index += 1) {
    const step = admit(1, 2);
    if (step !== null) return step;
    const key = roots[index];
    if (key === undefined) return fail("The actual named constant roots are dense.");
    const selected = database.run(enumeration, key);
    if (selected.kind === "refused") return selected;
    if (selected.value.kind === "error") {
      const [first, ...rest] = database.diagnostics();
      if (first === undefined) return fail("An error-valued enum requires its original evaluated diagnostic.");
      return { kind: "refused", diagnostics: [first, ...rest] };
    }
    constants.push({ reference: key.reference, value: selected.value });
  }
  return { kind: "ok", value: constants, diagnostics: [] };
}
