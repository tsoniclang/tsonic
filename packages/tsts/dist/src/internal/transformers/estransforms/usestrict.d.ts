import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { HasFileName, SourceFile } from "../../ast/ast.js";
import type { CompilerOptions, ModuleKind } from "../../core/compileroptions.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/usestrict.go::func::NewUseStrictTransformer","kind":"func","status":"implemented","sigHash":"8548943188a84097e8c5f632f80d4cc3a5a73a9f47f0ac087728d4417e2d8c9f","bodyHash":"65a7420c01dc5cf980d3a653d9f85e7aa5f7d85f529ca6d1337b5a933a03a9ce"}
 *
 * Go source:
 * func NewUseStrictTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &useStrictTransformer{
 * 		compilerOptions:           opts.CompilerOptions,
 * 		getEmitModuleFormatOfFile: opts.GetEmitModuleFormatOfFile,
 * 	}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function NewUseStrictTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/usestrict.go::type::useStrictTransformer","kind":"type","status":"implemented","sigHash":"a68c19d03737bc2502213f9abf1cc3c91f261993492b39c90f55470ec691e76b","bodyHash":"906f681eba4e183c774464f764d5f9d04f71eab87eef20a0fc0c2af1f21c965a"}
 *
 * Go source:
 * useStrictTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions           *core.CompilerOptions
 * 	getEmitModuleFormatOfFile func(file ast.HasFileName) core.ModuleKind
 * }
 */
export interface useStrictTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    getEmitModuleFormatOfFile: (file: HasFileName) => ModuleKind;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/usestrict.go::method::useStrictTransformer.visit","kind":"method","status":"implemented","sigHash":"e81b038d0e53c63eda0ef050a1ee25fc9d29186b41c241115913a9c71b503cfe","bodyHash":"1eb770b2d75ca98b219d6a9ee254e24183b99343209ac2d62b02f65da70633ec"}
 *
 * Go source:
 * func (tx *useStrictTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.Kind != ast.KindSourceFile {
 * 		return node
 * 	}
 * 	return tx.visitSourceFile(node.AsSourceFile())
 * }
 */
export declare function useStrictTransformer_visit(receiver: GoPtr<useStrictTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/usestrict.go::method::useStrictTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"065813b9d18f141ff204c8c8b00a07ba30f6ecd21b4569e29aaf174129b883d9","bodyHash":"24173ec428b3bc3f3b34e8cc20a8ece02dfb14d35d08beaf08a78c3255f5dac4"}
 *
 * Go source:
 * func (tx *useStrictTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.ScriptKind == core.ScriptKindJSON {
 * 		return node.AsNode()
 * 	}
 *
 * 	isExternalModule := ast.IsExternalModule(node)
 * 	moduleKind := tx.compilerOptions.GetEmitModuleKind()
 * 	format := tx.getEmitModuleFormatOfFile(node)
 *
 * 	// ESM is always strict. If the file is ESM, and CJS emit
 * 	// has not been requested, then skip adding "use strict".
 * 	if isExternalModule && moduleKind >= core.ModuleKindES2015 &&
 * 		(moduleKind == core.ModuleKindPreserve || format >= core.ModuleKindES2015) {
 * 		return node.AsNode()
 * 	}
 *
 * 	statements := tx.Factory().EnsureUseStrict(node.Statements.Nodes)
 * 	statementList := tx.Factory().NewNodeList(statements)
 * 	statementList.Loc = node.Statements.Loc
 * 	return tx.Factory().UpdateSourceFile(node, statementList, node.EndOfFileToken).AsSourceFile().AsNode()
 * }
 */
export declare function useStrictTransformer_visitSourceFile(receiver: GoPtr<useStrictTransformer>, node: GoPtr<SourceFile>): GoPtr<Node>;
//# sourceMappingURL=usestrict.d.ts.map