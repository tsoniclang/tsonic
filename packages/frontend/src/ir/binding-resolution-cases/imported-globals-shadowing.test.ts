import { describe, it } from "mocha";
import { expect } from "chai";
import type { TstsSourceFile } from "@tsonic/tsts";
import { buildIrModule } from "../builder.js";
import { createProgramContext } from "../program-context.js";
import { BindingRegistry } from "../../program/bindings.js";
import type { IrIdentifierExpression, IrModule } from "../types.js";
import { createTstsTestProgramFromFiles } from "../../testing/tsts-test-program.js";

const minimalLib = `
  interface Function {}
  interface Object {}
  interface String {}
  interface Boolean {}
  interface Number {}
  interface IArguments {}
  interface Array<T> { length: number; [n: number]: T; }
  type PropertyKey = string | number | symbol;
`;

const createGlobalBindings = (): BindingRegistry => {
  const bindings = new BindingRegistry();
  bindings.addBindings("/test/runtime.json", {
    schema: "tsonic.bindings",
    provider: { namespace: "sourceSurface" },
    sourceSurface: {
      bindings: {
        console: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.console",
        },
      },
    },
    targetSurface: { types: [] },
  });
  return bindings;
};

const addAmbientBindings = (bindings: BindingRegistry): void => {
  bindings.addBindings("/test/runtime-ambient.json", {
    schema: "tsonic.bindings",
    provider: { namespace: "sourceSurface" },
    sourceSurface: {
      bindings: {
        Uint8Array: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.Uint8Array",
          staticType: "js.Uint8Array",
          typeSemantics: { contributesTypeIdentity: true },
        },
        parseInt: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.Globals",
          providerMemberName: "Globals.parseInt",
        },
        String: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.String",
          staticType: "js.String",
          providerMemberName: "Globals.String",
          typeSemantics: { contributesTypeIdentity: true },
        },
        Error: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.Error",
          typeSemantics: { contributesTypeIdentity: true },
        },
        RangeError: {
          kind: "global",
          ownerIdentity: "js",
          type: "js.RangeError",
          typeSemantics: { contributesTypeIdentity: true },
        },
      },
    },
    targetSurface: { types: [] },
  });
};

const buildModule = (
  files: Readonly<Record<string, string>>,
  bindings: BindingRegistry
): { readonly module: IrModule; readonly sourceFile: TstsSourceFile } => {
  const testProgram = createTstsTestProgramFromFiles(files, "main.ts", {
    bindings,
  });
  const options = {
    sourceRoot: testProgram.options.sourceRoot,
    rootNamespace: "TestApp",
  };
  const ctx = createProgramContext(testProgram, options);
  const result = buildIrModule(
    testProgram.sourceFile,
    testProgram,
    options,
    ctx
  );
  expect(result.ok).to.equal(true);
  if (!result.ok) {
    throw new Error(`IR build failed: ${JSON.stringify(result.error)}`);
  }
  return { module: result.value, sourceFile: testProgram.sourceFile };
};

const firstConsoleMemberAccess = (module: IrModule) => {
  const funcDecl = module.body[0];
  expect(funcDecl?.kind).to.equal("functionDeclaration");
  if (!funcDecl || funcDecl.kind !== "functionDeclaration") return undefined;

  const exprStmt = funcDecl.body.statements[0];
  expect(exprStmt?.kind).to.equal("expressionStatement");
  if (!exprStmt || exprStmt.kind !== "expressionStatement") return undefined;

  const callExpr = exprStmt.expression;
  expect(callExpr.kind).to.equal("call");
  if (callExpr.kind !== "call") return undefined;

  const memberExpr = callExpr.callee;
  expect(memberExpr.kind).to.equal("memberAccess");
  return memberExpr.kind === "memberAccess" ? memberExpr : undefined;
};

const collectIdentifiers = (module: IrModule): IrIdentifierExpression[] => {
  const identifiers: IrIdentifierExpression[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== "object") return;

    const candidate = value as Record<string, unknown>;
    if (candidate.kind === "identifier") {
      identifiers.push(candidate as unknown as IrIdentifierExpression);
    }

    for (const child of Object.values(candidate)) {
      visit(child);
    }
  };
  visit(module);
  return identifiers;
};

const ambientSource = `
  export function test(value: unknown): void {
    const bytes = new Uint8Array(4);
    const parsed = parseInt("42", 10);
    if (parsed > 100) {
      throw new RangeError("too large");
    }

    try {
      throw new Error("bad");
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(value));
    }
  }
`;

const ambientDeclarations = `
  declare class Error {
    constructor(message?: string);
  }

  declare class RangeError extends Error {
    constructor(message?: string);
  }

  declare class Uint8Array {
    constructor(length: number);
    readonly length: number;
    [n: number]: number;
  }

  declare const String: {
    (value: unknown): string;
  };

  declare function parseInt(value: string, radix?: number): number;
`;

