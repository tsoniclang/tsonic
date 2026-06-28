import type { SourcePrimitiveFact, SourcePrimitiveKind } from "./facts.js";
import type { CompilerExtension, CompilerExtensionIdentity } from "./host.js";
export interface SourceSemanticsExtensionOptions {
    readonly identity: CompilerExtensionIdentity;
    readonly modules: readonly SourceSemanticsModule[];
}
export type SourceSemanticsModuleCapability = "primitive" | "call-marker" | "type-marker";
export interface SourceSemanticsModuleIdentity {
    readonly moduleSpecifier: string;
    readonly packageName?: string;
    readonly packageVersion?: string;
    readonly subpath?: string;
    readonly capabilities?: readonly SourceSemanticsModuleCapability[];
}
export interface SourceSemanticsModule extends SourceSemanticsModuleIdentity {
    readonly exports: readonly SourceSemanticsExportDeclaration[];
}
export type SourceSemanticsExportDeclaration = SourcePrimitiveDeclaration | SourceCallMarkerDeclaration | SourceTypeMarkerDeclaration;
export interface SourcePrimitiveDeclaration extends Omit<SourcePrimitiveFact, "kind"> {
    readonly kind: "source-primitive";
    readonly exportName: string;
    readonly primitive: SourcePrimitiveKind;
}
export type SourceCallMarkerKind = "out" | "ref" | "inref" | "borrow" | "borrowMut" | "move" | "struct" | "field" | "attribute" | "defaultof";
export interface SourceCallMarkerDeclaration {
    readonly kind: "call-marker";
    readonly exportName: string;
    readonly marker: SourceCallMarkerKind;
}
export type SourceTypeMarkerKind = "ptr" | "fnptr";
export interface SourceTypeMarkerDeclaration {
    readonly kind: "type-marker";
    readonly exportName: string;
    readonly marker: SourceTypeMarkerKind;
}
export declare function createSourceSemanticsExtension(options: SourceSemanticsExtensionOptions): CompilerExtension;
export declare function sourcePrimitive(exportName: string, primitiveKind: SourcePrimitiveKind, runtimeBase: SourcePrimitiveFact["runtimeBase"], signed?: boolean, width?: number): SourcePrimitiveDeclaration;
//# sourceMappingURL=source-semantics.d.ts.map