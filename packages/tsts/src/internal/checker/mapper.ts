import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { goReceiverKey } from "../ast/spine.js";
import type { GoInterfaceValue } from "../ast/spine.js";
import * as core from "../core/core.js";
import type { Checker, InferenceContext, InferenceInfo } from "./checker/state.js";
import { Checker_instantiateType } from "./checker/types.js";
import {
  Checker_getInferredType,
  Checker_inferFromIntraExpressionSites,
  clearCachedInferences,
} from "./inference.js";
import type { Type } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::TypeMapperKind","kind":"type","status":"implemented","sigHash":"3af927afc5f2ac6455d13aa4237799729a777fd4ef0b1bc582578d482edf0cb5","bodyHash":"93afd4209ed7acb0c7063285beb2cccdf1426ddedee7dce25c71f2770bdc60d2"}
 *
 * Go source:
 * TypeMapperKind int32
 */
export type TypeMapperKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::constGroup::TypeMapperKindUnknown+TypeMapperKindSimple+TypeMapperKindArray+TypeMapperKindMerged","kind":"constGroup","status":"implemented","sigHash":"ec220be11f26d6b55aeb8a72068401049ca70779df83f9902ee20f88efb1bb9c","bodyHash":"c524a031c83442b5f28749df1fe47bec2d064d3a8252ace149adcd6bf368f246"}
 *
 * Go source:
 * const (
 * 	TypeMapperKindUnknown TypeMapperKind = iota
 * 	TypeMapperKindSimple
 * 	TypeMapperKindArray
 * 	TypeMapperKindMerged
 * )
 */
export const TypeMapperKindUnknown: TypeMapperKind = 0;
export const TypeMapperKindSimple: TypeMapperKind = 1;
export const TypeMapperKindArray: TypeMapperKind = 2;
export const TypeMapperKindMerged: TypeMapperKind = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::TypeMapper","kind":"type","status":"implemented","sigHash":"90e4bf6fdf7c4ce34de725c79bc3543feba4982ec367da3c67e25a054e8b1256","bodyHash":"a162d490ad1296cf69f3884f0983d506dfb2e0c4dd1285dedba923a237eaea19"}
 *
 * Go source:
 * TypeMapper struct {
 * 	data TypeMapperData
 * }
 */
