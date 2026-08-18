import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export function collectFiles(root, {
  extensions,
  exclude = [],
} = {}) {
  const absoluteRoot = resolve(root);
  const extensionSet = extensions === undefined ? undefined : new Set(extensions);
  const excluded = exclude.map(normalizeRelativePath);
  const files = [];
  visit(absoluteRoot);
  return Object.freeze(files.sort());

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = normalizeRelativePath(relative(absoluteRoot, absolutePath));
      if (excluded.some((prefix) =>
        relativePath === prefix || relativePath.startsWith(`${prefix}/`)
      )) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (
        entry.isFile() &&
        (
          extensionSet === undefined ||
          [...extensionSet].some((extension) => entry.name.endsWith(extension))
        )
      ) {
        files.push(relativePath);
      }
    }
  }
}

export function readSourceInventory(root, options) {
  return new Map(
    collectFiles(root, options).map((path) => [
      path,
      readFileSync(resolve(root, path), "utf8"),
    ]),
  );
}

export function lineCount(text) {
  if (text.length === 0) {
    return 0;
  }
  return text.split(/\r?\n/u).length;
}

export function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function normalizeRelativePath(path) {
  return path.split(sep).join("/").replace(/^\.\//u, "");
}
