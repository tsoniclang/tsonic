import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import {
  CompilerOptions_GetEmitModuleDetectionKind,
  CompilerOptions_GetEmitModuleKind,
  JsxEmitReactJSX,
  JsxEmitReactJSXDev,
  ModuleDetectionKindAuto,
  ModuleDetectionKindForce,
  ModuleDetectionKindLegacy,
  ModuleKindESNext,
} from "../core/compileroptions.js";
import {
  ExtensionCjs,
  ExtensionCts,
  ExtensionMjs,
  ExtensionMts,
  FileExtensionIsOneOf,
  IsDeclarationFileName,
} from "../tspath/extension.js";
import type { Path } from "../tspath/path.js";
import type { Node, SourceFile, SourceFileMetaData } from "./ast.js";
import { AsImportEqualsDeclaration } from "./generated/casts.js";
import {
  IsExportAssignment,
  IsExportDeclaration,
  IsExternalModuleReference,
  IsImportDeclaration,
  IsImportEqualsDeclaration,
  IsJsxFragment,
  IsJsxOpeningElement,
} from "./generated/predicates.js";
import { ModifierFlagsExport } from "./modifierflags.js";
import type { Visitor } from "./spine.js";
import { Node_ForEachChild, Node_SubtreeFacts } from "./spine.js";
import { SubtreeContainsJsx } from "./subtreefacts.js";
import {
  GetImpliedNodeFormatForEmitWorker,
  HasSyntacticModifier,
  IsImportMeta,
} from "./utilities.js";
import { NodeFlagsPossiblyContainsImportMeta } from "./generated/flags.js";
import { ScriptKindJSON } from "../core/scriptkind.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::type::SourceFileParseOptions","kind":"type","status":"implemented","sigHash":"9a450bb87222c925154d70406dc08e93c64ffd27c4119d98bcb70e15e077af29","bodyHash":"053ca2016d94420fcce03accf7a3b15427c4e250f890f4d10a0b2b28e4befd05"}
 *
 * Go source:
 * SourceFileParseOptions struct {
 * 	FileName                       string
 * 	Path                           tspath.Path
 * 	ExternalModuleIndicatorOptions ExternalModuleIndicatorOptions
 * }
 */
