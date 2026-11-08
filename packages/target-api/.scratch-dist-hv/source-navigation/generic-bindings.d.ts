import type { AstReader, Node } from "@tsonic/tsts";
export declare function generatedTypeParameterNames(parameters: readonly {
    readonly identity: string;
    readonly name: string;
}[], authoredNames: Iterable<string>): ReadonlyMap<string, string>;
export declare function authoredTypeParameterNames(node: Node, ast: AstReader, excluded?: ReadonlySet<string>): readonly string[];
//# sourceMappingURL=generic-bindings.d.ts.map