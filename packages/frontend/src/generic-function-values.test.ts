import { describe, it } from "mocha";
import { expect } from "chai";
import {
  getTstsIdentifierText,
  TstsSyntax,
  visitTstsSubtree,
  type TstsNode,
  type TstsSymbol,
} from "@tsonic/tsts";
import {
  collectSupportedGenericFunctionValueSymbols,
  collectWrittenSymbols,
  getSupportedGenericFunctionDeclarationSymbol,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionDeclarationNode,
  isGenericFunctionValueNode,
  type GenericFunctionValueNode,
} from "./generic-function-values.js";
import type { TstsFrontendSourceSemanticView } from "./source-frontend/index.js";
import {
  createInlineTstsTestProgram,
  createTstsTestProgramFromFiles,
} from "./testing/tsts-test-program.js";

const findGenericInitializer = (
  sourceFile: TstsNode,
  variableName: string
): GenericFunctionValueNode => {
  let match: GenericFunctionValueNode | undefined;

  visitTstsSubtree(sourceFile, (node) => {
    if (match) return;
    const variableDeclaration = TstsSyntax.AsVariableDeclaration(node);
    const name = TstsSyntax.Node_Name(node);
    const initializer = TstsSyntax.Node_Initializer(node);
    if (
      variableDeclaration &&
      getTstsIdentifierText(name) === variableName &&
      initializer &&
      isGenericFunctionValueNode(initializer)
    ) {
      match = initializer;
    }
  });

  if (!match) {
    throw new Error(
      `Expected generic function initializer for variable '${variableName}'.`
    );
  }
  return match;
};

const findGenericFunctionDeclaration = (
  sourceFile: TstsNode,
  functionName: string
): TstsNode => {
  let match: TstsNode | undefined;

  visitTstsSubtree(sourceFile, (node) => {
    if (!node) return;
    if (
      !match &&
      TstsSyntax.IsFunctionDeclaration(node) &&
      isGenericFunctionDeclarationNode(node) &&
      getTstsIdentifierText(TstsSyntax.Node_Name(node)) === functionName
    ) {
      match = node;
    }
  });

  if (!match) {
    throw new Error(
      `Expected generic function declaration for '${functionName}'.`
    );
  }
  return match;
};

const findVariableSymbol = (
  sourceFile: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  variableName: string
): TstsSymbol | undefined => {
  let symbol: TstsSymbol | undefined;

  visitTstsSubtree(sourceFile, (node) => {
    if (symbol) return;
    if (!TstsSyntax.IsVariableDeclaration(node)) return;
    const name = TstsSyntax.Node_Name(node);
    if (getTstsIdentifierText(name) !== variableName || !name) return;
    symbol = sourceSemantics.getSymbol(name);
  });

  return symbol;
};

const getSupportSymbolForVariable = (
  source: string,
  variableName: string
): TstsSymbol | undefined => {
  const program = createInlineTstsTestProgram(source);
  const initializer = findGenericInitializer(program.sourceFile, variableName);
  const writtenSymbols = collectWrittenSymbols(
    program.sourceFile,
    program.sourceSemantics
  );
  return getSupportedGenericFunctionValueSymbol(
    initializer,
    program.sourceSemantics,
    writtenSymbols
  );
};

const getCollectedSupportedSymbolForVariable = (
  source: string,
  variableName: string
): TstsSymbol | undefined => {
  const program = createInlineTstsTestProgram(source);
  return getCollectedSupportedSymbolForVariableInSourceFile(
    program.sourceFile,
    program.sourceSemantics,
    variableName
  );
};

const getCollectedSupportedSymbolForVariableInSourceFile = (
  sourceFile: TstsNode,
  sourceSemantics: TstsFrontendSourceSemanticView,
  variableName: string
): TstsSymbol | undefined => {
  const writtenSymbols = collectWrittenSymbols(sourceFile, sourceSemantics);
  const supportedSymbols = collectSupportedGenericFunctionValueSymbols(
    sourceFile,
    sourceSemantics,
    writtenSymbols
  );
  const symbol = findVariableSymbol(sourceFile, sourceSemantics, variableName);
  return symbol && supportedSymbols.has(symbol) ? symbol : undefined;
};

describe("generic-function-values helper", () => {
  it("supports generic function declaration symbols", () => {
    const program = createInlineTstsTestProgram(`
      function id<T>(x: T): T { return x; }
      void id<string>("ok");
    `);
    const declaration = findGenericFunctionDeclaration(program.sourceFile, "id");
    const symbol = getSupportedGenericFunctionDeclarationSymbol(
      declaration,
      program.sourceSemantics
    );
    expect(symbol).not.to.equal(undefined);
  });

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

  it("supports aliases to generic function declarations", () => {
    const symbol = getCollectedSupportedSymbolForVariable(
      `
      function id<T>(x: T): T { return x; }
      const copy = id;
      void copy<string>("ok");
      `,
      "copy"
    );

    expect(symbol).not.to.equal(undefined);
  });

  it("supports aliases to imported generic function declarations", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "lib.ts": `
          export function id<T>(x: T): T { return x; }
        `,
        "index.ts": `
          import { id } from "./lib.js";
          const copy = id;
          void copy<string>("ok");
        `,
      },
      "index.ts"
    );

    const symbol = getCollectedSupportedSymbolForVariableInSourceFile(
      program.sourceFile,
      program.sourceSemantics,
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
