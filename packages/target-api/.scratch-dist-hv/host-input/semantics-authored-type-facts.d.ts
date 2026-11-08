import type { AstReader, ExtensionFactSubject, Node, ReadonlySourceFactResolver, TypeCheckerQueries } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/index.js";
export declare function authoredSourceTypeFactDependencies(ast: AstReader, navigation: SourceProgramNavigation, facts: ReadonlySourceFactResolver, checker: TypeCheckerQueries, node: Node): readonly ExtensionFactSubject[];
export declare function authoredSourceTypeFactNodes(ast: AstReader, navigation: SourceProgramNavigation, facts: ReadonlySourceFactResolver, checker: TypeCheckerQueries, node: Node): readonly Node[];
//# sourceMappingURL=semantics-authored-type-facts.d.ts.map