import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import { Background } from "../go/context.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import { SourceFile_FileName, SourceFile_as_ast_HasFileName } from "../internal/ast/ast.js";
import { Node_Arguments, Node_Symbol, Node_Text } from "../internal/ast/ast.js";
import { Node_End, Node_ForEachChild, Node_Pos } from "../internal/ast/spine.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Diagnostic_Code, Diagnostic_End, Diagnostic_Pos, Diagnostic_String } from "../internal/ast/diagnostic.js";
import { AsTypeReferenceNode } from "../internal/ast/generated/casts.js";
import { KindArrowFunction, KindBinaryExpression, KindCallExpression, KindElementAccessExpression, KindIdentifier, KindNumberKeyword, KindPropertyAccessExpression, KindTypeReference } from "../internal/ast/generated/kinds.js";
import { LibPath, WrapFS } from "../internal/bundled/bundled.js";
import type { CompilerOptions } from "../internal/core/compileroptions.js";
import { ResolutionModeESM } from "../internal/core/compileroptions.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import {
  NewProgram,
  Program_BindSourceFiles,
  Program_GetProgramDiagnostics,
  Program_GetResolvedModule,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFile,
  Program_GetSourceFiles,
  Program_GetSyntacticDiagnostics,
} from "../internal/compiler/program.js";
import { ResolvedModuleExtensionProviderVirtual, ResolvedModule_IsProviderVirtual } from "../internal/module/types.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import type { ParseConfigHost } from "../internal/tsoptions/tsconfigparsing.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import { FromMap } from "../internal/vfs/vfstest/vfstest.js";
import { TstsProviderContractVersion, ExtensionHostDiagnosticCode, ExtensionObservationPoint, acceptObservation, argumentPassingFactKey, attachExtensionHost, createExtensionConsumerQueries, createSourceSemanticsExtension, deferObservation, finalizeExtensionSemantics, getExtensionHost, rejectObservation, runtimeCarrierFactKey, sourcePrimitive, sourcePrimitiveFactKey, targetConversionFactKey } from "./index.js";
import { canonicalIdentityFactKey, flowStateFactKey, providerVirtualDeclarationFactKey, selectedTargetSignatureFactKey, targetOperationFactKey, targetBindingFactKey } from "./index.js";
import type { CheckedCallMappingRequest, CompilerExtension, ExtensionFactSubject, ExtensionObservationContext, SourcePrimitiveFact, SelectedTargetSignatureFact, TargetConstraintValidationRequest, TargetOperationFact, TargetBindingProvider, TargetIdentity, TargetMember, TargetSemanticProvider } from "./index.js";

function createExampleSourceSemanticsExtension(): CompilerExtension {
  return createSourceSemanticsExtension({
    identity: {
      id: "example.source-semantics",
      version: "1.0.0",
      capabilityNamespace: "example-source-semantics",
    },
    modules: [{
      moduleSpecifier: "@example/native/types.js",
      packageName: "@example/native",
      subpath: "types.js",
      exports: [
        sourcePrimitive("int", "int32", "number", true, 32),
      ],
    }, {
      moduleSpecifier: "@example/native/lang.js",
      packageName: "@example/native",
      subpath: "lang.js",
      exports: [
        { kind: "call-marker", exportName: "move", marker: "move" },
      ],
    }],
  });
}

test("provider-backed virtual modules participate in normal program binding", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import { SearchValues } from "@example/dotnet/System.Buffers.js";

      declare const values: SearchValues<number>;
      values.Contains(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Buffers.js")],
  });

  const program = NewProgram(options);
  const sourceFileNames = Program_GetSourceFiles(program).map((file) => SourceFile_FileName(file));

  assert.equal(extended.extensionHost.diagnostics.all().length, 0);
  assert.ok(sourceFileNames.includes("/src/index.ts"));
  assert.ok(sourceFileNames.includes("tsts-provider://dotnet/System.Buffers"));

  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assert.equal(Program_GetProgramDiagnostics(program).length, 0);
  assert.equal(Program_GetSyntacticDiagnostics(program, Background(), index).length, 0);
  assert.equal(Program_GetSemanticDiagnostics(program, Background(), index).length, 0);
  const resolvedProviderModule = Program_GetResolvedModule(program, SourceFile_as_ast_HasFileName(index), "@example/dotnet/System.Buffers.js", ResolutionModeESM);
  assert.equal(ResolvedModule_IsProviderVirtual(resolvedProviderModule), true);
  assert.equal(resolvedProviderModule?.Extension, ResolvedModuleExtensionProviderVirtual);
  assert.equal(resolvedProviderModule?.ProviderVirtual?.ProviderId, "dotnet-provider");
  assert.equal(resolvedProviderModule?.ProviderVirtual?.ProviderTarget, "dotnet");
  assert.equal(resolvedProviderModule?.ProviderVirtual?.ProviderModuleId, "System.Buffers");
  assert.equal(resolvedProviderModule?.ProviderVirtual?.ModuleSpecifier, "@example/dotnet/System.Buffers.js");

  Program_BindSourceFiles(program);
  const virtualFile = Program_GetSourceFile(program, "tsts-provider://dotnet/System.Buffers");
  assert.ok(virtualFile !== undefined);
  const virtualModuleSymbol = Node_Symbol(virtualFile as never);
  const searchValuesSymbol = virtualModuleSymbol?.Exports?.get("SearchValues");
  assert.ok(searchValuesSymbol !== undefined);

  assert.equal(extended.extensionHost.facts.get(virtualFile, canonicalIdentityFactKey)?.id, "System.Buffers");
  assert.equal(extended.extensionHost.facts.get(virtualFile, providerVirtualDeclarationFactKey)?.providerId, "dotnet-provider");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, canonicalIdentityFactKey)?.exportName, "SearchValues");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.id, "System.Buffers.SearchValues`1");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.typeParameters?.[0]?.constraints?.[0]?.kind, "implements");
  const constraint = extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.typeParameters?.[0]?.constraints?.[0];
  assert.equal(constraint?.kind === "implements" ? constraint.contract : undefined, "System.IEquatable`1");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.members?.[0]?.id, "Contains(T)");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.members?.[0]?.parameters[0]?.type.kind, "type-parameter");
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.members?.[0]?.returnType?.kind, "source-primitive");

  const call = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(extended.extensionHost.facts.get(call, selectedTargetSignatureFactKey), undefined);

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getVirtualDeclaration(virtualFile)?.providerModuleId, "System.Buffers");
  assert.equal(consumer.getVirtualDeclaration(searchValuesSymbol)?.exportName, "SearchValues");
  assert.equal(consumer.getTargetBindingFact(searchValuesSymbol)?.id, "System.Buffers.SearchValues`1");
  assert.equal(consumer.getSelectedTargetCall(call), undefined);
});

