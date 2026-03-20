/**
 * IR Builder tests: Fluent class methods, nullable and optional parameter surfaces
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – fluent and nullable params", () => {
    it("resolves `this` return types in fluent class methods without degrading to any", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Router {",
            "  use(_path: string): this {",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  mount(): this {",
            "    return this;",
            "  }",
            "}",
            "",
            "export function run(app: Application): Application {",
            '  return app.mount().use("/api");',
            "}",
          ].join("\n"),
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
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const returnStmt = runFn.body.statements.find(
          (stmt) => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "referenceType"
        );
        if (returnStmt.expression.inferredType?.kind !== "referenceType") {
          return;
        }
        expect(returnStmt.expression.inferredType.name).to.equal("Application");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves nullable parameter surfaces when calls pass undefined or null", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import { int } from "@tsonic/core/types.js";',
            "",
            "function getDefault(value: string | null | undefined): string {",
            '  return value ?? "default";',
            "}",
            "",
            "function getFlag(value: boolean | undefined): boolean {",
            "  return value ?? false;",
            "}",
            "",
            "function getId(value: int | undefined): int {",
            "  return value ?? (0 as int);",
            "}",
            "",
            "getDefault(undefined);",
            "getDefault(null);",
            "getFlag(undefined);",
            "getId(undefined);",
          ].join("\n"),
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
        if (!result.ok) return;

        const calls = result.value.body
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .filter(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" && expr.callee.kind === "identifier"
          );

        const getDefaultUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" &&
            call.callee.name === "getDefault" &&
            call.arguments[0]?.kind === "identifier"
        );
        const getDefaultNull = calls.find(
          (call) =>
            call.callee.kind === "identifier" &&
            call.callee.name === "getDefault" &&
            call.arguments[0]?.kind === "literal" &&
            call.arguments[0].value === null
        );
        const getFlagUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" && call.callee.name === "getFlag"
        );
        const getIdUndefined = calls.find(
          (call) =>
            call.callee.kind === "identifier" && call.callee.name === "getId"
        );

        expect(getDefaultUndefined?.parameterTypes?.[0]?.kind).to.equal(
          "unionType"
        );
        expect(getDefaultNull?.parameterTypes?.[0]?.kind).to.equal("unionType");
        expect(getFlagUndefined?.parameterTypes?.[0]?.kind).to.equal(
          "unionType"
        );
        expect(getIdUndefined?.parameterTypes?.[0]?.kind).to.equal("unionType");

        if (
          getDefaultUndefined?.parameterTypes?.[0]?.kind !== "unionType" ||
          getDefaultNull?.parameterTypes?.[0]?.kind !== "unionType" ||
          getFlagUndefined?.parameterTypes?.[0]?.kind !== "unionType" ||
          getIdUndefined?.parameterTypes?.[0]?.kind !== "unionType"
        ) {
          return;
        }

        expect(
          getDefaultUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["string", "null", "undefined"]);
        expect(
          getDefaultNull.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["string", "null", "undefined"]);
        expect(
          getFlagUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["boolean", "undefined"]);
        expect(
          getIdUndefined.parameterTypes[0].types.map((type) =>
            type.kind === "primitiveType" ? type.name : type.kind
          )
        ).to.have.members(["int", "undefined"]);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves optional exact-numeric parameter surfaces for function-valued calls", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import { int } from "@tsonic/core/types.js";',
            "",
            "type Query = {",
            "  limit?: int;",
            "};",
            "",
            "const topLevel = (value?: int): void => {};",
            "const typedTopLevel: (value?: int) => void = (value?: int): void => {};",
            "",
            "export function run(query: Query): void {",
            "  const local = (value?: int): void => {};",
            "  const typedLocal: (value?: int) => void = (value?: int): void => {};",
            "  topLevel(query.limit);",
            "  typedTopLevel(query.limit);",
            "  local(query.limit);",
            "  typedLocal(query.limit);",
            "}",
          ].join("\n"),
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
        if (!result.ok) return;

        const runFn = result.value.body.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const calls = runFn.body.statements.flatMap((stmt) => {
          if (
            stmt.kind !== "expressionStatement" ||
            stmt.expression.kind !== "call" ||
            stmt.expression.callee.kind !== "identifier"
          ) {
            return [];
          }
          return [stmt.expression];
        });

        expect(calls).to.have.length(4);

        for (const call of calls) {
          expect(call.parameterTypes?.[0]?.kind).to.equal("unionType");
          if (call.parameterTypes?.[0]?.kind !== "unionType") continue;
          expect(
            call.parameterTypes[0].types.map((type) =>
              type.kind === "primitiveType" ? type.name : type.kind
            )
          ).to.have.members(["int", "undefined"]);
        }
      } finally {
        fixture.cleanup();
      }
    });
  });
});
