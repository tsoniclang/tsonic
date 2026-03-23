/**
 * IR Builder tests: CLR identity preservation for source-binding declarations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrVariableDeclaration } from "../types.js";
import { createProgram, createProgramContext } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("CLR identity", () => {
    it("preserves imported root-namespace member types across package internals", function () {
      this.timeout(60_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-node-date-")
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

        const jsRoot = path.join(tempDir, "node_modules/@tsonic/js-temp");
        fs.mkdirSync(path.join(jsRoot, "index", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(jsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/js-temp", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(jsRoot, "index", "bindings.json"),
          JSON.stringify({ namespace: "Acme.JsRuntime", types: [] }, null, 2)
        );
        fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(jsRoot, "index", "internal", "index.d.ts"),
          [
            "export interface Date$instance {",
            "  toISOString(): string;",
            "}",
            "export type Date = Date$instance;",
          ].join("\n")
        );

        const nodeRoot = path.join(tempDir, "node_modules/@tsonic/node-temp");
        fs.mkdirSync(path.join(nodeRoot, "index", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(nodeRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/node-temp", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(nodeRoot, "index", "bindings.json"),
          JSON.stringify({ namespace: "acme.node", types: [] }, null, 2)
        );
        fs.writeFileSync(path.join(nodeRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(nodeRoot, "index", "internal", "index.d.ts"),
          [
            'import type { Date } from "@tsonic/js-temp/Acme.JsRuntime/internal/index.js";',
            "export interface Stats$instance {",
            "  mtime: Date;",
            "}",
            "export type Stats = Stats$instance;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(nodeRoot, "index.d.ts"),
          [
            'import type { Stats } from "./index/internal/index.js";',
            'declare module "node:fs" {',
            "  export const statSync: (path: string) => Stats;",
            "}",
            "export {};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { statSync } from "node:fs";',
            "const maybeDate: Date | undefined = undefined;",
            'export const resolved = maybeDate ?? statSync("package.json").mtime;',
            "export const iso = resolved.toISOString();",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
          typeRoots: [
            "node_modules/@tsonic/node-temp",
            "node_modules/@tsonic/js-temp",
          ],
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

        const resolvedDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "resolved"
        );
        expect(resolvedDecl).to.not.equal(undefined);
        if (!resolvedDecl) return;

        const resolvedType = resolvedDecl.declarations[0]?.type;
        expect(resolvedType).to.not.equal(undefined);
        expect(resolvedType?.kind).to.not.equal("unknownType");
        if (resolvedType?.kind === "referenceType") {
          expect(["Date", "Date$instance"]).to.include(resolvedType.name);
        }
        if (resolvedType?.kind === "unionType") {
          const memberNames = resolvedType.types
            .filter(
              (type): type is Extract<typeof type, { kind: "referenceType" }> =>
                !!type && type.kind === "referenceType"
            )
            .map((type) => type.name);
          expect(memberNames).to.include("Date");
          expect(memberNames).to.include("Date$instance");
        }

        const isoDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "iso"
        );
        expect(isoDecl).to.not.equal(undefined);
        if (!isoDecl) return;

        expect(isoDecl.declarations[0]?.type).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves canonical CLR identity for array elements from source-binding declarations", function () {
      this.timeout(30_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-array-identity-")
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

        const bindingsRoot = path.join(tempDir, "tsonic", "bindings");
        fs.mkdirSync(path.join(bindingsRoot, "Acme.Core", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core", "internal", "index.d.ts"),
          [
            "export interface Attachment$instance {",
            '  readonly "__tsonic_binding_alias_Acme.Core.Attachment"?: never;',
            "  readonly __tsonic_type_Acme_Core_Attachment?: never;",
            "  Id: string;",
            "}",
            "export type Attachment = Attachment$instance;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core.d.ts"),
          [
            'import type { Attachment } from "./Acme.Core/internal/index.js";',
            "export declare function getAttachments(): Attachment[];",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import { getAttachments } from "../tsonic/bindings/Acme.Core.js";',
            "const attachments = getAttachments();",
            "export const attachmentCount = attachments.length;",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
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

        const attachmentsDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "attachments"
        );
        expect(attachmentsDecl).to.not.equal(undefined);
        if (!attachmentsDecl) return;

        const attachmentsType = attachmentsDecl.declarations[0]?.type;
        expect(attachmentsType?.kind).to.equal("arrayType");
        if (!attachmentsType || attachmentsType.kind !== "arrayType") return;

        expect(attachmentsType.elementType.kind).to.equal("referenceType");
        if (attachmentsType.elementType.kind !== "referenceType") return;

        expect(attachmentsType.elementType.name).to.equal(
          "Acme.Core.Attachment"
        );
        expect(attachmentsType.elementType.resolvedClrType).to.equal(
          "Acme.Core.Attachment"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves CLR identity for generic structural aliases from source-binding declarations", function () {
      this.timeout(30_000);
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-generic-alias-")
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

        const bindingsRoot = path.join(tempDir, "tsonic", "bindings");
        fs.mkdirSync(path.join(bindingsRoot, "Acme.Core", "internal"), {
          recursive: true,
        });
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core", "bindings.json"),
          JSON.stringify(
            {
              namespace: "Acme.Core",
              types: [
                {
                  clrName: "Acme.Core.Ok__Alias`1",
                  assemblyName: "Acme.Core",
                  methods: [],
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
          path.join(bindingsRoot, "Acme.Core", "internal", "index.d.ts"),
          [
            "export interface Ok__Alias_1$instance<T> {",
            '  readonly "__tsonic_binding_alias_Acme.Core.Ok__Alias_1"?: never;',
            "  readonly value: T;",
            "}",
            "export type Ok__Alias_1<T> = Ok__Alias_1$instance<T>;",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(bindingsRoot, "Acme.Core.d.ts"),
          [
            'import type { Ok__Alias_1 } from "./Acme.Core/internal/index.js";',
            "export type Ok<T> = Ok__Alias_1<T>;",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import type { Ok } from "../tsonic/bindings/Acme.Core.js";',
            "export const value: Ok<string> | undefined = undefined;",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          useStandardLib: true,
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

        const valueDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "value"
        );
        expect(valueDecl).to.not.equal(undefined);
        if (!valueDecl) return;

        const declaredType = valueDecl.declarations[0]?.type;
        expect(declaredType?.kind).to.equal("unionType");
        if (!declaredType || declaredType.kind !== "unionType") return;

        const okType = declaredType.types.find(
          (type) => type.kind === "referenceType"
        );
        expect(okType).to.not.equal(undefined);
        if (!okType || okType.kind !== "referenceType") return;

        expect(okType.name).to.equal("Acme.Core.Ok__Alias_1");
        expect(okType.resolvedClrType).to.equal("Acme.Core.Ok__Alias`1");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
