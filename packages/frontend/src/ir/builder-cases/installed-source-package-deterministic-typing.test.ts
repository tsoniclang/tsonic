import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { createProgram } from "../../program/creation.js";
import { createProgramContext } from "../program-context.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";
import { validateProgram } from "../../validator.js";
import type { IrFunctionDeclaration, IrExpressionStatement } from "../types.js";

const writeFile = (baseDir: string, relativePath: string, contents: string) => {
  const absolutePath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
};

const writeCoreTypesPackage = (tempDir: string) => {
  writeFile(
    tempDir,
    "node_modules/@tsonic/core/package.json",
    JSON.stringify(
      {
        name: "@tsonic/core",
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    )
  );
  writeFile(tempDir, "node_modules/@tsonic/core/types.js", "export {};\n");
  writeFile(
    tempDir,
    "node_modules/@tsonic/core/types.d.ts",
    [
      "export type int = number;",
      "export type byte = number;",
    ].join("\n")
  );
};

const writeDotnetSystemPackage = (tempDir: string) => {
  writeFile(
    tempDir,
    "node_modules/@tsonic/dotnet/package.json",
    JSON.stringify(
      {
        name: "@tsonic/dotnet",
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    )
  );
  writeFile(tempDir, "node_modules/@tsonic/dotnet/System.js", "export {};\n");
  writeFile(
    tempDir,
    "node_modules/@tsonic/dotnet/System.d.ts",
    [
      'import type * as Internal from "./System/internal/index.js";',
      "export type Exception = Internal.Exception;",
      "export const Exception: typeof Internal.Exception;",
    ].join("\n")
  );
  writeFile(
    tempDir,
    "node_modules/@tsonic/dotnet/System/internal/index.js",
    "export {};\n"
  );
  writeFile(
    tempDir,
    "node_modules/@tsonic/dotnet/System/internal/index.d.ts",
    [
      "export interface Exception$instance {",
      "  readonly Message: string;",
      "}",
      "",
      "export interface __Exception$views {}",
      "",
      "export const Exception: {",
      "  new(): Exception;",
      "  new(message: string): Exception;",
      "};",
      "",
      "export type Exception = Exception$instance & __Exception$views;",
    ].join("\n")
  );
};

const writeFixtureSourcePackage = (
  tempDir: string,
  sourceFiles: Readonly<Record<string, string>>,
  exportEntries: Readonly<Record<string, string>>
) => {
  writeFile(
    tempDir,
    "node_modules/@fixture/js/package.json",
    JSON.stringify(
      {
        name: "@fixture/js",
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    )
  );
  writeFile(
    tempDir,
    "node_modules/@fixture/js/tsonic.package.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: ["@fixture/js"],
        source: {
          namespace: "fixture.js",
          exports: exportEntries,
        },
      },
      null,
      2
    )
  );

  for (const [relativePath, contents] of Object.entries(sourceFiles)) {
    writeFile(tempDir, `node_modules/@fixture/js/${relativePath}`, contents);
  }
};

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
      expression.inferredType?.kind === "unknownType" &&
      expression.allowUnknownInferredType !== true
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

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("installed source-package deterministic typing", () => {
    it("keeps source-backed instance export method overload parameter types on imported object calls", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-installed-source-fs-overload-")
      );

      try {
        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { fs } from "@fixture/js/fs.js";',
            "export function ensure(dir: string): void {",
            "  fs.mkdirSync(dir, { recursive: true });",
            "}",
          ].join("\n")
        );
        writeCoreTypesPackage(tempDir);
        writeFixtureSourcePackage(
          tempDir,
          {
            "src/fs-module.ts": [
              'import type { int } from "@tsonic/core/types.js";',
              "",
              "export class MkdirOptions {",
              "  public recursive?: boolean;",
              "  public mode?: int;",
              "}",
              "",
              "export function mkdirSync(path: string): void;",
              "export function mkdirSync(path: string, recursive: boolean): void;",
              "export function mkdirSync(",
              "  path: string,",
              "  options: MkdirOptions",
              "): void;",
              "export function mkdirSync(",
              "  path: string,",
              "  options?: boolean | MkdirOptions",
              "): void {",
              "  void path;",
              "  void options;",
              "}",
              "",
              "export class FsModuleNamespace {",
              "  public mkdirSync(path: string): void;",
              "  public mkdirSync(path: string, recursive: boolean): void;",
              "  public mkdirSync(",
              "    path: string,",
              "    options: MkdirOptions",
              "  ): void;",
              "  public mkdirSync(",
              "    path: string,",
              "    options?: boolean | MkdirOptions",
              "  ): void {",
              "    mkdirSync(path, options);",
              "  }",
              "}",
              "",
              "export const fs: FsModuleNamespace = new FsModuleNamespace();",
            ].join("\n"),
          },
          {
            "./fs.js": "./src/fs-module.ts",
          }
        );

        const entryPath = path.join(tempDir, "src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: path.join(tempDir, "src"),
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
          sourceRoot: path.join(tempDir, "src"),
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: path.join(tempDir, "src"),
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
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps imported source-package typed array constructors deterministic", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-installed-source-typed-array-")
      );

      try {
        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { Uint8Array } from "@fixture/js/uint8-array.js";',
            "void Uint8Array;",
          ].join("\n")
        );
        writeCoreTypesPackage(tempDir);
        writeFixtureSourcePackage(
          tempDir,
          {
            "src/typed-array-core.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              "",
              "export type TypedArrayInput<TElement extends number> = TElement[];",
              "export type TypedArrayConstructorInput<TElement extends number> =",
              "  | int",
              "  | TypedArrayInput<TElement>;",
              "",
              "export const numericIdentity = <TNumeric extends number>(value: TNumeric): number =>",
              "  value;",
              "",
              "export const normalizeUint8 = (value: number): byte => value as byte;",
              "",
              "export class TypedArrayBase<",
              "  TElement extends number,",
              "  TSelf extends TypedArrayBase<TElement, TSelf>",
              "> {",
              "  protected constructor(",
              "    lengthOrValues: int | TypedArrayInput<TElement>,",
              "    bytesPerElement: int,",
              "    zeroValue: TElement,",
              "    normalizeElement: (value: number) => TElement,",
              "    toNumericValue: (value: TElement) => number,",
              "    wrap: (values: TElement[]) => TSelf",
              "  ) {",
              "    void lengthOrValues;",
              "    void bytesPerElement;",
              "    void zeroValue;",
              "    void normalizeElement;",
              "    void toNumericValue;",
              "    void wrap;",
              "  }",
              "}",
            ].join("\n"),
            "src/uint8-array.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              "import {",
              "  numericIdentity,",
              "  normalizeUint8,",
              "  TypedArrayConstructorInput,",
              "  TypedArrayBase,",
              '} from "./typed-array-core.js";',
              "",
              "function wrapUint8Array(values: byte[]): Uint8Array {",
              "  return new Uint8Array(values);",
              "}",
              "",
              "export class Uint8Array extends TypedArrayBase<byte, Uint8Array> {",
              "  public static readonly BYTES_PER_ELEMENT: int = 1 as int;",
              "",
              "  public constructor(lengthOrValues: TypedArrayConstructorInput<byte>) {",
              "    super(",
              "      lengthOrValues,",
              "      Uint8Array.BYTES_PER_ELEMENT,",
              "      0 as byte,",
              "      normalizeUint8,",
              "      numericIdentity,",
              "      wrapUint8Array",
              "    );",
              "  }",
              "}",
            ].join("\n"),
          },
          {
            "./typed-array-core.js": "./src/typed-array-core.ts",
            "./uint8-array.js": "./src/uint8-array.ts",
          }
        );

        expectNoDeterministicTypingDiagnostics(
          tempDir,
          "src/index.ts",
          "src/uint8-array.ts"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps imported source-package inherited typed-array overload surfaces authoritative", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-installed-source-typed-array-overload-")
      );

      try {
        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { Uint8Array } from "@fixture/js/uint8-array.js";',
            "",
            "export function concatBytes(...buffers: Uint8Array[]): Uint8Array {",
            "  let totalLength = 0;",
            "  for (let index = 0; index < buffers.length; index += 1) {",
            "    totalLength += buffers[index]!.length;",
            "  }",
            "",
            "  const result = new Uint8Array(totalLength);",
            "  let offset = 0;",
            "  for (let index = 0; index < buffers.length; index += 1) {",
            "    const buffer = buffers[index]!;",
            "    result.set(buffer, offset);",
            "    offset += buffer.length;",
            "  }",
            "  return result;",
            "}",
          ].join("\n")
        );
        writeCoreTypesPackage(tempDir);
        writeFixtureSourcePackage(
          tempDir,
          {
            "src/typed-array-core.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              "",
              "export type TypedArrayInput<TElement extends number> =",
              "  | TElement[]",
              "  | Iterable<number>;",
              "",
              "export class TypedArrayBase<",
              "  TElement extends number,",
              "  TSelf extends TypedArrayBase<TElement, TSelf>",
              "> {",
              "  public length: int = 0 as int;",
              "",
              "  public constructor(lengthOrValues: int | TypedArrayInput<TElement>) {",
              "    void lengthOrValues;",
              "  }",
              "",
              "  public set(index: int, value: number): void;",
              "  public set(source: TypedArrayInput<TElement>, offset?: int): void;",
              "  public set(",
              "    sourceOrIndex: int | TypedArrayInput<TElement>,",
              "    offsetOrValue: int | number = 0 as int",
              "  ): void {",
              "    void sourceOrIndex;",
              "    void offsetOrValue;",
              "  }",
              "}",
            ].join("\n"),
            "src/uint8-array.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              'import { TypedArrayBase } from "./typed-array-core.js";',
              "",
              "export class Uint8Array extends TypedArrayBase<byte, Uint8Array> {",
              "  public constructor(lengthOrValues: int | byte[] | Iterable<number>) {",
              "    super(lengthOrValues);",
              "  }",
              "",
              "  public *[Symbol.iterator](): Generator<byte, undefined, undefined> {",
              "    return undefined as never;",
              "  }",
              "}",
            ].join("\n"),
          },
          {
            "./typed-array-core.js": "./src/typed-array-core.ts",
            "./uint8-array.js": "./src/uint8-array.ts",
          }
        );

        const entryPath = path.join(tempDir, "src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: path.join(tempDir, "src"),
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
          sourceRoot: path.join(tempDir, "src"),
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: path.join(tempDir, "src"),
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
        expect(callExpr.surfaceParameterTypes[0].types[1]?.kind).to.equal(
          "referenceType"
        );
        expect(callExpr.surfaceParameterTypes[1].types).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps imported source-package typed-array set calls on the iterable overload when offsets are broad numbers", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-installed-source-typed-array-offset-")
      );

      try {
        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { Uint8Array } from "@fixture/js/uint8-array.js";',
            "",
            "export function leftPadBytes(",
            "  buffer: Uint8Array,",
            "  length: number",
            "): Uint8Array {",
            "  if (buffer.length >= length) {",
            "    return buffer;",
            "  }",
            "",
            "  const result = new Uint8Array(length);",
            "  result.set(buffer, length - buffer.length);",
            "  return result;",
            "}",
          ].join("\n")
        );
        writeCoreTypesPackage(tempDir);
        writeFixtureSourcePackage(
          tempDir,
          {
            "src/typed-array-core.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              "",
              "export type TypedArrayInput<TElement extends number> =",
              "  | TElement[]",
              "  | Iterable<number>;",
              "",
              "export class TypedArrayBase<",
              "  TElement extends number,",
              "  TSelf extends TypedArrayBase<TElement, TSelf>",
              "> {",
              "  public length: int = 0 as int;",
              "",
              "  public constructor(lengthOrValues: int | TypedArrayInput<TElement>) {",
              "    void lengthOrValues;",
              "  }",
              "",
              "  public set(index: int, value: number): void;",
              "  public set(source: TypedArrayInput<TElement>, offset?: int): void;",
              "  public set(",
              "    sourceOrIndex: int | TypedArrayInput<TElement>,",
              "    offsetOrValue: int | number = 0 as int",
              "  ): void {",
              "    void sourceOrIndex;",
              "    void offsetOrValue;",
              "  }",
              "}",
            ].join("\n"),
            "src/uint8-array.ts": [
              'import type { byte, int } from "@tsonic/core/types.js";',
              'import { TypedArrayBase } from "./typed-array-core.js";',
              "",
              "export class Uint8Array extends TypedArrayBase<byte, Uint8Array> {",
              "  public constructor(lengthOrValues: int | byte[] | Iterable<number>) {",
              "    super(lengthOrValues);",
              "  }",
              "",
              "  public *[Symbol.iterator](): Generator<byte, undefined, undefined> {",
              "    return undefined as never;",
              "  }",
              "}",
            ].join("\n"),
          },
          {
            "./typed-array-core.js": "./src/typed-array-core.ts",
            "./uint8-array.js": "./src/uint8-array.ts",
          }
        );

        const entryPath = path.join(tempDir, "src/index.ts");
        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: path.join(tempDir, "src"),
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
          sourceRoot: path.join(tempDir, "src"),
          rootNamespace: "TestApp",
        });
        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: path.join(tempDir, "src"),
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

        expect(callExpr.parameterTypes?.[0]).to.deep.equal({
          kind: "referenceType",
          name: "Iterable",
          typeArguments: [{ kind: "primitiveType", name: "number" }],
          resolvedClrType: undefined,
        });
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
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps imported source-package error hierarchies deterministic", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-installed-source-errors-")
      );

      try {
        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { RangeError } from "@fixture/js/range-error.js";',
            "void RangeError;",
          ].join("\n")
        );
        writeDotnetSystemPackage(tempDir);
        writeFixtureSourcePackage(
          tempDir,
          {
            "src/error-object.ts": [
              'import { Exception } from "@tsonic/dotnet/System.js";',
              "",
              "export class Error extends Exception {",
              '  public name: string = "Error";',
              "  public message: string;",
              "  public stack?: string;",
              "",
              "  public constructor(message?: string) {",
              '    super(message ?? "");',
              '    this.message = message ?? "";',
              "  }",
              "}",
            ].join("\n"),
            "src/range-error.ts": [
              'import { Error } from "./error-object.js";',
              "",
              "export class RangeError extends Error {",
              '  public name: string = "RangeError";',
              "",
              "  public constructor(message?: string) {",
              "    super(message);",
              "  }",
              "}",
            ].join("\n"),
          },
          {
            "./error-object.js": "./src/error-object.ts",
            "./range-error.js": "./src/range-error.ts",
          }
        );

        expectNoDeterministicTypingDiagnostics(
          tempDir,
          "src/index.ts",
          "src/range-error.ts"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps authoritative sibling source-package constructors deterministic", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-authoritative-source-constructors-")
      );

      try {
        const sourceRoot = path.join(tempDir, "src");
        const authoritativeCoreRoot = path.resolve(
          process.cwd(),
          "../../../core/versions/10"
        );
        const authoritativeDotnetRoot = path.resolve(
          process.cwd(),
          "../../../dotnet/versions/10"
        );
        const authoritativeJsRoot = path.resolve(
          process.cwd(),
          "../../../js/versions/10"
        );

        expect(fs.existsSync(path.join(authoritativeCoreRoot, "package.json"))).to.equal(
          true
        );
        expect(
          fs.existsSync(path.join(authoritativeDotnetRoot, "package.json"))
        ).to.equal(true);
        expect(fs.existsSync(path.join(authoritativeJsRoot, "package.json"))).to.equal(
          true
        );

        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { Uint8Array } from "@tsonic/js/uint8-array.js";',
            'import { RangeError } from "@tsonic/js/range-error.js";',
            "void Uint8Array;",
            "void RangeError;",
          ].join("\n")
        );

        expectNoDeterministicTypingDiagnostics(
          tempDir,
          "src/index.ts",
          "src/uint8-array.ts",
          {
            projectRoot: tempDir,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            typeRoots: [
              authoritativeCoreRoot,
              authoritativeDotnetRoot,
              authoritativeJsRoot,
            ],
            packageRoot: authoritativeJsRoot,
          }
        );
        expectNoDeterministicTypingDiagnostics(
          tempDir,
          "src/index.ts",
          "src/range-error.ts",
          {
            projectRoot: tempDir,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            typeRoots: [
              authoritativeCoreRoot,
              authoritativeDotnetRoot,
              authoritativeJsRoot,
            ],
            packageRoot: authoritativeJsRoot,
          }
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("keeps authoritative sibling source-package global call sites deterministic", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-authoritative-source-global-calls-")
      );

      try {
        const sourceRoot = path.join(tempDir, "src");
        const authoritativeCoreRoot = path.resolve(
          process.cwd(),
          "../../../core/versions/10"
        );
        const authoritativeDotnetRoot = path.resolve(
          process.cwd(),
          "../../../dotnet/versions/10"
        );
        const authoritativeJsRoot = path.resolve(
          process.cwd(),
          "../../../js/versions/10"
        );

        writeFile(
          tempDir,
          "package.json",
          JSON.stringify({ name: "app", version: "1.0.0", type: "module" }, null, 2)
        );
        writeFile(
          tempDir,
          "src/index.ts",
          [
            'import { Array } from "@tsonic/js/Array.js";',
            "void Array;",
          ].join("\n")
        );

        expectNoDeterministicTypingDiagnostics(
          tempDir,
          "src/index.ts",
          "src/array-object.ts",
          {
            projectRoot: tempDir,
            sourceRoot,
            rootNamespace: "TestApp",
            surface: "@tsonic/js",
            typeRoots: [
              authoritativeCoreRoot,
              authoritativeDotnetRoot,
              authoritativeJsRoot,
            ],
            packageRoot: authoritativeJsRoot,
          }
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
