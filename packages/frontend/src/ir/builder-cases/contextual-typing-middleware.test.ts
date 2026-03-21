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

    it("preserves recursive middleware element types after Array.isArray branch narrowing", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
            "class Router {}",
            "function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {",
            '  return typeof value === "function";',
            "}",
            "export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {",
            "  const result: (RequestHandler | Router)[] = [];",
            "  const append = (handler: MiddlewareLike): void => {",
            "    if (Array.isArray(handler)) {",
            "      for (let index = 0; index < handler.length; index += 1) {",
            "        append(handler[index]!);",
            "      }",
            "      return;",
            "    }",
            "    if (handler instanceof Router) {",
            "      result.push(handler);",
            "      return;",
            "    }",
            "    if (!isMiddlewareHandler(handler)) {",
            '      throw new Error("middleware handlers must be functions");',
            "    }",
            "    result.push(handler);",
            "  };",
            "  return result;",
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

        const flattenFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "flatten"
        );
        expect(flattenFn).to.not.equal(undefined);
        if (!flattenFn) return;

        const appendDecl = flattenFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "append"
            )
        );
        expect(appendDecl).to.not.equal(undefined);
        if (!appendDecl) return;

        const appendInit = appendDecl.declarations[0]?.initializer;
        expect(appendInit?.kind).to.equal("arrowFunction");
        if (!appendInit || appendInit.kind !== "arrowFunction") return;
        expect(appendInit.body.kind).to.equal("blockStatement");
        if (appendInit.body.kind !== "blockStatement") return;

        const arrayGuard = appendInit.body.statements[0];
        expect(arrayGuard?.kind).to.equal("ifStatement");
        if (!arrayGuard || arrayGuard.kind !== "ifStatement") return;
        expect(arrayGuard.thenStatement.kind).to.equal("blockStatement");
        if (arrayGuard.thenStatement.kind !== "blockStatement") return;

        const loopStmt = arrayGuard.thenStatement.statements[0];
        expect(loopStmt?.kind).to.equal("forStatement");
        if (!loopStmt || loopStmt.kind !== "forStatement") return;
        expect(loopStmt.body.kind).to.equal("blockStatement");
        if (loopStmt.body.kind !== "blockStatement") return;

        const appendCallStmt = loopStmt.body.statements[0];
        expect(appendCallStmt?.kind).to.equal("expressionStatement");
        if (
          !appendCallStmt ||
          appendCallStmt.kind !== "expressionStatement" ||
          appendCallStmt.expression.kind !== "call"
        ) {
          return;
        }

        const recursiveArg = appendCallStmt.expression.arguments[0];
        expect(recursiveArg?.inferredType?.kind).to.equal("referenceType");
        if (
          !recursiveArg?.inferredType ||
          recursiveArg.inferredType.kind !== "referenceType"
        ) {
          return;
        }

        expect(recursiveArg.inferredType.name).to.equal("MiddlewareLike");
      } finally {
        fixture.cleanup();
      }
    });

    it("builds express-like recursive middleware overloads without stable type key overflow", () => {
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
            "interface ErrorRequestHandler {",
            "  (error: unknown, req: Request, res: Response, next: NextFunction): unknown | Promise<unknown>;",
            "}",
            "type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
            "type MiddlewareHandler = RequestHandler | ErrorRequestHandler;",
            "type MiddlewareEntry = MiddlewareHandler | Router;",
            "type MiddlewareLike = MiddlewareEntry | readonly MiddlewareLike[];",
            "function isPathSpec(value: PathSpec | MiddlewareEntry): value is PathSpec {",
            '  return value == null || typeof value === "string" || value instanceof RegExp || Array.isArray(value);',
            "}",
            "function flattenMiddlewareEntries(entries: readonly MiddlewareEntry[]): readonly MiddlewareEntry[] {",
            "  return entries;",
            "}",
            "class Router {",
            "  use(first: PathSpec | MiddlewareEntry, ...rest: MiddlewareEntry[]): this {",
            '    const mountedAt = isPathSpec(first) ? first : "/";',
            "    const candidates: readonly MiddlewareEntry[] = isPathSpec(first) ? rest : [first, ...rest];",
            "    this.addMiddlewareLayer(mountedAt, candidates);",
            "    return this;",
            "  }",
            "  useError(...handlers: readonly ErrorRequestHandler[]): this {",
            '    this.addErrorMiddlewareLayer("/", handlers);',
            "    return this;",
            "  }",
            "  protected addMiddlewareLayer(path: PathSpec, handlers: readonly MiddlewareEntry[]): void {",
            "    for (const handler of flattenMiddlewareEntries(handlers)) {",
            "      if (handler instanceof Router) {",
            "        this.mountRouter(path, handler);",
            "        continue;",
            "      }",
            "      this.registerHandler(path, handler);",
            "    }",
            "  }",
            "  protected addErrorMiddlewareLayer(path: PathSpec, handlers: readonly ErrorRequestHandler[]): void {",
            "    for (const handler of handlers) {",
            "      this.registerErrorHandler(path, handler);",
            "    }",
            "  }",
            "  protected mountRouter(_path: PathSpec, _router: Router): void {}",
            "  protected registerHandler(_path: PathSpec, _handler: MiddlewareHandler): void {}",
            "  protected registerErrorHandler(_path: PathSpec, _handler: ErrorRequestHandler): void {}",
            "}",
            "class Application extends Router {",
            "  get(path: PathSpec, ...handlers: readonly RequestHandler[]): this {",
            "    return this;",
            "  }",
            "}",
            "export async function main(): Promise<void> {",
            "  const app = new Application();",
            "  const child = new Application();",
            '  app.use("/api", child);',
            "  app.useError(async (_error, _req, res, _next) => {",
            '    res.send("handled");',
            "  });",
            '  app.get("/items/:id",',
            "    async (_req, _res, next) => {",
            '      await next("route");',
            "    },",
            "    async (_req, res, _next) => {",
            '      res.send("ok");',
            "    });",
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
      } finally {
        fixture.cleanup();
      }
    });
  });
});
