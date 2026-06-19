import type { bool, int, uint } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import * as maps from "../../go/maps.js";
import { goReceiverKey } from "../ast/spine.js";
import type { Node } from "../ast/spine.js";
import type { Symbol as Symbol_0b94c68b } from "../ast/symbol.js";
import type { Phase, TracedType, Tracer as Tracer_5708eec8, Tracing } from "../tracing/tracing.js";
import { Tracing_Instant, Tracing_NewTypeTracer, Tracing_Push } from "../tracing/tracing.js";
import type { Checker } from "./checker/state.js";
import { Checker_TypeToString } from "./printer.js";
import { getRecursionIdentity } from "./relater.js";
import {
  FormatTypeFlags,
  ObjectFlagsAnonymous,
  ObjectFlagsEvolvingArray,
  ObjectFlagsReference,
  ObjectFlagsReverseMapped,
  ObjectFlagsTuple,
  TypeAlias_Symbol,
  TypeAlias_TypeArguments,
  Type_AsConditionalType,
  Type_AsEvolvingArrayType,
  Type_AsIndexType,
  Type_AsIndexedAccessType,
  Type_AsReverseMappedType,
  Type_AsSubstitutionType,
  Type_AsTypeReference,
  Type_AsUnionOrIntersectionType,
  Type_Target,
  TypeFlagsConditional,
  TypeFlagsIndex,
  TypeFlagsIndexedAccess,
  TypeFlagsIntersection,
  TypeFlagsIntrinsic,
  TypeFlagsLiteral,
  TypeFlagsObject,
  TypeFlagsSubstitution,
  TypeFlagsTemplateLiteral,
  TypeFlagsUnion,
} from "./types.js";
import type { IntrinsicType, Type } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::type::Tracer","kind":"type","status":"implemented","sigHash":"f6f6cd010e9b895165c298c7bce581689d14754cbe933633c3878896feab31c3","bodyHash":"6af7bd12623c8e5aa4fceed128e77b4c5f1aff234df6e3f6ad12f3af1e37d9d1"}
 *
 * Go source:
 * Tracer struct {
 * 	tracing      *tracing.Tracing
 * 	recorder     tracing.Tracer
 * 	checkerIndex int
 * }
 */
