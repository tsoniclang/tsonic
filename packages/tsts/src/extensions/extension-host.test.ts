import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExtensionHost,
  ExtensionHostDiagnosticCode,
  ExtensionLifecycleEvent,
  ExtensionObservationPoint,
  TstsProviderContractVersion,
  acceptObservation,
  argumentPassingFactKey,
  attachExtensionHost,
  attachExtensionHostToProgram,
  associatedTypeFactKey,
  canonicalIdentityFactKey,
  constGenericFactKey,
  createExtensionConsumerQueries,
  defineExtensionFactKey,
  deferObservation,
  flowStateFactKey,
  getExtensionHost,
  hasExtensionHost,
  rejectObservation,
  runtimeCarrierFactKey,
  selectedTargetSignatureFactKey,
  sourcePrimitiveFactKey,
  targetBindingFactKey,
  targetOperationFactKey,
} from "./index.js";
import type {
  CompilerExtension,
  ExtensionDiagnostic,
  CheckedConversionMappingResult,
  ProviderDeclarationModel,
  ProviderMemberDeclaration,
  ProviderModuleResolution,
  CheckedCallMappingRequest,
  CheckedCallMappingResult,
  CheckedElementAccessMappingRequest,
  CheckedOperationMappingResult,
  CheckedOperatorMappingRequest,
  CheckedPropertyAccessMappingRequest,
  TargetConstraintValidationRequest,
  TargetTypeArgumentMappingResult,
  SelectedTargetSignatureFact,
  SourceFileBoundLifecycleRequest,
  TargetBindingFact,
  TargetBindingProvider,
  TargetIdentity,
  TargetOperationFact,
  TargetSemanticProvider,
  ExtensionFlowUseValidationRequest,
  ExtensionFlowUseValidationResult,
} from "./index.js";

const primitiveFactKey = defineExtensionFactKey({
  extensionId: "source-primitives",
  name: "primitive",
});

function extension(id: string, options: {
  readonly dependsOn?: readonly string[];
  readonly runsAfter?: readonly string[];
  readonly composition?: CompilerExtension["composition"];
  readonly observationOwners?: CompilerExtension["observationOwners"];
  readonly diagnosticRange?: CompilerExtension["identity"]["diagnosticRange"];
  readonly initialize?: CompilerExtension["initialize"];
} = {}): CompilerExtension {
  const dependencies = options.dependsOn !== undefined || options.runsAfter !== undefined
    ? {
      ...(options.dependsOn !== undefined ? { dependsOn: options.dependsOn } : {}),
      ...(options.runsAfter !== undefined ? { runsAfter: options.runsAfter } : {}),
    } satisfies CompilerExtension["dependencies"]
    : undefined;
  return {
    identity: {
      id,
      version: "1.0.0",
      capabilityNamespace: id,
      ...(options.diagnosticRange !== undefined ? { diagnosticRange: options.diagnosticRange } : {}),
    },
    ...(dependencies !== undefined ? { dependencies } : {}),
    ...(options.composition !== undefined ? { composition: options.composition } : {}),
    ...(options.observationOwners !== undefined ? { observationOwners: options.observationOwners } : {}),
    ...(options.initialize !== undefined ? { initialize: options.initialize } : {}),
  };
}

test("extension host is sidecar state, not ambient program mutation", () => {
  const program = {};

  assert.equal(hasExtensionHost(program), false);
  assert.equal(getExtensionHost(program), undefined);

  const extended = attachExtensionHost(program, {
    extensions: [extension("source-primitives")],
  });

  assert.equal(extended.program, program);
  assert.equal(getExtensionHost(program), extended.extensionHost);
  assert.equal(hasExtensionHost(program), true);
  assert.deepEqual(extended.extensionHost.extensions.map((item) => item.identity.id), ["source-primitives"]);
});

test("extension host attaches from creation options to constructed program", () => {
  const options = {};
  const program = {};

  const extendedOptions = attachExtensionHost(options);
  const extendedProgram = attachExtensionHostToProgram(options, program);

  assert.equal(extendedProgram?.program, program);
  assert.equal(extendedProgram?.extensionHost, extendedOptions.extensionHost);
  assert.equal(getExtensionHost(program), extendedOptions.extensionHost);
  assert.equal(Object.prototype.hasOwnProperty.call(program, "__extensionHost"), false);
});

test("extension ordering is deterministic and honors dependencies", () => {
  const initialized: string[] = [];
  const host = new ExtensionHost({}, {
    extensions: [
      extension("surface", { dependsOn: ["target"], initialize: () => initialized.push("surface") }),
      extension("source", { initialize: () => initialized.push("source") }),
      extension("target", { dependsOn: ["source"], initialize: () => initialized.push("target") }),
    ],
  });

  assert.deepEqual(host.extensions.map((item) => item.identity.id), ["source", "target", "surface"]);
  assert.deepEqual(initialized, ["source", "target", "surface"]);
  assert.equal(host.diagnostics.hasErrors(), false);
});

test("runsAfter orders only when the predecessor is present", () => {
  const host = new ExtensionHost({}, {
    extensions: [
      extension("attributes", { runsAfter: ["target"] }),
      extension("source"),
      extension("target"),
    ],
  });

  assert.deepEqual(host.extensions.map((item) => item.identity.id), ["source", "target", "attributes"]);
});

test("missing dependencies, duplicate ids, and cycles are deterministic diagnostics", () => {
  const initialized: string[] = [];
  const duplicateHost = new ExtensionHost({}, {
    extensions: [extension("source"), extension("source")],
  });
  assert.equal(duplicateHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.duplicateExtension);

  const missingHost = new ExtensionHost({}, {
    extensions: [
      extension("target", { dependsOn: ["source"], initialize: () => initialized.push("target") }),
      extension("surface", { dependsOn: ["target"], initialize: () => initialized.push("surface") }),
    ],
  });
  assert.equal(missingHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.missingDependency);
  assert.deepEqual(missingHost.extensions.map((item) => item.identity.id), []);
  assert.equal(initialized.length, 0);

  const cycleHost = new ExtensionHost({}, {
    extensions: [
      extension("a", { dependsOn: ["b"], initialize: () => initialized.push("a") }),
      extension("b", { dependsOn: ["a"], initialize: () => initialized.push("b") }),
    ],
  });
  assert.equal(cycleHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.dependencyCycle);
  assert.deepEqual(cycleHost.extensions.map((item) => item.identity.id), []);
  assert.equal(initialized.length, 0);
});

test("observation owners are required and conflicts are reported", () => {
  const host = new ExtensionHost({}, {
    extensions: [
      extension("source", { observationOwners: [ExtensionObservationPoint.validateTargetConstraint] }),
      extension("other", { observationOwners: [ExtensionObservationPoint.validateTargetConstraint] }),
    ],
  });

  assert.equal(host.getObservationOwner(ExtensionObservationPoint.validateTargetConstraint)?.identity.id, "other");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationOwnerConflict);

  assert.equal(host.requireObservationOwner(ExtensionObservationPoint.mapCheckedCall), undefined);
  assert.equal(host.diagnostics.all().at(-1)?.numericCode, ExtensionHostDiagnosticCode.observationOwnerMissing);

  host.registerObservationOwner(ExtensionObservationPoint.mapCheckedCall, "missing-extension");
  assert.equal(host.diagnostics.all().at(-1)?.numericCode, ExtensionHostDiagnosticCode.unknownObservationOwner);
});

