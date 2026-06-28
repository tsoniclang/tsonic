import { goReceiverKey } from "../ast/spine.js";
import { ScriptTargetES2016, ScriptTargetES2017, ScriptTargetES2018, ScriptTargetES2019, ScriptTargetES2020, ScriptTargetES2021, ScriptTargetES2022, ScriptTargetESNext, } from "../core/compileroptions.js";
import { isTupleType } from "./checker/state.js";
import { ValueToString } from "./utilities.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ParseFlagsNone+ParseFlagsYield+ParseFlagsAwait+ParseFlagsType+ParseFlagsIgnoreMissingOpenBrace+ParseFlagsJSDoc","kind":"constGroup","status":"implemented","sigHash":"c1c0a30e1330ab6084823a9cec03c70fecd0e68844959d06e1c3bb28f6b7c3c3","bodyHash":"304b8d76415a4fb4ebbf1b0bdb9808b96888c28ca1f5ff5da235c83e6e82610a"}
 *
 * Go source:
 * const (
 * 	ParseFlagsNone                   ParseFlags = 0
 * 	ParseFlagsYield                  ParseFlags = 1 << 0
 * 	ParseFlagsAwait                  ParseFlags = 1 << 1
 * 	ParseFlagsType                   ParseFlags = 1 << 2
 * 	ParseFlagsIgnoreMissingOpenBrace ParseFlags = 1 << 4
 * 	ParseFlagsJSDoc                  ParseFlags = 1 << 5
 * )
 */
export const ParseFlagsNone = 0;
export const ParseFlagsYield = 1 << 0;
export const ParseFlagsAwait = 1 << 1;
export const ParseFlagsType = 1 << 2;
export const ParseFlagsIgnoreMissingOpenBrace = 1 << 4;
export const ParseFlagsJSDoc = 1 << 5;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SignatureKindCall+SignatureKindConstruct","kind":"constGroup","status":"implemented","sigHash":"b80c561477dde1c5424bd41e83faab8d3595115fc22bf8d1b384bbfe29d72e7a","bodyHash":"e225b0415aee3cd5998d2afc86b3cf6a3c09021ea30d36ffb11fd4a5554c3259"}
 *
 * Go source:
 * const (
 * 	SignatureKindCall SignatureKind = iota
 * 	SignatureKindConstruct
 * )
 */
export const SignatureKindCall = 0;
export const SignatureKindConstruct = 1;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ContextFlagsNone+ContextFlagsSignature+ContextFlagsNoConstraints+ContextFlagsIgnoreNodeInferences+ContextFlagsSkipBindingPatterns","kind":"constGroup","status":"implemented","sigHash":"9034bbcd30a8ae567952b360d29a8bec3cdb50caed2dabab7da95435e4f2e761","bodyHash":"c211aacf3c48b059d378a90a8e8d686db5432376ac351abf3dddf210f0ded3c4"}
 *
 * Go source:
 * const (
 * 	ContextFlagsNone                 ContextFlags = 0
 * 	ContextFlagsSignature            ContextFlags = 1 << 0 // Obtaining contextual signature
 * 	ContextFlagsNoConstraints        ContextFlags = 1 << 1 // Don't obtain type variable constraints
 * 	ContextFlagsIgnoreNodeInferences ContextFlags = 1 << 2 // Ignore inference to current node and parent nodes out to the containing call for, for example, completions
 * 	ContextFlagsSkipBindingPatterns  ContextFlags = 1 << 3 // Ignore contextual types applied by binding patterns
 * )
 */
export const ContextFlagsNone = 0;
export const ContextFlagsSignature = 1 << 0;
export const ContextFlagsNoConstraints = 1 << 1;
export const ContextFlagsIgnoreNodeInferences = 1 << 2;
export const ContextFlagsSkipBindingPatterns = 1 << 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFormatFlagsNone+TypeFormatFlagsNoTruncation+TypeFormatFlagsWriteArrayAsGenericType+TypeFormatFlagsGenerateNamesForShadowedTypeParams+TypeFormatFlagsUseStructuralFallback+TypeFormatFlagsWriteTypeArgumentsOfSignature+TypeFormatFlagsUseFullyQualifiedType+TypeFormatFlagsSuppressAnyReturnType+TypeFormatFlagsMultilineObjectLiterals+TypeFormatFlagsWriteClassExpressionAsTypeLiteral+TypeFormatFlagsUseTypeOfFunction+TypeFormatFlagsOmitParameterModifiers+TypeFormatFlagsUseAliasDefinedOutsideCurrentScope+TypeFormatFlagsUseSingleQuotesForStringLiteralType+TypeFormatFlagsNoTypeReduction+TypeFormatFlagsUseInstantiationExpressions+TypeFormatFlagsOmitThisParameter+TypeFormatFlagsWriteCallStyleSignature+TypeFormatFlagsAllowUniqueESSymbolType+TypeFormatFlagsAddUndefined+TypeFormatFlagsWriteArrowStyleSignature+TypeFormatFlagsInArrayType+TypeFormatFlagsInElementType+TypeFormatFlagsInFirstTypeArgument+TypeFormatFlagsInTypeAlias","kind":"constGroup","status":"implemented","sigHash":"b7b6208447ec2e7eced952ed3b794c15a545fad5d1752b9eaf3411323dc18f9a","bodyHash":"79b5350af2c1ff5c841a7e09df488ce9505ab56f4938de383dce8b3cf3ae929e"}
 *
 * Go source:
 * const (
 * 	TypeFormatFlagsNone                               TypeFormatFlags = 0
 * 	TypeFormatFlagsNoTruncation                       TypeFormatFlags = 1 << 0 // Don't truncate typeToString result
 * 	TypeFormatFlagsWriteArrayAsGenericType            TypeFormatFlags = 1 << 1 // Write Array<T> instead T[]
 * 	TypeFormatFlagsGenerateNamesForShadowedTypeParams TypeFormatFlags = 1 << 2 // When a type parameter T is shadowing another T, generate a name for it so it can still be referenced
 * 	TypeFormatFlagsUseStructuralFallback              TypeFormatFlags = 1 << 3 // When an alias cannot be named by its symbol, rather than report an error, fallback to a structural printout if possible
 * 	// hole because there's a hole in node builder flags
 * 	TypeFormatFlagsWriteTypeArgumentsOfSignature TypeFormatFlags = 1 << 5 // Write the type arguments instead of type parameters of the signature
 * 	TypeFormatFlagsUseFullyQualifiedType         TypeFormatFlags = 1 << 6 // Write out the fully qualified type name (eg. Module.Type, instead of Type)
 * 	// hole because `UseOnlyExternalAliasing` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` instead
 * 	TypeFormatFlagsSuppressAnyReturnType TypeFormatFlags = 1 << 8 // If the return type is any-like, don't offer a return type.
 * 	// hole because `WriteTypeParametersInQualifiedName` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` for this instead
 * 	TypeFormatFlagsMultilineObjectLiterals             TypeFormatFlags = 1 << 10 // Always print object literals across multiple lines (only used to map into node builder flags)
 * 	TypeFormatFlagsWriteClassExpressionAsTypeLiteral   TypeFormatFlags = 1 << 11 // Write a type literal instead of (Anonymous class)
 * 	TypeFormatFlagsUseTypeOfFunction                   TypeFormatFlags = 1 << 12 // Write typeof instead of function type literal
 * 	TypeFormatFlagsOmitParameterModifiers              TypeFormatFlags = 1 << 13 // Omit modifiers on parameters
 * 	TypeFormatFlagsUseAliasDefinedOutsideCurrentScope  TypeFormatFlags = 1 << 14 // For a `type T = ... ` defined in a different file, write `T` instead of its value, even though `T` can't be accessed in the current scope.
 * 	TypeFormatFlagsUseSingleQuotesForStringLiteralType TypeFormatFlags = 1 << 28 // Use single quotes for string literal type
 * 	TypeFormatFlagsNoTypeReduction                     TypeFormatFlags = 1 << 29 // Don't call getReducedType
 * 	TypeFormatFlagsUseInstantiationExpressions         TypeFormatFlags = 1 << 30 // Use instantiation expressions for qualified instantiated names like Foo<string>.Bar
 * 	TypeFormatFlagsOmitThisParameter                   TypeFormatFlags = 1 << 25
 * 	TypeFormatFlagsWriteCallStyleSignature             TypeFormatFlags = 1 << 27 // Write construct signatures as call style signatures
 * 	// Error Handling
 * 	TypeFormatFlagsAllowUniqueESSymbolType TypeFormatFlags = 1 << 20 // This is bit 20 to align with the same bit in `NodeBuilderFlags`
 * 	// TypeFormatFlags exclusive
 * 	TypeFormatFlagsAddUndefined             TypeFormatFlags = 1 << 17 // Add undefined to types of initialized, non-optional parameters
 * 	TypeFormatFlagsWriteArrowStyleSignature TypeFormatFlags = 1 << 18 // Write arrow style signature
 * 	// State
 * 	TypeFormatFlagsInArrayType         TypeFormatFlags = 1 << 19 // Writing an array element type
 * 	TypeFormatFlagsInElementType       TypeFormatFlags = 1 << 21 // Writing an array or union element type
 * 	TypeFormatFlagsInFirstTypeArgument TypeFormatFlags = 1 << 22 // Writing first type argument of the instantiated type
 * 	TypeFormatFlagsInTypeAlias         TypeFormatFlags = 1 << 23 // Writing type in type alias declaration
 * )
 */
export const TypeFormatFlagsNone = 0;
export const TypeFormatFlagsNoTruncation = 1 << 0;
export const TypeFormatFlagsWriteArrayAsGenericType = 1 << 1;
export const TypeFormatFlagsGenerateNamesForShadowedTypeParams = 1 << 2;
export const TypeFormatFlagsUseStructuralFallback = 1 << 3;
export const TypeFormatFlagsWriteTypeArgumentsOfSignature = 1 << 5;
export const TypeFormatFlagsUseFullyQualifiedType = 1 << 6;
export const TypeFormatFlagsSuppressAnyReturnType = 1 << 8;
export const TypeFormatFlagsMultilineObjectLiterals = 1 << 10;
export const TypeFormatFlagsWriteClassExpressionAsTypeLiteral = 1 << 11;
export const TypeFormatFlagsUseTypeOfFunction = 1 << 12;
export const TypeFormatFlagsOmitParameterModifiers = 1 << 13;
export const TypeFormatFlagsUseAliasDefinedOutsideCurrentScope = 1 << 14;
export const TypeFormatFlagsUseSingleQuotesForStringLiteralType = 1 << 28;
export const TypeFormatFlagsNoTypeReduction = 1 << 29;
export const TypeFormatFlagsUseInstantiationExpressions = 1 << 30;
export const TypeFormatFlagsOmitThisParameter = 1 << 25;
export const TypeFormatFlagsWriteCallStyleSignature = 1 << 27;
export const TypeFormatFlagsAllowUniqueESSymbolType = 1 << 20;
export const TypeFormatFlagsAddUndefined = 1 << 17;
export const TypeFormatFlagsWriteArrowStyleSignature = 1 << 18;
export const TypeFormatFlagsInArrayType = 1 << 19;
export const TypeFormatFlagsInElementType = 1 << 21;
export const TypeFormatFlagsInFirstTypeArgument = 1 << 22;
export const TypeFormatFlagsInTypeAlias = 1 << 23;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFormatFlagsNodeBuilderFlagsMask","kind":"constGroup","status":"implemented","sigHash":"552fd4c502bfd3aab7d7945a722a4e3c92ddb8fccba1f57d8e8dbc36c5867e5e","bodyHash":"664db6b1dec97fa5576d77e69819eff33591368ae45deefa40efe1934b6554a1"}
 *
 * Go source:
 * const TypeFormatFlagsNodeBuilderFlagsMask = TypeFormatFlagsNoTruncation | TypeFormatFlagsWriteArrayAsGenericType | TypeFormatFlagsGenerateNamesForShadowedTypeParams | TypeFormatFlagsUseStructuralFallback | TypeFormatFlagsWriteTypeArgumentsOfSignature |
 * 	TypeFormatFlagsUseFullyQualifiedType | TypeFormatFlagsSuppressAnyReturnType | TypeFormatFlagsMultilineObjectLiterals | TypeFormatFlagsWriteClassExpressionAsTypeLiteral |
 * 	TypeFormatFlagsUseTypeOfFunction | TypeFormatFlagsOmitParameterModifiers | TypeFormatFlagsUseAliasDefinedOutsideCurrentScope | TypeFormatFlagsAllowUniqueESSymbolType | TypeFormatFlagsInTypeAlias |
 * 	TypeFormatFlagsUseInstantiationExpressions |
 * 	TypeFormatFlagsUseSingleQuotesForStringLiteralType | TypeFormatFlagsNoTypeReduction | TypeFormatFlagsOmitThisParameter
 */
