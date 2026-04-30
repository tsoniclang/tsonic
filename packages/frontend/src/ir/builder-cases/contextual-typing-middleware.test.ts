/**
 * IR Builder tests: Contextual typing for callable interfaces and recursive middleware
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrFunctionDeclaration,
  IrReturnStatement,
  IrTypeAliasDeclaration,
  IrVariableDeclaration,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – contextual typing and middleware", () => {
    it("contextually types lambdas from callable interface aliases in native library ports", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'type NextControl = "route" | "router" | string | null | undefined;',
            "type NextFunction = (value?: NextControl) => void | Promise<void>;",
            "interface Request { path: string; }",
            "interface Response { send(text: string): void; }",
            "interface RequestHandler {",
            "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
            "}",
            "export const handler: RequestHandler = async (_req, _res, next) => {",
            '  await next("route");',
            "};",
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

        const requestHandler = result.value.body.find(
          (stmt): stmt is IrTypeAliasDeclaration =>
            stmt.kind === "typeAliasDeclaration" &&
            stmt.name === "RequestHandler"
        );
        expect(requestHandler).to.not.equal(undefined);
        expect(requestHandler?.type.kind).to.equal("functionType");

        const handlerDecl = result.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration"
        );
        expect(handlerDecl).to.not.equal(undefined);
        const initializer = handlerDecl?.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        expect(initializer?.inferredType?.kind).to.equal("functionType");
      } finally {
        fixture.cleanup();
      }
    });

    it("contextually types recursive middleware array literals from callable source aliases", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'type NextControl = "route" | "router" | string | null | undefined;',
            "type NextFunction = (value?: NextControl) => void | Promise<void>;",
            "interface Request { path: string; }",
            "interface Response { send(text: string): void; }",
            "interface RequestHandler {",
            "  (req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
            "}",
            "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
            "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
            "class Router {",
            "  use(...handlers: readonly MiddlewareLike[]): this {",
            "    return this;",
            "  }",
            "}",
            "class Application extends Router {",
            "  mount(path: string, ...handlers: readonly MiddlewareLike[]): this {",
            "    this.use(handlers);",
            "    return this;",
            "  }",
            "}",
            "export function main(): Application {",
            "  const app = new Application();",
            "  const handler: RequestHandler = async (_req, _res, next) => {",
            '    await next("route");',
            "  };",
            '  return app.mount("/", [handler]);',
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

        const mainFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(mainFn).to.not.equal(undefined);
        if (!mainFn) return;

        const returnStmt = mainFn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "returnStatement" }
          > => stmt.kind === "returnStatement"
        );
        expect(returnStmt).to.not.equal(undefined);
        const mountCall = returnStmt?.expression;
        expect(mountCall?.kind).to.equal("call");
        if (!mountCall || mountCall.kind !== "call") return;

        const secondArg = mountCall.arguments[1];
        expect(secondArg?.kind).to.equal("array");
        if (!secondArg || secondArg.kind !== "array") return;

        expect(secondArg.inferredType?.kind).to.equal("arrayType");
        if (
          !secondArg.inferredType ||
          secondArg.inferredType.kind !== "arrayType"
        ) {
          return;
        }

        expect(secondArg.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("contextually types nested recursive middleware array literals without explicit lambda annotations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
            "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
            "class Router {}",
            "class Application extends Router {}",
            "export function run(input: readonly MiddlewareLike[]): number {",
            "  return input.length;",
            "}",
            "export function main(): number {",
            "  const app = new Application();",
            "  return run([[(value) => { void value; }, [app]]]);",
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

        const mainFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(mainFn).to.not.equal(undefined);
        if (!mainFn) return;

        const returnStmt = mainFn.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        const outerArray = returnStmt.expression.arguments[0];
        expect(outerArray?.kind).to.equal("array");
        if (!outerArray || outerArray.kind !== "array") return;

        const innerArray = outerArray.elements[0];
        expect(innerArray?.kind).to.equal("array");
        if (!innerArray || innerArray.kind !== "array") return;

        const handler = innerArray.elements[0];
        expect(handler?.kind).to.equal("arrowFunction");
        if (!handler || handler.kind !== "arrowFunction") return;

        expect(handler.parameters[0]?.type?.kind).to.equal("primitiveType");
        if (handler.parameters[0]?.type?.kind !== "primitiveType") return;
        expect(handler.parameters[0]?.type.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("propagates tuple element types into destructured callback parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function enumerateEntries(value: unknown): [string][];",
            "export function keys(value: unknown): string[] {",
            "  return enumerateEntries(value).map(([key]) => key);",
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

        const keysFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "keys"
        );
        expect(keysFn).to.not.equal(undefined);
        if (!keysFn) return;

        const returnStmt = keysFn.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        const callback = returnStmt.expression.arguments[0];
        expect(callback?.kind).to.equal("arrowFunction");
        if (!callback || callback.kind !== "arrowFunction") return;

        expect(callback.body.kind).to.equal("identifier");
        if (callback.body.kind !== "identifier") return;

        expect(callback.body.inferredType?.kind).to.equal("primitiveType");
        if (callback.body.inferredType?.kind !== "primitiveType") return;
        expect(callback.body.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

  });
});
