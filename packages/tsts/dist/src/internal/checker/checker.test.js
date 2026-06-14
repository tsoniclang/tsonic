// Mirror of internal/checker/checker_test.go (TestGetSymbolAtLocation).
// BenchmarkNewChecker is a Go benchmark and has no mirror.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Background } from "../../go/context.js";
import { Node_Name } from "../ast/spine.js";
import { Node_Expression } from "../ast/ast.js";
import { AsVariableDeclarationList, AsVariableStatement } from "../ast/generated/casts.js";
import { LibPath, WrapFS } from "../bundled/bundled.js";
import { NewCompilerHost } from "../compiler/host.js";
import { NewProgram, Program_BindSourceFiles, Program_GetSourceFile, Program_GetTypeChecker } from "../compiler/program.js";
import { Checker_GetSymbolAtLocation } from "./checker/symbols.js";
import { GetParsedCommandLineOfConfigFile } from "../tsoptions/tsconfigparsing.js";
import { FromMap } from "../vfs/vfstest/vfstest.js";
test("GetSymbolAtLocation", () => {
    const content = `interface Foo {
  bar: string;
}
declare const foo: Foo;
foo.bar;`;
    let fs = FromMap(new Map([
        ["/foo.ts", content],
        ["/tsconfig.json", `
				{
					"compilerOptions": {},
					"files": ["foo.ts"]
				}
			`],
    ]), false /*useCaseSensitiveFileNames*/);
    fs = WrapFS(fs);
    const cd = "/";
    const host = NewCompilerHost(cd, fs, LibPath(), undefined, undefined);
    const [parsed, errors] = GetParsedCommandLineOfConfigFile("/tsconfig.json", {}, undefined, host, undefined);
    assert.equal((errors ?? []).length, 0, "Expected no errors in parsed command line");
    const p = NewProgram({
        Config: parsed,
        Host: host,
    });
    Program_BindSourceFiles(p);
    const [c, done] = Program_GetTypeChecker(p, Background());
    try {
        const file = Program_GetSourceFile(p, "/foo.ts");
        assert.ok(file !== undefined);
        const interfaceId = Node_Name(file.Statements.Nodes[0]);
        const varId = Node_Name(AsVariableDeclarationList(AsVariableStatement(file.Statements.Nodes[1]).DeclarationList).Declarations.Nodes[0]);
        const propAccess = Node_Expression(file.Statements.Nodes[2]);
        const nodes = [interfaceId, varId, propAccess];
        for (const node of nodes) {
            const symbol = Checker_GetSymbolAtLocation(c, node);
            assert.ok(symbol !== undefined, "Expected symbol to be non-nil");
        }
    }
    finally {
        done();
    }
});
//# sourceMappingURL=checker.test.js.map