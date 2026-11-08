export function createSourceSyntaxDomain(ast, owner) {
    const file = ast.getSourceFile(owner);
    return node => file !== undefined && ast.getSourceFile(node) === file;
}
export function createSourceNodeInventory(source, sourceFiles) {
    const defaultFiles = Object.freeze([...sourceFiles]);
    const byFile = new WeakMap();
    const selectNodes = (files) => {
        const selectedFiles = new Set();
        for (const file of files) {
            if (!source.containsSourceFile(file)) {
                throw new Error("Source node inventories require exact checked source-file ownership.");
            }
            if (selectedFiles.has(file)) {
                throw new Error("Source node inventories require distinct source files.");
            }
            selectedFiles.add(file);
        }
        const selected = [];
        for (let fileIndex = files.length - 1; fileIndex >= 0; fileIndex -= 1) {
            const file = files[fileIndex];
            let nodes = byFile.get(file);
            if (nodes === undefined) {
                const original = [];
                const visited = new Set();
                const pending = [file];
                while (pending.length !== 0) {
                    const node = pending.pop();
                    if (visited.has(node))
                        continue;
                    visited.add(node);
                    original.push(node);
                    const children = [];
                    source.ast.forEachChild(node, child => {
                        if (child !== undefined)
                            children.push(child);
                    });
                    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
                        pending.push(children[childIndex]);
                    }
                }
                nodes = Object.freeze(original);
                byFile.set(file, nodes);
            }
            for (const node of nodes)
                selected.push(node);
        }
        return Object.freeze(selected);
    };
    const nodes = selectNodes(defaultFiles);
    return Object.freeze({
        nodes,
        nodesForFiles(files) {
            return files.length === defaultFiles.length && files.every((file, index) => file === defaultFiles[index])
                ? nodes
                : selectNodes(files);
        },
    });
}
//# sourceMappingURL=node-inventory.js.map