export interface Tracer {
  tracing: GoPtr<Tracing>;
  recorder: Tracer_5708eec8;
  checkerIndex: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::func::NewTracer","kind":"func","status":"implemented","sigHash":"5a3eaee96bfab76e74b793560aeaf801e00b8c4e807ce1c849cb31588a5ed889","bodyHash":"289772e26b78773e99ab1e7693cc622c039dec7b0b800bbf5d622ced274b4cdb"}
 *
 * Go source:
 * func NewTracer(tr *tracing.Tracing, checkerIndex int) *Tracer {
 * 	return &Tracer{tracing: tr, recorder: tr.NewTypeTracer(checkerIndex), checkerIndex: checkerIndex}
 * }
 */
export function NewTracer(tr: GoPtr<Tracing>, checkerIndex: int): GoPtr<Tracer> {
  return { tracing: tr, recorder: Tracing_NewTypeTracer(tr, checkerIndex), checkerIndex: checkerIndex };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::Tracer.RecordType","kind":"method","status":"implemented","sigHash":"7250d09f455bdc84863e3746776fb3531fc4777bfcfd794977bb19251dffc8b9","bodyHash":"bc450f962f5f58216eb252c35685644e1b151d2ecb8fc3838e9aa10666e5796b"}
 *
 * Go source:
 * func (t *Tracer) RecordType(typ *Type) {
 * 	t.recorder.RecordType(wrapType(typ))
 * }
 */
export function Tracer_RecordType(receiver: GoPtr<Tracer>, typ: GoPtr<Type>): void {
  receiver!.recorder.RecordType(wrapType(typ));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::Tracer.Push","kind":"method","status":"implemented","sigHash":"c9e8f40f38ad2a360fb5d7feb268c01130cda07d7ae8e72ba50ddc9ba3ac61c2","bodyHash":"e88dbcebd844f398cde6caae509e79b0486ad4a802a1fec0abea34a545e71936"}
 *
 * Go source:
 * func (t *Tracer) Push(phase tracing.Phase, name string, args map[string]any, separateBeginAndEnd bool) func() {
 * 	if !separateBeginAndEnd {
 * 		return t.tracing.Push(phase, name, t.copyWithCheckerIndex(args), separateBeginAndEnd)
 * 	}
 *
 * 	args, restore := t.temporarilyAddCheckerIndex(args)
 * 	pop := t.tracing.Push(phase, name, args, separateBeginAndEnd)
 * 	restore()
 *
 * 	return func() {
 * 		_, restoreEndArgs := t.temporarilyAddCheckerIndex(args)
 * 		defer restoreEndArgs()
 * 		pop()
 * 	}
 * }
 */
export function Tracer_Push(receiver: GoPtr<Tracer>, phase: Phase, name: string, args: GoMap<string, unknown>, separateBeginAndEnd: bool): () => void {
  if (!separateBeginAndEnd) {
    return Tracing_Push(receiver!.tracing, phase, name, Tracer_copyWithCheckerIndex(receiver, args), separateBeginAndEnd);
  }

  const [args_0, restore] = Tracer_temporarilyAddCheckerIndex(receiver, args);
  const pop = Tracing_Push(receiver!.tracing, phase, name, args_0, separateBeginAndEnd);
  restore();

  return (): void => {
    const [, restoreEndArgs] = Tracer_temporarilyAddCheckerIndex(receiver, args_0);
    try {
      pop();
    } finally {
      restoreEndArgs();
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::Tracer.Instant","kind":"method","status":"implemented","sigHash":"706c5c33b0b24d2ff2766778e6fd828c2a8b1fb2f36c5b7c89d5cbda913a0b3a","bodyHash":"9fdeaf3b692fff4d6836cfc4c6a4a81139302697684c3f365a4953e4ca51c2d4"}
 *
 * Go source:
 * func (t *Tracer) Instant(phase tracing.Phase, name string, args map[string]any) {
 * 	t.tracing.Instant(phase, name, t.copyWithCheckerIndex(args))
 * }
 */
export function Tracer_Instant(receiver: GoPtr<Tracer>, phase: Phase, name: string, args: GoMap<string, unknown>): void {
  Tracing_Instant(receiver!.tracing, phase, name, Tracer_copyWithCheckerIndex(receiver, args));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::Tracer.copyWithCheckerIndex","kind":"method","status":"implemented","sigHash":"223309489e8ee567b3134b7f9f5b146a7c372d260d48dd64462dfb057b694808","bodyHash":"0c5c2075287b14886037baee3a993e8c7afcc84df88b6b89830fede1d9ab910e"}
 *
 * Go source:
 * func (t *Tracer) copyWithCheckerIndex(args map[string]any) map[string]any {
 * 	withCheckerIndex := make(map[string]any, len(args)+1)
 * 	maps.Copy(withCheckerIndex, args)
 * 	withCheckerIndex["checkerId"] = t.checkerIndex
 * 	return withCheckerIndex
 * }
 */
export function Tracer_copyWithCheckerIndex(receiver: GoPtr<Tracer>, args: GoMap<string, unknown>): GoMap<string, unknown> {
  const withCheckerIndex = new globalThis.Map<string, unknown>();
  maps.Copy(withCheckerIndex, args ?? new globalThis.Map<string, unknown>());
  withCheckerIndex.set("checkerId", receiver!.checkerIndex);
  return withCheckerIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::Tracer.temporarilyAddCheckerIndex","kind":"method","status":"implemented","sigHash":"05c282d023cb1d080e7ef6ff0e0c9b32197ec454d6c2ccc99ac9937252de6309","bodyHash":"ceb149b974f0c4cb90678a2f1169c885e08fc2451346b8335b75fb85b79cd22f"}
 *
 * Go source:
 * func (t *Tracer) temporarilyAddCheckerIndex(args map[string]any) (map[string]any, func()) {
 * 	if args == nil {
 * 		args = map[string]any{}
 * 	}
 *
 * 	previous, hadPrevious := args["checkerId"]
 * 	args["checkerId"] = t.checkerIndex
 *
 * 	return args, func() {
 * 		if hadPrevious {
 * 			args["checkerId"] = previous
 * 		} else {
 * 			delete(args, "checkerId")
 * 		}
 * 	}
 * }
 */
export function Tracer_temporarilyAddCheckerIndex(receiver: GoPtr<Tracer>, args: GoMap<string, unknown>): [GoMap<string, unknown>, () => void] {
  if (args === undefined) {
    args = new globalThis.Map<string, unknown>();
  }

  const hadPrevious = args.has("checkerId");
  const previous = args.get("checkerId");
  args.set("checkerId", receiver!.checkerIndex);

  return [args, (): void => {
    if (hadPrevious) {
      args.set("checkerId", previous);
    } else {
      args.delete("checkerId");
    }
  }];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::type::tracedTypeAdapter","kind":"type","status":"implemented","sigHash":"34a478bcd924f0c355cebc624d5dc8b868aed28725c4fac42544c6f374b4b6cd","bodyHash":"7325849dc7b72ee8721061d8e81f4ffc02b20bca841aa9230f982ef65a2cf67a"}
 *
 * Go source:
 * tracedTypeAdapter struct {
 * 	t       *Type
 * 	checker *Checker
 * }
 */
export interface tracedTypeAdapter {
  t: GoPtr<Type>;
  checker: GoPtr<Checker>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"0a8cd138a3f0247ca1d46d94c821fcdf3df1d3a112a09a2af0ee241fa9444790"}
 *
 * Go source:
 * var _ tracing.TracedType = (*tracedTypeAdapter)(nil)
 */
export const __88a6f671_0: TracedType = wrapType(undefined);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.Id","kind":"method","status":"implemented","sigHash":"1b5527e62eddf3209bac5d770df27dc9fd21a153ab2cf9a0163fbeb8ec218011","bodyHash":"243119c609768300ad153d96a1858edd0c54b28fb824be1cf41a626d1a2eedb5"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) Id() uint32 {
 * 	return uint32(a.t.id)
 * }
 */
export function tracedTypeAdapter_Id(receiver: GoPtr<tracedTypeAdapter>): uint {
  return receiver!.t!.id as uint;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.FormatFlags","kind":"method","status":"implemented","sigHash":"bc489d05b88aa7f8c0669457f5d8f489d759627319e78015cea7e72b818e0824","bodyHash":"54fde1926b7bec59677eb58364719cf68f7a06c4647060650f16520a1f090cf4"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) FormatFlags() []string {
 * 	return FormatTypeFlags(a.t.flags)
 * }
 */
export function tracedTypeAdapter_FormatFlags(receiver: GoPtr<tracedTypeAdapter>): GoSlice<string> {
  return FormatTypeFlags(receiver!.t!.flags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IsConditional","kind":"method","status":"implemented","sigHash":"972ccb385f456915d0de9903fe0a4801e55811365d0e7790631575f1809f714e","bodyHash":"1084565c0936689e1a2a6ab2a51801028bfb9d98493fe3345e07fbe8034fc2a0"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IsConditional() bool {
 * 	return a.t.flags&TypeFlagsConditional != 0
 * }
 */
export function tracedTypeAdapter_IsConditional(receiver: GoPtr<tracedTypeAdapter>): bool {
  return (receiver!.t!.flags & TypeFlagsConditional) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.Symbol","kind":"method","status":"implemented","sigHash":"b51146f3892acbdd9fd69c53e74af07ec3e43aa3f0d2817d34f812d48483194e","bodyHash":"3c72ee447e582875fd0a0de33f5e9a8b4295322e7484645abc7c946cf732579b"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) Symbol() *ast.Symbol {
 * 	return a.t.symbol
 * }
 */
export function tracedTypeAdapter_Symbol(receiver: GoPtr<tracedTypeAdapter>): GoPtr<Symbol_0b94c68b> {
  return receiver!.t!.symbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.AliasSymbol","kind":"method","status":"implemented","sigHash":"ace03b48f58dc3cb075aea0e007fe23d99b00fea01c0de1c19b6d4a524f1641d","bodyHash":"5ce9e9dae7fb1cbbd3ba512404b9c92f73a87402a5230a8e82c6822d79030442"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) AliasSymbol() *ast.Symbol {
 * 	if a.t.alias == nil {
 * 		return nil
 * 	}
 * 	return a.t.alias.Symbol()
 * }
 */
export function tracedTypeAdapter_AliasSymbol(receiver: GoPtr<tracedTypeAdapter>): GoPtr<Symbol_0b94c68b> {
  if (receiver!.t!.alias === undefined) {
    return undefined;
  }
  return TypeAlias_Symbol(receiver!.t!.alias);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.AliasTypeArguments","kind":"method","status":"implemented","sigHash":"62d2064ceb975d246b1a6b49dc7f0514684121d490739a5a044117358114e4df","bodyHash":"c30b083c8532b102080cc0ed6cb97da15216f4077ddbdcb34b8ce7002031d6d6"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) AliasTypeArguments() []tracing.TracedType {
 * 	if a.t.alias == nil {
 * 		return nil
 * 	}
 * 	return wrapTypes(a.t.alias.TypeArguments())
 * }
 */
export function tracedTypeAdapter_AliasTypeArguments(receiver: GoPtr<tracedTypeAdapter>): GoSlice<TracedType> {
  if (receiver!.t!.alias === undefined) {
    return [];
  }
  return wrapTypes(TypeAlias_TypeArguments(receiver!.t!.alias));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IntrinsicName","kind":"method","status":"implemented","sigHash":"ecee283a6202a3a142a05e8c098f2b484f67e24dfe8a25cb7a6d4f486cf065e7","bodyHash":"42826a7f25e0bd990cecee26d92d3abefae22b60729919a4c226c538eb2fbf22"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IntrinsicName() string {
 * 	if a.t.flags&TypeFlagsIntrinsic == 0 {
 * 		return ""
 * 	}
 * 	data, ok := a.t.data.(*IntrinsicType)
 * 	if !ok {
 * 		return ""
 * 	}
 * 	return data.intrinsicName
 * }
 */
export function tracedTypeAdapter_IntrinsicName(receiver: GoPtr<tracedTypeAdapter>): string {
  if ((receiver!.t!.flags & TypeFlagsIntrinsic) === 0) {
    return "";
  }
  const data = receiver!.t!.data[goReceiverKey] as GoPtr<IntrinsicType>;
  if (data === undefined) {
    return "";
  }
  return data.intrinsicName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.UnionTypes","kind":"method","status":"implemented","sigHash":"65a3fa55c87b1390db75843d555e44e5f3dd0d92b83bfa8e58efff474db45e0f","bodyHash":"20a19dd0ecf6024c7c19d4183daff7cc15cca52d585ff1fa34c26a73be068adb"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) UnionTypes() []tracing.TracedType {
 * 	if a.t.flags&TypeFlagsUnion == 0 {
 * 		return nil
 * 	}
 * 	return wrapTypes(a.t.AsUnionType().types)
 * }
 */
export function tracedTypeAdapter_UnionTypes(receiver: GoPtr<tracedTypeAdapter>): GoSlice<TracedType> {
  if ((receiver!.t!.flags & TypeFlagsUnion) === 0) {
    return [];
  }
  return wrapTypes(Type_AsUnionOrIntersectionType(receiver!.t)!.types);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IntersectionTypes","kind":"method","status":"implemented","sigHash":"3c20096ee6093c6e875ac9431bcc3c72a9f9365b1c7a99fcbf9a6ba66b977ada","bodyHash":"67217fae6670b23aca212a186fc16393493925275ebe0b4657d0546e2875a48c"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IntersectionTypes() []tracing.TracedType {
 * 	if a.t.flags&TypeFlagsIntersection == 0 {
 * 		return nil
 * 	}
 * 	return wrapTypes(a.t.AsIntersectionType().types)
 * }
 */
export function tracedTypeAdapter_IntersectionTypes(receiver: GoPtr<tracedTypeAdapter>): GoSlice<TracedType> {
  if ((receiver!.t!.flags & TypeFlagsIntersection) === 0) {
    return [];
  }
  return wrapTypes(Type_AsUnionOrIntersectionType(receiver!.t)!.types);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IndexType","kind":"method","status":"implemented","sigHash":"061fa36913b5f12069e009b089d7441c25809bf473e65c6a0ca68cd467f2915d","bodyHash":"6bf5f8a0d1ccc55199cfd7d46e8dd4cf62c8547a73211385de471ad2f068af4b"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IndexType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsIndex == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsIndexType().target
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_IndexType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsIndex) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsIndexType(receiver!.t)!.target;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IndexedAccessObjectType","kind":"method","status":"implemented","sigHash":"f0b10117665c8e6367ff6949fb15e5bca77bd6f5cf7dbe442ad9d0e005c9ab46","bodyHash":"55198171ba6ea8b8e1e02cf4add23aad8286fd740853fb8fea4d50937dbf4ddf"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IndexedAccessObjectType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsIndexedAccess == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsIndexedAccessType().objectType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_IndexedAccessObjectType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsIndexedAccess) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsIndexedAccessType(receiver!.t)!.objectType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IndexedAccessIndexType","kind":"method","status":"implemented","sigHash":"1dc0ed3e6f957b5cded4163468478d4be50cd76fc79754ea2fa06755d776b25b","bodyHash":"31362fe5da9ad8208e85050d07bcec825d01ce2349ae47765cf4532e26908019"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IndexedAccessIndexType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsIndexedAccess == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsIndexedAccessType().indexType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_IndexedAccessIndexType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsIndexedAccess) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsIndexedAccessType(receiver!.t)!.indexType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ConditionalCheckType","kind":"method","status":"implemented","sigHash":"73b090c249fb0caf47d61366be098a61e8ac832f422724c229de7a4790a19459","bodyHash":"dd518dce451adadb34d9c00cf1e5645a95ae8cebb2c2116c18456b3368918e8c"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ConditionalCheckType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsConditional == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsConditionalType().checkType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ConditionalCheckType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsConditional) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsConditionalType(receiver!.t)!.checkType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ConditionalExtendsType","kind":"method","status":"implemented","sigHash":"b1d81bea74e82b63f78111d2bed446ec08ce1b3b09e4ee0eb7c6aad4d1f137df","bodyHash":"98157c279df40ba44eb1d01f1f35ac3b8313f905ba5751bd14a22075617cb341"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ConditionalExtendsType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsConditional == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsConditionalType().extendsType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ConditionalExtendsType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsConditional) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsConditionalType(receiver!.t)!.extendsType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ConditionalTrueType","kind":"method","status":"implemented","sigHash":"d34acd5a5f94325dcf848c03154dc8077c5612dd4988264fd17edcb42b8efe6a","bodyHash":"d851a9bf1d0f5819c06f4cd1f46d6cfa50bc30aa9548e96b0ead8800dc864597"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ConditionalTrueType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsConditional == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsConditionalType().resolvedTrueType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ConditionalTrueType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsConditional) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsConditionalType(receiver!.t)!.resolvedTrueType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ConditionalFalseType","kind":"method","status":"implemented","sigHash":"ae712b8108ba006b8749bb9cd40f370371925540e880e3c5993daa513929aebd","bodyHash":"498abf923d8bece6b5e32066588188a0904d2fcf4aea1d939806d6ff27ee708f"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ConditionalFalseType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsConditional == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsConditionalType().resolvedFalseType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ConditionalFalseType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsConditional) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsConditionalType(receiver!.t)!.resolvedFalseType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.SubstitutionBaseType","kind":"method","status":"implemented","sigHash":"89c0d978606c446ae0e067f29423b42d8c0374e762d7075ba17a684f1ef6f53f","bodyHash":"493d92bf31c15b826051b6a3b15c8ffb3bddbd992c0dc919a7402be30c65d83e"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) SubstitutionBaseType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsSubstitution == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsSubstitutionType().baseType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_SubstitutionBaseType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsSubstitution) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsSubstitutionType(receiver!.t)!.baseType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.SubstitutionConstraintType","kind":"method","status":"implemented","sigHash":"fc4dd6291ad86742e7f38e20dd298c17956c0d51c7955eec9fe32159fa8405f1","bodyHash":"8f10a8dc00a3630b54cfc0aafda659b6da23116be8915210b54e6c03df6afe65"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) SubstitutionConstraintType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsSubstitution == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsSubstitutionType().constraint
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_SubstitutionConstraintType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsSubstitution) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsSubstitutionType(receiver!.t)!.constraint;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReferenceTarget","kind":"method","status":"implemented","sigHash":"d84c09b4f7badd37f8d74a9db1b26c6f75e6b03276c12cc8cf7b0f08f65377ab","bodyHash":"a51fc2474e7b6b01f2078cb27b9d1cc903b3922b7e3a59533d0939c399d19205"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReferenceTarget() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReference == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsTypeReference().target
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ReferenceTarget(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReference) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_Target(receiver!.t);
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReferenceTypeArguments","kind":"method","status":"implemented","sigHash":"4e448c44bd82775ca95cbb3b4f3b4ca50d36ac73282bdffc3e7e17dc3e0432ed","bodyHash":"f7ccba33dc6295a8e4667c05bf2a79226ce66159f36a4b067cb89c47a97a9f71"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReferenceTypeArguments() []tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReference == 0 {
 * 		return nil
 * 	}
 * 	return wrapTypes(a.t.AsTypeReference().resolvedTypeArguments)
 * }
 */
export function tracedTypeAdapter_ReferenceTypeArguments(receiver: GoPtr<tracedTypeAdapter>): GoSlice<TracedType> {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReference) === 0) {
    return [];
  }
  return wrapTypes(Type_AsTypeReference(receiver!.t)!.resolvedTypeArguments);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReferenceNode","kind":"method","status":"implemented","sigHash":"9cd4a06aa03d674b5ac3688460765910c0bdfa2fee5c37250ce3b606c6a487cd","bodyHash":"b77a5b64f4ab6f4aa01381232c590e822fdb44397b4d84edee5cabcc9c6cae10"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReferenceNode() *ast.Node {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReference == 0 {
 * 		return nil
 * 	}
 * 	return a.t.AsTypeReference().node
 * }
 */