export const TypeFormatFlagsNodeBuilderFlagsMask = TypeFormatFlagsNoTruncation |
    TypeFormatFlagsWriteArrayAsGenericType |
    TypeFormatFlagsGenerateNamesForShadowedTypeParams |
    TypeFormatFlagsUseStructuralFallback |
    TypeFormatFlagsWriteTypeArgumentsOfSignature |
    TypeFormatFlagsUseFullyQualifiedType |
    TypeFormatFlagsSuppressAnyReturnType |
    TypeFormatFlagsMultilineObjectLiterals |
    TypeFormatFlagsWriteClassExpressionAsTypeLiteral |
    TypeFormatFlagsUseTypeOfFunction |
    TypeFormatFlagsOmitParameterModifiers |
    TypeFormatFlagsUseAliasDefinedOutsideCurrentScope |
    TypeFormatFlagsAllowUniqueESSymbolType |
    TypeFormatFlagsInTypeAlias |
    TypeFormatFlagsUseInstantiationExpressions |
    TypeFormatFlagsUseSingleQuotesForStringLiteralType |
    TypeFormatFlagsNoTypeReduction |
    TypeFormatFlagsOmitThisParameter;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SymbolFormatFlagsNone+SymbolFormatFlagsWriteTypeParametersOrArguments+SymbolFormatFlagsUseOnlyExternalAliasing+SymbolFormatFlagsAllowAnyNodeKind+SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope+SymbolFormatFlagsWriteComputedProps+SymbolFormatFlagsDoNotIncludeSymbolChain","kind":"constGroup","status":"implemented","sigHash":"2090027a4340072c37edd8e1dbdc2d55a25573a12b04b7474c4059e72540b656","bodyHash":"bbea4353b1049eeeefd1deb8686ab045b536497d5b978ce7a12c489a20606e2c"}
 *
 * Go source:
 * const (
 * 	SymbolFormatFlagsNone SymbolFormatFlags = 0
 * 	// Write symbols's type argument if it is instantiated symbol
 * 	// eg. class C<T> { p: T }   <-- Show p as C<T>.p here
 * 	//     var a: C<number>;
 * 	//     var p = a.p; <--- Here p is property of C<number> so show it as C<number>.p instead of just C.p
 * 	SymbolFormatFlagsWriteTypeParametersOrArguments SymbolFormatFlags = 1 << 0
 * 	// Use only external alias information to get the symbol name in the given context
 * 	// eg.  module m { export class c { } } import x = m.c;
 * 	// When this flag is specified m.c will be used to refer to the class instead of alias symbol x
 * 	SymbolFormatFlagsUseOnlyExternalAliasing SymbolFormatFlags = 1 << 1
 * 	// Build symbol name using any nodes needed, instead of just components of an entity name
 * 	SymbolFormatFlagsAllowAnyNodeKind SymbolFormatFlags = 1 << 2
 * 	// Prefer aliases which are not directly visible
 * 	SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope SymbolFormatFlags = 1 << 3
 * 	// { [E.A]: 1 }
 * 	/** @internal * /
 * 	SymbolFormatFlagsWriteComputedProps SymbolFormatFlags = 1 << 4
 * 	// Skip building an accessible symbol chain
 * 	/** @internal * /
 * 	SymbolFormatFlagsDoNotIncludeSymbolChain SymbolFormatFlags = 1 << 5
 * )
 */
export const SymbolFormatFlagsNone = 0;
export const SymbolFormatFlagsWriteTypeParametersOrArguments = 1 << 0;
export const SymbolFormatFlagsUseOnlyExternalAliasing = 1 << 1;
export const SymbolFormatFlagsAllowAnyNodeKind = 1 << 2;
export const SymbolFormatFlagsUseAliasDefinedOutsideCurrentScope = 1 << 3;
export const SymbolFormatFlagsWriteComputedProps = 1 << 4;
export const SymbolFormatFlagsDoNotIncludeSymbolChain = 1 << 5;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ExternalEmitHelpersRest+ExternalEmitHelpersDecorate+ExternalEmitHelpersMetadata+ExternalEmitHelpersParam+ExternalEmitHelpersAwaiter+ExternalEmitHelpersAwait+ExternalEmitHelpersAsyncGenerator+ExternalEmitHelpersAsyncDelegator+ExternalEmitHelpersAsyncValues+ExternalEmitHelpersExportStar+ExternalEmitHelpersImportStar+ExternalEmitHelpersImportDefault+ExternalEmitHelpersMakeTemplateObject+ExternalEmitHelpersClassPrivateFieldGet+ExternalEmitHelpersClassPrivateFieldSet+ExternalEmitHelpersClassPrivateFieldIn+ExternalEmitHelpersSetFunctionName+ExternalEmitHelpersPropKey+ExternalEmitHelpersAddDisposableResourceAndDisposeResources+ExternalEmitHelpersRewriteRelativeImportExtension+ExternalEmitHelpersESDecorateAndRunInitializers+ExternalEmitHelpersFirstEmitHelper+ExternalEmitHelpersLastEmitHelper+ExternalEmitHelpersForAwaitOfIncludes+ExternalEmitHelpersAsyncGeneratorIncludes+ExternalEmitHelpersAsyncDelegatorIncludes","kind":"constGroup","status":"implemented","sigHash":"b0eeb932a593bcbcf033a8873da201738a1afcc028bffc744a93165d27598941","bodyHash":"62e9c4303813c5bfddc2c0ce0cc46b51242017d32cb476ae12f7b63a92a76af9"}
 *
 * Go source:
 * const (
 * 	ExternalEmitHelpersRest                                     ExternalEmitHelpers           = 1 << iota // __rest (used by ESNext object rest transformation)
 * 	ExternalEmitHelpersDecorate                                                                           // __decorate (used by TypeScript decorators transformation)
 * 	ExternalEmitHelpersMetadata                                                                           // __metadata (used by TypeScript decorators transformation)
 * 	ExternalEmitHelpersParam                                                                              // __param (used by TypeScript decorators transformation)
 * 	ExternalEmitHelpersAwaiter                                                                            // __awaiter (used by ES2017 async functions transformation)
 * 	ExternalEmitHelpersAwait                                                                              // __await (used by ES2017 async generator transformation)
 * 	ExternalEmitHelpersAsyncGenerator                                                                     // __asyncGenerator (used by ES2017 async generator transformation)
 * 	ExternalEmitHelpersAsyncDelegator                                                                     // __asyncDelegator (used by ES2017 async generator yield* transformation)
 * 	ExternalEmitHelpersAsyncValues                                                                        // __asyncValues (used by ES2017 for..await..of transformation)
 * 	ExternalEmitHelpersExportStar                                                                         // __exportStar (used by CommonJS/AMD/UMD module transformation)
 * 	ExternalEmitHelpersImportStar                                                                         // __importStar (used by CommonJS/AMD/UMD module transformation)
 * 	ExternalEmitHelpersImportDefault                                                                      // __importDefault (used by CommonJS/AMD/UMD module transformation)
 * 	ExternalEmitHelpersMakeTemplateObject                                                                 // __makeTemplateObject (used for constructing template string array objects)
 * 	ExternalEmitHelpersClassPrivateFieldGet                                                               // __classPrivateFieldGet (used by the class private field transformation)
 * 	ExternalEmitHelpersClassPrivateFieldSet                                                               // __classPrivateFieldSet (used by the class private field transformation)
 * 	ExternalEmitHelpersClassPrivateFieldIn                                                                // __classPrivateFieldIn (used by the class private field transformation)
 * 	ExternalEmitHelpersSetFunctionName                                                                    // __setFunctionName (used by class fields and ECMAScript decorators)
 * 	ExternalEmitHelpersPropKey                                                                            // __propKey (used by class fields and ECMAScript decorators)
 * 	ExternalEmitHelpersAddDisposableResourceAndDisposeResources                                           // __addDisposableResource and __disposeResources (used by ESNext transformations)
 * 	ExternalEmitHelpersRewriteRelativeImportExtension                                                     // __rewriteRelativeImportExtension (used by --rewriteRelativeImportExtensions)
 * 	ExternalEmitHelpersESDecorateAndRunInitializers             = ExternalEmitHelpersDecorate             // __esDecorate and __runInitializers (used by ECMAScript decorators transformation)
 *
 * 	ExternalEmitHelpersFirstEmitHelper = ExternalEmitHelpersRest
 * 	ExternalEmitHelpersLastEmitHelper  = ExternalEmitHelpersRewriteRelativeImportExtension
 *
 * 	// Helpers included by ES2017 for..await..of
 * 	ExternalEmitHelpersForAwaitOfIncludes = ExternalEmitHelpersAsyncValues
 *
 * 	// Helpers included by ES2017 async generators
 * 	ExternalEmitHelpersAsyncGeneratorIncludes = ExternalEmitHelpersAwait | ExternalEmitHelpersAsyncGenerator
 *
 * 	// Helpers included by yield* in ES2017 async generators
 * 	ExternalEmitHelpersAsyncDelegatorIncludes = ExternalEmitHelpersAwait | ExternalEmitHelpersAsyncDelegator | ExternalEmitHelpersAsyncValues
 * )
 */
export const ExternalEmitHelpersRest = 1 << 0; // __rest (used by ESNext object rest transformation)
export const ExternalEmitHelpersDecorate = 1 << 1; // __decorate (used by TypeScript decorators transformation)
export const ExternalEmitHelpersMetadata = 1 << 2; // __metadata (used by TypeScript decorators transformation)
export const ExternalEmitHelpersParam = 1 << 3; // __param (used by TypeScript decorators transformation)
export const ExternalEmitHelpersAwaiter = 1 << 4; // __awaiter (used by ES2017 async functions transformation)
export const ExternalEmitHelpersAwait = 1 << 5; // __await (used by ES2017 async generator transformation)
export const ExternalEmitHelpersAsyncGenerator = 1 << 6; // __asyncGenerator (used by ES2017 async generator transformation)
export const ExternalEmitHelpersAsyncDelegator = 1 << 7; // __asyncDelegator (used by ES2017 async generator yield* transformation)
export const ExternalEmitHelpersAsyncValues = 1 << 8; // __asyncValues (used by ES2017 for..await..of transformation)
export const ExternalEmitHelpersExportStar = 1 << 9; // __exportStar (used by CommonJS/AMD/UMD module transformation)
export const ExternalEmitHelpersImportStar = 1 << 10; // __importStar (used by CommonJS/AMD/UMD module transformation)
export const ExternalEmitHelpersImportDefault = 1 << 11; // __importDefault (used by CommonJS/AMD/UMD module transformation)
export const ExternalEmitHelpersMakeTemplateObject = 1 << 12; // __makeTemplateObject (used for constructing template string array objects)
export const ExternalEmitHelpersClassPrivateFieldGet = 1 << 13; // __classPrivateFieldGet (used by the class private field transformation)
export const ExternalEmitHelpersClassPrivateFieldSet = 1 << 14; // __classPrivateFieldSet (used by the class private field transformation)
export const ExternalEmitHelpersClassPrivateFieldIn = 1 << 15; // __classPrivateFieldIn (used by the class private field transformation)
export const ExternalEmitHelpersSetFunctionName = 1 << 16; // __setFunctionName (used by class fields and ECMAScript decorators)
export const ExternalEmitHelpersPropKey = 1 << 17; // __propKey (used by class fields and ECMAScript decorators)
export const ExternalEmitHelpersAddDisposableResourceAndDisposeResources = 1 << 18; // __addDisposableResource and __disposeResources (used by ESNext transformations)
export const ExternalEmitHelpersRewriteRelativeImportExtension = 1 << 19; // __rewriteRelativeImportExtension (used by --rewriteRelativeImportExtensions)
export const ExternalEmitHelpersESDecorateAndRunInitializers = ExternalEmitHelpersDecorate; // __esDecorate and __runInitializers (used by ECMAScript decorators transformation)
export const ExternalEmitHelpersFirstEmitHelper = ExternalEmitHelpersRest;
export const ExternalEmitHelpersLastEmitHelper = ExternalEmitHelpersRewriteRelativeImportExtension;
// Helpers included by ES2017 for..await..of
export const ExternalEmitHelpersForAwaitOfIncludes = ExternalEmitHelpersAsyncValues;
// Helpers included by ES2017 async generators
export const ExternalEmitHelpersAsyncGeneratorIncludes = (ExternalEmitHelpersAwait | ExternalEmitHelpersAsyncGenerator) >>> 0;
// Helpers included by yield* in ES2017 async generators
export const ExternalEmitHelpersAsyncDelegatorIncludes = (ExternalEmitHelpersAwait | ExternalEmitHelpersAsyncDelegator | ExternalEmitHelpersAsyncValues) >>> 0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::externalHelpersModuleNameText","kind":"constGroup","status":"implemented","sigHash":"42b8d30f6cec123c960fc65215bb7957d60e1e2100a713e6f60422dd65ee175e","bodyHash":"3a84e0e3d22c1db0bc8672e8e58062771a665415a82256bcf69ae99de8d0f1f2"}
 *
 * Go source:
 * const externalHelpersModuleNameText = "tslib"
 */
export const externalHelpersModuleNameText = "tslib";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ExhaustiveStateUnknown+ExhaustiveStateComputing+ExhaustiveStateFalse+ExhaustiveStateTrue","kind":"constGroup","status":"implemented","sigHash":"f1dec9836acfed71718429224dacd81c05322c477a25da5ee051fb8bafc9f3a8","bodyHash":"e09c796b62051e6a164d1142c8d7aa5b164b5f877a238558032967cd9f3eb508"}
 *
 * Go source:
 * const (
 * 	ExhaustiveStateUnknown   ExhaustiveState = iota // Exhaustive state not computed
 * 	ExhaustiveStateComputing                        // Exhaustive state computation in progress
 * 	ExhaustiveStateFalse                            // Switch statement is not exhaustive
 * 	ExhaustiveStateTrue                             // Switch statement is exhaustive
 * )
 */
export const ExhaustiveStateUnknown = 0;
export const ExhaustiveStateComputing = 1;
export const ExhaustiveStateFalse = 2;
export const ExhaustiveStateTrue = 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::MembersOrExportsResolutionKindResolvedExports+MembersOrExportsResolutionKindResolvedMembers","kind":"constGroup","status":"implemented","sigHash":"187f7e9d2011030d1eafec863e9bc4743360489acda77fe4ec55818c5e7fbeed","bodyHash":"06370d06c8eb2b8ececcf8ed23b3d7fa7e5f9659f1ec589944e826b5e9e50776"}
 *
 * Go source:
 * const (
 * 	MembersOrExportsResolutionKindResolvedExports MembersOrExportsResolutionKind = 0
 * 	MembersOrExportsResolutionKindResolvedMembers MembersOrExportsResolutionKind = 1
 * )
 */
export const MembersOrExportsResolutionKindResolvedExports = 0;
export const MembersOrExportsResolutionKindResolvedMembers = 1;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::VarianceFlagsInvariant+VarianceFlagsCovariant+VarianceFlagsContravariant+VarianceFlagsBivariant+VarianceFlagsIndependent+VarianceFlagsVarianceMask+VarianceFlagsUnmeasurable+VarianceFlagsUnreliable+VarianceFlagsAllowsStructuralFallback","kind":"constGroup","status":"implemented","sigHash":"6da7bd90835c94d51e05bb2a23ef313065331916fe2b77c9478d71036e644341","bodyHash":"153ac08f1e7ce50f230e6253adf0a106f1a330a841a79396c91529febbd66dca"}
 *
 * Go source:
 * const (
 * 	VarianceFlagsInvariant                VarianceFlags = 0                                                                                                       // Neither covariant nor contravariant
 * 	VarianceFlagsCovariant                VarianceFlags = 1 << 0                                                                                                  // Covariant
 * 	VarianceFlagsContravariant            VarianceFlags = 1 << 1                                                                                                  // Contravariant
 * 	VarianceFlagsBivariant                VarianceFlags = VarianceFlagsCovariant | VarianceFlagsContravariant                                                     // Both covariant and contravariant
 * 	VarianceFlagsIndependent              VarianceFlags = 1 << 2                                                                                                  // Unwitnessed type parameter
 * 	VarianceFlagsVarianceMask             VarianceFlags = VarianceFlagsInvariant | VarianceFlagsCovariant | VarianceFlagsContravariant | VarianceFlagsIndependent // Mask containing all measured variances without the unmeasurable flag
 * 	VarianceFlagsUnmeasurable             VarianceFlags = 1 << 3                                                                                                  // Variance result is unusable - relationship relies on structural comparisons which are not reflected in generic relationships
 * 	VarianceFlagsUnreliable               VarianceFlags = 1 << 4                                                                                                  // Variance result is unreliable - checking may produce false negatives, but not false positives
 * 	VarianceFlagsAllowsStructuralFallback               = VarianceFlagsUnmeasurable | VarianceFlagsUnreliable
 * )
 */
export const VarianceFlagsInvariant = 0;
export const VarianceFlagsCovariant = 1 << 0;
export const VarianceFlagsContravariant = 1 << 1;
export const VarianceFlagsBivariant = VarianceFlagsCovariant | VarianceFlagsContravariant;
export const VarianceFlagsIndependent = 1 << 2;
export const VarianceFlagsVarianceMask = VarianceFlagsInvariant | VarianceFlagsCovariant | VarianceFlagsContravariant | VarianceFlagsIndependent;
export const VarianceFlagsUnmeasurable = 1 << 3;
export const VarianceFlagsUnreliable = 1 << 4;
export const VarianceFlagsAllowsStructuralFallback = VarianceFlagsUnmeasurable | VarianceFlagsUnreliable;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::AccessFlagsNone+AccessFlagsIncludeUndefined+AccessFlagsNoIndexSignatures+AccessFlagsWriting+AccessFlagsCacheSymbol+AccessFlagsAllowMissing+AccessFlagsExpressionPosition+AccessFlagsReportDeprecated+AccessFlagsSuppressNoImplicitAnyError+AccessFlagsContextual+AccessFlagsPersistent","kind":"constGroup","status":"implemented","sigHash":"f3c32f19650778904a418e71e7c32f340f538e77a2aa6931d4a08493be68ec6b","bodyHash":"ba75db7ed523691573d77d5c52f2e5cc4a0dddb4190f018fe92cbf14e7f6a21b"}
 *
 * Go source:
 * const (
 * 	AccessFlagsNone                       AccessFlags = 0
 * 	AccessFlagsIncludeUndefined           AccessFlags = 1 << 0
 * 	AccessFlagsNoIndexSignatures          AccessFlags = 1 << 1
 * 	AccessFlagsWriting                    AccessFlags = 1 << 2
 * 	AccessFlagsCacheSymbol                AccessFlags = 1 << 3
 * 	AccessFlagsAllowMissing               AccessFlags = 1 << 4
 * 	AccessFlagsExpressionPosition         AccessFlags = 1 << 5
 * 	AccessFlagsReportDeprecated           AccessFlags = 1 << 6
 * 	AccessFlagsSuppressNoImplicitAnyError AccessFlags = 1 << 7
 * 	AccessFlagsContextual                 AccessFlags = 1 << 8
 * 	AccessFlagsPersistent                             = AccessFlagsIncludeUndefined
 * )
 */
export const AccessFlagsNone = 0;
export const AccessFlagsIncludeUndefined = 1 << 0;
export const AccessFlagsNoIndexSignatures = 1 << 1;
export const AccessFlagsWriting = 1 << 2;
export const AccessFlagsCacheSymbol = 1 << 3;
export const AccessFlagsAllowMissing = 1 << 4;
export const AccessFlagsExpressionPosition = 1 << 5;
export const AccessFlagsReportDeprecated = 1 << 6;
export const AccessFlagsSuppressNoImplicitAnyError = 1 << 7;
export const AccessFlagsContextual = 1 << 8;
export const AccessFlagsPersistent = AccessFlagsIncludeUndefined;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::NodeCheckFlagsNone+NodeCheckFlagsTypeChecked+NodeCheckFlagsContextChecked+NodeCheckFlagsEnumValuesComputed+NodeCheckFlagsAssignmentsMarked+NodeCheckFlagsContainsClassWithPrivateIdentifiers+NodeCheckFlagsContainsSuperPropertyInStaticInitializer+NodeCheckFlagsInCheckIdentifier+NodeCheckFlagsInitializerIsUndefined+NodeCheckFlagsInitializerIsUndefinedComputed","kind":"constGroup","status":"implemented","sigHash":"8303b8b101c6029e3359020146d3cba3ec60339a21f0e36312edb8158d08a93c","bodyHash":"04461a1cdf460d62a20e0213d9f078b25a3e55c01bda51452b83bb0c4c333b09"}
 *
 * Go source:
 * const (
 * 	NodeCheckFlagsNone                                     NodeCheckFlags = 0
 * 	NodeCheckFlagsTypeChecked                              NodeCheckFlags = 1 << 0  // Node has been type checked
 * 	NodeCheckFlagsContextChecked                           NodeCheckFlags = 1 << 6  // Contextual types have been assigned
 * 	NodeCheckFlagsEnumValuesComputed                       NodeCheckFlags = 1 << 10 // Values for enum members have been computed, and any errors have been reported for them.
 * 	NodeCheckFlagsAssignmentsMarked                        NodeCheckFlags = 1 << 17 // Parameter assignments have been marked
 * 	NodeCheckFlagsContainsClassWithPrivateIdentifiers      NodeCheckFlags = 1 << 20 // Marked on all block-scoped containers containing a class with private identifiers.
 * 	NodeCheckFlagsContainsSuperPropertyInStaticInitializer NodeCheckFlags = 1 << 21 // Marked on all block-scoped containers containing a static initializer with 'super.x' or 'super[x]'.
 * 	NodeCheckFlagsInCheckIdentifier                        NodeCheckFlags = 1 << 22
 * 	NodeCheckFlagsInitializerIsUndefined                   NodeCheckFlags = 1 << 24
 * 	NodeCheckFlagsInitializerIsUndefinedComputed           NodeCheckFlags = 1 << 25
 * )
 */
export const NodeCheckFlagsNone = 0;
export const NodeCheckFlagsTypeChecked = 1 << 0;
export const NodeCheckFlagsContextChecked = 1 << 6;
export const NodeCheckFlagsEnumValuesComputed = 1 << 10;
export const NodeCheckFlagsAssignmentsMarked = 1 << 17;
export const NodeCheckFlagsContainsClassWithPrivateIdentifiers = 1 << 20;
export const NodeCheckFlagsContainsSuperPropertyInStaticInitializer = 1 << 21;
export const NodeCheckFlagsInCheckIdentifier = 1 << 22;
export const NodeCheckFlagsInitializerIsUndefined = 1 << 24;
export const NodeCheckFlagsInitializerIsUndefinedComputed = 1 << 25;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypeFlagsNone+TypeFlagsAny+TypeFlagsUnknown+TypeFlagsUndefined+TypeFlagsNull+TypeFlagsVoid+TypeFlagsString+TypeFlagsNumber+TypeFlagsBigInt+TypeFlagsBoolean+TypeFlagsESSymbol+TypeFlagsStringLiteral+TypeFlagsNumberLiteral+TypeFlagsBigIntLiteral+TypeFlagsBooleanLiteral+TypeFlagsUniqueESSymbol+TypeFlagsEnumLiteral+TypeFlagsEnum+TypeFlagsNonPrimitive+TypeFlagsNever+TypeFlagsTypeParameter+TypeFlagsObject+TypeFlagsIndex+TypeFlagsTemplateLiteral+TypeFlagsStringMapping+TypeFlagsSubstitution+TypeFlagsIndexedAccess+TypeFlagsConditional+TypeFlagsUnion+TypeFlagsIntersection+TypeFlagsReserved1+TypeFlagsReserved2+TypeFlagsReserved3+TypeFlagsAnyOrUnknown+TypeFlagsNullable+TypeFlagsLiteral+TypeFlagsUnit+TypeFlagsFreshable+TypeFlagsStringOrNumberLiteral+TypeFlagsStringOrNumberLiteralOrUnique+TypeFlagsDefinitelyFalsy+TypeFlagsPossiblyFalsy+TypeFlagsIntrinsic+TypeFlagsStringLike+TypeFlagsNumberLike+TypeFlagsBigIntLike+TypeFlagsBooleanLike+TypeFlagsEnumLike+TypeFlagsESSymbolLike+TypeFlagsVoidLike+TypeFlagsPrimitive+TypeFlagsDefinitelyNonNullable+TypeFlagsDisjointDomains+TypeFlagsUnionOrIntersection+TypeFlagsStructuredType+TypeFlagsTypeVariable+TypeFlagsInstantiableNonPrimitive+TypeFlagsInstantiablePrimitive+TypeFlagsInstantiable+TypeFlagsStructuredOrInstantiable+TypeFlagsObjectFlagsType+TypeFlagsSimplifiable+TypeFlagsSingleton+TypeFlagsNarrowable+TypeFlagsIncludesMask+TypeFlagsIncludesMissingType+TypeFlagsIncludesNonWideningType+TypeFlagsIncludesWildcard+TypeFlagsIncludesEmptyObject+TypeFlagsIncludesInstantiable+TypeFlagsIncludesConstrainedTypeVariable+TypeFlagsIncludesError+TypeFlagsNotPrimitiveUnion","kind":"constGroup","status":"implemented","sigHash":"79e0a5b4d4e3bfa731cbf0af0f5d78713e49dfbbfb53cbee19852ac3b59ac2e2","bodyHash":"83deca7e1d2860e77c78d95b3f6f15e6755cd9eee323d9e875fd5e0f444c19bc"}
 *
 * Go source:
 * const (
 * 	TypeFlagsNone            TypeFlags = 0
 * 	TypeFlagsAny             TypeFlags = 1 << 0
 * 	TypeFlagsUnknown         TypeFlags = 1 << 1
 * 	TypeFlagsUndefined       TypeFlags = 1 << 2
 * 	TypeFlagsNull            TypeFlags = 1 << 3
 * 	TypeFlagsVoid            TypeFlags = 1 << 4
 * 	TypeFlagsString          TypeFlags = 1 << 5
 * 	TypeFlagsNumber          TypeFlags = 1 << 6
 * 	TypeFlagsBigInt          TypeFlags = 1 << 7
 * 	TypeFlagsBoolean         TypeFlags = 1 << 8
 * 	TypeFlagsESSymbol        TypeFlags = 1 << 9 // Type of symbol primitive introduced in ES6
 * 	TypeFlagsStringLiteral   TypeFlags = 1 << 10
 * 	TypeFlagsNumberLiteral   TypeFlags = 1 << 11
 * 	TypeFlagsBigIntLiteral   TypeFlags = 1 << 12
 * 	TypeFlagsBooleanLiteral  TypeFlags = 1 << 13
 * 	TypeFlagsUniqueESSymbol  TypeFlags = 1 << 14 // unique symbol
 * 	TypeFlagsEnumLiteral     TypeFlags = 1 << 15 // Always combined with StringLiteral, NumberLiteral, or Union
 * 	TypeFlagsEnum            TypeFlags = 1 << 16 // Numeric computed enum member value (must be right after EnumLiteral, see getSortOrderFlags)
 * 	TypeFlagsNonPrimitive    TypeFlags = 1 << 17 // intrinsic object type
 * 	TypeFlagsNever           TypeFlags = 1 << 18 // Never type
 * 	TypeFlagsTypeParameter   TypeFlags = 1 << 19 // Type parameter
 * 	TypeFlagsObject          TypeFlags = 1 << 20 // Object type
 * 	TypeFlagsIndex           TypeFlags = 1 << 21 // keyof T
 * 	TypeFlagsTemplateLiteral TypeFlags = 1 << 22 // Template literal type
 * 	TypeFlagsStringMapping   TypeFlags = 1 << 23 // Uppercase/Lowercase type
 * 	TypeFlagsSubstitution    TypeFlags = 1 << 24 // Type parameter substitution
 * 	TypeFlagsIndexedAccess   TypeFlags = 1 << 25 // T[K]
 * 	TypeFlagsConditional     TypeFlags = 1 << 26 // T extends U ? X : Y
 * 	TypeFlagsUnion           TypeFlags = 1 << 27 // Union (T | U)
 * 	TypeFlagsIntersection    TypeFlags = 1 << 28 // Intersection (T & U)
 * 	TypeFlagsReserved1       TypeFlags = 1 << 29 // Used by union/intersection type construction
 * 	TypeFlagsReserved2       TypeFlags = 1 << 30 // Used by union/intersection type construction
 * 	TypeFlagsReserved3       TypeFlags = 1 << 31
 *
 * 	TypeFlagsAnyOrUnknown                  = TypeFlagsAny | TypeFlagsUnknown
 * 	TypeFlagsNullable                      = TypeFlagsUndefined | TypeFlagsNull
 * 	TypeFlagsLiteral                       = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral
 * 	TypeFlagsUnit                          = TypeFlagsEnum | TypeFlagsLiteral | TypeFlagsUniqueESSymbol | TypeFlagsNullable
 * 	TypeFlagsFreshable                     = TypeFlagsEnum | TypeFlagsLiteral
 * 	TypeFlagsStringOrNumberLiteral         = TypeFlagsStringLiteral | TypeFlagsNumberLiteral
 * 	TypeFlagsStringOrNumberLiteralOrUnique = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsUniqueESSymbol
 * 	TypeFlagsDefinitelyFalsy               = TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull
 * 	TypeFlagsPossiblyFalsy                 = TypeFlagsDefinitelyFalsy | TypeFlagsString | TypeFlagsNumber | TypeFlagsBigInt | TypeFlagsBoolean
 * 	TypeFlagsIntrinsic                     = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsString | TypeFlagsNumber | TypeFlagsBigInt | TypeFlagsESSymbol | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsNever | TypeFlagsNonPrimitive
 * 	TypeFlagsStringLike                    = TypeFlagsString | TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	TypeFlagsNumberLike                    = TypeFlagsNumber | TypeFlagsNumberLiteral | TypeFlagsEnum
 * 	TypeFlagsBigIntLike                    = TypeFlagsBigInt | TypeFlagsBigIntLiteral
 * 	TypeFlagsBooleanLike                   = TypeFlagsBoolean | TypeFlagsBooleanLiteral
 * 	TypeFlagsEnumLike                      = TypeFlagsEnum | TypeFlagsEnumLiteral
 * 	TypeFlagsESSymbolLike                  = TypeFlagsESSymbol | TypeFlagsUniqueESSymbol
 * 	TypeFlagsVoidLike                      = TypeFlagsVoid | TypeFlagsUndefined
 * 	TypeFlagsPrimitive                     = TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsEnumLike | TypeFlagsESSymbolLike | TypeFlagsVoidLike | TypeFlagsNull
 * 	TypeFlagsDefinitelyNonNullable         = TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsEnumLike | TypeFlagsESSymbolLike | TypeFlagsObject | TypeFlagsNonPrimitive
 * 	TypeFlagsDisjointDomains               = TypeFlagsNonPrimitive | TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsESSymbolLike | TypeFlagsVoidLike | TypeFlagsNull
 * 	TypeFlagsUnionOrIntersection           = TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsStructuredType                = TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsTypeVariable                  = TypeFlagsTypeParameter | TypeFlagsIndexedAccess
 * 	TypeFlagsInstantiableNonPrimitive      = TypeFlagsTypeVariable | TypeFlagsConditional | TypeFlagsSubstitution
 * 	TypeFlagsInstantiablePrimitive         = TypeFlagsIndex | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	TypeFlagsInstantiable                  = TypeFlagsInstantiableNonPrimitive | TypeFlagsInstantiablePrimitive
 * 	TypeFlagsStructuredOrInstantiable      = TypeFlagsStructuredType | TypeFlagsInstantiable
 * 	TypeFlagsObjectFlagsType               = TypeFlagsAny | TypeFlagsNullable | TypeFlagsNever | TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection
 * 	TypeFlagsSimplifiable                  = TypeFlagsIndexedAccess | TypeFlagsConditional | TypeFlagsIndex
 * 	TypeFlagsSingleton                     = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsString | TypeFlagsNumber | TypeFlagsBoolean | TypeFlagsBigInt | TypeFlagsESSymbol | TypeFlagsVoid | TypeFlagsUndefined | TypeFlagsNull | TypeFlagsNever | TypeFlagsNonPrimitive
 * 	// 'TypeFlagsNarrowable' types are types where narrowing actually narrows.
 * 	// This *should* be every type other than null, undefined, void, and never
 * 	TypeFlagsNarrowable = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsStructuredOrInstantiable | TypeFlagsStringLike | TypeFlagsNumberLike | TypeFlagsBigIntLike | TypeFlagsBooleanLike | TypeFlagsESSymbol | TypeFlagsUniqueESSymbol | TypeFlagsNonPrimitive
 * 	// The following flags are aggregated during union and intersection type construction
 * 	TypeFlagsIncludesMask = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsPrimitive | TypeFlagsNever | TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection | TypeFlagsNonPrimitive | TypeFlagsTemplateLiteral | TypeFlagsStringMapping
 * 	// The following flags are used for different purposes during union and intersection type construction
 * 	TypeFlagsIncludesMissingType             = TypeFlagsTypeParameter
 * 	TypeFlagsIncludesNonWideningType         = TypeFlagsIndex
 * 	TypeFlagsIncludesWildcard                = TypeFlagsIndexedAccess
 * 	TypeFlagsIncludesEmptyObject             = TypeFlagsConditional
 * 	TypeFlagsIncludesInstantiable            = TypeFlagsSubstitution
 * 	TypeFlagsIncludesConstrainedTypeVariable = TypeFlagsReserved1
 * 	TypeFlagsIncludesError                   = TypeFlagsReserved2
 * 	TypeFlagsNotPrimitiveUnion               = TypeFlagsAny | TypeFlagsUnknown | TypeFlagsVoid | TypeFlagsNever | TypeFlagsObject | TypeFlagsIntersection | TypeFlagsIncludesInstantiable
 * )
 */
export const TypeFlagsNone = 0;
export const TypeFlagsAny = 1 << 0;
export const TypeFlagsUnknown = 1 << 1;
export const TypeFlagsUndefined = 1 << 2;
export const TypeFlagsNull = 1 << 3;
export const TypeFlagsVoid = 1 << 4;
export const TypeFlagsString = 1 << 5;
export const TypeFlagsNumber = 1 << 6;
export const TypeFlagsBigInt = 1 << 7;
export const TypeFlagsBoolean = 1 << 8;
export const TypeFlagsESSymbol = 1 << 9;
export const TypeFlagsStringLiteral = 1 << 10;
export const TypeFlagsNumberLiteral = 1 << 11;
export const TypeFlagsBigIntLiteral = 1 << 12;
export const TypeFlagsBooleanLiteral = 1 << 13;
export const TypeFlagsUniqueESSymbol = 1 << 14;
export const TypeFlagsEnumLiteral = 1 << 15;
export const TypeFlagsEnum = 1 << 16;
export const TypeFlagsNonPrimitive = 1 << 17;
export const TypeFlagsNever = 1 << 18;
export const TypeFlagsTypeParameter = 1 << 19;
export const TypeFlagsObject = 1 << 20;
export const TypeFlagsIndex = 1 << 21;
export const TypeFlagsTemplateLiteral = 1 << 22;
export const TypeFlagsStringMapping = 1 << 23;
export const TypeFlagsSubstitution = 1 << 24;
export const TypeFlagsIndexedAccess = 1 << 25;
export const TypeFlagsConditional = 1 << 26;
export const TypeFlagsUnion = 1 << 27;
export const TypeFlagsIntersection = 1 << 28;
export const TypeFlagsReserved1 = 1 << 29;
export const TypeFlagsReserved2 = 1 << 30;
export const TypeFlagsReserved3 = 2147483648;
export const TypeFlagsAnyOrUnknown = (TypeFlagsAny | TypeFlagsUnknown) >>> 0;
export const TypeFlagsNullable = (TypeFlagsUndefined | TypeFlagsNull) >>> 0;
export const TypeFlagsLiteral = (TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsBigIntLiteral | TypeFlagsBooleanLiteral) >>> 0;
export const TypeFlagsUnit = (TypeFlagsEnum | TypeFlagsLiteral | TypeFlagsUniqueESSymbol | TypeFlagsNullable) >>> 0;
export const TypeFlagsFreshable = (TypeFlagsEnum | TypeFlagsLiteral) >>> 0;
export const TypeFlagsStringOrNumberLiteral = (TypeFlagsStringLiteral | TypeFlagsNumberLiteral) >>> 0;
export const TypeFlagsStringOrNumberLiteralOrUnique = (TypeFlagsStringLiteral | TypeFlagsNumberLiteral | TypeFlagsUniqueESSymbol) >>> 0;
export const TypeFlagsDefinitelyFalsy = (TypeFlagsStringLiteral |
    TypeFlagsNumberLiteral |
    TypeFlagsBigIntLiteral |
    TypeFlagsBooleanLiteral |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull) >>>
    0;
export const TypeFlagsPossiblyFalsy = (TypeFlagsDefinitelyFalsy |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBigInt |
    TypeFlagsBoolean) >>>
    0;
export const TypeFlagsIntrinsic = (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBigInt |
    TypeFlagsESSymbol |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull |
    TypeFlagsNever |
    TypeFlagsNonPrimitive) >>>
    0;
export const TypeFlagsStringLike = (TypeFlagsString | TypeFlagsStringLiteral | TypeFlagsTemplateLiteral | TypeFlagsStringMapping) >>> 0;
export const TypeFlagsNumberLike = (TypeFlagsNumber | TypeFlagsNumberLiteral | TypeFlagsEnum) >>> 0;
export const TypeFlagsBigIntLike = (TypeFlagsBigInt | TypeFlagsBigIntLiteral) >>> 0;
export const TypeFlagsBooleanLike = (TypeFlagsBoolean | TypeFlagsBooleanLiteral) >>> 0;
export const TypeFlagsEnumLike = (TypeFlagsEnum | TypeFlagsEnumLiteral) >>> 0;
export const TypeFlagsESSymbolLike = (TypeFlagsESSymbol | TypeFlagsUniqueESSymbol) >>> 0;
export const TypeFlagsVoidLike = (TypeFlagsVoid | TypeFlagsUndefined) >>> 0;
export const TypeFlagsPrimitive = (TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsEnumLike |
    TypeFlagsESSymbolLike |
    TypeFlagsVoidLike |
    TypeFlagsNull) >>>
    0;
export const TypeFlagsDefinitelyNonNullable = (TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsEnumLike |
    TypeFlagsESSymbolLike |
    TypeFlagsObject |
    TypeFlagsNonPrimitive) >>>
    0;
export const TypeFlagsDisjointDomains = (TypeFlagsNonPrimitive |
    TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsESSymbolLike |
    TypeFlagsVoidLike |
    TypeFlagsNull) >>>
    0;
export const TypeFlagsUnionOrIntersection = (TypeFlagsUnion | TypeFlagsIntersection) >>> 0;
export const TypeFlagsStructuredType = (TypeFlagsObject | TypeFlagsUnion | TypeFlagsIntersection) >>> 0;
export const TypeFlagsTypeVariable = (TypeFlagsTypeParameter | TypeFlagsIndexedAccess) >>> 0;
export const TypeFlagsInstantiableNonPrimitive = (TypeFlagsTypeVariable | TypeFlagsConditional | TypeFlagsSubstitution) >>> 0;
export const TypeFlagsInstantiablePrimitive = (TypeFlagsIndex | TypeFlagsTemplateLiteral | TypeFlagsStringMapping) >>> 0;
export const TypeFlagsInstantiable = (TypeFlagsInstantiableNonPrimitive | TypeFlagsInstantiablePrimitive) >>> 0;
export const TypeFlagsStructuredOrInstantiable = (TypeFlagsStructuredType | TypeFlagsInstantiable) >>> 0;
export const TypeFlagsObjectFlagsType = (TypeFlagsAny |
    TypeFlagsNullable |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsUnion |
    TypeFlagsIntersection) >>>
    0;
export const TypeFlagsSimplifiable = (TypeFlagsIndexedAccess | TypeFlagsConditional | TypeFlagsIndex) >>> 0;
export const TypeFlagsSingleton = (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsString |
    TypeFlagsNumber |
    TypeFlagsBoolean |
    TypeFlagsBigInt |
    TypeFlagsESSymbol |
    TypeFlagsVoid |
    TypeFlagsUndefined |
    TypeFlagsNull |
    TypeFlagsNever |
    TypeFlagsNonPrimitive) >>>
    0;
export const TypeFlagsNarrowable = (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsStructuredOrInstantiable |
    TypeFlagsStringLike |
    TypeFlagsNumberLike |
    TypeFlagsBigIntLike |
    TypeFlagsBooleanLike |
    TypeFlagsESSymbol |
    TypeFlagsUniqueESSymbol |
    TypeFlagsNonPrimitive) >>>
    0;
export const TypeFlagsIncludesMask = (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsPrimitive |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsUnion |
    TypeFlagsIntersection |
    TypeFlagsNonPrimitive |
    TypeFlagsTemplateLiteral |
    TypeFlagsStringMapping) >>>
    0;
export const TypeFlagsIncludesMissingType = TypeFlagsTypeParameter;
export const TypeFlagsIncludesNonWideningType = TypeFlagsIndex;
export const TypeFlagsIncludesWildcard = TypeFlagsIndexedAccess;
export const TypeFlagsIncludesEmptyObject = TypeFlagsConditional;
export const TypeFlagsIncludesInstantiable = TypeFlagsSubstitution;
export const TypeFlagsIncludesConstrainedTypeVariable = TypeFlagsReserved1;
export const TypeFlagsIncludesError = TypeFlagsReserved2;
export const TypeFlagsNotPrimitiveUnion = (TypeFlagsAny |
    TypeFlagsUnknown |
    TypeFlagsVoid |
    TypeFlagsNever |
    TypeFlagsObject |
    TypeFlagsIntersection |
    TypeFlagsIncludesInstantiable) >>>
    0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::varGroup::typeFlagNames","kind":"varGroup","status":"implemented","sigHash":"c753024a4232d6b27b9d88418e5396ae0f39c1250d4ef3db0aebe1a1771100f5","bodyHash":"0c308b06afa0145efe922e75f54f9b2278a37d3a2baec18d5f3af4f65f0761b5"}
 *
 * Go source:
 * var typeFlagNames = [...]struct {
 * 	flag TypeFlags
 * 	name string
 * }{
 * 	{TypeFlagsAny, "Any"},
 * 	{TypeFlagsUnknown, "Unknown"},
 * 	{TypeFlagsUndefined, "Undefined"},
 * 	{TypeFlagsNull, "Null"},
 * 	{TypeFlagsVoid, "Void"},
 * 	{TypeFlagsString, "String"},
 * 	{TypeFlagsNumber, "Number"},
 * 	{TypeFlagsBigInt, "BigInt"},
 * 	{TypeFlagsBoolean, "Boolean"},
 * 	{TypeFlagsESSymbol, "ESSymbol"},
 * 	{TypeFlagsStringLiteral, "StringLiteral"},
 * 	{TypeFlagsNumberLiteral, "NumberLiteral"},
 * 	{TypeFlagsBigIntLiteral, "BigIntLiteral"},
 * 	{TypeFlagsBooleanLiteral, "BooleanLiteral"},
 * 	{TypeFlagsUniqueESSymbol, "UniqueESSymbol"},
 * 	{TypeFlagsEnumLiteral, "EnumLiteral"},
 * 	{TypeFlagsEnum, "Enum"},
 * 	{TypeFlagsNonPrimitive, "NonPrimitive"},
 * 	{TypeFlagsNever, "Never"},
 * 	{TypeFlagsTypeParameter, "TypeParameter"},
 * 	{TypeFlagsObject, "Object"},
 * 	{TypeFlagsIndex, "Index"},
 * 	{TypeFlagsTemplateLiteral, "TemplateLiteral"},
 * 	{TypeFlagsStringMapping, "StringMapping"},
 * 	{TypeFlagsSubstitution, "Substitution"},
 * 	{TypeFlagsIndexedAccess, "IndexedAccess"},
 * 	{TypeFlagsConditional, "Conditional"},
 * 	{TypeFlagsUnion, "Union"},
 * 	{TypeFlagsIntersection, "Intersection"},
 * }
 */
export const typeFlagNames = [
    { flag: TypeFlagsAny, name: "Any" },
    { flag: TypeFlagsUnknown, name: "Unknown" },
    { flag: TypeFlagsUndefined, name: "Undefined" },
    { flag: TypeFlagsNull, name: "Null" },
    { flag: TypeFlagsVoid, name: "Void" },
    { flag: TypeFlagsString, name: "String" },
    { flag: TypeFlagsNumber, name: "Number" },
    { flag: TypeFlagsBigInt, name: "BigInt" },
    { flag: TypeFlagsBoolean, name: "Boolean" },
    { flag: TypeFlagsESSymbol, name: "ESSymbol" },
    { flag: TypeFlagsStringLiteral, name: "StringLiteral" },
    { flag: TypeFlagsNumberLiteral, name: "NumberLiteral" },
    { flag: TypeFlagsBigIntLiteral, name: "BigIntLiteral" },
    { flag: TypeFlagsBooleanLiteral, name: "BooleanLiteral" },
    { flag: TypeFlagsUniqueESSymbol, name: "UniqueESSymbol" },
    { flag: TypeFlagsEnumLiteral, name: "EnumLiteral" },
    { flag: TypeFlagsEnum, name: "Enum" },
    { flag: TypeFlagsNonPrimitive, name: "NonPrimitive" },
    { flag: TypeFlagsNever, name: "Never" },
    { flag: TypeFlagsTypeParameter, name: "TypeParameter" },
    { flag: TypeFlagsObject, name: "Object" },
    { flag: TypeFlagsIndex, name: "Index" },
    { flag: TypeFlagsTemplateLiteral, name: "TemplateLiteral" },
    { flag: TypeFlagsStringMapping, name: "StringMapping" },
    { flag: TypeFlagsSubstitution, name: "Substitution" },
    { flag: TypeFlagsIndexedAccess, name: "IndexedAccess" },
    { flag: TypeFlagsConditional, name: "Conditional" },
    { flag: TypeFlagsUnion, name: "Union" },
    { flag: TypeFlagsIntersection, name: "Intersection" },
];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::func::FormatTypeFlags","kind":"func","status":"implemented","sigHash":"e927368847a2a91161816e5cb84351d111911678d373a466bf7d6ec7e8f3fd10","bodyHash":"ef37e91a659a9939e009b4ace805de296079a2d2c5f7c3b0e2b23676166193f7"}
 *
 * Go source:
 * func FormatTypeFlags(flags TypeFlags) []string {
 * 	result := make([]string, 0, bits.OnesCount32(uint32(flags)))
 * 	for _, fn := range typeFlagNames {
 * 		if flags&fn.flag != 0 {
 * 			result = append(result, fn.name)
 * 		}
 * 	}
 * 	if len(result) == 0 {
 * 		result = append(result, "None")
 * 	}
 * 	return result
 * }
 */
export function FormatTypeFlags(flags) {
    const result = typeFlagNames
        .filter((fn) => (flags & fn.flag) !== 0)
        .map((fn) => fn.name);
    if (result.length === 0) {
        return ["None"];
    }
    return result;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeFlags.String","kind":"method","status":"implemented","sigHash":"bbcbeb6f8b572483c758dc290ce29cfd71f395d4a907202d81930ac6022a8067","bodyHash":"7d19bbb614040e07cf804b9cd284c18c2eb4196bd1d24d64fb2b13098acb4747"}
 *
 * Go source:
 * func (f TypeFlags) String() string {
 * 	return strings.Join(FormatTypeFlags(f), "|")
 * }
 */
export function TypeFlags_String(receiver) {
    return FormatTypeFlags(receiver).join("|");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::VarianceFlags.String","kind":"method","status":"implemented","sigHash":"e53e39f56ea8e176a06f7994240619336fad8cffd42180c7b5aa28d05dd9c6b5","bodyHash":"f6154e056605de3f3d2bfd2ca5bb61e6da854bb0ce58be909eeb1c0cae74b673"}
 *
 * Go source:
 * func (v VarianceFlags) String() string {
 * 	variance := v & VarianceFlagsVarianceMask
 * 	var result string
 * 	switch variance {
 * 	case VarianceFlagsInvariant:
 * 		result = "in out"
 * 	case VarianceFlagsBivariant:
 * 		result = "[bivariant]"
 * 	case VarianceFlagsContravariant:
 * 		result = "in"
 * 	case VarianceFlagsCovariant:
 * 		result = "out"
 * 	case VarianceFlagsIndependent:
 * 		result = "[independent]"
 * 	default:
 * 		result = ""
 * 	}
 * 	if v&VarianceFlagsUnmeasurable != 0 {
 * 		result += " (unmeasurable)"
 * 	} else if v&VarianceFlagsUnreliable != 0 {
 * 		result += " (unreliable)"
 * 	}
 * 	return result
 * }
 */
export function VarianceFlags_String(receiver) {
    const variance = receiver & VarianceFlagsVarianceMask;
    const base = variance === VarianceFlagsInvariant
        ? "in out"
        : variance === VarianceFlagsBivariant
            ? "[bivariant]"
            : variance === VarianceFlagsContravariant
                ? "in"
                : variance === VarianceFlagsCovariant
                    ? "out"
                    : variance === VarianceFlagsIndependent
                        ? "[independent]"
                        : "";
    if ((receiver & VarianceFlagsUnmeasurable) !== 0) {
        return base + " (unmeasurable)";
    }
    else if ((receiver & VarianceFlagsUnreliable) !== 0) {
        return base + " (unreliable)";
    }
    return base;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ObjectFlagsNone+ObjectFlagsClass+ObjectFlagsInterface+ObjectFlagsReference+ObjectFlagsTuple+ObjectFlagsAnonymous+ObjectFlagsMapped+ObjectFlagsInstantiated+ObjectFlagsObjectLiteral+ObjectFlagsEvolvingArray+ObjectFlagsObjectLiteralPatternWithComputedProperties+ObjectFlagsReverseMapped+ObjectFlagsJsxAttributes+ObjectFlagsJSLiteral+ObjectFlagsFreshLiteral+ObjectFlagsArrayLiteral+ObjectFlagsPrimitiveUnion+ObjectFlagsContainsWideningType+ObjectFlagsContainsObjectOrArrayLiteral+ObjectFlagsNonInferrableType+ObjectFlagsCouldContainTypeVariablesComputed+ObjectFlagsCouldContainTypeVariables+ObjectFlagsMembersResolved+ObjectFlagsClassOrInterface+ObjectFlagsRequiresWidening+ObjectFlagsPropagatingFlags+ObjectFlagsInstantiatedMapped+ObjectFlagsObjectTypeKindMask+ObjectFlagsContainsSpread+ObjectFlagsObjectRestType+ObjectFlagsInstantiationExpressionType+ObjectFlagsSingleSignatureType+ObjectFlagsIsClassInstanceClone+ObjectFlagsIdenticalBaseTypeCalculated+ObjectFlagsIdenticalBaseTypeExists+ObjectFlagsUnresolvedMembers+ObjectFlagsFromTypeNode+ObjectFlagsIsGenericTypeComputed+ObjectFlagsIsGenericObjectType+ObjectFlagsIsGenericIndexType+ObjectFlagsIsGenericType+ObjectFlagsContainsIntersections+ObjectFlagsIsUnknownLikeUnionComputed+ObjectFlagsIsUnknownLikeUnion+ObjectFlagsIsNeverIntersectionComputed+ObjectFlagsIsNeverIntersection+ObjectFlagsIsConstrainedTypeVariable","kind":"constGroup","status":"implemented","sigHash":"15558a9d9329127d7ec52195464550b5ede8bdf0deb9040c5fd2a2699a0e7776","bodyHash":"6623b28b3482c1e05e5eb8dd4d8e2b9f4befbf4aff048310cbdf61d27ce5d710"}
 *
 * Go source:
 * const (
 * 	ObjectFlagsNone                                       ObjectFlags = 0
 * 	ObjectFlagsClass                                      ObjectFlags = 1 << 0  // Class
 * 	ObjectFlagsInterface                                  ObjectFlags = 1 << 1  // Interface
 * 	ObjectFlagsReference                                  ObjectFlags = 1 << 2  // Generic type reference
 * 	ObjectFlagsTuple                                      ObjectFlags = 1 << 3  // Synthesized generic tuple type
 * 	ObjectFlagsAnonymous                                  ObjectFlags = 1 << 4  // Anonymous
 * 	ObjectFlagsMapped                                     ObjectFlags = 1 << 5  // Mapped
 * 	ObjectFlagsInstantiated                               ObjectFlags = 1 << 6  // Instantiated anonymous or mapped type
 * 	ObjectFlagsObjectLiteral                              ObjectFlags = 1 << 7  // Originates in an object literal
 * 	ObjectFlagsEvolvingArray                              ObjectFlags = 1 << 8  // Evolving array type
 * 	ObjectFlagsObjectLiteralPatternWithComputedProperties ObjectFlags = 1 << 9  // Object literal pattern with computed properties
 * 	ObjectFlagsReverseMapped                              ObjectFlags = 1 << 10 // Object contains a property from a reverse-mapped type
 * 	ObjectFlagsJsxAttributes                              ObjectFlags = 1 << 11 // Jsx attributes type
 * 	ObjectFlagsJSLiteral                                  ObjectFlags = 1 << 12 // Object type declared in JS - disables errors on read/write of nonexisting members
 * 	ObjectFlagsFreshLiteral                               ObjectFlags = 1 << 13 // Fresh object literal
 * 	ObjectFlagsArrayLiteral                               ObjectFlags = 1 << 14 // Originates in an array literal
 * 	ObjectFlagsPrimitiveUnion                             ObjectFlags = 1 << 15 // Union of only primitive types
 * 	ObjectFlagsContainsWideningType                       ObjectFlags = 1 << 16 // Type is or contains undefined or null widening type
 * 	ObjectFlagsContainsObjectOrArrayLiteral               ObjectFlags = 1 << 17 // Type is or contains object literal type
 * 	ObjectFlagsNonInferrableType                          ObjectFlags = 1 << 18 // Type is or contains anyFunctionType or silentNeverType
 * 	ObjectFlagsCouldContainTypeVariablesComputed          ObjectFlags = 1 << 19 // CouldContainTypeVariables flag has been computed
 * 	ObjectFlagsCouldContainTypeVariables                  ObjectFlags = 1 << 20 // Type could contain a type variable
 * 	ObjectFlagsMembersResolved                            ObjectFlags = 1 << 21 // Members have been resolved
 *
 * 	ObjectFlagsClassOrInterface   = ObjectFlagsClass | ObjectFlagsInterface
 * 	ObjectFlagsRequiresWidening   = ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral
 * 	ObjectFlagsPropagatingFlags   = ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral | ObjectFlagsNonInferrableType
 * 	ObjectFlagsInstantiatedMapped = ObjectFlagsMapped | ObjectFlagsInstantiated
 * 	// Object flags that uniquely identify the kind of ObjectType
 * 	ObjectFlagsObjectTypeKindMask = ObjectFlagsClassOrInterface | ObjectFlagsReference | ObjectFlagsTuple | ObjectFlagsAnonymous | ObjectFlagsMapped | ObjectFlagsReverseMapped | ObjectFlagsEvolvingArray | ObjectFlagsInstantiationExpressionType | ObjectFlagsSingleSignatureType
 * 	// Flags that require TypeFlags.Object
 * 	ObjectFlagsContainsSpread              = 1 << 22 // Object literal contains spread operation
 * 	ObjectFlagsObjectRestType              = 1 << 23 // Originates in object rest declaration
 * 	ObjectFlagsInstantiationExpressionType = 1 << 24 // Originates in instantiation expression
 * 	ObjectFlagsSingleSignatureType         = 1 << 25 // A single signature type extracted from a potentially broader type
 * 	ObjectFlagsIsClassInstanceClone        = 1 << 26 // Type is a clone of a class instance type
 * 	// Flags that require TypeFlags.Object and ObjectFlags.Reference
 * 	ObjectFlagsIdenticalBaseTypeCalculated = 1 << 27 // has had `getSingleBaseForNonAugmentingSubtype` invoked on it already
 * 	ObjectFlagsIdenticalBaseTypeExists     = 1 << 28 // has a defined cachedEquivalentBaseType member
 * 	ObjectFlagsUnresolvedMembers           = 1 << 29 // Member resolution in process
 * 	ObjectFlagsFromTypeNode                = 1 << 30 // Originates in resolution of AST type node
 * 	// Flags that require TypeFlags.UnionOrIntersection or TypeFlags.Substitution
 * 	ObjectFlagsIsGenericTypeComputed = 1 << 22 // IsGenericObjectType flag has been computed
 * 	ObjectFlagsIsGenericObjectType   = 1 << 23 // Union or intersection contains generic object type
 * 	ObjectFlagsIsGenericIndexType    = 1 << 24 // Union or intersection contains generic index type
 * 	ObjectFlagsIsGenericType         = ObjectFlagsIsGenericObjectType | ObjectFlagsIsGenericIndexType
 * 	// Flags that require TypeFlags.Union
 * 	ObjectFlagsContainsIntersections      = 1 << 25 // Union contains intersections
 * 	ObjectFlagsIsUnknownLikeUnionComputed = 1 << 26 // IsUnknownLikeUnion flag has been computed
 * 	ObjectFlagsIsUnknownLikeUnion         = 1 << 27 // Union of null, undefined, and empty object type
 * 	// Flags that require TypeFlags.Intersection
 * 	ObjectFlagsIsNeverIntersectionComputed = 1 << 25 // IsNeverLike flag has been computed
 * 	ObjectFlagsIsNeverIntersection         = 1 << 26 // Intersection reduces to never
 * 	ObjectFlagsIsConstrainedTypeVariable   = 1 << 27 // T & C, where T's constraint and C are primitives, object, or {}
 * )
 */
export const ObjectFlagsNone = 0;
export const ObjectFlagsClass = 1 << 0;
export const ObjectFlagsInterface = 1 << 1;
export const ObjectFlagsReference = 1 << 2;
export const ObjectFlagsTuple = 1 << 3;
export const ObjectFlagsAnonymous = 1 << 4;
export const ObjectFlagsMapped = 1 << 5;
export const ObjectFlagsInstantiated = 1 << 6;
export const ObjectFlagsObjectLiteral = 1 << 7;
export const ObjectFlagsEvolvingArray = 1 << 8;
export const ObjectFlagsObjectLiteralPatternWithComputedProperties = 1 << 9;
export const ObjectFlagsReverseMapped = 1 << 10;
export const ObjectFlagsJsxAttributes = 1 << 11;
export const ObjectFlagsJSLiteral = 1 << 12;
export const ObjectFlagsFreshLiteral = 1 << 13;
export const ObjectFlagsArrayLiteral = 1 << 14;
export const ObjectFlagsPrimitiveUnion = 1 << 15;
export const ObjectFlagsContainsWideningType = 1 << 16;
export const ObjectFlagsContainsObjectOrArrayLiteral = 1 << 17;
export const ObjectFlagsNonInferrableType = 1 << 18;
export const ObjectFlagsCouldContainTypeVariablesComputed = 1 << 19;
export const ObjectFlagsCouldContainTypeVariables = 1 << 20;
export const ObjectFlagsMembersResolved = 1 << 21;
export const ObjectFlagsClassOrInterface = (ObjectFlagsClass | ObjectFlagsInterface) >>> 0;
export const ObjectFlagsRequiresWidening = (ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral) >>> 0;
export const ObjectFlagsPropagatingFlags = (ObjectFlagsContainsWideningType | ObjectFlagsContainsObjectOrArrayLiteral | ObjectFlagsNonInferrableType) >>> 0;
export const ObjectFlagsInstantiatedMapped = (ObjectFlagsMapped | ObjectFlagsInstantiated) >>> 0;
export const ObjectFlagsContainsSpread = 1 << 22;
export const ObjectFlagsObjectRestType = 1 << 23;
export const ObjectFlagsInstantiationExpressionType = 1 << 24;
export const ObjectFlagsSingleSignatureType = 1 << 25;
export const ObjectFlagsIsClassInstanceClone = 1 << 26;
export const ObjectFlagsObjectTypeKindMask = (ObjectFlagsClassOrInterface |
    ObjectFlagsReference |
    ObjectFlagsTuple |
    ObjectFlagsAnonymous |
    ObjectFlagsMapped |
    ObjectFlagsReverseMapped |
    ObjectFlagsEvolvingArray |
    ObjectFlagsInstantiationExpressionType |
    ObjectFlagsSingleSignatureType) >>>
    0;
export const ObjectFlagsIdenticalBaseTypeCalculated = 1 << 27;
export const ObjectFlagsIdenticalBaseTypeExists = 1 << 28;
export const ObjectFlagsUnresolvedMembers = 1 << 29;
export const ObjectFlagsFromTypeNode = 1 << 30;
export const ObjectFlagsIsGenericTypeComputed = 1 << 22;
export const ObjectFlagsIsGenericObjectType = 1 << 23;
export const ObjectFlagsIsGenericIndexType = 1 << 24;
export const ObjectFlagsIsGenericType = (ObjectFlagsIsGenericObjectType | ObjectFlagsIsGenericIndexType) >>> 0;
export const ObjectFlagsContainsIntersections = 1 << 25;
export const ObjectFlagsIsUnknownLikeUnionComputed = 1 << 26;
export const ObjectFlagsIsUnknownLikeUnion = 1 << 27;
export const ObjectFlagsIsNeverIntersectionComputed = 1 << 25;
export const ObjectFlagsIsNeverIntersection = 1 << 26;
export const ObjectFlagsIsConstrainedTypeVariable = 1 << 27;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeAlias.Symbol","kind":"method","status":"implemented","sigHash":"03f2c0317d6c373b2319092b7b3526584d13575c973317de60d5bb22acac6ff1","bodyHash":"94dac0d2bf5f1b870af1f8c25b4ced582af4e6d6a5595868c3ecd34527672fc5"}
 *
 * Go source:
 * func (a *TypeAlias) Symbol() *ast.Symbol {
 * 	if a == nil {
 * 		return nil
 * 	}
 * 	return a.symbol
 * }
 */
export function TypeAlias_Symbol(receiver) {
    if (receiver === undefined) {
        return undefined;
    }
    return receiver.symbol;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeAlias.TypeArguments","kind":"method","status":"implemented","sigHash":"d9ec20c58e98fbec383d651b650d376b181246db0cfb567dd34d2a72b1e0566b","bodyHash":"5938a33d1e200988652a121e1bdf681648d7d01f570821a3eb6e6dcc28e33afa"}
 *
 * Go source:
 * func (a *TypeAlias) TypeArguments() []*Type {
 * 	if a == nil {
 * 		return nil
 * 	}
 * 	return a.typeArguments
 * }
 */
export function TypeAlias_TypeArguments(receiver) {
    if (receiver === undefined) {
        return [];
    }
    return receiver.typeArguments;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Id","kind":"method","status":"implemented","sigHash":"518f3d45f8647a78a1e3535877ae7aa529b9ccfc1877c75c14c3a7ce82f199d8","bodyHash":"12353cfbe2f88fd5b38b4047a81dcb78d25931473e50e854281e9b8112c9396e"}
 *
 * Go source:
 * func (t *Type) Id() TypeId {
 * 	return t.id
 * }
 */
export function Type_Id(receiver) {
    return receiver.id;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Flags","kind":"method","status":"implemented","sigHash":"be75c891bf532e9ba5a61543f9d32db38e5754fa447e16fbe4b8b08c2d64abe0","bodyHash":"752888fa38b61f441e9a8f47b3dad7164aed9d6fabb0ccaf7d605db6c1b9efd6"}
 *
 * Go source:
 * func (t *Type) Flags() TypeFlags {
 * 	return t.flags
 * }
 */
export function Type_Flags(receiver) {
    return receiver.flags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.ObjectFlags","kind":"method","status":"implemented","sigHash":"60f63cfd3c80a9ca4f09ec14bda620045275abcd1379844393850dd0576eaced","bodyHash":"a12faa41ce3ba5eb1bdf657d86dfa471a0259793c79e80b6930685ac61fff2eb"}
 *
 * Go source:
 * func (t *Type) ObjectFlags() ObjectFlags {
 * 	return t.objectFlags
 * }
 */
export function Type_ObjectFlags(receiver) {
    return receiver.objectFlags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIntrinsicType","kind":"method","status":"implemented","sigHash":"bafa2bf5db9ed4509b66f16166bf7ebde5d99a0377e360adb4fd928dc616d295","bodyHash":"4864df5ef00c757973d90152aa5ddd07b5a6d4002e0e4db250b4231eaa0b0f09"}
 *
 * Go source:
 * func (t *Type) AsIntrinsicType() *IntrinsicType           { return t.data.(*IntrinsicType) }
 */
export function Type_AsIntrinsicType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsLiteralType","kind":"method","status":"implemented","sigHash":"d081823d72424d92910f6a6af433f67e554b98c8e56b5b68b51d71dfaf31d06c","bodyHash":"c04a281c2075565b94a8641a0503e40c3574f97744ea6a6f34ec623c22afb6d1"}
 *
 * Go source:
 * func (t *Type) AsLiteralType() *LiteralType               { return t.data.(*LiteralType) }
 */
export function Type_AsLiteralType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUniqueESSymbolType","kind":"method","status":"implemented","sigHash":"d0cb68b1a774ed5a474976d50336b8f211791532e2ccdc386505f7be97d3b7fc","bodyHash":"27be6ae326f8a232c1dd4a029770a34d0f853379db877faea4a97ffd9014cbfe"}
 *
 * Go source:
 * func (t *Type) AsUniqueESSymbolType() *UniqueESSymbolType { return t.data.(*UniqueESSymbolType) }
 */
export function Type_AsUniqueESSymbolType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTupleType","kind":"method","status":"implemented","sigHash":"87a6244ee7a1556ef6f22cd73b56c58d9a2d7813fce71fd8c0c9ea2f9c337f4e","bodyHash":"cac9e0bde782555d884a31fb72a5eaebaa069f75d32d77ac7709faf6ff91c9cf"}
 *
 * Go source:
 * func (t *Type) AsTupleType() *TupleType                   { return t.data.(*TupleType) }
 */
export function Type_AsTupleType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsInstantiationExpressionType","kind":"method","status":"implemented","sigHash":"388e7aba0d3d7083193298dbce1a0a160a24ebd5849ac250b10c109d8d6d236b","bodyHash":"25e8e4688edb1e0710d6b8b57479ace401ce696261c7f7e31d11660e7bc3edab"}
 *
 * Go source:
 * func (t *Type) AsInstantiationExpressionType() *InstantiationExpressionType {
 * 	return t.data.(*InstantiationExpressionType)
 * }
 */
export function Type_AsInstantiationExpressionType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsMappedType","kind":"method","status":"implemented","sigHash":"426cf1c601b4e4293f4286ecd4d75b177c928ac8a2295a12a14add33ab7e7113","bodyHash":"99ac4e9cdb8fb89a84256f34159794b8319ed915a0041e69acc7b056dfd6ff3f"}
 *
 * Go source:
 * func (t *Type) AsMappedType() *MappedType                   { return t.data.(*MappedType) }
 */
export function Type_AsMappedType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsReverseMappedType","kind":"method","status":"implemented","sigHash":"7ebfa87e3c5eae1ed51cafadf832529d59920f56fa97fba8289c851175fbcee0","bodyHash":"765b489bcf4d1f3039c563a0c09fa4688bf6a1b0648d3d7a64ee97e10fcdcb0f"}
 *
 * Go source:
 * func (t *Type) AsReverseMappedType() *ReverseMappedType     { return t.data.(*ReverseMappedType) }
 */
export function Type_AsReverseMappedType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsEvolvingArrayType","kind":"method","status":"implemented","sigHash":"06e45dd2705910c80e62ef39581c8bfabcc8b37decf2ddbbcfbf053274365fed","bodyHash":"18c2fe5d61349ed471300a5032a5ba427b44d9e87a791070bde708da7b9ea376"}
 *
 * Go source:
 * func (t *Type) AsEvolvingArrayType() *EvolvingArrayType     { return t.data.(*EvolvingArrayType) }
 */
export function Type_AsEvolvingArrayType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTypeParameter","kind":"method","status":"implemented","sigHash":"6f39183439fb1457462463d7fcbc5ab57e065eaf6a038782df50ad414d7fb8ce","bodyHash":"0ed3979981809261dc9748ef97ba593e9c17896626562c4a6ea21280a7bc0a87"}
 *
 * Go source:
 * func (t *Type) AsTypeParameter() *TypeParameter             { return t.data.(*TypeParameter) }
 */
export function Type_AsTypeParameter(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUnionType","kind":"method","status":"implemented","sigHash":"136091f1163310e107053fee430ab40ba210c1ab91a08b15416cc2ee9b284c2c","bodyHash":"eaa29c3acbf536dc64e8ae120a80863fb7bf2cdc508cbdde5d2ba6b07d713825"}
 *
 * Go source:
 * func (t *Type) AsUnionType() *UnionType                     { return t.data.(*UnionType) }
 */
export function Type_AsUnionType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIntersectionType","kind":"method","status":"implemented","sigHash":"d583537b5bf8e5811adb00f0a8b15d3c805c0571991c7172c01de64f7ada0fa4","bodyHash":"b1a955f5e9e27d878f88735ef4e147a794132fd53169b260e0b0bb90b7134349"}
 *
 * Go source:
 * func (t *Type) AsIntersectionType() *IntersectionType       { return t.data.(*IntersectionType) }
 */
export function Type_AsIntersectionType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIndexType","kind":"method","status":"implemented","sigHash":"43098053b544c1e90e7f382c6aa9839726a57da1f17a7f98f46797919859cdd5","bodyHash":"19eb76a1a3b86ee7120f809774045520453f5f2686240067af44aef612da1b93"}
 *
 * Go source:
 * func (t *Type) AsIndexType() *IndexType                     { return t.data.(*IndexType) }
 */
export function Type_AsIndexType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsIndexedAccessType","kind":"method","status":"implemented","sigHash":"e17cbd5aa71ba9571419598c20a4a4a3c1881646fd369185e34052a41237ba38","bodyHash":"aeaf82d682bb2dbebcbfff65fe3a0ba782c10277e38ae18cf0f1ec305d8b510f"}
 *
 * Go source:
 * func (t *Type) AsIndexedAccessType() *IndexedAccessType     { return t.data.(*IndexedAccessType) }
 */
export function Type_AsIndexedAccessType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTemplateLiteralType","kind":"method","status":"implemented","sigHash":"97be9b2d9fad4c21e5f0c29f9037c59f430ea1f08c643de4ccafd368c84c31e4","bodyHash":"77c7565c61b701025d36b2febe5f74d3df25f4df9b85664d33fc53ab15388d05"}
 *
 * Go source:
 * func (t *Type) AsTemplateLiteralType() *TemplateLiteralType { return t.data.(*TemplateLiteralType) }
 */
export function Type_AsTemplateLiteralType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsStringMappingType","kind":"method","status":"implemented","sigHash":"9ff7467fbc4a0c985c3bb653a83185ee638863d80a02b7fc70c1d0d3dfe1f79a","bodyHash":"a67b1c8fbba65fbd71ea9a0619fb8c76f1081507448df5f0775bf91a57adad75"}
 *
 * Go source:
 * func (t *Type) AsStringMappingType() *StringMappingType     { return t.data.(*StringMappingType) }
 */
export function Type_AsStringMappingType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsSubstitutionType","kind":"method","status":"implemented","sigHash":"c6b48a24a585afe46371390a644f6a079082a878b51195c6a97d0377c15c01ad","bodyHash":"bb3ba4a83618d45634c7fb6c9cd4d2fde4ec01adb7e31c4f74540e67ee02f13e"}
 *
 * Go source:
 * func (t *Type) AsSubstitutionType() *SubstitutionType       { return t.data.(*SubstitutionType) }
 */
export function Type_AsSubstitutionType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsConditionalType","kind":"method","status":"implemented","sigHash":"158a4febf73f669bb544732c49e04d23706f97c74197c495e2c7a34f1d9bad6c","bodyHash":"91558796a6f8d1fa8e942f6ab131f0592a20e750e440238013f6c7936aaff91f"}
 *
 * Go source:
 * func (t *Type) AsConditionalType() *ConditionalType         { return t.data.(*ConditionalType) }
 */
export function Type_AsConditionalType(receiver) {
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsConstrainedType","kind":"method","status":"implemented","sigHash":"0a1aa0583fe9a45708c0610ad0ed6b1e0b3302c4f605cca478598e81095760d4","bodyHash":"0271f36b4e00e2959438da3918f263e193a5d12fbfd96d6d3faacf3ba0493043"}
 *
 * Go source:
 * func (t *Type) AsConstrainedType() *ConstrainedType { return t.data.AsConstrainedType() }
 */
export function Type_AsConstrainedType(receiver) {
    return receiver.data.AsConstrainedType();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsStructuredType","kind":"method","status":"implemented","sigHash":"a25f906f2c7508f52455bda1fc74fd5941bd15d8d5a78fc622493471d48db5ea","bodyHash":"6934d7373d95416fd23501722f86357966ebc06b3bb69da2ce4020db747878ed"}
 *
 * Go source:
 * func (t *Type) AsStructuredType() *StructuredType   { return t.data.AsStructuredType() }
 */
export function Type_AsStructuredType(receiver) {
    return receiver.data.AsStructuredType();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsObjectType","kind":"method","status":"implemented","sigHash":"994b136944e27fdaf9ac19ddae957a2e83a40c764290a7cbf7182ed735e1d4bf","bodyHash":"4d70058161f29b833cbeda72b133d938951aff1a5e3f3803fa871ec716e4a0b1"}
 *
 * Go source:
 * func (t *Type) AsObjectType() *ObjectType           { return t.data.AsObjectType() }
 */
export function Type_AsObjectType(receiver) {
    return receiver.data.AsObjectType();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsTypeReference","kind":"method","status":"implemented","sigHash":"af35e46575166a6d2b958b70c866654d358ee253439cde1c9cf3fff7b0c73ab4","bodyHash":"5d47e32a9def8f6c152333bb8ec753d8c3c65059fb8e8bcbdc09493270076df6"}
 *
 * Go source:
 * func (t *Type) AsTypeReference() *TypeReference     { return t.data.AsTypeReference() }
 */
export function Type_AsTypeReference(receiver) {
    return receiver.data.AsTypeReference();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsInterfaceType","kind":"method","status":"implemented","sigHash":"9f9bf1e073a8bbd88eb30b2649400eb9e6e8494e5e7137fd521f918b6d7b174a","bodyHash":"65e1c92005c34769fecb840986278ee338ca30f875ab63e70a59911f191acba6"}
 *
 * Go source:
 * func (t *Type) AsInterfaceType() *InterfaceType     { return t.data.AsInterfaceType() }
 */
export function Type_AsInterfaceType(receiver) {
    return receiver.data.AsInterfaceType();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"007cb64fcc9a687151fe86cc95d364eade94d072d8fcd725026a00e5b0b14916","bodyHash":"e0b269a3ee1c06698987a16df5bf486be57204998b50390e036df9c545caa62e"}
 *
 * Go source:
 * func (t *Type) AsUnionOrIntersectionType() *UnionOrIntersectionType {
 * 	return t.data.AsUnionOrIntersectionType()
 * }
 */
export function Type_AsUnionOrIntersectionType(receiver) {
    return receiver.data.AsUnionOrIntersectionType();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Distributed","kind":"method","status":"implemented","sigHash":"0afe44ed5106ce9b540080812ada8a576d717fe3203cfa9dd8ef8391c354c4bc","bodyHash":"45be6a4f1acdbe3eebee960e0803b96f9ff800b225bee6bf9260eb2efad94a4b"}
 *
 * Go source:
 * func (t *Type) Distributed() []*Type {
 * 	switch {
 * 	case t.flags&TypeFlagsUnion != 0:
 * 		return t.AsUnionType().types
 * 	case t.flags&TypeFlagsNever != 0:
 * 		return nil
 * 	}
 * 	return []*Type{t}
 * }
 */
export function Type_Distributed(receiver) {
    if ((receiver.flags & TypeFlagsUnion) !== 0) {
        return Type_Types(receiver);
    }
    if ((receiver.flags & TypeFlagsNever) !== 0) {
        return [];
    }
    return [receiver];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Target","kind":"method","status":"implemented","sigHash":"639e2f08a40f08aa283add5f5714a8b78b447267f9fa6b48bccb98e17d0dbbf1","bodyHash":"c35f1c1304f8a62dbe21cd6f496ee2f2e97df7baaa198c4b075915296b35cecd"}
 *
 * Go source:
 * func (t *Type) Target() *Type {
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		return t.AsObjectType().target
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		return t.AsTypeParameter().target
 * 	case t.flags&TypeFlagsIndex != 0:
 * 		return t.AsIndexType().target
 * 	case t.flags&TypeFlagsStringMapping != 0:
 * 		return t.AsStringMappingType().target
 * 	case t.flags&TypeFlagsObject != 0 && t.objectFlags&ObjectFlagsMapped != 0:
 * 		return t.AsMappedType().target
 * 	}
 * 	panic("Unhandled case in Type.Target")
 * }
 */
export function Type_Target(receiver) {
    if ((receiver.flags & TypeFlagsObject) !== 0) {
        return Type_AsObjectType(receiver).target;
    }
    if ((receiver.flags & TypeFlagsTypeParameter) !== 0) {
        return Type_AsTypeParameter(receiver).target;
    }
    if ((receiver.flags & TypeFlagsIndex) !== 0) {
        return Type_AsIndexType(receiver).target;
    }
    if ((receiver.flags & TypeFlagsStringMapping) !== 0) {
        return Type_AsStringMappingType(receiver).target;
    }
    if ((receiver.flags & TypeFlagsObject) !== 0 && (receiver.objectFlags & ObjectFlagsMapped) !== 0) {
        return Type_AsMappedType(receiver).__tsgoEmbedded0.target;
    }
    throw new globalThis.Error("Unhandled case in Type.Target");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Mapper","kind":"method","status":"implemented","sigHash":"87756a05b39fe728017dabeba662b4de2a5a466abadf9d5fc453cb0ba48c72ef","bodyHash":"c47137c46e61a4ba44b7a3ac46dfc102358f4aa13fec4ba20634ff14c46df87b"}
 *
 * Go source:
 * func (t *Type) Mapper() *TypeMapper {
 * 	switch {
 * 	case t.flags&TypeFlagsObject != 0:
 * 		return t.AsObjectType().mapper
 * 	case t.flags&TypeFlagsTypeParameter != 0:
 * 		return t.AsTypeParameter().mapper
 * 	case t.flags&TypeFlagsConditional != 0:
 * 		return t.AsConditionalType().mapper
 * 	}
 * 	panic("Unhandled case in Type.Mapper")
 * }
 */
export function Type_Mapper(receiver) {
    if ((receiver.flags & TypeFlagsObject) !== 0) {
        return Type_AsObjectType(receiver).mapper;
    }
    if ((receiver.flags & TypeFlagsTypeParameter) !== 0) {
        return Type_AsTypeParameter(receiver).mapper;
    }
    if ((receiver.flags & TypeFlagsConditional) !== 0) {
        return Type_AsConditionalType(receiver).mapper;
    }
    throw new globalThis.Error("Unhandled case in Type.Mapper");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Types","kind":"method","status":"implemented","sigHash":"77acb477a1bc9608a1aacc5a0bc1f5a8896878c4cb9c01b1418fdd59ece9d62f","bodyHash":"46cd31baea11fdf046c30ef4e33d3ca049db07d7f444f1ff4051bf3e79ed9854"}
 *
 * Go source:
 * func (t *Type) Types() []*Type {
 * 	switch {
 * 	case t.flags&TypeFlagsUnionOrIntersection != 0:
 * 		return t.AsUnionOrIntersectionType().types
 * 	case t.flags&TypeFlagsTemplateLiteral != 0:
 * 		return t.AsTemplateLiteralType().types
 * 	}
 * 	panic("Unhandled case in Type.Types")
 * }
 */
export function Type_Types(receiver) {
    if ((receiver.flags & TypeFlagsUnionOrIntersection) !== 0) {
        return Type_AsUnionOrIntersectionType(receiver).types;
    }
    if ((receiver.flags & TypeFlagsTemplateLiteral) !== 0) {
        return Type_AsTemplateLiteralType(receiver).types;
    }
    throw new globalThis.Error("Unhandled case in Type.Types");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.TargetInterfaceType","kind":"method","status":"implemented","sigHash":"70291551ad346997a2cdc44373dd81a04f3aa4e22645727b5279200b1980933f","bodyHash":"7c2376bcf743a0875ca4cacbb011159b6ff1585fe2aad9d2e37b95191699f031"}
 *
 * Go source:
 * func (t *Type) TargetInterfaceType() *InterfaceType {
 * 	return t.AsTypeReference().target.AsInterfaceType()
 * }
 */
export function Type_TargetInterfaceType(receiver) {
    return Type_AsInterfaceType(Type_Target(receiver));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.TargetTupleType","kind":"method","status":"implemented","sigHash":"1fea9c5b0efe228163ee00d7c3a8c02487a87592a298a5abeea386548738e51c","bodyHash":"74c45cf6e234909df717ce8a74b4120640baf6fa5032ca36b56cf35087576b17"}
 *
 * Go source:
 * func (t *Type) TargetTupleType() *TupleType {
 * 	return t.AsTypeReference().target.AsTupleType()
 * }
 */
export function Type_TargetTupleType(receiver) {
    return Type_AsTupleType(Type_Target(receiver));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Symbol","kind":"method","status":"implemented","sigHash":"1320d383095dcf79a15f6abc6b9cc17237406a3e73d1d39ae28e4f3a22f6c39f","bodyHash":"a6f852f5cabdd113001d35c74be3ce9bfe69f49ad43ead0fb1852cc0390a5588"}
 *
 * Go source:
 * func (t *Type) Symbol() *ast.Symbol {
 * 	return t.symbol
 * }
 */
export function Type_Symbol(receiver) {
    return receiver.symbol;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.Alias","kind":"method","status":"implemented","sigHash":"36884e753a632b0bf858499b32915c0021c7109e26f63e627795171f2d404b51","bodyHash":"333fc8462b7530b2d54af000f18072c0f6cd2f0f9cbfce89209e3dd748b1ab58"}
 *
 * Go source:
 * func (t *Type) Alias() *TypeAlias {
 * 	return t.alias
 * }
 */
export function Type_Alias(receiver) {
    return receiver.alias;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsUnion","kind":"method","status":"implemented","sigHash":"e2db35f5282304268763587807ec788b48853145056a0159fb73766c0020702e","bodyHash":"33600854d4aeab6e34b494f064e36d6a1c50f2b258ae425abeef64afa8786438"}
 *
 * Go source:
 * func (t *Type) IsUnion() bool {
 * 	return t.flags&TypeFlagsUnion != 0
 * }
 */
export function Type_IsUnion(receiver) {
    return (receiver.flags & TypeFlagsUnion) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsString","kind":"method","status":"implemented","sigHash":"b67e49df65686a11fab01148042c8230e3c7cb29d8c679a0c7a6671ee0dd6d40","bodyHash":"3fa19e4b927f6a4dd73de5ac77e3486cafedfe5015e6f3ed324abfb8073b2d84"}
 *
 * Go source:
 * func (t *Type) IsString() bool {
 * 	return t.flags&TypeFlagsString != 0
 * }
 */
export function Type_IsString(receiver) {
    return (receiver.flags & TypeFlagsString) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsIntersection","kind":"method","status":"implemented","sigHash":"3a17a65fe9a2a8f69ce4937389fca08f6b9e32c26a13ed10c94ee0aba9b9fa9f","bodyHash":"af41031ba2ab10293fff506624d19181a9e8def02bfa5608db41736a4e7d99b5"}
 *
 * Go source:
 * func (t *Type) IsIntersection() bool {
 * 	return t.flags&TypeFlagsIntersection != 0
 * }
 */
export function Type_IsIntersection(receiver) {
    return (receiver.flags & TypeFlagsIntersection) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsStringLiteral","kind":"method","status":"implemented","sigHash":"1fd4a4149fa59c55eef94bc551165b9a4e7e315138e147e6d913f7b9f8e539c4","bodyHash":"1aa8ec5b9cc3177fe964569c77ba0f989553c0ee169532bb7d07da1811044d6e"}
 *
 * Go source:
 * func (t *Type) IsStringLiteral() bool {
 * 	return t.flags&TypeFlagsStringLiteral != 0
 * }
 */
export function Type_IsStringLiteral(receiver) {
    return (receiver.flags & TypeFlagsStringLiteral) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsNumberLiteral","kind":"method","status":"implemented","sigHash":"e186ec9ed6bcafdf61d78fca1c6fdbbfb97cc4dc5c0417f0637379c1c706b080","bodyHash":"c2c81d8ab657864a373be5f4664ab6c5a199c152030bd11f5049b6ec167f2255"}
 *
 * Go source:
 * func (t *Type) IsNumberLiteral() bool {
 * 	return t.flags&TypeFlagsNumberLiteral != 0
 * }
 */
export function Type_IsNumberLiteral(receiver) {
    return (receiver.flags & TypeFlagsNumberLiteral) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsBigIntLiteral","kind":"method","status":"implemented","sigHash":"7e83d64a3a2631d6270f61c753acd1033c453e69ab51f0554378bf9e1e276ecc","bodyHash":"74de7b18746d539d4c4285933b5c29e3589d705125a8d1f69caef7a1548607fc"}
 *
 * Go source:
 * func (t *Type) IsBigIntLiteral() bool {
 * 	return t.flags&TypeFlagsBigIntLiteral != 0
 * }
 */
export function Type_IsBigIntLiteral(receiver) {
    return (receiver.flags & TypeFlagsBigIntLiteral) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsEnumLiteral","kind":"method","status":"implemented","sigHash":"4e509bd2c30802ebc9d5a7273994cf93c319a363fd9aaa7914922fcb69bb66ac","bodyHash":"30ab0850245e31a0cce28793805afdd366a90983069d6f6c2f87bdd08cb8ec2b"}
 *
 * Go source:
 * func (t *Type) IsEnumLiteral() bool {
 * 	return t.flags&TypeFlagsEnumLiteral != 0
 * }
 */
export function Type_IsEnumLiteral(receiver) {
    return (receiver.flags & TypeFlagsEnumLiteral) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsBooleanLike","kind":"method","status":"implemented","sigHash":"511dbdb6881a55ad470d472fd09104e0f23884421c100390d244654c4cac8149","bodyHash":"348e0a9a63a4518673483151213f9196cd691b8baa9093ffe25d1d815e01e589"}
 *
 * Go source:
 * func (t *Type) IsBooleanLike() bool {
 * 	return t.flags&TypeFlagsBooleanLike != 0
 * }
 */
export function Type_IsBooleanLike(receiver) {
    return (receiver.flags & TypeFlagsBooleanLike) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsStringLike","kind":"method","status":"implemented","sigHash":"233292245556b527c8610babd2b5dd58387e85d0e35112b34d5285ba26a91844","bodyHash":"22f8d966fc3f5f71d410fbe35828aae77e26925c5f4a9659cccb4e56d183fa21"}
 *
 * Go source:
 * func (t *Type) IsStringLike() bool {
 * 	return t.flags&TypeFlagsStringLike != 0
 * }
 */
export function Type_IsStringLike(receiver) {
    return (receiver.flags & TypeFlagsStringLike) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsClass","kind":"method","status":"implemented","sigHash":"ba5578976a5776b516727a8ba62d533a4b29af3f0502e0529db723d401855a01","bodyHash":"393afbf44b1732893361f672cdb79e6cec50fd55c7b7ae00deb768aa6561e958"}
 *
 * Go source:
 * func (t *Type) IsClass() bool {
 * 	return t.objectFlags&ObjectFlagsClass != 0
 * }
 */
export function Type_IsClass(receiver) {
    return (receiver.objectFlags & ObjectFlagsClass) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsTypeParameter","kind":"method","status":"implemented","sigHash":"c4fb9230835fe3cea5461cb6802c42ca4f1e3fd6aa8cd8ed0542b353a27a28f5","bodyHash":"10d6f07c4e3c511f1aea9a2b781c70acba94eeff50455d62e65efefbb61df8cc"}
 *
 * Go source:
 * func (t *Type) IsTypeParameter() bool {
 * 	return t.flags&TypeFlagsTypeParameter != 0
 * }
 */
export function Type_IsTypeParameter(receiver) {
    return (receiver.flags & TypeFlagsTypeParameter) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsIndex","kind":"method","status":"implemented","sigHash":"71f0f14f3b2ace6c9eaa782eaa6c7e799c69d0cfaacd7556f170d6a0517569f4","bodyHash":"2622ebb62d3ac2a06e646be1600a95fadc9a66bab4294947277bbb763791b692"}
 *
 * Go source:
 * func (t *Type) IsIndex() bool {
 * 	return t.flags&TypeFlagsIndex != 0
 * }
 */
export function Type_IsIndex(receiver) {
    return (receiver.flags & TypeFlagsIndex) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Type.IsTupleType","kind":"method","status":"implemented","sigHash":"312167a2123a0d7b3480d35154a7bad0d1c75d9c12c2a3f830061d183652a8b4","bodyHash":"912db9aeeae571619ec18a89e9f682450644941d381590e5910e5aa6489f60ce"}
 *
 * Go source:
 * func (t *Type) IsTupleType() bool {
 * 	return isTupleType(t)
 * }
 */
export function Type_IsTupleType(receiver) {
    return isTupleType(receiver);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsType","kind":"method","status":"implemented","sigHash":"f55eba3fb643aef5b1ca790bfb78ff0a5d9f26304d6d1f033ca88077b212f4f7","bodyHash":"415886abcb19bc720e1d4cafdbeb71a2b122fac17f0ff530f65fe3ed529c5ca9"}
 *
 * Go source:
 * func (t *TypeBase) AsType() *Type                                       { return &t.Type }
 */
export function TypeBase_AsType(receiver) {
    return receiver.__tsgoEmbedded0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsConstrainedType","kind":"method","status":"implemented","sigHash":"a7900fef2295fb0d2bf1cf25443a892737fbc843a2727d4bb8e63b20453a32f1","bodyHash":"bf9e7913bdb774b1af75dd2de8c038e32aea9e547365a15110bc81f959084338"}
 *
 * Go source:
 * func (t *TypeBase) AsConstrainedType() *ConstrainedType                 { return nil }
 */
export function TypeBase_AsConstrainedType(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsStructuredType","kind":"method","status":"implemented","sigHash":"176316684357fce4ca029288a7ed31182404c73760dd4324bdeb54dd837c1d81","bodyHash":"38b20be9d2b986e935ccad9ce3a34e29a052c28acfee414b4a5a3334e6fb6e67"}
 *
 * Go source:
 * func (t *TypeBase) AsStructuredType() *StructuredType                   { return nil }
 */
export function TypeBase_AsStructuredType(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsObjectType","kind":"method","status":"implemented","sigHash":"5f699180ec63e8da21100cbf62b6a6812dfabbe23c341f6030b10a0484f0cc0d","bodyHash":"61dbc0ccb40079e46cb296f7f77a3c5fa033977134b39be73c76acec193750d5"}
 *
 * Go source:
 * func (t *TypeBase) AsObjectType() *ObjectType                           { return nil }
 */
export function TypeBase_AsObjectType(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsTypeReference","kind":"method","status":"implemented","sigHash":"e38fd0ac3d7a74464dbc601d1d54b84a0480918ba786e930c37b59e7c5a38a5a","bodyHash":"451c1cc8334dab681c55748f06d9c7eaf440586275fd70de7ac919912ccd7d03"}
 *
 * Go source:
 * func (t *TypeBase) AsTypeReference() *TypeReference                     { return nil }
 */
export function TypeBase_AsTypeReference(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsInterfaceType","kind":"method","status":"implemented","sigHash":"5eb7e0a3d477b9a374b18516fa4807807f75e4bfd46171258a8bb0c1e6ee1dfd","bodyHash":"08bfa62c62aaddb19f10f3ec4800cc75354555df600b13e031160bcbb78d4182"}
 *
 * Go source:
 * func (t *TypeBase) AsInterfaceType() *InterfaceType                     { return nil }
 */
export function TypeBase_AsInterfaceType(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeBase.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"9e97670b5afcc3a967e5f722e2cf3b9af9f4f0695656a4716d8d8e5357b9d250","bodyHash":"87fe033e2524c8dce2caa2296e9c8d53f585a02cdfa1fe8eee9d51c9c6a20102"}
 *
 * Go source:
 * func (t *TypeBase) AsUnionOrIntersectionType() *UnionOrIntersectionType { return nil }
 */
export function TypeBase_AsUnionOrIntersectionType(receiver) {
    return undefined;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IntrinsicType.IntrinsicName","kind":"method","status":"implemented","sigHash":"236e47edf74e1dc797fc5e9f641fab9b6852b84d1257a05adde3cd6e16f559cd","bodyHash":"c53ee6d2c6318860fd39284cd549553614c874f2b493d82c9b36d625cefad96d"}
 *
 * Go source:
 * func (t *IntrinsicType) IntrinsicName() string { return t.intrinsicName }
 */
export function IntrinsicType_IntrinsicName(receiver) {
    return receiver.intrinsicName;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.Value","kind":"method","status":"implemented","sigHash":"35fa47edebde1c30983475f238ceb22a545437b46afc8b0fea3ee19e0b50015f","bodyHash":"a648243d4c354794d5cf3f8ccb23e41c6c72b08a769242fc047f2fc2b1b0943a"}
 *
 * Go source:
 * func (t *LiteralType) Value() any {
 * 	return t.value
 * }
 */
export function LiteralType_Value(receiver) {
    return receiver.value;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.FreshType","kind":"method","status":"implemented","sigHash":"a6f3f73ea5f030f96e4cc3b2512ea3bfd2ff3699bbec1e3cd560f16e16808fe9","bodyHash":"98bc1c6ed1239535d35f8e7a04d2f0540fe508bf75e5f85582e6f5fb88c54245"}
 *
 * Go source:
 * func (t *LiteralType) FreshType() *Type {
 * 	return t.freshType
 * }
 */
export function LiteralType_FreshType(receiver) {
    return receiver.freshType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.RegularType","kind":"method","status":"implemented","sigHash":"712fe3c873001e9e7b72ed2e006149d05e3f78a4bcfeb641182309ee79c9c29b","bodyHash":"d8fe37f6f3e0eaca1bbbddbb82dd8e2c321b4bb96d836185452eb4b133149a1d"}
 *
 * Go source:
 * func (t *LiteralType) RegularType() *Type {
 * 	return t.regularType
 * }
 */
export function LiteralType_RegularType(receiver) {
    return receiver.regularType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::LiteralType.String","kind":"method","status":"implemented","sigHash":"d4e06d0004c75c13ce4be9e7159fdea5ff817ea6adcfcc9d413a79c1023969fe","bodyHash":"e1e817395ac5239c25e25559aad1821e36effe99fcf8857243390414e1679ae8"}
 *
 * Go source:
 * func (t *LiteralType) String() string {
 * 	return ValueToString(t.value)
 * }
 */
export function LiteralType_String(receiver) {
    return ValueToString(receiver.value);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConstrainedType.AsConstrainedType","kind":"method","status":"implemented","sigHash":"c880ecaae9699882dcd6669d38654a50ababcea5d3be40f99b1952ccdaa8c371","bodyHash":"e3ca4f6c30a46b34184d3d00cca7e905d02066873d6a70e0cf613aa21d4083e2"}
 *
 * Go source:
 * func (t *ConstrainedType) AsConstrainedType() *ConstrainedType { return t }
 */
export function ConstrainedType_AsConstrainedType(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.AsStructuredType","kind":"method","status":"implemented","sigHash":"e97ed18efc8fdb481da5d6cd26383cdeeaee9d8cc3a2bb7c84cd1339559c478f","bodyHash":"ea1ae0005777e116ac073ab783e1281dd0ad6db488f4084809bfa69fd3965a7f"}
 *
 * Go source:
 * func (t *StructuredType) AsStructuredType() *StructuredType { return t }
 */
export function StructuredType_AsStructuredType(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.CallSignatures","kind":"method","status":"implemented","sigHash":"9ee91e522a9cdc1dd4e12e51caf3dcaa20617b8ad869dc68d329a645e504e510","bodyHash":"dec07d038e31011d835941b91acce08e00bd16ccd6651b9f9905586cca4e02a5"}
 *
 * Go source:
 * func (t *StructuredType) CallSignatures() []*Signature {
 * 	return slices.Clip(t.signatures[:t.callSignatureCount])
 * }
 */
export function StructuredType_CallSignatures(receiver) {
    return (receiver.signatures ?? []).slice(0, receiver.callSignatureCount ?? 0);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.ConstructSignatures","kind":"method","status":"implemented","sigHash":"e3bd4814ac0551e38894fd3534b20e4cef3786360c4409d1ec414df65a702a1d","bodyHash":"d5864224e7e209055b61047cb5d4b142d081b967d73d755760c440403e769a0a"}
 *
 * Go source:
 * func (t *StructuredType) ConstructSignatures() []*Signature {
 * 	return slices.Clip(t.signatures[t.callSignatureCount:])
 * }
 */
export function StructuredType_ConstructSignatures(receiver) {
    return (receiver.signatures ?? []).slice(receiver.callSignatureCount ?? 0);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StructuredType.Properties","kind":"method","status":"implemented","sigHash":"9f309724b998ab56beaec07f3ba1bcb7de3db8821e3f18616524be80398db100","bodyHash":"8f49322a439369dbdf71f192e07995bd1f5cc6f399f01e4ef25794db4422f3c1"}
 *
 * Go source:
 * func (t *StructuredType) Properties() []*ast.Symbol {
 * 	return t.properties
 * }
 */
export function StructuredType_Properties(receiver) {
    return receiver.properties;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ObjectType.AsObjectType","kind":"method","status":"implemented","sigHash":"ce03b37145521609901c50507789fe7b1d7580fc7835781cb57108a8363f5f5f","bodyHash":"7b91e13ccddb2994120deb09b2de1a24e293f94f323030900c90e846c08b7502"}
 *
 * Go source:
 * func (t *ObjectType) AsObjectType() *ObjectType { return t }
 */
export function ObjectType_AsObjectType(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeReference.AsTypeReference","kind":"method","status":"implemented","sigHash":"c353fde55c4299c3d55529f4a20f9c83d527b2672d9eff43cf444f55e3b0a326","bodyHash":"6ccb9abbbaa9d3cf1b7947256c58129b8ea14014014a31fe4bf9831d4ac685aa"}
 *
 * Go source:
 * func (t *TypeReference) AsTypeReference() *TypeReference { return t }
 */
export function TypeReference_AsTypeReference(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.AsInterfaceType","kind":"method","status":"implemented","sigHash":"57cf879b8eeb9b318674bae6a5d86135b14cd272b619557100294ae987619811","bodyHash":"64a005fa36aae4a5d0bbbc8f9ab0d9ddfc6fe7fe94c2d8c479c7059b53e03c5e"}
 *
 * Go source:
 * func (t *InterfaceType) AsInterfaceType() *InterfaceType { return t }
 */
export function InterfaceType_AsInterfaceType(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.OuterTypeParameters","kind":"method","status":"implemented","sigHash":"cbb4a1786e726d57c2e34410a1e95e8bb63945125d7162e8d7eaa9208d9240ed","bodyHash":"8e0c743677bce738493f73cb5df94a87313c09c01c33289cb0b65881f8ab0321"}
 *
 * Go source:
 * func (t *InterfaceType) OuterTypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[:t.outerTypeParameterCount])
 * }
 */
export function InterfaceType_OuterTypeParameters(receiver) {
    if (receiver.allTypeParameters.length === 0) {
        return [];
    }
    return receiver.allTypeParameters.slice(0, receiver.outerTypeParameterCount);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.LocalTypeParameters","kind":"method","status":"implemented","sigHash":"156f045ad185e87091082c4afeb8e81f83124b39a49a8b9eadb9650cd0448ac0","bodyHash":"9d5e176cbaa9a1239ecc78f99811165f5d0cc53db01e5c4d97059807ed9bc869"}
 *
 * Go source:
 * func (t *InterfaceType) LocalTypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[t.outerTypeParameterCount : len(t.allTypeParameters)-1])
 * }
 */
export function InterfaceType_LocalTypeParameters(receiver) {
    if (receiver.allTypeParameters.length === 0) {
        return [];
    }
    return receiver.allTypeParameters.slice(receiver.outerTypeParameterCount, receiver.allTypeParameters.length - 1);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::InterfaceType.TypeParameters","kind":"method","status":"implemented","sigHash":"59aab3955045e9e6f84eb4162f605651d04496626dad902d536164878f5fe7a8","bodyHash":"474067d7b54d306cbf09cd3b4953a7dfc6d430806e373ac7ea2d1e00d9b0f432"}
 *
 * Go source:
 * func (t *InterfaceType) TypeParameters() []*Type {
 * 	if len(t.allTypeParameters) == 0 {
 * 		return nil
 * 	}
 * 	return slices.Clip(t.allTypeParameters[:len(t.allTypeParameters)-1])
 * }
 */
export function InterfaceType_TypeParameters(receiver) {
    if (receiver.allTypeParameters.length === 0) {
        return [];
    }
    return receiver.allTypeParameters.slice(0, receiver.allTypeParameters.length - 1);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::ElementFlagsNone+ElementFlagsRequired+ElementFlagsOptional+ElementFlagsRest+ElementFlagsVariadic+ElementFlagsFixed+ElementFlagsVariable+ElementFlagsNonRequired+ElementFlagsNonRest","kind":"constGroup","status":"implemented","sigHash":"0f5ddf04737bcaef8d95b4882ef0388a9b79e768877cd1639c1652d35f870793","bodyHash":"30c2a79fea33d8117d1001e15f6ecff5dc1eeb8e096f8318828d53830f01c6b6"}
 *
 * Go source:
 * const (
 * 	ElementFlagsNone        ElementFlags = 0
 * 	ElementFlagsRequired    ElementFlags = 1 << 0 // T
 * 	ElementFlagsOptional    ElementFlags = 1 << 1 // T?
 * 	ElementFlagsRest        ElementFlags = 1 << 2 // ...T[]
 * 	ElementFlagsVariadic    ElementFlags = 1 << 3 // ...T
 * 	ElementFlagsFixed                    = ElementFlagsRequired | ElementFlagsOptional
 * 	ElementFlagsVariable                 = ElementFlagsRest | ElementFlagsVariadic
 * 	ElementFlagsNonRequired              = ElementFlagsOptional | ElementFlagsRest | ElementFlagsVariadic
 * 	ElementFlagsNonRest                  = ElementFlagsRequired | ElementFlagsOptional | ElementFlagsVariadic
 * )
 */
export const ElementFlagsNone = 0;
export const ElementFlagsRequired = 1 << 0;
export const ElementFlagsOptional = 1 << 1;
export const ElementFlagsRest = 1 << 2;
export const ElementFlagsVariadic = 1 << 3;
export const ElementFlagsFixed = (ElementFlagsRequired | ElementFlagsOptional) >>> 0;
export const ElementFlagsVariable = (ElementFlagsRest | ElementFlagsVariadic) >>> 0;
export const ElementFlagsNonRequired = (ElementFlagsOptional | ElementFlagsRest | ElementFlagsVariadic) >>> 0;
export const ElementFlagsNonRest = (ElementFlagsRequired | ElementFlagsOptional | ElementFlagsVariadic) >>> 0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleElementInfo.TupleElementFlags","kind":"method","status":"implemented","sigHash":"355ad4488ed1b95c13b99386b6cacf18b08a428879611b1be24b7db39bb3ffab","bodyHash":"0fc88f762f268081bd8fcaaaf2541509d49428a912f1442fd7a1c0efb9a010fb"}
 *
 * Go source:
 * func (t *TupleElementInfo) TupleElementFlags() ElementFlags { return t.flags }
 */
export function TupleElementInfo_TupleElementFlags(receiver) {
    return receiver.flags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleElementInfo.LabeledDeclaration","kind":"method","status":"implemented","sigHash":"8b520c8ee4de8405dad3464a7200e4b61e590053568094a5c60dfb8822a3dfad","bodyHash":"8e504f76b4638593573e9316b3efe5436510f420d8606fd4921ffc98f349728c"}
 *
 * Go source:
 * func (t *TupleElementInfo) LabeledDeclaration() *ast.Node   { return t.labeledDeclaration }
 */
export function TupleElementInfo_LabeledDeclaration(receiver) {
    return receiver.labeledDeclaration;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.FixedLength","kind":"method","status":"implemented","sigHash":"1c1313f89a7632f9a1b53be6130b0723f4a977adce3a7830cd00f1fa45fac869","bodyHash":"87d3a9a16dbeefd79abd3e5f484e8f07d81033fa9a83924b29074168c44dfe3f"}
 *
 * Go source:
 * func (t *TupleType) FixedLength() int { return t.fixedLength }
 */
export function TupleType_FixedLength(receiver) {
    return receiver.fixedLength;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.IsReadonly","kind":"method","status":"implemented","sigHash":"466790d78eb0ce996d251e855729e1e7013b01b1cb76b47d9d10efe9fb173499","bodyHash":"e2eafef36c370754e051c0cbe9c3fbd00dcffbddb95b07de328f8e31157b5428"}
 *
 * Go source:
 * func (t *TupleType) IsReadonly() bool { return t.readonly }
 */
export function TupleType_IsReadonly(receiver) {
    return receiver.readonly;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.ElementFlags","kind":"method","status":"implemented","sigHash":"c7173d24b254b34116e09387864937ea26237272735e8cc9e4de2c723a13d7b1","bodyHash":"f18b6f19f39208cbc7cb109e09cbd091b218353f6fc93445996f71ad5efc8ece"}
 *
 * Go source:
 * func (t *TupleType) ElementFlags() []ElementFlags {
 * 	elementFlags := make([]ElementFlags, len(t.elementInfos))
 * 	for i, info := range t.elementInfos {
 * 		elementFlags[i] = info.flags
 * 	}
 * 	return elementFlags
 * }
 */
export function TupleType_ElementFlags(receiver) {
    return receiver.elementInfos.map((info) => info.flags);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TupleType.ElementInfos","kind":"method","status":"implemented","sigHash":"5783e5665a3a66e09dea7662982b1f11c5d2200cc01a75470953d47e41765dd5","bodyHash":"db835ee4620bd64ca1be63e1c9be5ce26f83d507bd379556178edade26cd7a9a"}
 *
 * Go source:
 * func (t *TupleType) ElementInfos() []TupleElementInfo { return t.elementInfos }
 */
export function TupleType_ElementInfos(receiver) {
    return receiver.elementInfos;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::UnionOrIntersectionType.AsUnionOrIntersectionType","kind":"method","status":"implemented","sigHash":"a463b976a7b49efcf96dba1ada20581738ec8afdb843ad312d335b2a18c87cfa","bodyHash":"916414d2e00721ba670593bde5c0c4358f884213766a1b62f7bbe30380a32cdd"}
 *
 * Go source:
 * func (t *UnionOrIntersectionType) AsUnionOrIntersectionType() *UnionOrIntersectionType { return t }
 */
export function UnionOrIntersectionType_AsUnionOrIntersectionType(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::UnionOrIntersectionType.Types","kind":"method","status":"implemented","sigHash":"65393c27769c1456436f678a289d5055fa63c5e286e80e18209329c621008896","bodyHash":"825bb48f24e4646286187b610762eeb1b961f6b63df3844e304a8b1503df05e9"}
 *
 * Go source:
 * func (t *UnionOrIntersectionType) Types() []*Type {
 * 	return t.types
 * }
 */
export function UnionOrIntersectionType_Types(receiver) {
    return receiver.types;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypeParameter.IsThisType","kind":"method","status":"implemented","sigHash":"00696bd2c3f26af607bd49395a5a451cb3c0a9e52abafbcce9a27d0073d8ec38","bodyHash":"7027cb00d9e8557e9a8d74c794430e88bcc8a795b994b5338a845c4d13e59aae"}
 *
 * Go source:
 * func (t *TypeParameter) IsThisType() bool { return t.isThisType }
 */
export function TypeParameter_IsThisType(receiver) {
    return receiver.isThisType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::IndexFlagsNone+IndexFlagsStringsOnly+IndexFlagsNoIndexSignatures+IndexFlagsNoReducibleCheck","kind":"constGroup","status":"implemented","sigHash":"848a3389b1917b42dc0a810f471216e938348fca2d76c2eb23a41239ec1a1b72","bodyHash":"fca0a0027b8b3d06ba8999b5833c97e10ddff90a38ba1c0a16919c06b9654c8f"}
 *
 * Go source:
 * const (
 * 	IndexFlagsNone              IndexFlags = 0
 * 	IndexFlagsStringsOnly       IndexFlags = 1 << 0
 * 	IndexFlagsNoIndexSignatures IndexFlags = 1 << 1
 * 	IndexFlagsNoReducibleCheck  IndexFlags = 1 << 2
 * )
 */
export const IndexFlagsNone = 0;
export const IndexFlagsStringsOnly = 1 << 0;
export const IndexFlagsNoIndexSignatures = 1 << 1;
export const IndexFlagsNoReducibleCheck = 1 << 2;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexType.Target","kind":"method","status":"implemented","sigHash":"a75ca0dadaddd6a747f48644d50224ea9ab02b125743d9a03e3b9271ed892988","bodyHash":"408e70a61b99d8f4c4bbeb7bddeec9325edf21a33ce582b7849a740d91b1a5c0"}
 *
 * Go source:
 * func (t *IndexType) Target() *Type { return t.target }
 */
export function IndexType_Target(receiver) {
    return receiver.target;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexedAccessType.ObjectType","kind":"method","status":"implemented","sigHash":"1bdaed5612d3752bd50286d11ce692fb5a41aa51f1d58c5d1aaeeddb46c41676","bodyHash":"20a1e92acc2798d61a1bc55ece2e07a1f1a568d744b1db8a74eb41ffc6f8e634"}
 *
 * Go source:
 * func (t *IndexedAccessType) ObjectType() *Type { return t.objectType }
 */
export function IndexedAccessType_ObjectType(receiver) {
    return receiver.objectType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexedAccessType.IndexType","kind":"method","status":"implemented","sigHash":"85b57c26fdc41372fd2fdf634275cf0a8ffbfd3ae583c22bc1f7b908e1ddd1d9","bodyHash":"ead29838b5a98e267312a1c948b231972b684ce11a021d3b80faa790013a3c6d"}
 *
 * Go source:
 * func (t *IndexedAccessType) IndexType() *Type  { return t.indexType }
 */
export function IndexedAccessType_IndexType(receiver) {
    return receiver.indexType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TemplateLiteralType.Texts","kind":"method","status":"implemented","sigHash":"3c3d535d1b0b673e77c07b2bf18d3cccb15605f0d6b4082a9867316270025f6d","bodyHash":"ec45fa890960c4d86be310aebe34ea48b060915fdbcb3e433bfd288cf7a02894"}
 *
 * Go source:
 * func (t *TemplateLiteralType) Texts() []string { return t.texts }
 */
export function TemplateLiteralType_Texts(receiver) {
    return receiver.texts;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TemplateLiteralType.Types","kind":"method","status":"implemented","sigHash":"1ef235d267d5be4c214e3d0d2d2c70ea94eabb57ab844b3e68e50c31e93db792","bodyHash":"3b3d6e85b5098969c486c9e9bbf327879648537c9ae7b6ae24f4836b1c49b49b"}
 *
 * Go source:
 * func (t *TemplateLiteralType) Types() []*Type  { return t.types }
 */
export function TemplateLiteralType_Types(receiver) {
    return receiver.types;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::StringMappingType.Target","kind":"method","status":"implemented","sigHash":"1e4e315b6a72393451dc16c165e08d6fc6488c292fb520d9b54a3e1c37450ecf","bodyHash":"aa3ac37bc406e222851cffa8637df0df2bf8f87e1edb665e3073055b2e97b1ed"}
 *
 * Go source:
 * func (t *StringMappingType) Target() *Type { return t.target }
 */
export function StringMappingType_Target(receiver) {
    return receiver.target;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::SubstitutionType.BaseType","kind":"method","status":"implemented","sigHash":"d2ca47575a89587599e65fdeacc4f18d761fc009f209e197518717c467d50404","bodyHash":"896002876e9a1db796261a4ad46754216153e998f37fb2c5f8ad430d97ad0f55"}
 *
 * Go source:
 * func (t *SubstitutionType) BaseType() *Type        { return t.baseType }
 */
export function SubstitutionType_BaseType(receiver) {
    return receiver.baseType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::SubstitutionType.SubstConstraint","kind":"method","status":"implemented","sigHash":"ad3d534806d0d386fafb415e4ef6e41568afd74640b94ac927e304c45a66b5f6","bodyHash":"21df533375e8a7391758047cb8cf0650805b43cb8b8f022d6094c42ecc2f70ce"}
 *
 * Go source:
 * func (t *SubstitutionType) SubstConstraint() *Type { return t.constraint }
 */
export function SubstitutionType_SubstConstraint(receiver) {
    return receiver.constraint;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConditionalType.CheckType","kind":"method","status":"implemented","sigHash":"f0748bda237c5a2383234d632d7108747c2ee67eae4b79c0349c76dd1d3adbca","bodyHash":"404e5dd922ea1ed1e82aa8eec1a5ed0384feaf6be200f63919b3193e49c443bb"}
 *
 * Go source:
 * func (t *ConditionalType) CheckType() *Type   { return t.checkType }
 */
export function ConditionalType_CheckType(receiver) {
    return receiver.checkType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::ConditionalType.ExtendsType","kind":"method","status":"implemented","sigHash":"65bf8712cd27803e1e6072aed95b2442f81659ff4d369adbb90024be3353a3f0","bodyHash":"c6d78539cec634374669f96301f6cb90f70206e0afca6b2c238a05db40447c34"}
 *
 * Go source:
 * func (t *ConditionalType) ExtendsType() *Type { return t.extendsType }
 */
export function ConditionalType_ExtendsType(receiver) {
    return receiver.extendsType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::SignatureFlagsNone+SignatureFlagsHasRestParameter+SignatureFlagsHasLiteralTypes+SignatureFlagsConstruct+SignatureFlagsAbstract+SignatureFlagsIsInnerCallChain+SignatureFlagsIsOuterCallChain+SignatureFlagsIsUntypedSignatureInJSFile+SignatureFlagsIsNonInferrable+SignatureFlagsIsSignatureCandidateForOverloadFailure+SignatureFlagsPropagatingFlags+SignatureFlagsCallChainFlags","kind":"constGroup","status":"implemented","sigHash":"114ed2f5c585c6b4e007dccfe55b1b491d244771e1047ff20f20948b5c5c8cf4","bodyHash":"2d0a9c1f8bcf55ac9e8162181f6c6a90fa642caf8bd5b7bea22e4d407d6adc6a"}
 *
 * Go source:
 * const (
 * 	SignatureFlagsNone SignatureFlags = 0
 * 	// Propagating flags
 * 	SignatureFlagsHasRestParameter SignatureFlags = 1 << 0 // Indicates last parameter is rest parameter
 * 	SignatureFlagsHasLiteralTypes  SignatureFlags = 1 << 1 // Indicates signature is specialized
 * 	SignatureFlagsConstruct        SignatureFlags = 1 << 2 // Indicates signature is a construct signature
 * 	SignatureFlagsAbstract         SignatureFlags = 1 << 3 // Indicates signature comes from an abstract class, abstract construct signature, or abstract constructor type
 * 	// Non-propagating flags
 * 	SignatureFlagsIsInnerCallChain                       SignatureFlags = 1 << 4 // Indicates signature comes from a CallChain nested in an outer OptionalChain
 * 	SignatureFlagsIsOuterCallChain                       SignatureFlags = 1 << 5 // Indicates signature comes from a CallChain that is the outermost chain of an optional expression
 * 	SignatureFlagsIsUntypedSignatureInJSFile             SignatureFlags = 1 << 6 // Indicates signature is from a js file and has no types
 * 	SignatureFlagsIsNonInferrable                        SignatureFlags = 1 << 7 // Indicates signature comes from a non-inferrable type
 * 	SignatureFlagsIsSignatureCandidateForOverloadFailure SignatureFlags = 1 << 8
 * 	// We do not propagate `IsInnerCallChain` or `IsOuterCallChain` to instantiated signatures, as that would result in us
 * 	// attempting to add `| undefined` on each recursive call to `getReturnTypeOfSignature` when
 * 	// instantiating the return type.
 * 	SignatureFlagsPropagatingFlags = SignatureFlagsHasRestParameter | SignatureFlagsHasLiteralTypes | SignatureFlagsConstruct | SignatureFlagsAbstract | SignatureFlagsIsUntypedSignatureInJSFile | SignatureFlagsIsSignatureCandidateForOverloadFailure
 * 	SignatureFlagsCallChainFlags   = SignatureFlagsIsInnerCallChain | SignatureFlagsIsOuterCallChain
 * )
 */
export const SignatureFlagsNone = 0;
export const SignatureFlagsHasRestParameter = 1 << 0;
export const SignatureFlagsHasLiteralTypes = 1 << 1;
export const SignatureFlagsConstruct = 1 << 2;
export const SignatureFlagsAbstract = 1 << 3;
export const SignatureFlagsIsInnerCallChain = 1 << 4;
export const SignatureFlagsIsOuterCallChain = 1 << 5;
export const SignatureFlagsIsUntypedSignatureInJSFile = 1 << 6;
export const SignatureFlagsIsNonInferrable = 1 << 7;
export const SignatureFlagsIsSignatureCandidateForOverloadFailure = 1 << 8;
export const SignatureFlagsPropagatingFlags = (SignatureFlagsHasRestParameter |
    SignatureFlagsHasLiteralTypes |
    SignatureFlagsConstruct |
    SignatureFlagsAbstract |
    SignatureFlagsIsUntypedSignatureInJSFile |
    SignatureFlagsIsSignatureCandidateForOverloadFailure) >>>
    0;
export const SignatureFlagsCallChainFlags = (SignatureFlagsIsInnerCallChain | SignatureFlagsIsOuterCallChain) >>> 0;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Flags","kind":"method","status":"implemented","sigHash":"6f3ff5daa3a542647d0c2ded0db89c216b6a2d48bc2d631e498fdd1b70e2d4fd","bodyHash":"e845b833c8dc4abfed5abb5dc27c976f8bbd1d9bfa2220be11a85df075509904"}
 *
 * Go source:
 * func (s *Signature) Flags() SignatureFlags {
 * 	return s.flags
 * }
 */
export function Signature_Flags(receiver) {
    return receiver.flags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.TypeParameters","kind":"method","status":"implemented","sigHash":"cb28b2a07ded8b054d77d8909b0d924049bf8a9e405030d9a095d389d8d5ff0a","bodyHash":"92d8243140df2a5c9f8fe34dccd787e666d1dbfb5887a3aa28878dcd634e8db1"}
 *
 * Go source:
 * func (s *Signature) TypeParameters() []*Type {
 * 	return s.typeParameters
 * }
 */
export function Signature_TypeParameters(receiver) {
    return receiver.typeParameters;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Declaration","kind":"method","status":"implemented","sigHash":"c5146de59f2e792a4981b08eb7e65e3851dfdf24f9cd25cb7264c7635e223195","bodyHash":"6a6e66cf8abd4c58592f7064dc3f541e0ce57f0ea9e76aa4614354cc63f25c37"}
 *
 * Go source:
 * func (s *Signature) Declaration() *ast.Node {
 * 	return s.declaration
 * }
 */
export function Signature_Declaration(receiver) {
    return receiver.declaration;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Target","kind":"method","status":"implemented","sigHash":"b370dc5ac0441bf818a7160561b39ac2ba42d797ec2b6355ad475824111fabe6","bodyHash":"b6e83e25e611ff8643eb5e6017dbdece6e5a3246596750314d2f9b13af806ca1"}
 *
 * Go source:
 * func (s *Signature) Target() *Signature {
 * 	return s.target
 * }
 */
export function Signature_Target(receiver) {
    return receiver.target;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.ThisParameter","kind":"method","status":"implemented","sigHash":"afad830f98f1efc13163ec150d3594e4af384dfb2efbdb42257404ce8955733e","bodyHash":"55228e4d838da02bd943bf4646774339f6cd0644e5cdd8db4a79c1e7e25215c9"}
 *
 * Go source:
 * func (s *Signature) ThisParameter() *ast.Symbol {
 * 	return s.thisParameter
 * }
 */
export function Signature_ThisParameter(receiver) {
    return receiver.thisParameter;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.Parameters","kind":"method","status":"implemented","sigHash":"7f1ce56756365cc8cfafec0eebe56a2c9532da54d5b05632ac809ba3b2ea88b6","bodyHash":"336ca51be9de676155b13a44ff51c5841c4f21262849fd6f7c72c1b4a43d7ad2"}
 *
 * Go source:
 * func (s *Signature) Parameters() []*ast.Symbol {
 * 	return s.parameters
 * }
 */
export function Signature_Parameters(receiver) {
    return receiver.parameters;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.HasRestParameter","kind":"method","status":"implemented","sigHash":"0fe9edd757a45abbd20f9f78f63c275d1e84f311370c66f7beaa97574f7ab490","bodyHash":"350cd0ab4fc825a18939ef6b45fd65681d076a58262601eaac19308887aa0d83"}
 *
 * Go source:
 * func (s *Signature) HasRestParameter() bool {
 * 	return s.flags&SignatureFlagsHasRestParameter != 0
 * }
 */
export function Signature_HasRestParameter(receiver) {
    return (receiver.flags & SignatureFlagsHasRestParameter) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::Signature.MinArgumentCount","kind":"method","status":"implemented","sigHash":"dffe370ab537f2b777e3d81c05a65da9b432a8008374e6214d0d073692c54fed","bodyHash":"385180c80b78422d965aa16d5ac6bcd1871e72c2fafada7a738821c89546ac79"}
 *
 * Go source:
 * func (s *Signature) MinArgumentCount() int {
 * 	return int(s.minArgumentCount)
 * }
 */
export function Signature_MinArgumentCount(receiver) {
    return receiver.minArgumentCount;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TypePredicateKindThis+TypePredicateKindIdentifier+TypePredicateKindAssertsThis+TypePredicateKindAssertsIdentifier","kind":"constGroup","status":"implemented","sigHash":"4e16e530b5a4798b60c6dc07a2c3214aa25e59ff1dd16b3fe12976631062f424","bodyHash":"c4adb48a6eb2ddebc6a31cc899a5b7d35aa756fa3b169b6de21e6d25f69d77b3"}
 *
 * Go source:
 * const (
 * 	TypePredicateKindThis TypePredicateKind = iota
 * 	TypePredicateKindIdentifier
 * 	TypePredicateKindAssertsThis
 * 	TypePredicateKindAssertsIdentifier
 * )
 */
export const TypePredicateKindThis = 0;
export const TypePredicateKindIdentifier = 1;
export const TypePredicateKindAssertsThis = 2;
export const TypePredicateKindAssertsIdentifier = 3;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.Type","kind":"method","status":"implemented","sigHash":"aa6e3544a89469d96f16a0685594c278b3178a7e399bfd7bfb47c6fa706a3d6b","bodyHash":"1a429825ed99341d42943b764b2c7a3c5eef29bf4e6ef1b61a039b5697c2fcbf"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) Type() *Type {
 * 	return typePredicate.t
 * }
 */
export function TypePredicate_Type(receiver) {
    return receiver.t;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.Kind","kind":"method","status":"implemented","sigHash":"60a6572a6849a8345a741c8c59b8e2eabaf79782170cbd6a4b39f3c008d6019b","bodyHash":"c72b95b8ea204723883b9574bb2e483b44371237feb9045d29579cca50dc8c35"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) Kind() TypePredicateKind {
 * 	return typePredicate.kind
 * }
 */
export function TypePredicate_Kind(receiver) {
    return receiver.kind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.ParameterIndex","kind":"method","status":"implemented","sigHash":"bf7c9cf4270059f67323ae25a3a176c3bf4986e59e5d1ea9d046d3fbe2532a6d","bodyHash":"0cfc4b1f2576902cc3bd37f92702e13c792053e4c65f392b93d378ddab5e7691"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) ParameterIndex() int32 {
 * 	return typePredicate.parameterIndex
 * }
 */
export function TypePredicate_ParameterIndex(receiver) {
    return receiver.parameterIndex;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::TypePredicate.ParameterName","kind":"method","status":"implemented","sigHash":"a8828236687dfe6c24ac2b087288285f7cb17c77c55d2511fd19da808b9ffef8","bodyHash":"0e11b77b1cb368853ed0afb1adea4bdd63a2503d3c9ed2e9c52a43e0e0cbef43"}
 *
 * Go source:
 * func (typePredicate *TypePredicate) ParameterName() string {
 * 	return typePredicate.parameterName
 * }
 */
export function TypePredicate_ParameterName(receiver) {
    return receiver.parameterName;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.KeyType","kind":"method","status":"implemented","sigHash":"0caaccea0ed6ee3955aec6eb623f7cafe1a277165c5708fbc1cdaeff91c033e2","bodyHash":"bdcca6409c941758aa7e426f9159f749a9568f3349df1e330c19d648a10266cb"}
 *
 * Go source:
 * func (info *IndexInfo) KeyType() *Type {
 * 	return info.keyType
 * }
 */
export function IndexInfo_KeyType(receiver) {
    return receiver.keyType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.ValueType","kind":"method","status":"implemented","sigHash":"a29528c3cb956531d90088f47d6dfdd22edac860015e0fb2d2a934052f14fa95","bodyHash":"d8094544bf0cf8ae5dbbd71bb1a80edb45d1a42c7aa875c4194b0b641a4d9be2"}
 *
 * Go source:
 * func (info *IndexInfo) ValueType() *Type {
 * 	return info.valueType
 * }
 */
export function IndexInfo_ValueType(receiver) {
    return receiver.valueType;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.IsReadonly","kind":"method","status":"implemented","sigHash":"950f96e1d03c2560eb088fc9f887ec106be221682203b7ba9b1ab13f948275aa","bodyHash":"3a690ab7bf086b4cc8fc74d23d6cb256621f71bb97b5b1842e42f5e1c3af5eed"}
 *
 * Go source:
 * func (info *IndexInfo) IsReadonly() bool {
 * 	return info.isReadonly
 * }
 */
export function IndexInfo_IsReadonly(receiver) {
    return receiver.isReadonly;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::method::IndexInfo.Declaration","kind":"method","status":"implemented","sigHash":"d0414a85ecaaac1f8ef44c887c47b7e4d268c9ed249c53543c0dc1def7e966b1","bodyHash":"d751dc42a5487d2a6eaca73ae1d5ca4e0b42a13224e8da72b5cd3c13ba9570df"}
 *
 * Go source:
 * func (info *IndexInfo) Declaration() *ast.Node {
 * 	return info.declaration
 * }
 */
export function IndexInfo_Declaration(receiver) {
    return receiver.declaration;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::constGroup::TernaryFalse+TernaryUnknown+TernaryMaybe+TernaryTrue","kind":"constGroup","status":"implemented","sigHash":"766cd03a278156f040259af49ea9051351d1431e322285e2e843a1c7974ec4b7","bodyHash":"64970808fe183fa1b45478120c7c5817665ef1eb154438b0a30def096a8345f4"}
 *
 * Go source:
 * const (
 * 	TernaryFalse   Ternary = 0
 * 	TernaryUnknown Ternary = 1
 * 	TernaryMaybe   Ternary = 3
 * 	TernaryTrue    Ternary = -1
 * )
 */
export const TernaryFalse = 0;
export const TernaryUnknown = 1;
export const TernaryMaybe = 3;
export const TernaryTrue = -1;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/types.go::varGroup::LanguageFeatureMinimumTarget","kind":"varGroup","status":"implemented","sigHash":"b7fac77e692c413c3ae50b64bcefead96068fbec1d23b66d7b93164c3233c894","bodyHash":"6693821ceb30eca5cdc004e6743a1b93cf38f18edcf80c154dc913a854450af5"}
 *
 * Go source:
 * var LanguageFeatureMinimumTarget = LanguageFeatureMinimumTargetMap{
 * 	Exponentiation:                    core.ScriptTargetES2016,
 * 	AsyncFunctions:                    core.ScriptTargetES2017,
 * 	ForAwaitOf:                        core.ScriptTargetES2018,
 * 	AsyncGenerators:                   core.ScriptTargetES2018,
 * 	AsyncIteration:                    core.ScriptTargetES2018,
 * 	ObjectSpreadRest:                  core.ScriptTargetES2018,
 * 	RegularExpressionFlagsDotAll:      core.ScriptTargetES2018,
 * 	BindinglessCatch:                  core.ScriptTargetES2019,
 * 	BigInt:                            core.ScriptTargetES2020,
 * 	NullishCoalesce:                   core.ScriptTargetES2020,
 * 	OptionalChaining:                  core.ScriptTargetES2020,
 * 	LogicalAssignment:                 core.ScriptTargetES2021,
 * 	TopLevelAwait:                     core.ScriptTargetES2022,
 * 	ClassFields:                       core.ScriptTargetES2022,
 * 	PrivateNamesAndClassStaticBlocks:  core.ScriptTargetES2022,
 * 	RegularExpressionFlagsHasIndices:  core.ScriptTargetES2022,
 * 	ShebangComments:                   core.ScriptTargetESNext,
 * 	UsingAndAwaitUsing:                core.ScriptTargetESNext,
 * 	ClassAndClassElementDecorators:    core.ScriptTargetESNext,
 * 	RegularExpressionFlagsUnicodeSets: core.ScriptTargetESNext,
 * }
 */
export const LanguageFeatureMinimumTarget = {
    Exponentiation: ScriptTargetES2016,
    AsyncFunctions: ScriptTargetES2017,
    ForAwaitOf: ScriptTargetES2018,
    AsyncGenerators: ScriptTargetES2018,
    AsyncIteration: ScriptTargetES2018,
    ObjectSpreadRest: ScriptTargetES2018,
    RegularExpressionFlagsDotAll: ScriptTargetES2018,
    BindinglessCatch: ScriptTargetES2019,
    BigInt: ScriptTargetES2020,
    NullishCoalesce: ScriptTargetES2020,
    OptionalChaining: ScriptTargetES2020,
    LogicalAssignment: ScriptTargetES2021,
    TopLevelAwait: ScriptTargetES2022,
    ClassFields: ScriptTargetES2022,
    PrivateNamesAndClassStaticBlocks: ScriptTargetES2022,
    RegularExpressionFlagsHasIndices: ScriptTargetES2022,
    ShebangComments: ScriptTargetESNext,
    UsingAndAwaitUsing: ScriptTargetESNext,
    ClassAndClassElementDecorators: ScriptTargetESNext,
    RegularExpressionFlagsUnicodeSets: ScriptTargetESNext,
};
//# sourceMappingURL=types.js.map