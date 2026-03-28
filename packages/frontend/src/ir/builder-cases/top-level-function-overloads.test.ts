import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Top-level overload lowering", () => {
    it("lowers exported top-level overload groups into public wrappers plus a private implementation helper", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function parse(text: string): string;",
            "export function parse(text: string, radix: number): string;",
            "export function parse(text: string, radix: number = 10): string {",
            "  return `${text}:${radix}`;",
            "}",
            "",
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

        const parseFunctions = result.value.body.filter(
          (statement): statement is IrFunctionDeclaration =>
            statement.kind === "functionDeclaration" &&
            statement.name === "parse"
        );
        expect(parseFunctions).to.have.length(2);

        const shortOverload = parseFunctions.find(
          (statement) => statement.parameters.length === 1
        );
        expect(shortOverload?.overloadFamily).to.deep.equal({
          familyId: "function:parse",
          memberId: "function:parse:public:0",
          ownerKind: "function",
          publicName: "parse",
          isStatic: false,
          role: "publicOverload",
          publicSignatureIndex: 0,
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_parse",
        });

        const fullOverload = parseFunctions.find(
          (statement) => statement.parameters.length === 2
        );
        expect(fullOverload?.overloadFamily).to.deep.equal({
          familyId: "function:parse",
          memberId: "function:parse:public:1",
          ownerKind: "function",
          publicName: "parse",
          isStatic: false,
          role: "publicOverload",
          publicSignatureIndex: 1,
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_parse",
        });
        expect(
          parseFunctions.every((statement) => statement.isExported)
        ).to.equal(true);

        const helper = result.value.body.find(
          (statement): statement is IrFunctionDeclaration =>
            statement.kind === "functionDeclaration" &&
            statement.name === "__tsonic_overload_impl_parse"
        );
        expect(helper).to.not.equal(undefined);
        expect(helper?.isExported).to.equal(false);
        expect(helper?.overloadFamily).to.deep.equal({
          familyId: "function:parse",
          memberId: "function:parse:implementation",
          ownerKind: "function",
          publicName: "parse",
          isStatic: false,
          role: "implementation",
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_parse",
        });

        const exportedDeclarations = result.value.exports
          .filter((entry) => entry.kind === "declaration")
          .map((entry) =>
            entry.declaration.kind === "functionDeclaration"
              ? entry.declaration.name
              : entry.declaration.kind
          );
        expect(exportedDeclarations).to.deep.equal(["parse"]);
      } finally {
        fixture.cleanup();
      }
    });

    it("marks top-level union-return overload helpers as runtime-layout-preserving", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare class Buffer {",
            "  readonly length: number;",
            "}",
            "",
            "declare function implBytes(path: string): Buffer;",
            "declare function implText(path: string, encoding: string): string;",
            "",
            "export function readFileSync(path: string): Buffer;",
            "export function readFileSync(path: string, encoding: string): string;",
            "export function readFileSync(path: string, encoding?: string): string | Buffer {",
            "  if (encoding === undefined) {",
            "    return implBytes(path);",
            "  }",
            "  return implText(path, encoding);",
            "}",
            "",
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

        const helper = result.value.body.find(
          (statement): statement is IrFunctionDeclaration =>
            statement.kind === "functionDeclaration" &&
            statement.name === "__tsonic_overload_impl_readFileSync"
        );
        expect(helper).to.not.equal(undefined);
        if (!helper?.returnType) return;

        expect(helper.returnType.kind).to.equal("unionType");
        if (helper.returnType.kind !== "unionType") return;

        expect(helper.returnType.preserveRuntimeLayout).to.equal(true);
        expect(helper.returnType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(helper.returnType.types[1]?.kind).to.equal("referenceType");
        if (helper.returnType.types[1]?.kind !== "referenceType") return;
        expect(helper.returnType.types[1].name).to.equal("Buffer");
      } finally {
        fixture.cleanup();
      }
    });
  });
});
