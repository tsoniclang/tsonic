import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import {
  IrFunctionDeclaration,
  IrStatement,
  IrVariableDeclaration,
} from "./types.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";

const createTestModule = (source: string, fileName = "/test/test.ts") => {
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

  const checker = program.getTypeChecker();

  const testProgram = {
    program,
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "TestApp",
      strict: true,
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
  };

  const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
  const ctx = createProgramContext(testProgram, options);
  const result = buildIrModule(sourceFile, testProgram, options, ctx);
  if (!result.ok) {
    throw new Error(
      `Expected successful module build. Diagnostics: ${JSON.stringify(
        result.error
      )}`
    );
  }
  return result.value.body;
};

const findFunctionByName = (
  body: readonly IrStatement[],
  name: string
): IrFunctionDeclaration | undefined => {
  const statement = body.find(
    (item): item is IrFunctionDeclaration =>
      item.kind === "functionDeclaration" && item.name === name
  );
  return statement;
};

const findVariableDeclaration = (
  body: readonly IrStatement[],
  name: string
): IrVariableDeclaration | undefined => {
  return body.find((item): item is IrVariableDeclaration => {
    if (item.kind !== "variableDeclaration") return false;
    return item.declarations.some(
      (decl) =>
        decl.name.kind === "identifierPattern" && decl.name.name === name
    );
  });
};

describe("IR Builder - Generic Function Value Lowering", () => {
  it("lowers module-level const generic arrow into a function declaration", () => {
    const body = createTestModule(`
      const id = <T>(x: T): T => x;
      const value = id<string>("ok");
      void value;
    `);

    const lowered = findFunctionByName(body, "id");
    expect(lowered).not.to.equal(undefined);
    if (!lowered) return;

    expect(lowered.typeParameters).to.have.length(1);
    expect(lowered.parameters).to.have.length(1);
    expect(lowered.returnType).not.to.equal(undefined);
    expect(lowered.body.statements).to.have.length(1);
    expect(lowered.body.statements[0]?.kind).to.equal("returnStatement");
    expect(findVariableDeclaration(body, "id")).to.equal(undefined);
  });

  it("lowers module-level const generic function expression into function declaration", () => {
    const body = createTestModule(`
      const id = function <T>(x: T): T {
        return x;
      };
      const value = id<number>(1);
      void value;
    `);

    const lowered = findFunctionByName(body, "id");
    expect(lowered).not.to.equal(undefined);
    if (!lowered) return;

    expect(lowered.typeParameters).to.have.length(1);
    expect(lowered.body.statements[0]?.kind).to.equal("returnStatement");
    expect(findVariableDeclaration(body, "id")).to.equal(undefined);
  });

  it("preserves export modifier on lowered generic function value", () => {
    const body = createTestModule(`
      export const identity = <T>(x: T): T => x;
      const value = identity<string>("ok");
      void value;
    `);

    const lowered = findFunctionByName(body, "identity");
    expect(lowered).not.to.equal(undefined);
    if (!lowered) return;
    expect(lowered.isExported).to.equal(true);
  });

  it("preserves async on lowered generic arrow function value", () => {
    const body = createTestModule(`
      const identityAsync = async <T>(x: T): Promise<T> => x;
      void identityAsync<string>("ok");
    `);

    const lowered = findFunctionByName(body, "identityAsync");
    expect(lowered).not.to.equal(undefined);
    if (!lowered) return;
    expect(lowered.isAsync).to.equal(true);
    expect(lowered.body.statements[0]?.kind).to.equal("returnStatement");
  });

  it("lowers generic generator function expressions to top-level functions", () => {
    const body = createTestModule(`
      const asGenerator = function* <T>(x: T): Generator<T, void, unknown> {
        yield x;
      };
      void asGenerator<string>("ok");
    `);

    const lowered = findFunctionByName(body, "asGenerator");
    expect(lowered).not.to.equal(undefined);
    if (!lowered) return;
    expect(lowered.body.statements.length > 0).to.equal(true);
    expect(findVariableDeclaration(body, "asGenerator")).to.equal(undefined);
  });

  it("lowers nested single-declarator const generic function values", () => {
    const body = createTestModule(`
      function wrap(): string {
        const id = <T>(x: T): T => x;
        return id<string>("ok");
      }
      void wrap();
    `);

    const wrap = findFunctionByName(body, "wrap");
    expect(wrap).not.to.equal(undefined);
    if (!wrap) return;

    const innerFn = wrap.body.statements.find(
      (stmt): stmt is IrFunctionDeclaration =>
        stmt.kind === "functionDeclaration" && stmt.name === "id"
    );
    expect(innerFn).not.to.equal(undefined);

    const innerVar = wrap.body.statements.find(
      (stmt): stmt is IrVariableDeclaration =>
        stmt.kind === "variableDeclaration" &&
        stmt.declarations.some(
          (decl) =>
            decl.name.kind === "identifierPattern" && decl.name.name === "id"
        )
    );
    expect(innerVar).to.equal(undefined);
  });

  it("lowers never-reassigned let generic function values", () => {
    const body = createTestModule(`
      let id = <T>(x: T): T => x;
      void id<string>("ok");
    `);

    expect(findFunctionByName(body, "id")).not.to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).to.equal(undefined);
  });

  it("does not lower reassigned let generic function values", () => {
    const body = createTestModule(`
      let id = <T>(x: T): T => x;
      id = <T>(x: T): T => x;
      void id<string>("ok");
    `);

    expect(findFunctionByName(body, "id")).to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).not.to.equal(undefined);
  });

  it("does not lower destructuring-reassigned let generic function values", () => {
    const body = createTestModule(`
      let id = <T>(x: T): T => x;
      [id] = [id];
      void id<string>("ok");
    `);

    expect(findFunctionByName(body, "id")).to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).not.to.equal(undefined);
  });

  it("does not lower for-of-target let generic function values", () => {
    const body = createTestModule(`
      let id = <T>(x: T): T => x;
      const fns = [id];
      for (id of fns) {
        void id<string>("ok");
      }
      void id<string>("ok");
    `);

    expect(findFunctionByName(body, "id")).to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).not.to.equal(undefined);
  });

  it("still lowers let generic function values when only a shadowed symbol is reassigned", () => {
    const body = createTestModule(`
      let id = <T>(x: T): T => x;
      {
        let id = 1;
        id = 2;
        void id;
      }
      void id<string>("outer");
    `);

    expect(findFunctionByName(body, "id")).not.to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).to.equal(undefined);
  });

  it("lowers generic function declarators inside multi-declarator const statements", () => {
    const body = createTestModule(`
      const id = <T>(x: T): T => x, other = 1;
      void id<string>("ok");
      void other;
    `);

    expect(findFunctionByName(body, "id")).not.to.equal(undefined);
    expect(findVariableDeclaration(body, "id")).to.equal(undefined);
    expect(findVariableDeclaration(body, "other")).not.to.equal(undefined);
  });
});
