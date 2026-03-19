import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLibraryBuild, writeLibraryScaffold } from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
  it("keeps source alias surfaces free of synthetic helper tokens", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-alias-tokens-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(
        dir,
        "Acme.Alias",
        "Acme.Alias"
      );
      mkdirSync(join(dir, "packages", "lib", "src", "types"), {
        recursive: true,
      });

      writeFileSync(
        join(dir, "packages", "lib", "src", "types", "result.ts"),
        [
          `export type SuccessResult = { ok: true; value: string };`,
          `export type FailureResult = { ok: false; error: string };`,
          `export type Result = SuccessResult | FailureResult;`,
          `export type Wrapped = Promise<Result>;`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "api.ts"),
        [
          `import type { Result, Wrapped } from "./types/result.ts";`,
          `import { Exception } from "@tsonic/dotnet/System.js";`,
          ``,
          `export type UserPayload = { id: string; active: boolean };`,
          `export type FetchUser = Wrapped;`,
          ``,
          `export function fetchUser(_id: string): Result {`,
          `  throw new Exception("not-implemented");`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "bridge.ts"),
        [
          `export { fetchUser } from "./api.ts";`,
          `export type { FetchUser, UserPayload } from "./api.ts";`,
          `export type { Result, SuccessResult, FailureResult, Wrapped } from "./types/result.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `export { fetchUser } from "./bridge.ts";`,
          `export type {`,
          `  FetchUser,`,
          `  UserPayload,`,
          `  Result,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  Wrapped,`,
          `} from "./bridge.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const facade = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Alias.d.ts"
        ),
        "utf-8"
      );
      const startMarker = "// Tsonic source type aliases (generated)";
      const endMarker = "// End Tsonic source type aliases";
      const start = facade.indexOf(startMarker);
      const end = facade.indexOf(endMarker);

      expect(start).to.be.greaterThan(-1);
      expect(end).to.be.greaterThan(start);

      const sourceAliasBlock = facade.slice(start, end);
      expect(sourceAliasBlock).to.include("export type FetchUser");
      expect(sourceAliasBlock).to.not.match(/\$instance|__\d+\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps overload implementation helpers out of source-package public surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-overload-family-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(
        dir,
        "Acme.Overloads",
        "Acme.Overloads"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export class Parser {",
          "  parse(text: string): string;",
          "  parse(text: string, radix: number): string;",
          "  parse(text: string, radix: number = 10): string {",
          "    return `${text}:${radix}`;",
          "  }",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Overloads",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      expect(internal).to.include("parse(text: string): string;");
      expect(internal).to.include(
        "parse(text: string, radix: number): string;"
      );
      expect(internal).to.not.include("__tsonic_overload_impl_parse");

      const bindings = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic",
            "bindings",
            "Acme.Overloads",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly alias?: string;
          readonly methods?: ReadonlyArray<{
            readonly clrName?: string;
            readonly overloadFamily?: {
              readonly ownerKind?: string;
              readonly publicName?: string;
              readonly role?: string;
              readonly publicSignatureCount?: number;
              readonly publicSignatureIndex?: number;
              readonly implementationName?: string;
            };
          }>;
        }>;
      };

      const parserType = bindings.types?.find(
        (type) => type.alias === "Acme.Overloads.Parser"
      );
      expect(parserType).to.not.equal(undefined);

      const methods = parserType?.methods ?? [];
      expect(
        methods.some(
          (method) => method.clrName === "__tsonic_overload_impl_parse"
        )
      ).to.equal(false);

      const parseMethods = methods.filter(
        (method) => method.clrName === "parse"
      );
      expect(parseMethods).to.have.length(2);
      expect(
        parseMethods.map(
          (method) => method.overloadFamily?.publicSignatureIndex
        )
      ).to.deep.equal([0, 1]);
      for (const method of parseMethods) {
        expect(method.overloadFamily).to.deep.equal({
          ownerKind: "method",
          publicName: "parse",
          role: "publicOverload",
          publicSignatureCount: 2,
          publicSignatureIndex: method.overloadFamily?.publicSignatureIndex,
          implementationName: "__tsonic_overload_impl_parse",
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports synthetic __Anon declarations as type-only surface", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-anon-type-"));
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Acme.Anon", "Acme.Anon");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `function id<T>(x: T): T {`,
          `  return x;`,
          `}`,
          ``,
          `export const current = id({ ok: true, reason: "fresh" });`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Anon",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      const facade = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Anon.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.match(/__Anon_/);
      expect(facade).to.match(/export type \{ __Anon_/);
      expect(facade).to.not.match(/export \{ __Anon_/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
