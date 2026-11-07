import type { Node } from "@tsonic/tsts";
import { type SourceClosedCallableArgument } from "../../../../packages/target-api/src/source-navigation/callable-arguments.js";
declare function fixture(body: string, inline?: boolean): {
    source: import("../../../../packages/target-api/src/source-semantics/host-program-fixtures.js").HostSourceProgramFixture;
    expression: Node;
    declarations: Map<string, Node>;
    select(): readonly SourceClosedCallableArgument[] | undefined;
};
export { fixture };