export function tracedTypeAdapter_ReferenceNode(receiver: GoPtr<tracedTypeAdapter>): GoPtr<Node> {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReference) === 0) {
    return undefined;
  }
  return Type_AsTypeReference(receiver!.t)!.node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReverseMappedSourceType","kind":"method","status":"implemented","sigHash":"e4e3981fc5eb8e887dee9f0137a12f0262e0a081b868cacebccd8b87e559cb70","bodyHash":"eefb8feeab4ca501f1cc1cd67772414e698e25ad97f255fb5fc17a7d5dc76320"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReverseMappedSourceType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReverseMapped == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsReverseMappedType().source
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ReverseMappedSourceType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReverseMapped) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsReverseMappedType(receiver!.t)!.source;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReverseMappedMappedType","kind":"method","status":"implemented","sigHash":"56019ce52de2c19d288944a645c9c591aecabb88038d0ca41132d7293bb25ea1","bodyHash":"c63fc3cbe88260413a5d613f7c93bf1851113cde23306a796bc9a36388b56845"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReverseMappedMappedType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReverseMapped == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsReverseMappedType().mappedType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ReverseMappedMappedType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReverseMapped) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsReverseMappedType(receiver!.t)!.mappedType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.ReverseMappedConstraintType","kind":"method","status":"implemented","sigHash":"55323d101b6409473b3e11786d0df89162b4ea81590f65dff2d491a7c0345c44","bodyHash":"f92d69ba7bfacc8bfb91664f85cff0d383ca30db1b00d9bbb7812428cc31c7f3"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) ReverseMappedConstraintType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsReverseMapped == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsReverseMappedType().constraintType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_ReverseMappedConstraintType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsReverseMapped) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsReverseMappedType(receiver!.t)!.constraintType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.EvolvingArrayElementType","kind":"method","status":"implemented","sigHash":"d8b11b0967f6a4214bb28e21339ed6acec13f4f5ddeb619cafb15bd0d93a1245","bodyHash":"1ac06fed66ccf37574e1c0c8275b6adc42837c09ec6642a5a9436ace437fb4aa"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) EvolvingArrayElementType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsEvolvingArray == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsEvolvingArrayType().elementType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_EvolvingArrayElementType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsEvolvingArray) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsEvolvingArrayType(receiver!.t)!.elementType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.EvolvingArrayFinalType","kind":"method","status":"implemented","sigHash":"ec77aa89254d64eaa37119c25192c092c5e217e8401e46d2c1dce2e3b8ab81d8","bodyHash":"d28868fca2ac7168fa93bb1367407700d5c7523ed1d02cb796f48c7893e6aeb8"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) EvolvingArrayFinalType() tracing.TracedType {
 * 	if a.t.flags&TypeFlagsObject == 0 || a.t.objectFlags&ObjectFlagsEvolvingArray == 0 {
 * 		return nil
 * 	}
 * 	t := a.t.AsEvolvingArrayType().finalArrayType
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return wrapType(t)
 * }
 */