test("provider-backed virtual modules support alias and namespace import forms", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import type { SearchValues as SearchValuesAlias } from "@example/dotnet/System.Buffers.js";
      import type * as Buffers from "@example/dotnet/System.Buffers.js";

      declare const aliased: SearchValuesAlias<number>;
      declare const namespaced: Buffers.SearchValues<number>;
      aliased;
      namespaced;
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Buffers.js")],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  Program_BindSourceFiles(program);
  const virtualFile = Program_GetSourceFile(program, "tsts-provider://dotnet/System.Buffers");
  assert.ok(virtualFile !== undefined);
  const searchValuesSymbol = Node_Symbol(virtualFile as never)?.Exports?.get("SearchValues");
  assert.ok(searchValuesSymbol !== undefined);
  assert.equal(extended.extensionHost.facts.get(searchValuesSymbol, targetBindingFactKey)?.id, "System.Buffers.SearchValues`1");
});

test("programs without an extension host stay on the direct TS-Go path", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import { value } from "./local.js";
      value.toString();
    `],
    ["/src/local.ts", "export const value = 1;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const program = NewProgram(options);
  assert.ok(program !== undefined);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);

  assert.equal(getExtensionHost(program), undefined);
  assert.ok(!Program_GetSourceFiles(program).some((file) => SourceFile_FileName(file).startsWith("tsts-provider://")));
  assert.equal(Program_GetProgramDiagnostics(program).length, 0);
  assert.equal(Program_GetSyntacticDiagnostics(program, Background(), index).length, 0);
});

test("checker records provider-owned target call facts for consumers", () => {
  const selectedSignature = selectedSearchValuesContainsSignature();
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function contains(value: number): boolean;
      contains(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, semanticProvider(selectedSignature))],
  });

  const program = NewProgram(options);
  assert.ok(program !== undefined);
  assert.equal(getExtensionHost(program), extended.extensionHost);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  const selected = extended.extensionHost.facts.get(call, selectedTargetSignatureFactKey);
  assert.equal(selected?.member.id, "Contains(T)");
  assert.equal(selected?.member.parameters[0]?.type.kind, "type-parameter");
  assert.equal(selected?.member.returnType?.kind, "source-primitive");

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getSelectedTargetCall(call)?.member.id, "Contains(T)");
});

test("checker records provider-owned target type argument facts on selected calls", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function convert<T>(value: number): T;
      const result = convert(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [semanticOnlyExtension("dotnet-generic-inference-extension", genericInferenceSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  const selectedCall = consumer.getSelectedTargetCall(call);
  assert.equal(selectedCall?.member.id, "System.Convert.ChangeType<T>(System.Int32)");
  assert.equal(selectedCall?.typeArguments, undefined);
  assert.deepEqual(selectedCall?.targetTypeArguments, [{ kind: "source-primitive", name: "int32" }]);
});

test("checker records provider-owned contextual target facts without changing TS contextual type", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      const callback: (value: number) => number = value => value;
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [semanticOnlyExtension("dotnet-contextual-extension", contextualSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const arrow = findFirstNodeByKind(index, KindArrowFunction);
  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  const contextualFact = consumer.getContextualTargetTypeFact(arrow);
  assert.equal(contextualFact?.targetType?.kind, "target-named");
  assert.equal(contextualFact?.targetType?.id, "System.Func`2");
});

test("checker records provider-owned parameter mode facts from selected target signatures", () => {
  const selectedSignature = {
    member: searchValuesContainsTargetMember("byref-readonly"),
  } satisfies SelectedTargetSignatureFact;
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function contains(value: number): boolean;
      declare let value: number;
      contains(value);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, parameterModeSemanticProvider(selectedSignature))],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  const argument = getFirstCallArgument(call);
  assert.equal(extended.extensionHost.facts.get(argument, argumentPassingFactKey)?.mode, "byref-readonly");
  assert.equal(extended.extensionHost.facts.get(call, argumentPassingFactKey), undefined);

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getArgumentPassingFact(argument)?.mode, "byref-readonly");
});

test("checker records parameter mode facts per argument without collapsing them onto the call", () => {
  const selectedSignature = {
    member: twoParameterTargetMember(),
  } satisfies SelectedTargetSignatureFact;
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function pair(first: number, second: number): void;
      declare let first: number;
      declare let second: number;
      pair(first, second);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, parameterModeSequenceSemanticProvider(selectedSignature))],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  const arguments_ = Node_Arguments(call) ?? [];
  const first = arguments_[0];
  const second = arguments_[1];
  assert.ok(first !== undefined);
  assert.ok(second !== undefined);
  assert.equal(extended.extensionHost.facts.get(first, argumentPassingFactKey)?.mode, "by-value");
  assert.equal(extended.extensionHost.facts.get(second, argumentPassingFactKey)?.mode, "byref-readonly");
  assert.equal(extended.extensionHost.facts.get(call, argumentPassingFactKey), undefined);
  assert.equal(extended.extensionHost.diagnostics.all().some((diagnostic) => diagnostic.extensionCode === "FACT_CONFLICT"), false);
});