test("fact store supports insert, idempotent writes, conflicts, and object subjects only", () => {
  const host = new ExtensionHost({});
  const subject = {};
  const canonicalSubject = {};

  assert.equal(host.facts.set(subject, primitiveFactKey, "int32"), "inserted");
  assert.equal(host.facts.set(subject, primitiveFactKey, "int32"), "idempotent");
  assert.equal(host.facts.get(subject, primitiveFactKey), "int32");
  assert.equal(host.facts.set(subject, primitiveFactKey, "int64"), "conflict");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.factConflict);

  assert.equal(host.facts.set(canonicalSubject, primitiveFactKey, "int32"), "inserted");
  assert.equal(host.facts.get(canonicalSubject, primitiveFactKey), "int32");

  assert.equal(Reflect.apply(host.facts.set, host.facts, [null, primitiveFactKey, "int32"]), "invalid-subject");
  assert.equal(host.diagnostics.all().at(-1)?.numericCode, ExtensionHostDiagnosticCode.invalidFactSubject);
});

test("fact conflict diagnostics are keyed per object subject", () => {
  const host = new ExtensionHost({});
  const firstSubject = {};
  const secondSubject = {};

  host.facts.set(firstSubject, primitiveFactKey, "int32");
  host.facts.set(firstSubject, primitiveFactKey, "int64");
  host.facts.set(secondSubject, primitiveFactKey, "int32");
  host.facts.set(secondSubject, primitiveFactKey, "int64");

  const conflicts = host.diagnostics.all().filter((diagnostic) => diagnostic.numericCode === ExtensionHostDiagnosticCode.factConflict);
  assert.equal(conflicts.length, 2);
});

test("fact resolver computes lazily and caches through the fact store", () => {
  const host = new ExtensionHost({});
  const canonical = {};
  const alias = {};
  let resolveCount = 0;

  host.facts.set(canonical, primitiveFactKey, "int32");
  host.factResolver.register(primitiveFactKey, (subject, context) => {
    if (subject !== alias) {
      return undefined;
    }
    resolveCount += 1;
    const value = context.facts.get(canonical, primitiveFactKey);
    return value === undefined ? undefined : {
      value,
      evidence: [{ message: "alias resolved to canonical primitive" }],
    };
  });

  assert.equal(host.factResolver.resolve(alias, primitiveFactKey), "int32");
  assert.equal(host.factResolver.resolve(alias, primitiveFactKey), "int32");
  assert.equal(resolveCount, 1);
  assert.equal(host.facts.getEntry(alias, primitiveFactKey)?.evidence[0]?.message, "alias resolved to canonical primitive");
});

test("fact resolver can lazily cache finalized facts without sealed-store diagnostics", () => {
  const host = new ExtensionHost({});
  const canonical = {};
  const alias = {};

  host.facts.set(canonical, primitiveFactKey, "int32");
  host.factResolver.register(primitiveFactKey, (subject, context) => {
    if (subject !== alias) {
      return undefined;
    }
    const value = context.facts.get(canonical, primitiveFactKey);
    return value === undefined ? undefined : {
      value,
      evidence: [{ message: "post-finalization alias resolved to canonical primitive" }],
    };
  });

  host.finalizeSemantics();
  assert.equal(host.getFactForConsumer("emitter", alias, primitiveFactKey), "int32");
  assert.equal(host.facts.getEntry(alias, primitiveFactKey)?.evidence[0]?.message, "post-finalization alias resolved to canonical primitive");
  assert.equal(host.diagnostics.all().some((diagnostic) => diagnostic.numericCode === ExtensionHostDiagnosticCode.factStoreSealed), false);
});

test("provider registry requires explicit provider identity and rejects duplicates", () => {
  const host = new ExtensionHost({});
  const provider = dotnetBindingProvider("@example/dotnet/System.Buffers.js");

  assert.equal(host.providers.registerTargetBindingProvider(provider), true);
  assert.equal(host.providers.getTargetBindingProvider("dotnet")?.identity.target, "csharp");
  assert.equal(host.providers.registerTargetBindingProvider(provider), true);

  assert.equal(host.providers.registerTargetBindingProvider(dotnetBindingProvider("@example/dotnet/System.Text.js")), false);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.duplicateProvider);

  const invalidProvider = dotnetBindingProvider("@example/dotnet/Invalid.js", {
    id: "",
    providerKind: "semantic",
  });
  assert.equal(host.providers.registerTargetBindingProvider(invalidProvider), false);
  assert.equal(host.diagnostics.all()[1]?.numericCode, ExtensionHostDiagnosticCode.invalidProvider);
});

test("provider registry rejects unsupported extension contract versions", () => {
  const host = new ExtensionHost({});
  const provider = dotnetBindingProvider("@example/dotnet/System.Buffers.js", {
    extensionContractVersion: "unsupported.contract.0",
  });

  assert.equal(host.providers.registerTargetBindingProvider(provider), false);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerContractMismatch);
  assert.match(host.diagnostics.all()[0]?.message ?? "", /unsupported extension contract/);
  assert.equal(host.providers.resolveVirtualModule("@example/dotnet/System.Buffers.js").kind, "unowned");
});

test("registered diagnostic ranges reject unstable extension codes", () => {
  const host = new ExtensionHost({}, {
    extensions: [
      extension("a-range-checked-extension", {
        diagnosticRange: { start: 9101000, end: 9101999 },
        initialize: (context) => {
          context.diagnostics.append(diagnostic("a-range-checked-extension", "IN_RANGE", 9101001, "accepted diagnostic"));
          context.diagnostics.append(diagnostic("a-range-checked-extension", "OUT_OF_RANGE", 9200001, "rejected diagnostic"));
        },
      }),
      extension("bad-range-extension", {
        diagnosticRange: { start: 9300002, end: 9300001 },
      }),
      extension("z-overlapping-range-extension", {
        diagnosticRange: { start: 9101500, end: 9102500 },
      }),
    ],
  });

  assert.equal(host.diagnostics.all().some((item) => item.extensionCode === "IN_RANGE"), true);
  assert.equal(host.diagnostics.all().some((item) => item.extensionCode === "OUT_OF_RANGE"), false);
  assert.equal(host.diagnostics.all().some((item) => item.numericCode === ExtensionHostDiagnosticCode.diagnosticCodeOutOfRange), true);
  assert.equal(host.diagnostics.all().filter((item) => item.numericCode === ExtensionHostDiagnosticCode.diagnosticRangeInvalid).length, 2);
});