export interface SourceFileParseOptions {
  FileName: string;
  Path: Path;
  ExternalModuleIndicatorOptions?: ExternalModuleIndicatorOptions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::type::ExternalModuleIndicatorOptions","kind":"type","status":"implemented","sigHash":"d6a8827054c27106b6e16cf7b5a0686882a047885e2edc345941388f710967ac","bodyHash":"b0d3a29337ea598fd5576128e3e0dda6aaa634799485842fd95f5aebb1c93500"}
 *
 * Go source:
 * ExternalModuleIndicatorOptions struct {
 * 	JSX   bool
 * 	Force bool
 * }
 */
export interface ExternalModuleIndicatorOptions {
  JSX: bool;
  Force: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::GetExternalModuleIndicatorOptions","kind":"func","status":"implemented","sigHash":"14383e9d4455dd791caa911e7186eb267fcd325c9c7f4a131f9ba2462a84e32a","bodyHash":"f04b1b21943fa2898cc2f0ea9d0fd0f1db37b4cf050aaa03dacb8c845361a534"}
 *
 * Go source:
 * func GetExternalModuleIndicatorOptions(fileName string, options *core.CompilerOptions, metadata SourceFileMetaData) ExternalModuleIndicatorOptions {
 * 	if tspath.IsDeclarationFileName(fileName) {
 * 		return ExternalModuleIndicatorOptions{}
 * 	}
 *
 * 	switch options.GetEmitModuleDetectionKind() {
 * 	case core.ModuleDetectionKindForce:
 * 		// All non-declaration files are modules, declaration files still do the usual isFileProbablyExternalModule
 * 		return ExternalModuleIndicatorOptions{Force: true}
 * 	case core.ModuleDetectionKindLegacy:
 * 		// Files are modules if they have imports, exports, or import.meta
 * 		return ExternalModuleIndicatorOptions{}
 * 	case core.ModuleDetectionKindAuto:
 * 		// If module is nodenext or node16, all esm format files are modules
 * 		// If jsx is react-jsx or react-jsxdev then jsx tags force module-ness
 * 		// otherwise, the presence of import or export statments (or import.meta) implies module-ness
 * 		return ExternalModuleIndicatorOptions{
 * 			JSX:   options.Jsx == core.JsxEmitReactJSX || options.Jsx == core.JsxEmitReactJSXDev,
 * 			Force: isFileForcedToBeModuleByFormat(fileName, options, metadata),
 * 		}
 * 	default:
 * 		return ExternalModuleIndicatorOptions{}
 * 	}
 * }
 */
export function GetExternalModuleIndicatorOptions(fileName: string, options: GoPtr<CompilerOptions>, metadata: SourceFileMetaData): ExternalModuleIndicatorOptions {
  if (IsDeclarationFileName(fileName)) {
    return { JSX: false, Force: false };
  }

  switch (CompilerOptions_GetEmitModuleDetectionKind(options)) {
    case ModuleDetectionKindForce:
      // All non-declaration files are modules, declaration files still do the usual isFileProbablyExternalModule
      return { JSX: false, Force: true };
    case ModuleDetectionKindLegacy:
      // Files are modules if they have imports, exports, or import.meta
      return { JSX: false, Force: false };
    case ModuleDetectionKindAuto:
      // If module is nodenext or node16, all esm format files are modules
      // If jsx is react-jsx or react-jsxdev then jsx tags force module-ness
      // otherwise, the presence of import or export statments (or import.meta) implies module-ness
      return {
        JSX: options!.Jsx === JsxEmitReactJSX || options!.Jsx === JsxEmitReactJSXDev,
        Force: isFileForcedToBeModuleByFormat(fileName, options, metadata),
      };
    default:
      return { JSX: false, Force: false };
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::varGroup::isFileForcedToBeModuleByFormatExtensions","kind":"varGroup","status":"implemented","sigHash":"704574fe3192786b288268ff3d3c230e4d0f95d8fc6325b76d91d730373665e7","bodyHash":"e47f03d425f618891825913e46bbec5525a7dd847b64bc2ce3286ff60108c1c0"}
 *
 * Go source:
 * var isFileForcedToBeModuleByFormatExtensions = []string{tspath.ExtensionCjs, tspath.ExtensionCts, tspath.ExtensionMjs, tspath.ExtensionMts}
 */
export const isFileForcedToBeModuleByFormatExtensions: GoSlice<string> = [ExtensionCjs, ExtensionCts, ExtensionMjs, ExtensionMts];

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::isFileForcedToBeModuleByFormat","kind":"func","status":"implemented","sigHash":"963f93612f9d264992fd241122e4739f2dcc96a8bf53731f6ba3521376ee8870","bodyHash":"0efad914924fa06650a053b7e4a3fee6f937dc7a5e0f5a5924430ca8ed0ab5ca"}
 *
 * Go source:
 * func isFileForcedToBeModuleByFormat(fileName string, options *core.CompilerOptions, metadata SourceFileMetaData) bool {
 * 	// Excludes declaration files - they still require an explicit `export {}` or the like
 * 	// for back compat purposes. The only non-declaration files _not_ forced to be a module are `.js` files
 * 	// that aren't esm-mode (meaning not in a `type: module` scope).
 * 	if GetImpliedNodeFormatForEmitWorker(fileName, options.GetEmitModuleKind(), metadata) == core.ModuleKindESNext || tspath.FileExtensionIsOneOf(fileName, isFileForcedToBeModuleByFormatExtensions) {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isFileForcedToBeModuleByFormat(fileName: string, options: GoPtr<CompilerOptions>, metadata: SourceFileMetaData): bool {
  // Excludes declaration files - they still require an explicit `export {}` or the like
  // for back compat purposes. The only non-declaration files _not_ forced to be a module are `.js` files
  // that aren't esm-mode (meaning not in a `type: module` scope).
  if (GetImpliedNodeFormatForEmitWorker(fileName, CompilerOptions_GetEmitModuleKind(options), metadata) === ModuleKindESNext || FileExtensionIsOneOf(fileName, isFileForcedToBeModuleByFormatExtensions)) {
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::SetExternalModuleIndicator","kind":"func","status":"implemented","sigHash":"ada99773c78d9a5d1a44457d65d0079c5047bea1c30d058c21fbae83eda7354a","bodyHash":"52708e5351dd964fdb883b196deec40c7fc3f1c07b19347bb25693fd944b241b"}
 *
 * Go source:
 * func SetExternalModuleIndicator(file *SourceFile, opts ExternalModuleIndicatorOptions) {
 * 	file.ExternalModuleIndicator = getExternalModuleIndicator(file, opts)
 * }
 */
export function SetExternalModuleIndicator(file: GoPtr<SourceFile>, opts: ExternalModuleIndicatorOptions): void {
  file!.ExternalModuleIndicator = getExternalModuleIndicator(file, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::getExternalModuleIndicator","kind":"func","status":"implemented","sigHash":"550e3c5d8118e3df5ad51f817184bc5a9f2a356da99a5bab340b77992d750078","bodyHash":"659c4a8ce9b6ac1ffb4452fb0682b875104599d0dd229cd61aad4fc0fcbe5db6"}
 *
 * Go source:
 * func getExternalModuleIndicator(file *SourceFile, opts ExternalModuleIndicatorOptions) *Node {
 * 	if file.ScriptKind == core.ScriptKindJSON {
 * 		return nil
 * 	}
 *
 * 	if node := isFileProbablyExternalModule(file); node != nil {
 * 		return node
 * 	}
 *
 * 	if file.IsDeclarationFile {
 * 		return nil
 * 	}
 *
 * 	if opts.JSX {
 * 		if node := isFileModuleFromUsingJSXTag(file); node != nil {
 * 			return node
 * 		}
 * 	}
 *
 * 	if opts.Force {
 * 		return file.AsNode()
 * 	}
 *
 * 	return nil
 * }
 */
export function getExternalModuleIndicator(file: GoPtr<SourceFile>, opts: ExternalModuleIndicatorOptions): GoPtr<Node> {
  if (file!.ScriptKind === ScriptKindJSON) {
    return undefined;
  }
  const node = isFileProbablyExternalModule(file);
  if (node !== undefined) {
    return node;
  }
  if (file!.IsDeclarationFile) {
    return undefined;
  }
  if (opts.JSX) {
    const jsxNode = isFileModuleFromUsingJSXTag(file);
    if (jsxNode !== undefined) {
      return jsxNode;
    }
  }
  if (opts.Force) {
    return file as GoPtr<Node>;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::isFileProbablyExternalModule","kind":"func","status":"implemented","sigHash":"5c5feae856ee652364aa96165e111929518cc511ae46b3b3da0fef7a36fbdb62","bodyHash":"02c05e0071dc22e9310ca3525bc8e04b8cc84835c72bede028404f9897d8c0de"}
 *
 * Go source:
 * func isFileProbablyExternalModule(sourceFile *SourceFile) *Node {
 * 	for _, statement := range sourceFile.Statements.Nodes {
 * 		if isAnExternalModuleIndicatorNode(statement) {
 * 			return statement
 * 		}
 * 	}
 * 	return getImportMetaIfNecessary(sourceFile)
 * }
 */
export function isFileProbablyExternalModule(sourceFile: GoPtr<SourceFile>): GoPtr<Node> {
  for (const statement of sourceFile!.Statements!.Nodes) {
    if (isAnExternalModuleIndicatorNode(statement)) {
      return statement;
    }
  }
  return getImportMetaIfNecessary(sourceFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::isAnExternalModuleIndicatorNode","kind":"func","status":"implemented","sigHash":"6769b18b3185f1a7475bf05aa92eea8b1810841a6a07cea2a0a1ecfbae43f21b","bodyHash":"dc7278e30de3eb41db2e250d7b312683bd8f5ff614562439ee06d7a369422e4d"}
 *
 * Go source:
 * func isAnExternalModuleIndicatorNode(node *Node) bool {
 * 	return HasSyntacticModifier(node, ModifierFlagsExport) ||
 * 		IsImportEqualsDeclaration(node) && IsExternalModuleReference(node.AsImportEqualsDeclaration().ModuleReference) ||
 * 		IsImportDeclaration(node) || IsExportAssignment(node) || IsExportDeclaration(node)
 * }
 */
export function isAnExternalModuleIndicatorNode(node: GoPtr<Node>): bool {
  return HasSyntacticModifier(node, ModifierFlagsExport) ||
    (IsImportEqualsDeclaration(node) && IsExternalModuleReference(AsImportEqualsDeclaration(node)!.ModuleReference)) ||
    IsImportDeclaration(node) || IsExportAssignment(node) || IsExportDeclaration(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::getImportMetaIfNecessary","kind":"func","status":"implemented","sigHash":"55e22613652764c1b0203104647aa82f50101ac8e960b8a66c832c815d9e4d38","bodyHash":"c8b7cef2954e743f056bac07de86919af6fbb27281f68a533613a90c55624ebd"}
 *
 * Go source:
 * func getImportMetaIfNecessary(sourceFile *SourceFile) *Node {
 * 	if sourceFile.AsNode().Flags&NodeFlagsPossiblyContainsImportMeta != 0 {
 * 		return findChildNode(sourceFile.AsNode(), IsImportMeta)
 * 	}
 * 	return nil
 * }
 */
export function getImportMetaIfNecessary(sourceFile: GoPtr<SourceFile>): GoPtr<Node> {
  if (((sourceFile as GoPtr<Node>)!.Flags & NodeFlagsPossiblyContainsImportMeta) !== 0) {
    return findChildNode(sourceFile as GoPtr<Node>, IsImportMeta);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::findChildNode","kind":"func","status":"implemented","sigHash":"9c50a24b829d3a054a0e80e7ffea0fb379dae644dc1c6e554ae30b31a4a3cab1","bodyHash":"60683bdfbce5f1fc8270402b628d278ffb67f866e261da709193c61d9e4af485"}
 *
 * Go source:
 * func findChildNode(root *Node, check func(*Node) bool) *Node {
 * 	var result *Node
 * 	var visit func(*Node) bool
 * 	visit = func(node *Node) bool {
 * 		if check(node) {
 * 			result = node
 * 			return true
 * 		}
 * 		return node.ForEachChild(visit)
 * 	}
 * 	visit(root)
 * 	return result
 * }
 */
export function findChildNode(root: GoPtr<Node>, check: (arg0: GoPtr<Node>) => bool): GoPtr<Node> {
  const container = { result: undefined as GoPtr<Node> };
  const visit: Visitor = (node: GoPtr<Node>): bool => {
    if (check(node)) {
      container.result = node;
      return true;
    }
    return Node_ForEachChild(node, visit);
  };
  visit(root);
  return container.result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::isFileModuleFromUsingJSXTag","kind":"func","status":"implemented","sigHash":"42b93852c47bd324e1a0545c1741ba35a3e6bd119150fcf069d28d44e55138ae","bodyHash":"4294b2ca70f78b4e67054bb92ebc39dd263be5364809845f865d7c017875ddf2"}
 *
 * Go source:
 * func isFileModuleFromUsingJSXTag(file *SourceFile) *Node {
 * 	return walkTreeForJSXTags(file.AsNode())
 * }
 */
export function isFileModuleFromUsingJSXTag(file: GoPtr<SourceFile>): GoPtr<Node> {
  return walkTreeForJSXTags(file as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/parseoptions.go::func::walkTreeForJSXTags","kind":"func","status":"implemented","sigHash":"19964bc6e5e18190cc0173165e74a2f16d38796c25a999b41ecc2c8d6b280b02","bodyHash":"0ddc99f039e6b129842fd2d0fe1e7f57b027cef46653603b91854a048a0aab6e"}
 *
 * Go source:
 * func walkTreeForJSXTags(node *Node) *Node {
 * 	var found *Node
 *
 * 	var visitor func(node *Node) bool
 * 	visitor = func(node *Node) bool {
 * 		if found != nil {
 * 			return true
 * 		}
 * 		if node.SubtreeFacts()&SubtreeContainsJsx == 0 {
 * 			return false
 * 		}
 * 		if IsJsxOpeningElement(node) || IsJsxFragment(node) {
 * 			found = node
 * 			return true
 * 		}
 * 		return node.ForEachChild(visitor)
 * 	}
 * 	visitor(node)
 *
 * 	return found
 * }
 */
export function walkTreeForJSXTags(node: GoPtr<Node>): GoPtr<Node> {
  const container = { found: undefined as GoPtr<Node> };
  const visitor: Visitor = (n: GoPtr<Node>): bool => {
    if (container.found !== undefined) {
      return true;
    }
    if ((Node_SubtreeFacts(n) & SubtreeContainsJsx) === 0) {
      return false;
    }
    if (IsJsxOpeningElement(n) || IsJsxFragment(n)) {
      container.found = n;
      return true;
    }
    return Node_ForEachChild(n, visitor);
  };
  visitor(node);
  return container.found;
}
