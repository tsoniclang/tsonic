import type { AstReader } from "@tsonic/tsts";
import type { SourceApplicationFacts, SourceDescriptorView, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceMemberUse } from "../source-semantics/member-use.js";
import type { Node } from "@tsonic/tsts";
import type { SourceResult } from "../public/source/contracts.js";

export interface SourceNavigationQueryContext {
  readonly ast: AstReader;
  readonly facts: {
    readonly navigation: SourceNodeNavigationFacts;
    readonly descriptors: SourceDescriptorView;
    readonly values: SourceValueFacts;
    readonly applications: SourceApplicationFacts;
    readonly objects: { use(occurrence: Node): SourceResult<SourceMemberUse> };
  };
}
