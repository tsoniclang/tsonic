import type { int, uint } from "../../go/scalars.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbolflags.go::type::SymbolFlags","kind":"type","status":"implemented","sigHash":"478f012c33c85d0057b773367c3fa3436c5802642845afcb65c8461cfa951468","bodyHash":"151ab65c3bc13f436b4340bff6ee9783ca55c52c0f3a65f6e5fa7d8a83531349"}
 *
 * Go source:
 * SymbolFlags uint32
 */
export type SymbolFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbolflags.go::constGroup::SymbolFlagsNone+SymbolFlagsFunctionScopedVariable+SymbolFlagsBlockScopedVariable+SymbolFlagsProperty+SymbolFlagsEnumMember+SymbolFlagsFunction+SymbolFlagsClass+SymbolFlagsInterface+SymbolFlagsConstEnum+SymbolFlagsRegularEnum+SymbolFlagsValueModule+SymbolFlagsNamespaceModule+SymbolFlagsTypeLiteral+SymbolFlagsObjectLiteral+SymbolFlagsMethod+SymbolFlagsConstructor+SymbolFlagsGetAccessor+SymbolFlagsSetAccessor+SymbolFlagsSignature+SymbolFlagsTypeParameter+SymbolFlagsTypeAlias+SymbolFlagsExportValue+SymbolFlagsAlias+SymbolFlagsPrototype+SymbolFlagsExportStar+SymbolFlagsOptional+SymbolFlagsTransient+SymbolFlagsAssignment+SymbolFlagsModuleExports+SymbolFlagsConstEnumOnlyModule+SymbolFlagsReplaceableByMethod+SymbolFlagsGlobalLookup+SymbolFlagsAll+SymbolFlagsEnum+SymbolFlagsVariable+SymbolFlagsValue+SymbolFlagsType+SymbolFlagsNamespace+SymbolFlagsModule+SymbolFlagsAccessor+SymbolFlagsFunctionScopedVariableExcludes+SymbolFlagsBlockScopedVariableExcludes+SymbolFlagsParameterExcludes+SymbolFlagsPropertyExcludes+SymbolFlagsEnumMemberExcludes+SymbolFlagsFunctionExcludes+SymbolFlagsClassExcludes+SymbolFlagsInterfaceExcludes+SymbolFlagsRegularEnumExcludes+SymbolFlagsConstEnumExcludes+SymbolFlagsValueModuleExcludes+SymbolFlagsNamespaceModuleExcludes+SymbolFlagsMethodExcludes+SymbolFlagsGetAccessorExcludes+SymbolFlagsSetAccessorExcludes+SymbolFlagsAccessorExcludes+SymbolFlagsTypeParameterExcludes+SymbolFlagsTypeAliasExcludes+SymbolFlagsAliasExcludes+SymbolFlagsModuleMember+SymbolFlagsExportHasLocal+SymbolFlagsBlockScoped+SymbolFlagsPropertyOrAccessor+SymbolFlagsClassMember+SymbolFlagsExportSupportsDefaultModifier+SymbolFlagsExportDoesNotSupportDefaultModifier+SymbolFlagsClassifiable+SymbolFlagsLateBindingContainer","kind":"constGroup","status":"implemented","sigHash":"e33c0ef2c29ce44b42978953bbf03d3089350ab184045ca9badf8add51064c91","bodyHash":"901a849307070a0bcf4327009b0fbe60e85f21b8164908c6c8f87e182842f312"}
 *
 * Go source:
 * const (
 * 	SymbolFlagsNone                   SymbolFlags = 0
 * 	SymbolFlagsFunctionScopedVariable SymbolFlags = 1 << 0  // Variable (var) or parameter
 * 	SymbolFlagsBlockScopedVariable    SymbolFlags = 1 << 1  // A block-scoped variable (let or const)
 * 	SymbolFlagsProperty               SymbolFlags = 1 << 2  // Property or enum member
 * 	SymbolFlagsEnumMember             SymbolFlags = 1 << 3  // Enum member
 * 	SymbolFlagsFunction               SymbolFlags = 1 << 4  // Function
 * 	SymbolFlagsClass                  SymbolFlags = 1 << 5  // Class
 * 	SymbolFlagsInterface              SymbolFlags = 1 << 6  // Interface
 * 	SymbolFlagsConstEnum              SymbolFlags = 1 << 7  // Const enum
 * 	SymbolFlagsRegularEnum            SymbolFlags = 1 << 8  // Enum
 * 	SymbolFlagsValueModule            SymbolFlags = 1 << 9  // Instantiated module
 * 	SymbolFlagsNamespaceModule        SymbolFlags = 1 << 10 // Uninstantiated module
 * 	SymbolFlagsTypeLiteral            SymbolFlags = 1 << 11 // Type Literal or mapped type
 * 	SymbolFlagsObjectLiteral          SymbolFlags = 1 << 12 // Object Literal
 * 	SymbolFlagsMethod                 SymbolFlags = 1 << 13 // Method
 * 	SymbolFlagsConstructor            SymbolFlags = 1 << 14 // Constructor
 * 	SymbolFlagsGetAccessor            SymbolFlags = 1 << 15 // Get accessor
 * 	SymbolFlagsSetAccessor            SymbolFlags = 1 << 16 // Set accessor
 * 	SymbolFlagsSignature              SymbolFlags = 1 << 17 // Call, construct, or index signature
 * 	SymbolFlagsTypeParameter          SymbolFlags = 1 << 18 // Type parameter
 * 	SymbolFlagsTypeAlias              SymbolFlags = 1 << 19 // Type alias
 * 	SymbolFlagsExportValue            SymbolFlags = 1 << 20 // Exported value marker (see comment in declareModuleMember in binder)
 * 	SymbolFlagsAlias                  SymbolFlags = 1 << 21 // An alias for another symbol (see comment in isAliasSymbolDeclaration in checker)
 * 	SymbolFlagsPrototype              SymbolFlags = 1 << 22 // Prototype property (no source representation)
 * 	SymbolFlagsExportStar             SymbolFlags = 1 << 23 // Export * declaration
 * 	SymbolFlagsOptional               SymbolFlags = 1 << 24 // Optional property
 * 	SymbolFlagsTransient              SymbolFlags = 1 << 25 // Transient symbol (created during type check)
 * 	SymbolFlagsAssignment             SymbolFlags = 1 << 26 // Assignment to property on function acting as declaration (eg `func.prop = 1`)
 * 	SymbolFlagsModuleExports          SymbolFlags = 1 << 27 // Symbol for CommonJS `module` of `module.exports`
 * 	SymbolFlagsConstEnumOnlyModule    SymbolFlags = 1 << 28 // Module contains only const enums or other modules with only const enums
 * 	SymbolFlagsReplaceableByMethod    SymbolFlags = 1 << 29
 * 	SymbolFlagsGlobalLookup           SymbolFlags = 1 << 30   // Flag to signal this is a global lookup
 * 	SymbolFlagsAll                    SymbolFlags = 1<<30 - 1 // All flags except SymbolFlagsGlobalLookup
 *
 * 	SymbolFlagsEnum      = SymbolFlagsRegularEnum | SymbolFlagsConstEnum
 * 	SymbolFlagsVariable  = SymbolFlagsFunctionScopedVariable | SymbolFlagsBlockScopedVariable
 * 	SymbolFlagsValue     = SymbolFlagsVariable | SymbolFlagsProperty | SymbolFlagsEnumMember | SymbolFlagsObjectLiteral | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule | SymbolFlagsMethod | SymbolFlagsGetAccessor | SymbolFlagsSetAccessor
 * 	SymbolFlagsType      = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsEnumMember | SymbolFlagsTypeLiteral | SymbolFlagsTypeParameter | SymbolFlagsTypeAlias
 * 	SymbolFlagsNamespace = SymbolFlagsValueModule | SymbolFlagsNamespaceModule | SymbolFlagsEnum
 * 	SymbolFlagsModule    = SymbolFlagsValueModule | SymbolFlagsNamespaceModule
 * 	SymbolFlagsAccessor  = SymbolFlagsGetAccessor | SymbolFlagsSetAccessor
 *
 * 	// Variables can be redeclared, but can not redeclare a block-scoped declaration with the
 * 	// same name, or any other value that is not a variable, e.g. ValueModule or Class
 * 	SymbolFlagsFunctionScopedVariableExcludes = SymbolFlagsValue & ^SymbolFlagsFunctionScopedVariable
 *
 * 	// Block-scoped declarations are not allowed to be re-declared
 * 	// they can not merge with anything in the value space
 * 	SymbolFlagsBlockScopedVariableExcludes = SymbolFlagsValue
 *
 * 	SymbolFlagsParameterExcludes                   = SymbolFlagsValue
 * 	SymbolFlagsPropertyExcludes                    = SymbolFlagsValue & ^(SymbolFlagsProperty | SymbolFlagsAccessor)
 * 	SymbolFlagsEnumMemberExcludes                  = SymbolFlagsValue | SymbolFlagsType
 * 	SymbolFlagsFunctionExcludes                    = SymbolFlagsValue & ^(SymbolFlagsFunction | SymbolFlagsValueModule | SymbolFlagsClass)
 * 	SymbolFlagsClassExcludes                       = (SymbolFlagsValue | SymbolFlagsType) & ^(SymbolFlagsValueModule | SymbolFlagsInterface | SymbolFlagsFunction) // class-interface mergability done in checker.ts
 * 	SymbolFlagsInterfaceExcludes                   = SymbolFlagsType & ^(SymbolFlagsInterface | SymbolFlagsClass)
 * 	SymbolFlagsRegularEnumExcludes                 = (SymbolFlagsValue | SymbolFlagsType) & ^(SymbolFlagsRegularEnum | SymbolFlagsValueModule) // regular enums merge only with regular enums and modules
 * 	SymbolFlagsConstEnumExcludes                   = (SymbolFlagsValue | SymbolFlagsType) & ^SymbolFlagsConstEnum                              // const enums merge only with const enums
 * 	SymbolFlagsValueModuleExcludes                 = SymbolFlagsValue & ^(SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum | SymbolFlagsValueModule)
 * 	SymbolFlagsNamespaceModuleExcludes             = SymbolFlagsNone
 * 	SymbolFlagsMethodExcludes                      = SymbolFlagsValue & ^SymbolFlagsMethod
 * 	SymbolFlagsGetAccessorExcludes                 = SymbolFlagsValue & ^(SymbolFlagsSetAccessor | SymbolFlagsProperty)
 * 	SymbolFlagsSetAccessorExcludes                 = SymbolFlagsValue & ^(SymbolFlagsGetAccessor | SymbolFlagsProperty)
 * 	SymbolFlagsAccessorExcludes                    = SymbolFlagsValue & ^SymbolFlagsProperty
 * 	SymbolFlagsTypeParameterExcludes               = SymbolFlagsType & ^SymbolFlagsTypeParameter
 * 	SymbolFlagsTypeAliasExcludes                   = SymbolFlagsType
 * 	SymbolFlagsAliasExcludes                       = SymbolFlagsAlias
 * 	SymbolFlagsModuleMember                        = SymbolFlagsVariable | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsModule | SymbolFlagsTypeAlias | SymbolFlagsAlias
 * 	SymbolFlagsExportHasLocal                      = SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule
 * 	SymbolFlagsBlockScoped                         = SymbolFlagsBlockScopedVariable | SymbolFlagsClass | SymbolFlagsEnum
 * 	SymbolFlagsPropertyOrAccessor                  = SymbolFlagsProperty | SymbolFlagsAccessor
 * 	SymbolFlagsClassMember                         = SymbolFlagsMethod | SymbolFlagsAccessor | SymbolFlagsProperty
 * 	SymbolFlagsExportSupportsDefaultModifier       = SymbolFlagsClass | SymbolFlagsFunction | SymbolFlagsInterface
 * 	SymbolFlagsExportDoesNotSupportDefaultModifier = ^SymbolFlagsExportSupportsDefaultModifier
 * 	// The set of things we consider semantically classifiable.  Used to speed up the LS during
 * 	// classification.
 * 	SymbolFlagsClassifiable         = SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsTypeAlias | SymbolFlagsInterface | SymbolFlagsTypeParameter | SymbolFlagsModule | SymbolFlagsAlias
 * 	SymbolFlagsLateBindingContainer = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsTypeLiteral | SymbolFlagsObjectLiteral | SymbolFlagsFunction
 * )
 */