test("checker records provider-owned runtime carrier and argument conversion facts", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import type { SearchValues } from "@example/dotnet/System.Buffers.js";

      declare let values: SearchValues<number>;
      declare function toByte(value: number): number;
      values;
      toByte(300);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Buffers.js", false, carrierConversionSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const searchValuesTypeReference = findFirstNodeByKind(index, KindTypeReference);
  const runtimeCarrier = extended.extensionHost.facts.get(searchValuesTypeReference, runtimeCarrierFactKey)?.carrier;
  assert.equal(runtimeCarrier?.kind, "target-named");
  assert.equal(runtimeCarrier?.kind === "target-named" ? runtimeCarrier.id : undefined, "System.Buffers.SearchValues`1");

  const call = findFirstNodeByKind(index, KindCallExpression);
  const argument = getFirstCallArgument(call);
  assert.equal(extended.extensionHost.facts.get(argument, targetConversionFactKey)?.convertedType?.kind, "target-named");
  assert.equal(extended.extensionHost.facts.get(argument, targetConversionFactKey)?.operation?.operationId, "System.Convert.ToByte");

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getRuntimeCarrierFact(searchValuesTypeReference)?.carrier.kind, "target-named");
  assert.equal(consumer.getTargetConversionFact(argument)?.operation?.targetOperation, "System.Convert.ToByte");
});

test("checker validates provider-owned flow use diagnostics from source-semantics marker facts", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import { move } from "@example/native/lang.js";

      declare let value: number;
      move(value);
      value;
    `],
    ["/src/node_modules/@example/native/package.json", JSON.stringify({
      name: "@example/native",
      version: "1.0.0",
      type: "module",
      exports: {
        "./lang.js": {
          types: "./lang.d.ts",
          default: "./lang.js",
        },
      },
    })],
    ["/src/node_modules/@example/native/lang.d.ts", "export declare function move<T>(value: T): T;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "rust",
    extensions: [
      createExampleSourceSemanticsExtension(),
      semanticOnlyExtension("rust-flow-extension", rustFlowSemanticProvider()),
    ],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9920301);
  assert.match(Diagnostic_String(diagnostics[0]), /RUST0301/);
  assert.match(Diagnostic_String(diagnostics[0]), /value was moved/);

  const movedUse = findLastIdentifierByText(index, "value");
  const flowDiagnostics = extended.extensionHost.diagnostics.all().filter((diagnostic) => diagnostic.extensionCode === "RUST_MOVED_VALUE");
  assert.equal(flowDiagnostics.length, 1);
  assert.equal(flowDiagnostics[0]?.nodeOrSpan, movedUse);
  assert.equal(extended.extensionHost.facts.get(movedUse, flowStateFactKey), undefined);
});

test("checker validates provider-owned assignability after normal TS compatibility", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import { move } from "@example/native/lang.js";

      declare let source: number;
      declare let target: number;
      target = move(source);
    `],
    ["/src/node_modules/@example/native/package.json", JSON.stringify({
      name: "@example/native",
      version: "1.0.0",
      type: "module",
      exports: {
        "./lang.js": {
          types: "./lang.d.ts",
          default: "./lang.js",
        },
      },
    })],
    ["/src/node_modules/@example/native/lang.d.ts", "export declare function move<T>(value: T): T;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "rust",
    extensions: [
      createExampleSourceSemanticsExtension(),
      semanticOnlyExtension("rust-assignability-extension", rustAssignabilityProvider()),
    ],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  Program_BindSourceFiles(program);
  const moveCall = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(extended.extensionHost.facts.get(moveCall, flowStateFactKey)?.state, "moved");

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9920401);
  assert.match(Diagnostic_String(diagnostics[0]), /RUST0401/);
  assert.match(Diagnostic_String(diagnostics[0]), /moved expression cannot be assigned/);

  const assignabilityDiagnostics = extended.extensionHost.diagnostics.all().filter((diagnostic) => diagnostic.extensionCode === "RUST_MOVED_ASSIGNMENT");
  assert.equal(assignabilityDiagnostics.length, 1);
  assert.equal(assignabilityDiagnostics[0]?.nodeOrSpan, moveCall);
});

test("checker validates provider-owned target constraints through standard semantic diagnostics", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import type { int } from "@example/native/types.js";
      import type { SearchValues } from "@example/dotnet/System.Buffers.js";

      type Good = SearchValues<int>;
      type Bad = SearchValues<number>;
    `],
    ["/src/node_modules/@example/native/package.json", JSON.stringify({
      name: "@example/native",
      version: "1.0.0",
      type: "module",
      exports: {
        "./types.js": {
          types: "./types.d.ts",
          default: "./types.js",
        },
      },
    })],
    ["/src/node_modules/@example/native/types.d.ts", "export type int = number;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [
      createExampleSourceSemanticsExtension(),
      providerExtension("@example/dotnet/System.Buffers.js", false, constraintSemanticProvider()),
    ],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9910201);
  assert.match(Diagnostic_String(diagnostics[0]), /DOTNET0201/);
  assert.match(Diagnostic_String(diagnostics[0]), /must implement System\.IEquatable`1/);

  const targetDiagnostics = extended.extensionHost.diagnostics.all().filter((diagnostic) => diagnostic.extensionCode === "DOTNET_CONSTRAINT");
  assert.equal(targetDiagnostics.length, 1);
  assert.equal((targetDiagnostics[0]?.nodeOrSpan as GoPtr<Node>)?.Kind, KindNumberKeyword);
});

