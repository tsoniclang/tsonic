import type { int, uint } from "@tsonic/core/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbolflags.go::type::SymbolFlags","kind":"type","status":"implemented","sigHash":"478f012c33c85d0057b773367c3fa3436c5802642845afcb65c8461cfa951468","bodyHash":"151ab65c3bc13f436b4340bff6ee9783ca55c52c0f3a65f6e5fa7d8a83531349"}
 *
 * Go source:
 * SymbolFlags uint32
 */
export type SymbolFlags = uint;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbolflags.go::constGroup::SymbolFlagsNone+SymbolFlagsFunctionScopedVariable+SymbolFlagsBlockScopedVariable+SymbolFlagsProperty+SymbolFlagsEnumMember+SymbolFlagsFunction+SymbolFlagsClass+SymbolFlagsInterface+SymbolFlagsConstEnum+SymbolFlagsRegularEnum+SymbolFlagsValueModule+SymbolFlagsNamespaceModule+SymbolFlagsTypeLiteral+SymbolFlagsObjectLiteral+SymbolFlagsMethod+SymbolFlagsConstructor+SymbolFlagsGetAccessor+SymbolFlagsSetAccessor+SymbolFlagsSignature+SymbolFlagsTypeParameter+SymbolFlagsTypeAlias+SymbolFlagsExportValue+SymbolFlagsAlias+SymbolFlagsPrototype+SymbolFlagsExportStar+SymbolFlagsOptional+SymbolFlagsTransient+SymbolFlagsAssignment+SymbolFlagsModuleExports+SymbolFlagsConstEnumOnlyModule+SymbolFlagsReplaceableByMethod+SymbolFlagsGlobalLookup+SymbolFlagsAll+SymbolFlagsEnum+SymbolFlagsVariable+SymbolFlagsValue+SymbolFlagsType+SymbolFlagsNamespace+SymbolFlagsModule+SymbolFlagsAccessor+SymbolFlagsFunctionScopedVariableExcludes+SymbolFlagsBlockScopedVariableExcludes+SymbolFlagsParameterExcludes+SymbolFlagsPropertyExcludes+SymbolFlagsEnumMemberExcludes+SymbolFlagsFunctionExcludes+SymbolFlagsClassExcludes+SymbolFlagsInterfaceExcludes+SymbolFlagsRegularEnumExcludes+SymbolFlagsConstEnumExcludes+SymbolFlagsValueModuleExcludes+SymbolFlagsNamespaceModuleExcludes+SymbolFlagsMethodExcludes+SymbolFlagsGetAccessorExcludes+SymbolFlagsSetAccessorExcludes+SymbolFlagsAccessorExcludes+SymbolFlagsTypeParameterExcludes+SymbolFlagsTypeAliasExcludes+SymbolFlagsAliasExcludes+SymbolFlagsModuleMember+SymbolFlagsExportHasLocal+SymbolFlagsBlockScoped+SymbolFlagsPropertyOrAccessor+SymbolFlagsClassMember+SymbolFlagsExportSupportsDefaultModifier+SymbolFlagsExportDoesNotSupportDefaultModifier+SymbolFlagsClassifiable+SymbolFlagsLateBindingContainer","kind":"constGroup","status":"implemented","sigHash":"e33c0ef2c29ce44b42978953bbf03d3089350ab184045ca9badf8add51064c91","bodyHash":"3353f28370ead956862e648216f470bd5f84d556f2658cb4a6ed1be8ae5e0199"}
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
 * 	SymbolFlagsPropertyExcludes                    = SymbolFlagsValue & ^SymbolFlagsProperty
 * 	SymbolFlagsEnumMemberExcludes                  = SymbolFlagsValue | SymbolFlagsType
 * 	SymbolFlagsFunctionExcludes                    = SymbolFlagsValue & ^(SymbolFlagsFunction | SymbolFlagsValueModule | SymbolFlagsClass)
 * 	SymbolFlagsClassExcludes                       = (SymbolFlagsValue | SymbolFlagsType) & ^(SymbolFlagsValueModule | SymbolFlagsInterface | SymbolFlagsFunction) // class-interface mergability done in checker.ts
 * 	SymbolFlagsInterfaceExcludes                   = SymbolFlagsType & ^(SymbolFlagsInterface | SymbolFlagsClass)
 * 	SymbolFlagsRegularEnumExcludes                 = (SymbolFlagsValue | SymbolFlagsType) & ^(SymbolFlagsRegularEnum | SymbolFlagsValueModule) // regular enums merge only with regular enums and modules
 * 	SymbolFlagsConstEnumExcludes                   = (SymbolFlagsValue | SymbolFlagsType) & ^SymbolFlagsConstEnum                              // const enums merge only with const enums
 * 	SymbolFlagsValueModuleExcludes                 = SymbolFlagsValue & ^(SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum | SymbolFlagsValueModule)
 * 	SymbolFlagsNamespaceModuleExcludes             = SymbolFlagsNone
 * 	SymbolFlagsMethodExcludes                      = SymbolFlagsValue & ^SymbolFlagsMethod
 * 	SymbolFlagsGetAccessorExcludes                 = SymbolFlagsValue & ^SymbolFlagsSetAccessor
 * 	SymbolFlagsSetAccessorExcludes                 = SymbolFlagsValue & ^SymbolFlagsGetAccessor
 * 	SymbolFlagsAccessorExcludes                    = SymbolFlagsValue
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
export const SymbolFlagsNone: SymbolFlags = 0;
export const SymbolFlagsFunctionScopedVariable: SymbolFlags = 1 << 0;
export const SymbolFlagsBlockScopedVariable: SymbolFlags = 1 << 1;
export const SymbolFlagsProperty: SymbolFlags = 1 << 2;
export const SymbolFlagsEnumMember: SymbolFlags = 1 << 3;
export const SymbolFlagsFunction: SymbolFlags = 1 << 4;
export const SymbolFlagsClass: SymbolFlags = 1 << 5;
export const SymbolFlagsInterface: SymbolFlags = 1 << 6;
export const SymbolFlagsConstEnum: SymbolFlags = 1 << 7;
export const SymbolFlagsRegularEnum: SymbolFlags = 1 << 8;
export const SymbolFlagsValueModule: SymbolFlags = 1 << 9;
export const SymbolFlagsNamespaceModule: SymbolFlags = 1 << 10;
export const SymbolFlagsTypeLiteral: SymbolFlags = 1 << 11;
export const SymbolFlagsObjectLiteral: SymbolFlags = 1 << 12;
export const SymbolFlagsMethod: SymbolFlags = 1 << 13;
export const SymbolFlagsConstructor: SymbolFlags = 1 << 14;
export const SymbolFlagsGetAccessor: SymbolFlags = 1 << 15;
export const SymbolFlagsSetAccessor: SymbolFlags = 1 << 16;
export const SymbolFlagsSignature: SymbolFlags = 1 << 17;
export const SymbolFlagsTypeParameter: SymbolFlags = 1 << 18;
export const SymbolFlagsTypeAlias: SymbolFlags = 1 << 19;
export const SymbolFlagsExportValue: SymbolFlags = 1 << 20;
export const SymbolFlagsAlias: SymbolFlags = 1 << 21;
export const SymbolFlagsPrototype: SymbolFlags = 1 << 22;
export const SymbolFlagsExportStar: SymbolFlags = 1 << 23;
export const SymbolFlagsOptional: SymbolFlags = 1 << 24;
export const SymbolFlagsTransient: SymbolFlags = 1 << 25;
export const SymbolFlagsAssignment: SymbolFlags = 1 << 26;
export const SymbolFlagsModuleExports: SymbolFlags = 1 << 27;
export const SymbolFlagsConstEnumOnlyModule: SymbolFlags = 1 << 28;
export const SymbolFlagsReplaceableByMethod: SymbolFlags = 1 << 29;
export const SymbolFlagsGlobalLookup: SymbolFlags = 1 << 30;
export const SymbolFlagsAll: SymbolFlags = (1 << 30) - 1;
export const SymbolFlagsEnum: int = SymbolFlagsRegularEnum | SymbolFlagsConstEnum;
export const SymbolFlagsVariable: int = SymbolFlagsFunctionScopedVariable | SymbolFlagsBlockScopedVariable;
export const SymbolFlagsValue: int = SymbolFlagsVariable | SymbolFlagsProperty | SymbolFlagsEnumMember | SymbolFlagsObjectLiteral | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule | SymbolFlagsMethod | SymbolFlagsGetAccessor | SymbolFlagsSetAccessor;
export const SymbolFlagsType: int = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsEnumMember | SymbolFlagsTypeLiteral | SymbolFlagsTypeParameter | SymbolFlagsTypeAlias;
export const SymbolFlagsNamespace: int = SymbolFlagsValueModule | SymbolFlagsNamespaceModule | SymbolFlagsEnum;
export const SymbolFlagsModule: int = SymbolFlagsValueModule | SymbolFlagsNamespaceModule;
export const SymbolFlagsAccessor: int = SymbolFlagsGetAccessor | SymbolFlagsSetAccessor;
export const SymbolFlagsFunctionScopedVariableExcludes: int = SymbolFlagsValue & ~SymbolFlagsFunctionScopedVariable;
export const SymbolFlagsBlockScopedVariableExcludes: int = SymbolFlagsValue;
export const SymbolFlagsParameterExcludes: int = SymbolFlagsValue;
export const SymbolFlagsPropertyExcludes: int = SymbolFlagsValue & ~SymbolFlagsProperty;
export const SymbolFlagsEnumMemberExcludes: int = SymbolFlagsValue | SymbolFlagsType;
export const SymbolFlagsFunctionExcludes: int = SymbolFlagsValue & ~(SymbolFlagsFunction | SymbolFlagsValueModule | SymbolFlagsClass);
export const SymbolFlagsClassExcludes: int = (SymbolFlagsValue | SymbolFlagsType) & ~(SymbolFlagsValueModule | SymbolFlagsInterface | SymbolFlagsFunction);
export const SymbolFlagsInterfaceExcludes: int = SymbolFlagsType & ~(SymbolFlagsInterface | SymbolFlagsClass);
export const SymbolFlagsRegularEnumExcludes: int = (SymbolFlagsValue | SymbolFlagsType) & ~(SymbolFlagsRegularEnum | SymbolFlagsValueModule);
export const SymbolFlagsConstEnumExcludes: int = (SymbolFlagsValue | SymbolFlagsType) & ~SymbolFlagsConstEnum;
export const SymbolFlagsValueModuleExcludes: int = SymbolFlagsValue & ~(SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum | SymbolFlagsValueModule);
export const SymbolFlagsNamespaceModuleExcludes: SymbolFlags = SymbolFlagsNone;
export const SymbolFlagsMethodExcludes: int = SymbolFlagsValue & ~SymbolFlagsMethod;
export const SymbolFlagsGetAccessorExcludes: int = SymbolFlagsValue & ~SymbolFlagsSetAccessor;
export const SymbolFlagsSetAccessorExcludes: int = SymbolFlagsValue & ~SymbolFlagsGetAccessor;
export const SymbolFlagsAccessorExcludes: int = SymbolFlagsValue;
export const SymbolFlagsTypeParameterExcludes: int = SymbolFlagsType & ~SymbolFlagsTypeParameter;
export const SymbolFlagsTypeAliasExcludes: int = SymbolFlagsType;
export const SymbolFlagsAliasExcludes: SymbolFlags = SymbolFlagsAlias;
export const SymbolFlagsModuleMember: int = SymbolFlagsVariable | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsModule | SymbolFlagsTypeAlias | SymbolFlagsAlias;
export const SymbolFlagsExportHasLocal: int = SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule;
export const SymbolFlagsBlockScoped: int = SymbolFlagsBlockScopedVariable | SymbolFlagsClass | SymbolFlagsEnum;
export const SymbolFlagsPropertyOrAccessor: int = SymbolFlagsProperty | SymbolFlagsAccessor;
export const SymbolFlagsClassMember: int = SymbolFlagsMethod | SymbolFlagsAccessor | SymbolFlagsProperty;
export const SymbolFlagsExportSupportsDefaultModifier: int = SymbolFlagsClass | SymbolFlagsFunction | SymbolFlagsInterface;
export const SymbolFlagsExportDoesNotSupportDefaultModifier: unknown = ~SymbolFlagsExportSupportsDefaultModifier;
export const SymbolFlagsClassifiable: int = SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsTypeAlias | SymbolFlagsInterface | SymbolFlagsTypeParameter | SymbolFlagsModule | SymbolFlagsAlias;
export const SymbolFlagsLateBindingContainer: int = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsTypeLiteral | SymbolFlagsObjectLiteral | SymbolFlagsFunction;
