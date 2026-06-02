import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";

describe("Integration: TSTS blocker regressions", () => {
  it("passes local interface subtypes to base interface parameters without structural rematerialization", () => {
    const csharp = compileToCSharp(`
      interface Node {
        readonly kind: number;
        visit(): boolean;
      }

      interface NodeBase extends Node {
        readonly flags: number;
      }

      interface PropertyDeclaration extends NodeBase {
        readonly name: string;
      }

      declare function visitNode(node: Node): void;

      export function visitProperty(prop: PropertyDeclaration): void {
        visitNode(prop);
      }
    `);

    expect(csharp).to.include("visitNode(prop);");
    expect(csharp).to.not.include("__TsonicInterfaceObjectAdapter");
  });

  it("emits implemented property-only interfaces as native contracts", () => {
    const csharp = compileToCSharp(`
      interface TextRange {
        pos: number;
        end: number;
      }

      class TextRangeObject implements TextRange {
        pos: number;
        end: number;

        constructor(pos: number, end: number) {
          this.pos = pos;
          this.end = end;
        }
      }

      declare function take(range: TextRange): void;

      export function run(range: TextRangeObject): void {
        take(range);
      }
    `);

    expect(csharp).to.include("public interface TextRange");
    expect(csharp).to.include("public class TextRangeObject : TextRange");
    expect(csharp).to.include("take(range);");
    expect(csharp).to.not.include("new TextRange {");
  });

  it("emits property-only interfaces as native contracts when native interfaces extend them", () => {
    const csharp = compileToCSharp(`
      interface TextRange {
        pos: number;
        end: number;
      }

      interface Node extends TextRange {
        kind(): number;
      }

      export function read(node: Node): number {
        return node.pos + node.kind();
      }
    `);

    expect(csharp).to.include("public interface TextRange");
    expect(csharp).to.include("public interface Node : TextRange");
    expect(csharp).to.not.include("public class TextRange");
  });

  it("emits property-only interfaces used by native interface members as native contracts", () => {
    const csharp = compileToCSharp(`
      interface DiagnosticMessage {
        readonly code: number;
        readonly message: string;
      }

      interface ResolverHooks {
        error(message: DiagnosticMessage): void;
      }

      export function report(hooks: ResolverHooks, message: DiagnosticMessage): void {
        hooks.error(message);
      }
    `);

    expect(csharp).to.include("public interface DiagnosticMessage");
    expect(csharp).to.include("public interface ResolverHooks");
    expect(csharp).to.include("void error(DiagnosticMessage message);");
    expect(csharp).to.not.include("public class DiagnosticMessage");
  });

  it("uses source type identity over stale provider names when marking native interface bases", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/core/text.ts": `
          export class TextRange {
            pos: number;
            end: number;

            constructor(pos: number, end: number) {
              this.pos = pos;
              this.end = end;
            }
          }
        `,
        "src/ast/generated/types.ts": `
          export interface TextRange {
            pos: number;
            end: number;
          }

          export interface Node extends TextRange {
            kind(): number;
          }
        `,
        "src/index.ts": `
          import { TextRange as CoreTextRange } from "./core/text.js";
          import type { Node } from "./ast/generated/types.js";

          export function read(node: Node): number {
            return node.pos + node.kind();
          }

          export function makeCoreRange(): CoreTextRange {
            return new CoreTextRange(1, 2);
          }
        `,
      },
      "src/index.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include("namespace Test.ast.generated");
    expect(csharp).to.include("public interface TextRange");
    expect(csharp).to.include("public interface Node : TextRange");
    expect(csharp).to.include("namespace Test.core");
    expect(csharp).to.include("public class TextRange");
  });

  it("expands non-native class heritage into native interface members", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export class TextRange {
        readonly pos: int;
        readonly end: int;

        constructor(pos: int, end: int) {
          this.pos = pos;
          this.end = end;
        }
      }

      export interface TextChange extends TextRange {
        newText: string;
        describe(): string;
      }
    `);

    expect(csharp).to.include("public interface TextChange");
    expect(csharp).to.not.include("public interface TextChange : TextRange");
    expect(csharp).to.include("int pos { get; }");
    expect(csharp).to.include("int end { get; }");
    expect(csharp).to.include("string newText { get; set; }");
    expect(csharp).to.include("string describe();");
  });

  it("uses imported source identity when expanding native interface class heritage", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/core/text.ts": `
          import type { int } from "@tsonic/core/types.js";

          export class TextRange {
            readonly pos: int;
            readonly end: int;

            constructor(pos: int, end: int) {
              this.pos = pos;
              this.end = end;
            }
          }
        `,
        "src/ast/generated/types.ts": `
          export interface TextRange {
            readonly pos: number;
            readonly end: number;
          }

          export interface Node extends TextRange {
            kind(): number;
          }
        `,
        "src/core/textChange.ts": `
          import type { TextRange } from "./text.js";

          export interface TextChange extends TextRange {
            newText: string;
          }
        `,
        "src/index.ts": `
          import type { Node } from "./ast/generated/types.js";
          import type { TextChange } from "./core/textChange.js";

          export function edit(change: TextChange): string {
            return change.newText;
          }

          export function read(node: Node): number {
            return node.kind();
          }
        `,
      },
      "src/index.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include("namespace Test.core");
    expect(csharp).to.include("public interface TextChange");
    expect(csharp).to.not.include(
      "public interface TextChange : global::Test.core.TextRange"
    );
    expect(csharp).to.not.include("public interface TextChange : TextRange");
    expect(csharp).to.include("int pos { get; }");
    expect(csharp).to.include("int end { get; }");
    expect(csharp).to.include("string newText { get; set; }");
    expect(csharp).to.include("namespace Test.ast.generated");
    expect(csharp).to.include("public interface Node : TextRange");
  });

  it("lowers non-constant switch case expressions without re-evaluating the switch expression", () => {
    const csharp = compileToCSharp(`
      export type Mode = number;
      export const Mode = {
        Read: 1 << 0,
        Write: 1 << 1,
      } as const;

      function nextMode(): Mode {
        return Mode.Read;
      }

      export function describe(): string {
        switch (nextMode()) {
          case Mode.Read:
            return "read";
          case Mode.Write:
            return "write";
          default:
            return "none";
        }
      }
    `);

    expect(csharp).to.include("var __switch_");
    expect(csharp).to.include("= nextMode();");
    expect(csharp).to.include("if (__switch_");
    expect(csharp).to.include("== Mode.Read");
    expect(csharp).to.include("else if (__switch_");
    expect(csharp).to.include("== Mode.Write");
    expect(csharp).to.not.include("switch (nextMode())");
    expect(csharp.match(/= nextMode\(\);/g)?.length).to.equal(1);
  });

  it("emits imported implemented property-only interfaces as native contracts", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/ast/generated/types.ts": `
          export interface TextRange {
            pos: number;
            end: number;
          }
        `,
        "src/ast/accessors.ts": `
          import type { TextRange } from "./generated/types.js";

          class TextRangeObject implements TextRange {
            pos: number;
            end: number;

            constructor(pos: number, end: number) {
              this.pos = pos;
              this.end = end;
            }
          }

          declare function take(range: TextRange): void;

          export function run(range: TextRangeObject): void {
            take(range);
          }
        `,
      },
      "src/ast/accessors.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include("public interface TextRange");
    expect(csharp).to.include(
      "public class TextRangeObject : global::Test.ast.generated.TextRange"
    );
    expect(csharp).to.include("take(range);");
    expect(csharp).to.not.include("new global::Test.ast.generated.TextRange");
  });

  it("adapts object literals to native method interfaces through generated closure adapters", () => {
    const csharp = compileToCSharp(`
      interface Greeter {
        hello(): string;
        tagged(prefix: string): string;
      }

      export function makeGreeter(name: string): Greeter {
        return {
          hello: () => \`hi \${name}\`,
          tagged: (prefix: string) => prefix + name,
        };
      }
    `);

    expect(csharp).to.include("class __TsonicInterfaceObjectAdapter_");
    expect(csharp).to.include(": global::Test.Greeter");
    expect(csharp).to.include("string global::Test.Greeter.hello()");
    expect(csharp).to.include(
      "string global::Test.Greeter.tagged(string prefix)"
    );
    expect(csharp).to.include(
      "new global::Test.__TsonicInterfaceObjectAdapter_"
    );
    expect(csharp).to.not.include("new global::Test.Greeter");
  });

  it("implements inherited interface properties on their declaring native interface", () => {
    const csharp = compileToCSharp(`
      interface GlobElement {
        readonly kind: "slash" | "star";
      }

      interface StarElement extends GlobElement {
      }

      export function makeStar(): StarElement {
        return { kind: "star" };
      }
    `);

    expect(csharp).to.include(": global::Test.StarElement");
    expect(csharp).to.include("string global::Test.GlobElement.kind");
    expect(csharp).to.not.include("string global::Test.StarElement.kind");
  });

  it("mirrors mutable property slots when adapting object literals to native interfaces", () => {
    const csharp = compileToCSharp(
      `
        interface State {
          readonly diagnostics: string[];
          next(): number;
        }

        export function append(state: State): void {
          state.diagnostics.push("x");
        }

        export function makeState(): State {
          return {
            diagnostics: [],
            next: () => 1,
          };
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("string[] diagnostics { get; set; }");
    expect(csharp).to.include("string[] global::Test.State.diagnostics");
    expect(csharp).to.include("set");
    expect(csharp).to.include("__tsonic_member_0 = value;");
  });

  it("qualifies cross-module local interface adapter signatures in generated files", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/scanner/scanner.ts": `
          export interface ScannerState {
            pos: number;
          }

          export interface LiveScanner {
            mark(): ScannerState;
            rewind(state: ScannerState): void;
          }
        `,
        "src/parser/parser.ts": `
          import type { LiveScanner, ScannerState } from "../scanner/scanner.js";

          export function create(scannerState: ScannerState): LiveScanner {
            return {
              mark: () => scannerState,
              rewind: (state: ScannerState): void => {
                scannerState.pos = state.pos;
              },
            };
          }
        `,
      },
      "src/parser/parser.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include(": global::Test.scanner.LiveScanner");
    expect(csharp).to.include(
      "global::Test.scanner.ScannerState global::Test.scanner.LiveScanner.mark()"
    );
    expect(csharp).to.include(
      "void global::Test.scanner.LiveScanner.rewind(global::Test.scanner.ScannerState state)"
    );
    expect(csharp).to.not.include(": LiveScanner");
    expect(csharp).to.not.include("Func<ScannerState>");
  });

  it("emits numeric dictionary literal keys for Record<number, T>", () => {
    const csharp = compileToCSharp(`
      const CATEGORY_NAMES: Record<number, string> = {
        0: "warning",
        1: "error",
        2: "suggestion",
        3: "message",
      };

      export function label(category: number): string {
        return CATEGORY_NAMES[category] ?? "message";
      }
    `);

    expect(csharp).to.include(
      'new global::System.Collections.Generic.Dictionary<double, string> { [0] = "warning", [1] = "error", [2] = "suggestion", [3] = "message" }'
    );
    expect(csharp).to.not.include('["0"] = "warning"');
  });

  it("allows Array.isArray predicates over unknown as type-erased System.Array guards", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        interface Node {
          readonly kind: int;
        }

        interface NodeArray<T> extends ReadonlyArray<T> {
          readonly pos?: int;
          readonly end?: int;
        }

        export function isNodeArray(value: unknown): value is NodeArray<Node> {
          return Array.isArray(value)
            && typeof (value as { readonly pos?: unknown }).pos === "number"
            && typeof (value as { readonly end?: unknown }).end === "number";
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("public static bool isNodeArray(object? value)");
    expect(csharp).to.include("return value is global::System.Array");
    expect(csharp).to.include(".pos) is int");
    expect(csharp).to.include(".end) is int");
    expect(csharp).to.not.include(
      "Array.isArray cannot narrow a broad runtime value"
    );
  });

  it("iterates Array.isArray-narrowed unknown values directly as System.Array", () => {
    const csharp = compileToCSharp(
      `
        interface Node {
          parent?: Node;
        }

        declare function isNode(value: unknown): value is Node;

        export function attachParent(parent: Node, value: unknown): void {
          if (isNode(value)) {
            (value as { parent: Node }).parent = parent;
            return;
          }

          if (Array.isArray(value)) {
            for (const element of value) {
              attachParent(parent, element);
            }
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("if (value is global::System.Array)");
    expect(csharp).to.include(
      "foreach (var element in (global::System.Array)value)"
    );
    expect(csharp).to.include("attachParent(parent, element);");
    expect(csharp).to.not.include("(object?[])value");
  });

  it("recovers Web DataView and Node Buffer API types from first-party surfaces", () => {
    const csharp = compileToCSharp(
      `
        import { Buffer } from "node:buffer";

        export function encodeExtendedData(extendedData: number[]): string {
          const extendedDataBytes = new Uint8Array(extendedData.length * 4);
          const extendedDataView = new DataView(extendedDataBytes.buffer);
          for (let index = 0; index < extendedData.length; index += 1) {
            extendedDataView.setUint32(index * 4, extendedData[index]! >>> 0, true);
          }
          return Buffer.from(extendedDataBytes).toString("base64");
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/nodejs" }
    );

    expect(csharp).to.include("new global::js.DataView");
    expect(csharp).to.include("extendedDataBytes.buffer");
    expect(csharp).to.include(".setUint32(");
    expect(csharp).to.include("global::nodejs.buffer.Buffer.from");
    expect(csharp).to.include('.toString("base64")');
  });

  it("preserves nested runtime-union alias carriers after typeof fallthrough narrowing", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export type NestedInput<TElement extends number> =
          | readonly TElement[]
          | Iterable<number>;
        export type ConstructorInput<TElement extends number> =
          | int
          | NestedInput<TElement>;

        export class TypedArrayLike<TElement extends number> {
          data: TElement[];

          constructor(lengthOrValues: ConstructorInput<TElement>) {
            if (typeof lengthOrValues === "number") {
              this.data = [];
              return;
            }

            this.data = this.materializeInput(lengthOrValues);
          }

          materializeInput(source: NestedInput<TElement>): TElement[] {
            if (Array.isArray(source)) {
              return [...source];
            }

            return [...source] as TElement[];
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("this.materializeInput(");
    expect(csharp).to.include("this.materializeInput((lengthOrValues.As2()))");
    expect(csharp).to.not.include("this.materializeInput(lengthOrValues);");
    expect(csharp).to.not.include("Unreachable runtime union reification path");
    expect(csharp).to.not.include("Unreachable array reification path");
    expect(csharp).to.not.include(
      "global::Tsonic.Internal.Union<TElement[], global::System.Collections.Generic.IEnumerable<double>>.From1"
    );
  });

  it("projects transparent flow assertions from narrowed raw runtime unions", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export type NestedInput<TElement extends number> =
          | readonly TElement[]
          | Iterable<number>;

        export class TypedArrayLike<TElement extends number> {
          data: TElement[];

          constructor(lengthOrValues: int | NestedInput<TElement>) {
            if (typeof lengthOrValues === "number") {
              this.data = [];
              return;
            }

            this.data = this.materializeInput(lengthOrValues);
          }

          materializeInput(source: NestedInput<TElement>): TElement[] {
            void source;
            return [];
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "public TypedArrayLike(global::Tsonic.Internal.Union<int, global::Test.NestedInput<TElement>> lengthOrValues)"
    );
    expect(csharp).to.include("this.materializeInput((lengthOrValues.As2()))");
    expect(csharp).to.not.include("this.materializeInput(lengthOrValues);");
  });

  it("emits runtime typeof expressions through closed union dispatch", () => {
    const csharp = compileToCSharp(`
      type JsonValue =
        | string
        | number
        | boolean;

      export function jsonTypeOf(value: JsonValue): string {
        return typeof value;
      }
    `);

    expect(csharp).to.include("return value.Match<string>(");
    expect(csharp).to.include('=> "boolean"');
    expect(csharp).to.include('=> "number"');
    expect(csharp).to.include('=> "string"');
    expect(csharp).to.not.include(
      "global::Tsonic.Runtime.Operators.@typeof(value)"
    );
  });

  it("emits multiple property-only interface inheritance as native interfaces with object adapters", () => {
    const csharp = compileToCSharp(`
      interface HeaderFields {
        readonly name: string;
      }

      interface PathFields {
        readonly main: string;
      }

      interface DependencyFields {
        readonly dependencies: string;
      }

      interface PackageJSON extends HeaderFields, PathFields, DependencyFields {
        readonly raw: string;
      }

      export function makePackage(): PackageJSON {
        return {
          name: "pkg",
          main: "index.js",
          dependencies: "none",
          raw: "{}",
        };
      }

      export function readDependencyFields(pkg: DependencyFields): string {
        return pkg.dependencies;
      }

      export function read(): string {
        return readDependencyFields(makePackage());
      }
    `);

    expect(csharp).to.include("public interface HeaderFields");
    expect(csharp).to.include("public interface PathFields");
    expect(csharp).to.include("public interface DependencyFields");
    expect(csharp).to.include(
      "public interface PackageJSON : HeaderFields, PathFields, DependencyFields"
    );
    expect(csharp).to.include("class __TsonicInterfaceObjectAdapter_");
    expect(csharp).to.include(": global::Test.PackageJSON");
    expect(csharp).to.include("string global::Test.HeaderFields.name");
    expect(csharp).to.include("string global::Test.PathFields.main");
    expect(csharp).to.include("string global::Test.DependencyFields.dependencies");
    expect(csharp).to.include("string global::Test.PackageJSON.raw");
    expect(csharp).to.not.include(
      "class PackageJSON : HeaderFields, PathFields, DependencyFields"
    );
  });

  it("lowers optional calls returning unconstrained generic nullish values without C# conditional-access nullable synthesis", () => {
    const csharp = compileToCSharp(`
      class Box<K, V> {
        get(_key: K): V | undefined {
          throw new Error("stub");
        }
      }

      export class Holder<K, V> {
        private box: Box<K, V> | undefined;

        get(key: K): V | undefined {
          return this.box?.get(key);
        }
      }
    `);

    expect(csharp).to.include("__tsonic_optional_receiver_");
    expect(csharp).to.not.include("this.box?.get(key)");
  });

  it("keeps explicit array generic call arguments at the source array depth", () => {
    const csharp = compileToCSharp(`
      declare const Symbol: {
        readonly iterator: unique symbol;
      };

      interface Iterator<T> {}
      interface IterableIterator<T> extends Iterator<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }
      interface Iterable<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare class Assert {
        static Equal<T>(expected: T, actual: T): void;
        static Equal<T>(expected: T[], actual: T[]): void;
      }

      declare const source: Iterable<number>;

      export function run(): void {
        Assert.Equal<readonly number[]>([1, 2], [...source]);
      }
    `);

    expect(csharp).to.include("Assert.Equal<double[]>(");
    expect(csharp).to.include("new double[] { 1, 2 }");
    expect(csharp).to.not.include("new double[][]");
  });

  it("adapts numeric spread-array segments to explicit array generic arguments", () => {
    const csharp = compileToCSharp(`
      declare const Symbol: {
        readonly iterator: unique symbol;
      };

      interface Iterator<T> {}
      interface IterableIterator<T> extends Iterator<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }
      interface Iterable<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare class Assert {
        static Equal<T>(expected: Iterable<T> | null, actual: Iterable<T> | null): void;
        static Equal<T>(expected: T, actual: T): void;
        static Equal<T>(expected: T[], actual: T[]): void;
      }

      class MultiMap<K, V> {
        static groupBy<K, V>(items: Iterable<V>, groupId: (item: V) => K): MultiMap<K, V> {
          throw new Error("stub");
        }

        get(_key: K): readonly V[] {
          throw new Error("stub");
        }
      }

      export function run(): void {
        const items = [1, 2, 3, 4, 5, 6];
        const grouped = MultiMap.groupBy(items, (item) => item % 2 === 0 ? "even" : "odd");
        Assert.Equal<readonly number[]>([2, 4, 6], [...grouped.get("even")]);
      }
    `);

    expect(csharp).to.include("Assert.Equal<double[]>");
    expect(csharp).to.include(
      "global::System.Linq.Enumerable.Select<int, double>"
    );
    expect(csharp).to.not.include(
      'Assert.Equal<double[]>(new double[] { 2, 4, 6 }, global::System.Linq.Enumerable.ToArray(grouped.get("even")))'
    );
  });

  it("writes back borrowed map array values after length-changing mutations", () => {
    const csharp = compileToCSharp(
      `
        export function append(
          map: Map<string, number[]>,
          key: string,
          value: number
        ): void {
          const existing = map.get(key);
          if (existing !== undefined) {
            existing.push(value);
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("existing = __tsonic_arrayWrapper.toArray();");
    expect(csharp).to.include("map.set(key, existing);");
  });

  it("emits a default throw for exhaustive literal-union switch statements", () => {
    const csharp = compileToCSharp(`
      type Operator = "<" | "<=" | "=" | ">=" | ">";

      export function compare(operator: Operator, cmp: number): boolean {
        switch (operator) {
          case "<":
            return cmp < 0;
          case "<=":
            return cmp <= 0;
          case "=":
            return cmp === 0;
          case ">=":
            return cmp >= 0;
          case ">":
            return cmp > 0;
        }
      }
    `);

    expect(csharp).to.include("default:");
    expect(csharp).to.include(
      'throw new global::System.InvalidOperationException("Unreachable exhaustive switch case.");'
    );
  });

  it("routes string split with RegExp separators through the JS surface", () => {
    const csharp = compileToCSharp(
      `
        const WHITESPACE = /\\s+/;

        export function parts(value: string): string[] {
          return value.trim().split(WHITESPACE);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.String.split");
    expect(csharp).to.include("WHITESPACE");
    expect(csharp).to.include(".From1(WHITESPACE)");
  });

  it("keeps callable and static JS globals on their distinct binding owners", () => {
    const csharp = compileToCSharp(
      `
        export const viaCall = String(123);
        export const viaStatic = String.fromCharCode(72, 105);
        export const viaObject = Object.is(Number.NaN, Number.NaN);
        export const viaNegativeZero = Object.is(0, -0);
        export const viaBigInt = Number(BigInt(2) ** BigInt(10));
        export const viaTextEncoder = new TextEncoder().encode("Hi");
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.Globals.String");
    expect(csharp).to.include("global::js.StringConstructor.fromCharCode");
    expect(csharp).to.include("global::js.Object.@is");
    expect(csharp).to.include("-0.0");
    expect(csharp).to.include("global::js.Globals.BigInt");
    expect(csharp).to.include("global::System.Numerics.BigInteger.Pow");
    expect(csharp).to.include("new global::js.TextEncoder()");
    expect(csharp).to.not.include("global::js.StringConstructor((object)");
    expect(csharp).to.not.include(" ** ");
  });

  it("lowers JS number bitwise operators through ECMAScript coercion helpers", () => {
    const csharp = compileToCSharp(
      `
        export const toInt32 = (value: number): number => value | 0;
        export const toUint32 = (value: number): number => value >>> 0;
        export const leftShift = (value: number, shift: number): number => value << shift;
        export const signedRightShift = (value: number, shift: number): number => value >> shift;
        export const bitwiseAnd = (left: number, right: number): number => left & right;
        export const bitwiseXor = (left: number, right: number): number => left ^ right;
        export const bitwiseNot = (value: number): number => ~value;
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseOr");
    expect(csharp).to.include(
      "global::Tsonic.Runtime.Operators.UnsignedRightShift"
    );
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.LeftShift");
    expect(csharp).to.include(
      "global::Tsonic.Runtime.Operators.SignedRightShift"
    );
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseAnd");
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseXor");
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseNot");
    expect(csharp).to.not.include("(int)value | (int)0");
    expect(csharp).to.not.include("(int)value >>> (int)0");
  });

  it("coerces numeric enum operands at number comparison boundaries", () => {
    const csharp = compileToCSharp(`
      enum Kind {
        First = 1,
        Last = 3,
      }

      export function isToken(token: number): boolean {
        return token >= Kind.First && Kind.Last >= token;
      }
    `);

    expect(csharp).to.include("token >= (double)Kind.First");
    expect(csharp).to.include("(double)Kind.Last >= token");
    expect(csharp).to.not.include("token >= Kind.First");
    expect(csharp).to.not.include("&& Kind.Last >= token");
  });

  it("coerces numeric enum operands in lowered switch comparisons", () => {
    const csharp = compileToCSharp(`
      enum Kind {
        PublicKeyword = 1,
        PrivateKeyword = 2,
      }

      export function getSelectedModifierFlags(node: { kind?: number }): number {
        let result = 0;
        switch (node.kind) {
          case Kind.PublicKeyword:
            result |= 1;
            break;
          case Kind.PrivateKeyword:
            result |= 2;
            break;
        }
        return result;
      }
    `);

    expect(csharp).to.include("var __switch_");
    expect(csharp).to.include("== (double)Kind.PublicKeyword");
    expect(csharp).to.include("== (double)Kind.PrivateKeyword");
    expect(csharp).to.not.include("== Kind.PublicKeyword");
    expect(csharp).to.not.include("== Kind.PrivateKeyword");
  });

  it("coerces numeric enum operands for JavaScript-number bitwise helpers", () => {
    const csharp = compileToCSharp(`
      enum SymbolFlags {
        None = 0,
        Value = 1,
      }

      export function hasValue(flags: number): boolean {
        return (flags & SymbolFlags.Value) !== 0;
      }
    `);

    expect(csharp).to.include(
      "global::Tsonic.Runtime.Operators.BitwiseAnd(flags, (double)SymbolFlags.Value)"
    );
    expect(csharp).to.not.include(
      "global::Tsonic.Runtime.Operators.BitwiseAnd(flags, SymbolFlags.Value)"
    );
  });

  it("keeps same-enum flag bitwise operations as enum-valued expressions", () => {
    const csharp = compileToCSharp(`
      enum ContainerFlags {
        None = 0,
        IsContainer = 1,
        HasLocals = 2,
      }

      export function flags(): ContainerFlags {
        return ContainerFlags.IsContainer | ContainerFlags.HasLocals;
      }
    `);

    expect(csharp).to.include(
      "return ContainerFlags.IsContainer | ContainerFlags.HasLocals;"
    );
    expect(csharp).to.not.include(
      "return (int)ContainerFlags.IsContainer | (int)ContainerFlags.HasLocals;"
    );
  });

  it("keeps enum complement masks native inside enum flag expressions", () => {
    const csharp = compileToCSharp(`
      enum ModifierFlags {
        None = 0,
        Public = 1,
        Private = 2,
        AccessibilityModifier = 3,
      }

      export function strip(flags: ModifierFlags): ModifierFlags {
        return flags & ~ModifierFlags.AccessibilityModifier;
      }
    `);

    expect(csharp).to.include(
      "return flags & ~ModifierFlags.AccessibilityModifier;"
    );
    expect(csharp).to.not.include(
      "return (int)flags & (int)~(int)ModifierFlags.AccessibilityModifier;"
    );
  });

  it("coerces numeric enum values at number call boundaries", () => {
    const csharp = compileToCSharp(`
      enum SymbolFlags {
        None = 0,
        Value = 1,
      }

      function acceptsNumber(value: number): boolean {
        return value !== 0;
      }

      export function run(): boolean {
        return acceptsNumber(SymbolFlags.Value);
      }
    `);

    expect(csharp).to.include("acceptsNumber((double)SymbolFlags.Value)");
    expect(csharp).to.not.include("acceptsNumber(SymbolFlags.Value)");
  });

  it("coerces numeric enum values at integral return boundaries", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      enum SyntaxKind {
        Identifier = 80,
      }

      export function readKind(): int {
        return SyntaxKind.Identifier;
      }
    `);

    expect(csharp).to.include("return (int)SyntaxKind.Identifier;");
    expect(csharp).to.not.include("return SyntaxKind.Identifier;");
  });

  it("projects explicit runtime-union member assertions through exact AsN accessors", () => {
    const csharp = compileToCSharp(`
      export interface TypeBase {
        readonly flags: number;
      }

      export interface ObjectType extends TypeBase {
        readonly objectFlags: number;
      }

      export interface TypeReference extends ObjectType {
        readonly target: ObjectType;
      }

      export interface InterfaceType extends ObjectType {
        readonly typeParameters: readonly TypeBase[];
      }

      export type TypeData =
        | TypeBase
        | ObjectType
        | TypeReference
        | InterfaceType;

      export interface Type {
        readonly data?: TypeData;
      }

      export function asTypeReference(type: Type): TypeReference | undefined {
        return type.data !== undefined ? type.data as TypeReference : undefined;
      }
    `);

    expect(csharp).to.match(/type\.data\.As[0-9]+\(\)/);
    expect(csharp).to.match(/\(TypeReference\)\(type\.data\.As[0-9]+\(\)\)/);
    expect(csharp).to.not.include("Match<TypeReference");
  });

  it("does not apply runtime-union AsN accessors after a call was already projected", () => {
    const csharp = compileToCSharp(`
      class Bytes {
        value: number = 0;
      }

      function encodeOutput(value: Bytes, encoding?: string): Bytes | string {
        if (encoding === undefined) {
          return value;
        }

        return "encoded";
      }

      export function read(value: Bytes, encoding: string): string {
        return encodeOutput(value, encoding) as string;
      }
    `);

    expect(csharp).to.include("Match<string>");
    expect(csharp).to.not.match(/Match<string>[\s\S]*\)\.As[0-9]+\(\)/);
  });

  it("does not apply runtime-union AsN accessors after branch narrowing already projected the value", () => {
    const csharp = compileToCSharp(`
      class Readable {
        state: number = 0;
      }

      class InterfaceOptions {
        input: Readable | undefined = undefined;
      }

      export function createInterface(
        optionsOrInput: InterfaceOptions | Readable
      ): InterfaceOptions {
        if (optionsOrInput instanceof InterfaceOptions) {
          return optionsOrInput;
        }

        const options = new InterfaceOptions();
        options.input = optionsOrInput as Readable;
        return options;
      }
    `);

    expect(csharp).to.not.match(/\.As[0-9]+\(\)\)\.As[0-9]+\(\)/);
  });

  it("emits signed numeric literal unions without leaking anyType into runtime union carriers", () => {
    const csharp = compileToCSharp(`
      export type Comparison = -1 | 0 | 1;

      export const ComparisonLessThan: Comparison = -1;
      export const ComparisonEqual: Comparison = 0;
      export const ComparisonGreaterThan: Comparison = 1;

      export function compareStringsCaseSensitive(a: string, b: string): Comparison {
        if (a < b) return ComparisonLessThan;
        if (a > b) return ComparisonGreaterThan;
        return ComparisonEqual;
      }

      export function getStringComparer(
        ignoreCase: boolean
      ): (a: string, b: string) => Comparison {
        return ignoreCase ? compareStringsCaseSensitive : compareStringsCaseSensitive;
      }
    `);

    expect(csharp).to.include("double compareStringsCaseSensitive");
    expect(csharp).to.include("global::System.Func<string, string, double>");
    expect(csharp).to.not.include("__TsonicUnion");
    expect(csharp).to.not.include("object compareStringsCaseSensitive");
  });

  it("does not reinterpret source aliases as same-named target delegates during call adaptation", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/compare.ts": `
          export type Comparison = -1 | 0 | 1;

          export const ComparisonLessThan: Comparison = -1;
          export const ComparisonEqual: Comparison = 0;
          export const ComparisonGreaterThan: Comparison = 1;

          export function compareStringsCaseSensitive(a: string, b: string): Comparison {
            if (a < b) return ComparisonLessThan;
            if (a > b) return ComparisonGreaterThan;
            return ComparisonEqual;
          }
        `,
        "src/index.ts": `
          export * from "./compare.js";
        `,
        "src/test.ts": `
          import { Assert } from "xunit-types/Xunit.js";
          import { ComparisonEqual, compareStringsCaseSensitive } from "./index.js";

          export function run(): void {
            Assert.Equal(
              ComparisonEqual,
              compareStringsCaseSensitive("a", "a")
            );
          }
        `,
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          type: "module",
        }),
        "node_modules/xunit-types/Xunit.js": "export {};",
        "node_modules/xunit-types/Xunit.d.ts":
          'export * from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { Func_3, Boolean as ClrBoolean, DateTime } from "@tsonic/dotnet/System/internal/index.js";',
          'import type { IAsyncEnumerable_1, IEnumerable_1, IEqualityComparer_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
          "export interface Assert$instance {}",
          "export declare const Assert: (abstract new() => Assert$instance) & {",
          "  Equal<T>(expected: IAsyncEnumerable_1<T> | null, actual: IAsyncEnumerable_1<T> | null): void;",
          "  Equal<T>(expected: IEnumerable_1<T> | null, actual: IEnumerable_1<T> | null): void;",
          "  Equal(expected: DateTime, actual: DateTime): void;",
          "  Equal<T>(expected: T, actual: T, comparer: Func_3<T, T, ClrBoolean>): void;",
          "  Equal<T>(expected: T, actual: T, comparer: IEqualityComparer_1<T>): void;",
          "  Equal<T>(expected: T, actual: T): void;",
          "};",
        ].join("\n"),
      },
      "src/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      'Assert.Equal(global::Test.compare.ComparisonEqual, global::Test.compare.compareStringsCaseSensitive("a", "a"));'
    );
    expect(csharp).to.not.include("ComparisonEqual(p0, p1)");
    expect(csharp).to.not.include(
      'compareStringsCaseSensitive("a", "a")(p0, p1)'
    );
  });

  it("types ECMAScript numeric globals and bigint literals before union adaptation", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export interface EvaluatorResult {
          readonly value: string | number | boolean | bigint | undefined;
        }

        export function anyToString(v: EvaluatorResult["value"]): string {
          if (typeof v === "bigint") return v.toString();
          return "";
        }

        export class AnyToStringTests {
          numbers(): void {
            Assert.Equal("NaN", anyToString(NaN));
            Assert.Equal("Infinity", anyToString(Infinity));
          }

          bigints(): void {
            Assert.Equal("42", anyToString(42n));
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.Globals.NaN");
    expect(csharp).to.include("global::js.Globals.Infinity");
    expect(csharp).to.include('global::System.Numerics.BigInteger.Parse("42")');
    expect(csharp).to.include(".Is1()");
    expect(csharp).to.include(
      ".ToString(global::System.Globalization.CultureInfo.InvariantCulture)"
    );
    expect(csharp).to.not.include("if (false)");
    expect(csharp).to.not.include(".toString()");
  });

  it("emits literal const strings as compile-time constants for switch labels", () => {
    const csharp = compileToCSharp(`
      export const extensionTs = ".ts";
      export const extensionJs = ".js";

      export function mapExtension(ext: string): string {
        switch (ext) {
          case extensionTs:
            return extensionJs;
          default:
            return "";
        }
      }
    `);

    expect(csharp).to.include('public const string extensionTs = ".ts";');
    expect(csharp).to.include("case extensionTs:");
    expect(csharp).to.not.include("public static readonly string extensionTs");
  });

  it("emits tuple numeric literal element access through ValueTuple members", () => {
    const csharp = compileToCSharp(`
      export function first(pair: [string, string]): string {
        return pair[0];
      }

      export function second(pair: [string, string]): string {
        return pair[1];
      }
    `);

    expect(csharp).to.include("return pair.Item1;");
    expect(csharp).to.include("return pair.Item2;");
    expect(csharp).to.not.include("pair[0]");
    expect(csharp).to.not.include("pair[1]");
  });

  it("reads local interfaces extending ReadonlyArray through array optional-read helpers", () => {
    const csharp = compileToCSharp(
      `
        interface Node {
          readonly kind: number;
        }

        interface NodeArray<T> extends ReadonlyArray<T> {
          readonly pos?: number;
        }

        interface SourceFile {
          readonly statements: NodeArray<Node>;
        }

        export function first(sourceFile: SourceFile): Node {
          return sourceFile.statements[0]!;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalReference<Node>(sourceFile.statements, 0)"
    );
    expect(csharp).to.not.include("sourceFile.statements.at(0)");
  });

  it("does not leak inherited ReadonlyArray type parameters into local array reads", () => {
    const csharp = compileToCSharp(
      `
        interface Node {
          readonly kind: number;
        }

        interface NodeArray<T extends Node> extends ReadonlyArray<T> {
          readonly pos?: number;
        }

        interface JsxChild extends Node {
          readonly text: string;
        }

        export function last(children: NodeArray<JsxChild>): JsxChild | undefined {
          const lastChild = children.length > 0 ? children[children.length - 1] : undefined;
          return lastChild;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalReference<JsxChild>(children, children.Length - 1)"
    );
    expect(csharp).to.not.include(
      "(T)global::Tsonic.Internal.ArrayInterop.ReadOptionalReference<JsxChild>"
    );
    expect(csharp).to.not.include(": default(T)");
    expect(csharp).to.not.include("(JsxChild)(T)lastChild");
  });

  it("lowers JS number bitwise compound assignments through runtime operators", () => {
    const csharp = compileToCSharp(
      `
        const TokenFlags = {
          None: 0,
          Scientific: 1 << 4,
          ContainsSeparator: 1 << 9,
        } as const;

        export interface State {
          tokenFlags: number;
        }

        export function markScientific(state: State): void {
          state.tokenFlags |= TokenFlags.Scientific;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "state.tokenFlags = global::Tsonic.Runtime.Operators.BitwiseOr(state.tokenFlags, "
    );
    expect(csharp).to.not.include("state.tokenFlags |=");
  });

  it("adapts Map values when returning readonly map views with readonly value supertypes", () => {
    const csharp = compileToCSharp(
      `
        export class Holder {
          private readonly values = new Map<string, Set<string>>();

          view(): ReadonlyMap<string, ReadonlySet<string>> {
            return this.values;
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("new global::js.ReadonlyMapView");
    expect(csharp).to.include(
      "global::js.ReadonlyMapView<string, global::js.Set<string>, global::js.ReadonlySet<string>>"
    );
    expect(csharp).to.not.include(
      "(global::js.ReadonlyMap<string, global::js.ReadonlySet<string>>)this.values"
    );
  });

  it("keeps imported readonly collection constants as instance receivers for member calls", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/metadata.ts": `
          export const ChildPropertiesByKind: ReadonlyMap<number, readonly string[]> =
            new Map([[1, ["name"]]]);
          export const KnownNames: ReadonlySet<string> = new Set(["name"]);
        `,
        "src/index.ts": `
          import { ChildPropertiesByKind, KnownNames } from "./metadata.js";

          export function hasKnownChild(kind: number): boolean {
            const properties = ChildPropertiesByKind.get(kind) ?? [];
            return KnownNames.has(properties[0] ?? "");
          }
        `,
      },
      "src/index.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include(
      "global::Test.metadata.ChildPropertiesByKind).get(kind)"
    );
    expect(csharp).to.include("global::Test.metadata.KnownNames).has(");
    expect(csharp).to.not.include("global::js.ReadonlyMap.get");
    expect(csharp).to.not.include("global::js.ReadonlySet.has");
  });

  it("does not re-emit inherited discriminant properties narrowed by sub-interfaces", () => {
    const csharp = compileToCSharp(`
      interface GlobElement {
        readonly kind: "slash" | "literal";
      }

      interface SlashElement extends GlobElement {
        kind: "slash";
      }

      interface LiteralElement extends GlobElement {
        kind: "literal";
        value: string;
      }

      type Element = SlashElement | LiteralElement;

      export function slash(): Element {
        return { kind: "slash" };
      }

      export function literal(): Element {
        return { kind: "literal", value: "x" };
      }

      export function text(element: GlobElement): string {
        return element.kind;
      }
    `);

    expect(csharp).to.include("public interface GlobElement");
    expect(csharp).to.include("public interface SlashElement : GlobElement");
    expect(csharp).to.include("public interface LiteralElement : GlobElement");
    expect(csharp).to.include(": global::Test.SlashElement");
    expect(csharp).to.include(": global::Test.LiteralElement");
    expect(csharp).to.include("string kind { get; }");
    expect(csharp).to.include("string global::Test.GlobElement.kind");
    expect(csharp).to.include("string global::Test.LiteralElement.value");
    expect(csharp).to.include("string value { get; set; }");
    expect(csharp).to.not.include("public class SlashElement");
    expect(csharp).to.not.include("public class LiteralElement");
    expect(csharp).to.not.include("string global::Test.SlashElement.kind");
    expect(csharp).to.not.match(
      /class\s+SlashElement\s*:\s*GlobElement[\s\S]*?public\s+required\s+string\s+kind\s*\{/
    );
    expect(csharp).to.not.match(
      /class\s+LiteralElement\s*:\s*GlobElement[\s\S]*?public\s+required\s+string\s+kind\s*\{/
    );
    expect(csharp).to.not.include("string global::Test.LiteralElement.kind");
    expect(csharp).to.match(
      /Element\.From\d+\(new global::Test\.__TsonicInterfaceObjectAdapter_[^(]+\("slash"\)\)/
    );
    expect(csharp).to.match(
      /Element\.From\d+\(new global::Test\.__TsonicInterfaceObjectAdapter_[^(]+\("literal", "x"\)\)/
    );
    expect(csharp).to.not.match(/new SlashElement\s*\{\s*kind = "literal"/);
    expect(csharp).to.not.match(/new LiteralElement\s*\{\s*kind = "slash"/);
  });

  it("preserves length-changing array mutations performed through helper parameters", () => {
    const csharp = compileToCSharp(
      `
        function append(parts: string[], value: string): void {
          parts.push(value);
        }

        export function run(): string {
          const parts: string[] = [];
          append(parts, "a");
          append(parts, "b");
          return parts.join(",");
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.match(/append\s*\(\s*ref\s+string\[\]\s+parts/);
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.Push(ref parts, value)"
    );
    expect(csharp).to.include('append(ref parts, "a")');
    expect(csharp).to.include('append(ref parts, "b")');
  });

  it("lowers native-array length assignment through deterministic resize interop", () => {
    const csharp = compileToCSharp(
      `
        export function clear(items: string[]): void {
          items.length = 0;
        }

        import type { int } from "@tsonic/core/types.js";

        export function resize(items: string[], length: int): void {
          items.length = length;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "items = global::Tsonic.Internal.ArrayInterop.SetLength(items, 0);"
    );
    expect(csharp).to.include(
      "items = global::Tsonic.Internal.ArrayInterop.SetLength(items, length);"
    );
    expect(csharp).to.not.include("items.length =");
  });

  it("passes flattened spread arrays through native-array mutation calls", () => {
    const csharp = compileToCSharp(
      `
        export function appendAll(target: string[], source: readonly string[]): void {
          target.push(...source);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.Push(ref target, source)"
    );
    expect(csharp).to.not.match(/\\(string\\)\\s*source/);
  });

  it("projects object spreads to contextual structural target members only", () => {
    const csharp = compileToCSharp(`
      interface WideState {
        readonly id: number;
        readonly extra: number;
        readonly getExtra: () => number;
      }

      interface ResolverState {
        readonly id: number;
        readonly getValue: () => number;
      }

      export function createResolverState(state: WideState): ResolverState {
        const resolverState: ResolverState = {
          ...state,
          getValue: () => state.id,
        };
        return resolverState;
      }
    `);

    expect(csharp).to.include("__tmp.id = __spread.id;");
    expect(csharp).to.not.include("__tmp.extra = __spread.extra;");
    expect(csharp).to.not.include("__tmp.getExtra = __spread.getExtra;");
    expect(csharp).to.include("__tmp.getValue =");
  });

  it("preserves runtime absence for generic array reads returned as optional values", () => {
    const csharp = compileToCSharp(
      `
        export function singleOrUndefined<T>(slice: readonly T[]): T | undefined {
          return slice.length === 1 ? slice[0] : undefined;
        }

        export function lastOrUndefined<T>(slice: readonly T[]): T | undefined {
          return slice[slice.length - 1];
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("public static object? singleOrUndefined<T>");
    expect(csharp).to.include(
      "slice.Length == 1 ? global::Tsonic.Internal.ArrayInterop.ReadOptionalObject<T>(slice, 0) : default(object)"
    );
    expect(csharp).to.include("public static object? lastOrUndefined<T>");
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalObject<T>(slice, slice.Length - 1)"
    );
    expect(csharp).to.not.include("return slice[slice.Length - 1];");
    expect(csharp).to.include("internal static class ArrayInterop");
  });

  it("emits numeric generic constraints as nullable-capable value constraints for optional element reads", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export class NumericBox<T extends number> {
          data: T[];

          constructor(data: T[]) {
            this.data = data;
          }

          at(index: int): T | undefined {
            return this.data[index];
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "where T : struct, global::System.Numerics.INumber<T>"
    );
    expect(csharp).to.include("public T? at(int index)");
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalValue<T>(this.data, index)"
    );
  });

  it("keeps generic optional callback results in an object carrier until nullish checks complete", () => {
    const csharp = compileToCSharp(
      `
        export function mapNonNil<T, U>(
          slice: readonly T[],
          f: (item: T) => U | undefined | null
        ): readonly U[] {
          const out: U[] = [];
          for (const item of slice) {
            const mapped = f(item);
            if (mapped !== undefined && mapped !== null) {
              out.push(mapped);
            }
          }
          return out;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::System.Func<T, object?> f");
    expect(csharp).to.include("var mapped = f(item);");
    expect(csharp).to.include("push((U)mapped)");
    expect(csharp).to.not.include(
      "var mapped = global::Tsonic.Internal.GenericOptional.FromObject<U>"
    );
  });

  it("routes Array.prototype.flatMap through the JS array surface", () => {
    const csharp = compileToCSharp(
      `
        export function expand(values: readonly number[]): readonly number[] {
          return values.flatMap((value) => [value, value * 10]);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(values).flatMap"
    );
    expect(csharp).to.include(".toArray()");
    expect(csharp).to.not.include(".SelectMany(");
  });

  it("closes Array.prototype.flatMap callback result generics before JS wrapper emission", () => {
    const csharp = compileToCSharp(
      `
        interface Node {
          readonly text: string;
        }

        export function expand(values: readonly Node[]): readonly Node[] {
          return values.flatMap((value) => [value]);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(values).flatMap"
    );
    expect(csharp).to.include("new Node[] { value }");
    expect(csharp).to.not.include("new TResult[] { value }");
  });

  it("closes Array.prototype.flatMap generics from conditional array return types", () => {
    const csharp = compileToCSharp(
      `
        interface Modifier {
          readonly kind: number;
        }

        function printModifier(modifier: Modifier): string | undefined {
          return modifier.kind === 1 ? "static" : undefined;
        }

        export function print(modifiers: readonly Modifier[]): readonly string[] {
          return modifiers.flatMap((modifier) => {
            const text = printModifier(modifier);
            return text === undefined ? [] : [text];
          });
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("new string[] { text }");
    expect(csharp).to.include("global::System.Array.Empty<string>()");
    expect(csharp).to.not.include("new TResult[]");
  });

  it("does not re-adapt contextualized generic array call returns after callback widening", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export function map<T, U>(
          arr: readonly T[],
          f: (item: T) => U
        ): readonly U[] {
          const out: U[] = [];
          for (const item of arr) {
            out.push(f(item));
          }
          return out;
        }

        export class Tests {
          map_applies_transform(): void {
            Assert.Equal<readonly number[]>([2, 4, 6], map([1, 2, 3], (n) => n * 2));
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "Assert.Equal<double[]>(new double[] { 2, 4, 6 }, global::Test.test.map(new int[] { 1, 2, 3 }, (int n) => (double)(n * 2)))"
    );
    expect(csharp).to.not.include(
      "global::System.Linq.Enumerable.Select<int, double>(global::Test.test.map"
    );
  });

  it("emits explicit type arguments when optional generic callback results erase inference", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export function mapNonNil<T, U>(
          arr: readonly T[],
          f: (item: T) => U | undefined
        ): readonly U[] {
          const out: U[] = [];
          for (const item of arr) {
            const mapped = f(item);
            if (mapped !== undefined) {
              out.push(mapped);
            }
          }
          return out;
        }

        export class Tests {
          map_non_nil_drops_undefined(): void {
            Assert.Equal<readonly number[]>(
              [2],
              mapNonNil([1, 2, 3], (n) => (n % 2 === 0 ? n : undefined)),
            );
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::Test.test.mapNonNil<int, double>(");
    expect(csharp).to.include(
      "(int n) => n % 2 == 0 ? (double?)n : default(double?)"
    );
  });

  it("narrows nested discriminated union properties before reading arm-only members", () => {
    const csharp = compileToCSharp(`
      type Expected<T> =
        | { readonly state: "absent" }
        | { readonly state: "null"; readonly actualJSONType: "null" }
        | { readonly state: "wrong-type"; readonly actualJSONType: string }
        | { readonly state: "ok"; readonly value: T; readonly actualJSONType: string };

      interface PackageFields {
        readonly name: Expected<string>;
      }

      export function read(pkg: PackageFields): string {
        if (pkg.name.state === "wrong-type") {
          return pkg.name.actualJSONType;
        }
        return "absent";
      }
    `);

    expect(csharp).to.match(/if \(pkg\.name\.Is\d+\(\)\)/);
    expect(csharp).to.match(/var pkg_name__\d+_\d+ = pkg\.name\.As\d+\(\);/);
    expect(csharp).to.match(/return pkg_name__\d+_\d+\.actualJSONType;/);
    expect(csharp).to.not.include("pkg.name.actualJSONType");
  });

  it("projects common members of recursive JSON discriminated union aliases", () => {
    const csharp = compileToCSharp(
      `
        type JSONValueShape =
          | { readonly type: "not-present" }
          | { readonly type: "null"; readonly value: null }
          | { readonly type: "string"; readonly value: string }
          | { readonly type: "array"; readonly value: readonly JSONValueShape[] }
          | { readonly type: "object"; readonly value: ReadonlyMap<string, JSONValueShape> };

        interface PackageFields {
          readonly exports: JSONValueShape;
        }

        export function read(pkg: PackageFields): string {
          return pkg.exports.type;
        }

        export function arrayValue(value: JSONValueShape): readonly JSONValueShape[] {
          if (value.type === "array") return value.value;
          return [];
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("return pkg.exports.Match(");
    expect(csharp).to.not.include("pkg.exports.type");
    expect(csharp).to.match(/if \(value\.Is\d+\(\)\)/);
    expect(csharp).to.match(/return value__\d+_\d+\.value;/);
    expect(csharp).to.not.include("return value.value;");
  });

  it("contextualizes empty object conditional branches as dictionary records", () => {
    const csharp = compileToCSharp(
      `
        type JsonValue =
          | string
          | number
          | boolean
          | null
          | readonly JsonValue[]
          | { readonly [key: string]: JsonValue };

        declare function isJsonObject(
          value: JsonValue
        ): value is { readonly [key: string]: JsonValue };

        function read(
          obj: { readonly [key: string]: JsonValue },
          key: string
        ): JsonValue | undefined {
          return obj[key];
        }

        export function run(raw: JsonValue): JsonValue | undefined {
          const obj = isJsonObject(raw) ? raw : {};
          return read(obj, "x");
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.match(
      /var obj = isJsonObject\(raw\) \? \(raw\.As\d+\(\)\) : new global::System\.Collections\.Generic\.Dictionary<string, global::Test\.JsonValue>/
    );
    expect(csharp).to.include(
      "__tsonic_return_value == null ? default(global::Test.JsonValue?) : __tsonic_return_value.Match"
    );
    expect(csharp).to.include('))(read(obj, "x"));');
    expect(csharp).to.not.include('return read(obj, "x").Match');
    expect(csharp).to.match(
      /public static global::Test\.JsonValue\? run\(global::Test\.JsonValue raw\)\s*\{\s*var obj = isJsonObject\(raw\) \? \(raw\.As\d+\(\)\) : new global::System\.Collections\.Generic\.Dictionary<string, global::Test\.JsonValue>\(\);\s*return \(\(global::System\.Func<global::Test\.JsonValue\?, global::Test\.JsonValue\?>\)\(__tsonic_return_value => __tsonic_return_value == null \? default\(global::Test\.JsonValue\?\) : __tsonic_return_value\.Match/
    );
  });

  it("intersects imported broad object predicates with the caller union source type", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/json/index.ts": `
          export type JsValue = object | string | number | boolean | null;

          export type JsonValue =
            | string
            | number
            | boolean
            | null
            | readonly JsonValue[]
            | { readonly [key: string]: JsonValue };

          export function isJsonObject(value: JsValue): value is { readonly [key: string]: JsValue } {
            return typeof value === "object" && value !== null && !Array.isArray(value);
          }
        `,
        "src/packagejson/parser.ts": `
          import { isJsonObject, type JsonValue } from "../json/index.js";

          function read(
            obj: { readonly [key: string]: JsonValue },
            key: string
          ): JsonValue | undefined {
            return obj[key];
          }

          function jsonValueFromJSON(raw: JsonValue | undefined): JsonValue | undefined {
            return raw;
          }

          interface PackageJSON {
            readonly exports: JsonValue | undefined;
          }

          export function run(raw: JsonValue): JsonValue | undefined {
            const obj = isJsonObject(raw) ? raw : {};
            return read(obj, "x");
          }

          export function readAssertedField(raw: JsonValue): JsonValue | undefined {
            const obj = isJsonObject(raw) ? raw : {};
            return jsonValueFromJSON((obj as Record<string, JsonValue>)["exports"]);
          }

          export function packageFromValue(raw: JsonValue): PackageJSON {
            const obj = isJsonObject(raw) ? raw : {};
            return {
              exports: jsonValueFromJSON((obj as Record<string, JsonValue>)["exports"]),
            };
          }
        `,
      },
      "src/packagejson/parser.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.match(
      /var obj = .* \? \(raw\.As\d+\(\)\) : new global::System\.Collections\.Generic\.Dictionary<string, global::Test\.json\.JsonValue>/
    );
    expect(csharp).to.include('return read(obj, "x");');
    expect(csharp).to.include("var __tsonic_dict = obj;");
    expect(csharp).to.not.include("obj.Match");
    expect(csharp).to.not.include("Dictionary<string, object?>();");
  });

  it("keeps Object.entries tuple values typed from narrowed dictionary carriers", () => {
    const csharp = compileToCSharp(
      `
        type JsonValue =
          | string
          | number
          | boolean
          | null
          | readonly JsonValue[]
          | { readonly [key: string]: JsonValue };

        type JSONValueShape =
          | { readonly type: "not-present" }
          | { readonly type: "string"; readonly value: string }
          | { readonly type: "array"; readonly value: readonly JSONValueShape[] }
          | { readonly type: "object"; readonly value: ReadonlyMap<string, JSONValueShape> };

        export function jsonValueFromJSON(raw: JsonValue | undefined): JSONValueShape {
          if (raw === undefined) return { type: "not-present" };
          switch (typeof raw) {
            case "string":
              return { type: "string", value: raw };
            case "object":
              if (Array.isArray(raw)) {
                return {
                  type: "array",
                  value: raw.map((item) => jsonValueFromJSON(item)),
                };
              }
              {
                const map = new Map<string, JSONValueShape>();
                for (const [k, v] of Object.entries(raw)) {
                  map.set(k, jsonValueFromJSON(v));
                }
                return { type: "object", value: map };
              }
          }
          return { type: "not-present" };
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.match(
      /foreach \(var __item in global::js\.Object\.entries\(\(raw\.As\d+\(\)\)\)\)/
    );
    expect(csharp).to.match(/global::Test\.JsonValue v = __tuple\d+\.Item2;/);
    expect(csharp).to.not.include("object v = __tuple");
    expect(csharp).to.include("jsonValueFromJSON(v)");
  });

  it("keeps Object.entries tuple values typed after imported broad object predicates", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/json/index.ts": `
          export type JsValue = object | string | number | boolean | null;

          export type JsonValue =
            | string
            | number
            | boolean
            | null
            | readonly JsonValue[]
            | { readonly [key: string]: JsonValue };

          export function isJsonObject(value: JsValue): value is { readonly [key: string]: JsValue } {
            return typeof value === "object" && value !== null && !Array.isArray(value);
          }
        `,
        "src/packagejson/parser.ts": `
          import { isJsonObject, type JsonValue } from "../json/index.js";

          function consume(value: JsonValue): void {
            value;
          }

          function consumeString(value: string): void {
            value;
          }

          export function read(v: JsonValue): void {
            if (!isJsonObject(v)) return;
            for (const [k, val] of Object.entries(v)) {
              k;
              consume(val);
              if (typeof val === "string") {
                consumeString(val);
              }
            }
          }
        `,
      },
      "src/packagejson/parser.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.match(
      /foreach \(var __item in global::js\.Object\.entries\(\(?v\.As\d+\(\)\)?\)\)/
    );
    expect(csharp).to.match(
      /global::Test\.json\.JsonValue val = __tuple\d+\.Item2;/
    );
    expect(csharp).to.not.include(
      "Object.entries((global::System.Collections.Generic.Dictionary<string, object?>)"
    );
    expect(csharp).to.include("consume(val);");
    expect(csharp).to.include("if (val.Is5())");
    expect(csharp).to.match(/consumeString\(\(?val\.As\d+\(\)\)?\)/);
  });

  it("preserves dictionary-read absence separately from present null values", () => {
    const csharp = compileToCSharp(
      `
        type JsonValue =
          | string
          | number
          | boolean
          | null
          | readonly JsonValue[]
          | { readonly [key: string]: JsonValue };

        export function read(
          obj: { readonly [key: string]: JsonValue },
          key: string
        ): string {
          const v = obj[key];
          if (v === undefined) return "absent";
          if (v === null) return "null";
          return "present";
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "bool __tsonic_v_present = __tsonic_v_dict.ContainsKey(__tsonic_v_key);"
    );
    expect(csharp).to.include("if (!__tsonic_v_present)");
    expect(csharp).to.include("if (((global::System.Object)(v)) == null)");
    expect(csharp).to.not.include("if ((v) == null)");
  });

  it("adapts imported constant union arms to imported generic union return types", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/packagejson/types.ts": `
          export type Expected<T> =
            | { readonly state: "absent" }
            | { readonly state: "null"; readonly actualJSONType: "null" }
            | { readonly state: "wrong-type"; readonly actualJSONType: string }
            | { readonly state: "ok"; readonly value: T; readonly actualJSONType: string };

          export const absent: { readonly state: "absent" } = { state: "absent" };
        `,
        "src/packagejson/parser.ts": `
          import { absent, type Expected } from "./types.js";

          export function readString(): Expected<string> {
            return absent;
          }

          export function readStringMap(): Expected<ReadonlyMap<string, string>> {
            return absent;
          }
        `,
      },
      "src/packagejson/parser.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.match(
      /return global::Test\.packagejson\.Expected<string>\.From\d+\(/
    );
    expect(csharp).to.match(
      /return global::Test\.packagejson\.Expected<global::js\.ReadonlyMap<string, string>>\.From\d+\(/
    );
    expect(csharp).to.not.include(
      "return global::Test.packagejson.types.absent;"
    );
    expect(csharp).to.not.include(
      "(global::Test.packagejson.Expected__3)global::Test.packagejson.types.absent"
    );
    expect(csharp).to.include(
      "var __struct = global::Test.packagejson.types.absent;"
    );
    expect(csharp).to.include(
      "return new Expected__3 { state = __struct.state };"
    );
  });

  it("projects common members from imported function return union aliases", () => {
    const csharp = compileProjectToCSharp(
      {
        "src/packagejson/types.ts": `
          export type JSONValueShape =
            | { readonly type: "not-present" }
            | { readonly type: "null"; readonly value: null }
            | { readonly type: "string"; readonly value: string }
            | { readonly type: "array"; readonly value: readonly JSONValueShape[] }
            | { readonly type: "object"; readonly value: ReadonlyMap<string, JSONValueShape> };

          export interface PackageJSON {
            readonly exports: JSONValueShape;
          }
        `,
        "src/packagejson/parser.ts": `
          import type { PackageJSON } from "./types.js";

          export function parsePackageJSON(): PackageJSON {
            return { exports: { type: "not-present" } };
          }
        `,
        "src/packagejson/packagejson.test.ts": `
          import { parsePackageJSON } from "./parser.js";

          export function read(): string {
            const pkg = parsePackageJSON();
            return pkg.exports.type;
          }
        `,
      },
      "src/packagejson/packagejson.test.ts",
      { surface: "@tsonic/js" },
      { sourceRootRelativePath: "src", rootNamespace: "Test" }
    );

    expect(csharp).to.include("return pkg.exports.Match(");
    expect(csharp).to.not.include("pkg.exports.type");
  });

  it("adapts inferred generic return types when wrapping mutable maps in readonly generic unions", () => {
    const csharp = compileToCSharp(
      `
        type Expected<T> =
          | { readonly state: "ok"; readonly value: T; readonly actualJSONType: "object" }
          | { readonly state: "absent" };

        function expectedOf<T>(value: T): Expected<T> {
          return { state: "ok", value, actualJSONType: "object" };
        }

        export function read(): Expected<ReadonlyMap<string, string>> {
          const map = new Map<string, string>();
          return expectedOf(map);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("return expectedOf(map).Match<global::Test.Expected<global::js.ReadonlyMap<string, string>>>");
    expect(csharp).to.include(
      "global::Test.Expected<global::js.ReadonlyMap<string, string>>.From1"
    );
    expect(csharp).to.not.include("return expectedOf(map);");
  });

  it("does not emit out-of-scope inferred type parameters for static generic calls", () => {
    const csharp = compileToCSharp(`
      import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
      import { Enumerable } from "@tsonic/dotnet/System.Linq.js";
      import { int } from "@tsonic/core/types.js";

      export function run(): void {
        const numbers = new List<int>();
        const doubled = Enumerable.Select(numbers, (n) => n * 2);
        const doubledList = Enumerable.ToList(doubled);
        doubledList.Count;
      }
    `);

    expect(csharp).to.include("global::System.Linq.Enumerable.Select");
    expect(csharp).to.include("global::System.Linq.Enumerable.ToList(doubled)");
    expect(csharp).to.not.include("ToList<TResult>");
  });

  it("infers Map and WeakMap constructor type arguments from contextual return types", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        class Node {
          name: string;
          constructor(name: string) {
            this.name = name;
          }
        }

        class SymbolInfo {
          name: string;
          constructor(name: string) {
            this.name = name;
          }
        }

        type SymbolTable = Map<string, SymbolInfo>;

        interface BinderState {
          locals: WeakMap<Node, SymbolTable>;
          symbols: WeakMap<object, SymbolInfo>;
        }

        export function bind(name: string): int {
          const sourceFile = new Node(name);
          const state: BinderState = {
            locals: new WeakMap(),
            symbols: new WeakMap(),
          };
          const globals: SymbolTable = new Map();
          globals.set(name, new SymbolInfo(name));
          state.locals.set(sourceFile, globals);
          const copy: Map<string, SymbolInfo> = new Map(globals);
          return copy.size;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("new global::js.WeakMap<");
    expect(csharp).to.include(
      "new global::js.Map<string, SymbolInfo>()"
    );
    expect(csharp).to.include(
      "new global::js.Map<string, SymbolInfo>(globals.__tsonic_symbol_iterator())"
    );
  });

  it("infers empty collection constructors from readonly collection context", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export function tables(): int {
          const names: ReadonlySet<string> = new Set();
          const flags: ReadonlyMap<string, int> = new Map();
          return names.size + flags.size;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("new global::js.Set<string>()");
    expect(csharp).to.include("new global::js.Map<string, int>()");
  });

  it("resolves Node built-in globals and withFileTypes Dirent overloads from the nodejs surface", () => {
    const csharp = compileToCSharp(
      `
        import { readdirSync } from "node:fs";
        import { join } from "node:path";

        export function scan(directoryName: string): string {
          const entries = readdirSync(directoryName, { withFileTypes: true });
          let latest = process.cwd() + process.platform;
          for (const entry of entries) {
            const fileName = join(directoryName, entry.name);
            if (entry.isDirectory()) {
              latest = fileName;
              continue;
            }
            if (entry.isFile()) {
              latest = Buffer.from(fileName).toString();
            }
          }
          return latest;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/nodejs" }
    );

    expect(csharp).to.include("global::nodejs.FsModule.readdirSync");
    expect(csharp).to.include("global::nodejs.ProcessModule.process.cwd()");
    expect(csharp).to.include("global::nodejs.ProcessModule.process.platform");
    expect(csharp).to.include(".name");
    expect(csharp).to.include(".isDirectory()");
    expect(csharp).to.include(".isFile()");
    expect(csharp).to.include("global::nodejs.buffer.Buffer.from");
  });

  it("materializes object and array literals flowing into JsValue parameters", () => {
    const csharp = compileToCSharp(
      `
        import type { JsValue } from "@tsonic/core/types.js";

        export function isJsonObject(value: JsValue): value is Record<string, JsValue> {
          return typeof value === "object" && value !== null && !Array.isArray(value);
        }

        export function isJsonArray(value: JsValue): value is readonly JsValue[] {
          return Array.isArray(value);
        }

        export function run(): boolean {
          return isJsonObject({}) && isJsonArray([]);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "new global::System.Collections.Generic.Dictionary<string, object?>()"
    );
    expect(csharp).to.include("global::System.Array.Empty<object?>()");
    expect(csharp).to.not.include("new object");
  });

  it("erases compile-time type identity assertion calls before emission", () => {
    const csharp = compileToCSharp(`
      type Equal<Actual, Expected> =
        (<T>() => T extends Actual ? 1 : 2) extends
        (<T>() => T extends Expected ? 1 : 2) ? true : false;

      function assertType<_T extends true>(): void {}

      export class TypeIdentityTests {
        preserves_literal_identity(): void {
          assertType<Equal<"ready", "ready">>();
        }
      }
    `);

    expect(csharp).to.include("preserves_literal_identity()");
    expect(csharp).to.not.include("assertType");
    expect(csharp).to.not.include("Equal");
  });

  it("keeps satisfies constraints from replacing object literal result shapes", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const table = { one: 1, two: 2 } satisfies Record<string, number>;
        return table.two;
      }
    `);

    expect(csharp).to.include("table.two");
    expect(csharp).to.not.include("Dictionary<string, double>");
  });

  it("preserves nested object literal result shapes through satisfies constraints", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const table = {
          nested: {
            enabled: true,
            count: 7,
          },
        } satisfies { nested: Record<string, boolean | number> };
        return table.nested.enabled ? table.nested.count : 0;
      }
    `);

    expect(csharp).to.include("table.nested.enabled");
    expect(csharp).to.include("table.nested.count");
    expect(csharp).to.not.include("[\"enabled\"]");
    expect(csharp).to.not.include("[\"count\"]");
  });

  it("keeps satisfies method constraints without replacing the callable result shape", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const service = {
          read(value: int): int {
            return value + 1;
          },
        } satisfies { read(value: int): int };
        return service.read(41);
      }
    `);

    expect(csharp).to.include("service.read(41)");
    expect(csharp).to.not.include("Dictionary<string");
  });

  it("infers Map constructor type arguments from readonly map arguments without expected type", () => {
    const csharp = compileToCSharp(
      `
        type SymbolInfo = { name: string };
        type TypeEnvironment = ReadonlyMap<string, SymbolInfo>;

        export function clone(environment: TypeEnvironment): number {
          const loopEnvironment = new Map(environment);
          return loopEnvironment.size;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "new global::js.Map<string, SymbolInfo__Alias>(environment.__tsonic_symbol_iterator())"
    );
    expect(csharp).to.not.include("new global::js.Map<object");
  });

  it("infers Map constructor type arguments through transparent aliases to recursive union values", () => {
    const csharp = compileToCSharp(
      `
        type PrimitiveTypeName = "any" | "boolean" | "number" | "string" | "unknown" | "void";

        type CheckedType =
          | { readonly kind: PrimitiveTypeName | "unresolved" }
          | { readonly kind: "function"; readonly returnType: CheckedType };

        type TypeEnvironment = Map<string, CheckedType>;

        export function clone(environment: TypeEnvironment): number {
          const loopEnvironment = new Map(environment);
          return loopEnvironment.size;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "new global::js.Map<string, global::Test.CheckedType>(environment.__tsonic_symbol_iterator())"
    );
    expect(csharp).to.not.include("new global::js.Map<object");
  });

  it("expands Extract and narrows recursive discriminated unions without unknown tail members", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        enum Kind {
          ForStatement = 0,
          ForInStatement = 1,
          IfStatement = 2,
          Block = 3,
          Identifier = 4,
          SatisfiesExpression = 5,
          AsExpression = 6,
          MissingDeclaration = 7,
          VariableDeclarationList = 8,
        }

        interface MissingDeclaration { readonly kind: Kind.MissingDeclaration }
        interface VariableDeclarationList { readonly kind: Kind.VariableDeclarationList; readonly declarations: readonly BindingElement[] }
        interface BindingElement { readonly name?: BindingName }
        interface Identifier { readonly kind: Kind.Identifier; readonly text: string }
        type BindingName = Identifier;
        type TypeNode = Identifier;
        type ConciseBody = Block | Expression;
        type Expression = Identifier | SatisfiesExpression | AsExpression;
        interface SatisfiesExpression { readonly kind: Kind.SatisfiesExpression; readonly expression: Expression; readonly type: TypeNode }
        interface AsExpression { readonly kind: Kind.AsExpression; readonly expression: Expression; readonly type: TypeNode }
        interface Block { readonly kind: Kind.Block; readonly statements: readonly Statement[] }
        interface ForStatement { readonly kind: Kind.ForStatement; readonly initializer?: VariableDeclarationList | Expression | MissingDeclaration; readonly statement: Statement }
        interface ForInStatement { readonly kind: Kind.ForInStatement; readonly initializer: VariableDeclarationList | Expression; readonly expression: Expression; readonly statement: Statement }
        interface IfStatement { readonly kind: Kind.IfStatement; readonly expression: Expression; readonly thenStatement: Statement; readonly elseStatement?: Statement }
        type Statement = ForStatement | ForInStatement | IfStatement | Block;

        function isVariableDeclarationList(node: VariableDeclarationList | Expression | MissingDeclaration): node is VariableDeclarationList {
          return node.kind === Kind.VariableDeclarationList;
        }
        function isMissingDeclaration(node: VariableDeclarationList | Expression | MissingDeclaration): node is MissingDeclaration {
          return node.kind === Kind.MissingDeclaration;
        }
        function isIfStatement(node: Statement): node is IfStatement { return node.kind === Kind.IfStatement; }
        function isBlock(node: Statement | ConciseBody): node is Block { return node.kind === Kind.Block; }
        function isAsExpression(node: Expression): node is AsExpression { return node.kind === Kind.AsExpression; }
        function isSatisfiesExpression(node: Expression): node is SatisfiesExpression { return node.kind === Kind.SatisfiesExpression; }

        type CheckedType =
          | { readonly kind: "unknown" | "unresolved" }
          | { readonly kind: "function"; readonly returnType: CheckedType };

        const unknownType: CheckedType = { kind: "unknown" };

        export function checkStatement(statement: Statement): int {
          if (isIfStatement(statement)) {
            checkStatement(statement.thenStatement);
            if (statement.elseStatement !== undefined) {
              checkStatement(statement.elseStatement);
            }
            return 1;
          }
          if (isBlock(statement)) {
            return checkStatement(statement.statements[0]);
          }
          return 0;
        }

        function checkForInitializer(initializer: Extract<Statement, { readonly kind: Kind.ForStatement }>["initializer"] | Extract<Statement, { readonly kind: Kind.ForInStatement }>["initializer"]): void {
          if (initializer === undefined) return;
          if (isVariableDeclarationList(initializer)) return;
          if (isMissingDeclaration(initializer)) return;
          inferExpression(initializer);
        }

        function inferExpression(expression: Expression): CheckedType {
          if (isAsExpression(expression) || isSatisfiesExpression(expression)) {
            inferExpression(expression.expression);
            return typeFromTypeNode(expression.type);
          }
          return unknownType;
        }

        function typeFromTypeNode(_type: TypeNode): CheckedType {
          return unknownType;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("checkForInitializer(");
    expect(csharp).to.include("isSatisfiesExpression");
    expect(csharp).to.not.include("object? initializer");
  });

  it("stores array/object intersection properties through compiler-owned side storage", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        interface ReadonlyTextRange {
          readonly pos: int;
          readonly end: int;
        }

        export interface NodeArray<T> extends ReadonlyArray<T>, ReadonlyTextRange {
          hasTrailingComma?: boolean;
          transformFlags: int;
        }

        export function createNodeArray<T>(elements: readonly T[], pos: int, end: int): NodeArray<T> {
          const array = elements.slice() as unknown as T[] & {
            pos: int;
            end: int;
            transformFlags: int;
            hasTrailingComma?: boolean;
          };
          array.pos = pos;
          array.end = end;
          array.transformFlags = 0;
          return array as unknown as NodeArray<T>;
        }

        export function span<T>(items: readonly T[]): int {
          const nodes = createNodeArray(items, 3, 9);
          return nodes.pos + nodes.end + nodes.length;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("internal static class IntersectionStorage");
    expect(csharp).to.include("public static T[] createNodeArray<T>");
    expect(csharp).to.not.include("interface NodeArray");
    expect(csharp).to.include(
      'global::Tsonic.Internal.IntersectionStorage.Set<int>(array, "pos", pos)'
    );
    expect(csharp).to.include(
      'global::Tsonic.Internal.IntersectionStorage.GetRequired<int>((T[])nodes, "pos")'
    );
    expect(csharp).to.include("nodes.Length");
  });

  it("adapts narrowed optional value-type returns to declared non-null value types", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export function normalizeDelay(value?: int): int {
          if (value === undefined || value <= 0) {
            return 0 as int;
          }
          return value;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    const normalizeDelayBody =
      /private static int normalizeDelay__Impl\(int\? value = default\)\s*\{(?<body>[\s\S]*?)\n        \}/.exec(
        csharp
      )?.groups?.body;
    expect(normalizeDelayBody).to.include("return (int)value;");
    expect(normalizeDelayBody).to.not.include("return value;");
  });

  it("adapts optional value-type conditional branches to declared non-null returns", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        declare function getBufferLength(): int;

        export const resolveWriteLength = (
          offset: int,
          length?: int
        ): int =>
          length === undefined
            ? ((getBufferLength() - offset) as int)
            : length;
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "return length == null ? (int)(getBufferLength() - offset) : (int)length;"
    );
    expect(csharp).to.not.include(
      "return length == null ? (int)(getBufferLength() - offset) : length;"
    );
  });

  it("does not preserve stale nullish flow assertions after try-block assignments", () => {
    const csharp = compileToCSharp(`
      class Bytes {}

      export class Holder {
        body: Bytes | null = null;

        load(): Bytes {
          if (this.body !== null) {
            return this.body;
          }

          try {
            this.body = new Bytes();
          } finally {
            void 0;
          }

          return this.body;
        }
      }
    `);

    expect(csharp).to.include("return this.body;");
    expect(csharp).to.not.include("return (object)this.body;");
  });

  it("uses nominal object initialization for property-only interfaces that emit as classes", () => {
    const csharp = compileToCSharp(`
      interface FlagTable {
        readonly None: number;
        readonly Any: number;
      }

      export const Flags: FlagTable = {
        None: 0,
        Any: 1,
      };
    `);

    expect(csharp).to.include("public class FlagTable");
    expect(csharp).to.include("new FlagTable { None = 0, Any = 1 }");
    expect(csharp).to.not.include("__TsonicInterfaceObjectAdapter");
  });

  it("fills omitted optional members when adapting object literals to native interfaces", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      interface Node {
        kind(): int;
      }

      interface Symbol {
        readonly name?: string;
        flags?: int;
        declarations: Node[];
        describe(): string;
      }

      export function makeSymbol(declarations: Node[]): Symbol {
        return {
          declarations,
          describe: () => "symbol",
        };
      }
    `);

    expect(csharp).to.include(": global::Test.Symbol");
    expect(csharp).to.include("string? global::Test.Symbol.name");
    expect(csharp).to.include("int? global::Test.Symbol.flags");
    expect(csharp).to.include("default(string?)");
    expect(csharp).to.include("default(int?)");
    expect(csharp).to.not.include("new global::Test.Symbol");
  });

  it("emits generic native-interface object adapters as generic classes", () => {
    const csharp = compileToCSharp(`
      interface Box<T> {
        readonly value: T;
        readonly stop: boolean;
        done(): boolean;
      }

      export function makeBox<T>(value: T): Box<T> {
        return {
          value,
          stop: false,
          done: () => false,
        };
      }
    `);

    expect(csharp).to.match(
      /class __TsonicInterfaceObjectAdapter_[a-f0-9]+<T> : global::Test\.Box<T>/
    );
    expect(csharp).to.match(/new global::Test\.__TsonicInterfaceObjectAdapter_[a-f0-9]+<T>\(/);
  });

  it("does not let contextual union returns broaden generic argument inference", () => {
    const csharp = compileToCSharp(`
      interface Node {
        kind(): number;
      }

      interface ObjectBindingPattern extends Node {
        readonly elements: string[];
      }

      interface ArrayBindingPattern extends Node {
        readonly elements: number[];
      }

      type BindingName = ObjectBindingPattern | ArrayBindingPattern;

      declare function makeObjectBindingPattern(elements: string[]): ObjectBindingPattern;

      function finishNode<T extends Node>(node: T): T {
        return node;
      }

      export function parseBindingName(): BindingName {
        const node = makeObjectBindingPattern([]);
        return finishNode(node);
      }
    `);

    expect(csharp).to.include("finishNode(node)");
    expect(csharp).to.not.include("finishNode<global::Test.BindingName>");
    expect(csharp).to.not.include(
      "finishNode<global::Test.BindingName>(global::Test.BindingName"
    );
  });

  it("projects union aliases to shared base interfaces for predicate guards", () => {
    const csharp = compileToCSharp(`
      enum Kind {
        Identifier = 1,
        PrivateIdentifier = 2,
        ComputedPropertyName = 3,
      }

      interface Node {
        readonly kind: Kind;
      }

      interface Identifier extends Node {
        readonly kind: Kind.Identifier;
        readonly text: string;
      }

      interface PrivateIdentifier extends Node {
        readonly kind: Kind.PrivateIdentifier;
        readonly text: string;
      }

      interface ComputedPropertyName extends Node {
        readonly kind: Kind.ComputedPropertyName;
        readonly expression: Node;
      }

      type PropertyName = Identifier | PrivateIdentifier | ComputedPropertyName;

      declare function isIdentifier(node: Node): node is Identifier;
      declare function isPrivateIdentifier(node: Node): node is PrivateIdentifier;

      export function readName(name: PropertyName): string {
        if (isIdentifier(name) || isPrivateIdentifier(name)) {
          return name.text;
        }
        return "";
      }
    `);

    expect(csharp).to.include(".Match<Node>(");
    expect(csharp).to.not.include("(global::Test.Node)name");
    expect(csharp).to.not.include("return name.text;");
  });

  it("infers generic callback result type from the surrounding call result context", () => {
    const csharp = compileToCSharp(`
      interface Expression {
        kind(): number;
      }

      interface SpreadElement extends Expression {
        spread(): boolean;
      }

      declare function parseExpression(): Expression;
      declare function createSpreadElement(): SpreadElement;

      function inContext<T>(f: () => T): T {
        return f();
      }

      export function parseArgumentExpression(condition: boolean): Expression {
        return inContext(() => {
          if (condition) {
            return createSpreadElement();
          }
          return parseExpression();
        });
      }
    `);

    expect(csharp).to.include("parseArgumentExpression(bool condition)");
    expect(csharp).to.not.include("<unknown>");
    expect(csharp).to.not.include("<object>");
  });

  it("preserves generic nullish callback returns in delegate parameter types", () => {
    const csharp = compileToCSharp(`
      interface Node {
        readonly kind: number;
      }

      interface Identifier extends Node {
        readonly text: string;
      }

      declare function parseIdentifier(): Identifier;

      function collect<T extends Node>(parseElement: () => T | undefined): T[] {
        const element = parseElement();
        if (element === undefined) {
          return [];
        }
        return [element];
      }

      export function run(): Identifier[] {
        return collect(() => parseIdentifier());
      }
    `);

    expect(csharp).to.include("global::System.Func<T?> parseElement");
    expect(csharp).to.not.include("global::System.Func<object?> parseElement");
  });
});
