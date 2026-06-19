import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import { Node_Symbol } from "../../ast/ast.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import { Diagnostic_AddRelatedInfo } from "../../ast/diagnostic.js";
import type { Symbol } from "../../ast/symbol.js";
import type { SymbolFlags } from "../../ast/generated/flags.js";
import { SymbolFlagsTypeParameter } from "../../ast/symbolflags.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import * as diagnostics from "../../diagnostics/generated/messages.js";
import type { EmitResolver, SymbolAccessibilityResult } from "../../printer/emitresolver.js";
import type { SymbolTracker } from "../../nodebuilder/types.js";
import { SymbolAccessibilityAccessible, SymbolAccessibilityNotResolved } from "../../printer/emitresolver.js";
import {
  IsExportAssignment,
  IsVariableDeclaration,
} from "../../ast/generated/predicates.js";
import {
  GetNameOfDeclaration,
  GetSourceFileOfNode,
} from "../../ast/utilities.js";
import { GetTextOfNode, DeclarationNameToString } from "../../scanner/utilities.js";
import { NewDiagnosticForNode } from "../../checker/utilities.js";
import { AppendIfUnique } from "../../core/core.js";
import { Find, Filter } from "../../core/core.js";
import { AsExportAssignment } from "../../ast/generated/casts.js";
import { createGetIsolatedDeclarationErrors, type GetSymbolAccessibilityDiagnostic } from "./diagnostics.js";
import type { DeclarationEmitHost } from "./transform.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::type::SymbolTrackerImpl","kind":"type","status":"implemented","sigHash":"79cac9a60c2d8c8e7c95ac5947d1ee4b007d23cb1f90efc004e66780e6519534","bodyHash":"3d0b1e2bb9b95fe041f24a5d5e940015e3814938b736ed7ca2618eba6fa1b31e"}
 *
 * Go source:
 * SymbolTrackerImpl struct {
 * 	resolver      printer.EmitResolver
 * 	state         *SymbolTrackerSharedState
 * 	host          DeclarationEmitHost
 * 	fallbackStack []*ast.Node
 *
 * 	getIsolatedDeclarationError func(node *ast.Node) *ast.Diagnostic
 * }
 */
export interface SymbolTrackerImpl {
  resolver: EmitResolver;
  state: GoPtr<SymbolTrackerSharedState>;
  host: DeclarationEmitHost;
  fallbackStack: GoSlice<GoPtr<Node>>;
  getIsolatedDeclarationError: (node: GoPtr<Node>) => GoPtr<Diagnostic>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.PopErrorFallbackNode","kind":"method","status":"implemented","sigHash":"e05272f46f0361ef6d27709130c80141d4981f5e6588ec610d62ae489b3edce7","bodyHash":"491d6131c59f6955c631d12f7f491d13e25c9a39b84baf2a7f019ee7551cc920"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) PopErrorFallbackNode() {
 * 	s.fallbackStack = s.fallbackStack[:len(s.fallbackStack)-1]
 * }
 */
