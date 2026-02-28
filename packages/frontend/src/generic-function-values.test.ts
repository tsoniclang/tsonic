import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import {
  collectSupportedGenericFunctionValueSymbols,
  collectWrittenSymbols,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionValueNode,
  type GenericFunctionValueNode,
} from "./generic-function-values.js";

const createTestProgram = (source: string, fileName = "/test/test.ts") => {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  const program = ts.createProgram(
    [fileName],
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    },
    {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      writeFile: () => {},
      getCurrentDirectory: () => "/test",
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => source,
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      getDefaultLibFileName: (_options) => "lib.d.ts",
    }
  );

  return {
    sourceFile,
    checker: program.getTypeChecker(),
  };
};

const findGenericInitializer = (
  sourceFile: ts.SourceFile,
  variableName: string
): GenericFunctionValueNode => {
  let match: GenericFunctionValueNode | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      isGenericFunctionValueNode(node.initializer)
    ) {
      match = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (!match) {
    throw new Error(
      `Expected generic function initializer for variable '${variableName}'.`
    );
  }
  return match;
};

const getSupportSymbolForVariable = (
  source: string,
  variableName: string
): ts.Symbol | undefined => {
  const { sourceFile, checker } = createTestProgram(source);
  const initializer = findGenericInitializer(sourceFile, variableName);
  const writtenSymbols = collectWrittenSymbols(sourceFile, checker);
  return getSupportedGenericFunctionValueSymbol(
    initializer,
    checker,
    writtenSymbols
  );
};

const getCollectedSupportedSymbolForVariable = (
  source: string,
  variableName: string
): ts.Symbol | undefined => {
  const { sourceFile, checker } = createTestProgram(source);
  const writtenSymbols = collectWrittenSymbols(sourceFile, checker);
  const supportedSymbols = collectSupportedGenericFunctionValueSymbols(
    sourceFile,
    checker,
    writtenSymbols
  );

  let symbol: ts.Symbol | undefined;
  const visit = (node: ts.Node): void => {
    if (symbol) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text !== variableName) return;
      symbol = checker.getSymbolAtLocation(node.name) ?? undefined;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!symbol) return undefined;
  return supportedSymbols.has(symbol) ? symbol : undefined;
};

describe("generic-function-values helper", () => {
  it("supports const generic function values", () => {
    const symbol = getSupportSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      void id<string>("ok");
      `,
      "id"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("supports let generic function values when never reassigned", () => {
    const symbol = getSupportSymbolForVariable(
      `
      let id = <T>(x: T): T => x;
      void id<string>("ok");
      `,
      "id"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("rejects let generic function values with direct reassignment", () => {
    const symbol = getSupportSymbolForVariable(
      `
      let id = <T>(x: T): T => x;
      id = <T>(x: T): T => x;
      `,
      "id"
    );

    expect(symbol).to.equal(undefined);
  });

  it("rejects let generic function values with destructuring reassignment", () => {
    const symbol = getSupportSymbolForVariable(
      `
      let id = <T>(x: T): T => x;
      [id] = [id];
      `,
      "id"
    );

    expect(symbol).to.equal(undefined);
  });

  it("rejects let generic function values written through for-of target", () => {
    const symbol = getSupportSymbolForVariable(
      `
      let id = <T>(x: T): T => x;
      const fns = [id];
      for (id of fns) { void id<string>("x"); }
      `,
      "id"
    );

    expect(symbol).to.equal(undefined);
  });

  it("does not treat writes to shadowed symbols as writes to outer symbol", () => {
    const symbol = getSupportSymbolForVariable(
      `
      let id = <T>(x: T): T => x;
      {
        let id = 1;
        id = 2;
      }
      void id<string>("ok");
      `,
      "id"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("rejects var generic function values", () => {
    const symbol = getSupportSymbolForVariable(
      `
      var id = <T>(x: T): T => x;
      void id<string>("ok");
      `,
      "id"
    );

    expect(symbol).to.equal(undefined);
  });

  it("supports const aliases to supported generic function values", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      const copy = id;
      void copy<string>("ok");
      `,
      "copy"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("supports chained const aliases to supported generic function values", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      const copy = id;
      const finalCopy = copy;
      void finalCopy<string>("ok");
      `,
      "finalCopy"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("supports let aliases when never reassigned", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      let copy = id;
      void copy<string>("ok");
      `,
      "copy"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("rejects let aliases with reassignment", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      let copy = id;
      copy = id;
      void copy<string>("ok");
      `,
      "copy"
    );

    expect(symbol).to.equal(undefined);
  });

  it("rejects var aliases", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      const id = <T>(x: T): T => x;
      var copy = id;
      void copy<string>("ok");
      `,
      "copy"
    );

    expect(symbol).to.equal(undefined);
  });
});
