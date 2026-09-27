import { SourceFile_FileName } from "../internal/ast/ast.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { Program_GetSourceFile } from "../internal/compiler/program.js";
import { getExtensionHost } from "../extensions/host.js";
export function assertSemanticProgramActive(program) {
    if (program !== undefined)
        getExtensionHost(program)?.assertCompilerProgramActive();
}
export function assertSemanticSourceFileOwned(program, sourceFile) {
    assertSemanticProgramActive(program);
    if (Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile) {
        throw new Error("Source semantic queries cannot use a source file from a different compiler program or epoch.");
    }
}
export function assertSemanticNodeOwned(program, node) {
    assertSemanticProgramActive(program);
    if (program === undefined || node === undefined)
        return;
    const sourceFile = GetSourceFileOfNode(node);
    if (sourceFile === undefined) {
        throw new Error("Source semantic queries require a node from their owning compiler program.");
    }
    assertSemanticSourceFileOwned(program, sourceFile);
}
export function assertSemanticSymbolOwned(program, symbol) {
    assertSemanticProgramActive(program);
    if (symbol === undefined)
        return;
    for (const declaration of symbol.Declarations ?? [])
        assertSemanticNodeOwned(program, declaration);
    assertSemanticNodeOwned(program, symbol.ValueDeclaration);
}
export function assertSemanticTypeOwned(program, type) {
    assertSemanticProgramActive(program);
    if (program === undefined || type === undefined)
        return;
    const checker = type.checker;
    if (checker === undefined) {
        assertSemanticSymbolOwned(program, type.symbol);
        return;
    }
    const owner = getExtensionHost(program);
    const typeOwner = getExtensionHost(checker.program);
    typeOwner?.assertCompilerProgramActive();
    if (owner !== undefined && owner !== typeOwner) {
        throw new Error("Source semantic queries cannot use a type from a different compiler program or epoch.");
    }
}
export function assertSemanticSignatureOwned(program, signature) {
    assertSemanticProgramActive(program);
    if (signature === undefined)
        return;
    assertSemanticNodeOwned(program, signature.declaration);
    assertSemanticTypeOwned(program, signature.resolvedReturnType);
    if (signature.declaration === undefined) {
        for (const parameter of signature.parameters ?? [])
            assertSemanticSymbolOwned(program, parameter);
        assertSemanticSymbolOwned(program, signature.thisParameter);
    }
}
//# sourceMappingURL=semantic-query-ownership.js.map