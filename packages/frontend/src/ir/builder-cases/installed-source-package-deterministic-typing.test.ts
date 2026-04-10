import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { createProgram } from "../../program/creation.js";
import { createProgramContext } from "../program-context.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
  validateIrSoundness,
} from "../validation/index.js";
import { validateProgram } from "../../validator.js";
import type {
  IrFunctionDeclaration,
  IrExpression,
  IrExpressionStatement,
} from "../types.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const materializeInstalledSourceFixture = (
  fixtureNames: string | readonly string[]
) =>
  materializeFrontendFixture(
    (Array.isArray(fixtureNames) ? fixtureNames : [fixtureNames]).map(
      (fixtureName) =>
        fixtureName.startsWith("fragments/")
          ? fixtureName
          : `ir/installed-source-deterministic/${fixtureName}`
    )
  );

const expectNoDeterministicTypingDiagnostics = (
  tempDir: string,
  entryRelativePath: string,
  importedRelativePath: string,
  options?: {
    readonly projectRoot?: string;
    readonly sourceRoot?: string;
    readonly rootNamespace?: string;
    readonly surface?: string;
    readonly typeRoots?: readonly string[];
    readonly packageRoot?: string;
  }
) => {
  const projectRoot = options?.projectRoot ?? tempDir;
  const sourceRoot = options?.sourceRoot ?? path.join(projectRoot, "src");
  const rootNamespace = options?.rootNamespace ?? "TestApp";
  const packageRoot = options?.packageRoot ?? path.join(tempDir, "node_modules/@fixture/js");
  const entryPath = path.join(projectRoot, entryRelativePath);
  const programResult = createProgram([entryPath], {
    projectRoot,
    sourceRoot,
    rootNamespace,
    ...(options?.surface ? { surface: options.surface } : {}),
    ...(options?.typeRoots ? { typeRoots: [...options.typeRoots] } : {}),
  });
  expect(
    programResult.ok,
    programResult.ok
      ? undefined
      : programResult.error.diagnostics
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join("\n")
  ).to.equal(true);
  if (!programResult.ok) {
    return;
  }

  const program = programResult.value;
  const validation = validateProgram(program);
  const codes = validation.diagnostics.map((diagnostic) => diagnostic.code);
  expect(codes).to.not.include("TSN5201");
  expect(codes).to.not.include("TSN7414");

  const importedFilePath = path.join(
    packageRoot,
    importedRelativePath
  );
  const importedSourceFile = program.sourceFiles.find(
    (sourceFile) => path.resolve(sourceFile.fileName) === path.resolve(importedFilePath)
  );
  expect(importedSourceFile).to.not.equal(undefined);
  if (!importedSourceFile) {
    return;
  }

  const ctx = createProgramContext(program, {
    sourceRoot,
    rootNamespace,
  });
  const moduleResult = buildIrModule(
    importedSourceFile,
    program,
    {
      sourceRoot,
      rootNamespace,
    },
    ctx
  );

  expect(moduleResult.ok).to.equal(true);
  if (!moduleResult.ok) {
    return;
  }

  const unknownCalls: string[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    const expression = value as {
      readonly kind?: string;
      readonly inferredType?: { readonly kind?: string };
      readonly allowUnknownInferredType?: boolean;
      readonly sourceSpan?: {
        readonly file?: string;
        readonly line?: number;
        readonly column?: number;
      };
    };

    if (
      (expression.kind === "call" || expression.kind === "new") &&
      expression.inferredType?.kind === "unknownType"
    ) {
      const span = expression.sourceSpan;
      unknownCalls.push(
        `${expression.kind}@${span?.file ?? importedFilePath}:${span?.line ?? 0}:${span?.column ?? 0}`
      );
    }

    for (const nested of Object.values(value)) {
      visit(nested);
    }
  };

  visit(moduleResult.value.body);
  expect(unknownCalls).to.deep.equal([]);
};

