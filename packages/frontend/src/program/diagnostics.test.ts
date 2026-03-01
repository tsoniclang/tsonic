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
  it("ignores TS18046 for Record.Keys pseudo-member flows", () => {
    const messages = collectMessages(`
      function f(settings: Record<string, unknown>) {
        const settingsKeys = settings.Keys;
        for (let i = 0; i < settingsKeys.Length; i++) {
          const key = settingsKeys[i];
          void key;
        }
      }
    `);

    expect(messages.some((m) => m.includes("is of type 'unknown'"))).to.equal(
      false
    );
  });

  it("ignores TS18046 for Record.Values pseudo-member flows", () => {
    const messages = collectMessages(`
      function f(settings: Record<string, unknown>) {
        const values = settings.Values;
        for (let i = 0; i < values.Length; i++) {
          void values[i];
        }
      }
    `);

    expect(messages.some((m) => m.includes("is of type 'unknown'"))).to.equal(
      false
    );
  });

  it("does not ignore unrelated TS18046 unknown diagnostics", () => {
    const messages = collectMessages(`
      function f(value: unknown) {
        const copy = value;
        return copy.toString();
      }
    `);

    expect(messages.some((m) => m.includes("is of type 'unknown'"))).to.equal(
      true
    );
  });
});
