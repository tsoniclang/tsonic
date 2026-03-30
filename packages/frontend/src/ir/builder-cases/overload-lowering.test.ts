/**
 * IR Builder tests: Overload lowering and push overloads
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrExpressionStatement,
  IrFunctionDeclaration,
  IrMethodDeclaration,
} from "../types.js";
import {
  createFilesystemTestProgram,
  unwrapTransparentExpression,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – overload lowering", () => {
    it("lowers direct .ts overload implementations with shorter overload signatures via wrapper methods", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type PathSpec = string | RegExp;",
            "type RouteHandler = () => void;",
            "",
            "class Router {",
            "  get(path: PathSpec, ...handlers: RouteHandler[]): Router {",
            "    void path;",
            "    void handlers;",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  get(name: string): unknown;",
            "  get(path: PathSpec, ...handlers: RouteHandler[]): Application;",
            "  override get(nameOrPath: string | PathSpec, ...handlers: RouteHandler[]): unknown {",
            '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
            "      return undefined;",
            "    }",
            "    return super.get(nameOrPath as PathSpec, ...handlers) as Application;",
            "  }",
            "}",
            "",
            "export function useApp(app: Application): Application {",
            '  app.get("setting");',
            '  return app.get("/items", () => {});',
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

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const getMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "get"
        );
        expect(getMethods.length).to.equal(2);

        const settingsGetter = getMethods.find(
          (member) =>
            member.parameters.length === 1 &&
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );
        expect(settingsGetter).to.not.equal(undefined);
        expect(settingsGetter?.isOverride).to.equal(undefined);
        expect(settingsGetter?.overloadFamily).to.deep.equal({
          familyId: "method:instance:get",
          memberId: "method:instance:get:public:0",
          ownerKind: "method",
          publicName: "get",
          isStatic: false,
          role: "publicOverload",
          publicSignatureIndex: 0,
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_get",
        });

        const routeGetter = getMethods.find(
          (member) =>
            member.parameters.length === 2 && member.parameters[1]?.isRest
        );
        expect(routeGetter).to.not.equal(undefined);
        expect(routeGetter?.isOverride).to.equal(true);
        expect(routeGetter?.overloadFamily).to.deep.equal({
          familyId: "method:instance:get",
          memberId: "method:instance:get:public:1",
          ownerKind: "method",
          publicName: "get",
          isStatic: false,
          role: "publicOverload",
          publicSignatureIndex: 1,
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_get",
        });

        const implMethod = appClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_get"
        );
        expect(implMethod).to.not.equal(undefined);
        if (!implMethod || implMethod.kind !== "methodDeclaration") return;
        expect(implMethod.accessibility).to.equal("private");
        expect(implMethod.overloadFamily).to.deep.equal({
          familyId: "method:instance:get",
          memberId: "method:instance:get:implementation",
          ownerKind: "method",
          publicName: "get",
          isStatic: false,
          role: "implementation",
          publicSignatureCount: 2,
          implementationName: "__tsonic_overload_impl_get",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("marks only signature-compatible overload wrappers as overrides against TS base classes", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type ParamHandler = (value: string) => void;",
            "",
            "class Router {",
            "  get(path: string, ...handlers: (() => void)[]): this {",
            "    void path;",
            "    void handlers;",
            "    return this;",
            "  }",
            "  param(name: string, callback: ParamHandler): this {",
            "    void name;",
            "    void callback;",
            "    return this;",
            "  }",
            "}",
            "",
            "export class Application extends Router {",
            "  get(name: string): unknown;",
            "  override get(path: string, ...handlers: (() => void)[]): this;",
            "  override get(nameOrPath: string, ...handlers: (() => void)[]): unknown {",
            "    if (handlers.length === 0) return undefined;",
            "    return super.get(nameOrPath, ...handlers);",
            "  }",
            "",
            "  override param(name: string, callback: ParamHandler): this;",
            "  param(name: string[], callback: ParamHandler): this;",
            "  override param(name: string | string[], callback: ParamHandler): this {",
            "    if (Array.isArray(name)) {",
            "      return this;",
            "    }",
            "    return super.param(name, callback);",
            "  }",
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

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const getMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "get"
        );
        expect(getMethods.length).to.equal(2);
        expect(
          getMethods.filter((member) => member.isOverride === true).length
        ).to.equal(1);

        const paramMethods = appClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "param"
        );
        expect(paramMethods.length).to.equal(2);
        expect(
          paramMethods.filter((member) => member.isOverride === true).length
        ).to.equal(1);

        const arrayParamOverload = paramMethods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "arrayType" &&
            member.parameters[0].type.elementType.kind === "primitiveType" &&
            member.parameters[0].type.elementType.name === "string"
        );
        expect(arrayParamOverload).to.not.equal(undefined);
        expect(arrayParamOverload?.isOverride).to.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("uses wrapper lowering when callback overloads narrow the implementation delegate arity", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Arrayish<T> {",
            "  every(callback: (value: T) => boolean): boolean;",
            "  every(callback: (value: T, index: number) => boolean): boolean;",
            "  every(callback: (value: T, index?: number, array?: T[]) => boolean): boolean {",
            "    return callback(undefined as T, 0, []);",
            "  }",
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

        const arrayishClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Arrayish"
        );
        expect(arrayishClass).to.not.equal(undefined);
        if (!arrayishClass) return;

        const everyMethods = arrayishClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "every"
        );
        expect(everyMethods.length).to.equal(2);

        const helperMethod = arrayishClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_every"
        );
        expect(helperMethod).to.not.equal(undefined);
        if (!helperMethod) return;

        expect(helperMethod.parameters[0]?.type?.kind).to.equal("functionType");
        if (helperMethod.parameters[0]?.type?.kind !== "functionType") return;
        expect(helperMethod.parameters[0].type.parameters.length).to.equal(3);
      } finally {
        fixture.cleanup();
      }
    });

    it("uses wrapper lowering for top-level overloads when a nullable callback slot narrows from a union parameter", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type ExecOptions = { shell?: boolean };",
            "",
            "export function exec(command: string, callback: (stdout: string) => void): void;",
            "export function exec(command: string, options: ExecOptions | null, callback: (stdout: string) => void): void;",
            "export function exec(",
            "  command: string,",
            "  optionsOrCallback: ExecOptions | null | ((stdout: string) => void),",
            "  callback?: ((stdout: string) => void) | null",
            "): void {",
            '  const resolvedCallback = typeof optionsOrCallback === "function" ? optionsOrCallback : callback;',
            '  const resolvedOptions = typeof optionsOrCallback === "function" ? null : optionsOrCallback;',
            '  resolvedCallback?.("ok");',
            "  void resolvedOptions;",
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

        const execFunctions = result.value.body.filter(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "exec"
        );
        expect(execFunctions.length).to.equal(2);

        const helperFunction = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" &&
            stmt.name === "__tsonic_overload_impl_exec"
        );
        expect(helperFunction).to.not.equal(undefined);
        if (!helperFunction) return;

        expect(helperFunction.parameters[1]?.type?.kind).to.equal("unionType");
      } finally {
        fixture.cleanup();
      }
    });

    it("uses wrapper lowering for method overloads when callback and backlog positions shift across overloads", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Server {",
            "  private listenPath(path: string, callback?: (() => void) | null): Server {",
            "    return this;",
            "  }",
            "  private listenInternal(",
            "    port: number,",
            "    hostname: string | null | undefined,",
            "    backlog: number,",
            "    callback?: (() => void) | null",
            "  ): Server {",
            "    return this;",
            "  }",
            "  listen(path: string, callback?: (() => void) | null): Server;",
            "  listen(port: number, hostname: string, backlog: number, callback?: (() => void) | null): Server;",
            "  listen(port: number, hostname: string, callback?: (() => void) | null): Server;",
            "  listen(port: number, backlog: number, callback?: (() => void) | null): Server;",
            "  listen(port: number, callback?: (() => void) | null): Server;",
            "  listen(",
            "    portOrPath: number | string,",
            "    hostname?: string | number | (() => void) | null,",
            "    backlog?: number | (() => void) | null,",
            "    callback?: (() => void) | null",
            "  ): Server {",
            '    if (typeof portOrPath === "string") {',
            '      const pathCallback = typeof hostname === "function" ? hostname : callback;',
            "      return this.listenPath(portOrPath, pathCallback ?? undefined);",
            "    }",
            '    if (typeof hostname === "function") {',
            "      callback = hostname;",
            "      hostname = null;",
            "      backlog = null;",
            '    } else if (typeof hostname === "number") {',
            '      callback = typeof backlog === "function" ? backlog : callback;',
            "      backlog = hostname;",
            "      hostname = null;",
            '    } else if (typeof backlog === "function") {',
            "      callback = backlog;",
            "      backlog = null;",
            "    }",
            "    const port = portOrPath;",
            '    return this.listenInternal(port, typeof hostname === "string" ? hostname : undefined, typeof backlog === "number" ? backlog : 511, callback ?? undefined);',
            "  }",
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

        const serverClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Server"
        );
        expect(serverClass).to.not.equal(undefined);
        if (!serverClass) return;

        const listenMethods = serverClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "listen"
        );
        expect(listenMethods.length).to.equal(5);

        const helperMethod = serverClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_listen"
        );
        expect(helperMethod).to.not.equal(undefined);
        if (!helperMethod) return;

        expect(helperMethod.parameters[0]?.type?.kind).to.equal("unionType");
        expect(helperMethod.parameters[1]?.type?.kind).to.equal("unionType");
        expect(helperMethod.parameters[2]?.type?.kind).to.equal("unionType");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves defaulted trailing parameters in direct .ts overload implementations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Parser {",
            "  parse(text: string): string;",
            "  parse(text: string, radix: number): string;",
            "  parse(text: string, radix = 10): string {",
            "    return `${text}:${radix}`;",
            "  }",
            "}",
            "",
            "export function run(parser: Parser): string {",
            '  return parser.parse("42");',
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

        const parserClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Parser"
        );
        expect(parserClass).to.not.equal(undefined);
        if (!parserClass) return;

        const implMethod = parserClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_parse"
        );
        expect(implMethod).to.not.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });

    it("uses narrowed overload surface types for member calls inside overload implementations", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "class Socket {",
            "  connect(port: int, host?: string, connectionListener?: () => void): void;",
            "  connect(path: string, connectionListener?: () => void): void;",
            "  connect(",
            "    portOrPath: int | string,",
            "    hostOrListener?: string | (() => void),",
            "    connectionListener?: () => void",
            "  ): void {",
            "    void portOrPath;",
            "    void hostOrListener;",
            "    void connectionListener;",
            "  }",
            "}",
            "",
            "export function open(",
            "  portOrPath: int | string,",
            "  hostOrListener?: string | (() => void),",
            "  connectionListener?: () => void",
            "): Socket {",
            "  const socket = new Socket();",
            '  if (typeof portOrPath === "string") {',
            '    const listener = typeof hostOrListener === "function" ? hostOrListener : undefined;',
            "    socket.connect(portOrPath, listener);",
            "    return socket;",
            "  }",
            "  return socket;",
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

        const openFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "open"
        );
        expect(openFn).to.not.equal(undefined);
        if (!openFn) return;

        const ifStmt = openFn.body.statements[1];
        expect(ifStmt?.kind).to.equal("ifStatement");
        if (!ifStmt || ifStmt.kind !== "ifStatement") return;

        expect(ifStmt.thenStatement.kind).to.equal("blockStatement");
        if (ifStmt.thenStatement.kind !== "blockStatement") return;

        const callStmt = ifStmt.thenStatement.statements[1];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          (callStmt as IrExpressionStatement).expression.kind !== "call"
        ) {
          return;
        }

        const call = (callStmt as IrExpressionStatement).expression;
        if (call.kind !== "call") return;

        expect(call.parameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.surfaceParameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.parameterTypes?.[1]?.kind).to.equal("unionType");
        expect(call.surfaceParameterTypes?.[1]?.kind).to.equal("unionType");
        if (
          call.parameterTypes?.[1]?.kind !== "unionType" ||
          call.surfaceParameterTypes?.[1]?.kind !== "unionType"
        ) {
          return;
        }
        expect(call.parameterTypes[1].types).to.deep.equal([
          {
            kind: "functionType",
            parameters: [],
            returnType: { kind: "voidType" },
          },
          { kind: "primitiveType", name: "undefined" },
        ]);
        expect(call.surfaceParameterTypes[1].types).to.deep.equal([
          {
            kind: "functionType",
            parameters: [],
            returnType: { kind: "voidType" },
          },
          { kind: "primitiveType", name: "undefined" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps selected object overload surfaces exact for external member calls", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class BindOptions {",
            "  port?: number;",
            "  fd?: number;",
            "  address?: string;",
            "}",
            "",
            "class Socket {",
            "  bind(): void;",
            "  bind(port: number, address?: string, callback?: () => void): void;",
            "  bind(port: number, callback: () => void): void;",
            "  bind(callback: () => void): void;",
            "  bind(options: BindOptions, callback?: () => void): void;",
            "  bind(",
            "    portOrCallbackOrOptions?: number | (() => void) | BindOptions,",
            "    addressOrCallback?: string | (() => void),",
            "    callback?: () => void",
            "  ): void {}",
            "}",
            "",
            "export function run(socket: Socket): void {",
            "  const options = new BindOptions();",
            "  options.port = 0;",
            '  options.address = "127.0.0.1";',
            "  socket.bind(options);",
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

        const callStmt = runFn.body.statements[3];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const call = callStmt.expression;
        expect(call.parameterTypes?.[0]?.kind).to.equal("referenceType");
        expect(call.surfaceParameterTypes?.[0]?.kind).to.equal("referenceType");
        if (
          call.parameterTypes?.[0]?.kind !== "referenceType" ||
          call.surfaceParameterTypes?.[0]?.kind !== "referenceType"
        ) {
          return;
        }
        expect(call.parameterTypes[0].name).to.equal("BindOptions");
        expect(call.surfaceParameterTypes[0].name).to.equal("BindOptions");
        expect(call.parameterTypes).to.have.length(2);
        expect(call.surfaceParameterTypes).to.have.length(2);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps selected delegate overload surfaces exact for external function calls", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import { createServer } from "@fixture/tls/index.js";',
            "",
            "export function run(): void {",
            "  createServer((_socket) => {});",
            "}",
          ].join("\n"),
          "node_modules/@fixture/tls/package.json": JSON.stringify({
            name: "@fixture/tls",
            version: "1.0.0",
            type: "module",
          }),
          "node_modules/@fixture/tls/index.js": [
            "export function createServer(..._args) {",
            "  return undefined;",
            "}",
          ].join("\n"),
          "node_modules/@fixture/tls/index.d.ts": [
            "export class TLSSocket {}",
            "export class TlsOptions {",
            "  requestCert?: boolean;",
            "}",
            "export function createServer(",
            "  options: TlsOptions,",
            "  secureConnectionListener?: (socket: TLSSocket) => void",
            "): void;",
            "export function createServer(",
            "  secureConnectionListener?: (socket: TLSSocket) => void",
            "): void;",
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

        const callStmt = runFn.body.statements[0];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const call = callStmt.expression;
        expect(call.parameterTypes).to.have.length(1);
        expect(call.surfaceParameterTypes).to.have.length(1);
        expect(call.parameterTypes?.[0]?.kind).to.equal("functionType");
        expect(call.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");
        if (call.surfaceParameterTypes?.[0]?.kind !== "unionType") {
          return;
        }
        expect(call.surfaceParameterTypes[0].types).to.have.length(2);
        expect(call.surfaceParameterTypes[0].types[0]?.kind).to.equal(
          "functionType"
        );
        expect(call.surfaceParameterTypes[0].types[1]).to.deep.equal({
          kind: "primitiveType",
          name: "undefined",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("uses wrapper lowering when overload signatures make initialized implementation parameters optional", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "export class BufferLike {",
            "  set(index: int, value: number): void;",
            "  set(values: Iterable<number>, offset?: int): void;",
            "  set(sourceOrIndex: int | Iterable<number>, offsetOrValue: int | number = 0 as int): void {",
            '    if (typeof sourceOrIndex === "number") {',
            "      void offsetOrValue;",
            "      return;",
            "    }",
            "    const start = offsetOrValue;",
            "    void start;",
            "  }",
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

        const bufferLikeClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "BufferLike"
        );
        expect(bufferLikeClass).to.not.equal(undefined);
        if (!bufferLikeClass) return;

        const setMethods = bufferLikeClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "set"
        );
        expect(setMethods.length).to.equal(2);

        const helperMethod = bufferLikeClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_set"
        );
        expect(helperMethod).to.not.equal(undefined);
      } finally {
        fixture.cleanup();
      }
    });


    it("specializes Array.isArray overload bodies against the concrete overload parameter type", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class A {",
            "  append(field: string, value: string): A;",
            "  append(field: string, value: readonly string[]): A;",
            "  append(field: string, value: string | readonly string[]): A {",
            "    if (Array.isArray(value)) {",
            "      const values = value as readonly string[];",
            "      for (let index = 0; index < values.length; index += 1) {",
            "        const item = values[index]!;",
            "        this.append(field, item);",
            "      }",
            "      return this;",
            "    }",
            "    return this;",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "A"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const appendMethods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "append"
        );
        expect(appendMethods.length).to.equal(2);

        const stringOverload = appendMethods.find((member) => {
          const valueParam = member.parameters[1];
          return (
            valueParam?.type?.kind === "primitiveType" &&
            valueParam.type.name === "string"
          );
        });
        expect(stringOverload).to.not.equal(undefined);
        if (!stringOverload || !stringOverload.body) return;
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "returnStatement"
          )
        ).to.equal(true);
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);

        const arrayOverload = appendMethods.find(
          (member) => member.parameters[1]?.type?.kind === "arrayType"
        );
        expect(arrayOverload).to.not.equal(undefined);
        if (!arrayOverload || !arrayOverload.body) return;
        expect(
          arrayOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("folds typeof overload guards away inside specialized overload bodies", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class KeyStore {",
            "  setValue(value: string): void;",
            "  setValue(value: number): void;",
            "  setValue(value: string | number): void {",
            '    if (typeof value === "string") {',
            "      return;",
            "    }",
            "    const stable = value;",
            "    void stable;",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "KeyStore"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const methods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "setValue"
        );
        expect(methods.length).to.equal(2);

        const stringOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );
        expect(stringOverload).to.not.equal(undefined);
        if (!stringOverload?.body) return;
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);

        const numberOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "number"
        );
        expect(numberOverload).to.not.equal(undefined);
        if (!numberOverload?.body) return;
        expect(
          numberOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);

        const declaration = numberOverload.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(declaration).to.not.equal(undefined);
        const initializer = unwrapTransparentExpression(
          declaration?.declarations[0]?.initializer
        );
        expect(initializer?.kind).to.equal("identifier");
        if (!initializer || initializer.kind !== "identifier") return;

        expect(initializer.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("folds later typeof overload guards away after earlier branch narrowing adds compiler assertions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type SocketOptions = { port: number };",
            "",
            "export class Connector {",
            "  connect(value: string): void;",
            "  connect(value: number): void;",
            "  connect(value: SocketOptions): void;",
            "  connect(value: string | number | SocketOptions): void {",
            '    if (typeof value === "string") {',
            "      return;",
            "    }",
            '    if (typeof value === "number") {',
            "      const stable = value;",
            "      void stable;",
            "      return;",
            "    }",
            "    const port = value.port;",
            "    void port;",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Connector"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const methods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "connect"
        );
        expect(methods.length).to.equal(3);

        const numberOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "number"
        );
        expect(numberOverload).to.not.equal(undefined);
        if (!numberOverload?.body) return;
        expect(
          numberOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
        const numberBodyStatements =
          numberOverload.body.statements.find(
            (stmt): stmt is Extract<typeof stmt, { kind: "blockStatement" }> =>
              stmt.kind === "blockStatement"
          )?.statements
            ? numberOverload.body.statements.find(
                (
                  stmt
                ): stmt is Extract<typeof stmt, { kind: "blockStatement" }> =>
                  stmt.kind === "blockStatement"
              )!.statements
            : numberOverload.body.statements;
        const stableDeclaration = numberBodyStatements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(stableDeclaration).to.not.equal(undefined);
        const stableInit = unwrapTransparentExpression(
          stableDeclaration?.declarations[0]?.initializer
        );
        expect(stableInit?.kind).to.equal("identifier");
        if (!stableInit || stableInit.kind !== "identifier") return;
        expect(stableInit.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });

        const objectOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "referenceType" &&
            member.parameters[0].type.name === "SocketOptions"
        );
        expect(objectOverload).to.not.equal(undefined);
        if (!objectOverload?.body) return;
        expect(
          objectOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves checker-resolved overload metadata for narrowed recursive overload calls", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type int = number;",
            "type byte = number;",
            "class Buffer {}",
            "type WritableFsBuffer = byte[] | Buffer;",
            "",
            "function resolveWriteLength(",
            "  buffer: WritableFsBuffer,",
            "  offset: int,",
            "  lengthOrEncoding?: int | string",
            "): int {",
            "  void buffer;",
            "  void offset;",
            "  void lengthOrEncoding;",
            "  return 1 as int;",
            "}",
            "",
            "export class FS {",
            "  writeSync(fd: int, buffer: WritableFsBuffer, offset: int, length: int, position: int | null): int;",
            "  writeSync(fd: int, data: string, position?: int | null, encoding?: string): int;",
            "  writeSync(",
            "    fd: int,",
            "    bufferOrData: WritableFsBuffer | string,",
            "    offsetOrPosition: int | null = null,",
            "    lengthOrEncoding?: int | string,",
            "    position?: int | null",
            "  ): int {",
            '    if (typeof bufferOrData === "string") {',
            "      return this.writeSync(",
            "        fd,",
            "        bufferOrData,",
            "        offsetOrPosition,",
            '        typeof lengthOrEncoding === "string" ? lengthOrEncoding : undefined',
            "      );",
            "    }",
            "",
            "    return this.writeSync(",
            "      fd,",
            "      bufferOrData,",
            "      offsetOrPosition ?? (0 as int),",
            "      resolveWriteLength(",
            "        bufferOrData,",
            "        offsetOrPosition ?? (0 as int),",
            "        lengthOrEncoding",
            "      ),",
            "      position ?? null",
            "    );",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "FS"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const implMethod = targetClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_writeSync"
        );
        expect(implMethod).to.not.equal(undefined);
        if (!implMethod?.body) return;

        const returnCall = implMethod.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement" &&
            stmt.expression?.kind === "call"
        );
        expect(returnCall).to.not.equal(undefined);
        if (!returnCall?.expression || returnCall.expression.kind !== "call") {
          return;
        }

        const call = returnCall.expression;
        expect(call.parameterTypes?.[1]?.kind).to.equal("unionType");
        expect(call.surfaceParameterTypes?.[1]?.kind).to.equal("unionType");
        if (
          call.parameterTypes?.[1]?.kind !== "unionType" ||
          call.surfaceParameterTypes?.[1]?.kind !== "unionType"
        ) {
          return;
        }

        expect(call.parameterTypes[1].types).to.deep.equal([
          {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "number" },
            origin: "explicit",
          },
          {
            kind: "referenceType",
            name: "Buffer",
            typeArguments: undefined,
            resolvedClrType: undefined,
            typeId: {
              stableId: "TestApp:TestApp.Buffer",
              clrName: "TestApp.Buffer",
              assemblyName: "TestApp",
              tsName: "Buffer",
            },
          },
        ]);
        expect(call.surfaceParameterTypes[1].types).to.deep.equal(
          call.parameterTypes[1].types
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("specializes same-arity return-shape overloads guarded by typeof checks", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class KeyStore {",
            "  read(encoding: string): string;",
            "  read(encoding?: undefined): Uint8Array;",
            "  read(encoding?: string): string | Uint8Array {",
            '    if (typeof encoding === "string") {',
            '      return "";',
            "    }",
            "    return new Uint8Array(4);",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "KeyStore"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const methods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(methods.length).to.equal(2);

        const stringOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );
        expect(stringOverload).to.not.equal(undefined);
        if (!stringOverload?.body) return;
        expect(
          stringOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
        expect(stringOverload.body.statements[0]?.kind).to.equal(
          "blockStatement"
        );
        const stringBlock = stringOverload.body.statements[0];
        if (!stringBlock || stringBlock.kind !== "blockStatement") return;
        const stringReturn = stringBlock.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(stringReturn?.expression?.kind).to.equal("literal");
        if (stringReturn?.expression?.kind === "literal") {
          expect(stringReturn.expression.value).to.equal("");
        }

        const bytesOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "undefined"
        );
        expect(bytesOverload).to.not.equal(undefined);
        if (!bytesOverload?.body) return;
        expect(
          bytesOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
        const bytesReturn = bytesOverload.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        const bytesExpr = unwrapTransparentExpression(bytesReturn?.expression);
        expect(bytesExpr?.kind).to.equal("new");
      } finally {
        fixture.cleanup();
      }
    });

    it("folds typeof guards against omitted overload parameters to literal undefined", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Hash {",
            "  digest(encoding: string): string;",
            "  digest(): number[];",
            "  digest(outputLength: number): number[];",
            "  digest(encodingOrLength?: string | number): string | number[] {",
            '    const length = typeof encodingOrLength === "number" ? encodingOrLength : undefined;',
            '    if (typeof encodingOrLength === "string") {',
            '      return \"\";',
            "    }",
            "    return length === undefined ? [1] : [length];",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Hash"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const methods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "digest"
        );
        expect(methods.length).to.equal(3);

        const zeroArgOverload = methods.find(
          (member) => member.parameters.length === 0
        );
        expect(zeroArgOverload).to.not.equal(undefined);
        if (!zeroArgOverload?.body) return;
        expect(
          zeroArgOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
        const zeroLengthDecl = zeroArgOverload.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(zeroLengthDecl).to.not.equal(undefined);
        const zeroLengthInit = unwrapTransparentExpression(
          zeroLengthDecl?.declarations[0]?.initializer
        );
        expect(zeroLengthInit?.kind).to.equal("literal");
        if (!zeroLengthInit || zeroLengthInit.kind !== "literal") return;
        expect(zeroLengthInit.value).to.equal(undefined);

        const numberOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "number"
        );
        expect(numberOverload).to.not.equal(undefined);
        if (!numberOverload?.body) return;
        expect(
          numberOverload.body.statements.some(
            (stmt) => stmt.kind === "ifStatement"
          )
        ).to.equal(false);
        const numberLengthDecl = numberOverload.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(numberLengthDecl).to.not.equal(undefined);
        const numberLengthInit = unwrapTransparentExpression(
          numberLengthDecl?.declarations[0]?.initializer
        );
        expect(numberLengthInit?.kind).to.equal("identifier");
        if (!numberLengthInit || numberLengthInit.kind !== "identifier") return;
        expect(numberLengthInit.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("folds nullish-coalescing against omitted overload parameters to the fallback literal", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Hash {",
            "  update(data: string, inputEncoding?: string): Hash;",
            "  update(data: number[]): Hash;",
            "  update(data: string | number[], inputEncoding?: string): Hash {",
            '    const encoding = inputEncoding ?? "utf8";',
            '    if (typeof data === "string") {',
            "      void encoding;",
            "      return this;",
            "    }",
            "    const stable = encoding;",
            "    void stable;",
            "    return this;",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Hash"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const methods = targetClass.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "update"
        );
        expect(methods.length).to.equal(2);

        const arrayOverload = methods.find(
          (member) => member.parameters[0]?.type?.kind === "arrayType"
        );
        expect(arrayOverload).to.not.equal(undefined);
        if (!arrayOverload?.body) return;
        const encodingDecl = arrayOverload.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(encodingDecl).to.not.equal(undefined);
        const encodingInit = unwrapTransparentExpression(
          encodingDecl?.declarations[0]?.initializer
        );
        expect(encodingInit?.kind).to.equal("literal");
        if (!encodingInit || encodingInit.kind !== "literal") return;
        expect(encodingInit.value).to.equal("utf8");
      } finally {
        fixture.cleanup();
      }
    });

    it("folds optional-chain nullish-coalescing against omitted overload parameters to the fallback literal", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type MkdirOptions = { recursive?: boolean };",
            "",
            "export function mkdirSync(path: string): void;",
            "export function mkdirSync(path: string, options: boolean): void;",
            "export function mkdirSync(path: string, options: MkdirOptions): void;",
            "export function mkdirSync(",
            "  path: string,",
            "  options?: boolean | MkdirOptions",
            "): void {",
            '  const recursive = typeof options === "boolean" ? options : options?.recursive ?? false;',
            "  void path;",
            "  void recursive;",
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

        const mkdirFunctions = result.value.body.filter(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "mkdirSync"
        );
        expect(mkdirFunctions.length).to.equal(3);

        const zeroArgOptionsOverload = mkdirFunctions.find(
          (member) => member.parameters.length === 1
        );
        expect(zeroArgOptionsOverload).to.not.equal(undefined);
        if (!zeroArgOptionsOverload?.body) return;

        const recursiveDecl = zeroArgOptionsOverload.body.statements.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
            stmt.kind === "variableDeclaration"
        );
        expect(recursiveDecl).to.not.equal(undefined);
        const recursiveInit = unwrapTransparentExpression(
          recursiveDecl?.declarations[0]?.initializer
        );
        expect(recursiveInit?.kind).to.equal("literal");
        if (!recursiveInit || recursiveInit.kind !== "literal") return;
        expect(recursiveInit.value).to.equal(false);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers single-element Array push overloads for tuple element arrays", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Params {",
            "  entries(): [string, string][] {",
            "    const result: [string, string][] = [];",
            '    const key = "name";',
            '    const value = "value";',
            "    result.push([key, value]);",
            "    return result;",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Params"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const entriesMethod = targetClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "entries"
        );
        expect(entriesMethod).to.not.equal(undefined);
        if (!entriesMethod?.body) return;

        const pushCall = entriesMethod.body.statements
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .find(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" &&
              expr.callee.kind === "memberAccess" &&
              expr.callee.property === "push"
          );

        expect(pushCall).to.not.equal(undefined);
        if (!pushCall) return;

        const firstParameterType = pushCall.parameterTypes?.[0];
        expect(firstParameterType?.kind).to.equal("tupleType");
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers single-element Array push overloads for object-literal element arrays", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RouteLayer = {",
            "  path: string;",
            "  method: string | undefined;",
            "  middleware: boolean;",
            "  handlers: string[];",
            "};",
            "",
            "export class Router {",
            "  layers: RouteLayer[] = [];",
            "  add(path: string, method: string | undefined, handlers: string[]): void {",
            "    this.layers.push({ path, method, middleware: false, handlers });",
            "  }",
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

        const targetClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Router"
        );
        expect(targetClass).to.not.equal(undefined);
        if (!targetClass) return;

        const addMethod = targetClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "add"
        );
        expect(addMethod).to.not.equal(undefined);
        if (!addMethod?.body) return;

        const pushCall = addMethod.body.statements
          .filter(
            (
              stmt
            ): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
              stmt.kind === "expressionStatement"
          )
          .map((stmt) => stmt.expression)
          .find(
            (expr): expr is Extract<typeof expr, { kind: "call" }> =>
              expr.kind === "call" &&
              expr.callee.kind === "memberAccess" &&
              expr.callee.property === "push"
          );

        expect(pushCall).to.not.equal(undefined);
        if (!pushCall) return;

        const firstParameterType = pushCall.parameterTypes?.[0];
        expect(firstParameterType?.kind).to.equal("referenceType");
        if (firstParameterType?.kind !== "referenceType") return;
        expect(firstParameterType.name).to.equal("RouteLayer");
        expect(
          firstParameterType.structuralMembers?.some(
            (member) => member.name === "path"
          )
        ).to.equal(true);
        expect(
          firstParameterType.structuralMembers?.some(
            (member) => member.name === "handlers"
          )
        ).to.equal(true);
      } finally {
        fixture.cleanup();
      }
    });

    it("distinguishes static and instance overload families with different stable ids", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Parser {",
            "  static parse(text: string): string;",
            "  static parse(text: number): string;",
            "  static parse(text: string | number): string {",
            "    return String(text);",
            "  }",
            "",
            "  parse(text: string): string;",
            "  parse(text: number): string;",
            "  parse(text: string | number): string {",
            "    return String(text);",
            "  }",
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

        const parserClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Parser"
        );
        expect(parserClass).to.not.equal(undefined);
        if (!parserClass) return;

        const staticParse = parserClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "parse" &&
            member.isStatic &&
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );
        const instanceParse = parserClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "parse" &&
            !member.isStatic &&
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "string"
        );

        expect(staticParse?.overloadFamily?.familyId).to.equal(
          "method:static:parse"
        );
        expect(staticParse?.overloadFamily?.isStatic).to.equal(true);
        expect(instanceParse?.overloadFamily?.familyId).to.equal(
          "method:instance:parse"
        );
        expect(instanceParse?.overloadFamily?.isStatic).to.equal(false);
        expect(staticParse?.overloadFamily?.familyId).to.not.equal(
          instanceParse?.overloadFamily?.familyId
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("specializes method union-return overloads directly when omitted parameters fold away", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare class Buffer {",
            "  readonly length: number;",
            "}",
            "",
            "declare function implBytes(path: string): Buffer;",
            "declare function implText(path: string, encoding: string): string;",
            "",
            "export class FsModule {",
            "  readFileSync(path: string): Buffer;",
            "  readFileSync(path: string, encoding: string): string;",
            "  readFileSync(path: string, encoding?: string): string | Buffer {",
            "    if (encoding === undefined) {",
            "      return implBytes(path);",
            "    }",
            "    return implText(path, encoding);",
            "  }",
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

        const fsModule = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "FsModule"
        );
        expect(fsModule).to.not.equal(undefined);
        if (!fsModule) return;

        const readFileSyncMethods = fsModule.members.filter(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "readFileSync"
        );
        expect(readFileSyncMethods).to.have.length(2);

        const helper = fsModule.members.find(
          (member) =>
            member.kind === "methodDeclaration" &&
            member.name === "__tsonic_overload_impl_readFileSync"
        );
        expect(helper).to.equal(undefined);

        const bytesOverload = readFileSyncMethods.find(
          (member) => member.parameters.length === 1
        );
        expect(bytesOverload?.returnType?.kind).to.equal("referenceType");
        if (bytesOverload?.returnType?.kind !== "referenceType") return;
        expect(bytesOverload.returnType.name).to.equal("Buffer");
        expect(bytesOverload.overloadFamily?.implementationName).to.equal(
          undefined
        );

        const textOverload = readFileSyncMethods.find(
          (member) => member.parameters.length === 2
        );
        expect(textOverload?.returnType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(textOverload?.overloadFamily?.implementationName).to.equal(
          undefined
        );
      } finally {
        fixture.cleanup();
      }
    });
  });
});