const visitIr = (value: unknown, visitor: (value: unknown) => void): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  visitor(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      visitIr(item, visitor);
    }
    return;
  }

  for (const nested of Object.values(value)) {
    visitIr(nested, visitor);
  }
};

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("installed source-package deterministic typing", () => {
    it("preserves concrete generic array returns through call-resolution refresh passes", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "generic-array-return",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const lowered = runAnonymousTypeLoweringPass([moduleResult.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const arrayDecl = module.body.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "classDeclaration" }> =>
            stmt.kind === "classDeclaration" && stmt.name === "Array"
        );
        expect(arrayDecl).to.not.equal(undefined);
        if (!arrayDecl) return;

        const impl = arrayDecl.members.at(-1);
        expect(impl?.kind).to.equal("methodDeclaration");
        if (!impl || impl.kind !== "methodDeclaration" || !impl.body) return;

        const nonStringIf = impl.body.statements[1];
        expect(nonStringIf?.kind).to.equal("ifStatement");
        if (!nonStringIf || nonStringIf.kind !== "ifStatement") return;

        const thenBlock = nonStringIf.thenStatement;
        expect(thenBlock.kind).to.equal("blockStatement");
        if (thenBlock.kind !== "blockStatement") return;

        const returnStmt = thenBlock.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const returnExpr = returnStmt.expression;
        expect(returnExpr?.kind).to.equal("call");
        if (!returnExpr || returnExpr.kind !== "call") return;

        expect(returnExpr.inferredType?.kind).to.equal("arrayType");
        if (returnExpr.inferredType?.kind !== "arrayType") return;

        expect(returnExpr.inferredType.elementType).to.deep.equal({
          kind: "typeParameterType",
          name: "T",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps source-backed instance export method overload parameter types on imported object calls", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-fs-module",
        "fs-overload-object-call",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const ensureDecl = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "ensure"
        );
        expect(ensureDecl).to.not.equal(undefined);
        if (!ensureDecl?.body) return;

        const callStmt = ensureDecl.body.statements[0];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (!callStmt || callStmt.kind !== "expressionStatement") return;

        const callExpr = (callStmt as IrExpressionStatement).expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const optionsType = callExpr.parameterTypes?.[1];
        expect(optionsType).to.not.equal(undefined);
        expect(optionsType?.kind).to.equal("referenceType");
        if (optionsType?.kind !== "referenceType") return;

        expect(optionsType.name).to.equal("MkdirOptions");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves named imported structural instances through refresh at overload call sites", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-fs-module",
        "fs-overload-named-instance",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const lowered = runAnonymousTypeLoweringPass([moduleResult.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const ensureDecl = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "ensure"
        );
        expect(ensureDecl).to.not.equal(undefined);
        if (!ensureDecl?.body) return;

        const callStmt = ensureDecl.body.statements.find(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement" &&
            stmt.expression.kind === "call" &&
            stmt.expression.callee.kind === "memberAccess" &&
            stmt.expression.callee.property === "mkdirSync"
        );
        expect(callStmt).to.not.equal(undefined);
        if (!callStmt) return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const optionsArg = callExpr.arguments[1];
        expect(optionsArg?.kind).to.equal("identifier");
        expect(optionsArg?.inferredType?.kind).to.equal("referenceType");
        if (
          !optionsArg ||
          optionsArg.kind !== "identifier" ||
          optionsArg.inferredType?.kind !== "referenceType"
        ) {
          return;
        }

        expect(optionsArg.name).to.equal("options");
        expect(optionsArg.inferredType.name).to.equal("MkdirOptions");
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package typed array constructors deterministic", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-typed-array-constructor-surface",
        "typed-array-constructors",
      ]);

      try {
        expectNoDeterministicTypingDiagnostics(
          fixture.path("app"),
          "src/index.ts",
          "src/uint8-array.ts",
          {
            projectRoot: fixture.path("app"),
            sourceRoot: fixture.path("app/src"),
            rootNamespace: "TestApp",
            surface: "@fixture/js",
            packageRoot: fixture.path("app/node_modules/@fixture/js"),
          }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package inherited typed-array overload surfaces authoritative", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-typed-array-set-surface",
        "typed-array-inherited-overloads",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const lowered = runAnonymousTypeLoweringPass([moduleResult.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const concatDecl = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "concatBytes"
        );
        expect(concatDecl).to.not.equal(undefined);
        if (!concatDecl?.body) return;

        const findCallStatement = (
          statements: readonly unknown[]
        ): IrExpressionStatement | undefined => {
          for (const statement of statements) {
            if (!statement || typeof statement !== "object") {
              continue;
            }

            const candidate = statement as {
              readonly kind?: string;
              readonly expression?: unknown;
              readonly body?: unknown;
              readonly statements?: readonly unknown[];
            };

            if (
              candidate.kind === "expressionStatement" &&
              candidate.expression &&
              typeof candidate.expression === "object" &&
              (candidate.expression as { readonly kind?: string }).kind ===
                "call" &&
              (
                candidate.expression as {
                  readonly callee?: {
                    readonly kind?: string;
                    readonly property?: unknown;
                  };
                }
              ).callee?.kind === "memberAccess" &&
              (
                candidate.expression as {
                  readonly callee?: { readonly property?: unknown };
                }
              ).callee?.property === "set"
            ) {
              return candidate as IrExpressionStatement;
            }

            if (candidate.kind === "forStatement" && candidate.body) {
              const bodyStatements =
                typeof candidate.body === "object" &&
                candidate.body &&
                (candidate.body as { readonly kind?: string }).kind ===
                  "blockStatement"
                  ? (
                      candidate.body as {
                        readonly statements?: readonly unknown[];
                      }
                    ).statements ?? []
                  : [candidate.body];
              const nested = findCallStatement(bodyStatements);
              if (nested) {
                return nested;
              }
            }

            if (candidate.kind === "blockStatement") {
              const nested = findCallStatement(candidate.statements ?? []);
              if (nested) {
                return nested;
              }
            }
          }

          return undefined;
        };

        const callStmt = findCallStatement(concatDecl.body.statements);
        expect(callStmt).to.not.equal(undefined);
        if (!callStmt) return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        expect(callExpr.parameterTypes?.[0]?.kind).to.equal("referenceType");
        expect(callExpr.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");
        expect(callExpr.surfaceParameterTypes?.[1]?.kind).to.equal("unionType");

        if (
          callExpr.parameterTypes?.[0]?.kind !== "referenceType" ||
          callExpr.surfaceParameterTypes?.[0]?.kind !== "unionType" ||
          callExpr.surfaceParameterTypes?.[1]?.kind !== "unionType"
        ) {
          return;
        }

        expect(callExpr.parameterTypes[0].name).to.equal("Iterable");
        expect(callExpr.surfaceParameterTypes[0].types).to.have.length(2);
        expect(callExpr.surfaceParameterTypes[0].types[0]?.kind).to.equal(
          "arrayType"
        );
        if (callExpr.surfaceParameterTypes[0].types[0]?.kind !== "arrayType") {
          return;
        }
        expect(
          callExpr.surfaceParameterTypes[0].types[0].elementType
        ).to.deep.include({
          name: "byte",
        });
        expect(callExpr.surfaceParameterTypes[0].types[1]?.kind).to.equal(
          "referenceType"
        );
        expect(callExpr.surfaceParameterTypes[1].types).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package typed-array set calls on the iterable overload when offsets are broad numbers", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-typed-array-set-surface",
        "typed-array-offset-overload",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const lowered = runAnonymousTypeLoweringPass([moduleResult.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const leftPadDecl = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "leftPadBytes"
        );
        expect(leftPadDecl).to.not.equal(undefined);
        if (!leftPadDecl?.body) return;

        const callStmt = leftPadDecl.body.statements.find(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement" &&
            stmt.expression.kind === "call" &&
            stmt.expression.callee.kind === "memberAccess" &&
            stmt.expression.callee.property === "set"
        );
        expect(callStmt).to.not.equal(undefined);
        if (!callStmt) return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        expect(callExpr.parameterTypes?.[0]?.kind).to.equal("referenceType");
        if (callExpr.parameterTypes?.[0]?.kind !== "referenceType") {
          return;
        }
        expect(callExpr.parameterTypes[0]).to.deep.include({
          kind: "referenceType",
          name: "Iterable",
        });
        expect(callExpr.parameterTypes[0].typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
        expect(callExpr.parameterTypes[0].typeId?.tsName).to.equal("Iterable");
        expect(callExpr.parameterTypes?.[1]?.kind).to.equal("unionType");
        expect(callExpr.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");
        expect(callExpr.surfaceParameterTypes?.[1]?.kind).to.equal("unionType");

        if (
          callExpr.parameterTypes?.[1]?.kind !== "unionType" ||
          callExpr.surfaceParameterTypes?.[0]?.kind !== "unionType" ||
          callExpr.surfaceParameterTypes?.[1]?.kind !== "unionType"
        ) {
          return;
        }

        expect(callExpr.surfaceParameterTypes[0].types).to.have.length(2);
        expect(callExpr.surfaceParameterTypes[0].types[0]?.kind).to.equal(
          "arrayType"
        );
        if (callExpr.surfaceParameterTypes[0].types[0]?.kind !== "arrayType") {
          return;
        }
        expect(
          callExpr.surfaceParameterTypes[0].types[0].elementType
        ).to.deep.include({
          name: "byte",
        });
        expect(callExpr.surfaceParameterTypes[0].types[1]?.kind).to.equal(
          "referenceType"
        );
        expect(callExpr.parameterTypes[1].types).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ]);
        expect(callExpr.surfaceParameterTypes[1].types).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package typed-array set calls on the byte-array overload for array literals", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/fixture-typed-array-set-surface",
        "typed-array-array-literal-overload",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
        });
        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const lowered = runAnonymousTypeLoweringPass([moduleResult.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const copyDecl = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "copyTail"
        );
        expect(copyDecl).to.not.equal(undefined);
        if (!copyDecl?.body) return;

        const callStmt = copyDecl.body.statements.find(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement" &&
            stmt.expression.kind === "call" &&
            stmt.expression.callee.kind === "memberAccess" &&
            stmt.expression.callee.property === "set"
        );
        expect(callStmt).to.not.equal(undefined);
        if (!callStmt) return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        expect(callExpr.parameterTypes?.[0]?.kind).to.equal("arrayType");
        expect(callExpr.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");

        if (
          callExpr.parameterTypes?.[0]?.kind !== "arrayType" ||
          callExpr.surfaceParameterTypes?.[0]?.kind !== "unionType"
        ) {
          return;
        }

        expect(callExpr.parameterTypes[0].elementType).to.deep.include({
          name: "byte",
        });
        expect(callExpr.surfaceParameterTypes[0].types[0]?.kind).to.equal(
          "arrayType"
        );
        if (callExpr.surfaceParameterTypes[0].types[0]?.kind !== "arrayType") {
          return;
        }
        expect(
          callExpr.surfaceParameterTypes[0].types[0].elementType
        ).to.deep.include({
          name: "byte",
        });
        expect(callExpr.surfaceParameterTypes[0].types[1]?.kind).to.equal(
          "referenceType"
        );
        if (callExpr.surfaceParameterTypes[0].types[1]?.kind !== "referenceType") {
          return;
        }
        expect(callExpr.surfaceParameterTypes[0].types[1]).to.deep.include({
          kind: "referenceType",
          name: "Iterable",
        });
        expect(
          callExpr.surfaceParameterTypes[0].types[1].typeArguments
        ).to.deep.equal([{ kind: "primitiveType", name: "number" }]);
        expect(
          callExpr.surfaceParameterTypes[0].types[1].typeId?.tsName
        ).to.equal("Iterable");
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package error hierarchies deterministic", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-js-surface-root",
        "fragments/installed-source-deterministic/minimal-dotnet-system",
        "error-hierarchy",
      ]);

      try {
        expectNoDeterministicTypingDiagnostics(
          fixture.path("app"),
          "src/index.ts",
          "src/range-error.ts",
          {
            projectRoot: fixture.path("app"),
            sourceRoot: fixture.path("app/src"),
            rootNamespace: "TestApp",
            surface: "@fixture/js",
            packageRoot: fixture.path("app/node_modules/@fixture/js"),
          }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps authoritative sibling source-package constructors deterministic", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/authoritative-tsonic-js",
        "authoritative-sibling-constructors",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const packageRoot = fixture.path("app/node_modules/@tsonic/js");

        expectNoDeterministicTypingDiagnostics(
          projectRoot,
          "src/index.ts",
          "src/uint8-array.ts",
          {
            projectRoot,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            packageRoot,
          }
        );
        expectNoDeterministicTypingDiagnostics(
          projectRoot,
          "src/index.ts",
          "src/range-error.ts",
          {
            projectRoot,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            packageRoot,
          }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps authoritative sibling source-package global call sites deterministic", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/authoritative-tsonic-js",
        "authoritative-sibling-global-calls",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");

        expectNoDeterministicTypingDiagnostics(
          projectRoot,
          "src/index.ts",
          "src/array-object.ts",
          {
            projectRoot,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            packageRoot: fixture.path("app/node_modules/@tsonic/js"),
          }
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves concrete imported generic result members after discriminant narrowing", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/authoritative-tsonic-js",
        "narrowed-generic-result-member",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(
          programResult.ok,
          programResult.ok
            ? undefined
            : programResult.error.diagnostics
                .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
                .join("\n")
        ).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const validation = validateProgram(program);
        expect(validation.hasErrors).to.equal(false);

        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        let dataAccessType: IrExpression["inferredType"] | undefined;
        let nullableMessageRetentionAccess: IrExpression["inferredType"] | undefined;
        let coalescedMessageRetentionType: IrExpression["inferredType"] | undefined;

        visitIr(moduleResult.value.body, (value) => {
          const expression = value as Partial<IrExpression>;
          if (expression.kind !== "memberAccess") {
            return;
          }

          if (
            expression.property === "data" &&
            dataAccessType === undefined
          ) {
            dataAccessType = expression.inferredType;
            return;
          }

          if (expression.property !== "MessageRetentionDays") {
            return;
          }

          nullableMessageRetentionAccess = expression.inferredType;
        });

        visitIr(moduleResult.value.body, (value) => {
          const expression = value as Partial<IrExpression>;
          if (
            expression.kind === "logical" &&
            expression.operator === "??" &&
            expression.left?.kind === "memberAccess" &&
            expression.left.property === "MessageRetentionDays"
          ) {
            coalescedMessageRetentionType = expression.inferredType;
          }
        });

        expect(dataAccessType?.kind).to.equal("referenceType");
        if (dataAccessType?.kind === "referenceType") {
          expect(dataAccessType.name).to.equal("Channel");
          expect(dataAccessType.resolvedClrType).to.equal("fixture.domain.Channel");
        }
        expect(nullableMessageRetentionAccess).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "int" },
            { kind: "primitiveType", name: "undefined" },
          ],
        });
        expect(coalescedMessageRetentionType).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "int" },
            { kind: "primitiveType", name: "null" },
          ],
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps imported source-package callback alias closure deterministic", () => {
      const fixture = materializeInstalledSourceFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "fragments/installed-source-deterministic/fixture-callback-alias-surface",
        "imported-source-callback-alias-closure",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const sourceRoot = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot,
          rootNamespace: "TestApp",
          surface: "@fixture/pkg",
        });

        expect(
          programResult.ok,
          programResult.ok
            ? undefined
            : programResult.error.diagnostics
                .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
                .join("\n")
        ).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const validation = validateProgram(program);
        expect(validation.hasErrors).to.equal(false);

        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot,
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const soundness = validateIrSoundness([moduleResult.value]);
        expect(
          soundness.diagnostics.map((diagnostic) => diagnostic.code)
        ).to.not.include("TSN7414");

        const registerDecl = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "register"
        );
        expect(registerDecl).to.not.equal(undefined);
        if (!registerDecl?.body) return;

        const callStmt = registerDecl.body.statements.find(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement" &&
            stmt.expression.kind === "call" &&
            stmt.expression.kind === "call" &&
            stmt.expression.arguments[0]?.kind === "arrowFunction"
        );
        expect(callStmt).to.not.equal(undefined);
        if (!callStmt) return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const handler = callExpr.arguments[0];
        expect(handler?.kind).to.equal("arrowFunction");
        if (!handler || handler.kind !== "arrowFunction") return;

        const nextType = handler.parameters[2]?.type;
        expect(nextType?.kind).to.equal("functionType");
        if (!nextType || nextType.kind !== "functionType") return;

        const nextValueType = nextType.parameters[0]?.type;
        expect(
          nextValueType?.kind === "unionType" ||
            (nextValueType?.kind === "referenceType" &&
              nextValueType.typeId !== undefined)
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });
  });
});
