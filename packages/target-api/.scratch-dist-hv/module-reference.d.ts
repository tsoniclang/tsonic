import type { AstReader, Node } from "@tsonic/tsts";
export interface StaticModuleReference {
    readonly declaration: Node;
    readonly moduleSpecifier: Node;
    readonly kind: "import" | "export";
    readonly hasRuntimeValue: boolean;
}
export declare function getStaticModuleReference(ast: AstReader, statement: Node): StaticModuleReference | undefined;
//# sourceMappingURL=module-reference.d.ts.map