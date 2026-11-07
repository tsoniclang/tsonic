import { createJsSourceApiFacts } from "../../../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { buildHostSourceProgram } from "../../../../packages/target-api/dist/source-semantics/target-source-program.js";
// A Host program with its checker views and host-input adapter (the HostSourceProgramFixture shape), JS profile on.
function hostProgramFixture(checked) {
    const built = buildHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
    return Object.freeze(Object.assign(Object.create(null), built.program, { semantics: built.semantics, input: built.input }));
}

import { sourceExpressionCallArgument } from "../../../../packages/target-api/dist/source-navigation/callable-arguments.js";
import { Node_Expression } from "../../../../packages/target-api/dist/source-navigation/ast.js";
function fixture(body, inline = false) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": `export {};
declare function consume(callback: (value: unknown) => void): void;
declare const construct: new (callback: (value: unknown) => void) => object;
${body}`,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)));
    const source = hostProgramFixture(checked);
    let expression;
    const declarations = new Map();
    const calls = [];
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const visit = (node) => {
        if (source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsVariableDeclaration(node)) {
            const name = source.ast.name(node);
            if (name !== undefined)
                declarations.set(source.ast.text(name), node);
        }
        if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node))
            calls.push(node);
        if (inline && (source.ast.is.IsArrowFunction(node) || source.ast.is.IsFunctionExpression(node)))
            expression = node;
        if (source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "callback") {
            expression = source.ast.as.AsVariableDeclaration(node)?.Initializer;
        }
        source.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(file);
    assert.ok(expression);
    const nativeDeclarations = new Set([declarations.get("consume"), declarations.get("construct")]);
    const directCalls = calls.filter(call => {
        const callee = Node_Expression(source.ast, call);
        const declaration = callee === undefined ? undefined : source.navigation.sourceReferenceFor(callee)?.declaration;
        return declaration !== undefined && nativeDeclarations.has(declaration);
    });
    return { source, expression: expression, declarations, select() {
            const selected = [];
            for (const call of directCalls) {
                let reference = source.ast.arguments(call)[0];
                for (let depth = 0; reference !== undefined; depth += 1) {
                    const wrapped = source.ast.is.IsParenthesizedExpression(reference) || source.ast.is.IsSatisfiesExpression(reference) ||
                        source.ast.is.IsAsExpression(reference) || source.ast.is.IsNonNullExpression(reference) || source.ast.is.IsSpreadElement(reference);
                    if (!wrapped)
                        break;
                    if (depth >= 256)
                        return undefined;
                    reference = Node_Expression(source.ast, reference);
                }
                const argument = reference === undefined ? undefined : sourceExpressionCallArgument(reference, source);
                if (argument === undefined || argument.call !== call)
                    return undefined;
                selected.push(argument);
            }
            return selected.length === 0 ? undefined : Object.freeze(selected);
        } };
}
export { fixture };