export function SymbolTrackerImpl_PopErrorFallbackNode(receiver: GoPtr<SymbolTrackerImpl>): void {
  receiver!.fallbackStack = receiver!.fallbackStack.slice(0, receiver!.fallbackStack.length - 1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.PushErrorFallbackNode","kind":"method","status":"implemented","sigHash":"0b32628e1a8e085408f0e6041a3c82596b89fef9f327400a59601daf99c62276","bodyHash":"f95f0276ac6c0bf36dcb14c9266e4a1dae6ddbbaaac8647812abb69e663d1203"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) PushErrorFallbackNode(node *ast.Node) {
 * 	s.fallbackStack = append(s.fallbackStack, node)
 * }
 */
export function SymbolTrackerImpl_PushErrorFallbackNode(receiver: GoPtr<SymbolTrackerImpl>, node: GoPtr<Node>): void {
  receiver!.fallbackStack = [...receiver!.fallbackStack, node];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportCyclicStructureError","kind":"method","status":"implemented","sigHash":"41c930e2f88917dda61888f622a13f8caa6c68bd8acf60a5195f7494e4c6f852","bodyHash":"5f51b6c286993c66d06dfa73d71f65ab2e366b8e49729a3bad3317c41905621b"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportCyclicStructureError() {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_a_type_with_a_cyclic_structure_which_cannot_be_trivially_serialized_A_type_annotation_is_necessary, s.errorDeclarationNameWithFallback()))
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportCyclicStructureError(receiver: GoPtr<SymbolTrackerImpl>): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_a_type_with_a_cyclic_structure_which_cannot_be_trivially_serialized_A_type_annotation_is_necessary, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver)));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportInaccessibleThisError","kind":"method","status":"implemented","sigHash":"42ef3cade9d32d44da508147d281a31fd33c8302abb9e8d05287dc5505f90b16","bodyHash":"7b3a8d4d7aa88affc152ce22a97e291bed18eb2d688d2747397acc0b6c88a020"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportInaccessibleThisError() {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, s.errorDeclarationNameWithFallback(), "this"))
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportInaccessibleThisError(receiver: GoPtr<SymbolTrackerImpl>): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver), "this"));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportInaccessibleUniqueSymbolError","kind":"method","status":"implemented","sigHash":"a7eaf019309315ad337772b4aef9bfb5eda34d61295054c644ae4690e84c5e56","bodyHash":"b6a2d408972c24fe55dce2f2f3ad9a0f6d805223dbcc3af750511d5465e02981"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportInaccessibleUniqueSymbolError() {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, s.errorDeclarationNameWithFallback(), "unique symbol"))
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportInaccessibleUniqueSymbolError(receiver: GoPtr<SymbolTrackerImpl>): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_references_an_inaccessible_1_type_A_type_annotation_is_necessary, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver), "unique symbol"));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportInferenceFallback","kind":"method","status":"implemented","sigHash":"92bafb5160ac66ce9bd3375d617e051f77766199a8d55bce6a938f3f88f35f9a","bodyHash":"f9bf8eb6ff022ca5258a94818d8b8ea0266bd37802dd69cd866fb88c2298749c"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportInferenceFallback(node *ast.Node) {
 * 	if !s.state.isolatedDeclarations {
 * 		return
 * 	}
 * 	if ast.GetSourceFileOfNode(node) != s.state.currentSourceFile {
 * 		return // Nested error on a declaration in another file - ignore, will be reemitted if file is in the output file set
 * 	}
 * 	if s.state.resolver.IsExpandoFunctionDeclarationUnsafe(node) { // within a node builder call that should already lock the checker, use the unsafe call
 * 		s.state.reportExpandoFunctionErrors(node)
 * 	}
 * 	s.state.addDiagnostic(s.getIsolatedDeclarationError(node))
 * }
 */