test("extensions register binding and semantic providers through initialization context", () => {
  const bindingProvider = dotnetBindingProvider("@example/dotnet/System.Buffers.js");
  const parameter = {};
  const argument = {};
  const semanticProvider: TargetSemanticProvider = {
    identity: {
      id: "dotnet-semantic",
      version: "1.0.0",
      target: "csharp",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    resolveParameterPassing: () => acceptObservation({
      passing: { mode: "byref-writeonly-must-init" },
    }),
  };
  const host = new ExtensionHost({}, {
    extensions: [
      extension("dotnet", {
        initialize: (context) => {
          assert.equal(context.registerTargetBindingProvider(bindingProvider), true);
          assert.equal(context.registerTargetSemanticProvider(semanticProvider), true);
        },
      }),
    ],
  });

  assert.equal(host.providers.getTargetBindingProvider("dotnet"), bindingProvider);
  assert.equal(host.providers.getTargetSemanticProvider("dotnet-semantic"), semanticProvider);
  assert.equal(host.diagnostics.hasErrors(), false);

  const parameterMode = host.runObservation(ExtensionObservationPoint.resolveParameterPassing, {
    parameter,
    argument,
    target: "csharp",
  }, () => ({ passing: { mode: "by-value" } }), { requireOwner: true });

  assert.equal(parameterMode.kind, "accept");
  assert.equal(parameterMode.kind === "accept" ? parameterMode.value.passing.mode : undefined, "byref-writeonly-must-init");
  assert.equal(parameterMode.kind === "accept" ? parameterMode.extensionId : undefined, "dotnet");
});

test("semantic provider methods own typed observations without hook boilerplate", () => {
  const expression = {};
  const convertedExpression = {};
  const propertyAccess = {};
  const elementAccess = {};
  const operatorExpression = {};
  const lambda = {};
  const flowUse = {};
  const voidType = {};
  const int32Type = {};
  const longType = {};
  const byteType = {};
  const charType = {};
  const stringType = {};
  const delegateType = {};
  const listAdd = {};
  const listInt32 = {};
  const consoleWriteLine = {};
  const callArgument = {};
  const spanArgument = {};
  const leftOperand = {};
  const rightOperand = {};
  const tryParseParameter = {};
  const tryParseArgument = {};
  const symbol = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("csharp-target", {
        initialize: (context) => {
          assert.equal(context.registerTargetSemanticProvider({
            identity: {
              id: "dotnet-semantic",
              version: "1.0.0",
              target: "csharp",
              extensionContractVersion: TstsProviderContractVersion,
              providerKind: "semantic",
            },
            validateTargetConstraint: () => acceptObservation(true),
            validatePostCheckAssignability: () => acceptObservation(true),
            mapCheckedCall: () => acceptObservation({
              selectedSignature: selectedSignature("System.Console.WriteLine(System.Int32)"),
              returnType: voidType,
            }),
            mapInferredSourceTypeArgumentsToTarget: () => acceptObservation({
              targetTypeArguments: [{ kind: "source-primitive", name: "int32" }],
            }),
            mapCheckedPropertyAccess: () => acceptObservation({
              operation: targetOperation("System.String.Length", "property"),
              resultType: int32Type,
            }),
            mapCheckedElementAccess: () => acceptObservation({
              operation: targetOperation("System.Span.GetItem", "indexer"),
              resultType: charType,
            }),
            mapCheckedOperator: () => acceptObservation({
              operation: targetOperation("System.Int32.op_Addition", "operator"),
              resultType: int32Type,
            }),
            recordContextualTargetType: () => acceptObservation({
              type: delegateType,
              targetType: { kind: "target-named", id: "System.Func`2" },
            }),
            mapCheckedConversion: () => acceptObservation({
              convertedType: { kind: "source-primitive", name: "int32" },
              operation: targetOperation("System.Convert.ToInt32", "method"),
            }),
            resolveParameterPassing: () => acceptObservation({
              passing: { mode: "byref-readwrite" },
            }),
            resolveRuntimeCarrier: () => acceptObservation({
              carrier: { kind: "target-named", id: "System.Int32" },
              requiresAllocation: false,
            }),
            validateExtensionFlowUse: () => acceptObservation({
              valid: true,
              targetCompilerValidationRequired: false,
            }),
          }), true);
        },
      }),
    ],
  });

  const constraint = host.runObservation(ExtensionObservationPoint.validateTargetConstraint, {
    source: int32Type,
    constraint: { kind: "implements", contract: "System.IEquatable`1" },
    target: "csharp",
  }, () => false, { requireOwner: true });
  assert.equal(constraint.kind === "accept" ? constraint.value : false, true);

  const assignable = host.runObservation(ExtensionObservationPoint.validatePostCheckAssignability, {
    source: int32Type,
    target: longType,
    relation: "assignment",
  }, () => false, { requireOwner: true });
  assert.equal(assignable.kind === "accept" ? assignable.value : false, true);

  const call = host.runObservation(ExtensionObservationPoint.mapCheckedCall, {
    call: expression,
    callee: consoleWriteLine,
    arguments: [callArgument],
    target: "csharp",
  }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });
  assert.equal(call.kind === "accept" ? call.value.selectedSignature.member.id : undefined, "System.Console.WriteLine(System.Int32)");

  const noInferredTypeArguments: TargetTypeArgumentMappingResult = { targetTypeArguments: [] };
  const inferred = host.runObservation(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, {
    declaration: listAdd,
    arguments: [callArgument],
    contextualType: listInt32,
  }, () => noInferredTypeArguments, { requireOwner: true });
  assert.deepEqual(inferred.kind === "accept" ? inferred.value.targetTypeArguments : [], [{ kind: "source-primitive", name: "int32" }]);

  const property = host.runObservation(ExtensionObservationPoint.mapCheckedPropertyAccess, {
    expression: propertyAccess,
    receiver: stringType,
    propertyName: "length",
    target: "csharp",
  }, () => ({ operation: targetOperation("core", "property") }), { requireOwner: true });
  assert.equal(property.kind === "accept" ? property.value.operation.operationId : undefined, "System.String.Length");

  const element = host.runObservation(ExtensionObservationPoint.mapCheckedElementAccess, {
    expression: elementAccess,
    receiver: stringType,
    argument: spanArgument,
    target: "csharp",
  }, () => ({ operation: targetOperation("core", "indexer") }), { requireOwner: true });
  assert.equal(element.kind === "accept" ? element.value.operation.operationId : undefined, "System.Span.GetItem");

  const operator = host.runObservation(ExtensionObservationPoint.mapCheckedOperator, {
    expression: operatorExpression,
    operator: "+",
    left: leftOperand,
    right: rightOperand,
    target: "csharp",
  }, () => ({ operation: targetOperation("core", "operator") }), { requireOwner: true });
  assert.equal(operator.kind === "accept" ? operator.value.operation.operationId : undefined, "System.Int32.op_Addition");

  const contextual = host.runObservation(ExtensionObservationPoint.recordContextualTargetType, {
    expression: lambda,
    context: delegateType,
    target: "csharp",
  }, () => ({ type: int32Type }), { requireOwner: true });
  assert.equal(contextual.kind === "accept" ? contextual.value.type : undefined, delegateType);

  const noConversion: CheckedConversionMappingResult = {};
  const conversion = host.runObservation(ExtensionObservationPoint.mapCheckedConversion, {
    expression: convertedExpression,
    source: byteType,
    target: int32Type,
    targetPlatform: "csharp",
  }, () => noConversion, { requireOwner: true });
  assert.equal(conversion.kind === "accept" ? conversion.value.operation?.operationId : undefined, "System.Convert.ToInt32");

  const parameterMode = host.runObservation(ExtensionObservationPoint.resolveParameterPassing, {
    parameter: tryParseParameter,
    argument: tryParseArgument,
    target: "csharp",
  }, () => ({ passing: { mode: "by-value" } }), { requireOwner: true });
  assert.equal(parameterMode.kind === "accept" ? parameterMode.value.passing.mode : undefined, "byref-readwrite");

  const carrier = host.runObservation(ExtensionObservationPoint.resolveRuntimeCarrier, {
    type: int32Type,
    target: "csharp",
  }, () => ({ carrier: { kind: "opaque", id: "core" } }), { requireOwner: true });
  assert.equal(carrier.kind === "accept" ? carrier.value.carrier.kind : undefined, "target-named");

  const flow = host.runObservation(ExtensionObservationPoint.validateExtensionFlowUse, {
    useSite: flowUse,
    symbol,
    mode: "read",
    target: "csharp",
  }, () => ({ valid: false }), { requireOwner: true });
  assert.equal(flow.kind === "accept" ? flow.value.valid : false, true);
  assert.equal(flow.kind === "accept" ? flow.extensionId : undefined, "csharp-target");
});

