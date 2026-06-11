import type { GoPtr } from "../../../go/compat.js";
import {
  CompilerOptions_GetEmitScriptTarget,
  ScriptTargetES2016,
  ScriptTargetES2017,
  ScriptTargetES2018,
  ScriptTargetES2019,
  ScriptTargetES2020,
  ScriptTargetES2021,
  ScriptTargetES2022,
  ScriptTargetES2023,
  ScriptTargetES2024,
  ScriptTargetES2025,
  ScriptTargetESNext,
} from "../../core/compileroptions.js";
import { Chain } from "../chain.js";
import type { TransformerFactory, TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { newAsyncTransformer } from "./async.js";
import { newClassFieldsTransformer } from "./classfields.js";
import { newESDecoratorTransformer } from "./esdecorator.js";
import { newExponentiationTransformer } from "./exponentiation.js";
import { newforawaitTransformer } from "./forawait.js";
import { newLogicalAssignmentTransformer } from "./logicalassignment.js";
import { newNullishCoalescingTransformer } from "./nullishcoalescing.js";
import { newObjectRestSpreadTransformer } from "./objectrestspread.js";
import { newOptionalCatchTransformer } from "./optionalcatch.js";
import { newOptionalChainTransformer } from "./optionalchain.js";
import { newTaggedTemplateLiftRestrictionTransformer } from "./taggedtemplate.js";
import { newUsingDeclarationTransformer } from "./using.js";

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
export const esDecoratorAndClassFields: TransformerFactory = Chain(newESDecoratorTransformer, newClassFieldsTransformer);
export const NewESNextTransformer: TransformerFactory = Chain(newUsingDeclarationTransformer, esDecoratorAndClassFields);
// 2025: only module system syntax (import attributes, json modules), untransformed regex modifiers
// 2024: no new downlevel syntax
// 2023: no new downlevel syntax
// 2022: class static blocks and class fields are handled by newClassFieldsTransformer
export const NewES2021Transformer: TransformerFactory = Chain(NewESNextTransformer, newLogicalAssignmentTransformer);
export const NewES2020Transformer: TransformerFactory = Chain(NewES2021Transformer, newNullishCoalescingTransformer, newOptionalChainTransformer);
export const NewES2019Transformer: TransformerFactory = Chain(NewES2020Transformer, newOptionalCatchTransformer);
export const NewES2018Transformer: TransformerFactory = Chain(NewES2019Transformer, newObjectRestSpreadTransformer, newforawaitTransformer, newTaggedTemplateLiftRestrictionTransformer);
export const NewES2017Transformer: TransformerFactory = Chain(NewES2018Transformer, newAsyncTransformer);
export const NewES2016Transformer: TransformerFactory = Chain(NewES2017Transformer, newExponentiationTransformer);

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
export function GetESTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const options = opts!.CompilerOptions;
  switch (CompilerOptions_GetEmitScriptTarget(options)) {
    case ScriptTargetESNext:
      return esDecoratorAndClassFields(opts);
    case ScriptTargetES2025:
    case ScriptTargetES2024:
    case ScriptTargetES2023:
    case ScriptTargetES2022:
    case ScriptTargetES2021:
      return NewESNextTransformer(opts);
    case ScriptTargetES2020:
      return NewES2021Transformer(opts);
    case ScriptTargetES2019:
      return NewES2020Transformer(opts);
    case ScriptTargetES2018:
      return NewES2019Transformer(opts);
    case ScriptTargetES2017:
      return NewES2018Transformer(opts);
    case ScriptTargetES2016:
      return NewES2017Transformer(opts);
    default: // other, older, option, transform maximally
      return NewES2016Transformer(opts);
  }
}
