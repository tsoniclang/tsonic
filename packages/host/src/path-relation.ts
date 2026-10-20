import { isAbsolute, relative, sep } from "node:path";

export function isPathWithinOrEqual(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath);
  return relativePath === "" || isRelativeDescendantPath(relativePath);
}

export function isPathStrictlyWithin(parentPath: string, candidatePath: string): boolean {
  const relativePath = relative(parentPath, candidatePath);
  return relativePath !== "" && isRelativeDescendantPath(relativePath);
}

function isRelativeDescendantPath(relativePath: string): boolean {
  return relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath);
}
