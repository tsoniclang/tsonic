/**
 * IR Builder tests: Object-literal exports, class member inference, and const object members
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import {
  createFilesystemTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – object exports and member inference", () => {
    it("recovers object-literal export members from source-package module objects", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-object-")
      );

      try {
        const jsRoot = path.resolve(process.cwd(), "../../../js/versions/10");
        expect(fs.existsSync(path.join(jsRoot, "package.json"))).to.equal(true);

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

        const packageRoot = path.join(tempDir, "node_modules", "@demo", "pkg");
        fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
        fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
        fs.writeFileSync(
          path.join(packageRoot, "package.json"),
          JSON.stringify(
            {
              name: "@demo/pkg",
              version: "0.0.0-test",
              type: "module",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "demo.pkg",
                exports: {
                  ".": "./src/index.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(packageRoot, "src", "index.ts"),
          [
            "export type Parsed = { base: string };",
            "export const basename = (value: string): string => value;",
            "export const parse = (value: string): Parsed => ({ base: value });",
            "const pathObject = {",
            '  sep: "/",',
            "  basename,",
            "  parse,",
            "};",
            "export { pathObject as path };",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { path } from "@demo/pkg";',
            "export function run(): string {",
            '  const parsed = path.parse("file.txt");',
            "  return path.basename(parsed.base) + path.sep;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
          typeRoots: [jsRoot, packageRoot],
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

        const runFn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "binary"
        ) {
          return;
        }

        const left = returnStmt.expression.left;
        expect(left.kind).to.equal("call");
        if (left.kind !== "call") return;
        expect(left.callee.kind).to.equal("memberAccess");
        if (left.callee.kind !== "memberAccess") return;
        expect(left.callee.inferredType?.kind).to.equal("functionType");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("infers deterministic class member types from initializer syntax", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class A {",
            "  headers = {};",
            "  body = undefined;",
            "  mapper = (value: string): string => value;",
            "}",
            "export function run(a: A): string {",
            "  if (a.headers == null) throw new Error('bad');",
            "  if (a.body !== undefined) throw new Error('bad');",
            '  return a.mapper("x");',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }
        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (returnStmt.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(returnStmt.expression.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("infers local const object members from deterministic initializer syntax", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Parsed = { base: string };",
            "const basename = (value: string): string => value;",
            "const parse = (value: string): Parsed => ({ base: value });",
            "const pathObject = {",
            '  sep: "/",',
            "  basename,",
            "  parse,",
            "};",
            "export function run(): string {",
            '  const parsed = pathObject.parse("file.txt");',
            "  return pathObject.basename(parsed.base) + pathObject.sep;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "binary"
        ) {
          return;
        }

        const left = returnStmt.expression.left;
        expect(left.kind).to.equal("call");
        if (left.kind !== "call") return;
        expect(left.callee.kind).to.equal("memberAccess");
        if (left.callee.kind !== "memberAccess") return;
        expect(left.callee.inferredType?.kind).to.equal("functionType");
      } finally {
        fixture.cleanup();
      }
    });
  });
});
