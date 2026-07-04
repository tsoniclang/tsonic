import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

export function collectProjectModuleSpecifiers(projectRoot: string, outputRoot: string): readonly string[] {
  const specifiers = new Set<string>();
  visitDirectory(projectRoot, outputRoot, specifiers);
  return [...specifiers].sort();
}

function visitDirectory(directory: string, outputRoot: string, specifiers: Set<string>): void {
  if (pathIsWithinOrEqual(outputRoot, directory)) {
    return;
  }
  if (!existsSync(directory)) {
    return;
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      visitDirectory(fullPath, outputRoot, specifiers);
      continue;
    }
    if (!entry.isFile() || !isSourceFile(entry.name)) {
      continue;
    }
    collectModuleSpecifiersFromText(readFileSync(fullPath, "utf8"), specifiers);
  }
}

function collectModuleSpecifiersFromText(sourceText: string, specifiers: Set<string>): void {
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?(["'])([^"']+)\1/g,
    /\bexport\s+(?:type\s+)?[^"'`]*?\s+from\s+(["'])([^"']+)\1/g,
    /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[2];
      if (specifier !== undefined && specifier.length > 0) {
        specifiers.add(specifier);
      }
    }
  }
}

function shouldSkipEntry(name: string): boolean {
  return name === ".git" ||
    name === ".temp" ||
    name === "bin" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "obj";
}

function pathIsWithinOrEqual(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath);
  return relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function isSourceFile(name: string): boolean {
  return /\.(?:mts|ts)$/.test(name) && !/\.d\.(?:mts|ts)$/.test(name);
}
