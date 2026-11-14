import type {
  BlockId, BodyId, ConstId, DefId, Derivation, ExpansionId, LocalId, LocalRef,
  ModuleId, NodeId, NodeRef, Origin, PlaceId, SigId, SourceNodeRef, TyId,
} from "../ids/contract.js";
import {
  blockId, constId, decodeBodyId, decodeDefId, decodeModuleId, encodeBodyId,
  encodeDefId, encodeModuleId, expansionId, localId, nodeId, placeId, sigId, tyId,
} from "../ids/index.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ComponentSelector, ConstantReference,
  ConstructionDefinition, ExactRational, LiteralValue, MemberKey, MemberOrigin,
  NativePrimitive, PassingMode, SelfBinding, SumArmRole, SumFamily, TypeBinding,
  TypeComponent, TypeParameterIdentity,
} from "../ir-types/contract.js";
import type { HirBinaryOperator, HirCallableEndpoint, HirUnaryOperator } from "../ir-hir/contract.js";
import type {
  ApplicationDecision, CompletionEndpoint, ConstructionPartDecision, CorrespondenceStep,
  AccessLocation, CheckFailure, CheckRequirement, EmbeddingDecision, EmbeddingProof, FailureKind, HandleActivation, MemberDecision, OperationDecision, OperationExecution, OperationIdentity, ReceiverAccess,
  ParameterMapping, ProtocolKind, ProtocolStepDecision, ProtocolStepOperation,
} from "../ir-infer/contract.js";
import type { MemberSelection, ResolvedCallee, TypedOperation } from "../ir-tir/contract.js";
import { choice, field, finish, identityWire, literals, nullable, numberToken, ownedScalar, record, stringToken, variants, vector } from "./text.js";
import type { ScalarWires } from "./text.js";
import type { Wire } from "./text.js";

