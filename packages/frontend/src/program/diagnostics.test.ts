import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { collectTsDiagnostics } from "./diagnostics.js";

const collectMessages = (source: string): readonly string[] => {
  const fileName = "/test/input.ts";
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    strict: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) return sourceFile;
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };

  const program = ts.createProgram([fileName], options, host);
  return collectTsDiagnostics(program).diagnostics.map((d) => d.message);
};

describe("TypeScript Diagnostics Conversion", () => {
  it("ignores TypeScript semantic diagnostics", () => {
    const messages = collectMessages(`
      function f(value: unknown) {
        const copy = value;
        return copy.toString();
      }
    `);

    expect(messages).to.deep.equal([]);
  });

  it("still reports syntactic diagnostics", () => {
    const messages = collectMessages(`
      function f( {
        return 1;
      }
    `);

    expect(messages.length).to.be.greaterThan(0);
  });
});
