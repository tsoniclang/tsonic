/**
 * IR Builder tests: JS surface helpers - global bindings, regex, spread arrays
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";
import {
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentFileDir, "../../../../..");
const repoGlobalsRoot = path.resolve(repoRoot, "../globals/versions/10");
const repoCoreRoot = path.resolve(repoRoot, "../core/versions/10");

const installRepoPackage = (
  tempDir: string,
  packageName: string,
  sourceRoot: string
): void => {
  const packageRoot = path.join(tempDir, "node_modules", ...packageName.split("/"));
  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.cpSync(sourceRoot, packageRoot, { recursive: true });
};

const installMinimalClrRoots = (tempDir: string): void => {
  installRepoPackage(tempDir, "@tsonic/globals", repoGlobalsRoot);
  installRepoPackage(tempDir, "@tsonic/core", repoCoreRoot);
};

const writeFixtureJsSurface = (
  tempDir: string,
  exportEntries: Record<string, string>,
  sourceFiles: Readonly<Record<string, string>>,
  ambientSource: string
): string => {
  installMinimalClrRoots(tempDir);
  const surfaceRoot = path.join(tempDir, "node_modules", "@fixture", "js");
  fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(surfaceRoot, "package.json"),
    JSON.stringify(
      { name: "@fixture/js", version: "1.0.0", type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.surface.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "@fixture/js",
        extends: ["clr"],
        requiredTypeRoots: ["."],
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(surfaceRoot, "globals.ts"), ambientSource);
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.package.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: ["@fixture/js"],
        source: {
          namespace: "fixture.js",
          ambient: ["./globals.ts"],
          exports: exportEntries,
        },
      },
      null,
      2
    )
  );

  for (const [relativePath, contents] of Object.entries(sourceFiles)) {
    const absolutePath = path.join(surfaceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  return surfaceRoot;
};

const materializeJsSurfaceHelpersFixture = (
  fixtureNames: string | readonly string[]
) =>
  materializeFrontendFixture(
    (Array.isArray(fixtureNames) ? fixtureNames : [fixtureNames]).map(
      (fixtureName) =>
        fixtureName.startsWith("fragments/")
          ? fixtureName
          : `ir/js-surface-helpers/${fixtureName}`
    )
  );

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("JS surface helpers", () => {
    it("attaches explicit computed-access protocol for class index signatures with at/set", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/module-bindings/basic-fixture-js-surface",
        "regexp-surface",
        "computed-access-protocol",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const vecClass = moduleResult.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Vec"
        );
        expect(vecClass).to.not.equal(undefined);
        if (!vecClass || vecClass.kind !== "classDeclaration") return;

        const readMethod = vecClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(readMethod).to.not.equal(undefined);
        if (
          !readMethod ||
          readMethod.kind !== "methodDeclaration" ||
          !readMethod.body
        )
          return;

        const readReturn = readMethod.body.statements[0];
        expect(readReturn?.kind).to.equal("returnStatement");
        if (!readReturn || readReturn.kind !== "returnStatement") return;

        const readExpr = readReturn.expression;
        expect(readExpr?.kind).to.equal("memberAccess");
        if (!readExpr || readExpr.kind !== "memberAccess") return;
        expect(readExpr.isComputed).to.equal(true);
        expect(readExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const writeMethod = vecClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "write"
        );
        expect(writeMethod).to.not.equal(undefined);
        if (
          !writeMethod ||
          writeMethod.kind !== "methodDeclaration" ||
          !writeMethod.body
        )
          return;

        const writeExprStmt = writeMethod.body.statements[0];
        expect(writeExprStmt?.kind).to.equal("expressionStatement");
        if (!writeExprStmt || writeExprStmt.kind !== "expressionStatement") return;

        const writeExpr = writeExprStmt.expression;
        expect(writeExpr.kind).to.equal("assignment");
        if (writeExpr.kind !== "assignment") return;
        expect(writeExpr.left.kind).to.equal("memberAccess");
        if (writeExpr.left.kind !== "memberAccess") return;
        expect(writeExpr.left.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const holderClass = moduleResult.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Holder"
        );
        expect(holderClass).to.not.equal(undefined);
        if (!holderClass || holderClass.kind !== "classDeclaration") return;

        const holderReadMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(holderReadMethod).to.not.equal(undefined);
        if (
          !holderReadMethod ||
          holderReadMethod.kind !== "methodDeclaration" ||
          !holderReadMethod.body
        )
          return;

        const holderReadStmt = holderReadMethod.body.statements[0];
        expect(holderReadStmt?.kind).to.equal("returnStatement");
        if (!holderReadStmt || holderReadStmt.kind !== "returnStatement") return;

        const holderReadExpr = holderReadStmt.expression;
        expect(holderReadExpr?.kind).to.equal("memberAccess");
        if (!holderReadExpr || holderReadExpr.kind !== "memberAccess") return;
        expect(holderReadExpr.isComputed).to.equal(true);
        expect(holderReadExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("attaches explicit computed-access protocol through inherited class index signatures with at/set", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/module-bindings/basic-fixture-js-surface",
        "regexp-surface",
        "inherited-computed-access-protocol",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const holderClass = moduleResult.value.body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Holder"
        );
        expect(holderClass).to.not.equal(undefined);
        if (!holderClass || holderClass.kind !== "classDeclaration") return;

        const holderReadMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(holderReadMethod).to.not.equal(undefined);
        if (
          !holderReadMethod ||
          holderReadMethod.kind !== "methodDeclaration" ||
          !holderReadMethod.body
        ) {
          return;
        }

        const holderReadStmt = holderReadMethod.body.statements[0];
        expect(holderReadStmt?.kind).to.equal("returnStatement");
        if (!holderReadStmt || holderReadStmt.kind !== "returnStatement") return;

        const holderReadExpr = holderReadStmt.expression;
        expect(holderReadExpr?.kind).to.equal("memberAccess");
        if (!holderReadExpr || holderReadExpr.kind !== "memberAccess") return;
        expect(holderReadExpr.isComputed).to.equal(true);
        expect(holderReadExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const holderWriteMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "write"
        );
        expect(holderWriteMethod).to.not.equal(undefined);
        if (
          !holderWriteMethod ||
          holderWriteMethod.kind !== "methodDeclaration" ||
          !holderWriteMethod.body
        ) {
          return;
        }

        const holderWriteStmt = holderWriteMethod.body.statements[0];
        expect(holderWriteStmt?.kind).to.equal("expressionStatement");
        if (!holderWriteStmt || holderWriteStmt.kind !== "expressionStatement") {
          return;
        }

        const holderWriteExpr = holderWriteStmt.expression;
        expect(holderWriteExpr.kind).to.equal("assignment");
        if (holderWriteExpr.kind !== "assignment") return;
        expect(holderWriteExpr.left.kind).to.equal("memberAccess");
        if (holderWriteExpr.left.kind !== "memberAccess") return;
        expect(holderWriteExpr.left.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("attaches computed-access protocol for imported class index signatures with at/set", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "imported-buffer-computed-access",
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

        const result = buildIrModule(
          programResult.value.sourceFiles.find(
            (file) => path.resolve(file.fileName) === path.resolve(entryPath)
          )!,
          programResult.value,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          createProgramContext(programResult.value, {
            sourceRoot,
            rootNamespace: "TestApp",
          })
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const readerClass = result.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Reader"
        );
        expect(readerClass).to.not.equal(undefined);
        if (!readerClass || readerClass.kind !== "classDeclaration") return;

        const readMethod = readerClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(readMethod).to.not.equal(undefined);
        if (
          !readMethod ||
          readMethod.kind !== "methodDeclaration" ||
          !readMethod.body
        ) {
          return;
        }

        const readReturn = readMethod.body.statements[0];
        expect(readReturn?.kind).to.equal("returnStatement");
        if (!readReturn || readReturn.kind !== "returnStatement") return;

        const readExpr = readReturn.expression;
        expect(readExpr?.kind).to.equal("memberAccess");
        if (!readExpr || readExpr.kind !== "memberAccess") return;
        expect(readExpr.isComputed).to.equal(true);
        expect(readExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const writeMethod = readerClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" && member.name === "write"
        );
        expect(writeMethod).to.not.equal(undefined);
        if (
          !writeMethod ||
          writeMethod.kind !== "methodDeclaration" ||
          !writeMethod.body
        ) {
          return;
        }

        const writeExprStmt = writeMethod.body.statements[0];
        expect(writeExprStmt?.kind).to.equal("expressionStatement");
        if (
          !writeExprStmt ||
          writeExprStmt.kind !== "expressionStatement" ||
          writeExprStmt.expression.kind !== "assignment" ||
          writeExprStmt.expression.left.kind !== "memberAccess"
        ) {
          return;
        }

        expect(writeExprStmt.expression.left.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves imported core numeric aliases in installed source-package type annotations", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/installed-source-deterministic/minimal-core-types",
        "core-byte-alias-property",
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

        const result = buildIrModule(
          programResult.value.sourceFiles.find(
            (file) => path.resolve(file.fileName) === path.resolve(entryPath)
          )!,
          programResult.value,
          {
            sourceRoot,
            rootNamespace: "TestApp",
          },
          createProgramContext(programResult.value, {
            sourceRoot,
            rootNamespace: "TestApp",
          })
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const holderClass = result.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Holder"
        );
        expect(holderClass).to.not.equal(undefined);
        if (!holderClass || holderClass.kind !== "classDeclaration") return;

        const valueProperty = holderClass.members.find(
          (member) =>
            member.kind === "propertyDeclaration" && member.name === "value"
        );
        expect(valueProperty).to.not.equal(undefined);
        if (!valueProperty || valueProperty.kind !== "propertyDeclaration") {
          return;
        }

        expect(valueProperty.type?.kind).to.equal("referenceType");
        if (!valueProperty.type || valueProperty.type.kind !== "referenceType") {
          return;
        }
        expect(valueProperty.type.name).to.equal("byte");
      } finally {
        fixture.cleanup();
      }
    });

    it("specializes inherited source-package method parameter types through global owner aliases", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/module-bindings/basic-fixture-js-surface",
        "typed-array-global-surface-basic",
        "specializes-inherited-method-params",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements[1];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (!callStmt || callStmt.kind !== "expressionStatement") return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const firstParameterType = callExpr.parameterTypes?.[0];
        expect(firstParameterType).to.not.equal(undefined);
        if (!firstParameterType) return;

        expect(JSON.stringify(firstParameterType)).to.not.include(
          '"kind":"typeParameterType"'
        );
        expect(firstParameterType.kind).to.equal("unionType");
        if (firstParameterType.kind !== "unionType") return;

        const [arrayMember, iterableMember] = firstParameterType.types;
        expect(arrayMember?.kind).to.equal("arrayType");
        expect(iterableMember?.kind).to.equal("referenceType");
        if (!arrayMember || arrayMember.kind !== "arrayType") return;
        if (!iterableMember || iterableMember.kind !== "referenceType") return;

        expect(arrayMember.elementType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
        expect(iterableMember.name).to.equal("Iterable");
        expect(iterableMember.typeArguments?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps inherited iterable overloads over numeric sibling overloads through global owner aliases", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/module-bindings/basic-fixture-js-surface",
        "typed-array-global-surface-overload",
        "inherited-iterable-overloads",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements[1];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (!callStmt || callStmt.kind !== "expressionStatement") return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const firstParameterType = callExpr.parameterTypes?.[0];
        const secondParameterType = callExpr.parameterTypes?.[1];
        const firstSurfaceParameterType = callExpr.surfaceParameterTypes?.[0];
        const secondSurfaceParameterType = callExpr.surfaceParameterTypes?.[1];
        expect(firstParameterType).to.not.deep.equal({
          kind: "primitiveType",
          name: "int",
        });
        expect(firstParameterType?.kind).to.equal("referenceType");
        if (firstParameterType?.kind === "referenceType") {
          expect(firstParameterType.name).to.equal("Iterable");
          expect(firstParameterType.typeArguments).to.deep.equal([
            {
              kind: "primitiveType",
              name: "number",
            },
          ]);
        }
        expect(firstSurfaceParameterType?.kind).to.equal("unionType");
        if (firstSurfaceParameterType?.kind === "unionType") {
          expect(firstSurfaceParameterType.types).to.have.length(2);
          expect(
            firstSurfaceParameterType.types.some(
              (candidate) =>
                candidate.kind === "arrayType" &&
                candidate.elementType.kind === "referenceType" &&
                candidate.elementType.name === "byte"
            )
          ).to.equal(true);
          expect(
            firstSurfaceParameterType.types.some(
              (candidate) =>
                candidate.kind === "referenceType" &&
                candidate.name === "Iterable" &&
                candidate.typeArguments?.[0]?.kind === "primitiveType" &&
                candidate.typeArguments[0].name === "number"
            )
          ).to.equal(true);
        }
        expect(secondParameterType).to.deep.equal({
          kind: "unionType",
          types: [
            {
              kind: "primitiveType",
              name: "int",
            },
            {
              kind: "primitiveType",
              name: "undefined",
            },
          ],
        });
        expect(secondSurfaceParameterType?.kind).to.equal("unionType");
        if (secondSurfaceParameterType?.kind === "unionType") {
          expect(secondSurfaceParameterType.types).to.have.length(2);
          expect(
            secondSurfaceParameterType.types.some(
              (candidate) =>
                candidate.kind === "primitiveType" &&
                candidate.name === "int"
            )
          ).to.equal(true);
          expect(
            secondSurfaceParameterType.types.some(
              (candidate) =>
                candidate.kind === "primitiveType" &&
                candidate.name === "undefined"
            )
          ).to.equal(true);
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("specializes direct generic source-package members through global owner aliases", () => {
      const fixture = materializeJsSurfaceHelpersFixture([
        "fragments/module-bindings/basic-fixture-js-surface",
        "map-global-surface",
        "direct-generic-members",
      ]);

      try {
        const projectRoot = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const nextDecl = fn.body.statements[1];
        expect(nextDecl?.kind).to.equal("variableDeclaration");
        if (!nextDecl || nextDecl.kind !== "variableDeclaration") return;

        const logicalExpr = nextDecl.declarations[0]?.initializer;
        expect(logicalExpr?.kind).to.equal("logical");
        if (!logicalExpr || logicalExpr.kind !== "logical") return;

        expect(JSON.stringify(logicalExpr.inferredType)).to.not.include(
          '"kind":"typeParameterType"'
        );
        expect(logicalExpr.left.kind).to.equal("call");
        if (logicalExpr.left.kind !== "call") return;

        expect(JSON.stringify(logicalExpr.left.inferredType)).to.not.include(
          '"kind":"typeParameterType"'
        );

        const [firstParameterType] = logicalExpr.left.parameterTypes ?? [];
        expect(firstParameterType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("uses lambda arity to select source-backed array callback overloads", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-array-callback-arity-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./Array.js": "./src/Array.ts",
          },
          {
            "src/Array.ts": [
              'import type { int } from "@tsonic/core/types.js";',
              "export class Array<T> {",
              "  public constructor() {}",
              "  public find(callback: (value: T) => boolean): T | undefined;",
              "  public find(callback: (value: T, index: int) => boolean): T | undefined;",
              "  public find(callback: (value: T, index: int, array: readonly T[]) => boolean): T | undefined;",
              "  public find(callback: (value: T, index?: int, array?: readonly T[]) => boolean): T | undefined {",
              "    void callback;",
              "    return undefined;",
              "  }",
              "  public findIndex(callback: (value: T) => boolean): int;",
              "  public findIndex(callback: (value: T, index: int) => boolean): int;",
              "  public findIndex(callback: (value: T, index: int, array: readonly T[]) => boolean): int;",
              "  public findIndex(callback: (value: T, index?: int, array?: readonly T[]) => boolean): int {",
              "    void callback;",
              "    return 0 as int;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  interface Array<T> extends import("./src/Array.js").Array<T> {}',
            '  const Array: typeof import("./src/Array.js").Array;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type Todo = { id: number; title: string };",
            "",
            "export function main(id: number): number {",
            "  const todos = new Array<Todo>();",
            "  const todo = todos.find((t) => t.id === id);",
            "  const index = todos.findIndex((t) => t.id === id);",
            "  void todo;",
            "  return index;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const findDecl = fn.body.statements[1];
        expect(findDecl?.kind).to.equal("variableDeclaration");
        if (!findDecl || findDecl.kind !== "variableDeclaration") return;
        const findCall = findDecl.declarations[0]?.initializer;
        expect(findCall?.kind).to.equal("call");
        if (!findCall || findCall.kind !== "call") return;

        const findIndexDecl = fn.body.statements[2];
        expect(findIndexDecl?.kind).to.equal("variableDeclaration");
        if (!findIndexDecl || findIndexDecl.kind !== "variableDeclaration") return;
        const findIndexCall = findIndexDecl.declarations[0]?.initializer;
        expect(findIndexCall?.kind).to.equal("call");
        if (!findIndexCall || findIndexCall.kind !== "call") return;

        const findRuntimeCallback = findCall.parameterTypes?.[0];
        const findSurfaceCallback = findCall.surfaceParameterTypes?.[0];
        const findIndexRuntimeCallback = findIndexCall.parameterTypes?.[0];
        const findIndexSurfaceCallback = findIndexCall.surfaceParameterTypes?.[0];

        expect(findRuntimeCallback?.kind).to.equal("functionType");
        expect(findSurfaceCallback?.kind).to.equal("functionType");
        expect(findIndexRuntimeCallback?.kind).to.equal("functionType");
        expect(findIndexSurfaceCallback?.kind).to.equal("functionType");

        if (findRuntimeCallback?.kind === "functionType") {
          expect(findRuntimeCallback.parameters).to.have.length(1);
        }
        if (findSurfaceCallback?.kind === "functionType") {
          expect(findSurfaceCallback.parameters).to.have.length(1);
        }
        if (findIndexRuntimeCallback?.kind === "functionType") {
          expect(findIndexRuntimeCallback.parameters).to.have.length(1);
        }
        if (findIndexSurfaceCallback?.kind === "functionType") {
          expect(findIndexSurfaceCallback.parameters).to.have.length(1);
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("infers source-backed array callback returns from expression-bodied lambdas", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-array-map-return-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        const workspaceNodeModules = path.join(repoRoot, "node_modules");
        if (fs.existsSync(workspaceNodeModules)) {
          fs.symlinkSync(
            workspaceNodeModules,
            path.join(tempDir, "node_modules"),
            "dir"
          );
        }
        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "declare const entries: string[];",
            "export const values = entries",
            "  .map((entry) => entry)",
            "  .filter((value) => value.length > 0);",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
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

        const refreshed = runCallResolutionRefreshPass(
          proofResult.modules,
          ctx
        ).modules[0];
        const valuesDecl = refreshed?.body.find(
          (statement): statement is IrVariableDeclaration =>
            statement.kind === "variableDeclaration"
        );
        expect(valuesDecl?.kind).to.equal("variableDeclaration");
        if (!valuesDecl || valuesDecl.kind !== "variableDeclaration") return;

        const filterCall = valuesDecl.declarations[0]?.initializer;
        expect(filterCall?.kind).to.equal("call");
        if (!filterCall || filterCall.kind !== "call") return;

        const mapCall =
          filterCall.callee.kind === "memberAccess"
            ? filterCall.callee.object
            : undefined;
        expect(mapCall?.kind).to.equal("call");
        if (!mapCall || mapCall.kind !== "call") return;

        const mapCallback = mapCall.arguments[0];
        expect(mapCallback?.kind).to.equal("arrowFunction");
        if (!mapCallback || mapCallback.kind !== "arrowFunction") return;

        expect(mapCallback.inferredType?.kind).to.equal("functionType");
        if (mapCallback.inferredType?.kind === "functionType") {
          expect(mapCallback.inferredType.returnType).to.deep.equal({
            kind: "primitiveType",
            name: "string",
          });
        }

        expect(mapCall.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: {
            kind: "primitiveType",
            name: "string",
          },
          origin: "explicit",
        });

        const filterCallback = filterCall.parameterTypes?.[0];
        expect(filterCallback?.kind).to.equal("functionType");
        if (filterCallback?.kind === "functionType") {
          expect(filterCallback.parameters[0]?.type).to.deep.equal({
            kind: "primitiveType",
            name: "string",
          });
        }

        expect(filterCall.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: {
            kind: "primitiveType",
            name: "string",
          },
          origin: "explicit",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads expected tuple returns into source-backed array map callbacks", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-array-map-tuple-return-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        const workspaceNodeModules = path.join(repoRoot, "node_modules");
        if (fs.existsSync(workspaceNodeModules)) {
          fs.symlinkSync(
            workspaceNodeModules,
            path.join(tempDir, "node_modules"),
            "dir"
          );
        }
        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type Entry = { readonly name: string; readonly value: string };",
            "declare const params: Entry[];",
            "export const entries = (): Array<[string, string]> =>",
            "  params.map((param) => [param.name, param.value]);",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
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

        const refreshed = runCallResolutionRefreshPass(
          proofResult.modules,
          ctx
        ).modules[0];
        const entriesDecl = refreshed?.body.find(
          (statement): statement is IrVariableDeclaration =>
            statement.kind === "variableDeclaration"
        );
        expect(entriesDecl?.kind).to.equal("variableDeclaration");
        if (!entriesDecl || entriesDecl.kind !== "variableDeclaration") return;

        const entriesFn = entriesDecl.declarations[0]?.initializer;
        expect(entriesFn?.kind).to.equal("arrowFunction");
        if (!entriesFn || entriesFn.kind !== "arrowFunction") return;

        const mapCall = entriesFn.body;
        expect(mapCall?.kind).to.equal("call");
        if (!mapCall || mapCall.kind !== "call") return;

        expect(mapCall.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: {
            kind: "tupleType",
            elementTypes: [
              {
                kind: "primitiveType",
                name: "string",
              },
              {
                kind: "primitiveType",
                name: "string",
              },
            ],
          },
          origin: "explicit",
        });

        const callbackType = mapCall.parameterTypes?.[0];
        expect(callbackType?.kind).to.equal("functionType");
        if (callbackType?.kind === "functionType") {
          expect(callbackType.returnType).to.deep.equal({
            kind: "tupleType",
            elementTypes: [
              {
                kind: "primitiveType",
                name: "string",
              },
              {
                kind: "primitiveType",
                name: "string",
              },
            ],
          });
        }

        const mapCallback = mapCall.arguments[0];
        expect(mapCallback?.kind).to.equal("arrowFunction");
        if (!mapCallback || mapCallback.kind !== "arrowFunction") return;

        expect(mapCallback.inferredType?.kind).to.equal("functionType");
        if (mapCallback.inferredType?.kind === "functionType") {
          expect(mapCallback.inferredType.returnType).to.deep.equal({
            kind: "tupleType",
            elementTypes: [
              {
                kind: "primitiveType",
                name: "string",
              },
              {
                kind: "primitiveType",
                name: "string",
              },
            ],
          });
        }

        expect(mapCallback.body.kind).to.not.equal("blockStatement");
        if (mapCallback.body.kind !== "blockStatement") {
          expect(mapCallback.body.inferredType).to.deep.equal({
            kind: "tupleType",
            elementTypes: [
              {
                kind: "primitiveType",
                name: "string",
              },
              {
                kind: "primitiveType",
                name: "string",
              },
            ],
          });
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads generic surface root global bindings into identifier callees", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-generic-surface-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        installMinimalClrRoots(tempDir);

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(surfaceRoot, "index.d.ts"),
          [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "declare global {",
            "  const console: {",
            "    log(...data: unknown[]): void;",
            "  };",
            "  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;",
            "  function clearInterval(id: int): void;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "bindings.json"),
          JSON.stringify(
            {
              bindings: {
                console: {
                  kind: "global",
                  assembly: "js",
                  type: "js.console",
                },
                setInterval: {
                  kind: "global",
                  assembly: "Acme.ExternalRuntime",
                  type: "Acme.ExternalRuntime.Timers",
                  csharpName: "Timers.setInterval",
                },
                clearInterval: {
                  kind: "global",
                  assembly: "Acme.ExternalRuntime",
                  type: "Acme.ExternalRuntime.Timers",
                  csharpName: "Timers.clearInterval",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "Acme.ExternalRuntime.d.ts"),
          "export {};\n"
        );
        fs.mkdirSync(path.join(surfaceRoot, "Acme.ExternalRuntime"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(surfaceRoot, "Acme.ExternalRuntime", "bindings.json"),
          JSON.stringify(
            {
              namespace: "Acme.ExternalRuntime",
              types: [
                {
                  clrName: "Acme.ExternalRuntime.Timers",
                  assemblyName: "Acme.ExternalRuntime",
                  methods: [
                    {
                      clrName: "setInterval",
                      normalizedSignature:
                        "setInterval|(System.Action,System.Double):System.Double|static=true",
                      parameterCount: 2,
                      declaringClrType: "Acme.ExternalRuntime.Timers",
                      declaringAssemblyName: "Acme.ExternalRuntime",
                      semanticSignature: {
                        parameters: [
                          {
                            kind: "parameter",
                            pattern: {
                              kind: "identifierPattern",
                              name: "handler",
                            },
                            type: {
                              kind: "referenceType",
                              name: "System.Action",
                              resolvedClrType: "System.Action",
                            },
                            isOptional: false,
                            isRest: false,
                            passing: "value",
                          },
                          {
                            kind: "parameter",
                            pattern: {
                              kind: "identifierPattern",
                              name: "timeout",
                            },
                            type: {
                              kind: "primitiveType",
                              name: "number",
                            },
                            isOptional: false,
                            isRest: false,
                            passing: "value",
                          },
                        ],
                        returnType: {
                          kind: "primitiveType",
                          name: "number",
                        },
                      },
                    },
                    {
                      clrName: "clearInterval",
                      normalizedSignature:
                        "clearInterval|(System.Double):System.Void|static=true",
                      parameterCount: 1,
                      declaringClrType: "Acme.ExternalRuntime.Timers",
                      declaringAssemblyName: "Acme.ExternalRuntime",
                      semanticSignature: {
                        parameters: [
                          {
                            kind: "parameter",
                            pattern: {
                              kind: "identifierPattern",
                              name: "id",
                            },
                            type: {
                              kind: "primitiveType",
                              name: "number",
                            },
                            isOptional: false,
                            isRest: false,
                            passing: "value",
                          },
                        ],
                        returnType: {
                          kind: "voidType",
                        },
                      },
                    },
                  ],
                  properties: [],
                  fields: [],
                },
              ],
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: ["clr"],
              requiredTypeRoots: ["."],
            },
            null,
            2
          )
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  const id = setInterval(() => {}, 1000);",
            "  clearInterval(id);",
            '  console.log("tick");',
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const setIntervalCall = firstStmt.declarations[0]?.initializer;
        expect(setIntervalCall?.kind).to.equal("call");
        if (!setIntervalCall || setIntervalCall.kind !== "call") return;

        expect(setIntervalCall.callee.kind).to.equal("identifier");
        if (setIntervalCall.callee.kind !== "identifier") return;

        expect(setIntervalCall.callee.name).to.equal("setInterval");
        expect(setIntervalCall.callee.resolvedClrType).to.equal(
          "Acme.ExternalRuntime.Timers"
        );
        expect(setIntervalCall.callee.resolvedAssembly).to.equal(
          "Acme.ExternalRuntime"
        );
        expect(setIntervalCall.callee.csharpName).to.equal(
          "Timers.setInterval"
        );
        expect(setIntervalCall.parameterTypes).to.deep.equal([
          {
            kind: "referenceType",
            name: "System.Action",
            resolvedClrType: "System.Action",
          },
          {
            kind: "primitiveType",
            name: "number",
          },
        ]);
        expect(setIntervalCall.surfaceParameterTypes).to.deep.equal([
          {
            kind: "referenceType",
            name: "System.Action",
            resolvedClrType: "System.Action",
          },
          {
            kind: "primitiveType",
            name: "number",
          },
        ]);
        expect(setIntervalCall.restParameter).to.equal(undefined);
        expect(setIntervalCall.surfaceRestParameter).to.equal(undefined);

        const clearIntervalStmt = fn.body.statements[1];
        expect(clearIntervalStmt?.kind).to.equal("expressionStatement");
        if (
          !clearIntervalStmt ||
          clearIntervalStmt.kind !== "expressionStatement"
        )
          return;

        const clearIntervalCall = clearIntervalStmt.expression;
        expect(clearIntervalCall.kind).to.equal("call");
        if (clearIntervalCall.kind !== "call") return;
        expect(clearIntervalCall.callee.kind).to.equal("identifier");
        if (clearIntervalCall.callee.kind !== "identifier") return;
        expect(clearIntervalCall.callee.csharpName).to.equal(
          "Timers.clearInterval"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads source-package ambient globals declared through static imports", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        installMinimalClrRoots(tempDir);

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.js",
                ambient: ["./globals.ts"],
                exports: {
                  "./Globals.js": "./src/Globals.ts",
                  "./console.js": "./src/console.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: ["clr"],
              requiredTypeRoots: ["."],
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "globals.ts"),
          [
            'import { parseInt as SourceParseInt } from "./src/Globals.js";',
            'import { console as SourceConsole } from "./src/console.js";',
            "",
            "declare global {",
            "  const parseInt: typeof SourceParseInt;",
            "  const console: typeof SourceConsole;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/Globals.ts"),
          [
            "export const parseInt = (value: string): number => {",
            "  void value;",
            "  return 42;",
            "};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/console.ts"),
          [
            "export const console = {",
            "  log(...data: unknown[]): void {",
            "    void data;",
            "  },",
            "};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            '  const value = parseInt("42");',
            "  console.log(value);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const parseIntCall = firstStmt.declarations[0]?.initializer;
        expect(parseIntCall?.kind).to.equal("call");
        if (!parseIntCall || parseIntCall.kind !== "call") return;

        expect(parseIntCall.callee.kind).to.equal("identifier");
        if (parseIntCall.callee.kind !== "identifier") return;
        expect(parseIntCall.callee.name).to.equal("parseInt");
        expect(parseIntCall.callee.resolvedClrType).to.equal(
          "fixture.js.Globals.parseInt"
        );
        expect(parseIntCall.callee.resolvedAssembly).to.equal("fixture.js");

        const logStmt = fn.body.statements[1];
        expect(logStmt?.kind).to.equal("expressionStatement");
        if (!logStmt || logStmt.kind !== "expressionStatement") return;
        const logCall = logStmt.expression;
        expect(logCall.kind).to.equal("call");
        if (logCall.kind !== "call") return;
        const logCallee =
          logCall.callee.kind === "typeAssertion"
            ? logCall.callee.expression
            : logCall.callee;
        expect(logCallee.kind).to.equal("memberAccess");
        if (logCallee.kind !== "memberAccess") return;
        expect(logCallee.object.kind).to.equal("identifier");
        if (logCallee.object.kind !== "identifier") return;
        expect(logCallee.object.name).to.equal("console");
        expect(logCallee.object.resolvedClrType).to.equal(
          "fixture.js.console.console"
        );
        expect(logCallee.object.resolvedAssembly).to.equal("fixture.js");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("uses source-backed runtime parameter surfaces for ambient globals from dependent source packages", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-dependent-source-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            {
              name: "app",
              version: "1.0.0",
              type: "module",
              devDependencies: {
                "@fixture/nodejs": "1.0.0",
              },
            },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        installMinimalClrRoots(tempDir);

        const jsSurfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(jsSurfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(jsSurfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(jsSurfaceRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(jsSurfaceRoot, "index.d.ts"),
          [
            "declare global {",
            "  function setInterval(",
            "    handler: (...args: unknown[]) => void,",
            "    timeout?: number,",
            "    ...args: unknown[]",
            "  ): number;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(jsSurfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: ["clr"],
              requiredTypeRoots: ["."],
            },
            null,
            2
          )
        );

        const nodejsRoot = path.join(tempDir, "node_modules/@fixture/nodejs");
        fs.mkdirSync(path.join(nodejsRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(nodejsRoot, "package.json"),
          JSON.stringify(
            {
              name: "@fixture/nodejs",
              version: "1.0.0",
              type: "module",
              dependencies: {
                "@fixture/js": "1.0.0",
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.nodejs",
                ambient: ["./globals.ts"],
                exports: {
                  "./timers.js": "./src/timers-module.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "globals.ts"),
          [
            "declare global {",
            "  function setInterval(",
            "    handler: (...args: unknown[]) => void,",
            "    timeout?: number,",
            "    ...args: unknown[]",
            "  ): number;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(nodejsRoot, "src/timers-module.ts"),
          [
            "export const setInterval = (callback: () => void, delay: number = 0): number => {",
            "  void callback;",
            "  return delay;",
            "};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  setInterval(() => {}, 1000);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const exprStmt = fn.body.statements[0];
        expect(exprStmt?.kind).to.equal("expressionStatement");
        if (!exprStmt || exprStmt.kind !== "expressionStatement") return;

        const callExpr = exprStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        expect(callExpr.callee.kind).to.equal("identifier");
        if (callExpr.callee.kind !== "identifier") return;

        expect(callExpr.callee.resolvedClrType).to.equal(
          "fixture.nodejs.TimersModule.setInterval"
        );
        expect(callExpr.callee.resolvedAssembly).to.equal("fixture.nodejs");

        expect(callExpr.parameterTypes?.[0]).to.deep.equal({
          kind: "functionType",
          parameters: [],
          returnType: {
            kind: "voidType",
          },
        });
        expect(callExpr.parameterTypes?.[1]).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
        expect(callExpr.surfaceParameterTypes?.[0]).to.deep.equal({
          kind: "functionType",
          parameters: [],
          returnType: {
            kind: "voidType",
          },
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("applies the current project source-package ambient instance bindings to its own source files", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-self-source-package-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "@fixture/lib", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(tempDir, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.lib",
                ambient: ["./globals.ts"],
                exports: {
                  ".": "./src/index.ts",
                  "./index.js": "./src/index.ts",
                  "./Globals.js": "./src/Globals.ts",
                  "./String.js": "./src/String.ts",
                },
              },
            },
            null,
            2
          )
        );
        installMinimalClrRoots(tempDir);

        const surfaceRoot = path.join(tempDir, "node_modules", "@fixture", "js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: ["clr"],
              requiredTypeRoots: ["."],
            },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "globals.ts"),
          [
            'import { String as SourceString } from "./src/Globals.js";',
            "",
            "declare global {",
            "  interface String {",
            "    trimStart(): string;",
            "    trim(): string;",
            "    replaceAll(searchValue: string, replaceValue: string): string;",
            "    charCodeAt(index: number): number;",
            "  }",
            "  const String: typeof SourceString;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(path.join(srcDir, "index.ts"), "export {};\n");
        fs.writeFileSync(
          path.join(srcDir, "String.ts"),
          [
            "export const trimStart = (value: string): string => value;",
            "export const trim = (value: string): string => value;",
            "export const replaceAll = (",
            "  value: string,",
            "  searchValue: string,",
            "  replaceValue: string",
            "): string => {",
            "  void searchValue;",
            "  void replaceValue;",
            "  return value;",
            "};",
            "export const charCodeAt = (value: string, index: number): number => {",
            "  void value;",
            "  return index;",
            "};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "Globals.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export const String = (value?: unknown): string => {",
            "  void value;",
            '  return "";',
            "};",
            "",
            "export const digitValue = (ch: string): number => {",
            '  return ch.charCodeAt(0) - "0".charCodeAt(0);',
            "};",
            "",
            "export const normalize = (value: string): string => {",
            '  return value.trimStart().replaceAll("a", "b").trim();',
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "Fixture.Lib",
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
          sourceRoot: srcDir,
          rootNamespace: "Fixture.Lib",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "Fixture.Lib",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const digitValue = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "digitValue"
        );
        expect(digitValue).to.not.equal(undefined);
        if (!digitValue) return;

        const digitInitializer = digitValue.declarations[0]?.initializer;
        expect(digitInitializer?.kind).to.equal("arrowFunction");
        if (!digitInitializer || digitInitializer.kind !== "arrowFunction") {
          return;
        }
        expect(digitInitializer.body.kind).to.equal("blockStatement");
        if (digitInitializer.body.kind !== "blockStatement") return;
        const digitReturn = digitInitializer.body.statements[0];
        expect(digitReturn?.kind).to.equal("returnStatement");
        if (!digitReturn || digitReturn.kind !== "returnStatement") return;
        const digitExpr = digitReturn.expression;
        expect(digitExpr?.kind).to.equal("binary");
        if (!digitExpr || digitExpr.kind !== "binary") return;
        expect(digitExpr.left.kind).to.equal("call");
        if (digitExpr.left.kind !== "call") return;
        expect(digitExpr.left.callee.kind).to.equal("memberAccess");
        if (digitExpr.left.callee.kind !== "memberAccess") return;
        expect(digitExpr.left.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(digitExpr.left.callee.memberBinding?.member).to.equal(
          "charCodeAt"
        );

        const normalizeDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "normalize"
        );
        expect(normalizeDecl).to.not.equal(undefined);
        if (!normalizeDecl) return;

        const normalizeInitializer = normalizeDecl.declarations[0]?.initializer;
        expect(normalizeInitializer?.kind).to.equal("arrowFunction");
        if (
          !normalizeInitializer ||
          normalizeInitializer.kind !== "arrowFunction"
        ) {
          return;
        }

        expect(normalizeInitializer.body.kind).to.equal("blockStatement");
        if (normalizeInitializer.body.kind !== "blockStatement") return;
        const normalizeReturn = normalizeInitializer.body.statements[0];
        expect(normalizeReturn?.kind).to.equal("returnStatement");
        if (
          !normalizeReturn ||
          normalizeReturn.kind !== "returnStatement" ||
          !normalizeReturn.expression
        ) {
          return;
        }

        const trimCall = normalizeReturn.expression;
        expect(trimCall.kind).to.equal("call");
        if (trimCall.kind !== "call") return;
        expect(trimCall.callee.kind).to.equal("memberAccess");
        if (trimCall.callee.kind !== "memberAccess") return;
        expect(trimCall.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(trimCall.callee.memberBinding?.member).to.equal("trim");

        expect(trimCall.callee.object.kind).to.equal("call");
        if (trimCall.callee.object.kind !== "call") return;
        expect(trimCall.callee.object.callee.kind).to.equal("memberAccess");
        if (trimCall.callee.object.callee.kind !== "memberAccess") return;
        expect(trimCall.callee.object.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(trimCall.callee.object.callee.memberBinding?.member).to.equal(
          "replaceAll"
        );

        expect(trimCall.callee.object.callee.object.kind).to.equal("call");
        if (trimCall.callee.object.callee.object.kind !== "call") return;
        expect(trimCall.callee.object.callee.object.callee.kind).to.equal(
          "memberAccess"
        );
        if (trimCall.callee.object.callee.object.callee.kind !== "memberAccess") {
          return;
        }
        expect(
          trimCall.callee.object.callee.object.callee.memberBinding?.type
        ).to.equal("fixture.lib.String");
        expect(
          trimCall.callee.object.callee.object.callee.memberBinding?.member
        ).to.equal("trimStart");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("treats source-package ambient constructor globals as real type identities", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-type-identity-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        installMinimalClrRoots(tempDir);

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.js",
                ambient: ["./globals.ts"],
                exports: {
                  "./Widget.js": "./src/Widget.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: ["clr"],
              requiredTypeRoots: ["."],
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "globals.ts"),
          [
            'import { Widget as SourceWidget } from "./src/Widget.js";',
            "",
            "declare global {",
            "  interface Widget extends SourceWidget {}",
            "  const Widget: typeof SourceWidget;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/Widget.ts"),
          [
            "export class Widget {",
            "  public isWidget(): boolean {",
            "    return true;",
            "  }",
            "}",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function check(value: string | Widget): boolean {",
            "  if (value instanceof Widget) {",
            "    return value.isWidget();",
            "  }",
            "  return value.length > 0;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("converts regex literals into RegExp constructor expressions on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-regex-literal-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./RegExp.js": "./src/RegExp.ts",
          },
          {
            "src/RegExp.ts": [
              "export class RegExp {",
              "  public constructor(_pattern: string, _flags?: string) {}",
              "  public test(_value: string): boolean {",
              "    return true;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  const RegExp: typeof import("./src/RegExp.js").RegExp;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function isUpper(text: string): boolean {",
            "  return /^[A-Z]+$/i.test(text);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "isUpper"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const testCall = returnStmt.expression;
        expect(testCall?.kind).to.equal("call");
        if (!testCall || testCall.kind !== "call") return;

        expect(testCall.callee.kind).to.equal("memberAccess");
        if (testCall.callee.kind !== "memberAccess") return;

        const regexCtor = testCall.callee.object;
        expect(regexCtor.kind).to.equal("new");
        if (regexCtor.kind !== "new") return;

        expect(regexCtor.callee.kind).to.equal("identifier");
        if (regexCtor.callee.kind !== "identifier") return;

        expect(regexCtor.callee.name).to.equal("RegExp");
        expect(regexCtor.callee.resolvedClrType).to.equal("fixture.js.RegExp");
        expect(regexCtor.arguments).to.deep.equal([
          {
            kind: "literal",
            value: "^[A-Z]+$",
            raw: JSON.stringify("^[A-Z]+$"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[0]?.sourceSpan,
          },
          {
            kind: "literal",
            value: "i",
            raw: JSON.stringify("i"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[1]?.sourceSpan,
          },
        ]);
        expect(regexCtor.parameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(regexCtor.surfaceParameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(regexCtor.parameterTypes?.[1]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(regexCtor.surfaceParameterTypes?.[1]).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "primitiveType", name: "string" },
            { kind: "primitiveType", name: "undefined" },
          ],
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves spread-only array element types on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-spread-array-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./Array.js": "./src/Array.ts",
          },
          {
            "src/Array.ts": [
              "export abstract class Array<T> {",
              "  public abstract sort(compareFn?: (a: T, b: T) => number): T[];",
              "}",
            ].join("\n"),
          },
          [
            'import { Array as SourceArray } from "./src/Array.js";',
            "",
            "declare global {",
            "  interface Array<T> extends SourceArray<T> {}",
            "  const Array: typeof SourceArray;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type MenuEntry = { weight: number };",
            "export const sortMenuEntries = (entries: MenuEntry[]): MenuEntry[] => {",
            "  return [...entries].sort((a: MenuEntry, b: MenuEntry) => a.weight - b.weight);",
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const sortDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "sortMenuEntries"
        );
        expect(sortDecl).to.not.equal(undefined);
        if (!sortDecl) return;

        const initializer = sortDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        if (!initializer || initializer.kind !== "arrowFunction") return;
        expect(initializer.body.kind).to.equal("blockStatement");
        if (initializer.body.kind !== "blockStatement") return;

        const returnStmt = initializer.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const sortCall = returnStmt.expression;
        expect(sortCall?.kind).to.equal("call");
        if (!sortCall || sortCall.kind !== "call") return;
        expect(sortCall.callee.kind).to.equal("memberAccess");
        if (sortCall.callee.kind !== "memberAccess") return;
        expect(sortCall.callee.object.kind).to.equal("array");
        if (sortCall.callee.object.kind !== "array") return;

        const inferredType = sortCall.callee.object.inferredType;
        expect(inferredType?.kind).to.equal("arrayType");
        if (!inferredType || inferredType.kind !== "arrayType") return;
        expect(inferredType.elementType.kind).to.equal("referenceType");
        if (inferredType.elementType.kind !== "referenceType") return;
        expect(inferredType.elementType.name).to.equal("MenuEntry");
        const weightMember = inferredType.elementType.structuralMembers?.find(
          (member: { kind: string; name: string }) =>
            member.kind === "propertySignature" && member.name === "weight"
        );
        expect(weightMember).to.not.equal(undefined);
        expect(weightMember?.kind).to.equal("propertySignature");
        if (!weightMember || weightMember.kind !== "propertySignature") return;
        expect(weightMember.type).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