type PointerOperation = { readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" };

type MarkerOperation = { readonly kind: "type-query" | "discard" };

export interface DecisionWires {
  readonly nodeWire: Wire<NodeId>;
  readonly localWire: Wire<LocalId>;
  readonly blockWire: Wire<BlockId>;
  readonly placeWire: Wire<PlaceId>;
  readonly typeWire: Wire<TyId>;
  readonly signatureWire: Wire<SigId>;
  readonly constantWire: Wire<ConstId>;
  readonly bodyWire: Wire<BodyId>;
  readonly definitionWire: Wire<DefId>;
  readonly moduleWire: Wire<ModuleId>;
  readonly originWire: Wire<Origin>;
  readonly nodeRefWire: Wire<NodeRef>;
  readonly localRefWire: Wire<LocalRef>;
  readonly bindingsWire: Wire<BindingVector>;
  readonly artifactWire: Wire<ArtifactBindings>;
  readonly instanceWire: Wire<BodyInstance>;
  readonly referenceWire: Wire<ConstantReference>;
  readonly rationalWire: Wire<ExactRational>;
  readonly literalWire: Wire<LiteralValue>;
  readonly passingWire: Wire<PassingMode>;
  readonly calleeWire: Wire<ResolvedCallee>;
  readonly selectionWire: Wire<MemberSelection>;
  readonly operationWire: Wire<TypedOperation>;
}

export function createDecisionWires(scalars: ScalarWires): DecisionWires {
  const { bigintWire, booleanWire, numberWire, stringWire } = scalars;
  function numeric<Identity extends number>(prefix: string, construct: (value: number) => Identity): Wire<Identity> {
    return ownedScalar(numberToken(prefix), construct);
  }

  const nodeWire: Wire<NodeId> = numeric("n", nodeId);

  const localWire: Wire<LocalId> = numeric("l", localId);

  const blockWire: Wire<BlockId> = numeric("b", blockId);

  const placeWire: Wire<PlaceId> = numeric("p", placeId);

  const typeWire: Wire<TyId> = numeric("t", tyId);

  const signatureWire: Wire<SigId> = numeric("sig", sigId);

  const constantWire: Wire<ConstId> = numeric("c", constId);

  const bodyWire: Wire<BodyId> = identityWire("body", decodeBodyId, encodeBodyId);

  const definitionWire: Wire<DefId> = identityWire("def", decodeDefId, encodeDefId);

  const moduleWire: Wire<ModuleId> = identityWire("mod", decodeModuleId, encodeModuleId);

  const expansionWire: Wire<ExpansionId> = ownedScalar(stringToken("exp"), expansionId);

  const passWire = literals(["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata",
    "liveness", "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"]);

  const lowering = record<Derivation & { readonly kind: "lowering" }>("lowering", () =>
    field("pass", () => passWire, value => value.pass, pass => finish(() => ({ kind: "lowering", pass }))));

  const expansion = record<Derivation & { readonly kind: "expansion" }>("expansion", () =>
    field("expansion", () => expansionWire, value => value.expansion, selected => finish(() => ({ kind: "expansion", expansion: selected }))));

  const derivationWire: Wire<Derivation> = variants([choice("lowering", () => lowering), choice("expansion", () => expansion)],
    (value, path, next) => value.kind === "lowering" ? lowering.write(value, path, next) : expansion.write(value, path, next));

  const originWire = record<Origin>("Origin", () =>
    field("module", () => moduleWire, value => value.module, module =>
      field("start", () => numberWire, value => value.start, start =>
        field("length", () => numberWire, value => value.length, length =>
          field("derived", () => vector(() => derivationWire), value => value.derived, derived => finish(() => ({ module, start, length, derived })))))));

  const nodeRefWire = record<NodeRef>("NodeRef", () =>
    field("body", () => bodyWire, value => value.body, body =>
      field("node", () => nodeWire, value => value.node, node => finish(() => ({ body, node })))));

  const localRefWire = record<LocalRef>("LocalRef", () =>
    field("body", () => bodyWire, value => value.body, body =>
      field("local", () => localWire, value => value.local, local => finish(() => ({ body, local })))));

  const itemRef = record<{ readonly owner: DefId; readonly node: NodeId }>("ItemNodeRef", () =>
    field("owner", () => definitionWire, value => value.owner, owner =>
      field("node", () => nodeWire, value => value.node, node => finish(() => ({ owner, node })))));

  const sourceBody = record<SourceNodeRef & { readonly kind: "body" }>("body", () =>
    field("value", () => nodeRefWire, value => value.value, value => finish(() => ({ kind: "body", value }))));

  const sourceItem = record<SourceNodeRef & { readonly kind: "item" }>("item", () =>
    field("value", () => itemRef, value => value.value, value => finish(() => ({ kind: "item", value }))));

  const sourceWire: Wire<SourceNodeRef> = variants([choice("body", () => sourceBody), choice("item", () => sourceItem)],
    (value, path, next) => value.kind === "body" ? sourceBody.write(value, path, next) : sourceItem.write(value, path, next));

  const parameterWire = record<TypeParameterIdentity>("TypeParameterIdentity", () =>
    field("owner", () => definitionWire, value => value.owner, owner =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ owner, index })))));

  const bound = record<TypeBinding & { readonly kind: "bound" }>("bound", () =>
    field("parameter", () => parameterWire, value => value.parameter, parameter =>
      field("type", () => typeWire, value => value.type, type => finish(() => ({ kind: "bound", parameter, type })))));

  const rigid = record<TypeBinding & { readonly kind: "rigid" }>("rigid", () =>
    field("parameter", () => parameterWire, value => value.parameter, parameter => finish(() => ({ kind: "rigid", parameter }))));

  const bindingWire: Wire<TypeBinding> = variants([choice("bound", () => bound), choice("rigid", () => rigid)],
    (value, path, next) => value.kind === "bound" ? bound.write(value, path, next) : rigid.write(value, path, next));

  const selfBound = record<SelfBinding & { readonly kind: "bound" }>("bound", () =>
    field("owner", () => definitionWire, value => value.owner, owner =>
      field("type", () => typeWire, value => value.type, type => finish(() => ({ kind: "bound", owner, type })))));

  const selfRigid = record<SelfBinding & { readonly kind: "rigid" }>("rigid", () =>
    field("owner", () => definitionWire, value => value.owner, owner => finish(() => ({ kind: "rigid", owner }))));

  const selfWire: Wire<SelfBinding> = variants([choice("bound", () => selfBound), choice("rigid", () => selfRigid)],
    (value, path, next) => value.kind === "bound" ? selfBound.write(value, path, next) : selfRigid.write(value, path, next));

  const bindingsWire = record<BindingVector>("BindingVector", () =>
    field("classBindings", () => vector(() => bindingWire), value => value.classBindings, classBindings =>
      field("methodBindings", () => vector(() => bindingWire), value => value.methodBindings, methodBindings =>
        field("capturedBindings", () => vector(() => bindingWire), value => value.capturedBindings, capturedBindings =>
          field("selfBindings", () => vector(() => selfWire), value => value.selfBindings, selfBindings =>
            finish(() => ({ classBindings, methodBindings, capturedBindings, selfBindings })))))));

  const parametric = record<ArtifactBindings & { readonly kind: "parametric" }>("parametric", () => finish(() => ({ kind: "parametric" })));

  const instantiated = record<ArtifactBindings & { readonly kind: "instantiated" }>("instantiated", () =>
    field("bindings", () => bindingsWire, value => value.bindings, bindings => finish(() => ({ kind: "instantiated", bindings }))));

  const artifactWire: Wire<ArtifactBindings> = variants([choice("parametric", () => parametric), choice("instantiated", () => instantiated)],
    (value, path, next) => value.kind === "parametric" ? parametric.write(value, path, next) : instantiated.write(value, path, next));

  const instanceWire = record<BodyInstance>("BodyInstance", () =>
    field("body", () => bodyWire, value => value.body, body =>
      field("bindings", () => artifactWire, value => value.bindings, bindings => finish(() => ({ body, bindings })))));

  const referenceWire = record<ConstantReference>("ConstantReference", () =>
    field("initializer", () => instanceWire, value => value.initializer, initializer => finish(() => ({ initializer }))));

  const rationalWire = record<ExactRational>("ExactRational", () =>
    field("numerator", () => bigintWire, value => value.numerator, numerator =>
      field("denominator", () => bigintWire, value => value.denominator, denominator =>
        field("negativeZero", () => booleanWire, value => value.negativeZero, negativeZero => finish(() => ({ numerator, denominator, negativeZero }))))));

  const literalNumber = record<LiteralValue & { readonly kind: "number" }>("number", () =>
    field("token", () => stringWire, value => value.token, token =>
      field("value", () => rationalWire, value => value.value, value => finish(() => ({ kind: "number", token, value })))));

  const literalBigint = record<LiteralValue & { readonly kind: "bigint" }>("bigint", () =>
    field("token", () => stringWire, value => value.token, token =>
      field("value", () => bigintWire, value => value.value, value => finish(() => ({ kind: "bigint", token, value })))));

  const literalString = record<LiteralValue & { readonly kind: "string" }>("string", () =>
    field("value", () => stringWire, value => value.value, value => finish(() => ({ kind: "string", value }))));

  const literalBoolean = record<LiteralValue & { readonly kind: "boolean" }>("boolean", () =>
    field("value", () => booleanWire, value => value.value, value => finish(() => ({ kind: "boolean", value }))));

  const literalAbsence = record<LiteralValue & { readonly kind: "absence" }>("absence", () => finish(() => ({ kind: "absence" })));

  const literalSymbol = record<LiteralValue & { readonly kind: "unique-symbol" }>("unique-symbol", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration => finish(() => ({ kind: "unique-symbol", declaration }))));

  const literalWire: Wire<LiteralValue> = variants([
    choice("number", () => literalNumber), choice("bigint", () => literalBigint), choice("string", () => literalString),
    choice("boolean", () => literalBoolean), choice("absence", () => literalAbsence), choice("unique-symbol", () => literalSymbol),
  ], (value, path, next) => {
    switch (value.kind) {
      case "number": return literalNumber.write(value, path, next);
      case "bigint": return literalBigint.write(value, path, next);
      case "string": return literalString.write(value, path, next);
      case "boolean": return literalBoolean.write(value, path, next);
      case "absence": return literalAbsence.write(value, path, next);
      case "unique-symbol": return literalSymbol.write(value, path, next);
    }
  });

  const keyText = record<MemberKey & { readonly kind: "text" }>("text", () =>
    field("value", () => stringWire, value => value.value, value => finish(() => ({ kind: "text", value }))));

  const keyNumber = record<MemberKey & { readonly kind: "number" }>("number", () =>
    field("value", () => rationalWire, value => value.value, value => finish(() => ({ kind: "number", value }))));

  const keySymbol = record<MemberKey & { readonly kind: "symbol" }>("symbol", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration => finish(() => ({ kind: "symbol", declaration }))));

  const memberKeyWire: Wire<MemberKey> = variants([choice("text", () => keyText), choice("number", () => keyNumber), choice("symbol", () => keySymbol)],
    (value, path, next) => {
      switch (value.kind) {
        case "text": return keyText.write(value, path, next);
        case "number": return keyNumber.write(value, path, next);
        case "symbol": return keySymbol.write(value, path, next);
      }
    });

  const declaredOrigin = record<MemberOrigin & { readonly kind: "declared" }>("declared", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration => finish(() => ({ kind: "declared", declaration }))));

  const prototypeOrigin = record<MemberOrigin & { readonly kind: "class-prototype" }>("class-prototype", () =>
    field("owner", () => definitionWire, value => value.owner, owner => finish(() => ({ kind: "class-prototype", owner }))));

  const mappedOrigin = record<MemberOrigin & { readonly kind: "mapped" }>("mapped", () =>
    field("owner", () => sourceWire, value => value.owner, owner =>
      field("key", () => memberKeyWire, value => value.key, key => finish(() => ({ kind: "mapped", owner, key })))));

  const memberOriginWire: Wire<MemberOrigin> = variants([
    choice("declared", () => declaredOrigin), choice("class-prototype", () => prototypeOrigin), choice("mapped", () => mappedOrigin),
  ], (value, path, next) => {
    switch (value.kind) {
      case "declared": return declaredOrigin.write(value, path, next);
      case "class-prototype": return prototypeOrigin.write(value, path, next);
      case "mapped": return mappedOrigin.write(value, path, next);
    }
  });

  const constructionDefinition = record<ConstructionDefinition>("ConstructionDefinition", () =>
    field("occurrence", () => nodeRefWire, value => value.occurrence, occurrence =>
      field("captures", () => vector(() => localRefWire), value => value.captures, captures => finish(() => ({ occurrence, captures })))));

  const sumArm = record<SumArmRole>("SumArmRole", () =>
    field("authoredIndex", () => numberWire, value => value.authoredIndex, authoredIndex =>
      field("component", () => sourceWire, value => value.component, component =>
        field("member", () => typeWire, value => value.member, member => finish(() => ({ authoredIndex, component, member }))))));

  const sumFamily = record<SumFamily>("SumFamily", () =>
    field("origin", () => literals(["authored", "inferred"]), value => value.origin, origin =>
      field("component", () => componentWire, value => value.component, component =>
        field("parameters", () => vector(() => parameterWire), value => value.parameters, parameters =>
          field("roles", () => vector(() => sumArm), value => value.roles, roles => finish(() => ({ origin, component, parameters, roles })))))));

  const classValue = record<ComponentSelector & { readonly kind: "class-value" }>("class-value", () => finish(() => ({ kind: "class-value" })));

  const optionalValue = record<ComponentSelector & { readonly kind: "optional-value" }>("optional-value", () => finish(() => ({ kind: "optional-value" })));

  const arrayElement = record<ComponentSelector & { readonly kind: "array-element" }>("array-element", () => finish(() => ({ kind: "array-element" })));

  const intersectionResult = record<ComponentSelector & { readonly kind: "intersection-result" }>("intersection-result", () => finish(() => ({ kind: "intersection-result" })));

  const projectionSource = record<ComponentSelector & { readonly kind: "projection-source" }>("projection-source", () => finish(() => ({ kind: "projection-source" })));

  const awaited = record<ComponentSelector & { readonly kind: "awaited" }>("awaited", () => finish(() => ({ kind: "awaited" })));

  const constructionArgument = record<ComponentSelector & { readonly kind: "construction-argument" }>("construction-argument", () =>
    field("definition", () => constructionDefinition, value => value.definition, definition =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind: "construction-argument", definition, index })))));

  function indexedSelector<Kind extends "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly index: number }>(kind, () =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind, index }))));
  }

  function tailSelector<Kind extends "argument-tail" | "parameter-tail">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly start: number }>(kind, () =>
      field("start", () => numberWire, value => value.start, start => finish(() => ({ kind, start }))));
  }

  const memberSelector = record<ComponentSelector & { readonly kind: "member" }>("member", () =>
    field("origin", () => memberOriginWire, value => value.origin, origin => finish(() => ({ kind: "member", origin }))));

  function indexSelector<Kind extends "index-key" | "index-value">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly declaration: DefId }>(kind, () =>
      field("declaration", () => definitionWire, value => value.declaration, declaration => finish(() => ({ kind, declaration }))));
  }

  const parameterSelector = record<ComponentSelector & { readonly kind: "parameter" }>("parameter", () =>
    field("signature", () => signatureWire, value => value.signature, signature =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind: "parameter", signature, index })))));

  function signatureSelector<Kind extends "receiver" | "result">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly signature: SigId }>(kind, () =>
      field("signature", () => signatureWire, value => value.signature, signature => finish(() => ({ kind, signature }))));
  }

  const signatureTail = record<ComponentSelector & { readonly kind: "signature-tail" }>("signature-tail", () =>
    field("signature", () => signatureWire, value => value.signature, signature =>
      field("start", () => numberWire, value => value.start, start =>
        field("readonly", () => booleanWire, value => value.readonly, readonly => finish(() => ({ kind: "signature-tail", signature, start, readonly }))))));

  const tupleSlice = record<ComponentSelector & { readonly kind: "tuple-slice" }>("tuple-slice", () =>
    field("start", () => numberWire, value => value.start, start =>
      field("endCount", () => numberWire, value => value.endCount, endCount =>
        field("readonly", () => booleanWire, value => value.readonly, readonly => finish(() => ({ kind: "tuple-slice", start, endCount, readonly }))))));

  const typeArgument = record<ComponentSelector & { readonly kind: "type-argument" }>("type-argument", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind: "type-argument", declaration, index })))));

  const sumSelector = record<ComponentSelector & { readonly kind: "sum-arm" }>("sum-arm", () =>
    field("family", () => sumFamily, value => value.family, family =>
      field("index", () => numberWire, value => value.index, index => finish(() => ({ kind: "sum-arm", family, index })))));

  const selectorWire: Wire<ComponentSelector> = variants([
    choice("class-value", () => classValue), choice("construction-argument", () => constructionArgument), choice("optional-value", () => optionalValue),
    choice("array-element", () => arrayElement), choice("tuple-element", () => indexedSelector("tuple-element")),
    choice("union-member", () => indexedSelector("union-member")), choice("argument-place", () => indexedSelector("argument-place")),
    choice("parameter-place", () => indexedSelector("parameter-place")), choice("intersection-member", () => indexedSelector("intersection-member")),
    choice("intersection-result", () => intersectionResult), choice("argument-tail", () => tailSelector("argument-tail")),
    choice("parameter-tail", () => tailSelector("parameter-tail")), choice("member", () => memberSelector),
    choice("index-key", () => indexSelector("index-key")), choice("index-value", () => indexSelector("index-value")),
    choice("projection-source", () => projectionSource), choice("parameter", () => parameterSelector),
    choice("receiver", () => signatureSelector("receiver")), choice("signature-tail", () => signatureTail), choice("tuple-slice", () => tupleSlice),
    choice("result", () => signatureSelector("result")), choice("type-argument", () => typeArgument), choice("sum-arm", () => sumSelector), choice("awaited", () => awaited),
  ], (value, path, next) => {
    switch (value.kind) {
      case "class-value": return classValue.write(value, path, next);
      case "construction-argument": return constructionArgument.write(value, path, next);
      case "optional-value": return optionalValue.write(value, path, next);
      case "array-element": return arrayElement.write(value, path, next);
      case "tuple-element": case "union-member": case "argument-place": case "parameter-place": case "intersection-member":
        return indexedSelector(value.kind).write(value, path, next);
      case "intersection-result": return intersectionResult.write(value, path, next);
      case "argument-tail": case "parameter-tail": return tailSelector(value.kind).write(value, path, next);
      case "member": return memberSelector.write(value, path, next);
      case "index-key": case "index-value": return indexSelector(value.kind).write(value, path, next);
      case "projection-source": return projectionSource.write(value, path, next);
      case "parameter": return parameterSelector.write(value, path, next);
      case "receiver": case "result": return signatureSelector(value.kind).write(value, path, next);
      case "signature-tail": return signatureTail.write(value, path, next);
      case "tuple-slice": return tupleSlice.write(value, path, next);
      case "type-argument": return typeArgument.write(value, path, next);
      case "sum-arm": return sumSelector.write(value, path, next);
      case "awaited": return awaited.write(value, path, next);
    }
  });

  const componentWire = record<TypeComponent>("TypeComponent", () =>
    field("root", () => sourceWire, value => value.root, root =>
      field("path", () => vector(() => selectorWire), value => value.path, path => finish(() => ({ root, path })))));

  const conversionWire = literals(["numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"]);

  const correspondence = record<CorrespondenceStep>("CorrespondenceStep", () =>
    field("from", () => componentWire, value => value.from, from =>
      field("to", () => componentWire, value => value.to, to =>
        field("rule", () => literals(["identity", "numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"]), value => value.rule, rule =>
          field("premises", () => vector(() => numberWire), value => value.premises, premises => finish(() => ({ from, to, rule, premises })))))));

  const proof = record<EmbeddingProof>("EmbeddingProof", () =>
    field("steps", () => vector(() => correspondence), value => value.steps, steps =>
      field("conclusion", () => numberWire, value => value.conclusion, conclusion => finish(() => ({ steps, conclusion })))));

  const noCheck = record<CheckRequirement & { readonly kind: "none" }>("none", () => finish(() => ({ kind: "none" })));

  const requiredCheck = record<CheckRequirement & { readonly kind: "required" }>("required", () =>
    field("failure", () => literals<CheckFailure>(["unwind", "abort"]), value => value.failure, failure => finish(() => ({ kind: "required", failure }))));

  const checkWire: Wire<CheckRequirement> = variants([
    choice("none", () => noCheck), choice("required", () => requiredCheck),
  ], (value, path, next) => {
    switch (value.kind) {
      case "none": return noCheck.write(value, path, next);
      case "required": return requiredCheck.write(value, path, next);
    }
  });

  const dataLocation = record<AccessLocation & { readonly kind: "data" }>("data", () =>
    field("check", () => checkWire, value => value.check, check =>
      field("receiver", () => literals<ReceiverAccess>(["in-place", "by-reference"]), value => value.receiver, receiver => finish(() => ({ kind: "data", check, receiver })))));

  const accessorLocation = record<AccessLocation & { readonly kind: "accessor" }>("accessor", () => finish(() => ({ kind: "accessor" })));

  const locationWire: Wire<AccessLocation> = variants([
    choice("data", () => dataLocation), choice("accessor", () => accessorLocation),
  ], (value, path, next) => {
    switch (value.kind) {
      case "data": return dataLocation.write(value, path, next);
      case "accessor": return accessorLocation.write(value, path, next);
    }
  });

  const pureExecution = record<OperationExecution & { readonly kind: "pure" }>("pure", () => finish(() => ({ kind: "pure" })));

  const invocationExecution = record<OperationExecution & { readonly kind: "invocation" }>("invocation", () =>
    field("writesStorage", () => booleanWire, value => value.writesStorage, writesStorage =>
      field("failure", () => literals<FailureKind>(["none", "unwind", "abort"]), value => value.failure, failure =>
        finish(() => ({ kind: "invocation", writesStorage, failure })))));

  const executionWire: Wire<OperationExecution> = variants([
    choice("pure", () => pureExecution), choice("invocation", () => invocationExecution),
  ], (value, path, next) => {
    switch (value.kind) {
      case "pure": return pureExecution.write(value, path, next);
      case "invocation": return invocationExecution.write(value, path, next);
    }
  });

  const identityEmbedding = record<EmbeddingDecision & { readonly kind: "identity" }>("identity", () => finish(() => ({ kind: "identity" })));

  const convertedEmbedding = record<EmbeddingDecision & { readonly kind: "conversion" }>("conversion", () =>
    field("conversion", () => conversionWire, value => value.conversion, conversion =>
      field("proof", () => proof, value => value.proof, proof =>
        field("check", () => checkWire, value => value.check, check => finish(() => ({ kind: "conversion", conversion, proof, check }))))));

  const refusedEmbedding = record<EmbeddingDecision & { readonly kind: "refused" }>("refused", () =>
    field("reason", () => literals(["incompatible-domain", "lossy-numeric", "missing-correspondence", "passing-mode", "rigid-parameter"]),
      value => value.reason, reason => finish(() => ({ kind: "refused", reason }))));

  const embeddingWire: Wire<EmbeddingDecision> = variants([
    choice("identity", () => identityEmbedding), choice("conversion", () => convertedEmbedding), choice("refused", () => refusedEmbedding),
  ], (value, path, next) => {
    switch (value.kind) {
      case "identity": return identityEmbedding.write(value, path, next);
      case "conversion": return convertedEmbedding.write(value, path, next);
      case "refused": return refusedEmbedding.write(value, path, next);
    }
  });

  const endpointWire = record<HirCallableEndpoint>("HirCallableEndpoint", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration =>
      field("role", () => literals(["advertised", "api-signature", "api-body"]), value => value.role, role =>
        field("signature", () => signatureWire, value => value.signature, signature =>
          field("body", () => nullable(() => bodyWire), value => value.body, body => finish(() => ({ declaration, role, signature, body })))))));

  const memberDecision = record<MemberDecision>("MemberDecision", () =>
    field("key", () => memberKeyWire, value => value.key, key =>
      field("origins", () => vector(() => memberOriginWire), value => value.origins, origins =>
        field("selectedDeclarations", () => vector(() => definitionWire), value => value.selectedDeclarations, selectedDeclarations =>
          field("primary", () => nullable(() => definitionWire), value => value.primary, primary =>
            field("read", () => nullable(() => typeWire), value => value.read, read =>
              field("write", () => nullable(() => typeWire), value => value.write, write =>
                field("getter", () => nullable(() => endpointWire), value => value.getter, getter =>
                  field("setter", () => nullable(() => endpointWire), value => value.setter, setter =>
                    field("bindings", () => bindingsWire, value => value.bindings, bindings =>
                      field("location", () => locationWire, value => value.location, location =>
                        finish(() => ({ key, origins, selectedDeclarations, primary, read, write, getter, setter, bindings, location })))))))))))));

  const passingWire: Wire<PassingMode> = literals([
    "by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move",
  ]);

  const argumentMapping = record<ParameterMapping & { readonly kind: "argument" }>("argument", () =>
    field("parameter", () => numberWire, value => value.parameter, parameter =>
      field("argument", () => numberWire, value => value.argument, argument =>
        field("component", () => nullable(() => numberWire), value => value.component, component =>
          field("passing", () => passingWire, value => value.passing, passing => finish(() => ({ kind: "argument", parameter, argument, component, passing })))))));

  const defaultMapping = record<ParameterMapping & { readonly kind: "default" }>("default", () =>
    field("parameter", () => numberWire, value => value.parameter, parameter =>
      field("initializer", () => bodyWire, value => value.initializer, initializer => finish(() => ({ kind: "default", parameter, initializer })))));

  const omittedMapping = record<ParameterMapping & { readonly kind: "omitted" }>("omitted", () =>
    field("parameter", () => numberWire, value => value.parameter, parameter =>
      field("type", () => typeWire, value => value.type, type => finish(() => ({ kind: "omitted", parameter, type })))));

  const restMapping = record<ParameterMapping & { readonly kind: "rest" }>("rest", () =>
    field("parameter", () => numberWire, value => value.parameter, parameter =>
      field("arguments", () => vector(() => numberWire), value => value.arguments, argumentsValue =>
        field("passing", () => passingWire, value => value.passing, passing => finish(() => ({ kind: "rest", parameter, arguments: argumentsValue, passing }))))));

  const mappingWire: Wire<ParameterMapping> = variants([
    choice("argument", () => argumentMapping), choice("default", () => defaultMapping),
    choice("omitted", () => omittedMapping), choice("rest", () => restMapping),
  ], (value, path, next) => {
    switch (value.kind) {
      case "argument": return argumentMapping.write(value, path, next);
      case "default": return defaultMapping.write(value, path, next);
      case "omitted": return omittedMapping.write(value, path, next);
      case "rest": return restMapping.write(value, path, next);
    }
  });

  const completionWire = record<CompletionEndpoint>("CompletionEndpoint", () =>
    field("signature", () => signatureWire, value => value.signature, signature =>
      field("completion", () => typeWire, value => value.completion, completion =>
        field("yielded", () => nullable(() => typeWire), value => value.yielded, yielded =>
          field("sent", () => nullable(() => typeWire), value => value.sent, sent => finish(() => ({ signature, completion, yielded, sent })))))));

  const applicationWire = record<ApplicationDecision>("ApplicationDecision", () =>
    field("candidate", () => numberWire, value => value.candidate, candidate =>
      field("advertised", () => endpointWire, value => value.advertised, advertised =>
        field("api", () => endpointWire, value => value.api, api =>
          field("bindings", () => bindingsWire, value => value.bindings, bindings =>
            field("implementationBindings", () => bindingsWire, value => value.implementationBindings, implementationBindings =>
              field("parameters", () => vector(() => mappingWire), value => value.parameters, parameters =>
                field("completion", () => completionWire, value => value.completion, completion =>
                  field("result", () => typeWire, value => value.result, result =>
                    field("activation", () => nullable(() => literals<HandleActivation>(["at-creation", "when-first-driven"])), value => value.activation, activation =>
                      finish(() => ({ candidate, advertised, api, bindings, implementationBindings, parameters, completion, result, activation }))))))))))));

  const calleeWire = record<ResolvedCallee>("ResolvedCallee", () =>
    field("decision", () => applicationWire, value => value.decision, decision =>
      field("activation", () => nullable(() => instanceWire), value => value.activation, activation =>
        finish(() => ({ decision, activation })))));

  const selectionWire = record<MemberSelection>("MemberSelection", () =>
    field("decision", () => memberDecision, value => value.decision, decision =>
      field("getter", () => nullable(() => calleeWire), value => value.getter, getter =>
        field("setter", () => nullable(() => calleeWire), value => value.setter, setter => finish(() => ({ decision, getter, setter }))))));

  const constructionPart = record<ConstructionPartDecision>("ConstructionPartDecision", () =>
    field("part", () => numberWire, value => value.part, part =>
      field("source", () => nodeRefWire, value => value.source, source =>
        field("destination", () => componentWire, value => value.destination, destination =>
          field("member", () => nullable(() => memberDecision), value => value.member, member =>
            field("embedding", () => embeddingWire, value => value.embedding, embedding => finish(() => ({ part, source, destination, member, embedding }))))))));

  const protocolCall = record<ProtocolStepOperation & { readonly kind: "call" }>("call", () =>
    field("application", () => applicationWire, value => value.application, application => finish(() => ({ kind: "call", application }))));

  const protocolCore = record<ProtocolStepOperation & { readonly kind: "core" }>("core", () =>
    field("declaration", () => definitionWire, value => value.declaration, declaration =>
      field("bindings", () => bindingsWire, value => value.bindings, bindings => finish(() => ({ kind: "core", declaration, bindings })))));

  const protocolCompletion = record<ProtocolStepOperation & { readonly kind: "completion" }>("completion", () => finish(() => ({ kind: "completion" })));

  const protocolOperationWire: Wire<ProtocolStepOperation> = variants([
    choice("call", () => protocolCall), choice("core", () => protocolCore), choice("completion", () => protocolCompletion),
  ], (value, path, next) => {
    switch (value.kind) {
      case "call": return protocolCall.write(value, path, next);
      case "core": return protocolCore.write(value, path, next);
      case "completion": return protocolCompletion.write(value, path, next);
    }
  });

  const protocolStep = record<ProtocolStepDecision>("ProtocolStepDecision", () =>
    field("role", () => literals(["acquire", "next", "done", "value", "finish", "fail", "await", "dispose", "completion"]), value => value.role, role =>
      field("operation", () => protocolOperationWire, value => value.operation, operation =>
        field("operands", () => vector(() => typeWire), value => value.operands, operands =>
          field("result", () => typeWire, value => value.result, result => finish(() => ({ role, operation, operands, result })))))));

  const nativeWire: Wire<NativePrimitive> = literals(["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32",
    "int64", "uint64", "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"]);

  const operatorWire: Wire<HirUnaryOperator | HirBinaryOperator> = literals([
    "+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>",
    "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof",
  ]);

  const nativeOperation = record<OperationIdentity & { readonly kind: "native-operator" }>("native-operator", () =>
    field("operator", () => operatorWire, value => value.operator, operator =>
      field("carrier", () => nativeWire, value => value.carrier, carrier => finish(() => ({ kind: "native-operator", operator, carrier })))));

  const bigintOperation = record<OperationIdentity & { readonly kind: "bigint-operator" }>("bigint-operator", () =>
    field("operator", () => operatorWire, value => value.operator, operator => finish(() => ({ kind: "bigint-operator", operator }))));

  const stringOperation = record<OperationIdentity & { readonly kind: "string-operator" }>("string-operator", () =>
    field("operator", () => literals(["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="]), value => value.operator,
      operator => finish(() => ({ kind: "string-operator", operator }))));

  const booleanOperation = record<OperationIdentity & { readonly kind: "boolean-operator" }>("boolean-operator", () =>
    field("operator", () => literals(["!", "&&", "||", "==", "!=", "===", "!=="]), value => value.operator,
      operator => finish(() => ({ kind: "boolean-operator", operator }))));

  const absenceOperation = record<OperationIdentity & { readonly kind: "absence-test" }>("absence-test", () =>
    field("negated", () => booleanWire, value => value.negated, negated => finish(() => ({ kind: "absence-test", negated }))));

  function constructionOperation<Kind extends "object-construction" | "array-construction">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly parts: readonly ConstructionPartDecision[] }>(kind, () =>
      field("parts", () => vector(() => constructionPart), value => value.parts, parts => finish(() => ({ kind, parts }))));
  }

  const protocolKind: Wire<ProtocolKind> = literals(["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"]);

  const protocol = record<OperationIdentity & { readonly kind: "protocol" }>("protocol", () =>
    field("protocol", () => protocolKind, value => value.protocol, protocol =>
      field("asynchronous", () => booleanWire, value => value.asynchronous, asynchronous =>
        field("steps", () => vector(() => protocolStep), value => value.steps, steps =>
          field("value", () => typeWire, value => value.value, value =>
            field("completion", () => typeWire, value => value.completion, completion =>
              field("yielded", () => nullable(() => typeWire), value => value.yielded, yielded =>
                field("sent", () => nullable(() => typeWire), value => value.sent, sent =>
                  field("thrown", () => typeWire, value => value.thrown, thrown =>
                    finish(() => ({ kind: "protocol", protocol, asynchronous, steps, value, completion, yielded, sent, thrown })))))))))));

  const conversionOperation = record<OperationIdentity & { readonly kind: "conversion" }>("conversion", () =>
    field("from", () => typeWire, value => value.from, from =>
      field("to", () => typeWire, value => value.to, to =>
        field("embedding", () => embeddingWire, value => value.embedding, embedding => finish(() => ({ kind: "conversion", from, to, embedding }))))));

  function declaredOperation<Kind extends "library" | "core">(kind: Kind) {
    return record<{ readonly kind: Kind; readonly declaration: DefId; readonly bindings: BindingVector }>(kind, () =>
      field("declaration", () => definitionWire, value => value.declaration, declaration =>
        field("bindings", () => bindingsWire, value => value.bindings, bindings => finish(() => ({ kind, declaration, bindings })))));
  }

  const pointerAddress = record<PointerOperation>("pointer-address", () => finish<PointerOperation>(() => ({ kind: "pointer-address" })));

  const pointerRead = record<PointerOperation>("pointer-read", () => finish<PointerOperation>(() => ({ kind: "pointer-read" })));

  const pointerWrite = record<PointerOperation>("pointer-write", () => finish<PointerOperation>(() => ({ kind: "pointer-write" })));

  const pointerOffset = record<PointerOperation>("pointer-offset", () => finish<PointerOperation>(() => ({ kind: "pointer-offset" })));

  const typeQuery = record<MarkerOperation>("type-query", () => finish<MarkerOperation>(() => ({ kind: "type-query" })));

  const discard = record<MarkerOperation>("discard", () => finish<MarkerOperation>(() => ({ kind: "discard" })));

  const operationIdentity: Wire<OperationIdentity> = variants([
    choice("native-operator", () => nativeOperation), choice("bigint-operator", () => bigintOperation),
    choice("string-operator", () => stringOperation), choice("boolean-operator", () => booleanOperation),
    choice("absence-test", () => absenceOperation), choice("object-construction", () => constructionOperation("object-construction")),
    choice("array-construction", () => constructionOperation("array-construction")), choice("protocol", () => protocol),
    choice("conversion", () => conversionOperation), choice("library", () => declaredOperation("library")), choice("core", () => declaredOperation("core")),
    choice("pointer-address", () => pointerAddress), choice("pointer-read", () => pointerRead), choice("pointer-write", () => pointerWrite),
    choice("pointer-offset", () => pointerOffset), choice("type-query", () => typeQuery), choice("discard", () => discard),
  ], (value, path, next) => {
    switch (value.kind) {
      case "native-operator": return nativeOperation.write(value, path, next);
      case "bigint-operator": return bigintOperation.write(value, path, next);
      case "string-operator": return stringOperation.write(value, path, next);
      case "boolean-operator": return booleanOperation.write(value, path, next);
      case "absence-test": return absenceOperation.write(value, path, next);
      case "object-construction": case "array-construction": return constructionOperation(value.kind).write(value, path, next);
      case "protocol": return protocol.write(value, path, next);
      case "conversion": return conversionOperation.write(value, path, next);
      case "library": case "core": return declaredOperation(value.kind).write(value, path, next);
      case "pointer-address": return pointerAddress.write(value, path, next);
      case "pointer-read": return pointerRead.write(value, path, next);
      case "pointer-write": return pointerWrite.write(value, path, next);
      case "pointer-offset": return pointerOffset.write(value, path, next);
      case "type-query": return typeQuery.write(value, path, next);
      case "discard": return discard.write(value, path, next);
    }
  });

  const operationDecision = record<OperationDecision>("selected", () =>
    field("operation", () => operationIdentity, value => value.operation, operation =>
      field("operands", () => vector(() => typeWire), value => value.operands, operands =>
        field("result", () => typeWire, value => value.result, result =>
          field("execution", () => executionWire, value => value.execution, execution => finish(() => ({ kind: "selected", operation, operands, result, execution })))))));

  const operationWire = record<TypedOperation>("TypedOperation", () =>
    field("decision", () => operationDecision, value => value.decision, decision =>
      field("permissionScope", () => nullable(() => nodeWire), value => value.permissionScope, permissionScope => finish(() => ({ decision, permissionScope })))));
  return { nodeWire, localWire, blockWire, placeWire, typeWire, signatureWire, constantWire, bodyWire, definitionWire, moduleWire, originWire, nodeRefWire, localRefWire, bindingsWire, artifactWire, instanceWire, referenceWire, rationalWire, literalWire, passingWire, calleeWire, selectionWire, operationWire };
}