test("target binding providers own and resolve virtual modules without file-backed side data", () => {
  const specifier = "@example/dotnet/System.Buffers.js";
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider(dotnetBindingProvider(specifier));

  assert.equal(host.providers.getModuleOwner("@example/native/types.js"), undefined);

  const context = {
    containingFile: "/src/example.ts",
    activeTarget: "csharp",
  };
  const result = host.providers.resolveVirtualModule(specifier, context);
  assert.equal(result.kind, "resolved");
  if (result.kind !== "resolved") {
    return;
  }

  assert.equal(result.module.resolution.virtualFileName, "tsts-provider://dotnet/System.Buffers");
  assert.equal(result.module.declarationModel.exports[0]?.name, "SearchValues");
  assert.match(result.module.virtualSourceText, /export declare class SearchValues<T extends unknown>/);
  assert.match(result.module.virtualSourceText, /Contains\(value: T\): boolean;/);
  assert.match(result.module.virtualSourceText, /export type Token = number;/);
  assert.equal(result.module.virtualDocument.uri, "tsts-provider://dotnet/System.Buffers");
  assert.equal(result.module.virtualDocument.readOnly, true);
  assert.equal(result.module.virtualDocument.provider.id, "dotnet");
  assert.match(result.module.virtualDocument.sourceText, /export declare class SearchValues/);
  const cached = host.providers.resolveVirtualModule(specifier, context);
  assert.equal(cached.kind, "resolved");
  if (cached.kind === "resolved") {
    assert.equal(cached.module, result.module);
  }
  assert.equal(result.module.provider.getTargetIdentity({
    moduleSpecifier: specifier,
    exportName: "SearchValues",
  })?.id, "System.Buffers.SearchValues`1");

  assert.equal(host.providers.resolveVirtualModule("@example/dotnet/Unknown.js").kind, "unowned");
});

test("virtual declaration documents are stable consumer-readable compiler state", () => {
  const specifier = "@example/dotnet/System.Buffers.js";
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider(dotnetBindingProvider(specifier));

  const result = host.providers.resolveVirtualModule(specifier, { activeTarget: "csharp" });
  assert.equal(result.kind, "resolved");
  if (result.kind !== "resolved") {
    return;
  }

  assert.equal(host.providers.getVirtualDeclarationDocuments().length, 1);
  assert.equal(host.providers.getVirtualDeclarationDocument(result.module.resolution.virtualFileName), result.module.virtualDocument);

  const consumer = createExtensionConsumerQueries(host, "future-lsp");
  assert.equal(consumer.getVirtualDeclarationDocument(result.module.resolution.virtualFileName), undefined);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.consumerBeforeFinalization);

  host.finalizeSemantics();
  const document = consumer.getVirtualDeclarationDocument(result.module.resolution.virtualFileName);
  assert.equal(document, result.module.virtualDocument);
  assert.equal(document?.moduleSpecifier, specifier);
  assert.match(document?.sourceText ?? "", /Contains\(value: T\): boolean;/);
});

test("provider ownership conflicts and invalid declaration models are diagnostics", () => {
  const specifier = "@example/dotnet/System.Buffers.js";
  const conflictHost = new ExtensionHost({});
  conflictHost.providers.registerTargetBindingProvider(dotnetBindingProvider(specifier, { id: "first" }));
  conflictHost.providers.registerTargetBindingProvider(dotnetBindingProvider(specifier, { id: "second" }));

  assert.equal(conflictHost.providers.resolveVirtualModule(specifier).kind, "conflict");
  assert.equal(conflictHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerOwnershipConflict);

  const invalidHost = new ExtensionHost({});
  invalidHost.providers.registerTargetBindingProvider(dotnetBindingProvider(specifier, {
    declarationModel: (resolution) => ({
      moduleSpecifier: resolution.moduleSpecifier,
      providerModuleId: "wrong-provider-module-id",
      exports: [],
    }),
  }));

  assert.equal(invalidHost.providers.resolveVirtualModule(specifier).kind, "rejected");
  assert.equal(invalidHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.invalidProviderDeclaration);
});

test("provider callback failures are diagnostics and never fall back to files", () => {
  const specifier = "@target/failing.js";
  const ownershipHost = new ExtensionHost({});
  ownershipHost.providers.registerTargetBindingProvider({
    identity: providerIdentity("throwing-ownership-provider", "demo", "binding"),
    ownsModule: () => {
      throw new Error("ownership failed");
    },
    resolveModule: () => {
      throw new Error("must not resolve");
    },
    getDeclarationModel: () => {
      throw new Error("must not declare");
    },
    getTargetIdentity: () => undefined,
  });

  assert.equal(ownershipHost.providers.resolveVirtualModule(specifier).kind, "rejected");
  assert.equal(ownershipHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerOwnershipFailed);

  const resolutionHost = new ExtensionHost({});
  resolutionHost.providers.registerTargetBindingProvider({
    identity: providerIdentity("throwing-resolution-provider", "demo", "binding"),
    ownsModule: () => ({ kind: "owned" }),
    resolveModule: () => {
      throw new Error("resolution failed");
    },
    getDeclarationModel: () => {
      throw new Error("must not declare");
    },
    getTargetIdentity: () => undefined,
  });

  assert.equal(resolutionHost.providers.resolveVirtualModule(specifier).kind, "rejected");
  assert.equal(resolutionHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerResolveFailed);

  const declarationHost = new ExtensionHost({});
  declarationHost.providers.registerTargetBindingProvider({
    identity: providerIdentity("throwing-declaration-provider", "demo", "binding"),
    ownsModule: () => ({ kind: "owned" }),
    resolveModule: (moduleSpecifier) => ({
      kind: "virtual",
      moduleSpecifier,
      virtualFileName: "tsts-provider://throwing/declaration",
      providerModuleId: "throwing.declaration",
    }),
    getDeclarationModel: () => {
      throw new Error("declaration failed");
    },
    getTargetIdentity: () => undefined,
  });

  assert.equal(declarationHost.providers.resolveVirtualModule(specifier).kind, "rejected");
  assert.equal(declarationHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerDeclarationFailed);
});

test("provider declaration models render the supported export member and type matrix", () => {
  const specifier = "@target/runtime.js";
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider(matrixBindingProvider(specifier));

  const resolved = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo" });
  assert.equal(resolved.kind, "resolved");
  if (resolved.kind !== "resolved") {
    return;
  }

  const source = resolved.module.virtualSourceText;
  assert.match(source, /export declare class Box<T extends number>/);
  assert.match(source, /constructor\(value: T\);/);
  assert.match(source, /value: T;/);
  assert.match(source, /static Count: number;/);
  assert.match(source, /\[index: number\]: string;/);
  assert.match(source, /export interface Writer/);
  assert.match(source, /write\(text\?: string, \.\.\.chunks: string\[\]\): number;/);
  assert.match(source, /export declare function tryParse<T extends number>\(text\?: string, \.\.\.values: number\[\]\): boolean;/);
  assert.match(source, /export type Pair = \[number, string\];/);
  assert.match(source, /export declare const DefaultSize: number;/);
  assert.match(source, /export declare namespace Buffers/);
  assert.match(source, /export declare enum Color/);
  assert.match(source, /Red,/);
  assert.match(source, /export declare const NativeHandle: unique symbol;/);

  assert.equal(resolved.module.declarationModel.exports.length, 8);
  assert.equal(resolved.module.virtualDocument.sourceText, source);
});

test("provider declaration models reject incomplete member declarations instead of rendering implicit unknown", () => {
  const specifier = "@target/runtime.js";
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider(matrixBindingProvider(specifier, {
    members: [{
      id: "Changed",
      name: "Changed",
      kind: "property",
    }],
  }));

  const resolved = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo" });
  assert.equal(resolved.kind, "rejected");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.invalidProviderDeclaration);
});

test("provider declaration models reject target types without explicit source shape", () => {
  const specifier = "@target/runtime.js";
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider(matrixBindingProvider(specifier, {
    valueType: {
      kind: "target-named",
      target: "demo",
      id: "Demo.NativeInt",
    },
  }));

  const resolved = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo" });
  assert.equal(resolved.kind, "rejected");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.invalidProviderDeclaration);
});

