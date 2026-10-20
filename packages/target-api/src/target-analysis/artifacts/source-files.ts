import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import { sourceFileIdentity } from "../../source-navigation/identity.js";

export interface SourceArtifactFile {
  readonly sourceFile: SourceFile;
  readonly owner: string;
  readonly dependencies: readonly { readonly owner: string; readonly facet: "source-file-public-surface" | "source-file-implementation" }[];
}

export type SourceArtifactIssue =
  | { readonly kind: "source-identity" | "source-conflict"; readonly sourceFile: SourceFile; readonly owner?: string }
  | { readonly kind: "module-identity" | "construction-identity"; readonly sourceFile: SourceFile; readonly owner: string };

export function analyzeSourceArtifactFiles(input: {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly navigation: Pick<SourceProgramNavigation, "moduleReferences">;
  readonly constructions: readonly { readonly sourceFile: SourceFile; readonly targetSourceFile: SourceFile }[];
}): { readonly files: readonly SourceArtifactFile[]; readonly issues: readonly SourceArtifactIssue[] } {
  const owners = new Map<SourceFile, string>();
  const filesByOwner = new Map<string, SourceFile>();
  const issues: SourceArtifactIssue[] = [];
  for (const file of input.sourceFiles) {
    const identity = sourceFileIdentity(input.ast, file);
    if (identity === undefined) { issues.push(Object.freeze({ kind: "source-identity", sourceFile: file })); continue; }
    const owner = `source-file:${identity}`;
    const existing = filesByOwner.get(owner);
    if (existing !== undefined && existing !== file) { issues.push(Object.freeze({ kind: "source-conflict", sourceFile: file, owner })); continue; }
    filesByOwner.set(owner, file);
    owners.set(file, owner);
  }
  const files: SourceArtifactFile[] = [];
  for (const [file, owner] of owners) {
    const dependencies = new Map<string, SourceArtifactFile["dependencies"][number]>();
    const add = (target: SourceFile, construction: boolean): void => {
      const dependencyOwner = owners.get(target);
      if (dependencyOwner === undefined) {
        issues.push(Object.freeze({ kind: construction ? "construction-identity" : "module-identity", sourceFile: file, owner }));
        return;
      }
      if (dependencyOwner === owner) return;
      const facet = construction ? "source-file-implementation" : "source-file-public-surface";
      dependencies.set(`${dependencyOwner.length}:${dependencyOwner}:${facet}`, Object.freeze({ owner: dependencyOwner, facet }));
    };
    for (const reference of input.navigation.moduleReferences(file)) add(reference.sourceFile, false);
    for (const construction of input.constructions) if (construction.sourceFile === file) add(construction.targetSourceFile, true);
    files.push(Object.freeze({ sourceFile: file, owner, dependencies: Object.freeze([...dependencies.values()].sort((left, right) =>
      left.owner.localeCompare(right.owner, "en") || left.facet.localeCompare(right.facet, "en"))) }));
  }
  return Object.freeze({ files: Object.freeze(files), issues: Object.freeze(issues) });
}
