/**
 * Tests for global binding preference ordering in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  createTestProgram,
  createTestDeclId,
  resolveHierarchicalBinding,
  BindingRegistry,
} from "./helpers.js";
import type { IrIdentifierExpression } from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("Global Identifier Resolution — Binding Preferences", () => {
    it("prefers resolved global member owners over polluted ambient identifier types", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings(
        "/test/js.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../js/versions/10/index/bindings.json"
            ),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/system.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../dotnet/versions/10/System/bindings.json"
            ),
            "utf-8"
          )
        )
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "console",
          inferredType: { kind: "referenceType", name: "Console" },
          resolvedClrType: "Tsonic.JSRuntime.console",
          resolvedAssembly: "Tsonic.JSRuntime",
        } satisfies IrIdentifierExpression,
        "error",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.console",
        member: "error",
      });
    });

    it("prefers simple-binding static owners over resolved runtime generic owners for static members", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings(
        "/test/js-simple.json",
        JSON.parse(
          readFileSync(
            resolvePath(process.cwd(), "../../../js/versions/10/bindings.json"),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/js-index.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../js/versions/10/index/bindings.json"
            ),
            "utf-8"
          )
        )
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "Array",
          inferredType: { kind: "referenceType", name: "Array" },
          resolvedClrType: "Tsonic.JSRuntime.JSArray`1",
          resolvedAssembly: "Tsonic.JSRuntime",
        } satisfies IrIdentifierExpression,
        "isArray",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.JSArrayStatics",
        member: "isArray",
      });
    });

    it("still prefers simple-binding static owners for ambient globals with declarations", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings(
        "/test/js-simple.json",
        JSON.parse(
          readFileSync(
            resolvePath(process.cwd(), "../../../js/versions/10/bindings.json"),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/js-index.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../js/versions/10/index/bindings.json"
            ),
            "utf-8"
          )
        )
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "Array",
          declId: createTestDeclId(1),
          inferredType: { kind: "referenceType", name: "Array" },
          resolvedClrType: "Tsonic.JSRuntime.JSArray`1",
          resolvedAssembly: "Tsonic.JSRuntime",
        } satisfies IrIdentifierExpression,
        "from",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.JSArrayStatics",
        member: "from",
      });
    });

    it("prefers simple-binding runtime owners for ambient globals without resolved CLR owners", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings(
        "/test/js-simple.json",
        JSON.parse(
          readFileSync(
            resolvePath(process.cwd(), "../../../js/versions/10/bindings.json"),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/js-index.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../js/versions/10/index/bindings.json"
            ),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/system.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../dotnet/versions/10/System/bindings.json"
            ),
            "utf-8"
          )
        )
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "console",
          declId: createTestDeclId(2),
          inferredType: { kind: "referenceType", name: "Console" },
        } satisfies IrIdentifierExpression,
        "error",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Tsonic.JSRuntime",
        type: "Tsonic.JSRuntime.console",
        member: "error",
      });
    });

    it("does not misbind lowercase local CLR variables to unrelated global member owners", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings(
        "/test/nodejs.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../nodejs/versions/10/index/bindings.json"
            ),
            "utf-8"
          )
        )
      );
      bindings.addBindings(
        "/test/system-diagnostics.json",
        JSON.parse(
          readFileSync(
            resolvePath(
              process.cwd(),
              "../../../dotnet/versions/10/System.Diagnostics/bindings.json"
            ),
            "utf-8"
          )
        )
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "process",
          declId: createTestDeclId(3),
          inferredType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "undefined" },
              { kind: "referenceType", name: "Process" },
            ],
          },
        } satisfies IrIdentifierExpression,
        "ExitCode",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "property",
        assembly: "System.Diagnostics.Process",
        type: "System.Diagnostics.Process",
        member: "ExitCode",
      });
    });
  });
});