test("provider virtual module cache is separated by provider identity and resolution context", () => {
  const specifier = "@target/cache.js";
  let resolveCount = 0;
  const host = new ExtensionHost({});
  host.providers.registerTargetBindingProvider({
    identity: {
      id: "cache-provider",
      version: "1.0.0",
      target: "demo",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "binding",
      configHash: "config-a",
    },
    ownsModule: (moduleSpecifier) => moduleSpecifier === specifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: (moduleSpecifier, context) => {
      resolveCount += 1;
      return {
        kind: "virtual",
        moduleSpecifier,
        virtualFileName: `tsts-provider://cache/${context.activeSurface ?? "default"}`,
        providerModuleId: `cache:${context.activeSurface ?? "default"}`,
      };
    },
    getDeclarationModel: (resolution) => ({
      moduleSpecifier: resolution.moduleSpecifier,
      providerModuleId: resolution.providerModuleId,
      exports: [{ id: "Value", name: "Value", kind: "value", type: { kind: "number" } }],
    }),
    getTargetIdentity: () => undefined,
  });

  const first = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo", activeSurface: "array" });
  const second = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo", activeSurface: "array" });
  const third = host.providers.resolveVirtualModule(specifier, { activeTarget: "demo", activeSurface: "span" });

  assert.equal(first.kind, "resolved");
  assert.equal(second.kind, "resolved");
  assert.equal(third.kind, "resolved");
  if (first.kind !== "resolved" || second.kind !== "resolved" || third.kind !== "resolved") {
    return;
  }

  assert.equal(first.module, second.module);
  assert.notEqual(first.module, third.module);
  assert.notEqual(first.module.cacheKey, third.module.cacheKey);
  assert.equal(resolveCount, 2);
});

test("required provider module patterns diagnose missing providers without hardcoded target names", () => {
  const host = new ExtensionHost({}, {
    activeTarget: "demo",
    requiredProviderModules: [{
      specifierPrefix: "@target/",
      target: "demo",
      message: "The demo target provider is required for @target/* imports.",
    }],
  });

  const missing = host.providers.resolveVirtualModule("@target/runtime.js", { activeTarget: "demo" });
  const unrelated = host.providers.resolveVirtualModule("@other/runtime.js", { activeTarget: "demo" });

  assert.equal(missing.kind, "rejected");
  assert.equal(unrelated.kind, "unowned");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerMissing);
  assert.equal(host.diagnostics.all()[0]?.extensionCode, "REQUIRED_PROVIDER_MISSING");
});

test("semantic finalization seals facts and gates consumer reads", () => {
  const host = new ExtensionHost({});
  const subject = {};

  host.facts.set(subject, primitiveFactKey, "int32");
  assert.equal(host.getFactForConsumer("emitter", subject, primitiveFactKey), undefined);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.consumerBeforeFinalization);

  host.finalizeSemantics();
  assert.equal(host.finalized, true);
  assert.equal(host.getFactForConsumer("emitter", subject, primitiveFactKey), "int32");
  assert.equal(host.getFactsForConsumer("emitter", subject).length, 1);

  assert.equal(host.facts.set({}, primitiveFactKey, "int64"), "sealed");
  assert.equal(host.diagnostics.all().at(-1)?.numericCode, ExtensionHostDiagnosticCode.factStoreSealed);
});

test("lifecycle hooks run before semantic finalization seals facts", () => {
  const sourceFile = {};
  const finalizationMarker = {};
  const afterFinalize = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("source-semantics", {
        initialize: (context) => {
          context.registerLifecycleHook<SourceFileBoundLifecycleRequest>(ExtensionLifecycleEvent.afterSourceFileBound, (request) => {
            if (request.sourceFile === sourceFile && request.fileName === "/src/index.ts") {
              context.facts.set(request.sourceFile, primitiveFactKey, "int32");
            }
          });
          context.registerLifecycleHook(ExtensionLifecycleEvent.beforeSemanticsFinalized, () => {
            context.facts.set(finalizationMarker, primitiveFactKey, "int64");
          });
        },
      }),
    ],
  });

  host.runLifecycle(ExtensionLifecycleEvent.afterSourceFileBound, {
    sourceFile,
    fileName: "/src/index.ts",
  });
  assert.equal(host.facts.get(sourceFile, primitiveFactKey), "int32");

  host.finalizeSemantics();
  assert.equal(host.facts.get(finalizationMarker, primitiveFactKey), "int64");
  assert.equal(host.facts.set(afterFinalize, primitiveFactKey, "uint32"), "sealed");
});

test("canonical identity facts are consumer-queryable after finalization", () => {
  const host = new ExtensionHost({});
  const localAlias = {};

  host.facts.set(localAlias, canonicalIdentityFactKey, {
    kind: "export",
    id: "@example/native/types.js::int",
    packageName: "@example/native",
    packageVersion: "1.0.0",
    subpath: "types.js",
    exportName: "int",
    importKind: "type",
    canonicalSymbolId: "@example/native/types.js::int",
  });
  host.finalizeSemantics();

  assert.equal(host.getFactForConsumer("emitter", localAlias, canonicalIdentityFactKey)?.exportName, "int");
});

test("consumer query facade exposes finalized target facts without fallback inference", () => {
  const call = {};
  const propertyAccess = {};
  const argument = {};
  const runtimeType = {};
  const host = new ExtensionHost({});

  host.facts.set(call, selectedTargetSignatureFactKey, selectedSignature("System.Console.WriteLine(System.Int32)"));
  host.facts.set(propertyAccess, targetOperationFactKey, targetOperation("System.String.Length", "property"));
  host.facts.set(argument, argumentPassingFactKey, { mode: "byref-readonly" });
  host.facts.set(runtimeType, runtimeCarrierFactKey, {
    carrier: { kind: "target-named", id: "System.Int32" },
    requiresAllocation: false,
  });

  const consumer = createExtensionConsumerQueries(host, "emitter");
  assert.equal(consumer.getSelectedTargetCall(call), undefined);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.consumerBeforeFinalization);

  host.finalizeSemantics();
  assert.equal(consumer.getSelectedTargetCall(call)?.member.id, "System.Console.WriteLine(System.Int32)");
  assert.equal(consumer.getSelectedTargetProperty(propertyAccess)?.operationId, "System.String.Length");
  assert.equal(consumer.getArgumentPassingFact(argument)?.mode, "byref-readonly");
  assert.equal(consumer.getRuntimeCarrierFact(runtimeType)?.carrier.kind, "target-named");
});

test("required consumer facts report diagnostics instead of allowing fallback inference", () => {
  const call = {};
  const type = {};
  const host = new ExtensionHost({});
  const consumer = createExtensionConsumerQueries(host, "emitter");

  host.finalizeSemantics();
  assert.equal(consumer.requireSelectedTargetCall(call, "emitting provider-owned call"), undefined);
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.requiredFactMissing);
  assert.equal(host.diagnostics.all()[0]?.extensionCode, "REQUIRED_FACT_MISSING");

  assert.equal(consumer.requireSelectedTargetCall(call, "emitting provider-owned call"), undefined);
  assert.equal(host.diagnostics.all().length, 1);

  host.facts.get(type, sourcePrimitiveFactKey);
  assert.equal(consumer.requireSourcePrimitiveFact(type, "emitting source primitive"), undefined);
  assert.equal(host.diagnostics.all()[1]?.numericCode, ExtensionHostDiagnosticCode.requiredFactMissing);
});

