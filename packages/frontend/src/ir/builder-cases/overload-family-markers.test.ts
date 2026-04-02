import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { runOverloadCollectionPass } from "../validation/index.js";
import {
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrInterfaceDeclaration,
  IrMethodDeclaration,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Overload family markers", () => {
    const collectOverloadsFromFixture = (
      files: Record<string, string>,
      entryRelativePath = "src/index.ts"
    ) => {
      const fixture = createFilesystemTestProgram(files, entryRelativePath);

      try {
        const built = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );
        expect(built.ok).to.equal(true);
        if (!built.ok) {
          return { fixture, result: undefined };
        }

        const collected = runOverloadCollectionPass([built.value]);
        return { fixture, result: collected };
      } catch (error) {
        fixture.cleanup();
        throw error;
      }
    };

    it("groups top-level stub overloads onto real bodies without helper functions", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "export function parse(text: string): string;",
          "export function parse(bytes: Uint8Array): string;",
          "export function parse(_value: any): any {",
          '  throw new Error("stub");',
          "}",
          "",
          "export function parse_string(text: string): string {",
          "  return text;",
          "}",
          "",
          "export function parse_bytes(bytes: Uint8Array): string {",
          "  return String(bytes.length);",
          "}",
          "",
          "O(parse_string).family(parse);",
          "O(parse_bytes).family(parse);",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(true);
        if (!result?.ok) return;

        const module = result.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const functions = module.body.filter(
          (statement): statement is IrFunctionDeclaration =>
            statement.kind === "functionDeclaration"
        );
        expect(functions.map((statement) => statement.name)).to.deep.equal([
          "parse_string",
          "parse_bytes",
        ]);
        expect(
          functions.map((statement) => statement.overloadFamily?.publicName)
        ).to.deep.equal(["parse", "parse"]);
        expect(
          functions.map(
            (statement) => statement.overloadFamily?.publicSignatureIndex
          )
        ).to.deep.equal([0, 1]);
      } finally {
        fixture.cleanup();
      }
    });

    it("rejects top-level overload stubs that are not bound with markers", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          "export function parse(text: string): string;",
          "export function parse(bytes: Uint8Array): string;",
          "export function parse(value: any): any {",
          "  return value;",
          "}",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(false);
        expect(
          result?.diagnostics.some((diagnostic) => diagnostic.code === "TSN2004")
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("groups class stub overloads onto real bodies without wrapper helpers", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "export class Parser {",
          "  Parse(text: string): string;",
          "  Parse(value: number): string;",
          "  Parse(_value: any): any {",
          '    throw new Error("stub");',
          "  }",
          "",
          "  parse_string(text: string): string {",
          "    return text;",
          "  }",
          "",
          "  parse_number(value: number): string {",
          "    return String(value);",
          "  }",
          "}",
          "",
          "O<Parser>().method(x => x.parse_string).family(x => x.Parse);",
          "O<Parser>().method(x => x.parse_number).family(x => x.Parse);",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(true);
        if (!result?.ok) return;

        const module = result.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const parserClass = module.body.find(
          (statement): statement is IrClassDeclaration =>
            statement.kind === "classDeclaration" && statement.name === "Parser"
        );
        expect(parserClass).to.not.equal(undefined);
        if (!parserClass) return;

        const methods = parserClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration"
        );
        expect(methods.map((member) => member.name)).to.deep.equal([
          "parse_string",
          "parse_number",
        ]);
        expect(
          methods.map((member) => member.overloadFamily?.publicName)
        ).to.deep.equal(["Parse", "Parse"]);
        expect(
          methods.map((member) => member.overloadFamily?.publicSignatureIndex)
        ).to.deep.equal([0, 1]);
      } finally {
        fixture.cleanup();
      }
    });

    it("groups static class stub overloads onto real bodies without wrapper helpers", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "export class Parser {",
          "  static Parse(text: string): string;",
          "  static Parse(value: number): string;",
          "  static Parse(_value: any): any {",
          '    throw new Error(\"stub\");',
          "  }",
          "",
          "  static parse_string(text: string): string {",
          "    return text;",
          "  }",
          "",
          "  static parse_number(value: number): string {",
          "    return String(value);",
          "  }",
          "}",
          "",
          "O<typeof Parser>().method(x => x.parse_string).family(x => x.Parse);",
          "O<typeof Parser>().method(x => x.parse_number).family(x => x.Parse);",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(true);
        if (!result?.ok) return;

        const module = result.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const parserClass = module.body.find(
          (statement): statement is IrClassDeclaration =>
            statement.kind === "classDeclaration" && statement.name === "Parser"
        );
        expect(parserClass).to.not.equal(undefined);
        if (!parserClass) return;

        const methods = parserClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration"
        );
        expect(methods.map((member) => member.name)).to.deep.equal([
          "parse_string",
          "parse_number",
        ]);
        expect(methods.map((member) => member.isStatic)).to.deep.equal([true, true]);
        expect(
          methods.map((member) => member.overloadFamily?.publicName)
        ).to.deep.equal(["Parse", "Parse"]);
        expect(
          methods.map((member) => member.overloadFamily?.publicSignatureIndex)
        ).to.deep.equal([0, 1]);
      } finally {
        fixture.cleanup();
      }
    });

    it("rejects class overload stubs that are not bound with markers", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          "export class Parser {",
          "  Parse(text: string): string;",
          "  Parse(value: number): string;",
          "  Parse(input: any): any {",
          "    return input;",
          "  }",
          "}",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(false);
        expect(
          result?.diagnostics.some((diagnostic) => diagnostic.code === "TSN2004")
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("still rejects legacy TypeScript constructor overload syntax", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          "export class Server {",
          "  constructor(port: number);",
          "  constructor(host: string, port: number);",
          "  constructor(hostOrPort: string | number, port?: number) {",
          "    void hostOrPort;",
          "    void port;",
          "  }",
          "}",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(false);
        expect(
          result?.diagnostics.some((diagnostic) => diagnostic.code === "TSN2004")
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves overloaded interface surfaces", () => {
      const { fixture, result } = collectOverloadsFromFixture({
        "src/index.ts": [
          "export interface Reader {",
          "  Read(path: string): string;",
          "  Read(fd: number): string;",
          "}",
        ].join("\n"),
      });

      try {
        expect(result?.ok).to.equal(true);
        if (!result?.ok) return;

        const module = result.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const reader = module.body.find(
          (statement): statement is IrInterfaceDeclaration =>
            statement.kind === "interfaceDeclaration" && statement.name === "Reader"
        );
        expect(reader).to.not.equal(undefined);
        if (!reader) return;

        const methods = reader.members.filter(
          (member) => member.kind === "methodSignature"
        );
        expect(methods).to.have.length(2);
        expect(methods.map((member) => member.name)).to.deep.equal([
          "Read",
          "Read",
        ]);
      } finally {
        fixture.cleanup();
      }
    });
  });
});
