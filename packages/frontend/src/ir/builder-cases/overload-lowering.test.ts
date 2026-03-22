/**
 * IR Builder tests: Overload lowering and push overloads
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrClassDeclaration, IrMethodDeclaration } from "../types.js";
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

    it("specializes identifier inferred types inside void overload bodies", () => {
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
        const stringIf = stringOverload.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
            stmt.kind === "ifStatement"
        );
        expect(stringIf).to.not.equal(undefined);
        if (
          !stringIf ||
          stringIf.condition.kind !== "binary" ||
          stringIf.condition.left.kind !== "unary" ||
          stringIf.condition.left.expression.kind !== "identifier"
        ) {
          return;
        }
        expect(stringIf.condition.left.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });

        const numberOverload = methods.find(
          (member) =>
            member.parameters[0]?.type?.kind === "primitiveType" &&
            member.parameters[0].type.name === "number"
        );
        expect(numberOverload).to.not.equal(undefined);
        if (!numberOverload?.body) return;

        const numberIf = numberOverload.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
            stmt.kind === "ifStatement"
        );
        expect(numberIf).to.not.equal(undefined);
        if (
          !numberIf ||
          numberIf.condition.kind !== "binary" ||
          numberIf.condition.left.kind !== "unary" ||
          numberIf.condition.left.expression.kind !== "identifier"
        ) {
          return;
        }
        expect(numberIf.condition.left.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });

        const declaration = numberOverload.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "variableDeclaration" }> =>
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

    it("prefers single-element JSArray push overloads for tuple element arrays", () => {
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

    it("prefers single-element JSArray push overloads for object-literal element arrays", () => {
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
  });
});