test("strict consumer facts report diagnostics and fail closed", () => {
  const call = {};
  const host = new ExtensionHost({});
  const consumer = createExtensionConsumerQueries(host, "emitter");

  host.finalizeSemantics();
  assert.throws(
    () => consumer.mustSelectedTargetCall(call, "emitting provider-owned call"),
    /requires extension fact 'tsts\.target-bindings:selectedTargetSignature'/,
  );
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.requiredFactMissing);

  const satisfiedHost = new ExtensionHost({});
  satisfiedHost.facts.set(call, selectedTargetSignatureFactKey, selectedSignature("System.Console.WriteLine(System.Int32)"));
  satisfiedHost.finalizeSemantics();
  assert.equal(createExtensionConsumerQueries(satisfiedHost, "emitter").mustSelectedTargetCall(call).member.id, "System.Console.WriteLine(System.Int32)");
});

test("lifecycle hook failures are diagnostics with extension identity", () => {
  const host = new ExtensionHost({}, {
    extensions: [
      extension("bad-extension", {
        initialize: (context) => {
          context.registerLifecycleHook(ExtensionLifecycleEvent.afterSourceFileBound, () => {
            throw new Error("boom");
          });
        },
      }),
    ],
  });

  host.runLifecycle(ExtensionLifecycleEvent.afterSourceFileBound, {
    sourceFile: {},
    fileName: "/src/index.ts",
  });

  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.lifecycleHookFailed);
  assert.equal(host.diagnostics.all()[0]?.extensionId, "tsts.extension-host");
});

test("observation hook failures are diagnostics and do not crash the compiler host", () => {
  const call = {};
  const callee = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("bad-observation-extension", {
        observationOwners: [ExtensionObservationPoint.mapCheckedCall],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => {
            throw new Error("boom");
          });
        },
      }),
    ],
  });

  const result = host.runObservation(ExtensionObservationPoint.mapCheckedCall, {
    call,
    callee,
    arguments: [],
  }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });

  assert.equal(result.kind, "reject");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationHookFailed);
  assert.equal(host.diagnostics.all()[0]?.extensionId, "tsts.extension-host");
});

test("diagnostics are deduplicated by stable identity", () => {
  const host = new ExtensionHost({});

  host.requireObservationOwner(ExtensionObservationPoint.mapCheckedCall);
  host.requireObservationOwner(ExtensionObservationPoint.mapCheckedCall);

  const ownerMissingDiagnostics = host.diagnostics.all().filter((diagnostic) => diagnostic.numericCode === ExtensionHostDiagnosticCode.observationOwnerMissing);
  assert.equal(ownerMissingDiagnostics.length, 1);
});

test("target constraint and post-check assignability observations use owner hooks instead of core fallback", () => {
  const intType = {};
  const longType = {};
  const stringType = {};
  const searchValuesConstraint = { kind: "implements", contract: "System.IEquatable`1" } as const;
  let coreCalled = false;
  const host = new ExtensionHost({}, {
    extensions: [
      extension("source", {
        initialize: (context) => {
          context.facts.set(intType, sourcePrimitiveFactKey, {
            kind: "int32",
            signed: true,
            width: 32,
            runtimeBase: "number",
          });
        },
      }),
      extension("csharp", {
        dependsOn: ["source"],
        observationOwners: [ExtensionObservationPoint.validateTargetConstraint, ExtensionObservationPoint.validatePostCheckAssignability],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.validateTargetConstraint, (request) => {
            if (request.source === intType && request.constraint === searchValuesConstraint) {
              return acceptObservation(true, [{ message: "int32 maps to System.Int32 and implements IEquatable<System.Int32>" }]);
            }
            return deferObservation;
          });
          context.registerObservation(ExtensionObservationPoint.validatePostCheckAssignability, (request) => {
            if (request.source === intType && request.target === longType) {
              return acceptObservation(true);
            }
            return rejectObservation<boolean>(diagnostic("csharp", "ASSIGNABILITY_REJECTED", 9100001, "source type is not assignable to target type"));
          });
        },
      }),
    ],
  });

  const constraintResult = host.runObservation(ExtensionObservationPoint.validateTargetConstraint, {
    source: intType,
    constraint: searchValuesConstraint,
    target: "csharp",
  }, () => {
    coreCalled = true;
    return false;
  }, { requireOwner: true });

  assert.equal(constraintResult.kind, "accept");
  assert.equal(constraintResult.kind === "accept" ? constraintResult.value : false, true);
  assert.equal(coreCalled, false);

  const assignabilityResult = host.runObservation(ExtensionObservationPoint.validatePostCheckAssignability, {
    source: intType,
    target: stringType,
    relation: "assignment",
  }, () => true, { requireOwner: true });

  assert.equal(assignabilityResult.kind, "reject");
  assert.equal(host.diagnostics.all().at(-1)?.extensionCode, "ASSIGNABILITY_REJECTED");
});

test("required extension-owned observations cannot fall back when owner is absent or deferred", () => {
  const missingOwnerHost = new ExtensionHost({});
  const call = {};
  const callee = {};
  const argument = {};
  const missing = missingOwnerHost.runObservation(ExtensionObservationPoint.mapCheckedCall, {
    call,
    callee,
    arguments: [argument],
  }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });

  assert.equal(missing.kind, "missing-owner");
  assert.equal(missingOwnerHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationOwnerMissing);

  const deferredOwnerHost = new ExtensionHost({}, {
    extensions: [
      extension("csharp", {
        observationOwners: [ExtensionObservationPoint.mapCheckedCall],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => deferObservation);
        },
      }),
    ],
  });
  const deferred = deferredOwnerHost.runObservation(ExtensionObservationPoint.mapCheckedCall, {
    call,
    callee,
    arguments: [argument],
  }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });

  assert.equal(deferred.kind, "owner-deferred");
  assert.equal(deferredOwnerHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationOwnerDeferred);
});

test("unowned multiple extension observations produce deterministic conflict", () => {
  const call = {};
  const callee = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("a", {
        initialize: (context) => context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => acceptObservation({ selectedSignature: selectedSignature("a") })),
      }),
      extension("b", {
        initialize: (context) => context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => acceptObservation({ selectedSignature: selectedSignature("b") })),
      }),
    ],
  });

  const result = host.runObservation(ExtensionObservationPoint.mapCheckedCall, { call, callee, arguments: [] }, () => ({ selectedSignature: selectedSignature("core") }));
  assert.equal(result.kind, "conflict");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationConflict);
});

test("owned multiple non-deferred observations produce deterministic conflict", () => {
  const call = {};
  const callee = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("owner", {
        observationOwners: [ExtensionObservationPoint.mapCheckedCall],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => acceptObservation({ selectedSignature: selectedSignature("first") }));
          context.registerObservation(ExtensionObservationPoint.mapCheckedCall, () => acceptObservation({ selectedSignature: selectedSignature("second") }));
        },
      }),
    ],
  });

  const result = host.runObservation(ExtensionObservationPoint.mapCheckedCall, { call, callee, arguments: [] }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });
  assert.equal(result.kind, "conflict");
  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.observationConflict);
});

test("target extension composition requires explicit multi-target mode", () => {
  const host = new ExtensionHost({}, {
    extensions: [
      extension("csharp", { composition: { kind: "target", target: "csharp" } }),
      extension("rust", { composition: { kind: "target", target: "rust" } }),
    ],
  });

  assert.equal(host.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.multipleTargetExtensions);

  const multiTargetHost = new ExtensionHost({}, {
    allowMultipleTargets: true,
    extensions: [
      extension("csharp", { composition: { kind: "target", target: "csharp" } }),
      extension("rust", { composition: { kind: "target", target: "rust" } }),
    ],
  });

  assert.equal(multiTargetHost.diagnostics.hasErrors(), false);
});

