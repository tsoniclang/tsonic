import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { Node_Name, NodeFactory_NewNodeList } from "../../ast/spine.js";
import { Node_Text } from "../../ast/ast.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Expression, IdentifierNode, LiteralExpression, Statement, StringLiteralNode } from "../../ast/generated/unions.js";
import { KindEnumDeclaration, KindModuleDeclaration } from "../../ast/generated/kinds.js";
import { IsIdentifier, IsStringLiteral } from "../../ast/generated/predicates.js";
import { AsStringLiteral } from "../../ast/generated/casts.js";
import { NewExportDeclaration, NewNamedExports, NewStringLiteral } from "../../ast/generated/factory.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { ShouldRewriteModuleSpecifier } from "../../core/core.js";
import { ChangeExtension } from "../../tspath/extension.js";
import { GetOutputExtension } from "../../outputpaths/outputpaths.js";
import { GetExternalModuleName } from "../../ast/utilities.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { EmitContext_AssignCommentAndSourceMapRanges, EmitContext_GetAutoGenerateInfo, EmitContext_MostOriginal, EmitContext_SetOriginal } from "../../printer/emitcontext.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { NodeFactory } from "../../printer/factory.js";
import { GeneratedIdentifierFlags_IsFileLevel, GeneratedIdentifierFlags_IsOptimistic, GeneratedIdentifierFlags_IsReservedInNestedScopes } from "../../printer/generatedidentifierflags.js";
import { IsSimpleCopiableExpression } from "../utilities.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::isDeclarationNameOfEnumOrNamespace","kind":"func","status":"implemented","sigHash":"d38d773126c953f9b255a45fbb25827b9abb3c44aded0810ccd50fda275c740a","bodyHash":"bfb9d0d58e5c9083f438aa1a640e3a143e6504e385db193a752654163c1d9aeb"}
 *
 * Go source:
 * func isDeclarationNameOfEnumOrNamespace(emitContext *printer.EmitContext, node *ast.IdentifierNode) bool {
 * 	if original := emitContext.MostOriginal(node); original != nil && original.Parent != nil { //nolint:customlint // MostOriginal yields parse-tree nodes and this helper intentionally inspects parse-tree parents.
 * 		switch original.Parent.Kind { //nolint:customlint // MostOriginal yields parse-tree nodes and this helper intentionally inspects parse-tree parents.
 * 		case ast.KindEnumDeclaration, ast.KindModuleDeclaration:
 * 			return original == original.Parent.Name() //nolint:customlint // MostOriginal yields parse-tree nodes and this helper intentionally inspects parse-tree parents.
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isDeclarationNameOfEnumOrNamespace(emitContext: GoPtr<EmitContext>, node: GoPtr<IdentifierNode>): bool {
  const original = EmitContext_MostOriginal(emitContext, node);
  if (original !== undefined && original.Parent !== undefined) {
    switch (original.Parent.Kind) {
      case KindEnumDeclaration:
      case KindModuleDeclaration:
        return (original === Node_Name(original.Parent)) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::rewriteModuleSpecifier","kind":"func","status":"implemented","sigHash":"2a2c22228384ecaa74332c5ba52312b4025457fda5e0066cca919ab98e76b487","bodyHash":"3b74c7a916939c0b44a346f875fc6ebca36485158d5fb36bb85e760ddfae8892"}
 *
 * Go source:
 * func rewriteModuleSpecifier(emitContext *printer.EmitContext, node *ast.Expression, compilerOptions *core.CompilerOptions) *ast.Expression {
 * 	if node == nil || !ast.IsStringLiteral(node) || !core.ShouldRewriteModuleSpecifier(node.Text(), compilerOptions) {
 * 		return node
 * 	}
 * 	updatedText := tspath.ChangeExtension(node.Text(), outputpaths.GetOutputExtension(node.Text(), compilerOptions.Jsx))
 * 	if updatedText != node.Text() {
 * 		updated := emitContext.Factory.NewStringLiteral(updatedText, node.AsStringLiteral().TokenFlags)
 * 		emitContext.SetOriginal(updated, node)
 * 		emitContext.AssignCommentAndSourceMapRanges(updated, node)
 * 		return updated
 * 	}
 * 	return node
 * }
 */
export function rewriteModuleSpecifier(emitContext: GoPtr<EmitContext>, node: GoPtr<Expression>, compilerOptions: GoPtr<CompilerOptions>): GoPtr<Expression> {
  if (node === undefined || !IsStringLiteral(node as unknown as GoPtr<Node>) || !ShouldRewriteModuleSpecifier(Node_Text(node as unknown as GoPtr<Node>), compilerOptions)) {
    return node;
  }
  const nodeText = Node_Text(node as unknown as GoPtr<Node>);
  const updatedText = ChangeExtension(nodeText, GetOutputExtension(nodeText, compilerOptions!.Jsx));
  if (updatedText !== nodeText) {
    const updated = NewStringLiteral(emitContext!.Factory!.__tsgoEmbedded0!, updatedText, AsStringLiteral(node as unknown as GoPtr<Node>)!.TokenFlags);
    EmitContext_SetOriginal(emitContext, updated, node as unknown as GoPtr<Node>);
    EmitContext_AssignCommentAndSourceMapRanges(emitContext, updated, node as unknown as GoPtr<Node>);
    return updated as unknown as GoPtr<Expression>;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::createEmptyImports","kind":"func","status":"implemented","sigHash":"8de438e75c9c68feadf0dffad932f1272f03fd968a467554f415b03e21bd3fb8","bodyHash":"5faf0df76923f12442482f29ea9467969b19a54a9cc9be4031ebac89ac8fd7db"}
 *
 * Go source:
 * func createEmptyImports(factory *printer.NodeFactory) *ast.Statement {
 * 	return factory.NewExportDeclaration(
 * 		nil,   /*modifiers* /
 * 		false, /*isTypeOnly* /
 * 		factory.NewNamedExports(factory.NewNodeList(nil)),
 * 		nil, /*moduleSpecifier* /
 * 		nil, /*attributes* /
 * 	)
 * }
 */
export function createEmptyImports(factory: GoPtr<NodeFactory>): GoPtr<Statement> {
  const f = factory!.__tsgoEmbedded0!;
  return NewExportDeclaration(
    f,
    undefined, /*modifiers*/
    false, /*isTypeOnly*/
    NewNamedExports(f, NodeFactory_NewNodeList(f, [])),
    undefined, /*moduleSpecifier*/
    undefined, /*attributes*/
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::getExternalModuleNameLiteral","kind":"func","status":"implemented","sigHash":"332f3906d02f3957621ee33167bfa1acd3c6b1bbbc072635ec7d0237090bc214","bodyHash":"61a61fa3ea9fdaf998b027e378ba6446533ba8f18f649bfccba7e70f6ee05613"}
 *
 * Go source:
 * func getExternalModuleNameLiteral(factory *printer.NodeFactory, importNode *ast.Node /*ImportDeclaration | ExportDeclaration | ImportEqualsDeclaration | ImportCall* /, sourceFile *ast.SourceFile, host any /*EmitHost* /, resolver printer.EmitResolver, compilerOptions *core.CompilerOptions) *ast.StringLiteralNode {
 * 	moduleName := ast.GetExternalModuleName(importNode)
 * 	if moduleName != nil && ast.IsStringLiteral(moduleName) {
 * 		name := tryGetModuleNameFromDeclaration(importNode, host, factory, resolver, compilerOptions)
 * 		if name == nil {
 * 			name = tryRenameExternalModule(factory, moduleName, sourceFile)
 * 		}
 * 		if name == nil { // !!! propagate token flags (will produce new diffs)
 * 			name = factory.NewStringLiteral(moduleName.Text(), ast.TokenFlagsNone)
 * 		}
 * 		return name
 * 	}
 * 	return nil
 * }
 */
export function getExternalModuleNameLiteral(factory: GoPtr<NodeFactory>, importNode: GoPtr<Node>, sourceFile: GoPtr<SourceFile>, host: unknown, resolver: EmitResolver, compilerOptions: GoPtr<CompilerOptions>): GoPtr<StringLiteralNode> {
  const moduleName = GetExternalModuleName(importNode);
  if (moduleName !== undefined && IsStringLiteral(moduleName as unknown as GoPtr<Node>)) {
    let name = tryGetModuleNameFromDeclaration(importNode, host, factory, resolver, compilerOptions);
    if (name === undefined) {
      name = tryRenameExternalModule(factory, moduleName as unknown as GoPtr<LiteralExpression>, sourceFile);
    }
    if (name === undefined) { // !!! propagate token flags (will produce new diffs)
      name = NewStringLiteral(factory!.__tsgoEmbedded0!, Node_Text(moduleName as unknown as GoPtr<Node>), TokenFlagsNone) as unknown as GoPtr<StringLiteralNode>;
    }
    return name;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::tryGetModuleNameFromFile","kind":"func","status":"implemented","sigHash":"86404341709498b7d103fe061fc636a6232963da4ea6216b67634d8010b035ec","bodyHash":"2d8a42cbaf50f06383b7aedd8fdb4b470f738d57caaca78491b668c8f6ac0fcd"}
 *
 * Go source:
 * func tryGetModuleNameFromFile(factory *printer.NodeFactory, file *ast.SourceFile, host any /*EmitHost* /, options *core.CompilerOptions) *ast.StringLiteralNode {
 * 	if file == nil {
 * 		return nil
 * 	}
 * 	// !!!
 * 	// if file.moduleName {
 * 	// 	return factory.createStringLiteral(file.moduleName)
 * 	// }
 * 	return nil
 * }
 */
export function tryGetModuleNameFromFile(factory: GoPtr<NodeFactory>, file: GoPtr<SourceFile>, host: unknown, options: GoPtr<CompilerOptions>): GoPtr<StringLiteralNode> {
  if (file === undefined) {
    return undefined;
  }
  // !!!
  // if file.moduleName {
  // 	return factory.createStringLiteral(file.moduleName)
  // }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::tryGetModuleNameFromDeclaration","kind":"func","status":"implemented","sigHash":"42090b48f212d30ce223102feb69c4c02726acf95f6426315ccb32e213cefd6e","bodyHash":"209ee8908d2b2c31ef39e0626012d8e364bbf814a50b40c4af1c8ff112e214c5"}
 *
 * Go source:
 * func tryGetModuleNameFromDeclaration(declaration *ast.Node /*ImportEqualsDeclaration | ImportDeclaration | ExportDeclaration | ImportCall* /, host any /*EmitHost* /, factory *printer.NodeFactory, resolver printer.EmitResolver, compilerOptions *core.CompilerOptions) *ast.StringLiteralNode {
 * 	if resolver == nil {
 * 		return nil
 * 	}
 * 	return tryGetModuleNameFromFile(factory, resolver.GetExternalModuleFileFromDeclaration(declaration), host, compilerOptions)
 * }
 */
export function tryGetModuleNameFromDeclaration(declaration: GoPtr<Node>, host: unknown, factory: GoPtr<NodeFactory>, resolver: EmitResolver, compilerOptions: GoPtr<CompilerOptions>): GoPtr<StringLiteralNode> {
  if (resolver === undefined) {
    return undefined;
  }
  return tryGetModuleNameFromFile(factory, resolver.GetExternalModuleFileFromDeclaration(declaration), host, compilerOptions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::getExternalModuleNameFromPath","kind":"func","status":"implemented","sigHash":"646f85b4bc394277b2db8834bd0c872a8136d5df8c43de50ecf1877b402cbf61","bodyHash":"e680cc244dc6ad5eb7e9d85f430edd66b21a7eb74fe3d63452a4ced35c19beef"}
 *
 * Go source:
 * func getExternalModuleNameFromPath(host any /*ResolveModuleNameResolutionHost* /, fileName string, referencePath string) string {
 * 	// !!!
 * 	return ""
 * }
 */
export function getExternalModuleNameFromPath(host: unknown, fileName: string, referencePath: string): string {
  // !!!
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::tryRenameExternalModule","kind":"func","status":"implemented","sigHash":"c7bae52b7c9d12be7badb5274c926f71c96ecf9ab7bb5287d40cae2bfa400abf","bodyHash":"c8ce73d3a04dec1c49a25e0aff8e3f59af05a0f7aa6fbe12a4bf79d35d5e7201"}
 *
 * Go source:
 * func tryRenameExternalModule(factory *printer.NodeFactory, moduleName *ast.LiteralExpression, sourceFile *ast.SourceFile) *ast.StringLiteralNode {
 * 	// !!!
 * 	return nil
 * }
 */
export function tryRenameExternalModule(factory: GoPtr<NodeFactory>, moduleName: GoPtr<LiteralExpression>, sourceFile: GoPtr<SourceFile>): GoPtr<StringLiteralNode> {
  // !!!
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::isFileLevelReservedGeneratedIdentifier","kind":"func","status":"implemented","sigHash":"0dab0e82e98b5bb08717d60db66bcf8e5d122f680e4688e4b022eff042041d8e","bodyHash":"6d6ba9af307314ae03b2ac4e2ba9e26a876729d38ab48e61eda51e65d2412392"}
 *
 * Go source:
 * func isFileLevelReservedGeneratedIdentifier(emitContext *printer.EmitContext, name *ast.IdentifierNode) bool {
 * 	info := emitContext.GetAutoGenerateInfo(name)
 * 	return info != nil &&
 * 		info.Flags.IsFileLevel() &&
 * 		info.Flags.IsOptimistic() &&
 * 		info.Flags.IsReservedInNestedScopes()
 * }
 */
export function isFileLevelReservedGeneratedIdentifier(emitContext: GoPtr<EmitContext>, name: GoPtr<IdentifierNode>): bool {
  const info = EmitContext_GetAutoGenerateInfo(emitContext, name);
  return (info !== undefined &&
    GeneratedIdentifierFlags_IsFileLevel(info.Flags) &&
    GeneratedIdentifierFlags_IsOptimistic(info.Flags) &&
    GeneratedIdentifierFlags_IsReservedInNestedScopes(info.Flags)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/utilities.go::func::isSimpleInlineableExpression","kind":"func","status":"implemented","sigHash":"874485f092c753a5950477db5654255c3afe4154b28da97830c8e089c1fb9416","bodyHash":"e3cece86b57596703b7edeae813695ba1ecff80989cb4aea9f73502b2860e46d"}
 *
 * Go source:
 * func isSimpleInlineableExpression(expression *ast.Expression) bool {
 * 	return !ast.IsIdentifier(expression) && transformers.IsSimpleCopiableExpression(expression)
 * }
 */
export function isSimpleInlineableExpression(expression: GoPtr<Expression>): bool {
  return (!IsIdentifier(expression) && IsSimpleCopiableExpression(expression)) as bool;
}