export function tracedTypeAdapter_EvolvingArrayFinalType(receiver: GoPtr<tracedTypeAdapter>): TracedType {
  if ((receiver!.t!.flags & TypeFlagsObject) === 0 || (receiver!.t!.objectFlags & ObjectFlagsEvolvingArray) === 0) {
    return undefined as unknown as TracedType;
  }
  const t = Type_AsEvolvingArrayType(receiver!.t)!.finalArrayType;
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  return wrapType(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.IsTuple","kind":"method","status":"implemented","sigHash":"1623ceb2917cca03a230b494c21dc6edb54a78b7503e132b05b9dbb06f11e400","bodyHash":"f4808902d6b3d3f599bfd2a132e8809f11b4e7cc95eafce397e68f2a5a370d49"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) IsTuple() bool {
 * 	return a.t.objectFlags&ObjectFlagsTuple != 0
 * }
 */
export function tracedTypeAdapter_IsTuple(receiver: GoPtr<tracedTypeAdapter>): bool {
  return (receiver!.t!.objectFlags & ObjectFlagsTuple) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.Pattern","kind":"method","status":"implemented","sigHash":"5813595b9dbb732433c5f2cc0ebc9c9dcd9adb5d086d63d4ae64e92dd98e082b","bodyHash":"35a8865864897f520750b936612b5af12b594bce4b76a720db24709f586cab95"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) Pattern() *ast.Node {
 * 	if a.checker == nil {
 * 		return nil
 * 	}
 * 	return a.checker.patternForType[a.t]
 * }
 */
export function tracedTypeAdapter_Pattern(receiver: GoPtr<tracedTypeAdapter>): GoPtr<Node> {
  if (receiver!.checker === undefined) {
    return undefined;
  }
  return receiver!.checker!.patternForType.get(receiver!.t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.RecursionIdentity","kind":"method","status":"implemented","sigHash":"51d3dfadce1a6acf5751398e7d5a43d13742cad1b70643523ad6948a9e5c31cc","bodyHash":"ff9a1c29a53016adc4ba3449a60979603d0527ccd61041a37c6b8d2ae23b3d72"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) RecursionIdentity() any {
 * 	return getRecursionIdentity(a.t).value
 * }
 */
export function tracedTypeAdapter_RecursionIdentity(receiver: GoPtr<tracedTypeAdapter>): unknown {
  return getRecursionIdentity(receiver!.t).value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::method::tracedTypeAdapter.Display","kind":"method","status":"implemented","sigHash":"9645e1e422c95990ec89e943b97aa0b2bcdd5f513773da7436423adb435a5d34","bodyHash":"6939fa39a4abb4f53a1e43b1ad0fa197171a1446d1d45e9a2db2e16e4c1241e7"}
 *
 * Go source:
 * func (a *tracedTypeAdapter) Display() string {
 * 	// Compute display text for types where it's valuable for trace analysis.
 * 	// TypeScript only does this for Anonymous|Literal types, but we extend to
 * 	// unions, intersections, and template literals since they often lack
 * 	// firstDeclaration and the display text helps identify them.
 * 	// Incomplete types during tracing can cause panics, which we intentionally
 * 	// suppress (returning ""), matching TypeScript's try/catch around typeToString.
 * 	if a.checker == nil {
 * 		return ""
 * 	}
 * 	if a.t.objectFlags&ObjectFlagsAnonymous != 0 ||
 * 		a.t.flags&(TypeFlagsLiteral|TypeFlagsTemplateLiteral|TypeFlagsUnion|TypeFlagsIntersection) != 0 {
 * 		defer func() {
 * 			_ = recover()
 * 		}()
 * 		return a.checker.TypeToString(a.t)
 * 	}
 * 	return ""
 * }
 */
export function tracedTypeAdapter_Display(receiver: GoPtr<tracedTypeAdapter>): string {
  if (receiver!.checker === undefined) {
    return "";
  }
  if (
    (receiver!.t!.objectFlags & ObjectFlagsAnonymous) !== 0 ||
    (receiver!.t!.flags & (TypeFlagsLiteral | TypeFlagsTemplateLiteral | TypeFlagsUnion | TypeFlagsIntersection)) !== 0
  ) {
    try {
      return Checker_TypeToString(receiver!.checker, receiver!.t);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::func::wrapType","kind":"func","status":"implemented","sigHash":"673f6ede962d971ab2e52ad2e5dfe5a09abaf2e946cb9c074d271364cdfe6cf9","bodyHash":"1d61c7f555ef60d88dfbd3927333c434e2c6b18738655b058f1896f6a8ebcce4"}
 *
 * Go source:
 * func wrapType(t *Type) tracing.TracedType {
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	return &tracedTypeAdapter{t: t, checker: t.checker}
 * }
 */
export function wrapType(t: GoPtr<Type>): TracedType {
  if (t === undefined) {
    return undefined as unknown as TracedType;
  }
  const a: tracedTypeAdapter = { t, checker: t.checker };
  return {
    Id: () => tracedTypeAdapter_Id(a),
    FormatFlags: () => tracedTypeAdapter_FormatFlags(a),
    IsConditional: () => tracedTypeAdapter_IsConditional(a),
    Symbol: () => tracedTypeAdapter_Symbol(a),
    AliasSymbol: () => tracedTypeAdapter_AliasSymbol(a),
    AliasTypeArguments: () => tracedTypeAdapter_AliasTypeArguments(a),
    IntrinsicName: () => tracedTypeAdapter_IntrinsicName(a),
    UnionTypes: () => tracedTypeAdapter_UnionTypes(a),
    IntersectionTypes: () => tracedTypeAdapter_IntersectionTypes(a),
    IndexType: () => tracedTypeAdapter_IndexType(a),
    IndexedAccessObjectType: () => tracedTypeAdapter_IndexedAccessObjectType(a),
    IndexedAccessIndexType: () => tracedTypeAdapter_IndexedAccessIndexType(a),
    ConditionalCheckType: () => tracedTypeAdapter_ConditionalCheckType(a),
    ConditionalExtendsType: () => tracedTypeAdapter_ConditionalExtendsType(a),
    ConditionalTrueType: () => tracedTypeAdapter_ConditionalTrueType(a),
    ConditionalFalseType: () => tracedTypeAdapter_ConditionalFalseType(a),
    SubstitutionBaseType: () => tracedTypeAdapter_SubstitutionBaseType(a),
    SubstitutionConstraintType: () => tracedTypeAdapter_SubstitutionConstraintType(a),
    ReferenceTarget: () => tracedTypeAdapter_ReferenceTarget(a),
    ReferenceTypeArguments: () => tracedTypeAdapter_ReferenceTypeArguments(a),
    ReferenceNode: () => tracedTypeAdapter_ReferenceNode(a),
    ReverseMappedSourceType: () => tracedTypeAdapter_ReverseMappedSourceType(a),
    ReverseMappedMappedType: () => tracedTypeAdapter_ReverseMappedMappedType(a),
    ReverseMappedConstraintType: () => tracedTypeAdapter_ReverseMappedConstraintType(a),
    EvolvingArrayElementType: () => tracedTypeAdapter_EvolvingArrayElementType(a),
    EvolvingArrayFinalType: () => tracedTypeAdapter_EvolvingArrayFinalType(a),
    IsTuple: () => tracedTypeAdapter_IsTuple(a),
    Pattern: () => tracedTypeAdapter_Pattern(a),
    RecursionIdentity: () => tracedTypeAdapter_RecursionIdentity(a),
    Display: () => tracedTypeAdapter_Display(a),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/tracer.go::func::wrapTypes","kind":"func","status":"implemented","sigHash":"a7a48083636465ed8135b4dceded96b04ebaef7887f6ad3226e1285c5cdb0321","bodyHash":"ac7e4c51df3042fe2d53999ab880db430096d92d5091eecc436dddbd04cfcd55"}
 *
 * Go source:
 * func wrapTypes(types []*Type) []tracing.TracedType {
 * 	if len(types) == 0 {
 * 		return nil
 * 	}
 * 	result := make([]tracing.TracedType, len(types))
 * 	for i, t := range types {
 * 		result[i] = wrapType(t)
 * 	}
 * 	return result
 * }
 */
export function wrapTypes(types: GoSlice<GoPtr<Type>>): GoSlice<TracedType> {
  if (types.length === 0) {
    return [];
  }
  const result: TracedType[] = new Array(types.length);
  for (let i = 0; i < types.length; i++) {
    result[i] = wrapType(types[i]);
  }
  return result;
}
