import type { ExtensionFactSubject, Node, Symbol, Type, TypeCheckerQueries } from "@tsonic/tsts";
export declare function sourceSelectedFactSubjects(checker: TypeCheckerQueries, symbol: Symbol | undefined, declaration: Node | undefined): readonly ExtensionFactSubject[];
export declare function sourceTypeFactSubjects(checker: TypeCheckerQueries, type: Type): readonly ExtensionFactSubject[];
//# sourceMappingURL=semantics-fact-subjects.d.ts.map