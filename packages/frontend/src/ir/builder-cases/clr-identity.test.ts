/**
 * IR Builder tests: CLR identity preservation for source-binding declarations
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrVariableDeclaration } from "../types.js";
import { createProgram, createProgramContext } from "./_test-helpers.js";
import { materializeFrontendFixture } from "../../testing/filesystem-fixtures.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("CLR identity", () => {
    it("preserves canonical source-package member types across package internals", function () {
      this.timeout(60_000);
      const fixture = materializeFrontendFixture(
        "ir/clr-identity/source-package-internals"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          typeRoots: ["node_modules/@tsonic/node-temp", "node_modules/@tsonic/js-temp"],
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
          expect(resolvedType.name).to.equal("Date$instance");
          expect(resolvedType.resolvedClrType).to.equal(
            "Acme.Js.internal.Date$instance"
          );
        }
        if (resolvedType?.kind === "unionType") {
          const memberNames = resolvedType.types
            .filter(
              (type): type is Extract<typeof type, { kind: "referenceType" }> =>
                !!type && type.kind === "referenceType"
            )
            .map((type) => type.name);
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
        fixture.cleanup();
      }
    });

    it("preserves canonical CLR identity for array elements from source-binding declarations", function () {
      this.timeout(30_000);
      const fixture = materializeFrontendFixture(
        "ir/clr-identity/array-elements"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
        fixture.cleanup();
      }
    });

    it("preserves CLR identity for generic structural aliases from source-binding declarations", function () {
      this.timeout(30_000);
      const fixture = materializeFrontendFixture(
        "ir/clr-identity/generic-structural-alias"
      );

      try {
        const tempDir = fixture.path("app");
        const srcDir = fixture.path("app/src");
        const entryPath = fixture.path("app/src/index.ts");

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
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
        fixture.cleanup();
      }
    });
  });
});
