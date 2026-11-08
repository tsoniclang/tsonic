import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProjectMemberDispatch, SourceProjectReference } from "./types.js";
export interface SourceMemberDispatchNavigation {
    memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
}
export declare function createSourceMemberDispatchNavigation(source: Pick<SourceNavigationInput, "ast" | "declaredMember">, sourceFiles: readonly SourceFile[], referenceFor: (node: Node | undefined) => SourceProjectReference | undefined, isProjectDeclaration: (node: Node | undefined) => boolean): SourceMemberDispatchNavigation;
//# sourceMappingURL=member-dispatch.d.ts.map