export declare const SymbolFlagsNone: SymbolFlags;
export declare const SymbolFlagsFunctionScopedVariable: SymbolFlags;
export declare const SymbolFlagsBlockScopedVariable: SymbolFlags;
export declare const SymbolFlagsProperty: SymbolFlags;
export declare const SymbolFlagsEnumMember: SymbolFlags;
export declare const SymbolFlagsFunction: SymbolFlags;
export declare const SymbolFlagsClass: SymbolFlags;
export declare const SymbolFlagsInterface: SymbolFlags;
export declare const SymbolFlagsConstEnum: SymbolFlags;
export declare const SymbolFlagsRegularEnum: SymbolFlags;
export declare const SymbolFlagsValueModule: SymbolFlags;
export declare const SymbolFlagsNamespaceModule: SymbolFlags;
export declare const SymbolFlagsTypeLiteral: SymbolFlags;
export declare const SymbolFlagsObjectLiteral: SymbolFlags;
export declare const SymbolFlagsMethod: SymbolFlags;
export declare const SymbolFlagsConstructor: SymbolFlags;
export declare const SymbolFlagsGetAccessor: SymbolFlags;
export declare const SymbolFlagsSetAccessor: SymbolFlags;
export declare const SymbolFlagsSignature: SymbolFlags;
export declare const SymbolFlagsTypeParameter: SymbolFlags;
export declare const SymbolFlagsTypeAlias: SymbolFlags;
export declare const SymbolFlagsExportValue: SymbolFlags;
export declare const SymbolFlagsAlias: SymbolFlags;
export declare const SymbolFlagsPrototype: SymbolFlags;
export declare const SymbolFlagsExportStar: SymbolFlags;
export declare const SymbolFlagsOptional: SymbolFlags;
export declare const SymbolFlagsTransient: SymbolFlags;
export declare const SymbolFlagsAssignment: SymbolFlags;
export declare const SymbolFlagsModuleExports: SymbolFlags;
export declare const SymbolFlagsConstEnumOnlyModule: SymbolFlags;
export declare const SymbolFlagsReplaceableByMethod: SymbolFlags;
export declare const SymbolFlagsGlobalLookup: SymbolFlags;
export declare const SymbolFlagsAll: SymbolFlags;
export declare const SymbolFlagsEnum: int;
export declare const SymbolFlagsVariable: int;
export declare const SymbolFlagsValue: int;
export declare const SymbolFlagsType: int;
export declare const SymbolFlagsNamespace: int;
export declare const SymbolFlagsModule: int;
export declare const SymbolFlagsAccessor: int;
export declare const SymbolFlagsFunctionScopedVariableExcludes: int;
export declare const SymbolFlagsBlockScopedVariableExcludes: int;
export declare const SymbolFlagsParameterExcludes: int;
export declare const SymbolFlagsPropertyExcludes: int;
export declare const SymbolFlagsEnumMemberExcludes: int;
export declare const SymbolFlagsFunctionExcludes: int;
export declare const SymbolFlagsClassExcludes: int;
export declare const SymbolFlagsInterfaceExcludes: int;
export declare const SymbolFlagsRegularEnumExcludes: int;
export declare const SymbolFlagsConstEnumExcludes: int;
export declare const SymbolFlagsValueModuleExcludes: int;
export declare const SymbolFlagsNamespaceModuleExcludes: SymbolFlags;
export declare const SymbolFlagsMethodExcludes: int;
export declare const SymbolFlagsGetAccessorExcludes: int;
export declare const SymbolFlagsSetAccessorExcludes: int;
export declare const SymbolFlagsAccessorExcludes: int;
export declare const SymbolFlagsTypeParameterExcludes: int;
export declare const SymbolFlagsTypeAliasExcludes: int;
export declare const SymbolFlagsAliasExcludes: SymbolFlags;
export declare const SymbolFlagsModuleMember: int;
export declare const SymbolFlagsExportHasLocal: int;
export declare const SymbolFlagsBlockScoped: int;
export declare const SymbolFlagsPropertyOrAccessor: int;
export declare const SymbolFlagsClassMember: int;
export declare const SymbolFlagsExportSupportsDefaultModifier: int;
export declare const SymbolFlagsExportDoesNotSupportDefaultModifier: unknown;
export declare const SymbolFlagsClassifiable: int;
export declare const SymbolFlagsLateBindingContainer: int;
//# sourceMappingURL=symbolflags.d.ts.map