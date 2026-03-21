/**
 * IR Builder tests: Conditional expression narrowing and logical operator narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrReturnStatement,
  IrVariableDeclaration,
} from "../types.js";
import { stableIrTypeKey } from "../types/type-ops.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – conditional narrowing", () => {
    it("applies predicate-based branch narrowing inside conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type RequestHandler = (value: string) => void;",
            "type PathSpec = string | RegExp | readonly PathSpec[] | null | undefined;",
            "type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];",
            "class Router {}",
            "function isPathSpec(value: PathSpec | MiddlewareLike): value is PathSpec {",
            '  return value == null || typeof value === "string" || value instanceof RegExp || Array.isArray(value);',
            "}",
            "export function collect(first: PathSpec | MiddlewareLike, rest: readonly MiddlewareLike[]): readonly MiddlewareLike[] {",
            "  const values = isPathSpec(first) ? rest : [first, ...rest];",
            "  return values;",
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

        const collectFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "collect"
        );
        expect(collectFn).to.not.equal(undefined);
        if (!collectFn) return;

        const valuesDecl = collectFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "values"
            )
        );
        expect(valuesDecl).to.not.equal(undefined);
        if (!valuesDecl) return;

        const valuesInit = valuesDecl.declarations[0]?.initializer;
        expect(valuesInit?.kind).to.equal("conditional");
        if (!valuesInit || valuesInit.kind !== "conditional") return;

        expect(valuesInit.whenFalse.kind).to.equal("array");
        if (valuesInit.whenFalse.kind !== "array") return;

        const firstElement = valuesInit.whenFalse.elements[0];
        expect(firstElement?.kind).to.equal("typeAssertion");
        if (!firstElement || firstElement.kind !== "typeAssertion") return;

        expect(firstElement.expression.inferredType?.kind).to.equal(
          "unionType"
        );

        const narrowedType = firstElement.targetType;
        expect(narrowedType?.kind).to.equal("referenceType");
        if (!narrowedType) return;
        expect(stableIrTypeKey(narrowedType)).to.include("MiddlewareLike");
      } finally {
        fixture.cleanup();
      }
    });

    it("applies typeof-function narrowing inside conditional expressions through aliases", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Callback = (error: unknown, html: string) => void;",
            "export function pick(",
            "  value: Record<string, unknown> | Callback | undefined,",
            "  fallback: Callback | undefined",
            "): Callback | undefined {",
            '  return typeof value === "function" ? value : fallback;',
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

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const returnStmt = pickFn.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("conditional");
        if (
          !returnStmt?.expression ||
          returnStmt.expression.kind !== "conditional"
        ) {
          return;
        }

        expect(returnStmt.expression.whenTrue.inferredType?.kind).to.equal(
          "functionType"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("applies typeof-function and undefined disjunction narrowing inside conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Callback = (error: unknown, html: string) => void;",
            "export function pick(",
            "  value: Record<string, unknown> | Callback | undefined,",
            "  fallback: Record<string, unknown>",
            "): Record<string, unknown> {",
            '  return typeof value === "function" || value === undefined ? fallback : value;',
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

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const returnStmt = pickFn.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("conditional");
        if (
          !returnStmt?.expression ||
          returnStmt.expression.kind !== "conditional"
        ) {
          return;
        }

        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "dictionaryType"
        );
        if (returnStmt.expression.inferredType?.kind !== "dictionaryType") {
          return;
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers the assignable common nominal supertype for conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class TemplateValue {}",
            "class PageValue extends TemplateValue {",
            "  constructor(public readonly slug: string) {",
            "    super();",
            "  }",
            "}",
            "declare function resolve(): TemplateValue;",
            "export function pick(flag: boolean): TemplateValue {",
            '  const actual = flag ? new PageValue("home") : resolve();',
            "  return actual;",
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

        const pickFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(pickFn).to.not.equal(undefined);
        if (!pickFn) return;

        const actualDecl = pickFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "actual"
            )
        );
        expect(actualDecl).to.not.equal(undefined);
        if (!actualDecl) return;

        const actualInit = actualDecl.declarations[0]?.initializer;
        expect(actualInit?.kind).to.equal("conditional");
        if (!actualInit || actualInit.kind !== "conditional") return;

        expect(actualInit.inferredType?.kind).to.equal("referenceType");
        if (
          !actualInit.inferredType ||
          actualInit.inferredType.kind !== "referenceType"
        ) {
          return;
        }
        expect(stableIrTypeKey(actualInit.inferredType)).to.include(
          "TemplateValue"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("applies sequential falsy narrowing for || inside class-method conditional locals", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Callback = (error: unknown, html: string) => void;",
            "export class App {",
            "  readonly locals: Record<string, unknown> = {};",
            "  pick(value?: Record<string, unknown> | Callback) {",
            '    const locals = typeof value === "function" || value === undefined ? this.locals : value;',
            "    return locals;",
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
            stmt.kind === "classDeclaration" && stmt.name === "App"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const pickMethod = appClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "pick"
        );
        expect(pickMethod).to.not.equal(undefined);
        if (!pickMethod || !pickMethod.body) return;

        const localsDecl = pickMethod.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "locals"
            )
        );
        expect(localsDecl).to.not.equal(undefined);
        if (!localsDecl) return;

        const decl = localsDecl.declarations.find(
          (candidate) =>
            candidate.name.kind === "identifierPattern" &&
            candidate.name.name === "locals"
        );
        expect(decl?.initializer?.kind).to.equal("conditional");
        if (!decl?.initializer || decl.initializer.kind !== "conditional") {
          return;
        }

        expect(decl.initializer.inferredType?.kind).to.equal("dictionaryType");
        expect(decl.initializer.whenFalse.inferredType?.kind).to.equal(
          "dictionaryType"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("applies sequential truthy narrowing for && inside class-method conditional locals", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type Callback = (error: unknown, html: string) => void;",
            "export class App {",
            "  readonly locals: Record<string, unknown> = {};",
            "  pick(value?: Record<string, unknown> | Callback) {",
            '    const locals = typeof value !== "function" && value !== undefined ? value : this.locals;',
            "    return locals;",
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
            stmt.kind === "classDeclaration" && stmt.name === "App"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const pickMethod = appClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "pick"
        );
        expect(pickMethod).to.not.equal(undefined);
        if (!pickMethod || !pickMethod.body) return;

        const localsDecl = pickMethod.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "locals"
            )
        );
        expect(localsDecl).to.not.equal(undefined);
        if (!localsDecl) return;

        const decl = localsDecl.declarations.find(
          (candidate) =>
            candidate.name.kind === "identifierPattern" &&
            candidate.name.name === "locals"
        );
        expect(decl?.initializer?.kind).to.equal("conditional");
        if (!decl?.initializer || decl.initializer.kind !== "conditional") {
          return;
        }

        expect(decl.initializer.inferredType?.kind).to.equal("dictionaryType");
        expect(decl.initializer.whenTrue.inferredType?.kind).to.equal(
          "dictionaryType"
        );
      } finally {
        fixture.cleanup();
      }
    });

    it("applies optional-chain typeof narrowing on && rhs property access paths", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "type CookieOptions = { sameSite?: string | boolean };",
            "export function collect(options?: CookieOptions): string[] {",
            "  const parts: string[] = [];",
            '  if (typeof options?.sameSite === "string" && options.sameSite.length > 0) {',
            "    parts.push(options.sameSite);",
            "  }",
            "  return parts;",
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

        const collectFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "collect"
        );
        expect(collectFn).to.not.equal(undefined);
        if (!collectFn) return;

        const ifStmt = collectFn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt?.condition.kind).to.equal("logical");
        if (!ifStmt || ifStmt.condition.kind !== "logical") return;

        expect(ifStmt.condition.right.kind).to.equal("binary");
        if (ifStmt.condition.right.kind !== "binary") return;

        const access = ifStmt.condition.right.left;
        expect(access.kind).to.equal("memberAccess");
        if (access.kind !== "memberAccess") return;

        expect(access.object.inferredType?.kind).to.equal("primitiveType");
        if (access.object.inferredType?.kind !== "primitiveType") return;
        expect(access.object.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });
  });
});
