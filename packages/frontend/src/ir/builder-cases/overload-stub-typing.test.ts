import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

const buildFunctionFromSource = (source: string, functionName: string) => {
  const fixture = createFilesystemTestProgram(
    {
      "src/index.ts": source,
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
    if (!result.ok) {
      return { fixture, fn: undefined };
    }

    const fn = result.value.body.find(
      (statement): statement is IrFunctionDeclaration =>
        statement.kind === "functionDeclaration" &&
        statement.name === functionName
    );
    return { fixture, fn };
  } catch (error) {
    fixture.cleanup();
    throw error;
  }
};

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Overload stub typing", () => {
    it("keeps instance overload stub implementations out of member call typing", () => {
      const { fixture, fn } = buildFunctionFromSource(
        [
          "class Parser {",
          "  Parse(text: string): string;",
          "  Parse(value: number): string;",
          "  Parse(_value: any): any {",
          '    throw new Error("stub");',
          "  }",
          "}",
          "",
          "export function run(): string {",
          '  const parsed = new Parser().Parse("hello");',
          "  return parsed;",
          "}",
        ].join("\n"),
        "run"
      );

      try {
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const decl = fn.body.statements[0];
        expect(decl?.kind).to.equal("variableDeclaration");
        if (!decl || decl.kind !== "variableDeclaration") return;

        const parsedDecl = decl.declarations[0];
        expect(parsedDecl?.initializer?.kind).to.equal("call");
        if (!parsedDecl?.initializer || parsedDecl.initializer.kind !== "call")
          return;

        const call = parsedDecl.initializer;
        expect(call.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.callee.kind).to.equal("memberAccess");
        if (call.callee.kind !== "memberAccess") return;
        expect(call.callee.inferredType?.kind).to.not.equal("anyType");
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps static overload stub implementations out of member call typing", () => {
      const { fixture, fn } = buildFunctionFromSource(
        [
          "class Parser {",
          "  static Parse(text: string): string;",
          "  static Parse(value: number): string;",
          "  static Parse(_value: any): any {",
          '    throw new Error("stub");',
          "  }",
          "}",
          "",
          "export function run(): string {",
          '  const parsed = Parser.Parse("hello");',
          "  return parsed;",
          "}",
        ].join("\n"),
        "run"
      );

      try {
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const decl = fn.body.statements[0];
        expect(decl?.kind).to.equal("variableDeclaration");
        if (!decl || decl.kind !== "variableDeclaration") return;

        const parsedDecl = decl.declarations[0];
        expect(parsedDecl?.initializer?.kind).to.equal("call");
        if (!parsedDecl?.initializer || parsedDecl.initializer.kind !== "call")
          return;

        const call = parsedDecl.initializer;
        expect(call.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.callee.kind).to.equal("memberAccess");
        if (call.callee.kind !== "memberAccess") return;
        expect(call.callee.inferredType?.kind).to.not.equal("anyType");
      } finally {
        fixture.cleanup();
      }
    });
  });
});
