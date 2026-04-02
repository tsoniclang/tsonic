import { describe, it } from "mocha";
import { expect } from "chai";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";
import type {
  IrExpressionStatement,
  IrFunctionDeclaration,
  IrModule,
  IrType,
} from "../ir/types.js";

const normalizeSlashes = (value: string): string => value.replace(/\\/g, "/");

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined =>
  modules.find(
    (module) => normalizeSlashes(module.filePath) === normalizeSlashes(filePath)
  );

const findEqualCallStatement = (
  statements: readonly unknown[]
): IrExpressionStatement | undefined => {
  for (const statement of statements) {
    if (!statement || typeof statement !== "object") {
      continue;
    }

    const candidate = statement as {
      readonly kind?: string;
      readonly expression?: {
        readonly kind?: string;
        readonly callee?: {
          readonly kind?: string;
          readonly property?: unknown;
        };
      };
      readonly body?: unknown;
      readonly statements?: readonly unknown[];
      readonly thenStatement?: unknown;
      readonly elseStatement?: unknown;
    };

    if (
      candidate.kind === "expressionStatement" &&
      candidate.expression?.kind === "call" &&
      candidate.expression.callee?.kind === "memberAccess" &&
      candidate.expression.callee.property === "Equal"
    ) {
      return candidate as IrExpressionStatement;
    }

    const nestedBlocks = [
      candidate.body,
      candidate.thenStatement,
      candidate.elseStatement,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

    for (const nested of nestedBlocks) {
      const nestedStatements =
        typeof nested === "object" &&
        nested &&
        (nested as { readonly kind?: string }).kind === "blockStatement"
          ? ((nested as { readonly statements?: readonly unknown[] })
              .statements ?? [])
          : [nested];
      const resolved = findEqualCallStatement(nestedStatements);
      if (resolved) {
        return resolved;
      }
    }

    if (candidate.kind === "blockStatement") {
      const resolved = findEqualCallStatement(candidate.statements ?? []);
      if (resolved) {
        return resolved;
      }
    }
  }

  return undefined;
};

const buildFixtureGraph = (fixtureName: string) => {
  const fixture = materializeFrontendFixture([
    "fragments/minimal-surfaces/tsonic-js",
    `program/xunit-equal-overload/${fixtureName}`,
  ]);
  const projectRoot = fixture.path("app");
  const entryPath = fixture.path("app/src/index.ts");
  const result = buildModuleDependencyGraph(entryPath, {
    projectRoot,
    sourceRoot: fixture.path("app/src"),
    rootNamespace: "TestApp",
    surface: "@tsonic/js",
  });
  return { fixture, result };
};

const expectGraphSuccess = (
  result: ReturnType<typeof buildModuleDependencyGraph>
): void => {
  expect(
    result.ok,
    result.ok
      ? undefined
      : result.error
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join("\n")
  ).to.equal(true);
};

const expectRunEqualCall = (
  modules: readonly IrModule[]
): IrExpressionStatement | undefined => {
  const module = findModuleByFilePath(modules, "index.ts");
  expect(module).to.not.equal(undefined);
  if (!module) {
    return undefined;
  }

  const runFn = module.body.find(
    (statement): statement is IrFunctionDeclaration =>
      statement.kind === "functionDeclaration" && statement.name === "run"
  );
  expect(runFn).to.not.equal(undefined);
  if (!runFn) {
    return undefined;
  }

  const callStatement = findEqualCallStatement(runFn.body.statements);
  expect(callStatement).to.not.equal(undefined);
  return callStatement;
};

const formatTypeName = (type: IrType | undefined): string => {
  if (!type) {
    return "missing";
  }
  if (
    type.kind === "primitiveType" ||
    type.kind === "referenceType"
  ) {
    return type.name;
  }
  return type.kind;
};

const expectEqualCallTypes = (
  callStatement: IrExpressionStatement,
  expected: readonly string[]
): void => {
  const call = callStatement.expression;
  expect(call.kind).to.equal("call");
  if (call.kind !== "call") {
    return;
  }

  expect((call.parameterTypes ?? []).map(formatTypeName)).to.deep.equal(
    expected
  );
  expect((call.surfaceParameterTypes ?? []).map(formatTypeName)).to.deep.equal(
    expected
  );
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("keeps scalar xunit equality overloads in the full dependency graph when later arguments are JsValue", () => {
    const { fixture, result } = buildFixtureGraph("scalar-jsvalue-instance");

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["string", "string"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps string equality overloads in the full dependency graph when char aliases flow into string surfaces", () => {
    const { fixture, result } = buildFixtureGraph("char-string-instance");

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["string", "string"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps scalar xunit class overloads through facade re-exports when later arguments are JsValue", () => {
    const { fixture, result } = buildFixtureGraph(
      "scalar-jsvalue-class-reexport"
    );

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["string", "string"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps generic numeric equality when later arguments are JsValue over real xunit overloads", () => {
    const { fixture, result } = buildFixtureGraph("numeric-jsvalue");

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["double", "double"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("preserves explicit JsValue storage across callback writes for later xunit equality", () => {
    const { fixture, result } = buildFixtureGraph("callback-jsvalue");

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["double", "double"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps string equality class overloads through facade re-exports when char aliases flow into string surfaces", () => {
    const { fixture, result } = buildFixtureGraph(
      "char-string-class-reexport"
    );

    try {
      expectGraphSuccess(result);
      if (!result.ok) {
        return;
      }

      const callStatement = expectRunEqualCall(result.value.modules);
      if (!callStatement) {
        return;
      }

      expectEqualCallTypes(callStatement, ["string", "string"]);
    } finally {
      fixture.cleanup();
    }
  });
});
