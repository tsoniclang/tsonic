import type { Node } from "@tsonic/tsts";
import type { SourceNavigationInput, SourceNavigationSignatureParameter } from "../source-model/navigation-records.js";
import type { SourceClassConstructorParameter, SourceClassConstructorResult } from "./types.js";
export declare function sourceConstructorParametersMatch(declared: readonly Pick<SourceClassConstructorParameter, "parameterDeclaration" | "acceptsOmission" | "rest">[], selected: readonly Pick<SourceNavigationSignatureParameter, "parameterDeclaration" | "acceptsOmission" | "rest">[]): boolean;
/** Effective constructors of a project class: the construct signatures host-input selects for its value (I3). */
export declare function createSourceClassConstructorNavigation(input: Pick<SourceNavigationInput, "ast" | "constructSignatures">, isProjectDeclaration: (node: Node | undefined) => boolean): (declaration: Node) => SourceClassConstructorResult;
//# sourceMappingURL=constructors.d.ts.map