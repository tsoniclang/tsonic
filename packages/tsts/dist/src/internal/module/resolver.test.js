// Mirror of internal/module/resolver_test.go (TestResolveModuleNameTrailingSlash).
// TestResolveModuleNameTrailingSlashRace exercises a goroutine race on the
// package.json info cache with a blocking FS; the TSTS runtime is
// single-threaded, so the interleaving cannot occur and the race test has no
// mirror. BenchmarkParse-style benchmarks likewise have no mirrors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ModuleKindESNext, ModuleResolutionKindBundler, ScriptTargetESNext } from "../core/compileroptions.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
import { ResolvedModule_IsResolved } from "./types.js";
import { NewResolver, Resolver_ResolveModuleName } from "./resolver.js";
test("ResolveModuleNameTrailingSlash", () => {
    const fs = FromMap(new Map([
        ["/repo/node_modules/pkg/package.json", '{"name":"pkg","main":"main.js","types":"main.d.ts"}'],
        ["/repo/node_modules/pkg/main.d.ts", "export const x: number;"],
        ["/repo/node_modules/pkg/main.js", "exports.x = 1;"],
        ["/repo/src/file.ts", ""],
    ]), true);
    const host = {
        FS: () => fs,
        GetCurrentDirectory: () => "/repo",
    };
    const opts = {
        ModuleResolution: ModuleResolutionKindBundler,
        Module: ModuleKindESNext,
        Target: ScriptTargetESNext,
    };
    const resolver = NewResolver(host, opts, "", "");
    for (const name of ["pkg", "pkg/"]) {
        const [r] = Resolver_ResolveModuleName(resolver, name, "/repo/src/file.ts", ModuleKindESNext, undefined);
        assert.ok(ResolvedModule_IsResolved(r), `${JSON.stringify(name)} failed to resolve`);
    }
});
//# sourceMappingURL=resolver.test.js.map