test("provider extensions can drive a realistic emitter-facing fact chain", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      import type { int } from "@example/native/types.js";
      import type { SearchValues } from "@example/dotnet/System.Buffers.js";

      declare const values: SearchValues<int>;
      declare let value: int;
      values.Contains(value);
    `],
    ["/src/node_modules/@example/native/package.json", JSON.stringify({
      name: "@example/native",
      version: "1.0.0",
      type: "module",
      exports: {
        "./types.js": {
          types: "./types.d.ts",
          default: "./types.js",
        },
      },
    })],
    ["/src/node_modules/@example/native/types.d.ts", "export type int = number;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [
      createExampleSourceSemanticsExtension(),
      providerExtension("@example/dotnet/System.Buffers.js", false, compositeDotnetProvider()),
    ],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  const argument = getFirstCallArgument(call);
  const searchValuesTypeReference = findTypeReferenceByName(index, "SearchValues");

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getSelectedTargetCall(call)?.member.id, "Contains(T)");
  assert.deepEqual(consumer.getSelectedTargetCall(call)?.targetTypeArguments, [{ kind: "source-primitive", name: "int32" }]);
  assert.equal(consumer.getArgumentPassingFact(argument)?.mode, "byref-readonly");
  assert.equal(consumer.getTargetConversionFact(argument)?.convertedType?.kind, "target-named");
  assert.equal(consumer.getRuntimeCarrierFact(searchValuesTypeReference)?.carrier.kind, "target-named");
});

test("checker-owned target call seam reports deferred providers without fallback facts", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function contains(value: number): boolean;
      contains(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, deferredSemanticProvider())],
  });

  const program = NewProgram(options);
  assert.ok(program !== undefined);
  assert.equal(getExtensionHost(program), extended.extensionHost);
  assert.equal(extended.extensionHost.getObservationOwner(ExtensionObservationPoint.mapCheckedCall)?.identity.id, "dotnet-provider-extension");
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assert.equal(Program_GetProgramDiagnostics(program).length, 0);
  assert.equal(Program_GetSyntacticDiagnostics(program, Background(), index).length, 0);
  assert.equal(Program_GetSemanticDiagnostics(program, Background(), index).length, 0);

  const call = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(extended.extensionHost.facts.get(call, selectedTargetSignatureFactKey), undefined);
  assert.equal(extended.extensionHost.diagnostics.all().at(-1)?.numericCode, ExtensionHostDiagnosticCode.observationOwnerDeferred);

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getSelectedTargetCall(call), undefined);
});

test("checker records provider-owned member element and operator facts for consumers", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare const text: { length: number };
      declare const values: { [index: number]: number };
      declare const left: number;
      declare const right: number;

      text.length;
      values[0];
      left + right;
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, surfaceSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const propertyAccess = findFirstNodeByKind(index, KindPropertyAccessExpression);
  const elementAccess = findFirstNodeByKind(index, KindElementAccessExpression);
  const binaryExpression = findFirstNodeByKind(index, KindBinaryExpression);

  assert.equal(extended.extensionHost.facts.get(propertyAccess, targetOperationFactKey)?.operationId, "System.String.Length");
  assert.equal(extended.extensionHost.facts.get(elementAccess, targetOperationFactKey)?.operationId, "System.ReadOnlySpan.GetItem");
  assert.equal(extended.extensionHost.facts.get(binaryExpression, targetOperationFactKey)?.operationId, "System.Int32.op_Addition");

  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  assert.equal(consumer.getSelectedTargetProperty(propertyAccess)?.targetOperation, "System.String.Length");
  assert.equal(consumer.getSelectedTargetElementAccess(elementAccess)?.targetOperation, "System.ReadOnlySpan.GetItem");
  assert.equal(consumer.getSelectedTargetOperator(binaryExpression)?.targetOperation, "System.Int32.op_Addition");
});

test("checker-owned member element and operator seams report deferred providers without fallback facts", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare const text: { length: number };
      declare const values: { [index: number]: number };
      declare const left: number;
      declare const right: number;

      text.length;
      values[0];
      left + right;
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, deferredSurfaceSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assert.equal(Program_GetSemanticDiagnostics(program, Background(), index).length, 0);

  const propertyAccess = findFirstNodeByKind(index, KindPropertyAccessExpression);
  const elementAccess = findFirstNodeByKind(index, KindElementAccessExpression);
  const binaryExpression = findFirstNodeByKind(index, KindBinaryExpression);

  assert.equal(extended.extensionHost.facts.get(propertyAccess, targetOperationFactKey), undefined);
  assert.equal(extended.extensionHost.facts.get(elementAccess, targetOperationFactKey), undefined);
  assert.equal(extended.extensionHost.facts.get(binaryExpression, targetOperationFactKey), undefined);
  assert.ok(extended.extensionHost.diagnostics.all().filter((diagnostic) => diagnostic.numericCode === ExtensionHostDiagnosticCode.observationOwnerDeferred).length >= 3);
});

test("extension-owned semantic rejections surface through standard diagnostics with source location", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function toByte(value: number): number;
      toByte(300);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, rejectingCallSemanticProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9910125);
  assert.match(Diagnostic_String(diagnostics[0]), /DOTNET0125/);
  assert.match(Diagnostic_String(diagnostics[0]), /does not fit in System.Byte/);

  const call = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(extended.extensionHost.facts.get(call, selectedTargetSignatureFactKey), undefined);
});

test("extension diagnostics can use explicit source spans through the standard semantic channel", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare function pin(value: number): number;
      pin(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, sourceSpanRejectingCallProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  const call = findFirstNodeByKind(index, KindCallExpression);

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9910126);
  assert.equal(Diagnostic_Pos(diagnostics[0]), Node_Pos(call));
  assert.equal(Diagnostic_End(diagnostics[0]), Node_End(call));
  assert.match(Diagnostic_String(diagnostics[0]), /DOTNET0126/);
});

test("unsupported native surface operations are diagnostics, not fallback calls", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare const values: { push(value: number): number };
      values.push(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    activeSurface: "native-array",
    extensions: [providerExtension("@example/dotnet/System.Console.js", false, rejectingNativeArrayPushProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  const call = findFirstNodeByKind(index, KindCallExpression);

  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), index);
  assert.equal(diagnostics.length, 1);
  assert.equal(Diagnostic_Code(diagnostics[0]), 9910301);
  assert.ok(Diagnostic_Pos(diagnostics[0]) >= Node_Pos(call));
  assert.ok(Diagnostic_End(diagnostics[0]) <= Node_End(call));
  assert.match(Diagnostic_String(diagnostics[0]), /DOTNET0301/);
  assert.match(Diagnostic_String(diagnostics[0]), /native-array surface does not support push/);

  const nativeSurfaceDiagnostics = extended.extensionHost.diagnostics.all().filter((diagnostic) => diagnostic.extensionCode === "DOTNET_NATIVE_ARRAY_PUSH");
  assert.equal(nativeSurfaceDiagnostics.length, 1);
  assert.equal(nativeSurfaceDiagnostics[0]?.extensionId, "dotnet-native-array-surface-provider");
  assert.match(nativeSurfaceDiagnostics[0]?.evidence?.[0]?.message ?? "", /Surface capability/);
  assert.equal(extended.extensionHost.facts.get(call, selectedTargetSignatureFactKey), undefined);
  assert.equal(extended.extensionHost.facts.get(call, targetOperationFactKey), undefined);
});

test("rust owned Vec surface records provider call facts without JS array fallback", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `
      declare const values: { push(value: number): void };
      values.push(1);
    `],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "rust",
    activeSurface: "owned-vec",
    extensions: [semanticOnlyExtension("rust-vec-surface-extension", rustVecSurfaceProvider())],
  });

  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  assertCleanProgram(program, index);

  const call = findFirstNodeByKind(index, KindCallExpression);
  assert.equal(finalizeExtensionSemantics(options), extended.extensionHost);
  const consumer = createExtensionConsumerQueries(extended.extensionHost, "emitter");
  const selectedCall = consumer.getSelectedTargetCall(call);
  assert.equal(selectedCall?.member.id, "alloc.vec.Vec.push(i32)");
  assert.equal(selectedCall?.member.targetName, "push");
  assert.equal(selectedCall?.member.parameters[0]?.passingMode, "move");
});

test("provider-owned rejected modules do not fall back to file-system resolution", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `import { SearchValues } from "@example/dotnet/System.Buffers.js";`],
    ["/src/node_modules/@example/dotnet/System.Buffers.js", "export const SearchValues = 1;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        allowJs: true,
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "dotnet",
    extensions: [providerExtension("@example/dotnet/System.Buffers.js", true)],
  });

  const program = NewProgram(options);
  const sourceFileNames = Program_GetSourceFiles(program).map((file) => SourceFile_FileName(file));

  assert.equal(extended.extensionHost.diagnostics.all().length, 1);
  assert.equal(extended.extensionHost.diagnostics.all()[0]?.extensionCode, "PROVIDER_REJECTED_MODULE");
  assert.ok(!sourceFileNames.includes("/src/node_modules/@example/dotnet/System.Buffers.js"));
});

test("configured provider-owned imports diagnose missing providers and do not fall back to files", () => {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", `import { SearchValues } from "@target/runtime.js";`],
    ["/src/node_modules/@target/runtime.js", "export const SearchValues = 1;"],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        allowJs: true,
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const extended = attachExtensionHost(options, {
    activeTarget: "demo",
    requiredProviderModules: [{
      specifierPrefix: "@target/",
      target: "demo",
      message: "The demo target provider is required for @target/* imports.",
    }],
  });

  const program = NewProgram(options);
  const sourceFileNames = Program_GetSourceFiles(program).map((file) => SourceFile_FileName(file));

  assert.equal(extended.extensionHost.diagnostics.all().length, 1);
  assert.equal(extended.extensionHost.diagnostics.all()[0]?.numericCode, ExtensionHostDiagnosticCode.providerMissing);
  assert.ok(!sourceFileNames.includes("/src/node_modules/@target/runtime.js"));
});

function providerExtension(specifier: string, reject = false, provider?: TargetSemanticProvider): CompilerExtension {
  return {
    identity: {
      id: "dotnet-provider-extension",
      version: "1.0.0",
      capabilityNamespace: "dotnet",
    },
    initialize(context): void {
      context.registerTargetBindingProvider(dotnetProvider(specifier, reject));
      if (provider !== undefined) {
        assert.equal(context.registerTargetSemanticProvider(provider), true);
      }
    },
  };
}

function semanticOnlyExtension(id: string, provider: TargetSemanticProvider): CompilerExtension {
  return {
    identity: {
      id,
      version: "1.0.0",
      capabilityNamespace: id,
    },
    initialize(context): void {
      assert.equal(context.registerTargetSemanticProvider(provider), true);
    },
  };
}

function semanticProvider(selectedSignature: SelectedTargetSignatureFact): TargetSemanticProvider {
  return {
    identity: {
      id: "dotnet-semantic-provider",
      version: "1.0.0",
      target: "dotnet",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    mapCheckedCall: () => acceptObservation({
      selectedSignature,
      returnType: semanticSubject("bool"),
    }),
  };
}

function genericInferenceSemanticProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "dotnet-generic-inference-semantic-provider",
      version: "1.0.0",
      target: "dotnet",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    mapCheckedCall: () => acceptObservation({
      selectedSignature: {
        member: {
          id: "System.Convert.ChangeType<T>(System.Int32)",
          sourceName: "convert",
          targetName: "ChangeType",
          kind: "method",
          parameters: [{
            name: "value",
            type: { kind: "source-primitive", name: "int32" },
            passingMode: "by-value",
          }],
          typeParameters: [{ name: "T" }],
          overloadGroup: "System.Convert.ChangeType",
        },
      },
      returnType: semanticSubject("T"),
    }),
    mapInferredSourceTypeArgumentsToTarget: () => acceptObservation({
      targetTypeArguments: [{ kind: "source-primitive", name: "int32" }],
    }),
  };
}

function contextualSemanticProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "dotnet-contextual-semantic-provider",
      version: "1.0.0",
      target: "dotnet",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    recordContextualTargetType: (request) => acceptObservation({
      type: request.context,
      targetType: {
        kind: "target-named",
        id: "System.Func`2",
        typeArguments: [
          { kind: "source-primitive", name: "int32" },
          { kind: "source-primitive", name: "int32" },
        ],
      },
    }),
  };
}

function deferredSemanticProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "dotnet-deferred-semantic-provider",
      version: "1.0.0",
      target: "dotnet",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    mapCheckedCall: () => deferObservation,
  };
}

function parameterModeSemanticProvider(selectedSignature: SelectedTargetSignatureFact): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-parameter-mode-semantic-provider"),
    mapCheckedCall: () => acceptObservation({
      selectedSignature,
      returnType: semanticSubject("bool"),
    }),
    resolveParameterPassing: (request) => acceptObservation({
      passing: {
        mode: "byref-readonly",
        ...(request.argument !== undefined ? { targetExpression: request.argument } : {}),
      },
    }),
  };
}

function parameterModeSequenceSemanticProvider(selectedSignature: SelectedTargetSignatureFact): TargetSemanticProvider {
  let parameterIndex = 0;
  return {
    identity: semanticProviderIdentity("dotnet-parameter-mode-sequence-semantic-provider"),
    mapCheckedCall: () => acceptObservation({
      selectedSignature,
      returnType: semanticSubject("void"),
    }),
    resolveParameterPassing: (request) => {
      const mode = parameterIndex === 0 ? "by-value" : "byref-readonly";
      parameterIndex += 1;
      return acceptObservation({
        passing: {
          mode,
          ...(request.argument !== undefined ? { targetExpression: request.argument } : {}),
        },
      });
    },
  };
}

function carrierConversionSemanticProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-carrier-conversion-semantic-provider"),
    mapCheckedCall: () => acceptObservation({
      selectedSignature: {
        member: byteConversionTargetMember(),
      },
      returnType: semanticSubject("number"),
    }),
    mapCheckedConversion: () => acceptObservation({
      convertedType: { kind: "target-named", id: "System.Byte" },
      operation: targetOperation("System.Convert.ToByte", "method", "number"),
    }),
    resolveRuntimeCarrier: () => acceptObservation({
      carrier: { kind: "target-named", id: "System.Buffers.SearchValues`1" },
      requiresAllocation: false,
    }),
  };
}

function compositeDotnetProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-composite-semantic-provider"),
    validateTargetConstraint: (request, context) => constraintSemanticProvider().validateTargetConstraint!(request, context),
    mapCheckedCall: () => acceptObservation({
      selectedSignature: selectedSearchValuesContainsSignature(),
      returnType: semanticSubject("bool"),
    }),
    mapInferredSourceTypeArgumentsToTarget: () => acceptObservation({
      targetTypeArguments: [{ kind: "source-primitive", name: "int32" }],
    }),
    resolveParameterPassing: (request) => acceptObservation({
      passing: {
        mode: "byref-readonly",
        ...(request.argument !== undefined ? { targetExpression: request.argument } : {}),
      },
    }),
    mapCheckedConversion: () => acceptObservation({
      convertedType: { kind: "target-named", id: "System.Int32" },
      operation: targetOperation("System.Int32.Identity", "method", "int32"),
    }),
    resolveRuntimeCarrier: () => acceptObservation({
      carrier: { kind: "target-named", id: "System.Buffers.SearchValues`1" },
      requiresAllocation: false,
    }),
  };
}

function rustFlowSemanticProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "rust-flow-semantic-provider",
      version: "1.0.0",
      target: "rust",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    validateExtensionFlowUse: (request, context) => {
      const state = context.facts.get(request.symbol, flowStateFactKey);
      if (state?.state !== "moved") {
        return acceptObservation({ valid: true });
      }
      return rejectObservation({
        extensionId: context.extensionId,
        extensionCode: "RUST_MOVED_VALUE",
        numericCode: 9920301,
        publicCode: "RUST0301",
        category: "error",
        message: "The value was moved and cannot be used here.",
        nodeOrSpan: request.useSite,
        evidence: [{ message: "Source-core move marker", details: state }],
        identity: `rust-moved-value:${String((request.useSite as GoPtr<Node>)?.id ?? "unknown")}`,
      });
    },
  };
}

function rustAssignabilityProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "rust-assignability-semantic-provider",
      version: "1.0.0",
      target: "rust",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    validatePostCheckAssignability: (request, context) => {
      const state = context.facts.get(request.expression, flowStateFactKey);
      if (state?.state !== "moved") {
        return acceptObservation(true);
      }
      return rejectObservation({
        extensionId: context.extensionId,
        extensionCode: "RUST_MOVED_ASSIGNMENT",
        numericCode: 9920401,
        publicCode: "RUST0401",
        category: "error",
        message: "A moved expression cannot be assigned into target storage without target validation.",
        nodeOrSpan: request.expression,
        evidence: [{ message: "Source-core move marker", details: state }],
        identity: `rust-moved-assignment:${String((request.expression as GoPtr<Node>)?.id ?? "unknown")}`,
      });
    },
  };
}

function surfaceSemanticProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-surface-semantic-provider"),
    mapCheckedPropertyAccess: () => acceptObservation({
      operation: targetOperation("System.String.Length", "property", "int32"),
      resultType: semanticSubject("int32"),
    }),
    mapCheckedElementAccess: () => acceptObservation({
      operation: targetOperation("System.ReadOnlySpan.GetItem", "indexer", "char"),
      resultType: semanticSubject("char"),
    }),
    mapCheckedOperator: () => acceptObservation({
      operation: targetOperation("System.Int32.op_Addition", "operator", "int32"),
      resultType: semanticSubject("int32"),
    }),
  };
}

function deferredSurfaceSemanticProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-deferred-surface-semantic-provider"),
    mapCheckedPropertyAccess: () => deferObservation,
    mapCheckedElementAccess: () => deferObservation,
    mapCheckedOperator: () => deferObservation,
  };
}

function rejectingCallSemanticProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-rejecting-call-semantic-provider"),
    mapCheckedCall: (request: CheckedCallMappingRequest) => ({
      kind: "reject",
      diagnostic: {
        extensionId: "dotnet-rejecting-call-semantic-provider",
        extensionCode: "DOTNET_BYTE_RANGE",
        numericCode: 9910125,
        publicCode: "DOTNET0125",
        category: "error",
        message: "Numeric literal 300 does not fit in System.Byte.",
        nodeOrSpan: request.call,
        evidence: [{ message: "Target range", details: "System.Byte accepts 0..255." }],
        identity: "dotnet-byte-range:/src/index.ts:toByte",
      },
    }),
  };
}

function sourceSpanRejectingCallProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-source-span-rejecting-call-provider"),
    mapCheckedCall: (request: CheckedCallMappingRequest) => {
      const call = request.call as GoPtr<Node>;
      return rejectObservation({
        extensionId: "dotnet-source-span-rejecting-call-provider",
        extensionCode: "DOTNET_PIN_REQUIRES_FIXED",
        numericCode: 9910126,
        publicCode: "DOTNET0126",
        category: "error",
        message: "The target pin operation requires a fixed storage location.",
        nodeOrSpan: {
          sourceFile: GetSourceFileOfNode(call),
          pos: Node_Pos(call),
          end: Node_End(call),
        },
        evidence: [{ message: "Target rule", details: "pin(value) must be proven fixed before lowering." }],
        identity: "dotnet-pin-requires-fixed:/src/index.ts",
      });
    },
  };
}

function rejectingNativeArrayPushProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-native-array-surface-provider"),
    mapCheckedCall: (request: CheckedCallMappingRequest) => rejectObservation({
      extensionId: "dotnet-native-array-surface-provider",
      extensionCode: "DOTNET_NATIVE_ARRAY_PUSH",
      numericCode: 9910301,
      publicCode: "DOTNET0301",
      category: "error",
      message: "The active native-array surface does not support push; use a provider-supported collection surface.",
      nodeOrSpan: request.call,
      evidence: [{ message: "Surface capability", details: "native arrays expose fixed-size element access, not mutable push." }],
      identity: "dotnet-native-array-push:/src/index.ts",
    }),
  };
}

function rustVecSurfaceProvider(): TargetSemanticProvider {
  return {
    identity: {
      id: "rust-vec-surface-provider",
      version: "1.0.0",
      target: "rust",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "semantic",
    },
    mapCheckedCall: () => acceptObservation({
      selectedSignature: {
        member: {
          id: "alloc.vec.Vec.push(i32)",
          sourceName: "push",
          targetName: "push",
          kind: "method",
          parameters: [{
            name: "value",
            type: { kind: "source-primitive", name: "int32" },
            passingMode: "move",
          }],
          overloadGroup: "Vec.push",
        },
      },
      returnType: semanticSubject("void"),
    }),
  };
}

function constraintSemanticProvider(): TargetSemanticProvider {
  return {
    identity: semanticProviderIdentity("dotnet-constraint-semantic-provider"),
    validateTargetConstraint: (request, context) => {
      const primitive = getSourcePrimitiveForConstraintArgument(request.source, context);
      if (request.constraint.kind === "implements" && request.constraint.contract === "System.IEquatable`1" && primitive?.kind === "int32") {
        return acceptObservation(true, [{ message: "Source primitive int32 maps to System.Int32, which implements System.IEquatable<System.Int32>." }]);
      }
      return rejectTargetConstraint(request, context);
    },
  };
}

function rejectTargetConstraint(request: TargetConstraintValidationRequest, context: ExtensionObservationContext) {
  return {
    kind: "reject" as const,
    diagnostic: {
      extensionId: context.extensionId,
      extensionCode: "DOTNET_CONSTRAINT",
      numericCode: 9910201,
      publicCode: "DOTNET0201",
      category: "error" as const,
      message: "Target type argument must implement System.IEquatable`1.",
      nodeOrSpan: request.source,
      evidence: [{ message: "Provider target constraint", details: request.constraint }],
      identity: getConstraintDiagnosticIdentity(request.source),
    },
  };
}

function getConstraintDiagnosticIdentity(source: ExtensionFactSubject): string {
  if (source !== null && source !== undefined && typeof source === "object") {
    const node = source as GoPtr<Node>;
    return `dotnet-constraint:${String(node?.id ?? "unknown")}`;
  }
  return `dotnet-constraint:${typeof source}:${String(source)}`;
}

function getSourcePrimitiveForConstraintArgument(source: ExtensionFactSubject, context: ExtensionObservationContext): SourcePrimitiveFact | undefined {
  if (source === null || source === undefined || typeof source !== "object") {
    return undefined;
  }
  const node = source as GoPtr<Node>;
  if (node === undefined) {
    return undefined;
  }
  const direct = context.factResolver.resolve(node, sourcePrimitiveFactKey);
  if (direct !== undefined) {
    return direct;
  }
  const typeName = node.Kind === KindTypeReference ? AsTypeReferenceNode(node)?.TypeName : node;
  const symbol = Node_Symbol(typeName);
  return symbol === undefined ? undefined : context.factResolver.resolve(symbol, sourcePrimitiveFactKey);
}

function semanticProviderIdentity(id: string) {
  return {
    id,
    version: "1.0.0",
    target: "dotnet",
    extensionContractVersion: TstsProviderContractVersion,
    providerKind: "semantic" as const,
  };
}

function semanticSubject(name: string): object {
  const existing = semanticSubjects.get(name);
  if (existing !== undefined) {
    return existing;
  }
  const created = Object.freeze({ name });
  semanticSubjects.set(name, created);
  return created;
}

const semanticSubjects = new Map<string, object>();

function targetOperation(operationId: string, operationKind: TargetOperationFact["operationKind"], resultType: string | TargetOperationFact["resultType"]): TargetOperationFact {
  return {
    operationId,
    operationKind,
    targetOperation: operationId,
    ...(resultType !== undefined ? { resultType: typeof resultType === "string" ? semanticSubject(resultType) : resultType } : {}),
  };
}