describe("Binding Resolution in IR", () => {
  describe("Imported globals shadowing", () => {
    it("does not let global bindings override imported values with the same name", () => {
      const { module } = buildModule(
        {
          "main.ts": `
            import { console } from "./console.ts";

            export function test(): void {
              console.dirxml("test", 123, {});
            }
          `,
          "console.ts": `
            export const console = {
              dirxml(..._data: unknown[]): void {}
            };
          `,
          "lib.d.ts": minimalLib,
        },
        createGlobalBindings()
      );

      const memberExpr = firstConsoleMemberAccess(module);
      if (!memberExpr) return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.providerQualifiedName).to.equal(undefined);
      expect(consoleExpr.providerOwnerIdentity).to.equal(undefined);
      expect(consoleExpr.declId).to.not.equal(undefined);
      expect(memberExpr.memberBinding).to.equal(undefined);
    });

    it("does not treat imported declaration-module values as ambient globals", () => {
      const { module } = buildModule(
        {
          "main.ts": `
            import { console } from "./console.js";

            export function test(): void {
              console.dirxml("test", 123, {});
            }
          `,
          "console.d.ts": `
            export declare const console: {
              dirxml(..._data: unknown[]): void;
            };
          `,
          "lib.d.ts": minimalLib,
        },
        createGlobalBindings()
      );

      const memberExpr = firstConsoleMemberAccess(module);
      if (!memberExpr) return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.providerQualifiedName).to.equal(undefined);
      expect(consoleExpr.providerOwnerIdentity).to.equal(undefined);
      expect(consoleExpr.declId).to.not.equal(undefined);
      expect(memberExpr.memberBinding).to.equal(undefined);
    });

    it("still applies global bindings to ambient declaration-file globals", () => {
      const bindings = createGlobalBindings();
      addAmbientBindings(bindings);
      const { module } = buildModule(
        {
          "main.ts": ambientSource,
          "lib.d.ts": `${minimalLib}\n${ambientDeclarations}`,
        },
        bindings
      );

      const identifiers = collectIdentifiers(module);
      const expectBoundIdentifier = (
        name: string,
        expectedType: string,
        expectedMemberName?: string
      ): void => {
        const matches = identifiers.filter(
          (identifier) => identifier.name === name
        );
        expect(
          matches.length,
          `expected identifier '${name}' in IR`
        ).to.be.greaterThan(0);
        expect(
          matches.some(
            (identifier) =>
              identifier.declId !== undefined &&
              identifier.providerOwnerIdentity === "js" &&
              identifier.providerQualifiedName === expectedType &&
              (expectedMemberName === undefined ||
                identifier.providerMemberName === expectedMemberName)
          ),
          `expected bound ambient global '${name}'`
        ).to.equal(true);
      };

      expectBoundIdentifier("Uint8Array", "js.Uint8Array");
      expectBoundIdentifier("parseInt", "js.Globals", "Globals.parseInt");
      expectBoundIdentifier("String", "js.String", "Globals.String");
      expectBoundIdentifier("Error", "js.Error");
      expectBoundIdentifier("RangeError", "js.RangeError");
    });

    it("still applies global bindings to external-module declare-global augmentations", () => {
      const bindings = createGlobalBindings();
      addAmbientBindings(bindings);
      const { module } = buildModule(
        {
          "main.ts": ambientSource,
          "lib.d.ts": `
            export {};

            declare global {
              ${minimalLib}
              ${ambientDeclarations}
            }
          `,
        },
        bindings
      );

      const identifiers = collectIdentifiers(module);
      const expectBoundIdentifier = (
        name: string,
        expectedType: string,
        expectedMemberName?: string
      ): void => {
        const matches = identifiers.filter(
          (identifier) => identifier.name === name
        );
        expect(
          matches.length,
          `expected identifier '${name}' in IR`
        ).to.be.greaterThan(0);
        expect(
          matches.some(
            (identifier) =>
              identifier.declId !== undefined &&
              identifier.providerOwnerIdentity === "js" &&
              identifier.providerQualifiedName === expectedType &&
              (expectedMemberName === undefined ||
                identifier.providerMemberName === expectedMemberName)
          ),
          `expected bound declare-global ambient '${name}'`
        ).to.equal(true);
      };

      expectBoundIdentifier("Uint8Array", "js.Uint8Array");
      expectBoundIdentifier("parseInt", "js.Globals", "Globals.parseInt");
      expectBoundIdentifier("String", "js.String", "Globals.String");
      expectBoundIdentifier("Error", "js.Error");
      expectBoundIdentifier("RangeError", "js.RangeError");
    });
  });
});
