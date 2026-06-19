import type { bool } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import { AsSourceFile, Node_Body, Node_Text, SourceFile_Imports } from "../ast/ast.js";
import { AsModuleDeclaration } from "../ast/generated/casts.js";
import { IsModuleDeclaration, IsStringLiteral } from "../ast/generated/predicates.js";
import { ModifierFlagsAmbient } from "../ast/modifierflags.js";
import {
  ForEachDynamicImportOrRequireCall,
  GetExternalModuleName,
  HasSyntacticModifier,
  IsAmbientModule,
  IsAnyImportOrReExport,
  IsExternalModule,
  IsInJSFile,
  SetImportsOfSourceFile,
} from "../ast/utilities.js";
import type { SourceFileNode, Statement, Expression } from "../ast/generated/unions.js";
import type { Node } from "../ast/spine.js";
import { Node_Statements } from "../ast/ast.js";
import { NodeFlagsPossiblyContainsDynamicImport } from "../ast/generated/flags.js";
import { TSFalse, TSTrue, TSUnknown } from "../core/tristate.js";
import { ExclusivelyPrefixedNodeCoreModules, UnprefixedNodeCoreModules } from "../core/nodemodules.js";
import { IsExternalModuleNameRelative } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/references.go::func::collectExternalModuleReferences","kind":"func","status":"implemented","sigHash":"4d8d023f7e1626f55ec19bf881edfdc02e296caac96c92a0eaffc70e23fec3b7","bodyHash":"7e08993b823bfb4992a6311f7dc098f6b1f09656d7f311424d5f699de1cf9d9f"}
 *
 * Go source:
 * func collectExternalModuleReferences(file *ast.SourceFile) {
 * 	for _, node := range file.Statements.Nodes {
 * 		collectModuleReferences(file, node, false /*inAmbientModule* /)
 * 	}
 * 
 * 	if file.Flags&ast.NodeFlagsPossiblyContainsDynamicImport != 0 || ast.IsInJSFile(file.AsNode()) {
 * 		ast.ForEachDynamicImportOrRequireCall(file /*includeTypeSpaceImports* /, true /*requireStringLiteralLikeArgument* /, true, func(node *ast.Node, moduleSpecifier *ast.Expression) bool {
 * 			ast.SetImportsOfSourceFile(file, append(file.Imports(), moduleSpecifier))
 * 			return false
 * 		})
 * 	}
 * }
 */
export function collectExternalModuleReferences(file: GoPtr<SourceFileNode>): void {
  const sf = AsSourceFile(file)!;
  for (const node of sf.Statements!.Nodes) {
    collectModuleReferences(file, node as GoPtr<Statement>, false /*inAmbientModule*/);
  }

  if ((sf.Flags & NodeFlagsPossiblyContainsDynamicImport) !== 0 || IsInJSFile(file)) {
    ForEachDynamicImportOrRequireCall(sf, /*includeTypeSpaceImports*/ true as bool, /*requireStringLiteralLikeArgument*/ true as bool, (node: GoPtr<Node>, moduleSpecifier: GoPtr<Expression>): bool => {
      SetImportsOfSourceFile(sf, [...SourceFile_Imports(sf), moduleSpecifier]);
      return false as bool;
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/references.go::func::collectModuleReferences","kind":"func","status":"implemented","sigHash":"260f87bea5e66582d015bd947fa46b6a78f97d1eaaaf28bb69c979533a643d9e","bodyHash":"0bec5999fa31c8d853d987389bd70f4acf4e10c830cf80eda84025e77eab6180"}
 *
 * Go source:
 * func collectModuleReferences(file *ast.SourceFile, node *ast.Statement, inAmbientModule bool) {
 * 	if ast.IsAnyImportOrReExport(node) {
 * 		moduleNameExpr := ast.GetExternalModuleName(node)
 * 		// TypeScript 1.0 spec (April 2014): 12.1.6
 * 		// An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
 * 		// only through top - level external module names. Relative external module names are not permitted.
 * 		if moduleNameExpr != nil && ast.IsStringLiteral(moduleNameExpr) {
 * 			moduleName := moduleNameExpr.Text()
 * 			if moduleName != "" && (!inAmbientModule || !tspath.IsExternalModuleNameRelative(moduleName)) {
 * 				ast.SetImportsOfSourceFile(file, append(file.Imports(), moduleNameExpr))
 * 				// !!! removed `&& p.currentNodeModulesDepth == 0`
 * 				if file.UsesUriStyleNodeCoreModules != core.TSTrue && !file.IsDeclarationFile {
 * 					if strings.HasPrefix(moduleName, "node:") && !core.ExclusivelyPrefixedNodeCoreModules[moduleName] {
 * 						// Presence of `node:` prefix takes precedence over unprefixed node core modules
 * 						file.UsesUriStyleNodeCoreModules = core.TSTrue
 * 					} else if file.UsesUriStyleNodeCoreModules == core.TSUnknown && core.UnprefixedNodeCoreModules[moduleName] {
 * 						// Avoid `unprefixedNodeCoreModules.has` for every import
 * 						file.UsesUriStyleNodeCoreModules = core.TSFalse
 * 					}
 * 				}
 * 			}
 * 		}
 * 		return
 * 	}
 * 	if ast.IsModuleDeclaration(node) && ast.IsAmbientModule(node) && (inAmbientModule || ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient) || file.IsDeclarationFile) {
 * 		nameText := node.AsModuleDeclaration().Name().Text()
 * 		// Ambient module declarations can be interpreted as augmentations for some existing external modules.
 * 		// This will happen in two cases:
 * 		// - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
 * 		// - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
 * 		//   immediately nested in top level ambient module declaration .
 * 		if ast.IsExternalModule(file) || (inAmbientModule && !tspath.IsExternalModuleNameRelative(nameText)) {
 * 			file.ModuleAugmentations = append(file.ModuleAugmentations, node.AsModuleDeclaration().Name())
 * 		} else if !inAmbientModule {
 * 			file.AmbientModuleNames = append(file.AmbientModuleNames, nameText)
 * 			// An AmbientExternalModuleDeclaration declares an external module.
 * 			// This type of declaration is permitted only in the global module.
 * 			// The StringLiteral must specify a top - level external module name.
 * 			// Relative external module names are not permitted
 * 			// NOTE: body of ambient module is always a module block, if it exists
 * 			if node.Body() != nil {
 * 				for _, statement := range node.Body().Statements() {
 * 					collectModuleReferences(file, statement, true /*inAmbientModule* /)
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function collectModuleReferences(file: GoPtr<SourceFileNode>, node: GoPtr<Statement>, inAmbientModule: bool): void {
  const sf = AsSourceFile(file)!;
  if (IsAnyImportOrReExport(node)) {
    const moduleNameExpr = GetExternalModuleName(node);
    // TypeScript 1.0 spec (April 2014): 12.1.6
    // An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
    // only through top - level external module names. Relative external module names are not permitted.
    if (moduleNameExpr !== undefined && IsStringLiteral(moduleNameExpr)) {
      const moduleName = Node_Text(moduleNameExpr);
      if (moduleName !== "" && (!inAmbientModule || !IsExternalModuleNameRelative(moduleName))) {
        SetImportsOfSourceFile(sf, [...SourceFile_Imports(sf), moduleNameExpr]);
        // !!! removed `&& p.currentNodeModulesDepth == 0`
        if (sf.UsesUriStyleNodeCoreModules !== TSTrue && !sf.IsDeclarationFile) {
          if (moduleName.startsWith("node:") && !ExclusivelyPrefixedNodeCoreModules.get(moduleName)) {
            // Presence of `node:` prefix takes precedence over unprefixed node core modules
            sf.UsesUriStyleNodeCoreModules = TSTrue;
          } else if (sf.UsesUriStyleNodeCoreModules === TSUnknown && UnprefixedNodeCoreModules.get(moduleName)) {
            // Avoid `unprefixedNodeCoreModules.has` for every import
            sf.UsesUriStyleNodeCoreModules = TSFalse;
          }
        }
      }
    }
    return;
  }
  if (IsModuleDeclaration(node) && IsAmbientModule(node) && (inAmbientModule || HasSyntacticModifier(node, ModifierFlagsAmbient) || sf.IsDeclarationFile)) {
    const nameText = Node_Text(AsModuleDeclaration(node)!.name);
    // Ambient module declarations can be interpreted as augmentations for some existing external modules.
    // This will happen in two cases:
    // - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
    // - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
    //   immediately nested in top level ambient module declaration .
    if (IsExternalModule(sf) || (inAmbientModule && !IsExternalModuleNameRelative(nameText))) {
      sf.ModuleAugmentations = [...sf.ModuleAugmentations, AsModuleDeclaration(node)!.name];
    } else if (!inAmbientModule) {
      sf.AmbientModuleNames = [...sf.AmbientModuleNames, nameText];
      // An AmbientExternalModuleDeclaration declares an external module.
      // This type of declaration is permitted only in the global module.
      // The StringLiteral must specify a top - level external module name.
      // Relative external module names are not permitted
      // NOTE: body of ambient module is always a module block, if it exists
      if (Node_Body(node) !== undefined) {
        const stmts = Node_Statements(Node_Body(node));
        if (stmts !== undefined) {
          for (const statement of stmts) {
            collectModuleReferences(file, statement as GoPtr<Statement>, true /*inAmbientModule*/);
          }
        }
      }
    }
  }
}
