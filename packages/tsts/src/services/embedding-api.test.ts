import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExtensionObservationPoint,
  TstsProviderContractVersion,
  acceptObservation,
  createCompilerSessionFromFiles,
  createExtensionConsumerQueries,
  createSourceSemanticsExtension,
  formatDiagnostics,
  sourcePrimitive,
} from "../index.js";
import type {
  AstReader,
  CompilerExtension,
  CompilerSession,
  ExtensionFactSubject,
  Node,
  ProviderDeclarationModel,
  ProviderModuleResolution,
  SourceFile,
  TargetBindingProvider,
  TargetIdentity,
  TargetOperationFact,
  TargetSemanticProvider,
} from "../index.js";

test("public embedding API drives a provider-backed program without internal imports", () => {
  const session = createEmbeddingSession(`
    import type { INT } from "@acme/native/types.js";
    import { consume } from "@acme/runtime.js";

    enum Mode {
      Read = 1,
      Write = Read << 1,
    }

    type Pair = [INT, string];
    type Maybe = string | INT[];
    class Box<T> { value!: T; }

    declare const values: INT[];
    declare const boxed: Box<INT>;
    let item!: INT;

    for (item of values) {
      consume(item);
    }

    boxed.value;
    export { Mode, boxed };
  `);

  const sourceFile = session.getSourceFile("/src/index.ts");
  assert.ok(sourceFile !== undefined);
  const diagnostics = session.getDiagnostics("all", sourceFile);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics.filter((diagnostic) => diagnostic !== undefined), "/src"));
  assert.ok(session.getSourceFiles().some((file) => session.ast.getFileName(file).startsWith("tsts-provider://acme/runtime")));
  assert.ok(session.getSourceFilesToEmit().some((file) => session.ast.getFileName(file) === "/src/index.ts"));

  const importDeclaration = findNode(sourceFile, session.ast, (node, ast) =>
    ast.is.IsImportDeclaration(node)
    && ast.text(ast.as.AsImportDeclaration(node)?.ModuleSpecifier) === "@acme/runtime.js");
  const moduleSpecifier = session.ast.as.AsImportDeclaration(importDeclaration)?.ModuleSpecifier;
  const moduleSymbol = session.checker.getModuleSymbolFromSpecifier(moduleSpecifier);
  const resolvedModuleSymbol = session.checker.getResolvedExternalModuleSymbol(moduleSymbol);
  assert.ok(resolvedModuleSymbol !== undefined);
  assert.ok(session.checker.getExportsOfModule(resolvedModuleSymbol).some((symbol) => symbol?.Name === "consume"));

  const consumeIdentifier = findNode(sourceFile, session.ast, (node, ast) => ast.is.IsIdentifier(node) && ast.text(node) === "consume");
  const consumeAlias = session.checker.getSymbolAtLocation(consumeIdentifier);
  assert.equal(consumeAlias?.Name, "consume");
  assert.equal(session.checker.getAliasedSymbol(consumeAlias)?.Name, "consume");

  const writeMember = findNode(sourceFile, session.ast, (node, ast) => ast.is.IsEnumMember(node) && ast.text(ast.name(node)) === "Write");
  assert.equal(session.checker.getConstantValue(writeMember), 2);

  const call = findNode(sourceFile, session.ast, (node, ast) => ast.is.IsCallExpression(node));
  const callSignature = session.checker.getResolvedSignature(call);
  assert.equal(session.checker.typeToString(session.checker.getReturnTypeOfSignature(callSignature)), "void");

  const boxedValue = findNode(sourceFile, session.ast, (node, ast) => ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "value");
  const boxedValueType = session.checker.getTypeAtLocation(boxedValue);
  assert.equal(session.types.isNumberLike(boxedValueType), true);
  assert.equal(session.types.typeToString(boxedValueType), "number");

  const pairType = session.checker.getTypeFromTypeNode(findTypeAliasType(sourceFile, session.ast, "Pair"));
  assert.equal(session.types.isTuple(pairType), true);
  assert.equal(session.types.getTupleElementTypes(pairType).length, 2);

  const maybeType = session.checker.getTypeFromTypeNode(findTypeAliasType(sourceFile, session.ast, "Maybe"));
  assert.equal(session.types.isUnion(maybeType), true);
  assert.equal(session.types.getUnionOrIntersectionTypes(maybeType).length, 2);

  const forOfStatement = findNode(sourceFile, session.ast, (node, ast) => ast.is.IsForOfStatement(node));
  assert.equal(session.isFinalized(), false);
  const extensionHost = session.finalizeExtensions();
  assert.equal(session.isFinalized(), true);
  assert.ok(extensionHost !== undefined);
  const consumer = createExtensionConsumerQueries(extensionHost, "embedding-test");
  assert.equal(consumer.getSelectedTargetIteration(forOfStatement)?.operationKind, "iteration");
  assert.equal(consumer.getSelectedTargetCall(call)?.member.id, "Acme.Runtime.consume(INT)");
  assert.throws(() => consumer.mustSelectedTargetIteration(boxedValue, "emitting non-iteration"), /requires extension fact/);
});

