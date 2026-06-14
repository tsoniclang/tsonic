import type { bool } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Uint64 } from "../../go/sync/atomic.js";
import type { CheckFlags } from "./checkflags.js";
import type { Node } from "./spine.js";
import type { SymbolFlags } from "./symbolflags.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::type::Symbol","kind":"type","status":"implemented","sigHash":"f6832f7bb71206a127c501f5d4064938e8afd0bedacfd35c03d28bf509c5d808","bodyHash":"634d78d7441a3106cbf21cb5830bb90f8e16c4650bdf3684c32205cdd58172c8"}
 *
 * Go source:
 * Symbol struct {
 * 	Flags            SymbolFlags
 * 	CheckFlags       CheckFlags // Non-zero only in transient symbols created by Checker
 * 	Name             string
 * 	Declarations     []*Node
 * 	ValueDeclaration *Node
 * 	Members          SymbolTable
 * 	Exports          SymbolTable
 * 	id               atomic.Uint64
 * 	Parent           *Symbol
 * 	ExportSymbol     *Symbol
 * }
 */
export interface Symbol {
    Flags: SymbolFlags;
    CheckFlags: CheckFlags;
    Name: string;
    Declarations: GoPtr<GoSlice<GoPtr<Node>>>;
    ValueDeclaration: GoPtr<Node>;
    Members: SymbolTable;
    Exports: SymbolTable;
    id: Uint64;
    Parent: GoPtr<Symbol>;
    ExportSymbol: GoPtr<Symbol>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::method::Symbol.IsExternalModule","kind":"method","status":"implemented","sigHash":"1088392c56df1db1d3d637e1866e504f4a27a1825628537e7758e2647dde3fd0","bodyHash":"1b9fa475b7582509569afab2b6308201d9ef299529bc2de6b860ab06c963a02d"}
 *
 * Go source:
 * func (s *Symbol) IsExternalModule() bool {
 * 	return s.Flags&SymbolFlagsModule != 0 && len(s.Name) > 0 && s.Name[0] == '"'
 * }
 */
export declare function Symbol_IsExternalModule(receiver: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::method::Symbol.IsStatic","kind":"method","status":"implemented","sigHash":"bb11a9a121579329500086ccf2019b4547799b36c9c794e1e060c5165b9cb621","bodyHash":"bee51adb5388c6dd5b33dbaba4ecb564db886abd6a9ac0d5bacc3f1701a8429c"}
 *
 * Go source:
 * func (s *Symbol) IsStatic() bool {
 * 	if s.ValueDeclaration == nil {
 * 		return false
 * 	}
 * 	modifierFlags := s.ValueDeclaration.ModifierFlags()
 * 	return modifierFlags&ModifierFlagsStatic != 0
 * }
 */
export declare function Symbol_IsStatic(receiver: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::method::Symbol.CombinedLocalAndExportSymbolFlags","kind":"method","status":"implemented","sigHash":"394ae510187d881d10da11308090aadf6f9306c218938a4074127546f75be490","bodyHash":"bcfd1e481b33f328b8c548e985e0455a81183c000f42ddbfb58ff3d431e845bd"}
 *
 * Go source:
 * func (s *Symbol) CombinedLocalAndExportSymbolFlags() SymbolFlags {
 * 	if s.ExportSymbol != nil {
 * 		return s.Flags | s.ExportSymbol.Flags
 * 	}
 * 	return s.Flags
 * }
 */
export declare function Symbol_CombinedLocalAndExportSymbolFlags(receiver: GoPtr<Symbol>): SymbolFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::type::SymbolTable","kind":"type","status":"implemented","sigHash":"c040ac407dabb99aefe73ff9dbbe0abc3073fe7770cc087163094b8e760160da","bodyHash":"1fb610c48f1aa5cc87145401a1197cfa074f1d0323cb81047240fa1f67cdb78a"}
 *
 * Go source:
 * SymbolTable map[string]*Symbol
 */
export type SymbolTable = GoMap<string, GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::constGroup::InternalSymbolNamePrefix","kind":"constGroup","status":"implemented","sigHash":"6bea7552a8f413cb4da0c4ee2dba2e66647da7fb63fb822779217c4e17971fb3","bodyHash":"7743450a76a60a01558757ed3741b7545bbb03f4d5eeb5f0c7e2bf6d2daed8be"}
 *
 * Go source:
 * const InternalSymbolNamePrefix = "\xFE"
 */
export declare const InternalSymbolNamePrefix: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::constGroup::InternalSymbolNameCall+InternalSymbolNameConstructor+InternalSymbolNameNew+InternalSymbolNameIndex+InternalSymbolNameExportStar+InternalSymbolNameGlobal+InternalSymbolNameMissing+InternalSymbolNameType+InternalSymbolNameObject+InternalSymbolNameJSXAttributes+InternalSymbolNameClass+InternalSymbolNameFunction+InternalSymbolNameComputed+InternalSymbolNameAssignmentDeclaration+InternalSymbolNameInstantiationExpression+InternalSymbolNameImportAttributes+InternalSymbolNameExportEquals+InternalSymbolNameDefault+InternalSymbolNameThis+InternalSymbolNameModuleExports","kind":"constGroup","status":"implemented","sigHash":"a2c8c20c9adc58b1f356dca683a71a66f4c0de95af1cb1f778eda19473f0ae72","bodyHash":"c9b9d9e98f8f94075b1f20865ba7a655b85c5f436dd72e22e9bd0048b5b96375"}
 *
 * Go source:
 * const (
 * 	InternalSymbolNameCall                    = InternalSymbolNamePrefix + "call"                    // Call signatures
 * 	InternalSymbolNameConstructor             = InternalSymbolNamePrefix + "constructor"             // Constructor implementations
 * 	InternalSymbolNameNew                     = InternalSymbolNamePrefix + "new"                     // Constructor signatures
 * 	InternalSymbolNameIndex                   = InternalSymbolNamePrefix + "index"                   // Index signatures
 * 	InternalSymbolNameExportStar              = InternalSymbolNamePrefix + "export"                  // Module export * declarations
 * 	InternalSymbolNameGlobal                  = InternalSymbolNamePrefix + "global"                  // Global self-reference
 * 	InternalSymbolNameMissing                 = InternalSymbolNamePrefix + "missing"                 // Indicates missing symbol
 * 	InternalSymbolNameType                    = InternalSymbolNamePrefix + "type"                    // Anonymous type literal symbol
 * 	InternalSymbolNameObject                  = InternalSymbolNamePrefix + "object"                  // Anonymous object literal declaration
 * 	InternalSymbolNameJSXAttributes           = InternalSymbolNamePrefix + "jsxAttributes"           // Anonymous JSX attributes object literal declaration
 * 	InternalSymbolNameClass                   = InternalSymbolNamePrefix + "class"                   // Unnamed class expression
 * 	InternalSymbolNameFunction                = InternalSymbolNamePrefix + "function"                // Unnamed function expression
 * 	InternalSymbolNameComputed                = InternalSymbolNamePrefix + "computed"                // Computed property name declaration with dynamic name
 * 	InternalSymbolNameAssignmentDeclaration   = InternalSymbolNamePrefix + "assignment"              // Assignment declarations
 * 	InternalSymbolNameInstantiationExpression = InternalSymbolNamePrefix + "instantiationExpression" // Instantiation expressions
 * 	InternalSymbolNameImportAttributes        = InternalSymbolNamePrefix + "importAttributes"
 * 	InternalSymbolNameExportEquals            = "export=" // Export assignment symbol
 * 	InternalSymbolNameDefault                 = "default" // Default export symbol (technically not wholly internal, but included here for usability)
 * 	InternalSymbolNameThis                    = "this"
 * 	InternalSymbolNameModuleExports           = "module.exports"
 * )
 */
export declare const InternalSymbolNameCall: string;
export declare const InternalSymbolNameConstructor: string;
export declare const InternalSymbolNameNew: string;
export declare const InternalSymbolNameIndex: string;
export declare const InternalSymbolNameExportStar: string;
export declare const InternalSymbolNameGlobal: string;
export declare const InternalSymbolNameMissing: string;
export declare const InternalSymbolNameType: string;
export declare const InternalSymbolNameObject: string;
export declare const InternalSymbolNameJSXAttributes: string;
export declare const InternalSymbolNameClass: string;
export declare const InternalSymbolNameFunction: string;
export declare const InternalSymbolNameComputed: string;
export declare const InternalSymbolNameAssignmentDeclaration: string;
export declare const InternalSymbolNameInstantiationExpression: string;
export declare const InternalSymbolNameImportAttributes: string;
export declare const InternalSymbolNameExportEquals: string;
export declare const InternalSymbolNameDefault: string;
export declare const InternalSymbolNameThis: string;
export declare const InternalSymbolNameModuleExports: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::func::SymbolName","kind":"func","status":"implemented","sigHash":"b0a1e1df2b0c0fb014c37539fd2f68a6c210ba1307b5d969d3133fe44af8c928","bodyHash":"a1549fa15a1e067f9faecec4366ecb0052d8ede675fbb6300de55bce67ec0f6c"}
 *
 * Go source:
 * func SymbolName(symbol *Symbol) string {
 * 	if symbol.ValueDeclaration != nil && IsPrivateIdentifierClassElementDeclaration(symbol.ValueDeclaration) {
 * 		return symbol.ValueDeclaration.Name().Text()
 * 	}
 * 	return symbol.Name
 * }
 */
export declare function SymbolName(symbol_: GoPtr<Symbol>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/symbol.go::func::EscapeAllInternalSymbolNames","kind":"func","status":"implemented","sigHash":"5a7646db1a9b0b05cf13620e7de490910f3b78250ba1270b11ce186ce75f9fd6","bodyHash":"761e8044eca0ef5e9602e22a8b6a9a211f0291a065981a4b8bc4415f61b5ae1d"}
 *
 * Go source:
 * func EscapeAllInternalSymbolNames(name string) string {
 * 	return strings.ReplaceAll(name, InternalSymbolNamePrefix, "__")
 * }
 */
export declare function EscapeAllInternalSymbolNames(name: string): string;
//# sourceMappingURL=symbol.d.ts.map