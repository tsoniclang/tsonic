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
export const SymbolFlagsNone = 0;
export const SymbolFlagsFunctionScopedVariable = 1 << 0;
export const SymbolFlagsBlockScopedVariable = 1 << 1;
export const SymbolFlagsProperty = 1 << 2;
export const SymbolFlagsEnumMember = 1 << 3;
export const SymbolFlagsFunction = 1 << 4;
export const SymbolFlagsClass = 1 << 5;
export const SymbolFlagsInterface = 1 << 6;
export const SymbolFlagsConstEnum = 1 << 7;
export const SymbolFlagsRegularEnum = 1 << 8;
export const SymbolFlagsValueModule = 1 << 9;
export const SymbolFlagsNamespaceModule = 1 << 10;
export const SymbolFlagsTypeLiteral = 1 << 11;
export const SymbolFlagsObjectLiteral = 1 << 12;
export const SymbolFlagsMethod = 1 << 13;
export const SymbolFlagsConstructor = 1 << 14;
export const SymbolFlagsGetAccessor = 1 << 15;
export const SymbolFlagsSetAccessor = 1 << 16;
export const SymbolFlagsSignature = 1 << 17;
export const SymbolFlagsTypeParameter = 1 << 18;
export const SymbolFlagsTypeAlias = 1 << 19;
export const SymbolFlagsExportValue = 1 << 20;
export const SymbolFlagsAlias = 1 << 21;
export const SymbolFlagsPrototype = 1 << 22;
export const SymbolFlagsExportStar = 1 << 23;
export const SymbolFlagsOptional = 1 << 24;
export const SymbolFlagsTransient = 1 << 25;
export const SymbolFlagsAssignment = 1 << 26;
export const SymbolFlagsModuleExports = 1 << 27;
export const SymbolFlagsConstEnumOnlyModule = 1 << 28;
export const SymbolFlagsReplaceableByMethod = 1 << 29;
export const SymbolFlagsGlobalLookup = 1 << 30;
export const SymbolFlagsAll = (1 << 30) - 1;
export const SymbolFlagsEnum = SymbolFlagsRegularEnum | SymbolFlagsConstEnum;
export const SymbolFlagsVariable = SymbolFlagsFunctionScopedVariable | SymbolFlagsBlockScopedVariable;
export const SymbolFlagsValue = SymbolFlagsVariable | SymbolFlagsProperty | SymbolFlagsEnumMember | SymbolFlagsObjectLiteral | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule | SymbolFlagsMethod | SymbolFlagsGetAccessor | SymbolFlagsSetAccessor;
export const SymbolFlagsType = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsEnumMember | SymbolFlagsTypeLiteral | SymbolFlagsTypeParameter | SymbolFlagsTypeAlias;
export const SymbolFlagsNamespace = SymbolFlagsValueModule | SymbolFlagsNamespaceModule | SymbolFlagsEnum;
export const SymbolFlagsModule = SymbolFlagsValueModule | SymbolFlagsNamespaceModule;
export const SymbolFlagsAccessor = SymbolFlagsGetAccessor | SymbolFlagsSetAccessor;
export const SymbolFlagsFunctionScopedVariableExcludes = SymbolFlagsValue & ~SymbolFlagsFunctionScopedVariable;
export const SymbolFlagsBlockScopedVariableExcludes = SymbolFlagsValue;
export const SymbolFlagsParameterExcludes = SymbolFlagsValue;
export const SymbolFlagsPropertyExcludes = SymbolFlagsValue & ~(SymbolFlagsProperty | SymbolFlagsAccessor);
export const SymbolFlagsEnumMemberExcludes = SymbolFlagsValue | SymbolFlagsType;
export const SymbolFlagsFunctionExcludes = SymbolFlagsValue & ~(SymbolFlagsFunction | SymbolFlagsValueModule | SymbolFlagsClass);
export const SymbolFlagsClassExcludes = (SymbolFlagsValue | SymbolFlagsType) & ~(SymbolFlagsValueModule | SymbolFlagsInterface | SymbolFlagsFunction);
export const SymbolFlagsInterfaceExcludes = SymbolFlagsType & ~(SymbolFlagsInterface | SymbolFlagsClass);
export const SymbolFlagsRegularEnumExcludes = (SymbolFlagsValue | SymbolFlagsType) & ~(SymbolFlagsRegularEnum | SymbolFlagsValueModule);
export const SymbolFlagsConstEnumExcludes = (SymbolFlagsValue | SymbolFlagsType) & ~SymbolFlagsConstEnum;
export const SymbolFlagsValueModuleExcludes = SymbolFlagsValue & ~(SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsRegularEnum | SymbolFlagsValueModule);
export const SymbolFlagsNamespaceModuleExcludes = SymbolFlagsNone;
export const SymbolFlagsMethodExcludes = SymbolFlagsValue & ~SymbolFlagsMethod;
export const SymbolFlagsGetAccessorExcludes = SymbolFlagsValue & ~(SymbolFlagsSetAccessor | SymbolFlagsProperty);
export const SymbolFlagsSetAccessorExcludes = SymbolFlagsValue & ~(SymbolFlagsGetAccessor | SymbolFlagsProperty);
export const SymbolFlagsAccessorExcludes = SymbolFlagsValue & ~SymbolFlagsProperty;
export const SymbolFlagsTypeParameterExcludes = SymbolFlagsType & ~SymbolFlagsTypeParameter;
export const SymbolFlagsTypeAliasExcludes = SymbolFlagsType;
export const SymbolFlagsAliasExcludes = SymbolFlagsAlias;
export const SymbolFlagsModuleMember = SymbolFlagsVariable | SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsEnum | SymbolFlagsModule | SymbolFlagsTypeAlias | SymbolFlagsAlias;
export const SymbolFlagsExportHasLocal = SymbolFlagsFunction | SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsValueModule;
export const SymbolFlagsBlockScoped = SymbolFlagsBlockScopedVariable | SymbolFlagsClass | SymbolFlagsEnum;
export const SymbolFlagsPropertyOrAccessor = SymbolFlagsProperty | SymbolFlagsAccessor;
export const SymbolFlagsClassMember = SymbolFlagsMethod | SymbolFlagsAccessor | SymbolFlagsProperty;
export const SymbolFlagsExportSupportsDefaultModifier = SymbolFlagsClass | SymbolFlagsFunction | SymbolFlagsInterface;
export const SymbolFlagsExportDoesNotSupportDefaultModifier = ~SymbolFlagsExportSupportsDefaultModifier;
export const SymbolFlagsClassifiable = SymbolFlagsClass | SymbolFlagsEnum | SymbolFlagsTypeAlias | SymbolFlagsInterface | SymbolFlagsTypeParameter | SymbolFlagsModule | SymbolFlagsAlias;
export const SymbolFlagsLateBindingContainer = SymbolFlagsClass | SymbolFlagsInterface | SymbolFlagsTypeLiteral | SymbolFlagsObjectLiteral | SymbolFlagsFunction;
//# sourceMappingURL=symbolflags.js.map