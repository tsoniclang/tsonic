import type { Node } from "@tsonic/tsts";
import type { SourceArgumentCorrespondence } from "../public/source/selections.js";
import type { SourceNavigationCallBinding } from "../source-model/navigation-records.js";
export declare function sourceArgumentCorrespondence(binding: SourceNavigationCallBinding, argument: Node): SourceArgumentCorrespondence;
/** Two correspondence rows name the same binding of the same call. */
export declare function sourceArgumentCorrespondencesEqual(left: SourceArgumentCorrespondence, right: SourceArgumentCorrespondence): boolean;
//# sourceMappingURL=argument-correspondence.d.ts.map