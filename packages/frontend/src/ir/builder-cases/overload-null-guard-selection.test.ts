import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type { IrExpression } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

const findFirstCall = (
  expression: IrExpression | undefined
): Extract<IrExpression, { kind: "call" }> | undefined => {
  if (!expression) {
    return undefined;
  }

  switch (expression.kind) {
    case "call":
      return expression;
    case "memberAccess":
      return findFirstCall(expression.object);
    case "binary":
      return findFirstCall(expression.left) ?? findFirstCall(expression.right);
    case "logical":
      return findFirstCall(expression.left) ?? findFirstCall(expression.right);
    case "conditional":
      return (
        findFirstCall(expression.condition) ??
        findFirstCall(expression.whenTrue) ??
        findFirstCall(expression.whenFalse)
      );
    default:
      return undefined;
  }
};

describe("IR Builder", function () {
  this.timeout(90_000);

  it("does not treat string as assignable to number during overload scoring", () => {
    const { ctx, cleanup } = createFilesystemTestProgram(
      {
        "src/index.ts": "export const value = 1;",
      },
      "src/index.ts"
    );

    try {
      expect(
        ctx.typeSystem.isAssignableTo(
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" }
        )
      ).to.equal(false);
    } finally {
      cleanup();
    }
  });

  it("selects the string overload after null-guarded iteration over unioned key arrays", () => {
    const files = {
      "src/index.ts": `
        import { overloads as O } from "@tsonic/core/lang.js";

        class Headers {
          AllKeys: (string | null)[] | string[] = [];

          Get(index: number): string | null;
          Get(name: string | null): string | null;
          Get(_value: any): string | null {
            return null;
          }

          Get_number(index: number): string | null {
            return String(index);
          }

          Get_string(name: string | null): string | null {
            return name;
          }
        }

        O<Headers>().method(x => x.Get_number).family(x => x.Get);
        O<Headers>().method(x => x.Get_string).family(x => x.Get);

        class Request {
          Headers: Headers = new Headers();
        }

        export function run(request: Request): string | null {
          for (const headerName of request.Headers.AllKeys) {
            if (headerName === undefined || headerName === null) {
              continue;
            }

            const headerValue = request.Headers.Get(headerName);
            if (headerValue !== undefined && headerValue !== null) {
              return headerValue;
            }
          }

          return null;
        }
      `,
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/index.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const runFn = result.value.body.find(
        (
          stmt
        ): stmt is Extract<
          (typeof result.value.body)[number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) return;

      const forStmt = runFn.body.statements.find(
        (
          stmt
        ): stmt is Extract<
          (typeof runFn.body.statements)[number],
          { kind: "forOfStatement" }
        > => stmt.kind === "forOfStatement"
      );
      expect(forStmt).to.not.equal(undefined);
      if (!forStmt) return;
      expect(forStmt.body.kind).to.equal("blockStatement");
      if (forStmt.body.kind !== "blockStatement") return;

      const headerValueDecl = forStmt.body.statements.find(
        (
          stmt
        ): stmt is Extract<
          (typeof forStmt.body.statements)[number],
          { kind: "variableDeclaration" }
        > => stmt.kind === "variableDeclaration"
      );
      expect(headerValueDecl).to.not.equal(undefined);
      if (!headerValueDecl) return;

      const call = findFirstCall(headerValueDecl.declarations[0]?.initializer);
      expect(call).to.not.equal(undefined);
      if (!call) return;
      expect(call.arguments[0]?.inferredType).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });

      expect(call.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });

      expect(call.surfaceParameterTypes?.[0]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "null" },
          { kind: "primitiveType", name: "string" },
        ],
      });
    } finally {
      cleanup();
    }
  });

  it("keeps broad unknown overload metadata when a sibling source overload still has unresolved Nullable<T>", () => {
    const files = {
      "package.json": JSON.stringify({
        name: "test-app",
        type: "module",
      }),
      "src/index.ts": [
        'import { Assert } from "xunit-types/Xunit.js";',
        "",
        "declare class Holder {",
        "  value?: string;",
        "}",
        "",
        "export function run(holder: Holder): void {",
        "  Assert.NotNull(holder.value);",
        "}",
      ].join("\n"),
      "node_modules/xunit-types/package.json": JSON.stringify({
        name: "xunit-types",
        type: "module",
      }),
      "node_modules/xunit-types/Xunit.js":
        'export { Assert as Assert } from "./Xunit/internal/index.js";',
      "node_modules/xunit-types/Xunit.d.ts":
        'export { Assert as Assert } from "./Xunit/internal/index.js";',
      "node_modules/xunit-types/Xunit/internal/index.js":
        "export const Assert = undefined;",
      "node_modules/xunit-types/Xunit/internal/index.d.ts": [
        'import type { Nullable_1 } from "@tsonic/dotnet/System/internal/index.js";',
        "",
        "export interface Assert$instance {}",
        "",
        "export declare const Assert: (abstract new() => Assert$instance) & {",
        "  NotNull<T extends unknown>(value: Nullable_1<T>): T;",
        "  NotNull(object: unknown): void;",
        "};",
      ].join("\n"),
      "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
        name: "@tsonic/dotnet",
        type: "module",
      }),
      "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
      "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
        "export interface Nullable_1$instance<T> {",
        "  readonly __tsonic_type_System_Nullable_1: never;",
        "  readonly HasValue: boolean;",
        "  readonly Value: T;",
        "}",
        "export type Nullable_1<T> = Nullable_1$instance<T>;",
      ].join("\n"),
    };

    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(files, "src/index.ts");

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const runFn = result.value.body.find(
        (
          stmt
        ): stmt is Extract<
          (typeof result.value.body)[number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) return;

      const callStmt = runFn.body.statements[0];
      expect(callStmt?.kind).to.equal("expressionStatement");
      if (!callStmt || callStmt.kind !== "expressionStatement") return;
      expect(callStmt.expression.kind).to.equal("call");
      if (callStmt.expression.kind !== "call") return;

      expect(callStmt.expression.parameterTypes).to.deep.equal([
        { kind: "unknownType", explicit: true },
      ]);
      expect(callStmt.expression.surfaceParameterTypes).to.deep.equal([
        { kind: "unknownType", explicit: true },
      ]);
      expect(callStmt.expression.inferredType).to.deep.equal({
        kind: "voidType",
      });
    } finally {
      cleanup();
    }
  });
});
