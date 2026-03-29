import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Arrow Field Delegates", () => {
    it("should emit Action for static void arrow fields (never Func<void>)", () => {
      const source = `
        export const noop: () => void = () => {};
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /public\s+static\s+readonly\s+global::System\.Action\s+noop\s*=/
      );
      expect(csharp).not.to.match(/global::System\.Func\s*<\s*void\s*>/);
    });

    it("synthesizes ignored trailing required delegate parameters for contextual zero-arg lambdas", () => {
      const source = `
        type Next = (value: string) => void;

        function consume(next: Next): void {
          next("ok");
        }

        export function main(): void {
          consume(() => undefined);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /consume\(\(string __unused_value\)\s*=>\s*\{\s*\}\)/
      );
    });

    it("synthesizes ignored trailing optional delegate parameters while preserving declared lambda parameters", () => {
      const source = `
        type Mapper = (value: string, index?: number) => string;

        function apply(mapper: Mapper): void {
          mapper("ok", 1);
        }

        export function main(): void {
          apply((value) => value);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /apply\(\(string value,\s*double\? __unused_index\)\s*=>/
      );
    });

    it("uses the selected overload arity for function-value callback arguments", () => {
      const source = `
        function trimValue(value: string): string {
          return value.trim();
        }

        export function main(items: string[]): string[] {
          return items.map(trimValue);
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(".map(trimValue)");
      expect(csharp).to.not.include("__unused_index");
      expect(csharp).to.not.include("__unused_array");
    });

    it("keeps explicit lambda parameters at the selected overload arity", () => {
      const source = `
        export function main(items: string[]): string[] {
          return items.map((value) => value.trim());
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(".map((string value) =>");
      expect(csharp).to.not.include("__unused_index");
      expect(csharp).to.not.include("__unused_array");
      expect(csharp).to.include("global::js.String.trim");
    });

    it("lowers rest-only contextual callbacks through a synthesized rest carrier", () => {
      const source = `
        type Tick = (...args: unknown[]) => void;

        function consume(tick: Tick): void {
          tick("ok", 1);
        }

        export function main(): void {
          consume(() => undefined);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(/consume\(\(object\?\[\] __unused_args\)\s*=>/);
    });

    it("preserves fixed contextual parameters and synthesizes a rest carrier after them", () => {
      const source = `
        type Tick = (value: string, ...rest: unknown[]) => void;

        function consume(tick: Tick): void {
          tick("ok", 1);
        }

        export function main(): void {
          consume(() => undefined);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /consume\(\(string __unused_value,\s*object\?\[\] __unused_rest\)\s*=>/
      );
    });

    it("synthesizes contextual parameters for zero-arg lambdas passed through rest callback parameters", () => {
      const source = `
        type Handler = (req: string) => void;

        function consume(...handlers: Handler[]): void {
          const first = handlers[0]!;
          first("ok");
        }

        export function main(): void {
          consume(() => undefined);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /consume\(\(string __unused_req\)\s*=>\s*\{\s*\}\)/
      );
    });

    it("binds explicit lambda parameters from synthesized rest carriers", () => {
      const source = `
        type Tick = (...args: unknown[]) => void;

        function consume(tick: Tick): void {
          tick("ok", 1, true);
        }

        export function main(): void {
          consume((first, second, third) => {
            void first;
            void second;
            void third;
          });
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /consume\(\(object\?\[\] __unused_args\)\s*=>\s*\{/
      );
      expect(csharp).to.match(/first = __unused_args\[0\]/);
      expect(csharp).to.match(/second = __unused_args\[1\]/);
      expect(csharp).to.match(/third = __unused_args\[2\]/);
    });

    it("lowers expression-bodied undefined callbacks for void contextual delegates without void casts", () => {
      const source = `
        type Tick = (...args: unknown[]) => void;

        function consume(tick: Tick): void {
          tick("ok");
        }

        export function main(): void {
          consume(() => undefined);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.not.include("(void)default");
      expect(csharp).to.match(
        /consume\(\(object\?\[\] __unused_args\)\s*=>\s*\{\s*\}\)/
      );
    });

    it("emits static arrow fields with params delegates for rest parameters", () => {
      const source = `
        export const tick = (...args: unknown[]): void => {
          void args;
        };

        export function main(): void {
          tick();
          tick("ok", 1, true);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /delegate\s+void\s+tick__Delegate\s*\(\s*params\s+object\?\[\]\s+args\s*\)/
      );
      expect(csharp).to.match(
        /private\s+static\s+void\s+tick__Impl\s*\(\s*params\s+object\?\[\]\s+args\s*\)/
      );
      expect(csharp).to.match(
        /tick\((?:new object\?\[0\]|new object\?\[\])\);/
      );
      expect(csharp).to.match(/tick\(new object\?\[\] \{ "ok", 1, true \}\);/);
    });

    it("emits static arrow fields with default parameter initializers through custom delegates", () => {
      const source = `
        export const formatLabel = (label: string = "default"): string => label;
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /delegate\s+string\s+formatLabel__Delegate\s*\(\s*string\s+label\s*=\s*"default"\s*\)/
      );
      expect(csharp).to.match(
        /private\s+static\s+string\s+formatLabel__Impl\s*\(\s*string\s+label\s*=\s*"default"\s*\)/
      );
      expect(csharp).to.not.include(
        "ICE: Arrow function values with default parameter initializers are not supported"
      );
    });

    it("omits non-constant defaults from static arrow signatures and synthesizes omitted call arguments", () => {
      const source = `
        export const formatLabel = (
          parts: readonly string[] = []
        ): string => parts.length === 0 ? "empty" : parts[0];

        export function run(): string {
          return formatLabel();
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.not.match(
        /formatLabel__Delegate\s*\([^)]*=\s*(?:global::System\.Array\.Empty|new\s+string)/
      );
      expect(csharp).to.not.match(
        /formatLabel__Impl\s*\([^)]*=\s*(?:global::System\.Array\.Empty|new\s+string)/
      );
      expect(csharp).to.match(
        /return formatLabel\((?:global::System\.Array\.Empty<string>\(\)|new string\[\] \{ \}|new string\[0\])\);/
      );
    });
  });

  describe("Narrowed Member Truthiness", () => {
    it("uses narrowed member property types in boolean contexts after instanceof", () => {
      const source = `
        class TemplateValue {}
        class BoolValue extends TemplateValue {
          constructor(readonly value: boolean) { super(); }
        }
        class StringValue extends TemplateValue {
          constructor(readonly value: string) { super(); }
        }

        export function render(value: TemplateValue): string {
          if (value instanceof BoolValue) {
            return value.value ? "true" : "false";
          }
          if (value instanceof StringValue) {
            return value.value ? value.value : "";
          }
          return "";
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include('return value__is_1.value ? "true" : "false";');
      expect(csharp).to.not.include("__tsonic_truthy_");
      expect(csharp).to.satisfy((code: string) => {
        return (
          code.includes(
            'return (!string.IsNullOrEmpty(value__is_2.value)) ? value__is_2.value : "";'
          ) ||
          code.includes(
            'return value__is_2.value != "" ? value__is_2.value : "";'
          )
        );
      });
    });

    it("preserves narrowed receiver aliases for member writes after instanceof", () => {
      const source = `
        class Router {}
        class Application extends Router {
          mountpath: string | string[] = "/";
        }

        export function render(candidate: Router): string | string[] {
          if (candidate instanceof Application) {
            candidate.mountpath = "/app";
            return candidate.mountpath;
          }
          return "/";
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include(
        "if (candidate is Application candidate__is_1)"
      );
      expect(csharp).to.include("candidate__is_1.mountpath =");
      expect(csharp).to.include(
        "return global::Tsonic.Runtime.Union<string[], string>.From2(candidate__is_1.mountpath);"
      );
      expect(csharp).to.not.include("candidate.mountpath =");
    });
  });

  describe("Generic Functions", () => {
    it("should compile generic identity function to C#", () => {
      const source = `
        export function identity<T>(value: T): T {
          return value;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic function signature
      expect(csharp).to.match(/public\s+static\s+T\s+identity\s*<T>/);
      expect(csharp).to.include("(T value)");
      expect(csharp).to.include("return value;");
    });

    it("should compile generic function with type alias constraint", () => {
      const source = `
        type HasId = { id: number };

        export function getId<T extends HasId>(obj: T): number {
          return obj.id;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit type alias as class
      expect(csharp).to.include("class HasId__Alias");
      expect(csharp).to.match(/required\s+double\s+id\s*\{\s*get;\s*set;/);

      // Should use type alias as constraint
      expect(csharp).to.include("where T : HasId");

      // Should have function
      expect(csharp).to.match(/public\s+static\s+double\s+getId<T>/);
    });

    it("should not emit invalid C# constraints for primitive-like TS constraints", () => {
      const source = `
        export interface User {
          name: string;
          age: number;
        }

        export type UserKey = keyof User;
        export type UserValue<K extends UserKey> = User[K];
        export type RoutePath<T extends string> = \`/api/\${T}\`;
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.not.match(/where\s+\w+\s*:\s*string/);
      expect(csharp).to.not.include("where K : string");
      expect(csharp).to.not.include("where T : string");
    });

    it("emits numeric generic constraints and numeric return adaptation for extends number", () => {
      const source = `
        export function numericIdentity<T extends number>(value: T): number {
          return value;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(/public\s+static\s+double\s+numericIdentity<T>\s*\(T value\)/);
      expect(csharp).to.include(
        "where T : global::System.Numerics.INumber<T>"
      );
      expect(csharp).to.include(
        "return global::System.Double.CreateChecked(value);"
      );
    });
  });

  describe("Interfaces and Type Aliases", () => {
    it("should compile interface to C# class", () => {
      const source = `
        export interface User {
          id: number;
          name: string;
          email?: string;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit C# class (not interface)
      expect(csharp).to.match(/public\s+class\s+User/);
      expect(csharp).not.to.include("interface User");

      // Should have auto-properties (required for non-optional)
      expect(csharp).to.match(
        /public\s+required\s+double\s+id\s*\{\s*get;\s*set;/
      );
      expect(csharp).to.match(
        /public\s+required\s+string\s+name\s*\{\s*get;\s*set;/
      );

      // Optional property should be nullable
      expect(csharp).to.match(/public\s+string\?\s+email\s*\{\s*get;\s*set;/);
      expect(csharp).to.match(
        /\[global::System\.Diagnostics\.CodeAnalysis\.SetsRequiredMembersAttribute\]\s*public\s+User\s*\(\s*\)/
      );
    });

    it("should compile structural type alias to sealed class", () => {
      const source = `
        export type Point = {
          x: number;
          y: number;
        };
      `;

      const csharp = compileToCSharp(source);

      // Should emit sealed class with __Alias suffix
      expect(csharp).to.match(/public\s+sealed\s+class\s+Point__Alias/);
      expect(csharp).to.match(
        /public\s+required\s+double\s+x\s*\{\s*get;\s*set;/
      );
      expect(csharp).to.match(
        /public\s+required\s+double\s+y\s*\{\s*get;\s*set;/
      );
      expect(csharp).to.match(
        /\[global::System\.Diagnostics\.CodeAnalysis\.SetsRequiredMembersAttribute\]\s*public\s+Point__Alias\s*\(\s*\)/
      );
    });

    it("should compile generic interface", () => {
      const source = `
        export interface Result<T> {
          ok: boolean;
          value: T;
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic class
      expect(csharp).to.match(/public\s+class\s+Result\s*<T>/);
      expect(csharp).to.match(/public\s+required\s+bool\s+ok/);
      expect(csharp).to.match(/public\s+required\s+T\s+value/);
      expect(csharp).to.match(
        /\[global::System\.Diagnostics\.CodeAnalysis\.SetsRequiredMembersAttribute\]\s*public\s+Result\s*\(\s*\)/
      );
    });
  });

  describe("Generic Classes", () => {
    it("should compile generic class with methods", () => {
      const source = `
        export class Container<T> {
          constructor(private value: T) {}

          getValue(): T {
            return this.value;
          }

          setValue(newValue: T): void {
            this.value = newValue;
          }
        }
      `;

      const csharp = compileToCSharp(source);

      // Should emit generic class
      expect(csharp).to.match(/public\s+class\s+Container\s*<T>/);

      // Should have generic methods
      expect(csharp).to.match(/public\s+T\s+getValue\s*\(\s*\)/);
      expect(csharp).to.match(
        /public\s+void\s+setValue\s*\(\s*T\s+newValue\s*\)/
      );
    });

    it("casts storage-erased nullable generic member reads back to the contextual type", () => {
      const source = `
        export class Maybe<T> {
          private value: T | null;

          constructor(value: T | null) {
            this.value = value;
          }

          getOrElse(defaultValue: T): T {
            return this.value !== null ? this.value : defaultValue;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("private object? value { get; set; }");
      expect(csharp).to.match(
        /return \(*\(global::System\.Object\)\(this\.value\)\)* != null \? \(*\(T\)this\.value\)* : defaultValue;/
      );
    });
  });

  describe("Combined Features", () => {
    it("should compile code with multiple generic features", () => {
      const source = `
        import { int } from "@tsonic/core/types.js";

        export interface Repository<T> {
          items: T[];
          add(item: T): void;
          findById(id: number): T | undefined;
        }

        export class InMemoryRepository<T extends { id: number }> {
          private items: T[] = [];

          add(item: T): void {
            this.items.push(item);
          }

          findById(id: number): T | undefined {
            for (let i: int = 0; i < this.items.Length; i++) {
              if (this.items[i].id === id) {
                return this.items[i];
              }
            }
            return undefined;
          }
        }
      `;

      const csharp = compileToCSharp(source);

      // Method-bearing interfaces emit as C# interfaces (required for constraints/implements)
      expect(csharp).to.match(/public\s+interface\s+Repository\s*<T>/);

      // Should emit InMemoryRepository as generic class with constraint
      expect(csharp).to.match(/public\s+class\s+InMemoryRepository\s*<T>/);
      expect(csharp).to.include("where T : __Constraint_T");

      // Should generate constraint adapter
      expect(csharp).to.match(/public\s+interface\s+__Constraint_T/);
      expect(csharp).to.match(/double\s+id\s*\{\s*get;\s*\}/);
    });
  });
});
