import { relative, resolve } from "node:path";
export function sourceFileIdentity(ast, sourceFile) {
    return sourceFile === undefined ? undefined : ast.getPath(sourceFile);
}
export function sourceNodeIdentity(ast, node) {
    if (node === undefined) {
        return undefined;
    }
    const sourceFile = ast.getSourceFile(node);
    const file = sourceFileIdentity(ast, sourceFile);
    const kind = ast.kind(node);
    return file === undefined || kind === undefined
        ? undefined
        : `${file}\u0000${kind}\u0000${ast.pos(node)}\u0000${ast.end(node)}`;
}
export function projectSourceNodeIdentity(ast, node, projectRoot) {
    if (node === undefined) {
        return undefined;
    }
    const sourceFile = ast.getSourceFile(node);
    const file = sourceFile === undefined ? undefined : ast.getFileName(sourceFile);
    const kind = ast.kind(node);
    if (file === undefined || kind === undefined) {
        return undefined;
    }
    const projectPath = normalizePath(resolve(projectRoot));
    const sourcePath = normalizePath(resolve(file));
    const projectRelativePath = normalizePath(relative(projectPath, sourcePath));
    if (projectRelativePath.length === 0 ||
        projectRelativePath === "." ||
        projectRelativePath === ".." ||
        projectRelativePath.startsWith("../")) {
        return undefined;
    }
    return `${projectRelativePath}\u0000${kind}\u0000${ast.pos(node)}\u0000${ast.end(node)}`;
}
export function sourceNodesEqual(ast, left, right) {
    const leftIdentity = sourceNodeIdentity(ast, left);
    return leftIdentity !== undefined &&
        leftIdentity === sourceNodeIdentity(ast, right);
}
function normalizePath(value) {
    return value.split("\\").join("/");
}
//# sourceMappingURL=identity.js.map