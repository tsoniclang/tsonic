import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { createBinding } from "../../../binding/index.js";
import { convertType } from "./orchestrator.js";
import type { IrType } from "../../../types.js";

const createTestProgram = (
  source: string,
  fileName = "test.ts"
): { sourceFile: ts.SourceFile; binding: ReturnType<typeof createBinding> } => {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    strict: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;

  host.getSourceFile = (
    name: string,
    languageVersionOrOptions: ts.ScriptTarget | ts.CreateSourceFileOptions,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    if (name === fileName) {
      return ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
    }
    return originalGetSourceFile.call(
      host,
      name,
      languageVersionOrOptions,
      onError,
      shouldCreateNewSourceFile
    );
  };
  host.fileExists = (name: string) =>
    name === fileName || originalFileExists.call(host, name);
  host.readFile = (name: string) =>
    name === fileName ? source : originalReadFile.call(host, name);

  const program = ts.createProgram([fileName], compilerOptions, host);
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    throw new Error("missing source file");
  }

  return { sourceFile, binding: createBinding(program.getTypeChecker()) };
};

const convertAlias = (source: string, aliasName: string): IrType => {
  const { sourceFile, binding } = createTestProgram(source);

  let alias: ts.TypeAliasDeclaration | undefined;
  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === aliasName
    ) {
      alias = statement;
      break;
    }
  }
  if (!alias) {
    throw new Error(`type alias ${aliasName} not found`);
  }

  return convertType(alias.type, binding);
};

describe("Type Converter - Tuple Rest Lowering", () => {
  it("lowers pure variadic tuple to array type", () => {
    const converted = convertAlias("type T = [...number[]];", "T");
    expect(converted).to.deep.equal({
      kind: "arrayType",
      elementType: { kind: "primitiveType", name: "number" },
      origin: "explicit",
    });
  });

  it("lowers fixed + variadic tuple to array with union element", () => {
    const converted = convertAlias("type T = [string, ...number[]];", "T");
    expect(converted).to.deep.equal({
      kind: "arrayType",
      elementType: {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      },
      origin: "explicit",
    });
  });

  it("lowers fixed + variadic + fixed tuple to array with full union", () => {
    const converted = convertAlias(
      "type T = [number, ...string[], boolean];",
      "T"
    );
    expect(converted).to.deep.equal({
      kind: "arrayType",
      elementType: {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "boolean" },
        ],
      },
      origin: "explicit",
    });
  });

  it("handles named tuple members with rest", () => {
    const converted = convertAlias(
      "type T = [head: string, ...tail: number[]];",
      "T"
    );
    expect(converted).to.deep.equal({
      kind: "arrayType",
      elementType: {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      },
      origin: "explicit",
    });
  });
});

describe("Type Converter - Mapped/Conditional Syntax", () => {
  const expectUnknown = (type: IrType): void => {
    expect(type).to.deep.equal({ kind: "unknownType" });
  };

  it("lowers direct mapped type syntax to unknownType (never anyType)", () => {
    const converted = convertAlias(
      "type T<U> = { [K in keyof U]: U[K] | null };",
      "T"
    );
    expectUnknown(converted);
  });

  it("lowers direct conditional syntax to unknownType (never anyType)", () => {
    const converted = convertAlias(
      "type T<U> = U extends Promise<infer V> ? V : U;",
      "T"
    );
    expectUnknown(converted);
  });

  it("lowers parenthesized mapped syntax to unknownType", () => {
    const converted = convertAlias(
      "type T<U> = ({ [K in keyof U]: U[K] });",
      "T"
    );
    expectUnknown(converted);
  });

  it("lowers parenthesized conditional syntax to unknownType", () => {
    const converted = convertAlias(
      "type T<U> = (U extends string ? number : boolean);",
      "T"
    );
    expectUnknown(converted);
  });

  it("lowers infer-only syntax to unknownType", () => {
    const converted = convertAlias(
      "type T<U> = U extends Promise<infer V> ? V : never;",
      "T"
    );
    expectUnknown(converted);
  });

  it("never leaks mapped syntax to anyType when used in unions", () => {
    const converted = convertAlias(
      "type T<U> = ({ [K in keyof U]: U[K] } | string);",
      "T"
    );

    expect(converted.kind).to.equal("unionType");
    if (converted.kind !== "unionType") {
      return;
    }
    expect(
      converted.types.some(
        (member) => member.kind === "anyType" || member.kind === "unknownType"
      )
    ).to.equal(true);
    expect(
      converted.types.some((member) => member.kind === "anyType")
    ).to.equal(false);
  });

  it("never leaks conditional syntax to anyType when used in arrays", () => {
    const converted = convertAlias(
      "type T<U> = Array<U extends string ? number : boolean>;",
      "T"
    );

    expect(converted.kind).to.equal("arrayType");
    if (converted.kind !== "arrayType") {
      return;
    }
    expect(converted.elementType.kind).to.equal("unknownType");
  });

  it("lowers direct infer type node fallback to unknownType", () => {
    const converted = convertAlias(
      "type T<U> = (U extends infer V ? V : never) extends infer X ? X : never;",
      "T"
    );
    expectUnknown(converted);
  });

  it("preserves readonly type operator while still lowering nested conditional to unknown", () => {
    const converted = convertAlias(
      "type T<U> = readonly (U extends string ? number : boolean)[];",
      "T"
    );

    expect(converted.kind).to.equal("arrayType");
    if (converted.kind !== "arrayType") {
      return;
    }
    expect(converted.elementType.kind).to.equal("unknownType");
  });
});

describe("Type Converter - Symbol Dictionary Keys", () => {
  it("lowers symbol keyword types to object reference types", () => {
    const converted = convertAlias("type T = symbol;", "T");

    expect(converted).to.deep.equal({
      kind: "referenceType",
      name: "object",
      typeArguments: [],
    });
  });

  it("converts symbol index signatures to dictionaryType with object keys", () => {
    const converted = convertAlias("type T = { [key: symbol]: number };", "T");

    expect(converted).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
    });
  });

  it("converts Record<symbol, V> to dictionaryType with object keys", () => {
    const converted = convertAlias("type T = Record<symbol, number>;", "T");

    expect(converted).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
    });
  });

  it("converts Record<string | symbol, V> to dictionaryType with object keys", () => {
    const converted = convertAlias(
      "type T = Record<string | symbol, number>;",
      "T"
    );

    expect(converted).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
    });
  });

  it("converts symbol-only interface index signatures to dictionaryType with object keys", () => {
    const converted = convertAlias(
      `
        interface SymbolMap {
          [key: symbol]: number;
        }
        type T = SymbolMap;
      `,
      "T"
    );

    expect(converted).to.deep.equal({
      kind: "dictionaryType",
      keyType: { kind: "referenceType", name: "object" },
      valueType: { kind: "primitiveType", name: "number" },
    });
  });
});
