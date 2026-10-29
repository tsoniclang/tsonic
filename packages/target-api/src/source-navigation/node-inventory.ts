import type { CheckedSourceProgram, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

export function createSourceNodeInventory(
  source: Pick<CheckedSourceProgram, "ast" | "containsSourceFile">,
  sourceFiles: readonly SourceFile[],
): Pick<SourceProgramNavigation, "nodes" | "nodesForFiles"> {
  const defaultFiles = Object.freeze([...sourceFiles]);
  const byFile = new WeakMap<SourceFile, readonly Node[]>();
  const selectNodes = (files: readonly SourceFile[]): readonly Node[] => {
    const selectedFiles = new Set<SourceFile>();
    for (const file of files) {
      if (!source.containsSourceFile(file)) {
        throw new Error("Source node inventories require exact checked source-file ownership.");
      }
      if (selectedFiles.has(file)) {
        throw new Error("Source node inventories require distinct source files.");
      }
      selectedFiles.add(file);
    }
    const selected: Node[] = [];
    for (let fileIndex = files.length - 1; fileIndex >= 0; fileIndex -= 1) {
      const file = files[fileIndex]!;
      let nodes = byFile.get(file);
      if (nodes === undefined) {
        const original: Node[] = [];
        const visited = new Set<Node>();
        const pending: Node[] = [file];
        while (pending.length !== 0) {
          const node = pending.pop()!;
          if (visited.has(node)) continue;
          visited.add(node);
          original.push(node);
          const children: Node[] = [];
          source.ast.forEachChild(node, child => {
            if (child !== undefined) children.push(child);
          });
          for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
            pending.push(children[childIndex]!);
          }
        }
        nodes = Object.freeze(original);
        byFile.set(file, nodes);
      }
      for (const node of nodes) selected.push(node);
    }
    return Object.freeze(selected);
  };
  const nodes = selectNodes(defaultFiles);
  return Object.freeze({
    nodes,
    nodesForFiles(files: readonly SourceFile[]): readonly Node[] {
      return files.length === defaultFiles.length && files.every((file, index) => file === defaultFiles[index])
        ? nodes
        : selectNodes(files);
    },
  });
}
