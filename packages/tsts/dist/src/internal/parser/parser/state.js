import { Pool } from "../../../go/sync.js";
import { GetViableKeywordSuggestions } from "../../scanner/scanner.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::constGroup::PCSourceElements+PCBlockStatements+PCSwitchClauses+PCSwitchClauseStatements+PCTypeMembers+PCClassMembers+PCEnumMembers+PCHeritageClauseElement+PCVariableDeclarations+PCObjectBindingElements+PCArrayBindingElements+PCArgumentExpressions+PCObjectLiteralMembers+PCJsxAttributes+PCJsxChildren+PCArrayLiteralMembers+PCParameters+PCJSDocParameters+PCRestProperties+PCTypeParameters+PCTypeArguments+PCTupleElementTypes+PCHeritageClauses+PCImportOrExportSpecifiers+PCImportAttributes+PCJSDocComment+PCCount","kind":"constGroup","status":"implemented","sigHash":"900e957e72cd3984a7992b56c31999ec071760458e11fba1b36a351032dbe95c","bodyHash":"69b9ea5ba14c1e06c5e9ea047cf779e518ef85cadb2d1394e1c90951b876cbaf"}
 *
 * Go source:
 * const (
 * 	PCSourceElements           ParsingContext = iota // Elements in source file
 * 	PCBlockStatements                                // Statements in block
 * 	PCSwitchClauses                                  // Clauses in switch statement
 * 	PCSwitchClauseStatements                         // Statements in switch clause
 * 	PCTypeMembers                                    // Members in interface or type literal
 * 	PCClassMembers                                   // Members in class declaration
 * 	PCEnumMembers                                    // Members in enum declaration
 * 	PCHeritageClauseElement                          // Elements in a heritage clause
 * 	PCVariableDeclarations                           // Variable declarations in variable statement
 * 	PCObjectBindingElements                          // Binding elements in object binding list
 * 	PCArrayBindingElements                           // Binding elements in array binding list
 * 	PCArgumentExpressions                            // Expressions in argument list
 * 	PCObjectLiteralMembers                           // Members in object literal
 * 	PCJsxAttributes                                  // Attributes in jsx element
 * 	PCJsxChildren                                    // Things between opening and closing JSX tags
 * 	PCArrayLiteralMembers                            // Members in array literal
 * 	PCParameters                                     // Parameters in parameter list
 * 	PCJSDocParameters                                // JSDoc parameters in parameter list of JSDoc function type
 * 	PCRestProperties                                 // Property names in a rest type list
 * 	PCTypeParameters                                 // Type parameters in type parameter list
 * 	PCTypeArguments                                  // Type arguments in type argument list
 * 	PCTupleElementTypes                              // Element types in tuple element type list
 * 	PCHeritageClauses                                // Heritage clauses for a class or interface declaration.
 * 	PCImportOrExportSpecifiers                       // Named import clause's import specifier list
 * 	PCImportAttributes                               // Import attributes
 * 	PCJSDocComment                                   // Parsing via JSDocParser
 * 	PCCount                                          // Number of parsing contexts
 * )
 */
export const PCSourceElements = 0;
export const PCBlockStatements = 1;
export const PCSwitchClauses = 2;
export const PCSwitchClauseStatements = 3;
export const PCTypeMembers = 4;
export const PCClassMembers = 5;
export const PCEnumMembers = 6;
export const PCHeritageClauseElement = 7;
export const PCVariableDeclarations = 8;
export const PCObjectBindingElements = 9;
export const PCArrayBindingElements = 10;
export const PCArgumentExpressions = 11;
export const PCObjectLiteralMembers = 12;
export const PCJsxAttributes = 13;
export const PCJsxChildren = 14;
export const PCArrayLiteralMembers = 15;
export const PCParameters = 16;
export const PCJSDocParameters = 17;
export const PCRestProperties = 18;
export const PCTypeParameters = 19;
export const PCTypeArguments = 20;
export const PCTupleElementTypes = 21;
export const PCHeritageClauses = 22;
export const PCImportOrExportSpecifiers = 23;
export const PCImportAttributes = 24;
export const PCJSDocComment = 25;
export const PCCount = 26;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::constGroup::jsdocScannerInfoHasJSDoc+jsdocScannerInfoHasDeprecated+jsdocScannerInfoHasSeeOrLink","kind":"constGroup","status":"implemented","sigHash":"d14440342472ed6adc2d373a946cf2a97fee5fba89872009af0d4c1833534940","bodyHash":"ee85d5f63665fdedd428d310ca7e9eb181f950adf35db021c47a40e40a430894"}
 *
 * Go source:
 * const (
 * 	jsdocScannerInfoHasJSDoc jsdocScannerInfo = 1 << iota
 * 	jsdocScannerInfoHasDeprecated
 * 	jsdocScannerInfoHasSeeOrLink
 * )
 */
export const jsdocScannerInfoHasJSDoc = 1;
export const jsdocScannerInfoHasDeprecated = 2;
export const jsdocScannerInfoHasSeeOrLink = 4;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::viableKeywordSuggestions","kind":"varGroup","status":"implemented","sigHash":"e6cd9371f5ed1b7ffeb2afe3c4c687857686b87a2334d143781443ef765894fb","bodyHash":"24d8dd10485a771c72881ee15a22d6a710b3f7035df48a1f9bf373f03101c58a"}
 *
 * Go source:
 * var viableKeywordSuggestions = scanner.GetViableKeywordSuggestions()
 */
export const viableKeywordSuggestions = GetViableKeywordSuggestions();
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::missingListNodes","kind":"varGroup","status":"implemented","sigHash":"d1c5395ca57bcb64c4b3e14d6d59605996440705ff57277a51696d4a8f0480be","bodyHash":"024eaa2a7207faca3efc65b264855dcb1504006bb6eaa8a7d7cf14c4f406787c"}
 *
 * Go source:
 * var missingListNodes = make([]*ast.Node, 0, 1)
 */
export const missingListNodes = [];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/parser.go::varGroup::parserPool","kind":"varGroup","status":"implemented","sigHash":"3fdc1286c48fa725161e8fd006c829b0d622c73db48a098be9f4f16883c2048e","bodyHash":"85c58e7891de25ca6c28a36cd456c6b0c6075aa9f16595f69f02bfe65b48dae3"}
 *
 * Go source:
 * var parserPool = sync.Pool{
 * 	New: func() any {
 * 		return newParser()
 * 	},
 * }
 */
export const parserPool = new Pool();
//# sourceMappingURL=state.js.map