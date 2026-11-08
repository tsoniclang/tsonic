import type { AstReader, CheckedSourceProgram, Node, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "./types.js";

export function createSourceSyntaxDomain(ast: Pick<AstReader, "getSourceFile" | "parent" | "forEachChild">, owner: Node): (node: Node) => boolean {
  const file = ast.getSourceFile(owner);
  const retained = new WeakMap<Node, boolean>();
  const children = new WeakMap<Node, ReadonlySet<Node>>();
  const contains = (node: Node): boolean => {
    if (file === undefined || ast.getSourceFile(node) !== file) return false;
    const pending: Node[] = [];
    const visited = new Set<Node>();
    let original = false;
    for (let current: Node = node;;) {
      if (visited.has(current)) break;
      visited.add(current);
      const existing = retained.get(current);
      if (existing !== undefined) { original = existing; break; }
      pending.push(current);
      if (current === file) { original = true; break; }
      const parent = ast.parent(current);
      if (parent === undefined) break;
      let actual = children.get(parent);
      if (actual === undefined) {
        const selected = new Set<Node>();
        ast.forEachChild(parent, child => { if (child !== undefined) selected.add(child); });
        actual = selected;
        children.set(parent, actual);
      }
      if (!actual.has(current)) break;
      current = parent;
    }
    for (const current of pending) retained.set(current, original);
    return original;
  };
  const admitted = contains(owner);
  return node => admitted && contains(node);
}

export function createSourceNodeInventory(
  source: Pick<CheckedSourceProgram, "ast" | "containsSourceFile">,
  sourceFiles: readonly SourceFile[],
): Pick<SourceProgramNavigation, "nodes" | "nodesForFiles"> & { readonly contains: (node: Node) => boolean } {
  const defaultFiles = Object.freeze([...sourceFiles]);
  const byFile = new WeakMap<SourceFile, {
    readonly nodes: readonly Node[];
    readonly domain: ReadonlySet<Node>;
  }>();
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
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex]!;
      let entry = byFile.get(file);
      if (entry === undefined) {
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
        entry = { nodes: Object.freeze(original), domain: visited };
        byFile.set(file, entry);
      }
      for (const node of entry.nodes) selected.push(node);
    }
    return Object.freeze(selected);
  };
  const nodes = selectNodes(defaultFiles);
  return Object.freeze({
    nodes,
    contains(node: Node): boolean {
      const file = source.ast.getSourceFile(node);
      if (file === undefined || !source.containsSourceFile(file)) return false;
      if (!byFile.has(file)) selectNodes([file]);
      return byFile.get(file)!.domain.has(node);
    },
    nodesForFiles(files: readonly SourceFile[]): readonly Node[] {
      return files.length === defaultFiles.length && files.every((file, index) => file === defaultFiles[index])
        ? nodes
        : selectNodes(files);
    },
  });
}