export function SymbolTrackerImpl_ReportInferenceFallback(receiver: GoPtr<SymbolTrackerImpl>, node: GoPtr<Node>): void {
  if (!receiver!.state!.isolatedDeclarations) {
    return;
  }
  if (GetSourceFileOfNode(node) !== receiver!.state!.currentSourceFile) {
    return; // Nested error on a declaration in another file - ignore, will be reemitted if file is in the output file set
  }
  if (receiver!.state!.resolver.IsExpandoFunctionDeclarationUnsafe(node)) { // within a node builder call that should already lock the checker, use the unsafe call
    receiver!.state!.reportExpandoFunctionErrors(node);
  }
  SymbolTrackerSharedState_addDiagnostic(receiver!.state, receiver!.getIsolatedDeclarationError(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportLikelyUnsafeImportRequiredError","kind":"method","status":"implemented","sigHash":"94d9b3471b38c415aab16a99cea14a1d6dd403ac720190f436f2802d602a8c6b","bodyHash":"efadeeabe68d055797c00529fb016872c8b1d80937fb3a1054e800454df0fdc7"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportLikelyUnsafeImportRequiredError(specifier string, symbolName string) {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		if symbolName != "" {
 * 			s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_cannot_be_named_without_a_reference_to_2_from_1_This_is_likely_not_portable_A_type_annotation_is_necessary, s.errorDeclarationNameWithFallback(), specifier, symbolName))
 * 		} else {
 * 			s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_cannot_be_named_without_a_reference_to_1_This_is_likely_not_portable_A_type_annotation_is_necessary, s.errorDeclarationNameWithFallback(), specifier))
 * 		}
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportLikelyUnsafeImportRequiredError(receiver: GoPtr<SymbolTrackerImpl>, specifier: string, symbolName: string): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    if (symbolName !== "") {
      SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_cannot_be_named_without_a_reference_to_2_from_1_This_is_likely_not_portable_A_type_annotation_is_necessary, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver), specifier, symbolName));
    } else {
      SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_0_cannot_be_named_without_a_reference_to_1_This_is_likely_not_portable_A_type_annotation_is_necessary, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver), specifier));
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportNonSerializableProperty","kind":"method","status":"implemented","sigHash":"d2d0028599ffb7015b028b0701948fdc2a74417f3e4a57e4f0d064b6d6fd16a9","bodyHash":"5012045b5df07137f225879dc1bdec2c147b1d09067b19cde0ef966f816aea9f"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportNonSerializableProperty(propertyName string) {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_type_of_this_node_cannot_be_serialized_because_its_property_0_cannot_be_serialized, propertyName))
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportNonSerializableProperty(receiver: GoPtr<SymbolTrackerImpl>, propertyName: string): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_type_of_this_node_cannot_be_serialized_because_its_property_0_cannot_be_serialized, propertyName));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportNonlocalAugmentation","kind":"method","status":"implemented","sigHash":"4c2148a8d5734ee5b5f82dd883fdcacf1e7daca61cb2e7ec23bbc073580c1541","bodyHash":"9a01113cd513259faac0683fd59d328f18a3f4b628ea4c93663c2a2856bb568e"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportNonlocalAugmentation(containingFile *ast.SourceFile, parentSymbol *ast.Symbol, augmentingSymbol *ast.Symbol) {
 * 	primaryDeclaration := core.Find(parentSymbol.Declarations, func(d *ast.Node) bool { return ast.GetSourceFileOfNode(d) == containingFile })
 * 	augmentingDeclarations := core.Filter(augmentingSymbol.Declarations, func(d *ast.Node) bool { return ast.GetSourceFileOfNode(d) != containingFile })
 * 	if primaryDeclaration != nil && len(augmentingDeclarations) > 0 {
 * 		for _, augmentations := range augmentingDeclarations {
 * 			diag := createDiagnosticForNode(augmentations, diagnostics.Declaration_augments_declaration_in_another_file_This_cannot_be_serialized)
 * 			related := createDiagnosticForNode(primaryDeclaration, diagnostics.This_is_the_declaration_being_augmented_Consider_moving_the_augmenting_declaration_into_the_same_file)
 * 			diag.AddRelatedInfo(related)
 * 			s.state.addDiagnostic(diag)
 * 		}
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportNonlocalAugmentation(receiver: GoPtr<SymbolTrackerImpl>, containingFile: GoPtr<SourceFile>, parentSymbol: GoPtr<Symbol>, augmentingSymbol: GoPtr<Symbol>): void {
  const primaryDeclaration = Find(parentSymbol!.Declarations ?? [], (d: GoPtr<Node>): bool => GetSourceFileOfNode(d) === containingFile);
  const augmentingDeclarations = Filter(augmentingSymbol!.Declarations ?? [], (d: GoPtr<Node>): bool => GetSourceFileOfNode(d) !== containingFile);
  if (primaryDeclaration !== undefined && augmentingDeclarations.length > 0) {
    for (const augmentations of augmentingDeclarations) {
      const diag = createDiagnosticForNode(augmentations, diagnostics.Declaration_augments_declaration_in_another_file_This_cannot_be_serialized);
      const related = createDiagnosticForNode(primaryDeclaration, diagnostics.This_is_the_declaration_being_augmented_Consider_moving_the_augmenting_declaration_into_the_same_file);
      Diagnostic_AddRelatedInfo(diag, related);
      SymbolTrackerSharedState_addDiagnostic(receiver!.state, diag);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportPrivateInBaseOfClassExpression","kind":"method","status":"implemented","sigHash":"977e37341809cc0cb60a9dc52c0f400c589345957e5f70266c39dac6f7bff596","bodyHash":"dc54c74277dd30e8340e4b654147cf92315b9e109cf26fdd06d4fc1d60735613"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportPrivateInBaseOfClassExpression(propertyName string) {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		diag := createDiagnosticForNode(location, diagnostics.Property_0_of_exported_anonymous_class_type_may_not_be_private_or_protected, propertyName)
 * 		if ast.IsVariableDeclaration(location.Parent) {
 * 			related := createDiagnosticForNode(location, diagnostics.Add_a_type_annotation_to_the_variable_0, s.errorDeclarationNameWithFallback())
 * 			diag.AddRelatedInfo(related)
 * 		}
 * 		s.state.addDiagnostic(diag)
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportPrivateInBaseOfClassExpression(receiver: GoPtr<SymbolTrackerImpl>, propertyName: string): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    const diag = createDiagnosticForNode(location, diagnostics.Property_0_of_exported_anonymous_class_type_may_not_be_private_or_protected, propertyName);
    if (IsVariableDeclaration(location!.Parent)) {
      const related = createDiagnosticForNode(location, diagnostics.Add_a_type_annotation_to_the_variable_0, SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver));
      Diagnostic_AddRelatedInfo(diag, related);
    }
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, diag);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.ReportTruncationError","kind":"method","status":"implemented","sigHash":"a749ba6b53a027464f2dfebc9051cc305c85ae95d4af2309ab85307b60e992ac","bodyHash":"ef12b1b5a1c212bd35dcda6c0fd3b6654e1d6670a88d0c3c88acf81150630c1f"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) ReportTruncationError() {
 * 	location := s.errorLocation()
 * 	if location != nil {
 * 		s.state.addDiagnostic(createDiagnosticForNode(location, diagnostics.The_inferred_type_of_this_node_exceeds_the_maximum_length_the_compiler_will_serialize_An_explicit_type_annotation_is_needed))
 * 	}
 * }
 */
export function SymbolTrackerImpl_ReportTruncationError(receiver: GoPtr<SymbolTrackerImpl>): void {
  const location = SymbolTrackerImpl_errorLocation(receiver);
  if (location !== undefined) {
    SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(location, diagnostics.The_inferred_type_of_this_node_exceeds_the_maximum_length_the_compiler_will_serialize_An_explicit_type_annotation_is_needed));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.errorFallbackNode","kind":"method","status":"implemented","sigHash":"9a80f08a849883cba0d20e7d368f5c7ebd77d3a0f1969b25ef892d36d533846a","bodyHash":"203a205d7e7853325416221f68bcd3efddb7992b743e209201440bd5cf4fccb4"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) errorFallbackNode() *ast.Node {
 * 	if len(s.fallbackStack) >= 1 {
 * 		return s.fallbackStack[len(s.fallbackStack)-1]
 * 	}
 * 	return nil
 * }
 */
export function SymbolTrackerImpl_errorFallbackNode(receiver: GoPtr<SymbolTrackerImpl>): GoPtr<Node> {
  if (receiver!.fallbackStack.length >= 1) {
    return receiver!.fallbackStack[receiver!.fallbackStack.length - 1];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.errorLocation","kind":"method","status":"implemented","sigHash":"3e39b16b506db94adb4861816a5c312ba0a4a0fe8f4b9e7c183cb6eae9bd3217","bodyHash":"fc31d12b1553bdebb1cf65dc25067ff951c28f664e8536b4bb31b786bdd382ff"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) errorLocation() *ast.Node {
 * 	location := s.state.errorNameNode
 * 	if location == nil {
 * 		location = s.errorFallbackNode()
 * 	}
 * 	return location
 * }
 */
export function SymbolTrackerImpl_errorLocation(receiver: GoPtr<SymbolTrackerImpl>): GoPtr<Node> {
  const location = receiver!.state!.errorNameNode;
  if (location === undefined) {
    return SymbolTrackerImpl_errorFallbackNode(receiver);
  }
  return location;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.errorDeclarationNameWithFallback","kind":"method","status":"implemented","sigHash":"ee3c9b02820d3d068dcde13bae810e581e92d5ff1b8a5b14363e49cec4ab554f","bodyHash":"5d4edfd7fa1fe01243399c617117eb0b0da719e8d2caded4e67788b6b686a17e"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) errorDeclarationNameWithFallback() string {
 * 	if s.state.errorNameNode != nil {
 * 		return scanner.DeclarationNameToString(s.state.errorNameNode)
 * 	}
 * 	if s.errorFallbackNode() != nil && ast.GetNameOfDeclaration(s.errorFallbackNode()) != nil {
 * 		return scanner.DeclarationNameToString(ast.GetNameOfDeclaration(s.errorFallbackNode()))
 * 	}
 * 	if s.errorFallbackNode() != nil && ast.IsExportAssignment(s.errorFallbackNode()) {
 * 		if s.errorFallbackNode().AsExportAssignment().IsExportEquals {
 * 			return "export="
 * 		}
 * 		return "default"
 * 	}
 * 	return "(Missing)" // same fallback declarationNameToString uses when node is zero-width (ie, nameless)
 * }
 */
export function SymbolTrackerImpl_errorDeclarationNameWithFallback(receiver: GoPtr<SymbolTrackerImpl>): string {
  if (receiver!.state!.errorNameNode !== undefined) {
    return DeclarationNameToString(receiver!.state!.errorNameNode);
  }
  const fallback = SymbolTrackerImpl_errorFallbackNode(receiver);
  if (fallback !== undefined && GetNameOfDeclaration(fallback) !== undefined) {
    return DeclarationNameToString(GetNameOfDeclaration(fallback));
  }
  if (fallback !== undefined && IsExportAssignment(fallback)) {
    if (AsExportAssignment(fallback)!.IsExportEquals) {
      return "export=";
    }
    return "default";
  }
  return "(Missing)";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.TrackSymbol","kind":"method","status":"implemented","sigHash":"b3003d43136af9671d50fa576702a4c81e5717b4ce8382934f30711269821b88","bodyHash":"e3e28c3def2f38290f86c84ca3b8d4d16b3be185ac2fe52ef3fe31cea54ecc8d"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) TrackSymbol(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) bool {
 * 	if symbol.Flags&ast.SymbolFlagsTypeParameter != 0 {
 * 		return false
 * 	}
 * 	issuedDiagnostic := s.handleSymbolAccessibilityError(s.resolver.IsSymbolAccessible(symbol, enclosingDeclaration, meaning /*shouldComputeAliasToMarkVisible* /, true))
 * 	return issuedDiagnostic
 * }
 */
export function SymbolTrackerImpl_TrackSymbol(receiver: GoPtr<SymbolTrackerImpl>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): bool {
  if ((symbol_!.Flags & SymbolFlagsTypeParameter) !== 0) {
    return false;
  }
  const issuedDiagnostic = SymbolTrackerImpl_handleSymbolAccessibilityError(receiver, receiver!.resolver.IsSymbolAccessible(symbol_, enclosingDeclaration, meaning, /*shouldComputeAliasToMarkVisible*/ true));
  return issuedDiagnostic;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerImpl.handleSymbolAccessibilityError","kind":"method","status":"implemented","sigHash":"a174529489817fb4fc80c0b3990343708a4335b4216642ecbf93f6655fa85d23","bodyHash":"f4112007fc9bafda9919eb663047093b28da94635143ea80fba0f2e517b89cea"}
 *
 * Go source:
 * func (s *SymbolTrackerImpl) handleSymbolAccessibilityError(symbolAccessibilityResult printer.SymbolAccessibilityResult) bool {
 * 	if symbolAccessibilityResult.Accessibility == printer.SymbolAccessibilityAccessible {
 * 		// Add aliases back onto the possible imports list if they're not there so we can try them again with updated visibility info
 * 		if len(symbolAccessibilityResult.AliasesToMakeVisible) > 0 {
 * 			for _, ref := range symbolAccessibilityResult.AliasesToMakeVisible {
 * 				s.state.lateMarkedStatements = core.AppendIfUnique(s.state.lateMarkedStatements, ref)
 * 			}
 * 		}
 * 		// TODO: Do all these accessibility checks inside/after the first pass in the checker when declarations are enabled, if possible
 *
 * 		// The checker should issue errors on unresolvable names, skip the declaration emit error for using a private/unreachable name for those
 * 	} else if symbolAccessibilityResult.Accessibility != printer.SymbolAccessibilityNotResolved {
 * 		// Report error
 * 		errorInfo := s.state.getSymbolAccessibilityDiagnostic(symbolAccessibilityResult)
 * 		if errorInfo != nil {
 * 			info := *errorInfo
 * 			diagNode := symbolAccessibilityResult.ErrorNode
 * 			if diagNode == nil {
 * 				diagNode = errorInfo.errorNode
 * 			}
 * 			if info.typeName != nil {
 * 				s.state.addDiagnostic(createDiagnosticForNode(diagNode, info.diagnosticMessage, scanner.GetTextOfNode(info.typeName), symbolAccessibilityResult.ErrorSymbolName, symbolAccessibilityResult.ErrorModuleName))
 * 			} else {
 * 				s.state.addDiagnostic(createDiagnosticForNode(diagNode, info.diagnosticMessage, symbolAccessibilityResult.ErrorSymbolName, symbolAccessibilityResult.ErrorModuleName))
 * 			}
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function SymbolTrackerImpl_handleSymbolAccessibilityError(receiver: GoPtr<SymbolTrackerImpl>, symbolAccessibilityResult: SymbolAccessibilityResult): bool {
  if (symbolAccessibilityResult.Accessibility === SymbolAccessibilityAccessible) {
    if (symbolAccessibilityResult.AliasesToMakeVisible.length > 0) {
      for (const ref of symbolAccessibilityResult.AliasesToMakeVisible) {
        receiver!.state!.lateMarkedStatements = AppendIfUnique(receiver!.state!.lateMarkedStatements, ref);
      }
    }
  } else if (symbolAccessibilityResult.Accessibility !== SymbolAccessibilityNotResolved) {
    const errorInfo = receiver!.state!.getSymbolAccessibilityDiagnostic(symbolAccessibilityResult);
    if (errorInfo !== undefined) {
      const info = { ...errorInfo };
      let diagNode = symbolAccessibilityResult.ErrorNode;
      if (diagNode === undefined) {
        diagNode = errorInfo.errorNode;
      }
      if (info.typeName !== undefined) {
        SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(diagNode, info.diagnosticMessage, GetTextOfNode(info.typeName), symbolAccessibilityResult.ErrorSymbolName, symbolAccessibilityResult.ErrorModuleName));
      } else {
        SymbolTrackerSharedState_addDiagnostic(receiver!.state, createDiagnosticForNode(diagNode, info.diagnosticMessage, symbolAccessibilityResult.ErrorSymbolName, symbolAccessibilityResult.ErrorModuleName));
      }
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::func::createDiagnosticForNode","kind":"func","status":"implemented","sigHash":"6cf225f51d25f062d9fd1b3c0bb27fe6744e9d928f43e08b3167e655a83fe1b6","bodyHash":"cb2a31515e50844b5f324b708b1ab235d6d1a527cda17740a9761d08c518fd4a"}
 *
 * Go source:
 * func createDiagnosticForNode(node *ast.Node, message *diagnostics.Message, args ...any) *ast.Diagnostic {
 * 	return checker.NewDiagnosticForNode(node, message, args...)
 * }
 */
export function createDiagnosticForNode(node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): GoPtr<Diagnostic> {
  return NewDiagnosticForNode(node, message, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::type::SymbolTrackerSharedState","kind":"type","status":"implemented","sigHash":"1687bc2752fc401bb206fb09938e334bceab2625ee1de5c644623edb24a2a573","bodyHash":"8c711a26a398f5bad45673c42d10033ec0fd6d3db12f385fe80f621193ade3f3"}
 *
 * Go source:
 * SymbolTrackerSharedState struct {
 * 	lateMarkedStatements             []*ast.Node
 * 	diagnostics                      []*ast.Diagnostic
 * 	getSymbolAccessibilityDiagnostic GetSymbolAccessibilityDiagnostic
 * 	errorNameNode                    *ast.Node
 * 	isolatedDeclarations             bool
 * 	stripInternal                    bool
 * 	currentSourceFile                *ast.SourceFile
 * 	resolver                         printer.EmitResolver
 * 	reportExpandoFunctionErrors      func(node *ast.Node)
 * }
 */
export interface SymbolTrackerSharedState {
  lateMarkedStatements: GoSlice<GoPtr<Node>>;
  diagnostics: GoSlice<GoPtr<Diagnostic>>;
  getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic;
  errorNameNode: GoPtr<Node>;
  isolatedDeclarations: bool;
  stripInternal: bool;
  currentSourceFile: GoPtr<SourceFile>;
  resolver: EmitResolver;
  reportExpandoFunctionErrors: (node: GoPtr<Node>) => void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::method::SymbolTrackerSharedState.addDiagnostic","kind":"method","status":"implemented","sigHash":"0c16fbbcc7d9e2924c9f45048318efe4bd792c7c3ed32ca443e6871fde22bea5","bodyHash":"659c28f8d4767f439ec8077216ceccc9f9c0358906f9cc8ef2b6254ab8eb3ee0"}
 *
 * Go source:
 * func (s *SymbolTrackerSharedState) addDiagnostic(diag *ast.Diagnostic) {
 * 	s.diagnostics = append(s.diagnostics, diag)
 * }
 */
export function SymbolTrackerSharedState_addDiagnostic(receiver: GoPtr<SymbolTrackerSharedState>, diag: GoPtr<Diagnostic>): void {
  receiver!.diagnostics = [...receiver!.diagnostics, diag];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/tracker.go::func::NewSymbolTracker","kind":"func","status":"implemented","sigHash":"1df09c76e742797809ff1f1ca303e88fb68cdb4917cafb34c046da876e4cc51f","bodyHash":"7334373052b72c511e4c856dbfe7047374a817cd852b4609b6e3001699478d0c"}
 *
 * Go source:
 * func NewSymbolTracker(host DeclarationEmitHost, resolver printer.EmitResolver, state *SymbolTrackerSharedState) *SymbolTrackerImpl {
 * 	tracker := &SymbolTrackerImpl{host: host, resolver: resolver, state: state, getIsolatedDeclarationError: createGetIsolatedDeclarationErrors(resolver)}
 * 	return tracker
 * }
 */
export function NewSymbolTracker(host: DeclarationEmitHost, resolver: EmitResolver, state: GoPtr<SymbolTrackerSharedState>): GoPtr<SymbolTrackerImpl> {
  const tracker: SymbolTrackerImpl = {
    host: host,
    resolver: resolver,
    state: state,
    fallbackStack: [],
    getIsolatedDeclarationError: createGetIsolatedDeclarationErrors(resolver),
  };
  return tracker;
}

/**
 * Adapter: converts a GoPtr<SymbolTrackerImpl> to a SymbolTracker interface object.
 * This is the TS equivalent of Go's implicit interface satisfaction for *SymbolTrackerImpl.
 */
export function SymbolTrackerImpl_AsSymbolTracker(receiver: GoPtr<SymbolTrackerImpl>): SymbolTracker {
  return {
    TrackSymbol: (symbol_, enclosingDeclaration, meaning) => SymbolTrackerImpl_TrackSymbol(receiver, symbol_, enclosingDeclaration, meaning),
    ReportInaccessibleThisError: () => SymbolTrackerImpl_ReportInaccessibleThisError(receiver),
    ReportPrivateInBaseOfClassExpression: (propertyName) => SymbolTrackerImpl_ReportPrivateInBaseOfClassExpression(receiver, propertyName),
    ReportInaccessibleUniqueSymbolError: () => SymbolTrackerImpl_ReportInaccessibleUniqueSymbolError(receiver),
    ReportCyclicStructureError: () => SymbolTrackerImpl_ReportCyclicStructureError(receiver),
    ReportLikelyUnsafeImportRequiredError: (specifier, symbolName) => SymbolTrackerImpl_ReportLikelyUnsafeImportRequiredError(receiver, specifier, symbolName),
    ReportTruncationError: () => SymbolTrackerImpl_ReportTruncationError(receiver),
    ReportNonlocalAugmentation: (containingFile, parentSymbol, augmentingSymbol) => SymbolTrackerImpl_ReportNonlocalAugmentation(receiver, containingFile, parentSymbol, augmentingSymbol),
    ReportNonSerializableProperty: (propertyName) => SymbolTrackerImpl_ReportNonSerializableProperty(receiver, propertyName),
    ReportInferenceFallback: (node) => SymbolTrackerImpl_ReportInferenceFallback(receiver, node),
    PushErrorFallbackNode: (node) => SymbolTrackerImpl_PushErrorFallbackNode(receiver, node),
    PopErrorFallbackNode: () => SymbolTrackerImpl_PopErrorFallbackNode(receiver),
  };
}