test("checked call mapping records selected target signature facts", () => {
  const call = {};
  const callee = {};
  const argument = {};
  const voidType = {};
  const writeLineInt = selectedSignature("System.Console.WriteLine(System.Int32)");
  const host = new ExtensionHost({}, {
    extensions: [
      extension("csharp", {
        observationOwners: [ExtensionObservationPoint.mapCheckedCall],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.mapCheckedCall, (request) => {
            if (request.call === call) {
              context.facts.set(request.call, selectedTargetSignatureFactKey, writeLineInt);
              return acceptObservation({
                selectedSignature: writeLineInt,
                returnType: voidType,
              });
            }
            return deferObservation;
          });
        },
      }),
    ],
  });

  const result = host.runObservation(ExtensionObservationPoint.mapCheckedCall, {
    call,
    callee,
    arguments: [argument],
    target: "csharp",
  }, () => ({ selectedSignature: selectedSignature("core") }), { requireOwner: true });

  assert.equal(result.kind, "accept");
  assert.equal(host.facts.get(call, selectedTargetSignatureFactKey)?.member.id, "System.Console.WriteLine(System.Int32)");
});

test("property, element, and operator observations expose target operations", () => {
  const lengthExpression = {};
  const indexExpression = {};
  const addExpression = {};
  const arrayType = {};
  const indexArgument = {};
  const leftOperand = {};
  const rightOperand = {};
  const int32Type = {};
  const elementType = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("surface", {
        observationOwners: [
          ExtensionObservationPoint.mapCheckedPropertyAccess,
          ExtensionObservationPoint.mapCheckedElementAccess,
          ExtensionObservationPoint.mapCheckedOperator,
        ],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.mapCheckedPropertyAccess, (request) => {
            const operation = targetOperation("System.Array.Length", "property");
            context.facts.set(request.expression, targetOperationFactKey, operation);
            return acceptObservation({ operation, resultType: int32Type });
          });
          context.registerObservation(ExtensionObservationPoint.mapCheckedElementAccess, (request) => {
            const operation = targetOperation("System.Array.Get", "indexer");
            context.facts.set(request.expression, targetOperationFactKey, operation);
            return acceptObservation({ operation, resultType: elementType });
          });
          context.registerObservation(ExtensionObservationPoint.mapCheckedOperator, (request) => {
            const operation = targetOperation("System.Int32.op_Addition", "operator");
            context.facts.set(request.expression, targetOperationFactKey, operation);
            return acceptObservation({ operation, resultType: int32Type });
          });
        },
      }),
    ],
  });

  assert.equal(host.runObservation(ExtensionObservationPoint.mapCheckedPropertyAccess, { expression: lengthExpression, receiver: arrayType, propertyName: "Length" }, () => ({ operation: targetOperation("core", "property") }), { requireOwner: true }).kind, "accept");
  assert.equal(host.runObservation(ExtensionObservationPoint.mapCheckedElementAccess, { expression: indexExpression, receiver: arrayType, argument: indexArgument }, () => ({ operation: targetOperation("core", "indexer") }), { requireOwner: true }).kind, "accept");
  assert.equal(host.runObservation(ExtensionObservationPoint.mapCheckedOperator, { expression: addExpression, operator: "+", left: leftOperand, right: rightOperand }, () => ({ operation: targetOperation("core", "operator") }), { requireOwner: true }).kind, "accept");

  assert.equal(host.facts.get(lengthExpression, targetOperationFactKey)?.operationId, "System.Array.Length");
  assert.equal(host.facts.get(indexExpression, targetOperationFactKey)?.operationId, "System.Array.Get");
  assert.equal(host.facts.get(addExpression, targetOperationFactKey)?.operationId, "System.Int32.op_Addition");
});

test("contextual target type and target type argument observations preserve target facts", () => {
  const lambda = {};
  const listGetItem = {};
  const delegateType = {};
  const coreType = {};
  const int32Type = {};
  const argument = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("target", {
        observationOwners: [ExtensionObservationPoint.recordContextualTargetType, ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.recordContextualTargetType, (request) => acceptObservation({
            type: delegateType,
            targetType: { kind: "target-named", id: "System.Func`2" },
          }));
          context.registerObservation(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, () => acceptObservation({
            targetTypeArguments: [{ kind: "source-primitive", name: "int32" }],
          }));
        },
      }),
    ],
  });

  const contextual = host.runObservation(ExtensionObservationPoint.recordContextualTargetType, { expression: lambda, context: delegateType }, () => ({ type: coreType }), { requireOwner: true });
  assert.equal(contextual.kind === "accept" ? contextual.value.type : undefined, delegateType);

  const inferred = host.runObservation(ExtensionObservationPoint.mapInferredSourceTypeArgumentsToTarget, { declaration: listGetItem, arguments: [argument] }, () => ({ targetTypeArguments: [] }), { requireOwner: true });
  assert.deepEqual(inferred.kind === "accept" ? inferred.value.targetTypeArguments : [], [{ kind: "source-primitive", name: "int32" }]);
});

test("flow validation supports local rejection and target compiler validation facts", () => {
  const movedUse = {};
  const returnedBorrow = {};
  const movedSymbol = {};
  const borrowSymbol = {};
  const host = new ExtensionHost({}, {
    extensions: [
      extension("rust", {
        observationOwners: [ExtensionObservationPoint.validateExtensionFlowUse],
        initialize: (context) => {
          context.registerObservation(ExtensionObservationPoint.validateExtensionFlowUse, (request) => {
            if (request.useSite === movedUse) {
              context.facts.set(request.useSite, flowStateFactKey, { state: "moved" });
              return rejectObservation(diagnostic("rust", "VALUE_WAS_MOVED", 9100101, "value was moved and cannot be used here"));
            }
            if (request.useSite === returnedBorrow) {
              context.facts.set(request.useSite, flowStateFactKey, {
                state: "target-validation-required",
                targetCompiler: "rustc",
              });
              return acceptObservation({
                valid: true,
                targetCompilerValidationRequired: true,
                targetCompiler: "rustc",
              });
            }
            return deferObservation;
          });
        },
      }),
    ],
  });

  const rejected = host.runObservation(ExtensionObservationPoint.validateExtensionFlowUse, { useSite: movedUse, symbol: movedSymbol, mode: "read", target: "rust" }, () => ({ valid: true }), { requireOwner: true });
  assert.equal(rejected.kind, "reject");
  assert.equal(host.facts.get(movedUse, flowStateFactKey)?.state, "moved");

  const accepted = host.runObservation(ExtensionObservationPoint.validateExtensionFlowUse, { useSite: returnedBorrow, symbol: borrowSymbol, mode: "read", target: "rust" }, () => ({ valid: false }), { requireOwner: true });
  assert.equal(accepted.kind === "accept" ? accepted.value.targetCompiler : undefined, "rustc");
  assert.equal(host.facts.get(returnedBorrow, flowStateFactKey)?.targetCompiler, "rustc");
});

test("advanced associated-type and const-generic facts are first-class", () => {
  const iteratorType = {};
  const itemType = {};
  const fixedBytesType = {};
  const host = new ExtensionHost({});

  assert.equal(host.facts.set(iteratorType, associatedTypeFactKey, {
    owner: iteratorType,
    name: "Item",
    value: itemType,
  }), "inserted");
  assert.equal(host.facts.set(fixedBytesType, constGenericFactKey, {
    name: "N",
    value: 32,
  }), "inserted");

  assert.equal(host.facts.get(iteratorType, associatedTypeFactKey)?.value, itemType);
  assert.equal(host.facts.get(fixedBytesType, constGenericFactKey)?.value, 32);
});

test("target binding facts preserve provider identity and constraints", () => {
  const searchValues = {};
  const fact: TargetBindingFact = {
    id: "System.Buffers.SearchValues`1",
    sourceName: "SearchValues",
    targetName: "System.Buffers.SearchValues`1",
    target: "csharp",
    kind: "struct",
    typeParameters: [{
      name: "T",
      constraints: [{
        kind: "implements",
        contract: "System.IEquatable`1",
        typeArguments: [{ kind: "type-parameter", name: "T" }],
      }],
    }],
  };
  const host = new ExtensionHost({});

  assert.equal(host.facts.set(searchValues, targetBindingFactKey, fact), "inserted");
  assert.equal(host.facts.get(searchValues, targetBindingFactKey)?.typeParameters?.[0]?.constraints?.[0]?.kind, "implements");
});

