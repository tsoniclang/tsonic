import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { Symbol } from "../ast/symbol.js";
import { type Checker, type InferenceContext, type InferenceFlags, type InferenceInfo, type InferencePriority } from "./checker/state.js";
import type { TypeMapper } from "./mapper.js";
import { type ExpandingFlags } from "./relater.js";
import { type Signature, type SignatureKind, type TemplateLiteralType, type Type, type TypeComparer, type TypeFlags, type TypeId, type VarianceFlags } from "./types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::type::InferenceKey","kind":"type","status":"implemented","sigHash":"b7240472cd57ef405f9a148ef9ec8af6dfa01c094e529face8ce9016e617e024","bodyHash":"b1e72e4107bd9fcb415e0fecb516f373102ceaf03cfcd48800acace853608ffd"}
 *
 * Go source:
 * InferenceKey struct {
 * 	s TypeId
 * 	t TypeId
 * }
 */
export interface InferenceKey {
    s: TypeId;
    t: TypeId;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::type::InferenceState","kind":"type","status":"implemented","sigHash":"0c17beb7f8e5459a0131259e3a6a7159d051e78b01c378567ffc87e9c9348974","bodyHash":"3ef6d6ed84b307d9141888f89100d470e9d34ef4d066accda774781214b3ae42"}
 *
 * Go source:
 * InferenceState struct {
 * 	inferences        []*InferenceInfo
 * 	originalSource    *Type
 * 	originalTarget    *Type
 * 	priority          InferencePriority
 * 	inferencePriority InferencePriority
 * 	contravariant     bool
 * 	bivariant         bool
 * 	expandingFlags    ExpandingFlags
 * 	propagationType   *Type
 * 	visited           map[InferenceKey]InferencePriority
 * 	sourceStack       []*Type
 * 	targetStack       []*Type
 * 	next              *InferenceState
 * }
 */
export interface InferenceState {
    inferences: GoSlice<GoPtr<InferenceInfo>>;
    originalSource: GoPtr<Type>;
    originalTarget: GoPtr<Type>;
    priority: InferencePriority;
    inferencePriority: InferencePriority;
    contravariant: bool;
    bivariant: bool;
    expandingFlags: ExpandingFlags;
    propagationType: GoPtr<Type>;
    visited: GoMap<InferenceKey, InferencePriority>;
    sourceStack: GoSlice<GoPtr<Type>>;
    targetStack: GoSlice<GoPtr<Type>>;
    next: GoPtr<InferenceState>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getInferenceState","kind":"method","status":"implemented","sigHash":"6407cb38ab889d67e0934e6676a2d483e56861fbdb8d46093f81e0ca715afee9","bodyHash":"67db8a99b788bafa7fdd07f8e4f08aa69d13baf1d69fa8d121e1f0de0ef75831"}
 *
 * Go source:
 * func (c *Checker) getInferenceState() *InferenceState {
 * 	n := c.freeinferenceState
 * 	if n == nil {
 * 		n = &InferenceState{}
 * 	}
 * 	c.freeinferenceState = n.next
 * 	return n
 * }
 */
export declare function Checker_getInferenceState(receiver: GoPtr<Checker>): GoPtr<InferenceState>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.putInferenceState","kind":"method","status":"implemented","sigHash":"cc538de524ce9cd90b84b0cd36d0e76d877fee1436f6f4b733ff1719ea01d4b0","bodyHash":"a0cb92ed78e51902eac8b7232ad54e93e91dcd447934f0abec4564f6631b17ae"}
 *
 * Go source:
 * func (c *Checker) putInferenceState(n *InferenceState) {
 * 	clear(n.visited)
 * 	*n = InferenceState{
 * 		inferences:  n.inferences[:0],
 * 		visited:     n.visited,
 * 		sourceStack: n.sourceStack[:0],
 * 		targetStack: n.targetStack[:0],
 * 		next:        c.freeinferenceState,
 * 	}
 * 	c.freeinferenceState = n
 * }
 */
export declare function Checker_putInferenceState(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferTypes","kind":"method","status":"implemented","sigHash":"97566b5023a13225d04eb7cf9b31664d14770ad75c0ac952660dd453378eb545","bodyHash":"719c5a498adf1e0bbf1a484e07321c045b7cc5d60ddf5f9d36923b4ab2e74e5b"}
 *
 * Go source:
 * func (c *Checker) inferTypes(inferences []*InferenceInfo, originalSource *Type, originalTarget *Type, priority InferencePriority, contravariant bool) {
 * 	n := c.getInferenceState()
 * 	n.inferences = inferences
 * 	n.originalSource = originalSource
 * 	n.originalTarget = originalTarget
 * 	n.priority = priority
 * 	n.inferencePriority = InferencePriorityMaxValue
 * 	n.contravariant = contravariant
 * 	c.inferFromTypes(n, originalSource, originalTarget)
 * 	c.putInferenceState(n)
 * }
 */
export declare function Checker_inferTypes(receiver: GoPtr<Checker>, inferences: GoSlice<GoPtr<InferenceInfo>>, originalSource: GoPtr<Type>, originalTarget: GoPtr<Type>, priority: InferencePriority, contravariant: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromTypes","kind":"method","status":"implemented","sigHash":"4a180277141dbdbc23e2da739671cff9d0f8148ad64f7fcd366e8a2da725d96a","bodyHash":"beda9ddd49fcf2fefb5b1e4547c74a406ce5a3ca0ccdea8f2c85f9bf19852dbd"}
 *
 * Go source:
 * func (c *Checker) inferFromTypes(n *InferenceState, source *Type, target *Type) {
 * 	if !c.couldContainTypeVariables(target) || c.isNoInferType(target) {
 * 		return
 * 	}
 * 	if source == c.wildcardType || source == c.blockedStringType {
 * 		// We are inferring from an 'any' type. We want to infer this type for every type parameter
 * 		// referenced in the target type, so we record it as the propagation type and infer from the
 * 		// target to itself. Then, as we find candidates we substitute the propagation type.
 * 		savePropagationType := n.propagationType
 * 		n.propagationType = source
 * 		c.inferFromTypes(n, target, target)
 * 		n.propagationType = savePropagationType
 * 		return
 * 	}
 * 	if source.alias != nil && target.alias != nil && source.alias.symbol == target.alias.symbol {
 * 		if len(source.alias.typeArguments) != 0 || len(target.alias.typeArguments) != 0 {
 * 			// Source and target are types originating in the same generic type alias declaration.
 * 			// Simply infer from source type arguments to target type arguments, with defaults applied.
 * 			params := c.typeAliasLinks.Get(source.alias.symbol).typeParameters
 * 			minParams := c.getMinTypeArgumentCount(params)
 * 			nodeIsInJsFile := ast.IsInJSFile(source.alias.symbol.ValueDeclaration)
 * 			sourceTypes := c.fillMissingTypeArguments(source.alias.typeArguments, params, minParams, nodeIsInJsFile)
 * 			targetTypes := c.fillMissingTypeArguments(target.alias.typeArguments, params, minParams, nodeIsInJsFile)
 * 			c.inferFromTypeArguments(n, sourceTypes, targetTypes, c.getAliasVariances(source.alias.symbol))
 * 		}
 * 		// And if there weren't any type arguments, there's no reason to run inference as the types must be the same.
 * 		return
 * 	}
 * 	if source == target && source.flags&TypeFlagsUnionOrIntersection != 0 {
 * 		// When source and target are the same union or intersection type, just relate each constituent
 * 		// type to itself.
 * 		for _, t := range source.Types() {
 * 			c.inferFromTypes(n, t, t)
 * 		}
 * 		return
 * 	}
 * 	if target.flags&TypeFlagsUnion != 0 {
 * 		var sourceTypes []*Type
 * 		if source.flags&TypeFlagsUnion != 0 {
 * 			sourceTypes = source.Types()
 * 		} else {
 * 			sourceTypes = []*Type{source}
 * 		}
 * 		// First, infer between identically matching source and target constituents and remove the
 * 		// matching types.
 * 		tempSources, tempTargets := c.inferFromMatchingTypes(n, sourceTypes, target.Distributed(), (*Checker).isTypeOrBaseIdenticalTo)
 * 		// Next, infer between closely matching source and target constituents and remove
 * 		// the matching types. Types closely match when they are instantiations of the same
 * 		// object type or instantiations of the same type alias.
 * 		sources, targets := c.inferFromMatchingTypes(n, tempSources, tempTargets, (*Checker).isTypeCloselyMatchedBy)
 * 		if len(targets) == 0 {
 * 			return
 * 		}
 * 		target = c.getUnionType(targets)
 * 		if len(sources) == 0 {
 * 			// All source constituents have been matched and there is nothing further to infer from.
 * 			// However, simply making no inferences is undesirable because it could ultimately mean
 * 			// inferring a type parameter constraint. Instead, make a lower priority inference from
 * 			// the full source to whatever remains in the target. For example, when inferring from
 * 			// string to 'string | T', make a lower priority inference of string for T.
 * 			c.inferWithPriority(n, source, target, InferencePriorityNakedTypeVariable)
 * 			return
 * 		}
 * 		source = c.getUnionType(sources)
 * 	} else if target.flags&TypeFlagsIntersection != 0 && !core.Every(target.Types(), c.isNonGenericObjectType) {
 * 		// We reduce intersection types unless they're simple combinations of object types. For example,
 * 		// when inferring from 'string[] & { extra: any }' to 'string[] & T' we want to remove string[] and
 * 		// infer { extra: any } for T. But when inferring to 'string[] & Iterable<T>' we want to keep the
 * 		// string[] on the source side and infer string for T.
 * 		if source.flags&TypeFlagsUnion == 0 {
 * 			var sourceTypes []*Type
 * 			if source.flags&TypeFlagsIntersection != 0 {
 * 				sourceTypes = source.Types()
 * 			} else {
 * 				sourceTypes = []*Type{source}
 * 			}
 * 			// Infer between identically matching source and target constituents and remove the matching types.
 * 			sources, targets := c.inferFromMatchingTypes(n, sourceTypes, target.Types(), (*Checker).isTypeIdenticalTo)
 * 			if len(sources) == 0 || len(targets) == 0 {
 * 				return
 * 			}
 * 			source = c.getIntersectionType(sources)
 * 			target = c.getIntersectionType(targets)
 * 		}
 * 	}
 * 	if target.flags&(TypeFlagsIndexedAccess|TypeFlagsSubstitution) != 0 {
 * 		if c.isNoInferType(target) {
 * 			return
 * 		}
 * 		target = c.getActualTypeVariable(target)
 * 	}
 * 	if target.flags&TypeFlagsTypeVariable != 0 {
 * 		// Skip inference if the source is "blocked", which is used by the language service to
 * 		// prevent inference on nodes currently being edited.
 * 		if c.isFromInferenceBlockedSource(source) {
 * 			return
 * 		}
 * 		inference := getInferenceInfoForType(n, target)
 * 		if inference != nil {
 * 			// If target is a type parameter, make an inference, unless the source type contains
 * 			// a "non-inferrable" type. Types with this flag set are markers used to prevent inference.
 * 			//
 * 			// For example:
 * 			//     - anyFunctionType is a wildcard type that's used to avoid contextually typing functions;
 * 			//       it's internal, so should not be exposed to the user by adding it as a candidate.
 * 			//     - autoType (and autoArrayType) is a special "any" used in control flow; like anyFunctionType,
 * 			//       it's internal and should not be observable.
 * 			//     - silentNeverType is returned by getInferredType when instantiating a generic function for
 * 			//       inference (and a type variable has no mapping).
 * 			//
 * 			// This flag is infectious; if we produce Box<never> (where never is silentNeverType), Box<never> is
 * 			// also non-inferrable.
 * 			//
 * 			// As a special case, also ignore nonInferrableAnyType, which is a special form of the any type
 * 			// used as a stand-in for binding elements when they are being inferred.
 * 			if source.objectFlags&ObjectFlagsNonInferrableType != 0 || source == c.nonInferrableAnyType {
 * 				return
 * 			}
 * 			if !inference.isFixed {
 * 				candidate := core.OrElse(n.propagationType, source)
 * 				if candidate == c.blockedStringType {
 * 					return
 * 				}
 * 				if n.priority < inference.priority {
 * 					inference.candidates = nil
 * 					inference.contraCandidates = nil
 * 					inference.topLevel = true
 * 					inference.priority = n.priority
 * 				}
 * 				if n.priority == inference.priority {
 * 					// We make contravariant inferences only if we are in a pure contravariant position,
 * 					// i.e. only if we have not descended into a bivariant position.
 * 					if n.contravariant && !n.bivariant {
 * 						if !slices.Contains(inference.contraCandidates, candidate) {
 * 							inference.contraCandidates = append(inference.contraCandidates, candidate)
 * 							clearCachedInferences(n.inferences)
 * 						}
 * 					} else if !slices.Contains(inference.candidates, candidate) {
 * 						inference.candidates = append(inference.candidates, candidate)
 * 						clearCachedInferences(n.inferences)
 * 					}
 * 				}
 * 				if n.priority&InferencePriorityReturnType == 0 && target.flags&TypeFlagsTypeParameter != 0 && inference.topLevel && !c.isTypeParameterAtTopLevel(n.originalTarget, target, 0) {
 * 					inference.topLevel = false
 * 					clearCachedInferences(n.inferences)
 * 				}
 * 			}
 * 			n.inferencePriority = min(n.inferencePriority, n.priority)
 * 			return
 * 		}
 * 		// Infer to the simplified version of an indexed access, if possible, to (hopefully) expose more bare type parameters to the inference engine
 * 		simplified := c.getSimplifiedType(target, false /*writing* /)
 * 		if simplified != target {
 * 			c.inferFromTypes(n, source, simplified)
 * 		} else if target.flags&TypeFlagsIndexedAccess != 0 {
 * 			indexType := c.getSimplifiedType(target.AsIndexedAccessType().indexType, false /*writing* /)
 * 			// Generally simplifications of instantiable indexes are avoided to keep relationship checking correct, however if our target is an access, we can consider
 * 			// that key of that access to be "instantiated", since we're looking to find the infernce goal in any way we can.
 * 			if indexType.flags&TypeFlagsInstantiable != 0 {
 * 				simplified := c.distributeIndexOverObjectType(c.getSimplifiedType(target.AsIndexedAccessType().objectType, false /*writing* /), indexType, false /*writing* /)
 * 				if simplified != nil && simplified != target {
 * 					c.inferFromTypes(n, source, simplified)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	switch {
 * 	case source.objectFlags&ObjectFlagsReference != 0 && target.objectFlags&ObjectFlagsReference != 0 && (source.AsTypeReference().target == target.AsTypeReference().target || c.isArrayType(source) && c.isArrayType(target)) && !(source.AsTypeReference().node != nil && target.AsTypeReference().node != nil):
 * 		// If source and target are references to the same generic type, infer from type arguments
 * 		c.inferFromTypeArguments(n, c.getTypeArguments(source), c.getTypeArguments(target), c.getVariances(source.AsTypeReference().target))
 * 	case source.flags&TypeFlagsIndex != 0 && target.flags&TypeFlagsIndex != 0:
 * 		c.inferFromContravariantTypes(n, source.AsIndexType().target, target.AsIndexType().target)
 * 	case (isLiteralType(source) || source.flags&TypeFlagsString != 0) && target.flags&TypeFlagsIndex != 0:
 * 		empty := c.createEmptyObjectTypeFromStringLiteral(source)
 * 		c.inferFromContravariantTypesWithPriority(n, empty, target.AsIndexType().target, InferencePriorityLiteralKeyof)
 * 	case source.flags&TypeFlagsIndexedAccess != 0 && target.flags&TypeFlagsIndexedAccess != 0:
 * 		c.inferFromTypes(n, source.AsIndexedAccessType().objectType, target.AsIndexedAccessType().objectType)
 * 		c.inferFromTypes(n, source.AsIndexedAccessType().indexType, target.AsIndexedAccessType().indexType)
 * 	case source.flags&TypeFlagsStringMapping != 0 && target.flags&TypeFlagsStringMapping != 0:
 * 		if source.symbol == target.symbol {
 * 			c.inferFromTypes(n, source.AsStringMappingType().target, target.AsStringMappingType().target)
 * 		}
 * 	case source.flags&TypeFlagsSubstitution != 0:
 * 		c.inferFromTypes(n, source.AsSubstitutionType().baseType, target)
 * 		// Make substitute inference at a lower priority
 * 		c.inferWithPriority(n, c.getSubstitutionIntersection(source), target, InferencePrioritySubstituteSource)
 * 	case target.flags&TypeFlagsConditional != 0:
 * 		c.invokeOnce(n, source, target, (*Checker).inferToConditionalType)
 * 	case target.flags&TypeFlagsUnionOrIntersection != 0:
 * 		c.inferToMultipleTypes(n, source, target.Types(), target.flags)
 * 	case source.flags&TypeFlagsUnion != 0:
 * 		// Source is a union or intersection type, infer from each constituent type
 * 		for _, sourceType := range source.Types() {
 * 			c.inferFromTypes(n, sourceType, target)
 * 		}
 * 	case target.flags&TypeFlagsTemplateLiteral != 0:
 * 		c.inferToTemplateLiteralType(n, source, target.AsTemplateLiteralType())
 * 	default:
 * 		source = c.getReducedType(source)
 * 		if c.isGenericMappedType(source) && c.isGenericMappedType(target) {
 * 			c.invokeOnce(n, source, target, (*Checker).inferFromGenericMappedTypes)
 * 		}
 * 		if !(n.priority&InferencePriorityNoConstraints != 0 && source.flags&(TypeFlagsIntersection|TypeFlagsInstantiable) != 0) {
 * 			apparentSource := c.getApparentType(source)
 * 			// getApparentType can return _any_ type, since an indexed access or conditional may simplify to any other type.
 * 			// If that occurs and it doesn't simplify to an object or intersection, we'll need to restart `inferFromTypes`
 * 			// with the simplified source.
 * 			if apparentSource != source && apparentSource.flags&(TypeFlagsObject|TypeFlagsIntersection) == 0 {
 * 				c.inferFromTypes(n, apparentSource, target)
 * 				return
 * 			}
 * 			source = apparentSource
 * 		}
 * 		if source.flags&(TypeFlagsObject|TypeFlagsIntersection) != 0 {
 * 			c.invokeOnce(n, source, target, (*Checker).inferFromObjectTypes)
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferFromTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromTypeArguments","kind":"method","status":"implemented","sigHash":"dff4bdcf801faef2dda4e9808b8d6fe086f69c941d89e059f4ccb90757928fd4","bodyHash":"c961a65625a058c070585881fc7fffcddce644d88241d02d363b69690430e683"}
 *
 * Go source:
 * func (c *Checker) inferFromTypeArguments(n *InferenceState, sourceTypes []*Type, targetTypes []*Type, variances []VarianceFlags) {
 * 	for i := range min(len(sourceTypes), len(targetTypes)) {
 * 		if i < len(variances) && variances[i]&VarianceFlagsVarianceMask == VarianceFlagsContravariant {
 * 			c.inferFromContravariantTypes(n, sourceTypes[i], targetTypes[i])
 * 		} else {
 * 			c.inferFromTypes(n, sourceTypes[i], targetTypes[i])
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferFromTypeArguments(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, sourceTypes: GoSlice<GoPtr<Type>>, targetTypes: GoSlice<GoPtr<Type>>, variances: GoSlice<VarianceFlags>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferWithPriority","kind":"method","status":"implemented","sigHash":"9acdd5a6bced9ade683d5fb99750cf8837c4d9410e19d870e111440e7d2466ab","bodyHash":"79c8f38e499130c3d6895a502ff2d6eddbc40b027cc0176f213b11d6328b7ca2"}
 *
 * Go source:
 * func (c *Checker) inferWithPriority(n *InferenceState, source *Type, target *Type, newPriority InferencePriority) {
 * 	savePriority := n.priority
 * 	n.priority |= newPriority
 * 	c.inferFromTypes(n, source, target)
 * 	n.priority = savePriority
 * }
 */
export declare function Checker_inferWithPriority(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>, newPriority: InferencePriority): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromContravariantTypesWithPriority","kind":"method","status":"implemented","sigHash":"ffd2e583802dccec17448b231fe60d968092b103f602556d1b62d0b76db685ce","bodyHash":"2e6a436acd295ef002f9333467fb83546270043c8505cc9646e0a870eefb98df"}
 *
 * Go source:
 * func (c *Checker) inferFromContravariantTypesWithPriority(n *InferenceState, source *Type, target *Type, newPriority InferencePriority) {
 * 	savePriority := n.priority
 * 	n.priority |= newPriority
 * 	c.inferFromContravariantTypes(n, source, target)
 * 	n.priority = savePriority
 * }
 */
export declare function Checker_inferFromContravariantTypesWithPriority(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>, newPriority: InferencePriority): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromContravariantTypes","kind":"method","status":"implemented","sigHash":"8cd7bb0ae8105a6e08152617f32900eec796586ecd0298c728a40047aba3eff2","bodyHash":"c41287df66bd7ee6906d13e4ff8cd892bb10c8d568854cc97850ec24c7174de8"}
 *
 * Go source:
 * func (c *Checker) inferFromContravariantTypes(n *InferenceState, source *Type, target *Type) {
 * 	n.contravariant = !n.contravariant
 * 	c.inferFromTypes(n, source, target)
 * 	n.contravariant = !n.contravariant
 * }
 */
export declare function Checker_inferFromContravariantTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromContravariantTypesIfStrictFunctionTypes","kind":"method","status":"implemented","sigHash":"c2a8ea0ff382557c1b28a20b2d2f736b8dc1f5f4d77206006a0b341fbaa3078e","bodyHash":"472294ff8f831ff9a2cad076dceb9804f2fffb4274ed3be9692653b4d83f7172"}
 *
 * Go source:
 * func (c *Checker) inferFromContravariantTypesIfStrictFunctionTypes(n *InferenceState, source *Type, target *Type) {
 * 	if c.strictFunctionTypes || n.priority&InferencePriorityAlwaysStrict != 0 {
 * 		c.inferFromContravariantTypes(n, source, target)
 * 	} else {
 * 		c.inferFromTypes(n, source, target)
 * 	}
 * }
 */
export declare function Checker_inferFromContravariantTypesIfStrictFunctionTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.invokeOnce","kind":"method","status":"implemented","sigHash":"c3c82f54655c62fc34057a63ee81a4b97d90d8c520a807129176b82acadbdc28","bodyHash":"3a74570effc02d5d58327c12727690660148f964ff559066cee716731cc1e464"}
 *
 * Go source:
 * func (c *Checker) invokeOnce(n *InferenceState, source *Type, target *Type, action func(c *Checker, n *InferenceState, source *Type, target *Type)) {
 * 	key := InferenceKey{s: source.id, t: target.id}
 * 	if status, ok := n.visited[key]; ok {
 * 		n.inferencePriority = min(n.inferencePriority, status)
 * 		return
 * 	}
 * 	if n.visited == nil {
 * 		n.visited = make(map[InferenceKey]InferencePriority)
 * 	}
 * 	n.visited[key] = InferencePriorityCircularity
 * 	saveInferencePriority := n.inferencePriority
 * 	n.inferencePriority = InferencePriorityMaxValue
 * 	// We stop inferring and report a circularity if we encounter duplicate recursion identities on both
 * 	// the source side and the target side.
 * 	saveExpandingFlags := n.expandingFlags
 * 	n.sourceStack = append(n.sourceStack, source)
 * 	n.targetStack = append(n.targetStack, target)
 * 	if c.isDeeplyNestedType(source, n.sourceStack, 2) {
 * 		n.expandingFlags |= ExpandingFlagsSource
 * 	}
 * 	if c.isDeeplyNestedType(target, n.targetStack, 2) {
 * 		n.expandingFlags |= ExpandingFlagsTarget
 * 	}
 * 	if n.expandingFlags != ExpandingFlagsBoth {
 * 		action(c, n, source, target)
 * 	} else {
 * 		n.inferencePriority = InferencePriorityCircularity
 * 	}
 * 	n.targetStack = n.targetStack[:len(n.targetStack)-1]
 * 	n.sourceStack = n.sourceStack[:len(n.sourceStack)-1]
 * 	n.expandingFlags = saveExpandingFlags
 * 	n.visited[key] = n.inferencePriority
 * 	n.inferencePriority = min(n.inferencePriority, saveInferencePriority)
 * }
 */
export declare function Checker_invokeOnce(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>, action: (c: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>) => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromMatchingTypes","kind":"method","status":"implemented","sigHash":"4b3b643b206027112f0ce26f2176180c75b45db15ff0bf9e0e68a863bddcdae5","bodyHash":"938b7a6d74806782bbd84141b604fcdf30e4a16513090b85373a7bb198b3999a"}
 *
 * Go source:
 * func (c *Checker) inferFromMatchingTypes(n *InferenceState, sources []*Type, targets []*Type, matches func(c *Checker, s *Type, t *Type) bool) ([]*Type, []*Type) {
 * 	var matchedSources []*Type
 * 	var matchedTargets []*Type
 * 	for _, t := range targets {
 * 		for _, s := range sources {
 * 			if matches(c, s, t) {
 * 				c.inferFromTypes(n, s, t)
 * 				matchedSources = core.AppendIfUnique(matchedSources, s)
 * 				matchedTargets = core.AppendIfUnique(matchedTargets, t)
 * 			}
 * 		}
 * 	}
 * 	if len(matchedSources) != 0 {
 * 		sources = core.Filter(sources, func(t *Type) bool { return !slices.Contains(matchedSources, t) })
 * 	}
 * 	if len(matchedTargets) != 0 {
 * 		targets = core.Filter(targets, func(t *Type) bool { return !slices.Contains(matchedTargets, t) })
 * 	}
 * 	return sources, targets
 * }
 */
export declare function Checker_inferFromMatchingTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, sources: GoSlice<GoPtr<Type>>, targets: GoSlice<GoPtr<Type>>, matches: (c: GoPtr<Checker>, s: GoPtr<Type>, t: GoPtr<Type>) => bool): [GoSlice<GoPtr<Type>>, GoSlice<GoPtr<Type>>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferToMultipleTypes","kind":"method","status":"implemented","sigHash":"a605a043077d26b932102e01380cd6999551c28808603bdf7d2c93f30cadec3f","bodyHash":"4986815fe5d2052c8f1b2624a5645abc75394374e0b06a14d364537cf2dbc852"}
 *
 * Go source:
 * func (c *Checker) inferToMultipleTypes(n *InferenceState, source *Type, targets []*Type, targetFlags TypeFlags) {
 * 	typeVariableCount := 0
 * 	if targetFlags&TypeFlagsUnion != 0 {
 * 		var nakedTypeVariable *Type
 * 		var sources []*Type
 * 		if source.flags&TypeFlagsUnion != 0 {
 * 			sources = source.Types()
 * 		} else {
 * 			sources = []*Type{source}
 * 		}
 * 		matched := make([]bool, len(sources))
 * 		inferenceCircularity := false
 * 		// First infer to types that are not naked type variables. For each source type we
 * 		// track whether inferences were made from that particular type to some target with
 * 		// equal priority (i.e. of equal quality) to what we would infer for a naked type
 * 		// parameter.
 * 		for _, t := range targets {
 * 			if getInferenceInfoForType(n, t) != nil {
 * 				nakedTypeVariable = t
 * 				typeVariableCount++
 * 			} else {
 * 				for i := range sources {
 * 					saveInferencePriority := n.inferencePriority
 * 					n.inferencePriority = InferencePriorityMaxValue
 * 					c.inferFromTypes(n, sources[i], t)
 * 					if n.inferencePriority == n.priority {
 * 						matched[i] = true
 * 					}
 * 					inferenceCircularity = inferenceCircularity || n.inferencePriority == InferencePriorityCircularity
 * 					n.inferencePriority = min(n.inferencePriority, saveInferencePriority)
 * 				}
 * 			}
 * 		}
 * 		if typeVariableCount == 0 {
 * 			// If every target is an intersection of types containing a single naked type variable,
 * 			// make a lower priority inference to that type variable. This handles inferring from
 * 			// 'A | B' to 'T & (X | Y)' where we want to infer 'A | B' for T.
 * 			intersectionTypeVariable := getSingleTypeVariableFromIntersectionTypes(n, targets)
 * 			if intersectionTypeVariable != nil {
 * 				c.inferWithPriority(n, source, intersectionTypeVariable, InferencePriorityNakedTypeVariable)
 * 			}
 * 			return
 * 		}
 * 		// If the target has a single naked type variable and no inference circularities were
 * 		// encountered above (meaning we explored the types fully), create a union of the source
 * 		// types from which no inferences have been made so far and infer from that union to the
 * 		// naked type variable.
 * 		if typeVariableCount == 1 && !inferenceCircularity {
 * 			var unmatched []*Type
 * 			for i, s := range sources {
 * 				if !matched[i] {
 * 					unmatched = append(unmatched, s)
 * 				}
 * 			}
 * 			if len(unmatched) != 0 {
 * 				c.inferFromTypes(n, c.getUnionType(unmatched), nakedTypeVariable)
 * 				return
 * 			}
 * 		}
 * 	} else {
 * 		// We infer from types that are not naked type variables first so that inferences we
 * 		// make from nested naked type variables and given slightly higher priority by virtue
 * 		// of being first in the candidates array.
 * 		for _, t := range targets {
 * 			if getInferenceInfoForType(n, t) != nil {
 * 				typeVariableCount++
 * 			} else {
 * 				c.inferFromTypes(n, source, t)
 * 			}
 * 		}
 * 	}
 * 	// Inferences directly to naked type variables are given lower priority as they are
 * 	// less specific. For example, when inferring from Promise<string> to T | Promise<T>,
 * 	// we want to infer string for T, not Promise<string> | string. For intersection types
 * 	// we only infer to single naked type variables.
 * 	if targetFlags&TypeFlagsIntersection != 0 && typeVariableCount == 1 || targetFlags&TypeFlagsIntersection == 0 && typeVariableCount > 0 {
 * 		for _, t := range targets {
 * 			if getInferenceInfoForType(n, t) != nil {
 * 				c.inferWithPriority(n, source, t, InferencePriorityNakedTypeVariable)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferToMultipleTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, targets: GoSlice<GoPtr<Type>>, targetFlags: TypeFlags): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::getSingleTypeVariableFromIntersectionTypes","kind":"func","status":"implemented","sigHash":"6f1efbb664994b58ff730e8a25eb4c9efb456b3483e9bf5c3f770eb72f614303","bodyHash":"9183b518d8ae566a1e602e640febd326ff52a4202761d8a06c1477dee22bd0ba"}
 *
 * Go source:
 * func getSingleTypeVariableFromIntersectionTypes(n *InferenceState, types []*Type) *Type {
 * 	var typeVariable *Type
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsIntersection == 0 {
 * 			return nil
 * 		}
 * 		v := core.Find(t.Types(), func(t *Type) bool { return getInferenceInfoForType(n, t) != nil })
 * 		if v == nil || typeVariable != nil && v != typeVariable {
 * 			return nil
 * 		}
 * 		typeVariable = v
 * 	}
 * 	return typeVariable
 * }
 */
export declare function getSingleTypeVariableFromIntersectionTypes(n: GoPtr<InferenceState>, types: GoSlice<GoPtr<Type>>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferToMultipleTypesWithPriority","kind":"method","status":"implemented","sigHash":"a62d1a112056220d435ae3ec2adffcfd28d98bc1d2c16178c3ac38d285815b88","bodyHash":"b17a6706e892c417dfb35453cb29b80649203648b478d76bbff135ef5b7d0b16"}
 *
 * Go source:
 * func (c *Checker) inferToMultipleTypesWithPriority(n *InferenceState, source *Type, targets []*Type, targetFlags TypeFlags, newPriority InferencePriority) {
 * 	savePriority := n.priority
 * 	n.priority |= newPriority
 * 	c.inferToMultipleTypes(n, source, targets, targetFlags)
 * 	n.priority = savePriority
 * }
 */
export declare function Checker_inferToMultipleTypesWithPriority(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, targets: GoSlice<GoPtr<Type>>, targetFlags: TypeFlags, newPriority: InferencePriority): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferToConditionalType","kind":"method","status":"implemented","sigHash":"82e4f3b2fa0bee63ab2b79977b4dae6aac6f0980188573f8438c6fb28c7e017f","bodyHash":"c561597a06e40026ffc047d498b645ce2084cbd6602517a94384fced60acaf58"}
 *
 * Go source:
 * func (c *Checker) inferToConditionalType(n *InferenceState, source *Type, target *Type) {
 * 	if source.flags&TypeFlagsConditional != 0 {
 * 		c.inferFromTypes(n, source.AsConditionalType().checkType, target.AsConditionalType().checkType)
 * 		c.inferFromTypes(n, source.AsConditionalType().extendsType, target.AsConditionalType().extendsType)
 * 		c.inferFromTypes(n, c.getTrueTypeFromConditionalType(source), c.getTrueTypeFromConditionalType(target))
 * 		c.inferFromTypes(n, c.getFalseTypeFromConditionalType(source), c.getFalseTypeFromConditionalType(target))
 * 	} else {
 * 		targetTypes := []*Type{c.getTrueTypeFromConditionalType(target), c.getFalseTypeFromConditionalType(target)}
 * 		c.inferToMultipleTypesWithPriority(n, source, targetTypes, target.flags, core.IfElse(n.contravariant, InferencePriorityContravariantConditional, 0))
 * 	}
 * }
 */
export declare function Checker_inferToConditionalType(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferToTemplateLiteralType","kind":"method","status":"implemented","sigHash":"412609e94e900b0fa0930c4467276ad829245b8a13aa2192ea7945242ac286b9","bodyHash":"f56a9811f6f575b9a5de81ac8ed6e57876ef2987a4dbac4772820277c0df62d0"}
 *
 * Go source:
 * func (c *Checker) inferToTemplateLiteralType(n *InferenceState, source *Type, target *TemplateLiteralType) {
 * 	matches := c.inferTypesFromTemplateLiteralType(source, target)
 * 	types := target.types
 * 	// When the target template literal contains only placeholders (meaning that inference is intended to extract
 * 	// single characters and remainder strings) and inference fails to produce matches, we want to infer 'never' for
 * 	// each placeholder such that instantiation with the inferred value(s) produces 'never', a type for which an
 * 	// assignment check will fail. If we make no inferences, we'll likely end up with the constraint 'string' which,
 * 	// upon instantiation, would collapse all the placeholders to just 'string', and an assignment check might
 * 	// succeed. That would be a pointless and confusing outcome.
 * 	if len(matches) != 0 || core.Every(target.texts, func(s string) bool { return s == "" }) {
 * 		for i, target := range types {
 * 			var source *Type
 * 			if len(matches) != 0 {
 * 				source = matches[i]
 * 			} else {
 * 				source = c.neverType
 * 			}
 * 			// If we are inferring from a string literal type to a type variable whose constraint includes one of the
 * 			// allowed template literal placeholder types, infer from a literal type corresponding to the constraint.
 * 			if source.flags&TypeFlagsStringLiteral != 0 && target.flags&TypeFlagsTypeVariable != 0 {
 * 				if inferenceContext := getInferenceInfoForType(n, target); inferenceContext != nil {
 * 					if constraint := c.getBaseConstraintOfType(inferenceContext.typeParameter); constraint != nil && !IsTypeAny(constraint) {
 * 						allTypeFlags := TypeFlagsNone
 * 						for _, t := range constraint.Distributed() {
 * 							allTypeFlags |= t.flags
 * 						}
 * 						// If the constraint contains `string`, we don't need to look for a more preferred type
 * 						if allTypeFlags&TypeFlagsString == 0 {
 * 							str := getStringLiteralValue(source)
 * 							// If the type contains `number` or a number literal and the string isn't a valid number, exclude numbers
 * 							if allTypeFlags&TypeFlagsNumberLike != 0 && !isValidNumberString(str, true /*roundTripOnly* /) {
 * 								allTypeFlags &^= TypeFlagsNumberLike
 * 							}
 * 							// If the type contains `bigint` or a bigint literal and the string isn't a valid bigint, exclude bigints
 * 							if allTypeFlags&TypeFlagsBigIntLike != 0 && !isValidBigIntString(str, true /*roundTripOnly* /) {
 * 								allTypeFlags &^= TypeFlagsBigIntLike
 * 							}
 * 							choose := func(left *Type, right *Type) *Type {
 * 								switch {
 * 								case right.flags&allTypeFlags == 0:
 * 									return left
 * 								case left.flags&TypeFlagsString != 0:
 * 									return left
 * 								case right.flags&TypeFlagsString != 0:
 * 									return source
 * 								case left.flags&TypeFlagsTemplateLiteral != 0:
 * 									return left
 * 								case right.flags&TypeFlagsTemplateLiteral != 0 && c.isTypeMatchedByTemplateLiteralType(source, right.AsTemplateLiteralType(), c.compareTypesAssignable):
 * 									return source
 * 								case left.flags&TypeFlagsStringMapping != 0:
 * 									return left
 * 								case right.flags&TypeFlagsStringMapping != 0 && str == applyStringMapping(right.symbol, str):
 * 									return source
 * 								case left.flags&TypeFlagsStringLiteral != 0:
 * 									return left
 * 								case right.flags&TypeFlagsStringLiteral != 0 && getStringLiteralValue(right) == str:
 * 									return right
 * 								case left.flags&TypeFlagsNumber != 0:
 * 									return left
 * 								case right.flags&TypeFlagsNumber != 0:
 * 									return c.getNumberLiteralType(jsnum.FromString(str))
 * 								case left.flags&TypeFlagsEnum != 0:
 * 									return left
 * 								case right.flags&TypeFlagsEnum != 0:
 * 									return c.getNumberLiteralType(jsnum.FromString(str))
 * 								case left.flags&TypeFlagsNumberLiteral != 0:
 * 									return left
 * 								case right.flags&TypeFlagsNumberLiteral != 0 && getNumberLiteralValue(right) == jsnum.FromString(str):
 * 									return right
 * 								case left.flags&TypeFlagsBigInt != 0:
 * 									return left
 * 								case right.flags&TypeFlagsBigInt != 0:
 * 									return c.parseBigIntLiteralType(str)
 * 								case left.flags&TypeFlagsBigIntLiteral != 0:
 * 									return left
 * 								case right.flags&TypeFlagsBigIntLiteral != 0 && pseudoBigIntToString(getBigIntLiteralValue(right)) == str:
 * 									return right
 * 								case left.flags&TypeFlagsBoolean != 0:
 * 									return left
 * 								case right.flags&TypeFlagsBoolean != 0:
 * 									switch {
 * 									case str == "true":
 * 										return c.trueType
 * 									case str == "false":
 * 										return c.falseType
 * 									default:
 * 										return c.booleanType
 * 									}
 * 								case left.flags&TypeFlagsBooleanLiteral != 0:
 * 									return left
 * 								case right.flags&TypeFlagsBooleanLiteral != 0 && core.IfElse(getBooleanLiteralValue(right), "true", "false") == str:
 * 									return right
 * 								case left.flags&TypeFlagsUndefined != 0:
 * 									return left
 * 								case right.flags&TypeFlagsUndefined != 0 && right.AsIntrinsicType().intrinsicName == str:
 * 									return right
 * 								case left.flags&TypeFlagsNull != 0:
 * 									return left
 * 								case right.flags&TypeFlagsNull != 0 && right.AsIntrinsicType().intrinsicName == str:
 * 									return right
 * 								default:
 * 									return left
 * 								}
 * 							}
 * 							matchingType := c.neverType
 * 							for _, t := range constraint.Distributed() {
 * 								matchingType = choose(matchingType, t)
 * 							}
 * 							if matchingType.flags&TypeFlagsNever == 0 {
 * 								c.inferFromTypes(n, matchingType, target)
 * 								continue
 * 							}
 * 						}
 * 					}
 * 				}
 * 			}
 * 			c.inferFromTypes(n, source, target)
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferToTemplateLiteralType(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<TemplateLiteralType>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromGenericMappedTypes","kind":"method","status":"implemented","sigHash":"12aaf432cac5e8522629d2aec7a9528e66435dc8b3ca1ab28346d754b4dcbe41","bodyHash":"8894855a8b2a3d9f7a6fed8af068cd6bb36dd20c1bd3e510f436ed68c922b50d"}
 *
 * Go source:
 * func (c *Checker) inferFromGenericMappedTypes(n *InferenceState, source *Type, target *Type) {
 * 	// The source and target types are generic types { [P in S]: X } and { [P in T]: Y }, so we infer
 * 	// from S to T and from X to Y.
 * 	c.inferFromTypes(n, c.getConstraintTypeFromMappedType(source), c.getConstraintTypeFromMappedType(target))
 * 	c.inferFromTypes(n, c.getTemplateTypeFromMappedType(source), c.getTemplateTypeFromMappedType(target))
 * 	sourceNameType := c.getNameTypeFromMappedType(source)
 * 	targetNameType := c.getNameTypeFromMappedType(target)
 * 	if sourceNameType != nil && targetNameType != nil {
 * 		c.inferFromTypes(n, sourceNameType, targetNameType)
 * 	}
 * }
 */
export declare function Checker_inferFromGenericMappedTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromObjectTypes","kind":"method","status":"implemented","sigHash":"1e786fae1ad85769b0d5d58d2cb17488d761e04646c1d0981fe6a197627c71b9","bodyHash":"22d0c8b82340248562ebe45b30c0f316f8e6659a6c36bd1deab4058f8b70db65"}
 *
 * Go source:
 * func (c *Checker) inferFromObjectTypes(n *InferenceState, source *Type, target *Type) {
 * 	if source.objectFlags&ObjectFlagsReference != 0 && target.objectFlags&ObjectFlagsReference != 0 && (source.Target() == target.Target() || c.isArrayType(source) && c.isArrayType(target)) {
 * 		// If source and target are references to the same generic type, infer from type arguments
 * 		c.inferFromTypeArguments(n, c.getTypeArguments(source), c.getTypeArguments(target), c.getVariances(source.Target()))
 * 		return
 * 	}
 * 	if c.isGenericMappedType(source) && c.isGenericMappedType(target) {
 * 		c.inferFromGenericMappedTypes(n, source, target)
 * 	}
 * 	if target.objectFlags&ObjectFlagsMapped != 0 && target.AsMappedType().declaration.NameType == nil {
 * 		constraintType := c.getConstraintTypeFromMappedType(target)
 * 		if c.inferToMappedType(n, source, target, constraintType) {
 * 			return
 * 		}
 * 	}
 * 	// Infer from the members of source and target only if the two types are possibly related
 * 	if c.typesDefinitelyUnrelated(source, target) {
 * 		return
 * 	}
 * 	if c.isArrayOrTupleType(source) {
 * 		if isTupleType(target) {
 * 			sourceArity := c.getTypeReferenceArity(source)
 * 			targetArity := c.getTypeReferenceArity(target)
 * 			elementTypes := c.getTypeArguments(target)
 * 			elementInfos := target.TargetTupleType().elementInfos
 * 			// When source and target are tuple types with the same structure (fixed, variadic, and rest are matched
 * 			// to the same kind in each position), simply infer between the element types.
 * 			if isTupleType(source) && c.isTupleTypeStructureMatching(source, target) {
 * 				for i := range targetArity {
 * 					c.inferFromTypes(n, c.getTypeArguments(source)[i], elementTypes[i])
 * 				}
 * 				return
 * 			}
 * 			startLength := 0
 * 			endLength := 0
 * 			if isTupleType(source) {
 * 				startLength = min(source.TargetTupleType().fixedLength, target.TargetTupleType().fixedLength)
 * 				if target.TargetTupleType().combinedFlags&ElementFlagsVariable != 0 {
 * 					endLength = min(getEndElementCount(source.TargetTupleType(), ElementFlagsFixed), getEndElementCount(target.TargetTupleType(), ElementFlagsFixed))
 * 				}
 * 			}
 * 			// Infer between starting fixed elements.
 * 			for i := range startLength {
 * 				c.inferFromTypes(n, c.getTypeArguments(source)[i], elementTypes[i])
 * 			}
 * 			if !isTupleType(source) || sourceArity-startLength-endLength == 1 && source.TargetTupleType().elementInfos[startLength].flags&ElementFlagsRest != 0 {
 * 				// Single rest element remains in source, infer from that to every element in target
 * 				restType := c.getTypeArguments(source)[startLength]
 * 				for i := startLength; i < targetArity-endLength; i++ {
 * 					t := restType
 * 					if elementInfos[i].flags&ElementFlagsVariadic != 0 {
 * 						t = c.createArrayType(t)
 * 					}
 * 					c.inferFromTypes(n, t, elementTypes[i])
 * 				}
 * 			} else {
 * 				middleLength := targetArity - startLength - endLength
 * 				if middleLength == 2 {
 * 					if elementInfos[startLength].flags&elementInfos[startLength+1].flags&ElementFlagsVariadic != 0 {
 * 						// Middle of target is [...T, ...U] and source is tuple type
 * 						targetInfo := getInferenceInfoForType(n, elementTypes[startLength])
 * 						if targetInfo != nil && targetInfo.impliedArity >= 0 {
 * 							// Infer slices from source based on implied arity of T.
 * 							c.inferFromTypes(n, c.sliceTupleType(source, startLength, endLength+sourceArity-targetInfo.impliedArity), elementTypes[startLength])
 * 							c.inferFromTypes(n, c.sliceTupleType(source, startLength+targetInfo.impliedArity, endLength), elementTypes[startLength+1])
 * 						}
 * 					} else if elementInfos[startLength].flags&ElementFlagsVariadic != 0 && elementInfos[startLength+1].flags&ElementFlagsRest != 0 {
 * 						// Middle of target is [...T, ...rest] and source is tuple type
 * 						// if T is constrained by a fixed-size tuple we might be able to use its arity to infer T
 * 						if info := getInferenceInfoForType(n, elementTypes[startLength]); info != nil {
 * 							constraint := c.getBaseConstraintOfType(info.typeParameter)
 * 							if constraint != nil && isTupleType(constraint) && constraint.TargetTupleType().combinedFlags&ElementFlagsVariable == 0 {
 * 								impliedArity := constraint.TargetTupleType().fixedLength
 * 								c.inferFromTypes(n, c.sliceTupleType(source, startLength, sourceArity-(startLength+impliedArity)), elementTypes[startLength])
 * 								if restType := c.getElementTypeOfSliceOfTupleType(source, startLength+impliedArity, endLength, false, false); restType != nil {
 * 									c.inferFromTypes(n, restType, elementTypes[startLength+1])
 * 								}
 * 							}
 * 						}
 * 					} else if elementInfos[startLength].flags&ElementFlagsRest != 0 && elementInfos[startLength+1].flags&ElementFlagsVariadic != 0 {
 * 						// Middle of target is [...rest, ...T] and source is tuple type
 * 						// if T is constrained by a fixed-size tuple we might be able to use its arity to infer T
 * 						if info := getInferenceInfoForType(n, elementTypes[startLength+1]); info != nil {
 * 							constraint := c.getBaseConstraintOfType(info.typeParameter)
 * 							if constraint != nil && isTupleType(constraint) && constraint.TargetTupleType().combinedFlags&ElementFlagsVariable == 0 {
 * 								impliedArity := constraint.TargetTupleType().fixedLength
 * 								endIndex := sourceArity - getEndElementCount(target.TargetTupleType(), ElementFlagsFixed)
 * 								startIndex := endIndex - impliedArity
 * 								if startIndex >= startLength {
 * 									trailingSlice := c.createTupleTypeEx(c.getTypeArguments(source)[startIndex:endIndex], source.TargetTupleType().elementInfos[startIndex:endIndex], false /*readonly* /)
 * 									if restType := c.getElementTypeOfSliceOfTupleType(source, startLength, endLength+impliedArity, false, false); restType != nil {
 * 										c.inferFromTypes(n, restType, elementTypes[startLength])
 * 									}
 * 									c.inferFromTypes(n, trailingSlice, elementTypes[startLength+1])
 * 								}
 * 							}
 * 						}
 * 					}
 * 				} else if middleLength == 1 && elementInfos[startLength].flags&ElementFlagsVariadic != 0 {
 * 					// Middle of target is exactly one variadic element. Infer the slice between the fixed parts in the source.
 * 					// If target ends in optional element(s), make a lower priority a speculative inference.
 * 					priority := core.IfElse(elementInfos[targetArity-1].flags&ElementFlagsOptional != 0, InferencePrioritySpeculativeTuple, 0)
 * 					sourceSlice := c.sliceTupleType(source, startLength, endLength)
 * 					c.inferWithPriority(n, sourceSlice, elementTypes[startLength], priority)
 * 				} else if middleLength == 1 && elementInfos[startLength].flags&ElementFlagsRest != 0 {
 * 					// Middle of target is exactly one rest element. If middle of source is not empty, infer union of middle element types.
 * 					restType := c.getElementTypeOfSliceOfTupleType(source, startLength, endLength, false, false)
 * 					if restType != nil {
 * 						c.inferFromTypes(n, restType, elementTypes[startLength])
 * 					}
 * 				}
 * 			}
 * 			// Infer between ending fixed elements
 * 			for i := range endLength {
 * 				c.inferFromTypes(n, c.getTypeArguments(source)[sourceArity-i-1], elementTypes[targetArity-i-1])
 * 			}
 * 			return
 * 		}
 * 		if c.isArrayType(target) {
 * 			c.inferFromIndexTypes(n, source, target)
 * 			return
 * 		}
 * 	}
 * 	c.inferFromProperties(n, source, target)
 * 	c.inferFromSignatures(n, source, target, SignatureKindCall)
 * 	c.inferFromSignatures(n, source, target, SignatureKindConstruct)
 * 	c.inferFromIndexTypes(n, source, target)
 * }
 */
export declare function Checker_inferFromObjectTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromProperties","kind":"method","status":"implemented","sigHash":"649a03db3fc7e6d625c689fef927a008d03f32b46481f70d018394127ac94753","bodyHash":"dba6604a73d2d9e409bc72ac28858909c187574c1e9be34880cd3defae3ac324"}
 *
 * Go source:
 * func (c *Checker) inferFromProperties(n *InferenceState, source *Type, target *Type) {
 * 	properties := c.getPropertiesOfObjectType(target)
 * 	for _, targetProp := range properties {
 * 		sourceProp := c.getPropertyOfType(source, targetProp.Name)
 * 		if sourceProp != nil && !core.Some(sourceProp.Declarations, c.isSkipDirectInferenceNode) {
 * 			c.inferFromTypes(n, c.removeMissingType(c.getTypeOfSymbol(sourceProp), sourceProp.Flags&ast.SymbolFlagsOptional != 0), c.removeMissingType(c.getTypeOfSymbol(targetProp), targetProp.Flags&ast.SymbolFlagsOptional != 0))
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferFromProperties(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromSignatures","kind":"method","status":"implemented","sigHash":"a20f8fb70c19dbbc96a64006d1c8f503399ec043c9ddf92838423965cbf252cf","bodyHash":"02cb903c4696d613e93c0a569fb4130aebf02cdebb8473b25f4145c8d55c2908"}
 *
 * Go source:
 * func (c *Checker) inferFromSignatures(n *InferenceState, source *Type, target *Type, kind SignatureKind) {
 * 	sourceSignatures := c.getSignaturesOfType(source, kind)
 * 	sourceLen := len(sourceSignatures)
 * 	if sourceLen > 0 {
 * 		// We match source and target signatures from the bottom up, and if the source has fewer signatures
 * 		// than the target, we infer from the first source signature to the excess target signatures.
 * 		targetSignatures := c.getSignaturesOfType(target, kind)
 * 		targetLen := len(targetSignatures)
 * 		for i := range targetLen {
 * 			sourceIndex := max(sourceLen-targetLen+i, 0)
 * 			c.inferFromSignature(n, c.getBaseSignature(sourceSignatures[sourceIndex]), c.getErasedSignature(targetSignatures[i]))
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferFromSignatures(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>, kind: SignatureKind): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromSignature","kind":"method","status":"implemented","sigHash":"56289f13825c268270f6f10cfbb0db1e86cfa5ab46701a78bec0eafe2e9bd0f4","bodyHash":"6781147da576dcc2ba2781be4bde87f4195e1779f9d9114b67be148d5bc06151"}
 *
 * Go source:
 * func (c *Checker) inferFromSignature(n *InferenceState, source *Signature, target *Signature) {
 * 	if source.flags&SignatureFlagsIsNonInferrable == 0 {
 * 		saveBivariant := n.bivariant
 * 		kind := ast.KindUnknown
 * 		if target.declaration != nil {
 * 			kind = target.declaration.Kind
 * 		}
 * 		// Once we descend into a bivariant signature we remain bivariant for all nested inferences
 * 		n.bivariant = n.bivariant || kind == ast.KindMethodDeclaration || kind == ast.KindMethodSignature || kind == ast.KindConstructor
 * 		c.applyToParameterTypes(source, target, func(s, t *Type) { c.inferFromContravariantTypesIfStrictFunctionTypes(n, s, t) })
 * 		n.bivariant = saveBivariant
 * 	}
 * 	c.applyToReturnTypes(source, target, func(s, t *Type) { c.inferFromTypes(n, s, t) })
 * }
 */
export declare function Checker_inferFromSignature(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Signature>, target: GoPtr<Signature>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.applyToParameterTypes","kind":"method","status":"implemented","sigHash":"8385a93a11a9776e79aaa945d00ed1ca4318517b4e8733300d3904f1a545a3e6","bodyHash":"7ca0441ffa33e5bd0711b630175e605a49517c37065e4e926e304edd6cd70b85"}
 *
 * Go source:
 * func (c *Checker) applyToParameterTypes(source *Signature, target *Signature, callback func(s *Type, t *Type)) {
 * 	sourceCount := c.getParameterCount(source)
 * 	targetCount := c.getParameterCount(target)
 * 	sourceRestType := c.getEffectiveRestType(source)
 * 	targetRestType := c.getEffectiveRestType(target)
 * 	targetNonRestCount := targetCount
 * 	if targetRestType != nil {
 * 		targetNonRestCount--
 * 	}
 * 	paramCount := targetNonRestCount
 * 	if sourceRestType == nil {
 * 		paramCount = min(sourceCount, targetNonRestCount)
 * 	}
 * 	sourceThisType := c.getThisTypeOfSignature(source)
 * 	if sourceThisType != nil {
 * 		targetThisType := c.getThisTypeOfSignature(target)
 * 		if targetThisType != nil {
 * 			callback(sourceThisType, targetThisType)
 * 		}
 * 	}
 * 	for i := range paramCount {
 * 		callback(c.getTypeAtPosition(source, i), c.getTypeAtPosition(target, i))
 * 	}
 * 	if targetRestType != nil {
 * 		callback(c.getRestTypeAtPosition(source, paramCount, c.isConstTypeVariable(targetRestType, 0) && !someType(targetRestType, c.isMutableArrayLikeType) /*readonly* /), targetRestType)
 * 	}
 * }
 */
export declare function Checker_applyToParameterTypes(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, callback: (s: GoPtr<Type>, t: GoPtr<Type>) => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.applyToReturnTypes","kind":"method","status":"implemented","sigHash":"48a4b32c69aeac3ce5dd050d578cdc56a06621c2657970fee4cba2ec0e4206e3","bodyHash":"b2fb7da0f13d0c291d9100b1846fb8568761abfc8e7f1985750e76ac64dccfe6"}
 *
 * Go source:
 * func (c *Checker) applyToReturnTypes(source *Signature, target *Signature, callback func(s *Type, t *Type)) {
 * 	targetTypePredicate := c.getTypePredicateOfSignature(target)
 * 	if targetTypePredicate != nil {
 * 		sourceTypePredicate := c.getTypePredicateOfSignature(source)
 * 		if sourceTypePredicate != nil && c.typePredicateKindsMatch(sourceTypePredicate, targetTypePredicate) && sourceTypePredicate.t != nil && targetTypePredicate.t != nil {
 * 			callback(sourceTypePredicate.t, targetTypePredicate.t)
 * 			return
 * 		}
 * 	}
 * 	targetReturnType := c.getReturnTypeOfSignature(target)
 * 	if c.couldContainTypeVariables(targetReturnType) {
 * 		callback(c.getReturnTypeOfSignature(source), targetReturnType)
 * 	}
 * }
 */
export declare function Checker_applyToReturnTypes(receiver: GoPtr<Checker>, source: GoPtr<Signature>, target: GoPtr<Signature>, callback: (s: GoPtr<Type>, t: GoPtr<Type>) => void): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromIndexTypes","kind":"method","status":"implemented","sigHash":"5dc3274071d510add868169007ab521e1905f5f94fc6a30e41f7c74c65d0c830","bodyHash":"25f1f7df568207cc0ffe4608ef8ffc55b4348bd09f68f117447f3b1ab7bbba8d"}
 *
 * Go source:
 * func (c *Checker) inferFromIndexTypes(n *InferenceState, source *Type, target *Type) {
 * 	// Inferences across mapped type index signatures are pretty much the same a inferences to homomorphic variables
 * 	priority := InferencePriorityNone
 * 	if source.objectFlags&target.objectFlags&ObjectFlagsMapped != 0 {
 * 		priority = InferencePriorityHomomorphicMappedType
 * 	}
 * 	indexInfos := c.getIndexInfosOfType(target)
 * 	if c.isObjectTypeWithInferableIndex(source) {
 * 		for _, targetInfo := range indexInfos {
 * 			var propTypes []*Type
 * 			for _, prop := range c.getPropertiesOfType(source) {
 * 				if c.isApplicableIndexType(c.getLiteralTypeFromProperty(prop, TypeFlagsStringOrNumberLiteralOrUnique, false), targetInfo.keyType) {
 * 					propType := c.getTypeOfSymbol(prop)
 * 					if prop.Flags&ast.SymbolFlagsOptional != 0 {
 * 						propType = c.removeMissingOrUndefinedType(propType)
 * 					}
 * 					propTypes = append(propTypes, propType)
 * 				}
 * 			}
 * 			for _, info := range c.getIndexInfosOfType(source) {
 * 				if c.isApplicableIndexType(info.keyType, targetInfo.keyType) {
 * 					propTypes = append(propTypes, info.valueType)
 * 				}
 * 			}
 * 			if len(propTypes) != 0 {
 * 				c.inferWithPriority(n, c.getUnionType(propTypes), targetInfo.valueType, priority)
 * 			}
 * 		}
 * 	}
 * 	for _, targetInfo := range indexInfos {
 * 		sourceInfo := c.getApplicableIndexInfo(source, targetInfo.keyType)
 * 		if sourceInfo != nil {
 * 			c.inferWithPriority(n, sourceInfo.valueType, targetInfo.valueType, priority)
 * 		}
 * 	}
 * }
 */
export declare function Checker_inferFromIndexTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferToMappedType","kind":"method","status":"implemented","sigHash":"9b12d4397c7351d05e2e7a3beb2e754ca63159a3625d1ef3a121f2c8bdf36157","bodyHash":"3c4be923713f05941f39278097d7aeae14d0d05f59c1f717cdab012ab9d8d632"}
 *
 * Go source:
 * func (c *Checker) inferToMappedType(n *InferenceState, source *Type, target *Type, constraintType *Type) bool {
 * 	if constraintType.flags&TypeFlagsUnion != 0 || constraintType.flags&TypeFlagsIntersection != 0 {
 * 		result := false
 * 		for _, t := range constraintType.Types() {
 * 			result = core.OrElse(c.inferToMappedType(n, source, target, t), result)
 * 		}
 * 		return result
 * 	}
 * 	if constraintType.flags&TypeFlagsIndex != 0 {
 * 		// We're inferring from some source type S to a homomorphic mapped type { [P in keyof T]: X },
 * 		// where T is a type variable. Use inferTypeForHomomorphicMappedType to infer a suitable source
 * 		// type and then make a secondary inference from that type to T. We make a secondary inference
 * 		// such that direct inferences to T get priority over inferences to Partial<T>, for example.
 * 		inference := getInferenceInfoForType(n, constraintType.AsIndexType().target)
 * 		if inference != nil && !inference.isFixed && !c.isFromInferenceBlockedSource(source) {
 * 			inferredType := c.inferTypeForHomomorphicMappedType(source, target, constraintType)
 * 			if inferredType != nil {
 * 				// We assign a lower priority to inferences made from types containing non-inferrable
 * 				// types because we may only have a partial result (i.e. we may have failed to make
 * 				// reverse inferences for some properties).
 * 				c.inferWithPriority(n, inferredType, inference.typeParameter, core.IfElse(source.objectFlags&ObjectFlagsNonInferrableType != 0, InferencePriorityPartialHomomorphicMappedType, InferencePriorityHomomorphicMappedType))
 * 			}
 * 		}
 * 		return true
 * 	}
 * 	if constraintType.flags&TypeFlagsTypeParameter != 0 {
 * 		// We're inferring from some source type S to a mapped type { [P in K]: X }, where K is a type
 * 		// parameter. First infer from 'keyof S' to K.
 * 		c.inferWithPriority(n, c.getIndexTypeEx(source, core.IfElse(c.patternForType[source] != nil, IndexFlagsNoIndexSignatures, IndexFlagsNone)), constraintType, InferencePriorityMappedTypeConstraint)
 * 		// If K is constrained to a type C, also infer to C. Thus, for a mapped type { [P in K]: X },
 * 		// where K extends keyof T, we make the same inferences as for a homomorphic mapped type
 * 		// { [P in keyof T]: X }. This enables us to make meaningful inferences when the target is a
 * 		// Pick<T, K>.
 * 		extendedConstraint := c.getConstraintOfType(constraintType)
 * 		if extendedConstraint != nil && c.inferToMappedType(n, source, target, extendedConstraint) {
 * 			return true
 * 		}
 * 		// If no inferences can be made to K's constraint, infer from a union of the property types
 * 		// in the source to the template type X.
 * 		propTypes := core.Map(c.getPropertiesOfType(source), c.getTypeOfSymbol)
 * 		indexTypes := core.Map(c.getIndexInfosOfType(source), func(info *IndexInfo) *Type {
 * 			if info != c.enumNumberIndexInfo {
 * 				return info.valueType
 * 			}
 * 			return c.neverType
 * 		})
 * 		c.inferFromTypes(n, c.getUnionType(core.Concatenate(propTypes, indexTypes)), c.getTemplateTypeFromMappedType(target))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_inferToMappedType(receiver: GoPtr<Checker>, n: GoPtr<InferenceState>, source: GoPtr<Type>, target: GoPtr<Type>, constraintType: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferTypeForHomomorphicMappedType","kind":"method","status":"implemented","sigHash":"4cba3f18214a186fb35344206d4e25fc75ff2b3e9c918fe408cb809b02106d47","bodyHash":"1a0f825c9edc26a3d5597052a28e35db410bbd0fe28263a72110af72bfb30c1c"}
 *
 * Go source:
 * func (c *Checker) inferTypeForHomomorphicMappedType(source *Type, target *Type, constraint *Type) *Type {
 * 	key := ReverseMappedTypeKey{sourceId: source.id, targetId: target.id, constraintId: constraint.id}
 * 	if cached := c.reverseHomomorphicMappedCache[key]; cached != nil {
 * 		return cached
 * 	}
 * 	t := c.createReverseMappedType(source, target, constraint)
 * 	c.reverseHomomorphicMappedCache[key] = t
 * 	return t
 * }
 */
export declare function Checker_inferTypeForHomomorphicMappedType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.createReverseMappedType","kind":"method","status":"implemented","sigHash":"a0580ef08af3d9ff1ea7c7b3d1ed5b94b1ef4e684c51453f7f7f0cd98c9e8a69","bodyHash":"418bb1ce86751dcaaeb6303680730e04eb5e9c768775374307ec8b78adb537d5"}
 *
 * Go source:
 * func (c *Checker) createReverseMappedType(source *Type, target *Type, constraint *Type) *Type {
 * 	// We consider a source type reverse mappable if it has a string index signature or if
 * 	// it has one or more properties and is of a partially inferable type.
 * 	if !(c.getIndexInfoOfType(source, c.stringType) != nil || len(c.getPropertiesOfType(source)) != 0 && c.isPartiallyInferableType(source)) {
 * 		return nil
 * 	}
 * 	// For arrays and tuples we infer new arrays and tuples where the reverse mapping has been
 * 	// applied to the element type(s).
 * 	if c.isArrayType(source) {
 * 		elementType := c.inferReverseMappedType(c.getTypeArguments(source)[0], target, constraint)
 * 		if elementType == nil {
 * 			return nil
 * 		}
 * 		return c.createArrayTypeEx(elementType, c.isReadonlyArrayType(source))
 * 	}
 * 	if isTupleType(source) {
 * 		elementTypes := core.Map(c.getElementTypes(source), func(t *Type) *Type {
 * 			return c.inferReverseMappedType(t, target, constraint)
 * 		})
 * 		if !core.Every(elementTypes, func(t *Type) bool { return t != nil }) {
 * 			return nil
 * 		}
 * 		elementInfos := source.TargetTupleType().elementInfos
 * 		if getMappedTypeModifiers(target)&MappedTypeModifiersIncludeOptional != 0 {
 * 			elementInfos = core.SameMap(elementInfos, func(info TupleElementInfo) TupleElementInfo {
 * 				if info.flags&ElementFlagsOptional != 0 {
 * 					return TupleElementInfo{flags: ElementFlagsRequired, labeledDeclaration: info.labeledDeclaration}
 * 				}
 * 				return info
 * 			})
 * 		}
 * 		return c.createTupleTypeEx(elementTypes, elementInfos, source.TargetTupleType().readonly)
 * 	}
 * 	// For all other object types we infer a new object type where the reverse mapping has been
 * 	// applied to the type of each property.
 * 	reversed := c.newObjectType(ObjectFlagsReverseMapped|ObjectFlagsAnonymous, nil /*symbol* /)
 * 	reversed.AsReverseMappedType().source = source
 * 	reversed.AsReverseMappedType().mappedType = target
 * 	reversed.AsReverseMappedType().constraintType = constraint
 * 	return reversed
 * }
 */
export declare function Checker_createReverseMappedType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isPartiallyInferableType","kind":"method","status":"implemented","sigHash":"c4fd384722e021dce38629d9dadddae8bdf77b647f098384118f5703dabceb14","bodyHash":"6e6bb84cd378a1fc409e3bb3f3b4c20aa2da44a53dadf6126275be9e7bb86775"}
 *
 * Go source:
 * func (c *Checker) isPartiallyInferableType(t *Type) bool {
 * 	return t.objectFlags&ObjectFlagsNonInferrableType == 0 || isObjectLiteralType(t) && core.Some(c.getPropertiesOfType(t), func(prop *ast.Symbol) bool {
 * 		return c.isPartiallyInferableType(c.getTypeOfSymbol(prop))
 * 	}) || isTupleType(t) && core.Some(c.getElementTypes(t), c.isPartiallyInferableType)
 * }
 */
export declare function Checker_isPartiallyInferableType(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferReverseMappedType","kind":"method","status":"implemented","sigHash":"974c1dccfd7559ffab0fec2756581aaadfdc3341fb29de6112d9a88df8c6072d","bodyHash":"712e61a04ab59ea07520b443aa6ff0e7797be3c25c88f23c9f8115ac8bf334c1"}
 *
 * Go source:
 * func (c *Checker) inferReverseMappedType(source *Type, target *Type, constraint *Type) *Type {
 * 	key := ReverseMappedTypeKey{sourceId: source.id, targetId: target.id, constraintId: constraint.id}
 * 	if cached, ok := c.reverseMappedCache[key]; ok {
 * 		return core.OrElse(cached, c.unknownType)
 * 	}
 * 	c.reverseMappedSourceStack = append(c.reverseMappedSourceStack, source)
 * 	c.reverseMappedTargetStack = append(c.reverseMappedTargetStack, target)
 * 	saveExpandingFlags := c.reverseExpandingFlags
 * 	if c.isDeeplyNestedType(source, c.reverseMappedSourceStack, 2) {
 * 		c.reverseExpandingFlags |= ExpandingFlagsSource
 * 	}
 * 	if c.isDeeplyNestedType(target, c.reverseMappedTargetStack, 2) {
 * 		c.reverseExpandingFlags |= ExpandingFlagsTarget
 * 	}
 * 	var t *Type
 * 	if c.reverseExpandingFlags != ExpandingFlagsBoth {
 * 		t = c.inferReverseMappedTypeWorker(source, target, constraint)
 * 	}
 * 	c.reverseMappedSourceStack = c.reverseMappedSourceStack[:len(c.reverseMappedSourceStack)-1]
 * 	c.reverseMappedTargetStack = c.reverseMappedTargetStack[:len(c.reverseMappedTargetStack)-1]
 * 	c.reverseExpandingFlags = saveExpandingFlags
 * 	c.reverseMappedCache[key] = t
 * 	return t
 * }
 */
export declare function Checker_inferReverseMappedType(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferReverseMappedTypeWorker","kind":"method","status":"implemented","sigHash":"d45d698a71ee18179b9b2f4b88808da8970936efd60c35c39c38b69f7aed8fcb","bodyHash":"c54055f4d81c3b99b0c821901bfdb8888bc43e900b8923f0593a6857f1059e7e"}
 *
 * Go source:
 * func (c *Checker) inferReverseMappedTypeWorker(source *Type, target *Type, constraint *Type) *Type {
 * 	typeParameter := c.getIndexedAccessType(constraint.AsIndexType().target, c.getTypeParameterFromMappedType(target))
 * 	templateType := c.getTemplateTypeFromMappedType(target)
 * 	inference := newInferenceInfo(typeParameter)
 * 	c.inferTypes([]*InferenceInfo{inference}, source, templateType, InferencePriorityNone, false)
 * 	return c.getWidenedType(core.OrElse(c.getTypeFromInference(inference), c.unknownType))
 * }
 */
export declare function Checker_inferReverseMappedTypeWorker(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>, constraint: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.resolveReverseMappedTypeMembers","kind":"method","status":"implemented","sigHash":"73c9ddd7acce50cc5d7d02a991aab19314838481d09365386e5e44eee3cf02fb","bodyHash":"ee0281c2a247a3fbe1e9fb859fb54fc7aa36af89c4e28ea3f8f4d94c2823e772"}
 *
 * Go source:
 * func (c *Checker) resolveReverseMappedTypeMembers(t *Type) {
 * 	r := t.AsReverseMappedType()
 * 	indexInfo := c.getIndexInfoOfType(r.source, c.stringType)
 * 	modifiers := getMappedTypeModifiers(r.mappedType)
 * 	readonlyMask := modifiers&MappedTypeModifiersIncludeReadonly == 0
 * 	optionalMask := core.IfElse(modifiers&MappedTypeModifiersIncludeOptional != 0, 0, ast.SymbolFlagsOptional)
 * 	var indexInfos []*IndexInfo
 * 	if indexInfo != nil {
 * 		indexInfos = []*IndexInfo{c.newIndexInfo(c.stringType, core.OrElse(c.inferReverseMappedType(indexInfo.valueType, r.mappedType, r.constraintType), c.unknownType), readonlyMask && indexInfo.isReadonly, nil, nil)}
 * 	}
 * 	members := make(ast.SymbolTable)
 * 	limitedConstraint := c.getLimitedConstraint(t)
 * 	for _, prop := range c.getPropertiesOfType(r.source) {
 * 		// In case of a reverse mapped type with an intersection constraint, if we were able to
 * 		// extract the filtering type literals we skip those properties that are not assignable to them,
 * 		// because the extra properties wouldn't get through the application of the mapped type anyway
 * 		if limitedConstraint != nil {
 * 			propertyNameType := c.getLiteralTypeFromProperty(prop, TypeFlagsStringOrNumberLiteralOrUnique, false)
 * 			if !c.isTypeAssignableTo(propertyNameType, limitedConstraint) {
 * 				continue
 * 			}
 * 		}
 * 		checkFlags := ast.CheckFlagsReverseMapped | core.IfElse(readonlyMask && c.isReadonlySymbol(prop), ast.CheckFlagsReadonly, 0)
 * 		inferredProp := c.newSymbolEx(ast.SymbolFlagsProperty|prop.Flags&optionalMask, prop.Name, checkFlags)
 * 		inferredProp.Declarations = prop.Declarations
 * 		c.valueSymbolLinks.Get(inferredProp).nameType = c.valueSymbolLinks.Get(prop).nameType
 * 		links := c.ReverseMappedSymbolLinks.Get(inferredProp)
 * 		links.propertyType = c.getTypeOfSymbol(prop)
 * 		constraintTarget := r.constraintType.AsIndexType().target
 * 		if constraintTarget.flags&TypeFlagsIndexedAccess != 0 && constraintTarget.AsIndexedAccessType().objectType.flags&TypeFlagsTypeParameter != 0 && constraintTarget.AsIndexedAccessType().indexType.flags&TypeFlagsTypeParameter != 0 {
 * 			// A reverse mapping of `{[K in keyof T[K_1]]: T[K_1]}` is the same as that of `{[K in keyof T]: T}`, since all we care about is
 * 			// inferring to the "type parameter" (or indexed access) shared by the constraint and template. So, to reduce the number of
 * 			// type identities produced, we simplify such indexed access occurrences
 * 			newTypeParam := constraintTarget.AsIndexedAccessType().objectType
 * 			newMappedType := c.replaceIndexedAccess(r.mappedType, constraintTarget, newTypeParam)
 * 			links.mappedType = newMappedType
 * 			links.constraintType = c.getIndexType(newTypeParam)
 * 		} else {
 * 			links.mappedType = r.mappedType
 * 			links.constraintType = r.constraintType
 * 		}
 * 		members[prop.Name] = inferredProp
 * 	}
 * 	c.setStructuredTypeMembers(t, members, nil, nil, indexInfos)
 * }
 */
export declare function Checker_resolveReverseMappedTypeMembers(receiver: GoPtr<Checker>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getTypeOfReverseMappedSymbol","kind":"method","status":"implemented","sigHash":"bad369f4e192a64b9717c361c082df0a047076eec075a5eef9a0c804fe11c3bd","bodyHash":"c52cd61a8fbee3a020c45a81d93eddc790b301a259c8a2ba84871ebd3f812efe"}
 *
 * Go source:
 * func (c *Checker) getTypeOfReverseMappedSymbol(symbol *ast.Symbol) *Type {
 * 	links := c.valueSymbolLinks.Get(symbol)
 * 	if links.resolvedType == nil {
 * 		reverseLinks := c.ReverseMappedSymbolLinks.Get(symbol)
 * 		links.resolvedType = core.OrElse(c.inferReverseMappedType(reverseLinks.propertyType, reverseLinks.mappedType, reverseLinks.constraintType), c.unknownType)
 * 	}
 * 	return links.resolvedType
 * }
 */
export declare function Checker_getTypeOfReverseMappedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getLimitedConstraint","kind":"method","status":"implemented","sigHash":"b9bbc2bc1efe51336c54da327bbdb22edac82102f8b544960e5dab5a8a8baee3","bodyHash":"ef258f9e2d4872e5b01523ca0c1401e100b2921407e97926c0b5d89f444df8f6"}
 *
 * Go source:
 * func (c *Checker) getLimitedConstraint(t *Type) *Type {
 * 	constraint := c.getConstraintTypeFromMappedType(t.AsReverseMappedType().mappedType)
 * 	if !(constraint.flags&TypeFlagsUnion != 0 || constraint.flags&TypeFlagsIntersection != 0) {
 * 		return nil
 * 	}
 * 	origin := constraint
 * 	if constraint.flags&TypeFlagsUnion != 0 {
 * 		origin = constraint.AsUnionType().origin
 * 	}
 * 	if origin == nil || origin.flags&TypeFlagsIntersection == 0 {
 * 		return nil
 * 	}
 * 	constraintType := t.AsReverseMappedType().constraintType
 * 	limitedConstraint := c.getIntersectionType(core.Filter(origin.Types(), func(t *Type) bool { return t != constraintType }))
 * 	if limitedConstraint != c.neverType {
 * 		return limitedConstraint
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getLimitedConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.replaceIndexedAccess","kind":"method","status":"implemented","sigHash":"ab2619e727492f5a08e4c0fcb7ad78cfe8a371c1b641ad1aa4710c58b3f60c8c","bodyHash":"02a291cc78a51abcc1a7cec212b7a6c038435822a114e4f44842c4b4bfb3a50b"}
 *
 * Go source:
 * func (c *Checker) replaceIndexedAccess(instantiable *Type, t *Type, replacement *Type) *Type {
 * 	// map type.indexType to 0
 * 	// map type.objectType to `[TReplacement]`
 * 	// thus making the indexed access `[TReplacement][0]` or `TReplacement`
 * 	return c.instantiateType(instantiable, newTypeMapper([]*Type{t.AsIndexedAccessType().indexType, t.AsIndexedAccessType().objectType}, []*Type{c.getNumberLiteralType(0), c.createTupleType([]*Type{replacement})}))
 * }
 */
export declare function Checker_replaceIndexedAccess(receiver: GoPtr<Checker>, instantiable: GoPtr<Type>, t: GoPtr<Type>, replacement: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.typesDefinitelyUnrelated","kind":"method","status":"implemented","sigHash":"598fe60dd971ca8a59c607b91aa51b92c3b31018aeb4044ef4161cb8a06d5547","bodyHash":"93e7deedfc45cda64bd26fc8e1b8143fc1439ff1ee44822ac555da471fe2d852"}
 *
 * Go source:
 * func (c *Checker) typesDefinitelyUnrelated(source *Type, target *Type) bool {
 * 	// Two tuple types with incompatible arities are definitely unrelated.
 * 	// Two object types that each have a property that is unmatched in the other are definitely unrelated.
 * 	if isTupleType(source) && isTupleType(target) {
 * 		return tupleTypesDefinitelyUnrelated(source, target)
 * 	}
 * 	return c.getUnmatchedProperty(source, target, false /*requireOptionalProperties* /, true /*matchDiscriminantProperties* /) != nil &&
 * 		c.getUnmatchedProperty(target, source, false /*requireOptionalProperties* /, false /*matchDiscriminantProperties* /) != nil
 * }
 */
export declare function Checker_typesDefinitelyUnrelated(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::tupleTypesDefinitelyUnrelated","kind":"func","status":"implemented","sigHash":"f7b7c3b634f54df3780902b9ee2b60b8412b83e3b9fd33f9f16b731f19b28021","bodyHash":"320bfc08fb440ff6e1fb933d8d8460701583e6e90528818b0d4d3d0a5ce0ca76"}
 *
 * Go source:
 * func tupleTypesDefinitelyUnrelated(source *Type, target *Type) bool {
 * 	s := source.TargetTupleType()
 * 	t := target.TargetTupleType()
 * 	return t.combinedFlags&ElementFlagsVariadic == 0 && t.minLength > s.minLength ||
 * 		t.combinedFlags&ElementFlagsVariable == 0 && (s.combinedFlags&ElementFlagsVariable != 0 || t.fixedLength < s.fixedLength)
 * }
 */
export declare function tupleTypesDefinitelyUnrelated(source: GoPtr<Type>, target: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isTupleTypeStructureMatching","kind":"method","status":"implemented","sigHash":"b678fbe995e5e0f546464861b4e8bbe670c1b8f4259bb19ec28640063ce2c3b2","bodyHash":"57bbdeda6386f2214e89fb51fc7b56a1ae94a351297a6a7c65afe2aa22aece66"}
 *
 * Go source:
 * func (c *Checker) isTupleTypeStructureMatching(t1 *Type, t2 *Type) bool {
 * 	if c.getTypeReferenceArity(t1) != c.getTypeReferenceArity(t2) {
 * 		return false
 * 	}
 * 	for i, e := range t1.TargetTupleType().elementInfos {
 * 		if e.flags&ElementFlagsVariable != t2.TargetTupleType().elementInfos[i].flags&ElementFlagsVariable {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function Checker_isTupleTypeStructureMatching(receiver: GoPtr<Checker>, t1: GoPtr<Type>, t2: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isTypeOrBaseIdenticalTo","kind":"method","status":"implemented","sigHash":"de4383667689817e85397f24c646bc23981562071f74e06ba9384b55b7cf7375","bodyHash":"d9bf51d4d2732d347bc3ca227f9a197d98bd9dd4272bd93331e42bd769f5c289"}
 *
 * Go source:
 * func (c *Checker) isTypeOrBaseIdenticalTo(s *Type, t *Type) bool {
 * 	if t == c.missingType {
 * 		return s == t
 * 	}
 * 	return c.isTypeIdenticalTo(s, t) ||
 * 		t.flags&TypeFlagsString != 0 && s.flags&TypeFlagsStringLiteral != 0 ||
 * 		t.flags&TypeFlagsNumber != 0 && s.flags&TypeFlagsNumberLiteral != 0
 * }
 */
export declare function Checker_isTypeOrBaseIdenticalTo(receiver: GoPtr<Checker>, s: GoPtr<Type>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isTypeCloselyMatchedBy","kind":"method","status":"implemented","sigHash":"d8279b0b6de2d5a5f4c481f8c9691c244055d6e65d8dbb1a5cb31acbb4f261dc","bodyHash":"7abf4610a5bd0503d5d271439d99bc920deeaab39ce5e94856cabad63ea67191"}
 *
 * Go source:
 * func (c *Checker) isTypeCloselyMatchedBy(s *Type, t *Type) bool {
 * 	return s.flags&TypeFlagsObject != 0 && t.flags&TypeFlagsObject != 0 && s.symbol != nil && s.symbol == t.symbol ||
 * 		s.alias != nil && t.alias != nil && len(s.alias.typeArguments) != 0 && s.alias.symbol == t.alias.symbol
 * }
 */
export declare function Checker_isTypeCloselyMatchedBy(receiver: GoPtr<Checker>, s: GoPtr<Type>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.createEmptyObjectTypeFromStringLiteral","kind":"method","status":"implemented","sigHash":"a68c06e1f0c604edced63aef51bbf5f7c4a1dab34699b21622d22cc95c0b3545","bodyHash":"4fa0aba765d410e308afd316dae35c2b28933359ced1028d196592ef087a598e"}
 *
 * Go source:
 * func (c *Checker) createEmptyObjectTypeFromStringLiteral(t *Type) *Type {
 * 	members := make(ast.SymbolTable)
 * 	for _, t := range t.Distributed() {
 * 		if t.flags&TypeFlagsStringLiteral == 0 {
 * 			continue
 * 		}
 * 		name := getStringLiteralValue(t)
 * 		literalProp := c.newSymbol(ast.SymbolFlagsProperty, name)
 * 		c.valueSymbolLinks.Get(literalProp).resolvedType = c.anyType
 * 		if t.symbol != nil {
 * 			literalProp.Declarations = t.symbol.Declarations
 * 			literalProp.ValueDeclaration = t.symbol.ValueDeclaration
 * 		}
 * 		members[name] = literalProp
 * 	}
 * 	var indexInfos []*IndexInfo
 * 	if t.flags&TypeFlagsString != 0 {
 * 		indexInfos = []*IndexInfo{c.newIndexInfo(c.stringType, c.emptyObjectType, false /*isReadonly* /, nil, nil)}
 * 	}
 * 	return c.newAnonymousType(nil, members, nil, nil, indexInfos)
 * }
 */
export declare function Checker_createEmptyObjectTypeFromStringLiteral(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.newInferenceContext","kind":"method","status":"implemented","sigHash":"9d9eadeccda34131298ae31ead0aad3c05a3b90fedefb33d9f8464e9b7784864","bodyHash":"9862fab9f76519c52d757b8b1c4c1c083d81b39fe77280b4011f889bd0bb5572"}
 *
 * Go source:
 * func (c *Checker) newInferenceContext(typeParameters []*Type, signature *Signature, flags InferenceFlags, compareTypes TypeComparer) *InferenceContext {
 * 	if compareTypes == nil {
 * 		compareTypes = c.compareTypesAssignable
 * 	}
 * 	return c.newInferenceContextWorker(core.Map(typeParameters, newInferenceInfo), signature, flags, compareTypes)
 * }
 */
export declare function Checker_newInferenceContext(receiver: GoPtr<Checker>, typeParameters: GoSlice<GoPtr<Type>>, signature: GoPtr<Signature>, flags: InferenceFlags, compareTypes: TypeComparer | undefined): GoPtr<InferenceContext>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.cloneInferenceContext","kind":"method","status":"implemented","sigHash":"b528c8557efc41276497cfd0a0ece81df38ffc94e84beb7e3bce2cd5ff238da8","bodyHash":"f6e00d8c073892864f75139c1caa233e8ef774e4d4a50f84b0a1ad50c7a6a090"}
 *
 * Go source:
 * func (c *Checker) cloneInferenceContext(n *InferenceContext, extraFlags InferenceFlags) *InferenceContext {
 * 	if n == nil {
 * 		return nil
 * 	}
 * 	return c.newInferenceContextWorker(core.Map(n.inferences, cloneInferenceInfo), n.signature, n.flags|extraFlags, n.compareTypes)
 * }
 */
export declare function Checker_cloneInferenceContext(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>, extraFlags: InferenceFlags): GoPtr<InferenceContext>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.cloneInferredPartOfContext","kind":"method","status":"implemented","sigHash":"5494df88169cd173775b5f3ee1adbec489ccace52f60371081cfcdf04a80d9fd","bodyHash":"4556cd82622a921a32b3e5f484e133d41af729c94b5a93e5c31432d7c9394628"}
 *
 * Go source:
 * func (c *Checker) cloneInferredPartOfContext(n *InferenceContext) *InferenceContext {
 * 	inferences := core.Filter(n.inferences, hasInferenceCandidates)
 * 	if len(inferences) == 0 {
 * 		return nil
 * 	}
 * 	return c.newInferenceContextWorker(core.Map(inferences, cloneInferenceInfo), n.signature, n.flags, n.compareTypes)
 * }
 */
export declare function Checker_cloneInferredPartOfContext(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>): GoPtr<InferenceContext>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.newInferenceContextWorker","kind":"method","status":"implemented","sigHash":"59fccbc304520d0e5bd1f60884e44dc146d0792a36b7732eb31419c430c3bbef","bodyHash":"b968d990f2712e0aa186d860a1916dbc77ac0656ddda0362ba25e00593e4487d"}
 *
 * Go source:
 * func (c *Checker) newInferenceContextWorker(inferences []*InferenceInfo, signature *Signature, flags InferenceFlags, compareTypes TypeComparer) *InferenceContext {
 * 	n := &InferenceContext{
 * 		inferences:   inferences,
 * 		signature:    signature,
 * 		flags:        flags,
 * 		compareTypes: compareTypes,
 * 	}
 * 	n.mapper = c.newInferenceTypeMapper(n, true /*fixing* /)
 * 	n.nonFixingMapper = c.newInferenceTypeMapper(n, false /*fixing* /)
 * 	return n
 * }
 */
export declare function Checker_newInferenceContextWorker(receiver: GoPtr<Checker>, inferences: GoSlice<GoPtr<InferenceInfo>>, signature: GoPtr<Signature>, flags: InferenceFlags, compareTypes: TypeComparer): GoPtr<InferenceContext>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.addIntraExpressionInferenceSite","kind":"method","status":"implemented","sigHash":"70c18c660739d5b3e4243ece9e777f0e93f91ee38b86f886c3828552f7940c39","bodyHash":"78271f2d3b8fd6ac2cd7efc0ed742c054a54843e07ce7afbe9f6b98cf3a2c81d"}
 *
 * Go source:
 * func (c *Checker) addIntraExpressionInferenceSite(n *InferenceContext, node *ast.Node, t *Type) {
 * 	n.intraExpressionInferenceSites = append(n.intraExpressionInferenceSites, IntraExpressionInferenceSite{node: node, t: t})
 * }
 */
export declare function Checker_addIntraExpressionInferenceSite(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>, node: GoPtr<Node>, t: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.inferFromIntraExpressionSites","kind":"method","status":"implemented","sigHash":"fe6c9d866b17472080941654c236f9941a730b34c341eea1ec49db87349c3eb6","bodyHash":"d946a8e22e7c3ffdd3baadd3d1ed1934bbe6ebe9a383b1357bbbd980ca972e1e"}
 *
 * Go source:
 * func (c *Checker) inferFromIntraExpressionSites(n *InferenceContext) {
 * 	for _, site := range n.intraExpressionInferenceSites {
 * 		var contextualType *Type
 * 		if ast.IsMethodDeclaration(site.node) {
 * 			contextualType = c.getContextualTypeForObjectLiteralMethod(site.node, ContextFlagsNoConstraints)
 * 		} else {
 * 			contextualType = c.getContextualType(site.node, ContextFlagsNoConstraints)
 * 		}
 * 		if contextualType != nil {
 * 			c.inferTypes(n.inferences, site.t, contextualType, InferencePriorityNone, false)
 * 		}
 * 	}
 * 	n.intraExpressionInferenceSites = nil
 * }
 */
export declare function Checker_inferFromIntraExpressionSites(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getInferredType","kind":"method","status":"implemented","sigHash":"436a997c39ab435c05948be5e6daf128288aeec093ec139ffeb8092f98b82931","bodyHash":"93777b5af3ccc033fc95ecbba08bb7460666f77b99316c7a4447ed1d127cc4ac"}
 *
 * Go source:
 * func (c *Checker) getInferredType(n *InferenceContext, index int) *Type {
 * 	inference := n.inferences[index]
 * 	if inference.inferredType == nil {
 * 		if inference.typeParameter == c.errorType {
 * 			return inference.typeParameter
 * 		}
 * 		var inferredType *Type
 * 		var fallbackType *Type
 * 		if n.signature != nil {
 * 			var inferredCovariantType *Type
 * 			if len(inference.candidates) != 0 {
 * 				inferredCovariantType = c.getCovariantInference(inference, n.signature)
 * 			}
 * 			var inferredContravariantType *Type
 * 			if len(inference.contraCandidates) != 0 {
 * 				inferredContravariantType = c.getContravariantInference(inference)
 * 			}
 * 			if inferredCovariantType != nil || inferredContravariantType != nil {
 * 				// If we have both co- and contra-variant inferences, we prefer the co-variant inference if it is not 'never',
 * 				// all co-variant inferences are assignable to it (i.e. it isn't one of a conflicting set of candidates), it is
 * 				// assignable to some contra-variant inference, and no other type parameter is constrained to this type parameter
 * 				// and has inferences that would conflict. Otherwise, we prefer the contra-variant inference.
 * 				// Similarly ignore co-variant `any` inference when both are available as almost everything is assignable to it
 * 				// and it would spoil the overall inference.
 * 				preferCovariantType := inferredCovariantType != nil && (inferredContravariantType == nil ||
 * 					inferredCovariantType.flags&(TypeFlagsNever|TypeFlagsAny) == 0 &&
 * 						core.Some(inference.contraCandidates, func(t *Type) bool { return c.isTypeAssignableTo(inferredCovariantType, t) }) &&
 * 						core.Every(n.inferences, func(other *InferenceInfo) bool {
 * 							return other != inference && c.getConstraintOfTypeParameter(other.typeParameter) != inference.typeParameter ||
 * 								core.Every(other.candidates, func(t *Type) bool { return c.isTypeAssignableTo(t, inferredCovariantType) })
 * 						}))
 * 				if preferCovariantType {
 * 					inferredType = inferredCovariantType
 * 					fallbackType = inferredContravariantType
 * 				} else {
 * 					inferredType = inferredContravariantType
 * 					fallbackType = inferredCovariantType
 * 				}
 * 			} else if n.flags&InferenceFlagsNoDefault != 0 {
 * 				// We use silentNeverType as the wildcard that signals no inferences.
 * 				inferredType = c.silentNeverType
 * 			} else {
 * 				// Infer either the default or the empty object type when no inferences were
 * 				// made. It is important to remember that in this case, inference still
 * 				// succeeds, meaning there is no error for not having inference candidates. An
 * 				// inference error only occurs when there are *conflicting* candidates, i.e.
 * 				// candidates with no common supertype.
 * 				defaultType := c.getDefaultFromTypeParameter(inference.typeParameter)
 * 				if defaultType != nil {
 * 					// Instantiate the default type. Any forward reference to a type
 * 					// parameter should be instantiated to the empty object type.
 * 					inferredType = c.instantiateType(defaultType, mergeTypeMappers(c.newBackreferenceMapper(n, index), n.nonFixingMapper))
 * 				}
 * 			}
 * 		} else {
 * 			inferredType = c.getTypeFromInference(inference)
 * 		}
 * 		inference.inferredType = inferredType
 * 		if inference.inferredType == nil {
 * 			inference.inferredType = core.IfElse(n.flags&InferenceFlagsAnyDefault != 0, c.anyType, c.unknownType)
 * 		}
 * 		constraint := c.getConstraintOfTypeParameter(inference.typeParameter)
 * 		if constraint != nil {
 * 			instantiatedConstraint := c.instantiateType(constraint, n.nonFixingMapper)
 * 			if inferredType != nil {
 * 				constraintWithThis := c.getTypeWithThisArgument(instantiatedConstraint, inferredType, false)
 * 				if n.compareTypes(inferredType, constraintWithThis, false) == TernaryFalse {
 * 					var filteredByConstraint *Type
 * 					if inference.priority == InferencePriorityReturnType {
 * 						// If we have a pure return type inference, we may succeed by removing constituents of the inferred type
 * 						// that aren't assignable to the constraint type (pure return type inferences are speculation anyway).
 * 						filteredByConstraint = c.mapType(inferredType, func(t *Type) *Type {
 * 							return core.IfElse(n.compareTypes(t, constraintWithThis, false) != TernaryFalse, t, c.neverType)
 * 						})
 * 					}
 * 					inferredType = core.IfElse(filteredByConstraint != nil && filteredByConstraint.flags&TypeFlagsNever == 0, filteredByConstraint, nil)
 * 				}
 * 			}
 * 			if inferredType == nil {
 * 				// If the fallback type satisfies the constraint, we pick it. Otherwise, we pick the constraint.
 * 				inferredType = core.IfElse(fallbackType != nil && n.compareTypes(fallbackType, c.getTypeWithThisArgument(instantiatedConstraint, fallbackType, false), false) != TernaryFalse, fallbackType, instantiatedConstraint)
 * 			}
 * 			inference.inferredType = inferredType
 * 		}
 * 		c.clearActiveMapperCaches()
 * 	}
 * 	return inference.inferredType
 * }
 */
export declare function Checker_getInferredType(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>, index: int): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getInferredTypes","kind":"method","status":"implemented","sigHash":"583f4f1e0f9c25a4c2c1d4ffaf143891a04e1d015f045ff471b808ad79c3ddb2","bodyHash":"a17d4f3623701add598b4ada989e11af2326258e92310b0f5ff601b09565b9ee"}
 *
 * Go source:
 * func (c *Checker) getInferredTypes(n *InferenceContext) []*Type {
 * 	result := make([]*Type, len(n.inferences))
 * 	for i := range n.inferences {
 * 		result[i] = c.getInferredType(n, i)
 * 	}
 * 	return result
 * }
 */
export declare function Checker_getInferredTypes(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getMapperFromContext","kind":"method","status":"implemented","sigHash":"35d9fa0e0c9e8a543a505e9b26097d2c4988dbfbc17f258da5a78058ceeb15d7","bodyHash":"f74bfc3dd191a2a5db7eb9d9b3f35b7d4d0f632f1f3f75626d050b031a03388a"}
 *
 * Go source:
 * func (c *Checker) getMapperFromContext(n *InferenceContext) *TypeMapper {
 * 	if n == nil {
 * 		return nil
 * 	}
 * 	return n.mapper
 * }
 */
export declare function Checker_getMapperFromContext(receiver: GoPtr<Checker>, n: GoPtr<InferenceContext>): GoPtr<TypeMapper>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.createOuterReturnMapper","kind":"method","status":"implemented","sigHash":"9f16c4f3842e8c70de181bc3d19443fba103fbe7a1885836c5bbed762f4d16b7","bodyHash":"3ff69f66861630764636e7c47d4337bf9590de9d1d9013b45a2d4e1bf4a851d2"}
 *
 * Go source:
 * func (c *Checker) createOuterReturnMapper(context *InferenceContext) *TypeMapper {
 * 	if context.outerReturnMapper == nil {
 * 		mapper := c.cloneInferenceContext(context, InferenceFlagsNone).mapper
 * 		if context.returnMapper != nil {
 * 			mapper = newMergedTypeMapper(context.returnMapper, mapper)
 * 		}
 * 		context.outerReturnMapper = mapper
 * 	}
 * 	return context.outerReturnMapper
 * }
 */
export declare function Checker_createOuterReturnMapper(receiver: GoPtr<Checker>, context: GoPtr<InferenceContext>): GoPtr<TypeMapper>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getCovariantInference","kind":"method","status":"implemented","sigHash":"8ee8b6d1b614215a709734f80d63d28aae9572278501fb9d95c8a969afaca3fd","bodyHash":"96940c39de4293b4cdfb8d740694cb83f034d911a0e99ecc3e75a5cac91f6e72"}
 *
 * Go source:
 * func (c *Checker) getCovariantInference(inference *InferenceInfo, signature *Signature) *Type {
 * 	// Extract all object and array literal types and replace them with a single widened and normalized type.
 * 	candidates := c.unionObjectAndArrayLiteralCandidates(inference.candidates)
 * 	// We widen inferred literal types if
 * 	// all inferences were made to top-level occurrences of the type parameter, and
 * 	// the type parameter has no constraint or its constraint includes no primitive or literal types, and
 * 	// the type parameter was fixed during inference or does not occur at top-level in the return type.
 * 	primitiveConstraint := c.hasPrimitiveConstraint(inference.typeParameter) || c.isConstTypeVariable(inference.typeParameter, 0)
 * 	widenLiteralTypes := !primitiveConstraint && inference.topLevel && (inference.isFixed || !c.isTypeParameterAtTopLevelInReturnType(signature, inference.typeParameter))
 * 	var baseCandidates []*Type
 * 	switch {
 * 	case primitiveConstraint:
 * 		baseCandidates = core.SameMap(candidates, c.getRegularTypeOfLiteralType)
 * 	case widenLiteralTypes:
 * 		baseCandidates = core.SameMap(candidates, c.getWidenedLiteralType)
 * 	default:
 * 		baseCandidates = candidates
 * 	}
 * 	// If all inferences were made from a position that implies a combined result, infer a union type.
 * 	// Otherwise, infer a common supertype.
 * 	var unwidenedType *Type
 * 	if inference.priority&InferencePriorityPriorityImpliesCombination != 0 {
 * 		unwidenedType = c.getUnionTypeEx(baseCandidates, UnionReductionSubtype, nil, nil)
 * 	} else {
 * 		unwidenedType = c.getCommonSupertype(baseCandidates)
 * 	}
 * 	return c.getWidenedType(unwidenedType)
 * }
 */
export declare function Checker_getCovariantInference(receiver: GoPtr<Checker>, inference: GoPtr<InferenceInfo>, signature: GoPtr<Signature>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getContravariantInference","kind":"method","status":"implemented","sigHash":"b427074a49c090693dcd22621aa167322c19cbc58cc16024015133ce4afd02ce","bodyHash":"9d2c1e0a6d9ba46c86278ddde6c02eed2aeb50ade691d56df75fffa0799c46c5"}
 *
 * Go source:
 * func (c *Checker) getContravariantInference(inference *InferenceInfo) *Type {
 * 	if inference.priority&InferencePriorityPriorityImpliesCombination != 0 {
 * 		return c.getIntersectionType(inference.contraCandidates)
 * 	}
 * 	return c.getCommonSubtype(inference.contraCandidates)
 * }
 */
export declare function Checker_getContravariantInference(receiver: GoPtr<Checker>, inference: GoPtr<InferenceInfo>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.unionObjectAndArrayLiteralCandidates","kind":"method","status":"implemented","sigHash":"d29654e592b0fa2db4241a6aeff1efe6ddeff595d003c3b2a7a73303b1fcc070","bodyHash":"7536462343a0bd36d6b7d92a1192d620037630ca262ac81070e106b49819573a"}
 *
 * Go source:
 * func (c *Checker) unionObjectAndArrayLiteralCandidates(candidates []*Type) []*Type {
 * 	if len(candidates) > 1 {
 * 		objectLiterals := core.Filter(candidates, isObjectOrArrayLiteralType)
 * 		if len(objectLiterals) != 0 {
 * 			literalsType := c.getUnionTypeEx(objectLiterals, UnionReductionSubtype, nil, nil)
 * 			nonLiteralTypes := core.Filter(candidates, func(t *Type) bool { return !isObjectOrArrayLiteralType(t) })
 * 			return core.Concatenate(nonLiteralTypes, []*Type{literalsType})
 * 		}
 * 	}
 * 	return candidates
 * }
 */
export declare function Checker_unionObjectAndArrayLiteralCandidates(receiver: GoPtr<Checker>, candidates: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.hasPrimitiveConstraint","kind":"method","status":"implemented","sigHash":"4e8b08c5cb250dff58992b60e84690476edb9226d10f78c7bb45f5eaa7237b58","bodyHash":"41893395075b0dda1affd60b60ed525bccbbcb04e85ae0ae4642b21cd03c2340"}
 *
 * Go source:
 * func (c *Checker) hasPrimitiveConstraint(t *Type) bool {
 * 	constraint := c.getConstraintOfTypeParameter(t)
 * 	if constraint != nil {
 * 		if constraint.flags&TypeFlagsConditional != 0 {
 * 			constraint = c.getDefaultConstraintOfConditionalType(constraint)
 * 		}
 * 		return c.maybeTypeOfKind(constraint, TypeFlagsPrimitive|TypeFlagsIndex|TypeFlagsTemplateLiteral|TypeFlagsStringMapping)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_hasPrimitiveConstraint(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isTypeParameterAtTopLevel","kind":"method","status":"implemented","sigHash":"92a91dd8fd28fb263c767ee5d1a5af0279184c7e6e1c932d7686c573533e14c7","bodyHash":"6b18a0c100c5d22a615ea5021d0ad44ecde9ac01db427bf92e5bbb10cea7840c"}
 *
 * Go source:
 * func (c *Checker) isTypeParameterAtTopLevel(t *Type, tp *Type, depth int) bool {
 * 	return t == tp ||
 * 		t.flags&TypeFlagsUnionOrIntersection != 0 && core.Some(t.Types(), func(t *Type) bool { return c.isTypeParameterAtTopLevel(t, tp, depth) }) ||
 * 		depth < 3 && t.flags&TypeFlagsConditional != 0 &&
 * 			(c.isTypeParameterAtTopLevel(c.getTrueTypeFromConditionalType(t), tp, depth+1) ||
 * 				c.isTypeParameterAtTopLevel(c.getFalseTypeFromConditionalType(t), tp, depth+1))
 * }
 */
export declare function Checker_isTypeParameterAtTopLevel(receiver: GoPtr<Checker>, t: GoPtr<Type>, tp: GoPtr<Type>, depth: int): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isTypeParameterAtTopLevelInReturnType","kind":"method","status":"implemented","sigHash":"3339484dba66835cb052ff42ecc416df5c9e14f8f236b496e8104ce6fba5dbf9","bodyHash":"c55f42de0f95b4bb6372ff24d9773942a2ec16991a84a07cea6f6075ca1745b7"}
 *
 * Go source:
 * func (c *Checker) isTypeParameterAtTopLevelInReturnType(signature *Signature, typeParameter *Type) bool {
 * 	typePredicate := c.getTypePredicateOfSignature(signature)
 * 	if typePredicate != nil {
 * 		return typePredicate.t != nil && c.isTypeParameterAtTopLevel(typePredicate.t, typeParameter, 0)
 * 	}
 * 	return c.isTypeParameterAtTopLevel(c.getReturnTypeOfSignature(signature), typeParameter, 0)
 * }
 */
export declare function Checker_isTypeParameterAtTopLevelInReturnType(receiver: GoPtr<Checker>, signature: GoPtr<Signature>, typeParameter: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getTypeFromInference","kind":"method","status":"implemented","sigHash":"6527ce679905978335a72c3f6d99fc74e3289921157a6d0d9db84b70752f5f07","bodyHash":"2c43c0ef65a0e72f5e7e5a8bdea04e714d6bbe7147d309e0fed6ba26d57772d3"}
 *
 * Go source:
 * func (c *Checker) getTypeFromInference(inference *InferenceInfo) *Type {
 * 	switch {
 * 	case inference.candidates != nil:
 * 		return c.getUnionTypeEx(inference.candidates, UnionReductionSubtype, nil, nil)
 * 	case inference.contraCandidates != nil:
 * 		return c.getIntersectionType(inference.contraCandidates)
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_getTypeFromInference(receiver: GoPtr<Checker>, inference: GoPtr<InferenceInfo>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::getInferenceInfoForType","kind":"func","status":"implemented","sigHash":"6dc30468afb4f833a0b7d2894ac199dfdd760843425c269c8ade9569f9171ff0","bodyHash":"7be652ec21307a1324631ff580d189454dd2e765868cbfa6821bf7543e7f3a95"}
 *
 * Go source:
 * func getInferenceInfoForType(n *InferenceState, t *Type) *InferenceInfo {
 * 	if t.flags&TypeFlagsTypeVariable != 0 {
 * 		for _, inference := range n.inferences {
 * 			if t == inference.typeParameter {
 * 				return inference
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function getInferenceInfoForType(n: GoPtr<InferenceState>, t: GoPtr<Type>): GoPtr<InferenceInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getCommonSupertype","kind":"method","status":"implemented","sigHash":"a2aeb838ef13f722866f72f28cae2d0e5305b1f0bbf9e6cc3f881ab5ccc89a66","bodyHash":"40572e350761402336729d701089a44cb9cb04693db5d776fcd5e9645fa175bc"}
 *
 * Go source:
 * func (c *Checker) getCommonSupertype(types []*Type) *Type {
 * 	if len(types) == 1 {
 * 		return types[0]
 * 	}
 * 	// Remove nullable types from each of the candidates.
 * 	primaryTypes := types
 * 	if c.strictNullChecks {
 * 		primaryTypes = core.SameMap(types, func(t *Type) *Type {
 * 			return c.filterType(t, func(u *Type) bool { return u.flags&TypeFlagsNullable == 0 })
 * 		})
 * 	}
 * 	// When the candidate types are all literal types with the same base type, return a union
 * 	// of those literal types. Otherwise, return the leftmost type for which no type to the
 * 	// right is a supertype.
 * 	var supertype *Type
 * 	if c.literalTypesWithSameBaseType(primaryTypes) {
 * 		supertype = c.getUnionType(primaryTypes)
 * 	} else {
 * 		supertype = c.getSingleCommonSupertype(primaryTypes)
 * 	}
 * 	// Add any nullable types that occurred in the candidates back to the result.
 * 	if core.Same(primaryTypes, types) {
 * 		return supertype
 * 	}
 * 	return c.getNullableType(supertype, c.getCombinedTypeFlags(types)&TypeFlagsNullable)
 * }
 */
export declare function Checker_getCommonSupertype(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getSingleCommonSupertype","kind":"method","status":"implemented","sigHash":"ee451f49830c1b5014012d1be9fb5e19ae9f1dece2f0820498a7af50d32be90b","bodyHash":"2b7d1a341dc3dc6073f4e6784549600665d8e9bd24ed0ebfc8c854e620f37d7f"}
 *
 * Go source:
 * func (c *Checker) getSingleCommonSupertype(types []*Type) *Type {
 * 	// First, find the leftmost type for which no type to the right is a strict supertype, and if that
 * 	// type is a strict supertype of all other candidates, return it. Otherwise, return the leftmost type
 * 	// for which no type to the right is a (regular) supertype.
 * 	candidate := c.findLeftmostType(types, (*Checker).isTypeStrictSubtypeOf)
 * 	if core.Every(types, func(t *Type) bool { return t == candidate || c.isTypeStrictSubtypeOf(t, candidate) }) {
 * 		return candidate
 * 	}
 * 	return c.findLeftmostType(types, (*Checker).isTypeSubtypeOf)
 * }
 */
export declare function Checker_getSingleCommonSupertype(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.findLeftmostType","kind":"method","status":"implemented","sigHash":"3ab31df0cdb61deb752bbb158879ac0b3cff778dfce47b146b2787970b71329b","bodyHash":"923485be0a3d60e542c608a36ebeeef3c301c1e3ffefa846f34bfb2bf384dbc2"}
 *
 * Go source:
 * func (c *Checker) findLeftmostType(types []*Type, f func(c *Checker, s *Type, t *Type) bool) *Type {
 * 	var candidate *Type
 * 	for _, t := range types {
 * 		if candidate == nil || f(c, candidate, t) {
 * 			candidate = t
 * 		}
 * 	}
 * 	return candidate
 * }
 */
export declare function Checker_findLeftmostType(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>, f: (c: GoPtr<Checker>, s: GoPtr<Type>, t: GoPtr<Type>) => bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getCommonSubtype","kind":"method","status":"implemented","sigHash":"78071e4485bb19dca5764c3fbe9234a4a1637b94369229b67930d65fb79258b7","bodyHash":"4d0ed1d8cdd89b30022b3d49da6d082db9b3b9fdbf08e06d7748787ac1b56040"}
 *
 * Go source:
 * func (c *Checker) getCommonSubtype(types []*Type) *Type {
 * 	var subtype *Type
 * 	for _, t := range types {
 * 		if subtype == nil || c.isTypeSubtypeOf(t, subtype) {
 * 			subtype = t
 * 		}
 * 	}
 * 	return subtype
 * }
 */
export declare function Checker_getCommonSubtype(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.getCombinedTypeFlags","kind":"method","status":"implemented","sigHash":"a430ab1e505ad7152cf8f3ec98c1e5f1ae600d62eea3b1191af30524362081f2","bodyHash":"f5e612b2c567f9001c67ef49ae349c7049e0be56cd69266528e26db63cd7e32f"}
 *
 * Go source:
 * func (c *Checker) getCombinedTypeFlags(types []*Type) TypeFlags {
 * 	flags := TypeFlagsNone
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsUnion != 0 {
 * 			flags |= c.getCombinedTypeFlags(t.Types())
 * 		} else {
 * 			flags |= t.flags
 * 		}
 * 	}
 * 	return flags
 * }
 */
export declare function Checker_getCombinedTypeFlags(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): TypeFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.literalTypesWithSameBaseType","kind":"method","status":"implemented","sigHash":"ee6c941b3f5a1c327b7eda793a50c1a4bef43ffc744d54b4a5aa457a663dbdb3","bodyHash":"bb5b8443c256488d0a8d28118d62f6fb368fed5130ea961c140b21801a462749"}
 *
 * Go source:
 * func (c *Checker) literalTypesWithSameBaseType(types []*Type) bool {
 * 	var commonBaseType *Type
 * 	for _, t := range types {
 * 		if t.flags&TypeFlagsNever == 0 {
 * 			baseType := c.getBaseTypeOfLiteralType(t)
 * 			if commonBaseType == nil {
 * 				commonBaseType = baseType
 * 			}
 * 			if baseType == t || baseType != commonBaseType {
 * 				return false
 * 			}
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function Checker_literalTypesWithSameBaseType(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isFromInferenceBlockedSource","kind":"method","status":"implemented","sigHash":"ae885bf9c1cff1d87daae785e240c67b51d54628741ac21a9efca1dfbf74cb09","bodyHash":"b9d2aa4ae89acdbaab1c5d66373143ec5861f7ce6a30cae0da6ac775e2f85a3a"}
 *
 * Go source:
 * func (c *Checker) isFromInferenceBlockedSource(t *Type) bool {
 * 	return t.symbol != nil && core.Some(t.symbol.Declarations, c.isSkipDirectInferenceNode)
 * }
 */
export declare function Checker_isFromInferenceBlockedSource(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.isSkipDirectInferenceNode","kind":"method","status":"implemented","sigHash":"c014130cd446a3724dc2ebc489998d146746cc81837a2eac828054cca6784540","bodyHash":"eb7f8c3bdfb6aacecaa26ab1a46f1490ccc8aa4a2786724117cd0b8ec2236257"}
 *
 * Go source:
 * func (c *Checker) isSkipDirectInferenceNode(node *ast.Node) bool {
 * 	return c.skipDirectInferenceNodes.Has(node)
 * }
 */
export declare function Checker_isSkipDirectInferenceNode(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::newInferenceInfo","kind":"func","status":"implemented","sigHash":"e28df7f6bec1c7ec663ccdeae1afe71df15b37fac35b93e388c4e32522a14df6","bodyHash":"be1f3d2440bd0c726d25365d0ecf7043d95ebb34e448639eb5579e8691faf662"}
 *
 * Go source:
 * func newInferenceInfo(typeParameter *Type) *InferenceInfo {
 * 	return &InferenceInfo{typeParameter: typeParameter, priority: InferencePriorityMaxValue, topLevel: true, impliedArity: -1}
 * }
 */
export declare function newInferenceInfo(typeParameter: GoPtr<Type>): GoPtr<InferenceInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::cloneInferenceInfo","kind":"func","status":"implemented","sigHash":"f99201cb5ec216c33f77ead613a44bb0f16b000c0ccd516f08ba2b1c76189bd8","bodyHash":"8375c797df0bef3c982c65ca8f664fb2ec99401accf1204d63d2d635b2cf86e7"}
 *
 * Go source:
 * func cloneInferenceInfo(info *InferenceInfo) *InferenceInfo {
 * 	return &InferenceInfo{
 * 		typeParameter:    info.typeParameter,
 * 		candidates:       slices.Clone(info.candidates),
 * 		contraCandidates: slices.Clone(info.contraCandidates),
 * 		inferredType:     info.inferredType,
 * 		priority:         info.priority,
 * 		topLevel:         info.topLevel,
 * 		isFixed:          info.isFixed,
 * 		impliedArity:     info.impliedArity,
 * 	}
 * }
 */
export declare function cloneInferenceInfo(info: GoPtr<InferenceInfo>): GoPtr<InferenceInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::clearCachedInferences","kind":"func","status":"implemented","sigHash":"9548eacb14d0d7d0b0ca1c15f57a8b7c733305e21fd32cdaac4dd0708e9a5a90","bodyHash":"2187bffff0cd5da4210ab4954b1f52eb7c51a5b87180934cd75dd75606c7efaf"}
 *
 * Go source:
 * func clearCachedInferences(inferences []*InferenceInfo) {
 * 	for _, inference := range inferences {
 * 		if !inference.isFixed {
 * 			inference.inferredType = nil
 * 		}
 * 	}
 * }
 */
export declare function clearCachedInferences(inferences: GoSlice<GoPtr<InferenceInfo>>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::hasInferenceCandidates","kind":"func","status":"implemented","sigHash":"23c108297f792f1ee582b0b1c556bdb8dd1bdc7bc7de0dd6dd91b3f29a5a9a33","bodyHash":"a4ed319f711447dc68a73b538196cf1c906a6899f394fbb0db70463b8e4cb696"}
 *
 * Go source:
 * func hasInferenceCandidates(info *InferenceInfo) bool {
 * 	return len(info.candidates) != 0 || len(info.contraCandidates) != 0
 * }
 */
export declare function hasInferenceCandidates(info: GoPtr<InferenceInfo>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::hasInferenceCandidatesOrDefault","kind":"func","status":"implemented","sigHash":"54950d22e067691420244e06a6fbc594c255ded90cb31348fd6eef520aea1e3b","bodyHash":"88fafc288a982269f2771ba59234b217b854457cb5a4303a147d7f1741ed4af7"}
 *
 * Go source:
 * func hasInferenceCandidatesOrDefault(info *InferenceInfo) bool {
 * 	return info.candidates != nil || info.contraCandidates != nil || hasTypeParameterDefault(info.typeParameter)
 * }
 */
export declare function hasInferenceCandidatesOrDefault(info: GoPtr<InferenceInfo>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::hasTypeParameterDefault","kind":"func","status":"implemented","sigHash":"08b04fa427001f2a8524d03f79aefac9fbc6059fb2c22004208bdc885aefd10b","bodyHash":"9324e115c0f1e7399a9573174929e51cdc26f84bc89d19cab34e3132d36e6231"}
 *
 * Go source:
 * func hasTypeParameterDefault(tp *Type) bool {
 * 	if tp.symbol != nil {
 * 		for _, d := range tp.symbol.Declarations {
 * 			if ast.IsTypeParameterDeclaration(d) && d.AsTypeParameterDeclaration().DefaultType != nil {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function hasTypeParameterDefault(tp: GoPtr<Type>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::func::hasOverlappingInferences","kind":"func","status":"implemented","sigHash":"0de84bb5324d9094fe318c19033cd706ca3e1d4da86692fb627a61d17a0baf52","bodyHash":"4801d81d98be861427f37400bd0c301d59701b330d893096011f2769746451ab"}
 *
 * Go source:
 * func hasOverlappingInferences(a []*InferenceInfo, b []*InferenceInfo) bool {
 * 	for i := range a {
 * 		if hasInferenceCandidates(a[i]) && hasInferenceCandidates(b[i]) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function hasOverlappingInferences(a: GoSlice<GoPtr<InferenceInfo>>, b: GoSlice<GoPtr<InferenceInfo>>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/inference.go::method::Checker.mergeInferences","kind":"method","status":"implemented","sigHash":"2641efe30b985e82e8f8141bbc8ab1e1bf258abb7499f905ac89df4ded0388be","bodyHash":"32015f14f6cf3a2252710f56871b207823f7f03f4190de9957bf94415609dad3"}
 *
 * Go source:
 * func (c *Checker) mergeInferences(target []*InferenceInfo, source []*InferenceInfo) {
 * 	for i := range target {
 * 		if !hasInferenceCandidates(target[i]) && hasInferenceCandidates(source[i]) {
 * 			target[i] = source[i]
 * 		}
 * 	}
 * }
 */
export declare function Checker_mergeInferences(receiver: GoPtr<Checker>, target: GoSlice<GoPtr<InferenceInfo>>, source: GoSlice<GoPtr<InferenceInfo>>): void;
//# sourceMappingURL=inference.d.ts.map