function dotnetProvider(specifier: string, reject: boolean): TargetBindingProvider {
  const targetIdentity: TargetIdentity = {
    target: "dotnet",
    id: "System.Buffers.SearchValues`1",
    displayName: "System.Buffers.SearchValues<T>",
  };
  return {
    identity: {
      id: "dotnet-provider",
      version: "1.0.0",
      target: "dotnet",
      extensionContractVersion: TstsProviderContractVersion,
      providerKind: "binding",
    },
    ownsModule(moduleSpecifier) {
      return moduleSpecifier === specifier ? { kind: "owned" } : { kind: "unowned" };
    },
    resolveModule(moduleSpecifier) {
      if (reject) {
        return {
          extensionId: "dotnet-provider",
          extensionCode: "PROVIDER_REJECTED_MODULE",
          numericCode: 9900001,
          category: "error",
          message: `Rejected ${moduleSpecifier}`,
          identity: `rejected:${moduleSpecifier}`,
        };
      }
      return {
        kind: "virtual",
        moduleSpecifier,
        virtualFileName: "tsts-provider://dotnet/System.Buffers",
        providerModuleId: "System.Buffers",
        packageName: "@example/dotnet",
        packageVersion: "1.0.0",
      };
    },
    getDeclarationModel(resolution) {
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        exports: [{
          id: "SearchValues",
          name: "SearchValues",
          kind: "class",
          targetIdentity,
          typeParameters: [{
          name: "T",
          constraints: [{
            kind: "target-named",
            target: "dotnet",
            id: "System.IEquatable`1",
            typeArguments: [{ kind: "type-parameter", name: "T" }],
            sourceShape: { kind: "unknown" },
          }],
        }],
          members: [{
            id: "Contains",
            name: "Contains",
            kind: "method",
            signatures: [{
              id: "Contains(T)",
              parameters: [{ name: "value", type: { kind: "type-parameter", name: "T" } }],
              returnType: { kind: "boolean" },
            }],
          }],
        }],
      };
    },
    getTargetIdentity(symbol) {
      return symbol.moduleSpecifier === specifier && symbol.exportName === "SearchValues" ? targetIdentity : undefined;
    },
  };
}

function assertCleanProgram(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): void {
  const programDiagnostics = Program_GetProgramDiagnostics(program);
  const syntacticDiagnostics = Program_GetSyntacticDiagnostics(program, Background(), sourceFile);
  const semanticDiagnostics = Program_GetSemanticDiagnostics(program, Background(), sourceFile);
  assert.equal(programDiagnostics.length, 0, programDiagnostics.map(Diagnostic_String).join("\n"));
  assert.equal(syntacticDiagnostics.length, 0, syntacticDiagnostics.map(Diagnostic_String).join("\n"));
  assert.equal(semanticDiagnostics.length, 0, semanticDiagnostics.map(Diagnostic_String).join("\n"));
}

function findFirstNodeByKind(root: GoPtr<Node>, kind: number): GoPtr<Node> {
  const found = findFirstNodeByKindWorker(root, kind);
  assert.ok(found !== undefined);
  return found;
}

function getFirstCallArgument(callExpression: GoPtr<Node>): GoPtr<Node> {
  const argument = (Node_Arguments(callExpression) ?? [])[0];
  assert.ok(argument !== undefined);
  return argument;
}

function findTypeReferenceByName(root: GoPtr<Node>, name: string): GoPtr<Node> {
  let found: GoPtr<Node>;
  visitNodes(root, (node) => {
    if (found !== undefined || node?.Kind !== KindTypeReference) {
      return;
    }
    const typeName = AsTypeReferenceNode(node)?.TypeName;
    if (Node_Text(typeName) === name) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function findLastIdentifierByText(root: GoPtr<Node>, text: string): GoPtr<Node> {
  let found: GoPtr<Node>;
  visitNodes(root, (node) => {
    if (node?.Kind === KindIdentifier && Node_Text(node) === text) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function findFirstNodeByKindWorker(root: GoPtr<Node>, kind: number): GoPtr<Node> {
  if (root === undefined) {
    return undefined;
  }
  if (root.Kind === kind) {
    return root;
  }
  let found: GoPtr<Node>;
  Node_ForEachChild(root, (child) => {
    found = findFirstNodeByKindWorker(child, kind);
    return (found !== undefined) as bool;
  });
  return found;
}

function visitNodes(root: GoPtr<Node>, visit: (node: GoPtr<Node>) => void): void {
  if (root === undefined) {
    return;
  }
  visit(root);
  Node_ForEachChild(root, (child) => {
    visitNodes(child, visit);
    return false as bool;
  });
}

function selectedSearchValuesContainsSignature(): SelectedTargetSignatureFact {
  return {
    member: searchValuesContainsTargetMember(),
  };
}

function byteConversionTargetMember(): TargetMember {
  return {
    id: "ToByte(System.Int32)",
    sourceName: "toByte",
    targetName: "ToByte",
    kind: "method",
    parameters: [{
      name: "value",
      type: { kind: "target-named", id: "System.Byte" },
      passingMode: "by-value",
    }],
    returnType: { kind: "target-named", id: "System.Byte" },
    overloadGroup: "ToByte",
  };
}

function twoParameterTargetMember(): TargetMember {
  return {
    id: "Pair(System.Int32,System.Int32)",
    sourceName: "pair",
    targetName: "Pair",
    kind: "method",
    parameters: [
      {
        name: "first",
        type: { kind: "target-named", id: "System.Int32" },
        passingMode: "by-value",
      },
      {
        name: "second",
        type: { kind: "target-named", id: "System.Int32" },
        passingMode: "byref-readonly",
      },
    ],
    overloadGroup: "Pair",
  };
}

function searchValuesContainsTargetMember(passingMode: TargetMember["parameters"][number]["passingMode"] = "by-value"): TargetMember {
  return {
    id: "Contains(T)",
    sourceName: "Contains",
    targetName: "Contains",
    kind: "method",
    parameters: [{
      name: "value",
      type: { kind: "type-parameter", name: "T" },
      passingMode,
    }],
    returnType: { kind: "source-primitive", name: "bool" },
    overloadGroup: "Contains",
  };
}
