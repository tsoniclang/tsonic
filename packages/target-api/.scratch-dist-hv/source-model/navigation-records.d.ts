import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
/** The declaration a reference occurrence selects, and that declaration's file. */
export interface SourceNavigationReference {
    readonly declaration: Node;
    readonly sourceFile: SourceFile;
}
/** One parameter of a selected or declared signature. */
export interface SourceNavigationSignatureParameter {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterDeclaration?: Node;
    readonly authoredTypeNode?: Node;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
}
/** A construct signature of a class value: its declaration (absent for an implicit constructor) and parameters. */
export interface SourceNavigationConstructSignature {
    readonly declaration?: Node;
    readonly parameters: readonly (SourceNavigationSignatureParameter & {
        readonly parameterDeclaration: Node;
    })[];
}
export type SourceNavigationConstructSignatures = {
    readonly kind: "signatures";
    readonly signatures: readonly SourceNavigationConstructSignature[];
} | {
    readonly kind: "unresolved";
    readonly site: Node;
    readonly reason: string;
};
/** The argument-to-parameter binding the checker selected at a call (indexes into the call record vectors). */
export interface SourceNavigationCallBinding {
    readonly sourceArgumentIndex: number;
    readonly effectiveArgumentIndex: number;
    readonly sourceForm: "value" | "spread-element" | "spread-sequence";
    readonly spreadElementIndex?: number;
    readonly sourceParameterIndex: number;
    readonly sourceParameterForm: "parameter" | "rest-element" | "rest-sequence";
}
/**
 * The checker's selection at a call, `new`, tagged template or `super(...)`, as declarations and syntax. The one call
 * witness of the Host (R2 #1): navigation, the value model (SourceHostInput.call) and the selections
 * (HostCheckerInput.call) all project from this record.
 */
export interface SourceNavigationCall {
    readonly call: Node;
    /** "untyped": the callee has no typed signature (the checker selected an any-call). */
    readonly selection: "resolved" | "untyped";
    readonly applicable: boolean;
    readonly optionalChain: boolean;
    /** The selected signature's declaration; absent for a signature with no declaration. */
    readonly signature?: Node;
    readonly callee: Node;
    /** The receiver expression of a member call (`r.m()`, `r[k]()`); absent for any other callee. */
    readonly receiver?: Node;
    /** A member-access callee: its access form and the member declaration the checker selected for it (if any). */
    readonly calleeAccess?: {
        readonly kind: "property" | "element";
        readonly declaration?: Node;
    };
    /** The authored argument expressions, in source order. */
    readonly arguments: readonly Node[];
    readonly bindings: readonly SourceNavigationCallBinding[];
    readonly parameters: readonly SourceNavigationSignatureParameter[];
}
/**
 * The checker's member selection at a property or element access, as declarations. The one member-access witness of
 * the Host (R2 #2): navigation, the value model (SourceHostInput.member), the selections (HostCheckerInput.memberAccess)
 * and the per-file checker views (operations.propertyAccess) all read their declarations from this record.
 */
export interface SourceNavigationMemberAccess {
    readonly access: Node;
    readonly receiver: Node;
    /** The selected member declaration for the access role (get accessor for reads, set accessor for writes). */
    readonly declaration?: Node;
    /** The declaration a read through this access targets (the get accessor of an accessor pair); absent for none. */
    readonly readDeclaration?: Node;
    /** The declaration a write through this access targets (the set accessor of an accessor pair); absent for none. */
    readonly writeDeclaration?: Node;
    /**
     * The selected declarations in order, duplicates once: `readDeclaration`, `declaration`, `writeDeclaration`. When the
     * checker selected none of them: every declaration of the selected member and its root members (union/intersection
     * members).
     */
    readonly declarations: readonly Node[];
    readonly accessMode: "read" | "write" | "read-write" | "delete";
    readonly optionalChain: boolean;
    /** The access is the callee of a call (through transparent wrappers): the checker access witness. */
    readonly callCallee: boolean;
}
export interface SourceNavigationModuleExport {
    readonly exportName: string;
    readonly declaration: Node;
    readonly sourceFile: SourceFile;
}
/** The checker input of source-navigation. One per program view; lifetime is the program's (I5). */
export interface SourceNavigationInput {
    readonly ast: AstReader;
    /** The checked program's source files (project files and libraries), as the program lists them. */
    readonly sourceFiles: readonly (SourceFile | undefined)[];
    /**
     * The project's own implementation files: checked source files that are not declaration files and not provider
     * virtual modules (program membership, answered once here).
     */
    readonly projectSourceFiles: readonly SourceFile[];
    containsSourceFile(sourceFile: SourceFile): boolean;
    /**
     * The declaration a reference occurrence selects (identifier, qualified name, property or element access, type
     * reference, heritage expression), imports and aliases resolved. `reserveModuleExports` is told how many module
     * exports an import resolution examined.
     */
    reference(node: Node, reserveModuleExports?: (count: number) => void): SourceNavigationReference | undefined;
    /** All declarations of the entity a declaration declares (overloads, merged declarations, accessor pairs). */
    mergedDeclarations(declaration: Node): readonly Node[];
    /** The declaration a heritage clause element names (aliases resolved); undefined when the checker selects none. */
    heritageTarget(heritage: Node): Node | undefined;
    /** The construct signatures of a class declaration or class expression value. */
    constructSignatures(classDeclaration: Node): SourceNavigationConstructSignatures;
    /**
     * The declarations of the member of the declared instance type of a class/interface declaration that has the same
     * member name as `member`; primary declaration first. Undefined when `member` declares no named member.
     */
    declaredMember(typeDeclaration: Node, member: Node): readonly Node[] | undefined;
    /** Parameters of a callable declaration's own declared signature; undefined when it declares none. */
    declaredParameters(declaration: Node): readonly Node[] | undefined;
    moduleExports(sourceFile: SourceFile): readonly SourceNavigationModuleExport[];
    /** The source file a module specifier resolves to (program module resolution). */
    moduleSourceFile(moduleSpecifier: Node): SourceFile | undefined;
    call(use: Node): SourceNavigationCall | undefined;
    memberAccess(access: Node): SourceNavigationMemberAccess | undefined;
}
//# sourceMappingURL=navigation-records.d.ts.map