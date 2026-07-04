export const tsonicSourceProfileVirtualDirectory = ".tsonic/source-profiles";

export interface TargetSourceProfileDeclaration {
  readonly fileName: string;
  readonly text: string;
}

export interface TargetSourceProfileContributions {
  readonly declarations?: readonly TargetSourceProfileDeclaration[];
}

export function targetSourceProfileDeclaration(fileName: string, text: string): TargetSourceProfileDeclaration {
  return { fileName, text };
}

export function normalizeTargetSourceProfileSegment(value: string): string {
  return encodeURIComponent(value).replace(/%/gu, "_").replace(/\./gu, "_");
}

export function isTsonicSourceProfileDeclarationPath(fileName: string, ownerId?: string): boolean {
  const normalizedFileName = normalizePath(fileName);
  const directory = normalizePath(tsonicSourceProfileVirtualDirectory);
  if (ownerId === undefined) {
    return normalizedFileName.includes(`/${directory}/`) ||
      normalizedFileName.startsWith(`${directory}/`);
  }
  const ownerSegment = normalizeTargetSourceProfileSegment(ownerId);
  return normalizedFileName.includes(`/${directory}/${ownerSegment}/`) ||
    normalizedFileName.startsWith(`${directory}/${ownerSegment}/`);
}

function normalizePath(value: string): string {
  return value.split("\\").join("/").replace(/\/+$/u, "");
}
