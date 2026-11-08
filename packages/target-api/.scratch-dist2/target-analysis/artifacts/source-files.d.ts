import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
export interface SourceArtifactFile {
    readonly sourceFile: SourceFile;
    readonly owner: string;
    readonly dependencies: readonly {
        readonly owner: string;
        readonly facet: "source-file-public-surface" | "source-file-implementation";
    }[];
}
export type SourceArtifactIssue = {
    readonly kind: "source-identity" | "source-conflict";
    readonly sourceFile: SourceFile;
    readonly owner?: string;
} | {
    readonly kind: "module-identity" | "construction-identity";
    readonly sourceFile: SourceFile;
    readonly owner: string;
};
export declare function analyzeSourceArtifactFiles(input: {
    readonly ast: AstReader;
    readonly sourceFiles: readonly SourceFile[];
    readonly navigation: Pick<SourceProgramNavigation, "moduleReferences">;
    readonly constructions: readonly {
        readonly sourceFile: SourceFile;
        readonly targetSourceFile: SourceFile;
    }[];
}): {
    readonly files: readonly SourceArtifactFile[];
    readonly issues: readonly SourceArtifactIssue[];
};
//# sourceMappingURL=source-files.d.ts.map