test("post-check iteration observations cannot make invalid TypeScript valid", () => {
  const session = createEmbeddingSession(`
    declare const notIterable: number;
    let item!: number;

    for (item of notIterable) {
      item;
    }
  `);

  const sourceFile = session.getSourceFile("/src/index.ts");
  assert.ok(sourceFile !== undefined);
  const diagnostics = session.getDiagnostics("semantic", sourceFile);
  assert.ok(diagnostics.length > 0);

  assert.ok(session.finalizeExtensions() !== undefined);
});

function createEmbeddingSession(sourceText: string): CompilerSession {
  return createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": sourceText,
      "/src/node_modules/@acme/native/types.d.ts": "export type INT = number;",
    },
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      target: "es2022",
    },
    extensionHostOptions: {
      activeTarget: "acme-native",
      extensions: [
        createExampleSourceSemanticsExtension(),
        createAcmeRuntimeExtension(),
      ],
    },
  });
}

function createExampleSourceSemanticsExtension(): CompilerExtension {
  return createSourceSemanticsExtension({
    identity: {
      id: "acme.source-semantics",
      version: "1.0.0",
      capabilityNamespace: "acme-source",
    },
    modules: [{
      moduleSpecifier: "@acme/native/types.js",
      packageName: "@acme/native",
      subpath: "types.js",
      exports: [
        sourcePrimitive("INT", "int32", "number", true, 32),
      ],
    }],
  });
}

function createAcmeRuntimeExtension(): CompilerExtension {
  const bindingProvider = createAcmeRuntimeBindingProvider();
  const semanticProvider = createAcmeRuntimeSemanticProvider();
  return {
    identity: {
      id: "acme.runtime-extension",
      version: "1.0.0",
      capabilityNamespace: "acme-runtime",
    },
    initialize(context): void {
      assert.equal(context.registerTargetBindingProvider(bindingProvider), true);
      assert.equal(context.registerTargetSemanticProvider(semanticProvider), true);
    },
  };
}

function createAcmeRuntimeBindingProvider(): TargetBindingProvider {
  const consumeIdentity: TargetIdentity = {
    target: "acme-native",
    id: "Acme.Runtime.consume",
    displayName: "Acme.Runtime.consume",
  };
  return {
    identity: providerIdentity("acme.runtime-binding", "binding"),
    ownsModule(specifier) {
      return specifier === "@acme/runtime.js" ? { kind: "owned" } : { kind: "unowned" };
    },
    resolveModule(specifier) {
      return {
        kind: "virtual",
        moduleSpecifier: specifier,
        virtualFileName: "tsts-provider://acme/runtime",
        providerModuleId: "acme-runtime",
        packageName: "@acme/runtime",
        packageVersion: "1.0.0",
      };
    },
    getDeclarationModel(resolution: ProviderModuleResolution): ProviderDeclarationModel {
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        exports: [{
          id: "consume",
          name: "consume",
          kind: "function",
          targetIdentity: consumeIdentity,
          signatures: [{
            id: "consume(INT)",
            parameters: [{ name: "value", type: { kind: "number" } }],
            returnType: { kind: "void" },
          }],
        }],
      };
    },
    getTargetIdentity(symbol) {
      return symbol.moduleSpecifier === "@acme/runtime.js" && symbol.exportName === "consume" ? consumeIdentity : undefined;
    },
  };
}

function createAcmeRuntimeSemanticProvider(): TargetSemanticProvider {
  return {
    identity: providerIdentity("acme.runtime-semantics", "semantic"),
    mapCheckedCall: () => acceptObservation({
      selectedSignature: {
        member: {
          id: "Acme.Runtime.consume(INT)",
          sourceName: "consume",
          targetName: "consume",
          kind: "method",
          parameters: [{
            name: "value",
            type: { kind: "source-primitive", name: "int32" },
            passingMode: "by-value",
          }],
        },
      },
    }),
    mapCheckedIteration: () => acceptObservation({
      operation: targetOperation("acme.foreach", "foreach"),
    }),
  };
}

function providerIdentity(id: string, providerKind: "binding" | "semantic") {
  return {
    id,
    version: "1.0.0",
    target: "acme-native",
    extensionContractVersion: TstsProviderContractVersion,
    providerKind,
  };
}

function targetOperation(operationId: string, targetOperation: string): TargetOperationFact {
  return {
    operationId,
    operationKind: "iteration",
    targetOperation,
  };
}

function findTypeAliasType(sourceFile: SourceFile | undefined, ast: AstReader, name: string): Node {
  return ast.as.AsTypeAliasDeclaration(findNode(sourceFile, ast, (node, reader) =>
    reader.is.IsTypeAliasDeclaration(node) && reader.text(reader.name(node)) === name))!.Type!;
}

function findNode(root: Node | undefined, ast: AstReader, predicate: (node: Node, ast: AstReader) => boolean): Node {
  let found: Node | undefined;
  visit(root, ast, (node) => {
    if (found === undefined && predicate(node, ast)) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function visit(node: Node | undefined, ast: AstReader, callback: (node: Node) => void): void {
  if (node === undefined) {
    return;
  }
  callback(node);
  ast.forEachChild(node, (child) => visit(child, ast, callback));
}