function dotnetBindingProvider(
  ownedSpecifier: string,
  options: {
    readonly id?: string;
    readonly providerKind?: TargetBindingProvider["identity"]["providerKind"];
    readonly extensionContractVersion?: string;
    readonly declarationModel?: (resolution: ProviderModuleResolution) => ProviderDeclarationModel;
  } = {},
): TargetBindingProvider {
  const moduleId = "dotnet:System.Buffers";
  const targetIdentity: TargetIdentity = {
    target: "csharp",
    id: "System.Buffers.SearchValues`1",
    displayName: "System.Buffers.SearchValues<T>",
  };
  return {
    identity: {
      id: options.id ?? "dotnet",
      version: "1.0.0",
      target: "csharp",
      extensionContractVersion: options.extensionContractVersion ?? TstsProviderContractVersion,
      providerKind: options.providerKind ?? "binding",
    },
    ownsModule: (specifier) => specifier === ownedSpecifier
      ? { kind: "owned", evidence: [{ message: "owned by the .NET target binding provider" }] }
      : { kind: "unowned" },
    resolveModule: (specifier) => ({
      kind: "virtual",
      moduleSpecifier: specifier,
      virtualFileName: "tsts-provider://dotnet/System.Buffers",
      providerModuleId: moduleId,
      packageName: "@example/dotnet",
      packageVersion: "1.0.0",
    }),
    getDeclarationModel: options.declarationModel ?? ((resolution) => ({
      moduleSpecifier: resolution.moduleSpecifier,
      providerModuleId: resolution.providerModuleId,
      exports: [{
        id: "SearchValues",
        name: "SearchValues",
        kind: "class",
        targetIdentity,
        typeParameters: [{
          name: "T",
          constraints: [{ kind: "unknown" }],
        }],
        members: [{
          id: "Contains",
          name: "Contains",
          kind: "method",
          signatures: [{
            id: "Contains(T)",
            parameters: [{ name: "value", type: { kind: "type-parameter", name: "T" } }],
            returnType: { kind: "source-primitive", name: "bool" },
          }],
        }],
      }, {
        id: "Token",
        name: "Token",
        kind: "type",
        targetIdentity: {
          target: "csharp",
          id: "System.Int32",
          displayName: "System.Int32",
        },
        type: {
          kind: "target-named",
          target: "csharp",
          id: "System.Int32",
          sourceShape: { kind: "number" },
        },
      }],
    })),
    getTargetIdentity: (symbol) => symbol.moduleSpecifier === ownedSpecifier && symbol.exportName === "SearchValues"
      ? targetIdentity
      : undefined,
  };
}

function matrixBindingProvider(
  ownedSpecifier: string,
  options: {
    readonly members?: readonly ProviderMemberDeclaration[];
    readonly valueType?: ProviderDeclarationModel["exports"][number]["type"];
  } = {},
): TargetBindingProvider {
  return {
    identity: {
      id: "matrix-provider",
      version: "1.0.0",
      target: "demo",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "binding",
    },
    ownsModule: (specifier) => specifier === ownedSpecifier ? { kind: "owned" } : { kind: "unowned" },
    resolveModule: (specifier) => ({
      kind: "virtual",
      moduleSpecifier: specifier,
      virtualFileName: "tsts-provider://matrix/runtime",
      providerModuleId: "matrix.runtime",
    }),
    getDeclarationModel: (resolution) => ({
      moduleSpecifier: resolution.moduleSpecifier,
      providerModuleId: resolution.providerModuleId,
      exports: [{
        id: "Box",
        name: "Box",
        kind: "class",
        targetIdentity: { target: "demo", id: "Demo.Box`1" },
        typeParameters: [{
          name: "T",
          constraints: [{ kind: "source-primitive", name: "int32" }],
        }],
        members: options.members ?? [{
          id: "ctor",
          name: "constructor",
          kind: "constructor",
          signatures: [{
            id: "new(T)",
            parameters: [{ name: "value", type: { kind: "type-parameter", name: "T" } }],
          }],
        }, {
          id: "value",
          name: "value",
          kind: "property",
          type: { kind: "type-parameter", name: "T" },
        }, {
          id: "Count",
          name: "Count",
          kind: "field",
          static: true,
          type: { kind: "number" },
        }, {
          id: "item",
          name: "item",
          kind: "indexer",
          signatures: [{
            id: "item(number)",
            parameters: [{ name: "index", type: { kind: "number" } }],
            returnType: { kind: "string" },
          }],
        }],
      }, {
        id: "Writer",
        name: "Writer",
        kind: "interface",
        members: [{
          id: "write",
          name: "write",
          kind: "method",
          signatures: [{
            id: "write",
            parameters: [
              { name: "text", type: { kind: "string" }, optional: true },
              { name: "chunks", type: { kind: "array", elementType: { kind: "string" } }, rest: true },
            ],
            returnType: { kind: "number" },
          }],
        }],
      }, {
        id: "tryParse",
        name: "tryParse",
        kind: "function",
        typeParameters: [{
          name: "T",
          constraints: [{ kind: "source-primitive", name: "int32" }],
        }],
        signatures: [{
          id: "tryParse",
          typeParameters: [{
            name: "T",
            constraints: [{ kind: "source-primitive", name: "int32" }],
          }],
          parameters: [
            { name: "text", type: { kind: "string" }, optional: true },
            { name: "values", type: { kind: "array", elementType: { kind: "number" } }, rest: true },
          ],
          returnType: { kind: "boolean" },
        }],
      }, {
        id: "Pair",
        name: "Pair",
        kind: "type",
        type: { kind: "tuple", elementTypes: [{ kind: "number" }, { kind: "string" }] },
      }, {
        id: "DefaultSize",
        name: "DefaultSize",
        kind: "value",
        type: options.valueType ?? { kind: "number" },
      }, {
        id: "Buffers",
        name: "Buffers",
        kind: "namespace",
        members: [{
          id: "Capacity",
          name: "Capacity",
          kind: "field",
          type: { kind: "number" },
        }],
      }, {
        id: "Color",
        name: "Color",
        kind: "enum",
        members: [
          { id: "Red", name: "Red", kind: "field" },
          { id: "Blue", name: "Blue", kind: "field" },
        ],
      }, {
        id: "NativeHandle",
        name: "NativeHandle",
        kind: "opaque",
      }],
    }),
    getTargetIdentity: () => undefined,
  };
}

function providerIdentity(id: string, target: string, providerKind: NonNullable<TargetBindingProvider["identity"]["providerKind"]>) {
  return {
    id,
    version: "1.0.0",
    target,
    extensionContractVersion: TstsProviderContractVersion,
    providerKind,
  };
}

function diagnostic(extensionId: string, extensionCode: string, numericCode: number, message: string): ExtensionDiagnostic {
  return {
    extensionId,
    extensionCode,
    numericCode,
    category: "error",
    message,
    identity: `${extensionId}:${extensionCode}:${message}`,
  };
}

function selectedSignature(id: string): SelectedTargetSignatureFact {
  return {
    member: {
      id,
      sourceName: "WriteLine",
      targetName: id,
      kind: "method",
      parameters: [{
        name: "value",
        type: { kind: "source-primitive", name: "int32" },
        passingMode: "by-value",
      }],
    },
  };
}

function targetOperation(operationId: string, operationKind: TargetOperationFact["operationKind"]): TargetOperationFact {
  return {
    operationId,
    operationKind,
    targetOperation: operationId,
  };
}