export interface TypeMapper {
  data: TypeMapperData;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::TypeMapper.Map","kind":"method","status":"implemented","sigHash":"34cca19ca052c632261295859a6d2716864ada40fcbe544c95a25ac771f7a601","bodyHash":"9713abeb66b61c26ab6e58ebfa59325bba80c70da532f4902af989feec990f90"}
 *
 * Go source:
 * func (m *TypeMapper) Map(t *Type) *Type    { return m.data.Map(t) }
 */
export function TypeMapper_Map(receiver: GoPtr<TypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  return receiver!.data.Map(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::TypeMapper.Kind","kind":"method","status":"implemented","sigHash":"3661f0425c581c3ccb03e97ede91641da8ee4d3384ba6c6b1a5b6392fffaeb29","bodyHash":"0eebebbbc69baaf25b0a7ef5a341b08b438fcab7b49369e5ee757420af4740ff"}
 *
 * Go source:
 * func (m *TypeMapper) Kind() TypeMapperKind { return m.data.Kind() }
 */
export function TypeMapper_Kind(receiver: GoPtr<TypeMapper>): TypeMapperKind {
  return receiver!.data.Kind();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::TypeMapperData","kind":"type","status":"implemented","sigHash":"4649cb141073582297deefb530f542430d796079063ef027818276bd88663ea8","bodyHash":"2eca3e0d6789f5d4a9e42697fc145fec92c7347398a63786f4f7524e6304158a"}
 *
 * Go source:
 * TypeMapperData interface {
 * 	Map(t *Type) *Type
 * 	Kind() TypeMapperKind
 * }
 */
export interface TypeMapperData extends GoInterfaceValue<unknown> {
  Map(t: GoPtr<Type>): GoPtr<Type>;
  Kind(): TypeMapperKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newTypeMapper","kind":"func","status":"implemented","sigHash":"ab1a8786574e9e2a6efb1736947d0240a0af389d42f74134c0537744f2652f78","bodyHash":"40ad9406d71b7da2fa5bb2164113afe203d429eb9e16ee56e158178d3bf92abd"}
 *
 * Go source:
 * func newTypeMapper(sources []*Type, targets []*Type) *TypeMapper {
 * 	if len(sources) == 1 {
 * 		return newSimpleTypeMapper(sources[0], targets[0])
 * 	}
 * 	return newArrayTypeMapper(sources, targets)
 * }
 */
export function newTypeMapper(sources: GoSlice<GoPtr<Type>>, targets: GoSlice<GoPtr<Type>>): GoPtr<TypeMapper> {
  if (sources.length === 1) {
    return newSimpleTypeMapper(sources[0], targets[0]);
  }
  return newArrayTypeMapper(sources, targets);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::Checker.combineTypeMappers","kind":"method","status":"implemented","sigHash":"c7e608de12817475822ba53d18d84f2cc23df1d0f2d81739421f324f904011dc","bodyHash":"d2295de0cf64267f1fd33074b4b4175034b90e1af7aeb94fd6d9847979bde3b9"}
 *
 * Go source:
 * func (c *Checker) combineTypeMappers(m1 *TypeMapper, m2 *TypeMapper) *TypeMapper {
 * 	if m1 != nil {
 * 		return newCompositeTypeMapper(c, m1, m2)
 * 	}
 * 	return m2
 * }
 */
export function Checker_combineTypeMappers(receiver: GoPtr<Checker>, m1: GoPtr<TypeMapper>, m2: GoPtr<TypeMapper>): GoPtr<TypeMapper> {
  if (m1 !== undefined) {
    return newCompositeTypeMapper(receiver, m1, m2);
  }
  return m2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::mergeTypeMappers","kind":"func","status":"implemented","sigHash":"905a90bf89cf85e1ea06f1167c43b3e08d08b0e0b1586b0a1a7bad0c3dc384b5","bodyHash":"243550cf49bfa126aa264aac9fe80d4d249880be226dc0cac36a6b8f16418aae"}
 *
 * Go source:
 * func mergeTypeMappers(m1 *TypeMapper, m2 *TypeMapper) *TypeMapper {
 * 	if m1 != nil {
 * 		return newMergedTypeMapper(m1, m2)
 * 	}
 * 	return m2
 * }
 */
export function mergeTypeMappers(m1: GoPtr<TypeMapper>, m2: GoPtr<TypeMapper>): GoPtr<TypeMapper> {
  if (m1 !== undefined) {
    return newMergedTypeMapper(m1, m2);
  }
  return m2;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::prependTypeMapping","kind":"func","status":"implemented","sigHash":"bce954401dba4cc7b6aef254122b30ce8003b109b5ad5364d4e39ad42f3e1c83","bodyHash":"186b96e723ee18dbd1b21dd5cca4bbbb7f105196d55e39fe2aec49be71006133"}
 *
 * Go source:
 * func prependTypeMapping(source *Type, target *Type, mapper *TypeMapper) *TypeMapper {
 * 	if mapper == nil {
 * 		return newSimpleTypeMapper(source, target)
 * 	}
 * 	return newMergedTypeMapper(newSimpleTypeMapper(source, target), mapper)
 * }
 */
export function prependTypeMapping(source: GoPtr<Type>, target: GoPtr<Type>, mapper: GoPtr<TypeMapper>): GoPtr<TypeMapper> {
  if (mapper === undefined) {
    return newSimpleTypeMapper(source, target);
  }
  return newMergedTypeMapper(newSimpleTypeMapper(source, target), mapper);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::appendTypeMapping","kind":"func","status":"implemented","sigHash":"87a138718099aae17e7a30634edbbb7d5da5918fd4732a87e0188a9c3d9f37c5","bodyHash":"d5472e7428043dda317698f1fd05286d04cd00f720aea7ed822d43a359b2f27d"}
 *
 * Go source:
 * func appendTypeMapping(mapper *TypeMapper, source *Type, target *Type) *TypeMapper {
 * 	if mapper == nil {
 * 		return newSimpleTypeMapper(source, target)
 * 	}
 * 	return newMergedTypeMapper(mapper, newSimpleTypeMapper(source, target))
 * }
 */
export function appendTypeMapping(mapper: GoPtr<TypeMapper>, source: GoPtr<Type>, target: GoPtr<Type>): GoPtr<TypeMapper> {
  if (mapper === undefined) {
    return newSimpleTypeMapper(source, target);
  }
  return newMergedTypeMapper(mapper, newSimpleTypeMapper(source, target));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::Checker.newBackreferenceMapper","kind":"method","status":"implemented","sigHash":"11c1baefefb363b4b5ca1b02ccff73260bf5bd94c4c742c967e0bd836f7cf070","bodyHash":"95ab4882724fb7ed1a78c1f713ad442f670fe7cbd15c205714181c374957d04a"}
 *
 * Go source:
 * func (c *Checker) newBackreferenceMapper(context *InferenceContext, index int) *TypeMapper {
 * 	forwardInferences := context.inferences[index:]
 * 	typeParameters := core.Map(forwardInferences, func(i *InferenceInfo) *Type {
 * 		return i.typeParameter
 * 	})
 * 	return newArrayToSingleTypeMapper(typeParameters, c.unknownType)
 * }
 */
export function Checker_newBackreferenceMapper(receiver: GoPtr<Checker>, context: GoPtr<InferenceContext>, index: int): GoPtr<TypeMapper> {
  const forwardInferences = context!.inferences.slice(index);
  const typeParameters = core.Map(forwardInferences, (i: GoPtr<InferenceInfo>): GoPtr<Type> => {
    return i!.typeParameter;
  });
  return newArrayToSingleTypeMapper(typeParameters, receiver!.unknownType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::TypeMapperBase","kind":"type","status":"implemented","sigHash":"8b504be7d37edb9902a39d0b4c68d2efc9fa732cd53914fd659b6b961e5ac1fa","bodyHash":"204d6d2ba55d9a30cd266f2af45f123ab91a66d75868ae2df1d5294673b9c323"}
 *
 * Go source:
 * TypeMapperBase struct {
 * 	TypeMapper
 * }
 */
export interface TypeMapperBase {
  readonly __tsgoEmbedded0?: TypeMapper;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::TypeMapperBase.Map","kind":"method","status":"implemented","sigHash":"97eb9b7781290c28a86b7ebc1931cb8b1f13a84e79a9e51967728cf03caafc9b","bodyHash":"224b37780bea84b28564143c2c914c321b051e2259b5ddcd4db1e267abb80b32"}
 *
 * Go source:
 * func (m *TypeMapperBase) Map(t *Type) *Type    { return t }
 */
export function TypeMapperBase_Map(receiver: GoPtr<TypeMapperBase>, t: GoPtr<Type>): GoPtr<Type> {
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::TypeMapperBase.Kind","kind":"method","status":"implemented","sigHash":"d07ef427c8f62e3c919c0ee019deb6d96ef181c0069f0cbf1b42bb7d14781746","bodyHash":"6ac69ade6acbf25218f766bbaac8c4b8640876510ec60b62142a556e94f521ae"}
 *
 * Go source:
 * func (m *TypeMapperBase) Kind() TypeMapperKind { return TypeMapperKindUnknown }
 */
export function TypeMapperBase_Kind(receiver: GoPtr<TypeMapperBase>): TypeMapperKind {
  return TypeMapperKindUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::SimpleTypeMapper","kind":"type","status":"implemented","sigHash":"18f1b0f031cf526f482f5b0052883312586c7d7bc59f979e5beddb717cc022a1","bodyHash":"85cfca898955cc7df26c9dadd16046fe02020f4903f1fca381cf5edfd4f6a23d"}
 *
 * Go source:
 * SimpleTypeMapper struct {
 * 	TypeMapperBase
 * 	source *Type
 * 	target *Type
 * }
 */
export interface SimpleTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  source: GoPtr<Type>;
  target: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newSimpleTypeMapper","kind":"func","status":"implemented","sigHash":"39a7a236196fa727dcebaed1f01dd5d908540788294fe84b67ca9cf127d94688","bodyHash":"00aead9affdbdd4a7e6f0680401a7c309759b6c7d873e63f8f059e8314b31352"}
 *
 * Go source:
 * func newSimpleTypeMapper(source *Type, target *Type) *TypeMapper {
 * 	m := &SimpleTypeMapper{}
 * 	m.data = m
 * 	m.source = source
 * 	m.target = target
 * 	return &m.TypeMapper
 * }
 */
export function newSimpleTypeMapper(source: GoPtr<Type>, target: GoPtr<Type>): GoPtr<TypeMapper> {
  const m: SimpleTypeMapper = {
    source: source,
    target: target,
  };
  return { data: SimpleTypeMapper_as_TypeMapperData(m) };
}

function SimpleTypeMapper_as_TypeMapperData(receiver: GoPtr<SimpleTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => SimpleTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => SimpleTypeMapper_Kind(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::SimpleTypeMapper.Map","kind":"method","status":"implemented","sigHash":"c2d59c1f389a784ce8086b3ebef20f0dd6d13dbfeb37382d538fe460e2189bf0","bodyHash":"cc314c8c24ba8f393c3a4a3555074965c494c17d4df4a9d2f99980a5f7399c3f"}
 *
 * Go source:
 * func (m *SimpleTypeMapper) Map(t *Type) *Type {
 * 	if t == m.source {
 * 		return m.target
 * 	}
 * 	return t
 * }
 */
export function SimpleTypeMapper_Map(receiver: GoPtr<SimpleTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  if (t === receiver!.source) {
    return receiver!.target;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::SimpleTypeMapper.Kind","kind":"method","status":"implemented","sigHash":"028f84fe60ac5e57e29264a2a5db1360f3b23881c8d48a17a4dbe743eaa9dbd6","bodyHash":"98d5b35c12d0636d0938a8d971f129fbb3a8487720053a042c93bb0f3f3eb837"}
 *
 * Go source:
 * func (m *SimpleTypeMapper) Kind() TypeMapperKind {
 * 	return TypeMapperKindSimple
 * }
 */
export function SimpleTypeMapper_Kind(receiver: GoPtr<SimpleTypeMapper>): TypeMapperKind {
  return TypeMapperKindSimple;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::ArrayTypeMapper","kind":"type","status":"implemented","sigHash":"39cee8f8a64e6e65a09d7c3ca6ca7ea371b4bca7ed91545ced3207204af66b61","bodyHash":"79137dedbeca1f796334d3023832b77509bb8c1ee65835e69c3f4b4d72c6616e"}
 *
 * Go source:
 * ArrayTypeMapper struct {
 * 	TypeMapperBase
 * 	sources []*Type
 * 	targets []*Type
 * }
 */
export interface ArrayTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  sources: GoSlice<GoPtr<Type>>;
  targets: GoSlice<GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newArrayTypeMapper","kind":"func","status":"implemented","sigHash":"5af187ba0d403d01152b1047b41c77e2bfbe4d9f1b6b5ff47dd0f16e3df7a9c5","bodyHash":"f7a235f59a818733fa660f6a199d65b2a42398d770a4d8bb810342824bd1b50e"}
 *
 * Go source:
 * func newArrayTypeMapper(sources []*Type, targets []*Type) *TypeMapper {
 * 	m := &ArrayTypeMapper{}
 * 	m.data = m
 * 	m.sources = sources
 * 	m.targets = targets
 * 	return &m.TypeMapper
 * }
 */
export function newArrayTypeMapper(sources: GoSlice<GoPtr<Type>>, targets: GoSlice<GoPtr<Type>>): GoPtr<TypeMapper> {
  const m: ArrayTypeMapper = {
    sources: sources,
    targets: targets,
  };
  return { data: ArrayTypeMapper_as_TypeMapperData(m) };
}

function ArrayTypeMapper_as_TypeMapperData(receiver: GoPtr<ArrayTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => ArrayTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => ArrayTypeMapper_Kind(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::ArrayTypeMapper.Map","kind":"method","status":"implemented","sigHash":"1907b42a4ad2c1aeb2037fa99dae183552f345dc4bdd8001a9fe974fcb5c3ca1","bodyHash":"06a56d8fd1651467c1cea7397cc0f70c3500f26a7b773f19148f5d93ccee579d"}
 *
 * Go source:
 * func (m *ArrayTypeMapper) Map(t *Type) *Type {
 * 	for i, s := range m.sources {
 * 		if t == s {
 * 			return m.targets[i]
 * 		}
 * 	}
 * 	return t
 * }
 */
export function ArrayTypeMapper_Map(receiver: GoPtr<ArrayTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  for (let i = 0; i < receiver!.sources.length; i++) {
    const s = receiver!.sources[i];
    if (t === s) {
      return receiver!.targets[i];
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::ArrayTypeMapper.Kind","kind":"method","status":"implemented","sigHash":"5fd27e4f543c4ee5938b7ab83a76039767614c175d6f940635badc9c30ffe139","bodyHash":"a0d057e69f019b9e0c8f7beff7854eb45eae2c25035024256f93504a4b8943b5"}
 *
 * Go source:
 * func (m *ArrayTypeMapper) Kind() TypeMapperKind {
 * 	return TypeMapperKindArray
 * }
 */
export function ArrayTypeMapper_Kind(receiver: GoPtr<ArrayTypeMapper>): TypeMapperKind {
  return TypeMapperKindArray;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::ArrayToSingleTypeMapper","kind":"type","status":"implemented","sigHash":"5870c17a5551518de83f7c7043f22bc62b3222502daa34d7c2c1027650ca5eaf","bodyHash":"9eec27fb902eaea204cc072baa25aa10245fbaf50a878689ae3a2af95a114c2e"}
 *
 * Go source:
 * ArrayToSingleTypeMapper struct {
 * 	TypeMapperBase
 * 	sources []*Type
 * 	target  *Type
 * }
 */
export interface ArrayToSingleTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  sources: GoSlice<GoPtr<Type>>;
  target: GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newArrayToSingleTypeMapper","kind":"func","status":"implemented","sigHash":"66a15be83c8fa3657c7967e96dba9c0699dc618f20567633ca1696b01393f661","bodyHash":"f0c828f420b4a9526de008b05adfb904b5e586e850d821fe3cfc842f97adab9b"}
 *
 * Go source:
 * func newArrayToSingleTypeMapper(sources []*Type, target *Type) *TypeMapper {
 * 	m := &ArrayToSingleTypeMapper{}
 * 	m.data = m
 * 	m.sources = sources
 * 	m.target = target
 * 	return &m.TypeMapper
 * }
 */
export function newArrayToSingleTypeMapper(sources: GoSlice<GoPtr<Type>>, target: GoPtr<Type>): GoPtr<TypeMapper> {
  const m: ArrayToSingleTypeMapper = {
    sources: sources,
    target: target,
  };
  return { data: ArrayToSingleTypeMapper_as_TypeMapperData(m) };
}

function ArrayToSingleTypeMapper_as_TypeMapperData(receiver: GoPtr<ArrayToSingleTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => ArrayToSingleTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => TypeMapperBase_Kind(undefined),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::ArrayToSingleTypeMapper.Map","kind":"method","status":"implemented","sigHash":"9345154b14e179cddad1146c361b8be344b320bb3bd106d33cb04a6692a96388","bodyHash":"461e9f3b1f7e8977ec544e534a6bd2e17b1e832aab7a16e4cf7b6f806ead1cbd"}
 *
 * Go source:
 * func (m *ArrayToSingleTypeMapper) Map(t *Type) *Type {
 * 	if slices.Contains(m.sources, t) {
 * 		return m.target
 * 	}
 * 	return t
 * }
 */
export function ArrayToSingleTypeMapper_Map(receiver: GoPtr<ArrayToSingleTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  if (receiver!.sources.includes(t)) {
    return receiver!.target;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::DeferredTypeMapper","kind":"type","status":"implemented","sigHash":"4a2b5fa0361b3d01ba11d6dd09428acb69f8677589869eccfe9762f113c01274","bodyHash":"a1d2c929d50ac483786ef18d6d12e6ba2021b16477aecfd6e4e3919e8d4e5e1a"}
 *
 * Go source:
 * DeferredTypeMapper struct {
 * 	TypeMapperBase
 * 	sources []*Type
 * 	targets []func() *Type
 * }
 */
export interface DeferredTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  sources: GoSlice<GoPtr<Type>>;
  targets: GoSlice<() => GoPtr<Type>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newDeferredTypeMapper","kind":"func","status":"implemented","sigHash":"2f61952977ac436ca730fb92992033a5aa0fcd9c6dad40caa8c80331c9adcda7","bodyHash":"c0744180b045c488d8029d66d4784e3800de32d163a9760d3a97c0c88d65b2a5"}
 *
 * Go source:
 * func newDeferredTypeMapper(sources []*Type, targets []func() *Type) *TypeMapper {
 * 	m := &DeferredTypeMapper{}
 * 	m.data = m
 * 	m.sources = sources
 * 	m.targets = targets
 * 	return &m.TypeMapper
 * }
 */
export function newDeferredTypeMapper(sources: GoSlice<GoPtr<Type>>, targets: GoSlice<() => GoPtr<Type>>): GoPtr<TypeMapper> {
  const m: DeferredTypeMapper = {
    sources: sources,
    targets: targets,
  };
  return { data: DeferredTypeMapper_as_TypeMapperData(m) };
}

function DeferredTypeMapper_as_TypeMapperData(receiver: GoPtr<DeferredTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => DeferredTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => TypeMapperBase_Kind(undefined),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::DeferredTypeMapper.Map","kind":"method","status":"implemented","sigHash":"d08eb3785ec5de3bae49b0f453e9b0e05f73ff99dcc77b414745b290e5407880","bodyHash":"ce7d2b0b32b3aad70c482c9e8a7b192722c0b04d5f75f95323d3997f454c6f42"}
 *
 * Go source:
 * func (m *DeferredTypeMapper) Map(t *Type) *Type {
 * 	for i, s := range m.sources {
 * 		if t == s {
 * 			return m.targets[i]()
 * 		}
 * 	}
 * 	return t
 * }
 */
export function DeferredTypeMapper_Map(receiver: GoPtr<DeferredTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  for (let i = 0; i < receiver!.sources.length; i++) {
    const s = receiver!.sources[i];
    if (t === s) {
      return receiver!.targets[i]!();
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::FunctionTypeMapper","kind":"type","status":"implemented","sigHash":"637093dbf36c0e8925dbfd749c6a05d986dc6704aa648bfaa0ea06b5c60d9ccf","bodyHash":"644f899b0b29b75e7a293b5aaa166d153f3e82d85be4ef9eba7967e6c9ccabee"}
 *
 * Go source:
 * FunctionTypeMapper struct {
 * 	TypeMapperBase
 * 	fn func(*Type) *Type
 * }
 */
export interface FunctionTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  fn: (arg0: GoPtr<Type>) => GoPtr<Type>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newFunctionTypeMapper","kind":"func","status":"implemented","sigHash":"a7dd317a670447601b6ffb5fb1599bbea45f3b7ad5b2ce931bcf1bdcd478115f","bodyHash":"a7469fc84b29a13319a0426473487d1acc9968658baa4b18f4d2477c7336b64f"}
 *
 * Go source:
 * func newFunctionTypeMapper(fn func(*Type) *Type) *TypeMapper {
 * 	m := &FunctionTypeMapper{}
 * 	m.data = m
 * 	m.fn = fn
 * 	return &m.TypeMapper
 * }
 */
export function newFunctionTypeMapper(fn: (arg0: GoPtr<Type>) => GoPtr<Type>): GoPtr<TypeMapper> {
  const m: FunctionTypeMapper = {
    fn: fn,
  };
  return { data: FunctionTypeMapper_as_TypeMapperData(m) };
}

function FunctionTypeMapper_as_TypeMapperData(receiver: GoPtr<FunctionTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => FunctionTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => TypeMapperBase_Kind(undefined),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::FunctionTypeMapper.Map","kind":"method","status":"implemented","sigHash":"9de49ff090455436d6cec54ae5c06ba405ae04b0809ea90fc53872486e59696a","bodyHash":"176457b9b8ef326ae98535f925bde5e798bd3e44d0381a7c226de1f64b3f92aa"}
 *
 * Go source:
 * func (m *FunctionTypeMapper) Map(t *Type) *Type {
 * 	return m.fn(t)
 * }
 */
export function FunctionTypeMapper_Map(receiver: GoPtr<FunctionTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  return receiver!.fn(t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::MergedTypeMapper","kind":"type","status":"implemented","sigHash":"d35eae76fd24a3e489e1eb01a2085b973dc3d43aa28c6277d4ad6be2d5ca8c84","bodyHash":"c4f341f6ed422a1320f4e2ac71bc3f8a5e7b4d8f2fb6d898ff23eb978f64ecce"}
 *
 * Go source:
 * MergedTypeMapper struct {
 * 	TypeMapperBase
 * 	m1 *TypeMapper
 * 	m2 *TypeMapper
 * }
 */
export interface MergedTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  m1: GoPtr<TypeMapper>;
  m2: GoPtr<TypeMapper>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newMergedTypeMapper","kind":"func","status":"implemented","sigHash":"83908bc9f7bb40a9a061269ad4d33c5cf3e2c8098d846381a48e84cbdea2856b","bodyHash":"c5a22081b4595340ce8b3496f847b4b348064ab47052e8a68cdbf02d494e12f7"}
 *
 * Go source:
 * func newMergedTypeMapper(m1 *TypeMapper, m2 *TypeMapper) *TypeMapper {
 * 	m := &MergedTypeMapper{}
 * 	m.data = m
 * 	m.m1 = m1
 * 	m.m2 = m2
 * 	return &m.TypeMapper
 * }
 */
export function newMergedTypeMapper(m1: GoPtr<TypeMapper>, m2: GoPtr<TypeMapper>): GoPtr<TypeMapper> {
  const m: MergedTypeMapper = {
    m1: m1,
    m2: m2,
  };
  return { data: MergedTypeMapper_as_TypeMapperData(m) };
}

function MergedTypeMapper_as_TypeMapperData(receiver: GoPtr<MergedTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => MergedTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => MergedTypeMapper_Kind(receiver),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::MergedTypeMapper.Map","kind":"method","status":"implemented","sigHash":"439ab111a0227f26acf497a42d4030b775d27cd38d3b19dbc245f6c42fa8a52d","bodyHash":"c9b69a9363c9f99f71b134d5925f0fbc91052a67f4550ac554c97e1872e61da3"}
 *
 * Go source:
 * func (m *MergedTypeMapper) Map(t *Type) *Type {
 * 	return m.m2.Map(m.m1.Map(t))
 * }
 */
export function MergedTypeMapper_Map(receiver: GoPtr<MergedTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  return TypeMapper_Map(receiver!.m2, TypeMapper_Map(receiver!.m1, t));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::MergedTypeMapper.Kind","kind":"method","status":"implemented","sigHash":"7a2e8252d27fcb2fabf85d9fc028eae8e57d9219374fef7ce0b9db8d638d2f7e","bodyHash":"65f4ed05315348a0cb372b7cdcf7926f96416772af6358ee0227ce8de1d2aa58"}
 *
 * Go source:
 * func (m *MergedTypeMapper) Kind() TypeMapperKind {
 * 	return TypeMapperKindMerged
 * }
 */
export function MergedTypeMapper_Kind(receiver: GoPtr<MergedTypeMapper>): TypeMapperKind {
  return TypeMapperKindMerged;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::CompositeTypeMapper","kind":"type","status":"implemented","sigHash":"82463f3c39a528806a681a33e8a65c6fe8a7cdecacb7a8fb9c331e32fdb5f276","bodyHash":"8aaefc4071358ab56b978cd27e76fc72292f8be60790012ebf8edcf18edce1bc"}
 *
 * Go source:
 * CompositeTypeMapper struct {
 * 	TypeMapperBase
 * 	c  *Checker
 * 	m1 *TypeMapper
 * 	m2 *TypeMapper
 * }
 */
export interface CompositeTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  c: GoPtr<Checker>;
  m1: GoPtr<TypeMapper>;
  m2: GoPtr<TypeMapper>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::func::newCompositeTypeMapper","kind":"func","status":"implemented","sigHash":"81a346bfb68d6de7b42794caadeae83ebbadd5b58786cf7f09971df434afa105","bodyHash":"4dbf28ffb7d9cc5f78cbec072bfb1a5d83c691d53540d2fe185bb62962fc3942"}
 *
 * Go source:
 * func newCompositeTypeMapper(c *Checker, m1 *TypeMapper, m2 *TypeMapper) *TypeMapper {
 * 	m := &CompositeTypeMapper{}
 * 	m.data = m
 * 	m.c = c
 * 	m.m1 = m1
 * 	m.m2 = m2
 * 	return &m.TypeMapper
 * }
 */
export function newCompositeTypeMapper(c: GoPtr<Checker>, m1: GoPtr<TypeMapper>, m2: GoPtr<TypeMapper>): GoPtr<TypeMapper> {
  const m: CompositeTypeMapper = {
    c: c,
    m1: m1,
    m2: m2,
  };
  return { data: CompositeTypeMapper_as_TypeMapperData(m) };
}

function CompositeTypeMapper_as_TypeMapperData(receiver: GoPtr<CompositeTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => CompositeTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => TypeMapperBase_Kind(undefined),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::CompositeTypeMapper.Map","kind":"method","status":"implemented","sigHash":"31472262f1ecd3a4ab964401a4197eb1b60c222e8defe9e3486888ee44136da8","bodyHash":"efc2af7bd8a5f138575eb06b735f521576b32b39e52e540d11e3d535db61a929"}
 *
 * Go source:
 * func (m *CompositeTypeMapper) Map(t *Type) *Type {
 * 	t1 := m.m1.Map(t)
 * 	if t1 != t {
 * 		return m.c.instantiateType(t1, m.m2)
 * 	}
 * 	return m.m2.Map(t)
 * }
 */
export function CompositeTypeMapper_Map(receiver: GoPtr<CompositeTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  const t1 = TypeMapper_Map(receiver!.m1, t);
  if (t1 !== t) {
    return Checker_instantiateType(receiver!.c, t1, receiver!.m2);
  }
  return TypeMapper_Map(receiver!.m2, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::type::InferenceTypeMapper","kind":"type","status":"implemented","sigHash":"7d0a355fd9feed03a929306d9307d490b52e5851035c6cc3cc4050fe432301bc","bodyHash":"c4e256cd8f6c8041b04c1a167d64caf7269ba4dcd853debcb28792db65b548e9"}
 *
 * Go source:
 * InferenceTypeMapper struct {
 * 	TypeMapperBase
 * 	c      *Checker
 * 	n      *InferenceContext
 * 	fixing bool
 * }
 */
export interface InferenceTypeMapper {
  readonly __tsgoEmbedded0?: TypeMapperBase;
  c: GoPtr<Checker>;
  n: GoPtr<InferenceContext>;
  fixing: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::Checker.newInferenceTypeMapper","kind":"method","status":"implemented","sigHash":"3716c00d10957fcecca6cc19711c10de12b92e89d967997afef446e2f13095e3","bodyHash":"c0ba620077e293194e894c438855506478fe088f0c4126517bfabd595e6139d6"}
 *
 * Go source:
 * func (c *Checker) newInferenceTypeMapper(n *InferenceContext, fixing bool) *TypeMapper {
 * 	m := &InferenceTypeMapper{}
 * 	m.data = m
 * 	m.c = c
 * 	m.n = n
 * 	m.fixing = fixing
 * 	return &m.TypeMapper
 * }
 */
export function Checker_newInferenceTypeMapper(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>, fixing: bool): GoPtr<TypeMapper> {
  const m: InferenceTypeMapper = {
    c: receiver,
    n: n,
    fixing: fixing,
  };
  return { data: InferenceTypeMapper_as_TypeMapperData(m) };
}

function InferenceTypeMapper_as_TypeMapperData(receiver: GoPtr<InferenceTypeMapper>): TypeMapperData {
  return {
    [goReceiverKey]: receiver,
    Map: (t: GoPtr<Type>): GoPtr<Type> => InferenceTypeMapper_Map(receiver, t),
    Kind: (): TypeMapperKind => TypeMapperBase_Kind(undefined),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/mapper.go::method::InferenceTypeMapper.Map","kind":"method","status":"implemented","sigHash":"b7c9bfb110b691524666ba870c54ee1f2abda8b821ceb52deb048247e5886538","bodyHash":"019f6510f9df35058f29f25fdacd1e0685b4285e1367c58d970c6ca1e245d909"}
 *
 * Go source:
 * func (m *InferenceTypeMapper) Map(t *Type) *Type {
 * 	for i, inference := range m.n.inferences {
 * 		if t == inference.typeParameter {
 * 			if m.fixing && !inference.isFixed {
 * 				// Before we commit to a particular inference (and thus lock out any further inferences),
 * 				// we infer from any intra-expression inference sites we have collected.
 * 				m.c.inferFromIntraExpressionSites(m.n)
 * 				clearCachedInferences(m.n.inferences)
 * 				inference.isFixed = true
 * 			}
 * 			return m.c.getInferredType(m.n, i)
 * 		}
 * 	}
 * 	return t
 * }
 */
export function InferenceTypeMapper_Map(receiver: GoPtr<InferenceTypeMapper>, t: GoPtr<Type>): GoPtr<Type> {
  for (let i = 0; i < receiver!.n!.inferences.length; i++) {
    const inference = receiver!.n!.inferences[i];
    if (t === inference!.typeParameter) {
      if (receiver!.fixing && !inference!.isFixed) {
        // Before we commit to a particular inference (and thus lock out any further inferences),
        // we infer from any intra-expression inference sites we have collected.
        Checker_inferFromIntraExpressionSites(receiver!.c, receiver!.n);
        clearCachedInferences(receiver!.n!.inferences);
        inference!.isFixed = true;
      }
      return Checker_getInferredType(receiver!.c, receiver!.n, i);
    }
  }
  return t;
}
