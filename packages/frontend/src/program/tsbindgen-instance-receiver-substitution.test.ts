import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import type {
  IrArrowFunctionExpression,
  IrCallExpression,
  IrFunctionDeclaration,
  IrFunctionExpression,
  IrModule,
  IrStatement,
} from "../ir/types.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined => {
  const normalizedTarget = filePath.replace(/\\/g, "/");
  const suffix = normalizedTarget.split("/").slice(-2).join("/");
  return modules.find((module) => {
    const normalizedModulePath = module.filePath.replace(/\\/g, "/");
    return (
      normalizedModulePath === normalizedTarget ||
      normalizedModulePath.endsWith(`/${suffix}`) ||
      normalizedModulePath === path.basename(filePath)
    );
  });
};

const findRunBody = (
  statements: readonly IrStatement[]
):
  | IrFunctionDeclaration["body"]
  | IrArrowFunctionExpression["body"]
  | IrFunctionExpression["body"]
  | undefined => {
  const direct = statements.find(
    (statement): statement is IrFunctionDeclaration =>
      statement.kind === "functionDeclaration" && statement.name === "run"
  );
  if (direct) {
    return direct.body;
  }

  const variable = statements.find(
    (
      statement
    ): statement is Extract<IrStatement, { kind: "variableDeclaration" }> =>
      statement.kind === "variableDeclaration" &&
      statement.declarations.some(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "run"
      )
  );
  if (!variable) {
    return undefined;
  }

  const initializer = variable.declarations.find(
    (declaration) =>
      declaration.name.kind === "identifierPattern" &&
      declaration.name.name === "run"
  )?.initializer;

  if (
    initializer?.kind === "arrowFunction" ||
    initializer?.kind === "functionExpression"
  ) {
    return initializer.body;
  }

  return undefined;
};

const collectMemberCalls = (
  node: unknown,
  propertyName: string,
  acc: IrCallExpression[]
): void => {
  if (!node || typeof node !== "object") {
    return;
  }

  const candidate = node as {
    readonly kind?: string;
    readonly body?: unknown;
    readonly statements?: readonly unknown[];
    readonly declarations?: readonly unknown[];
    readonly initializer?: unknown;
    readonly expression?: unknown;
    readonly condition?: unknown;
    readonly thenStatement?: unknown;
    readonly elseStatement?: unknown;
    readonly tryBlock?: unknown;
    readonly catchClause?: unknown;
    readonly finallyBlock?: unknown;
    readonly callee?: {
      readonly kind?: string;
      readonly property?: unknown;
    };
    readonly arguments?: readonly unknown[];
  };

  if (
    candidate.kind === "call" &&
    candidate.callee?.kind === "memberAccess" &&
    candidate.callee.property === propertyName
  ) {
    acc.push(candidate as IrCallExpression);
  }

  collectMemberCalls(candidate.body, propertyName, acc);
  collectMemberCalls(candidate.initializer, propertyName, acc);
  collectMemberCalls(candidate.expression, propertyName, acc);
  collectMemberCalls(candidate.condition, propertyName, acc);
  collectMemberCalls(candidate.thenStatement, propertyName, acc);
  collectMemberCalls(candidate.elseStatement, propertyName, acc);
  collectMemberCalls(candidate.tryBlock, propertyName, acc);
  collectMemberCalls(candidate.catchClause, propertyName, acc);
  collectMemberCalls(candidate.finallyBlock, propertyName, acc);

  for (const statement of candidate.statements ?? []) {
    collectMemberCalls(statement, propertyName, acc);
  }
  for (const declaration of candidate.declarations ?? []) {
    collectMemberCalls(declaration, propertyName, acc);
  }
  for (const argument of candidate.arguments ?? []) {
    collectMemberCalls(argument, propertyName, acc);
  }
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("specializes tsbindgen instance receiver calls before resolving returns and parameters", () => {
    const fixture = materializeFrontendFixture(
      "program/tsbindgen-instance-receiver/base"
    );

    try {
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, entryPath);
      expect(module).to.not.equal(undefined);
      if (!module) return;

      const runBody = findRunBody(module.body);
      expect(runBody).to.not.equal(undefined);
      if (!runBody) return;

      const findCalls: IrCallExpression[] = [];
      const removeCalls: IrCallExpression[] = [];
      collectMemberCalls(runBody, "Find", findCalls);
      collectMemberCalls(runBody, "Remove", removeCalls);

      expect(findCalls).to.have.length(1);
      expect(removeCalls).to.have.length(1);

      const [findCall] = findCalls;
      const [removeCall] = removeCalls;

      expect(findCall?.inferredType?.kind).to.not.equal("unknownType");
      if (findCall?.inferredType?.kind === "unionType") {
        expect(findCall.inferredType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "undefined",
        });
        expect(findCall.inferredType.types[1]).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      } else {
        expect(findCall?.inferredType).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      }

      expect(removeCall?.parameterTypes).to.have.length(1);
      if (!removeCall?.parameterTypes) {
        return;
      }
      expect(removeCall.parameterTypes[0]).to.include({
        kind: "referenceType",
        name: "PostEntity",
      });
    } finally {
      fixture.cleanup();
    }
  });

  it("specializes bound tsbindgen receiver calls from exact CLR member owners", () => {
    const fixture = materializeFrontendFixture([
      "program/tsbindgen-instance-receiver/base",
      "program/tsbindgen-instance-receiver/with-bindings",
    ]);

    try {
      const tempDir = fixture.path("app");
      const entryPath = fixture.path("app/src/index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, entryPath);
      expect(module).to.not.equal(undefined);
      if (!module) return;

      const runBody = findRunBody(module.body);
      expect(runBody).to.not.equal(undefined);
      if (!runBody) return;

      const findCalls: IrCallExpression[] = [];
      const removeCalls: IrCallExpression[] = [];
      collectMemberCalls(runBody, "Find", findCalls);
      collectMemberCalls(runBody, "Remove", removeCalls);

      expect(findCalls).to.have.length(1);
      expect(removeCalls).to.have.length(1);

      const [findCall] = findCalls;
      const [removeCall] = removeCalls;

      expect(findCall?.callee.kind).to.equal("memberAccess");
      if (findCall?.callee.kind === "memberAccess") {
        expect(findCall.callee.memberBinding?.type).to.equal(
          "Microsoft.EntityFrameworkCore.DbSet`1"
        );
      }

      expect(findCall?.inferredType?.kind).to.not.equal("unknownType");
      if (findCall?.inferredType?.kind === "unionType") {
        expect(findCall.inferredType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "undefined",
        });
        expect(findCall.inferredType.types[1]).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      } else {
        expect(findCall?.inferredType).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      }

      expect(removeCall?.parameterTypes).to.have.length(1);
      if (!removeCall?.parameterTypes) {
        return;
      }
      expect(removeCall.parameterTypes[0]).to.include({
        kind: "referenceType",
        name: "PostEntity",
      });
    } finally {
      fixture.cleanup();
    }
  });
});
