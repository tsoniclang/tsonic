import type { GoPtr } from "../../../go/compat.js";
import type { TransformerFactory, TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/definitions.go::varGroup::esDecoratorAndClassFields+NewESNextTransformer+NewES2021Transformer+NewES2020Transformer+NewES2019Transformer+NewES2018Transformer+NewES2017Transformer+NewES2016Transformer","kind":"varGroup","status":"implemented","sigHash":"4f34f45d06e8a43b258e7b3839619324bd97c56c44afbf09a16d06c8484b9efe","bodyHash":"b9b7be70ffb5bf6acc08ad764f47f87a7b7508571344ea4510865d2b2d75bbb2"}
 *
 * Go source:
 * var (
 * 	esDecoratorAndClassFields = transformers.Chain(newESDecoratorTransformer, newClassFieldsTransformer)
 * 	NewESNextTransformer      = transformers.Chain(newUsingDeclarationTransformer, esDecoratorAndClassFields)
 * 	// 2025: only module system syntax (import attributes, json modules), untransformed regex modifiers
 * 	// 2024: no new downlevel syntax
 * 	// 2023: no new downlevel syntax
 * 	// 2022: class static blocks and class fields are handled by newClassFieldsTransformer
 * 	NewES2021Transformer = transformers.Chain(NewESNextTransformer, newLogicalAssignmentTransformer)
 * 	NewES2020Transformer = transformers.Chain(NewES2021Transformer, newNullishCoalescingTransformer, newOptionalChainTransformer)
 * 	NewES2019Transformer = transformers.Chain(NewES2020Transformer, newOptionalCatchTransformer)
 * 	NewES2018Transformer = transformers.Chain(NewES2019Transformer, newObjectRestSpreadTransformer, newforawaitTransformer, newTaggedTemplateLiftRestrictionTransformer)
 * 	NewES2017Transformer = transformers.Chain(NewES2018Transformer, newAsyncTransformer)
 * 	NewES2016Transformer = transformers.Chain(NewES2017Transformer, newExponentiationTransformer)
 * )
 */
export declare const esDecoratorAndClassFields: TransformerFactory;
export declare const NewESNextTransformer: TransformerFactory;
export declare const NewES2021Transformer: TransformerFactory;
export declare const NewES2020Transformer: TransformerFactory;
export declare const NewES2019Transformer: TransformerFactory;
export declare const NewES2018Transformer: TransformerFactory;
export declare const NewES2017Transformer: TransformerFactory;
export declare const NewES2016Transformer: TransformerFactory;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/definitions.go::func::GetESTransformer","kind":"func","status":"implemented","sigHash":"4a230e67717c0e5f8565aaaa3cdd441426d3011e691956574b0738fb83a76068","bodyHash":"890c167a79d0f363bd81ab7c4c34c88e793072922aa695f5976feda606108478"}
 *
 * Go source:
 * func GetESTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	options := opts.CompilerOptions
 * 	switch options.GetEmitScriptTarget() {
 * 	case core.ScriptTargetESNext:
 * 		return esDecoratorAndClassFields(opts)
 * 	case core.ScriptTargetES2025, core.ScriptTargetES2024, core.ScriptTargetES2023, core.ScriptTargetES2022, core.ScriptTargetES2021:
 * 		return NewESNextTransformer(opts)
 * 	case core.ScriptTargetES2020:
 * 		return NewES2021Transformer(opts)
 * 	case core.ScriptTargetES2019:
 * 		return NewES2020Transformer(opts)
 * 	case core.ScriptTargetES2018:
 * 		return NewES2019Transformer(opts)
 * 	case core.ScriptTargetES2017:
 * 		return NewES2018Transformer(opts)
 * 	case core.ScriptTargetES2016:
 * 		return NewES2017Transformer(opts)
 * 	default: // other, older, option, transform maximally
 * 		return NewES2016Transformer(opts)
 * 	}
 * }
 */
export declare function GetESTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
//# sourceMappingURL=definitions.d.ts.map