import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProjectModuleDependency, SourceProjectModuleExport, SourceProjectModuleSpecifierResolution } from "./types.js";
/** The module's exports with a declaration in a source (non-declaration) file, sorted by name, file and position. */
export declare function sourceProjectModuleExports(source: Pick<SourceNavigationInput, "ast" | "moduleExports">, sourceFile: SourceFile): readonly SourceProjectModuleExport[];
export declare function sourceProjectModuleDependencies(source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">, sourceFiles: ReadonlySet<string>, sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
export declare function sourceProjectModuleReferences(source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">, sourceFiles: ReadonlySet<string>, sourceFile: SourceFile, runtimeOnly?: boolean): readonly SourceProjectModuleDependency[];
export declare function sourceProjectModuleSpecifierResolution(source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">, sourceFiles: ReadonlySet<string>, moduleSpecifier: Node): SourceProjectModuleSpecifierResolution;
export declare function sourceFileHasTopLevelAwait(ast: AstReader, sourceFile: SourceFile): boolean;
//# sourceMappingURL=modules.d.ts.map