import type { bool, byte, double, int } from "@tsonic/core/types.js";
import type { GoComparable, GoConstraint, GoError, GoMap, GoPtr, GoRune, GoSeq, GoSeq2, GoSlice } from "../../go/compat.js";
import { Assert } from "../debug/debug.js";
import { MarshalIndent } from "../json/json.js";
import { IsLineBreak } from "../stringutil/util.js";
import { ExtensionCjs, ExtensionCts, ExtensionJs, ExtensionJson, ExtensionJsx, ExtensionMjs, ExtensionMts, ExtensionTs, ExtensionTsx, HasTSFileExtension, IsDeclarationFileName } from "../tspath/extension.js";
import { PathIsRelative } from "../tspath/path.js";
import * as maps from "../../go/maps.js";
import * as math from "../../go/math.js";
import * as slices from "../../go/slices.js";
import * as strings from "../../go/strings.js";
import { Pool } from "../../go/sync.js";
import * as sort from "../../go/sort.js";
import * as unicode from "../../go/unicode.js";
import * as utf16 from "../../go/unicode/utf16.js";
import * as utf8 from "../../go/unicode/utf8.js";
import type { CompilerOptions } from "./compileroptions.js";
import { ScriptKindJS, ScriptKindJSON, ScriptKindJSX, ScriptKindTS, ScriptKindTSX, ScriptKindUnknown } from "./scriptkind.js";
import type { ScriptKind } from "./scriptkind.js";
import type { TextPos } from "./text.js";
import { Tristate_IsTrue } from "./tristate.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// byte indexing `s[i]` and slicing `s[i:j]` operate on byte offsets. We mirror
// that contract by operating over the UTF-8 byte view and converting back to a
// JS string at the boundaries.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const byteLen = (s: string): int => utf8Encoder.encode(s).length;
const byteSliceFrom = (s: string, start: int): string => {
  const bytes = utf8Encoder.encode(s);
  return utf8Decoder.decode(bytes.subarray(start));
};
// []rune(s): decode the string into Unicode code points (runes).
const stringToRunes = (s: string): GoSlice<GoRune> => {
  const runes: GoSlice<GoRune> = [];
  for (const ch of s) {
    runes.push(ch.codePointAt(0)!);
  }
  return runes;
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Filter","kind":"func","status":"implemented","sigHash":"c6f3794b23a576819ceb29c279308a1f44ca586c2ad73bca238043ddf5cc2be6","bodyHash":"d6f2f463faf92b0ac14d252dfde5b636c9d042a563bc223423e1dd6c7d26f801"}
 *
 * Go source:
 * func Filter[T any](slice []T, f func(T) bool) []T {
 * 	for i, value := range slice {
 * 		if !f(value) {
 * 			result := slices.Clone(slice[:i])
 * 			for i++; i < len(slice); i++ {
 * 				value = slice[i]
 * 				if f(value) {
 * 					result = append(result, value)
 * 				}
 * 			}
 * 			return result
 * 		}
 * 	}
 * 	return slice
 * }
 */
export function Filter<T>(slice: GoPtr<GoSlice<T>>, f: (arg0: T) => bool): GoSlice<T> {
  const values = slice ?? [];
  for (let i = 0; i < values.length; i++) {
    let value = values[i]!;
    if (!f(value)) {
      const result = slices.Clone(values.slice(0, i))!;
      for (i++; i < values.length; i++) {
        value = values[i]!;
        if (f(value)) {
          result.push(value);
        }
      }
      return result;
    }
  }
  return values;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FilterSeq","kind":"func","status":"implemented","sigHash":"f284bfa2470adcad948df44f98aa3dbfd8bb42a3d789acaa6666bd90463022b8","bodyHash":"2d468fa35e38be522ef3884bfa57f9f4842f7c868f409cd722bb5e177cb5b656"}
 *
 * Go source:
 * func FilterSeq[T any](slice []T, f func(T) bool) iter.Seq[T] {
 * 	return func(yield func(T) bool) {
 * 		for _, value := range slice {
 * 			if f(value) {
 * 				if !yield(value) {
 * 					return
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function FilterSeq<T>(slice: GoPtr<GoSlice<T>>, f: (arg0: T) => bool): GoSeq<T> {
  return (yield_: (value: T) => bool): void => {
    for (const value of slice ?? []) {
      if (f(value)) {
        if (!yield_(value)) {
          return;
        }
      }
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FilterIndex","kind":"func","status":"implemented","sigHash":"2c8591ea4e8c355d063b10ee051308e882d1ceb245c39684e589bbb5e41f0884","bodyHash":"6b099512b0b6271c6427a277d380077396da271a637a4c16251c5ef5d6fa07e3"}
 *
 * Go source:
 * func FilterIndex[T any](slice []T, f func(T, int, []T) bool) []T {
 * 	for i, value := range slice {
 * 		if !f(value, i, slice) {
 * 			result := slices.Clone(slice[:i])
 * 			for i++; i < len(slice); i++ {
 * 				value = slice[i]
 * 				if f(value, i, slice) {
 * 					result = append(result, value)
 * 				}
 * 			}
 * 			return result
 * 		}
 * 	}
 * 	return slice
 * }
 */
export function FilterIndex<T>(slice: GoPtr<GoSlice<T>>, f: (arg0: T, arg1: int, arg2: GoSlice<T>) => bool): GoSlice<T> {
  const values = slice ?? [];
  for (let i = 0; i < values.length; i++) {
    let value = values[i]!;
    if (!f(value, i, values)) {
      const result = slices.Clone(values.slice(0, i))!;
      for (i++; i < values.length; i++) {
        value = values[i]!;
        if (f(value, i, values)) {
          result.push(value);
        }
      }
      return result;
    }
  }
  return values;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Map","kind":"func","status":"implemented","sigHash":"b481cba2d02e22bc46592031a41ffef58bb0311b4540bb0439b367d2155ac334","bodyHash":"ba690cea4f9eed8b34e7e510b6f117ed22996db2014032c4bca519b7ee2e5a14"}
 *
 * Go source:
 * func Map[T, U any](slice []T, f func(T) U) []U {
 * 	if slice == nil {
 * 		return nil
 * 	}
 * 	result := make([]U, len(slice))
 * 	for i, value := range slice {
 * 		result[i] = f(value)
 * 	}
 * 	return result
 * }
 */
export function Map<T, U>(slice: GoSlice<T>, f: (arg0: T) => U): GoSlice<U> {
  // A Go nil slice is observationally equivalent to an empty slice in this model
  // (same len, range, indexing, append), so the `slice == nil` early return is
  // represented as returning an empty slice.
  if (slice === undefined) {
    return [];
  }
  const result: GoSlice<U> = new globalThis.Array<U>(slice.length);
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    result[i] = f(value);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::TryMap","kind":"func","status":"implemented","sigHash":"4d35f66c625f2a9a04aeed7da8b0050693f2f20abad7d28788e8823caf441b15","bodyHash":"776e523fcf2d17fb0d7e9bb6b12a92ba13176ffa831a2da353cf7f6155281566"}
 *
 * Go source:
 * func TryMap[T, U any](slice []T, f func(T) (U, error)) ([]U, error) {
 * 	if len(slice) == 0 {
 * 		return nil, nil
 * 	}
 * 	result := make([]U, len(slice))
 * 	for i, value := range slice {
 * 		mapped, err := f(value)
 * 		if err != nil {
 * 			return nil, err
 * 		}
 * 		result[i] = mapped
 * 	}
 * 	return result, nil
 * }
 */
export function TryMap<T, U>(slice: GoSlice<T>, f: (arg0: T) => [U, GoError]): [GoSlice<U>, GoError] {
  if (slice.length === 0) {
    return [[], undefined];
  }
  const result: GoSlice<U> = new globalThis.Array<U>(slice.length);
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    const [mapped, err] = f(value);
    if (err !== undefined) {
      return [[], err];
    }
    result[i] = mapped;
  }
  return [result, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::MapIndex","kind":"func","status":"implemented","sigHash":"e6acc3ef251f206b42ddc60894d9453e356a234bbf8e63a361ed473767842b4d","bodyHash":"e7314ed08fed131584289e170703f3ef7dda21ad22cf2a8c64d2ad4c72aa4027"}
 *
 * Go source:
 * func MapIndex[T, U any](slice []T, f func(T, int) U) []U {
 * 	if slice == nil {
 * 		return nil
 * 	}
 * 	result := make([]U, len(slice))
 * 	for i, value := range slice {
 * 		result[i] = f(value, i)
 * 	}
 * 	return result
 * }
 */
export function MapIndex<T, U>(slice: GoSlice<T>, f: (arg0: T, arg1: int) => U): GoSlice<U> {
  if (slice === undefined) {
    return [];
  }
  const result: GoSlice<U> = new globalThis.Array<U>(slice.length);
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    result[i] = f(value, i);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::MapNonNil","kind":"func","status":"implemented","sigHash":"38a745442a53036b38c2d0687c6b7436bddeeef191ba490264b170c3a1ba972c","bodyHash":"198aab906c79fb46432c295ffe33a81dc42047d140bdfc7338aef32e20002f97"}
 *
 * Go source:
 * func MapNonNil[T any, U comparable](slice []T, f func(T) U) []U {
 * 	var result []U
 * 	for _, value := range slice {
 * 		mapped := f(value)
 * 		if mapped != *new(U) {
 * 			result = append(result, mapped)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function MapNonNil<T, U extends GoComparable>(slice: GoSlice<T>, f: (arg0: T) => U): GoSlice<U> {
  const result: GoSlice<U> = [];
  for (const value of slice) {
    const mapped = f(value);
    if (mapped !== (undefined as U)) {
      result.push(mapped);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::MapFiltered","kind":"func","status":"implemented","sigHash":"9577337c7818014e5f3d56eaf9bd3e6b4773fe1aae3595315e4eb6ca8018cddb","bodyHash":"5f429eaa49e4b41da9e803e775da7094bae557cb4e70dfc2210f8ad55ff173f8"}
 *
 * Go source:
 * func MapFiltered[T any, U any](slice []T, f func(T) (U, bool)) []U {
 * 	var result []U
 * 	for _, value := range slice {
 * 		mapped, ok := f(value)
 * 		if !ok {
 * 			continue
 * 		}
 * 		result = append(result, mapped)
 * 	}
 * 	return result
 * }
 */
export function MapFiltered<T, U>(slice: GoSlice<T>, f: (arg0: T) => [U, bool]): GoSlice<U> {
  const result: GoSlice<U> = [];
  for (const value of slice) {
    const [mapped, ok] = f(value);
    if (!ok) {
      continue;
    }
    result.push(mapped);
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FlatMap","kind":"func","status":"implemented","sigHash":"fa3e3b0cd454d8e8d7c20c069fb1a4d0e113cd32b1dbfce1b7c58dd86b143520","bodyHash":"64d4ff9a2a8d3bd9b60f61574c6b83534789d253a351f7c0931bf4e96c287a69"}
 *
 * Go source:
 * func FlatMap[T any, U any](slice []T, f func(T) []U) []U {
 * 	var result []U
 * 	for _, value := range slice {
 * 		mapped := f(value)
 * 		if len(mapped) != 0 {
 * 			result = append(result, mapped...)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function FlatMap<T, U>(slice: GoSlice<T>, f: (arg0: T) => GoSlice<U>): GoSlice<U> {
  const result: GoSlice<U> = [];
  for (const value of slice) {
    const mapped = f(value);
    if (mapped.length !== 0) {
      for (const e of mapped) {
        result.push(e);
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::SameMap","kind":"func","status":"implemented","sigHash":"b37cc02f2d681b441a2bcf95a170a037c3e31ff3971463fba5f6290a56167d14","bodyHash":"2f3ee8beacd717753c8301aa8e9f071b920d6a0d81a9340025fd7b5c63ade866"}
 *
 * Go source:
 * func SameMap[T comparable](slice []T, f func(T) T) []T {
 * 	for i, value := range slice {
 * 		mapped := f(value)
 * 		if mapped != value {
 * 			result := make([]T, len(slice))
 * 			copy(result, slice[:i])
 * 			result[i] = mapped
 * 			for j := i + 1; j < len(slice); j++ {
 * 				result[j] = f(slice[j])
 * 			}
 * 			return result
 * 		}
 * 	}
 * 	return slice
 * }
 */
export function SameMap<T extends GoComparable>(slice: GoSlice<T>, f: (arg0: T) => T): GoSlice<T> {
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    const mapped = f(value);
    if (mapped !== value) {
      const result: GoSlice<T> = new globalThis.Array<T>(slice.length);
      for (let k = 0; k < i; k++) {
        result[k] = slice[k]!;
      }
      result[i] = mapped;
      for (let j = i + 1; j < slice.length; j++) {
        result[j] = f(slice[j]!);
      }
      return result;
    }
  }
  return slice;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::SameMapIndex","kind":"func","status":"implemented","sigHash":"6505040355c13afa243941839d6d044526ed0335e81bb95e22d06a24c0ff4d80","bodyHash":"2a7adfe960fd84d1a753f048c89fb6a73be00efa39906174803f6d67342afce0"}
 *
 * Go source:
 * func SameMapIndex[T comparable](slice []T, f func(T, int) T) []T {
 * 	for i, value := range slice {
 * 		mapped := f(value, i)
 * 		if mapped != value {
 * 			result := make([]T, len(slice))
 * 			copy(result, slice[:i])
 * 			result[i] = mapped
 * 			for j := i + 1; j < len(slice); j++ {
 * 				result[j] = f(slice[j], j)
 * 			}
 * 			return result
 * 		}
 * 	}
 * 	return slice
 * }
 */
export function SameMapIndex<T extends GoComparable>(slice: GoSlice<T>, f: (arg0: T, arg1: int) => T): GoSlice<T> {
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    const mapped = f(value, i);
    if (mapped !== value) {
      const result: GoSlice<T> = new globalThis.Array<T>(slice.length);
      for (let k = 0; k < i; k++) {
        result[k] = slice[k]!;
      }
      result[i] = mapped;
      for (let j = i + 1; j < slice.length; j++) {
        result[j] = f(slice[j]!, j);
      }
      return result;
    }
  }
  return slice;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Same","kind":"func","status":"implemented","sigHash":"c1e9f30e303e3dbaf9dae9e859f3e14958553fd049a118b8e169eb77746d2e92","bodyHash":"da146fdfeb165e0857073d4cd27e75d5ed6e0296d1e7065608e9c572afad393b"}
 *
 * Go source:
 * func Same[T any](s1 []T, s2 []T) bool {
 * 	if len(s1) == len(s2) {
 * 		return len(s1) == 0 || &s1[0] == &s2[0]
 * 	}
 * 	return false
 * }
 */
export function Same<T>(s1: GoSlice<T>, s2: GoSlice<T>): bool {
  if (s1.length === s2.length) {
    // Go compares the address of the first element (`&s1[0] == &s2[0]`) to test
    // whether the two slices share the same backing array. In this value-array
    // model that maps to JS reference identity of the slice itself.
    return s1.length === 0 || s1 === s2;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Some","kind":"func","status":"implemented","sigHash":"9cbe48e4837767d8e6e64571b1f05a4281e53311e62f370b3593a52a3056453b","bodyHash":"f31b8411854c97dced79ff69f46548c7852635572333b617c2c93fc45aa87a0e"}
 *
 * Go source:
 * func Some[T any](slice []T, f func(T) bool) bool {
 * 	for _, value := range slice { //nolint:modernize
 * 		if f(value) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Some<T>(slice: GoSlice<T> | undefined, f: (arg0: T) => bool): bool {
  if (slice === undefined) {
    return false;
  }
  for (const value of slice) {
    //nolint:modernize
    if (f(value)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Every","kind":"func","status":"implemented","sigHash":"ea99b9b3f35d67edb785af36c6532dd9ceebd77305cb8a13e0e17d48bcda57c6","bodyHash":"bdb02d6141ca0180793e634f2a789c4a880b9ab9d1feaea2af21689cbd744baa"}
 *
 * Go source:
 * func Every[T any](slice []T, f func(T) bool) bool {
 * 	for _, value := range slice {
 * 		if !f(value) {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function Every<T>(slice: GoSlice<T> | undefined, f: (arg0: T) => bool): bool {
  if (slice === undefined) {
    return true;
  }
  for (const value of slice) {
    if (!f(value)) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Or","kind":"func","status":"implemented","sigHash":"1bc86f860646b4bcd0088d6a1ab2601c2b806338b042fecf5e7502b9dd5ab560","bodyHash":"15abe0ce0e41126084de9beb7bbf84bda3929bb67b9bb5f3cc2d334c6e45e016"}
 *
 * Go source:
 * func Or[T any](funcs ...func(T) bool) func(T) bool {
 * 	return func(input T) bool {
 * 		for _, f := range funcs {
 * 			if f(input) {
 * 				return true
 * 			}
 * 		}
 * 		return false
 * 	}
 * }
 */
export function Or<T>(...funcs: Array<(arg0: T) => bool>): (arg0: T) => bool {
  return (input: T): bool => {
    for (const f of funcs) {
      if (f(input)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Find","kind":"func","status":"implemented","sigHash":"2ee16e58ad0deb6cc7714a39d341a00341dee7669cbba6922629edbe0e420e37","bodyHash":"0a845d90f071ccb10d06509fe6e11cbcabea300cce972b04aed5498dce91f6c9"}
 *
 * Go source:
 * func Find[T any](slice []T, f func(T) bool) T {
 * 	for _, value := range slice {
 * 		if f(value) {
 * 			return value
 * 		}
 * 	}
 * 	return *new(T)
 * }
 */
export function Find<T>(slice: GoSlice<T>, f: (arg0: T) => bool): T {
  for (const value of slice) {
    if (f(value)) {
      return value;
    }
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FindLast","kind":"func","status":"implemented","sigHash":"f52df98008b7638fb14b25ad503a9663f6455e0ca181d35ed26aa054670afde5","bodyHash":"1389b36ec3d6b13b9c0c377e6b3da4e226ed1f0a270eb175201bb3fbc30b0dc0"}
 *
 * Go source:
 * func FindLast[T any](slice []T, f func(T) bool) T {
 * 	for i := len(slice) - 1; i >= 0; i-- {
 * 		value := slice[i]
 * 		if f(value) {
 * 			return value
 * 		}
 * 	}
 * 	return *new(T)
 * }
 */
export function FindLast<T>(slice: GoSlice<T>, f: (arg0: T) => bool): T {
  for (let i = slice.length - 1; i >= 0; i--) {
    const value = slice[i]!;
    if (f(value)) {
      return value;
    }
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FindIndex","kind":"func","status":"implemented","sigHash":"311af221a7c0b594a4ff6c7179dea128aab868fce06fab609d1672697e6bef8d","bodyHash":"d639397dbd44d5ef065785343c5bf71f2bea4ce88b278e75095a9b4ef3341644"}
 *
 * Go source:
 * func FindIndex[T any](slice []T, f func(T) bool) int {
 * 	for i, value := range slice {
 * 		if f(value) {
 * 			return i
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function FindIndex<T>(slice: GoSlice<T>, f: (arg0: T) => bool): int {
  for (let i = 0; i < slice.length; i++) {
    const value = slice[i]!;
    if (f(value)) {
      return i;
    }
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FindLastIndex","kind":"func","status":"implemented","sigHash":"f10b29be576310e978a7d87c83212c025a618fcf7bd2edea77d9365bed98b555","bodyHash":"1128f27e3f4213064a8e70d596a5e1f36f55a01050a33f452c2f4574321160a4"}
 *
 * Go source:
 * func FindLastIndex[T any](slice []T, f func(T) bool) int {
 * 	for i := len(slice) - 1; i >= 0; i-- {
 * 		value := slice[i]
 * 		if f(value) {
 * 			return i
 * 		}
 * 	}
 * 	return -1
 * }
 */
export function FindLastIndex<T>(slice: GoSlice<T>, f: (arg0: T) => bool): int {
  for (let i = slice.length - 1; i >= 0; i--) {
    const value = slice[i]!;
    if (f(value)) {
      return i;
    }
  }
  return -1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FirstOrNil","kind":"func","status":"implemented","sigHash":"5b02323d9799c251ff81888dc2253e15b12b9f05ae4ef699fff5fa580f5eb211","bodyHash":"04ca1e17a229776de9178a01c303cff3fb4466faabe7ddc2d667b9e68effb1c7"}
 *
 * Go source:
 * func FirstOrNil[T any](slice []T) T {
 * 	if len(slice) != 0 {
 * 		return slice[0]
 * 	}
 * 	return *new(T)
 * }
 */
export function FirstOrNil<T>(slice: GoSlice<T>): T {
  if (slice.length !== 0) {
    return slice[0]!;
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::LastOrNil","kind":"func","status":"implemented","sigHash":"2e9c8036f902e50e1d0808502292b6458d1ff3e636a34424a4556b67480537f3","bodyHash":"9b6168eb3aa0d1460455de0c7824af0ef002d1c71df6f937447730890ad9804e"}
 *
 * Go source:
 * func LastOrNil[T any](slice []T) T {
 * 	if len(slice) != 0 {
 * 		return slice[len(slice)-1]
 * 	}
 * 	return *new(T)
 * }
 */
export function LastOrNil<T>(slice: GoSlice<T>): T {
  if (slice.length !== 0) {
    return slice[slice.length - 1]!;
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ElementOrNil","kind":"func","status":"implemented","sigHash":"5d72715cfc3550ed669b5d8a565bc6c23b5fac16e70c7653b76bb357348970bf","bodyHash":"43aa83112e7a5e8702f0b92536bebd745f396fd3c882f41ab4bea9887517645b"}
 *
 * Go source:
 * func ElementOrNil[T any](slice []T, index int) T {
 * 	if index < len(slice) {
 * 		return slice[index]
 * 	}
 * 	return *new(T)
 * }
 */
export function ElementOrNil<T>(slice: GoSlice<T>, index: int): T {
  if (index < slice.length) {
    return slice[index]!;
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FirstOrNilSeq","kind":"func","status":"implemented","sigHash":"0cb753a080e39d02e9c60ac785b748dd0bb0bc0674fc721f4493447df92bf9b6","bodyHash":"12af5032402e3653516d839aa1e3f788dc19c8ce30dc9843c746e7e7955d922f"}
 *
 * Go source:
 * func FirstOrNilSeq[T any](seq iter.Seq[T]) T {
 * 	if seq != nil {
 * 		for value := range seq {
 * 			return value
 * 		}
 * 	}
 * 	return *new(T)
 * }
 */
export function FirstOrNilSeq<T>(seq: GoSeq<T>): T {
  let result = undefined as T;
  if (seq !== undefined) {
    seq((value: T): bool => {
      result = value;
      return false;
    });
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FirstNonNil","kind":"func","status":"implemented","sigHash":"5af1740123b28a4598c1e21e27b051d47d7414505d1076442a7c88bce368177f","bodyHash":"58dfbcd5ccecb1bb44b7ef0cfe7a02a1289d4ceb5e186f7cc2cf63adfa8b818d"}
 *
 * Go source:
 * func FirstNonNil[T any, U comparable](slice []T, f func(T) U) U {
 * 	for _, value := range slice {
 * 		mapped := f(value)
 * 		if mapped != *new(U) {
 * 			return mapped
 * 		}
 * 	}
 * 	return *new(U)
 * }
 */
export function FirstNonNil<T, U extends GoComparable>(slice: GoSlice<T>, f: (arg0: T) => U): U {
  for (const value of slice) {
    const mapped = f(value);
    if (mapped !== (undefined as U)) {
      return mapped;
    }
  }
  return undefined as U;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FirstNonZero","kind":"func","status":"implemented","sigHash":"937815920a82b37fd05c1efdc4ae241c40a80974d412adad80b281393fe3e833","bodyHash":"659bc99c50b8afbad54047fef97a0a31ae10e297c7dbde3bd193f2cc91d07f8e"}
 *
 * Go source:
 * func FirstNonZero[T comparable](values ...T) T {
 * 	var zero T
 * 	for _, value := range values {
 * 		if value != zero {
 * 			return value
 * 		}
 * 	}
 * 	return zero
 * }
 */
export function FirstNonZero<T extends GoComparable>(...values: Array<T>): T {
  for (const value of values) {
    if (!isGoZeroValue(value)) {
      return value;
    }
  }
  return undefined as T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Concatenate","kind":"func","status":"implemented","sigHash":"6956c1829700bd3fc3f92ccbb9409a1e9c08d886214b667237944eeaf8c08a06","bodyHash":"67b9e54b7b8b130caecdbdad8b4f6b2c6e0ad743ac2642b46473610f4f9f3921"}
 *
 * Go source:
 * func Concatenate[T any](s1 []T, s2 []T) []T {
 * 	if len(s2) == 0 {
 * 		return s1
 * 	}
 * 	if len(s1) == 0 {
 * 		return s2
 * 	}
 * 	return slices.Concat(s1, s2)
 * }
 */
export function Concatenate<T>(s1: GoPtr<GoSlice<T>>, s2: GoPtr<GoSlice<T>>): GoSlice<T> {
  const left = s1 ?? [];
  const right = s2 ?? [];
  if (right.length === 0) {
    return left;
  }
  if (left.length === 0) {
    return right;
  }
  return slices.Concat(left, right);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Splice","kind":"func","status":"implemented","sigHash":"2059bb395cba83fa69150051bc69f7aa38df5fd393dd10eac311e2bfab466c6e","bodyHash":"150e4b43e1abbf740235c18356e67ebcbf81bd992c9e910ae334e8a3b558f6ad"}
 *
 * Go source:
 * func Splice[T any](s1 []T, start int, deleteCount int, items ...T) []T {
 * 	if start < 0 {
 * 		start = len(s1) + start
 * 	}
 * 	if start < 0 {
 * 		start = 0
 * 	}
 * 	if start > len(s1) {
 * 		start = len(s1)
 * 	}
 * 	if deleteCount < 0 {
 * 		deleteCount = 0
 * 	}
 * 	end := min(start+max(deleteCount, 0), len(s1))
 * 	if start == end && len(items) == 0 {
 * 		return s1
 * 	}
 * 	return slices.Concat(s1[:start], items, s1[end:])
 * }
 */
export function Splice<T>(s1: GoSlice<T>, start: int, deleteCount: int, ...items: Array<T>): GoSlice<T> {
  if (start < 0) {
    start = s1.length + start;
  }
  if (start < 0) {
    start = 0;
  }
  if (start > s1.length) {
    start = s1.length;
  }
  if (deleteCount < 0) {
    deleteCount = 0;
  }
  const end = globalThis.Math.min(start + globalThis.Math.max(deleteCount, 0), s1.length);
  if (start === end && items.length === 0) {
    return s1;
  }
  return slices.Concat(s1.slice(0, start), items, s1.slice(end));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::CountWhere","kind":"func","status":"implemented","sigHash":"031bba4984386a9a0f55d877d220823bcd146922a8c3a81b8538d949323eb446","bodyHash":"585e368bb8fd593ec1169421dd477c39df5dbc247adde4e937fed873bfec6d32"}
 *
 * Go source:
 * func CountWhere[T any](slice []T, f func(T) bool) int {
 * 	count := 0
 * 	for _, value := range slice {
 * 		if f(value) {
 * 			count++
 * 		}
 * 	}
 * 	return count
 * }
 */
export function CountWhere<T>(slice: GoSlice<T>, f: (arg0: T) => bool): int {
  let count = 0;
  for (const value of slice) {
    if (f(value)) {
      count++;
    }
  }
  return count;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ReplaceElement","kind":"func","status":"implemented","sigHash":"beb260c7a6baeb5dcdc126918cde78058634752f2e7f886084538bb51c5cd88b","bodyHash":"d213684e220e5cf6061fdaea61e495993a2f38c2bd43d7b5c831f450c3074a1d"}
 *
 * Go source:
 * func ReplaceElement[T any](slice []T, i int, t T) []T {
 * 	result := slices.Clone(slice)
 * 	result[i] = t
 * 	return result
 * }
 */
export function ReplaceElement<T>(slice: GoSlice<T>, i: int, t: T): GoSlice<T> {
  const result = slices.Clone(slice)!;
  result[i] = t;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::InsertSorted","kind":"func","status":"implemented","sigHash":"3b2f1a5ae3af2588c684e6770ec10debcac33e0adf8765045b584a2ebd8475e0","bodyHash":"f816d60b27d77061c610a19e09d99704a395dd32a920f59601ad3fee7f710d8e"}
 *
 * Go source:
 * func InsertSorted[T any](slice []T, element T, cmp func(T, T) int) []T {
 * 	i, _ := slices.BinarySearchFunc(slice, element, cmp)
 * 	return slices.Insert(slice, i, element)
 * }
 */
export function InsertSorted<T>(slice: GoSlice<T>, element: T, cmp: (arg0: T, arg1: T) => int): GoSlice<T> {
  const [i] = slices.BinarySearchFunc(slice, element, cmp);
  return slices.Insert(slice, i, element);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::MinAllFunc","kind":"func","status":"implemented","sigHash":"cb0e61615f21263eb4072c2f4f0884eb6d093871a998329c168c50e1c8d1d713","bodyHash":"32dd6977666aab4ec1cc6ff35e66d6ee362bbb3a6c839e406bc3e41aeca16b1c"}
 *
 * Go source:
 * func MinAllFunc[T any](xs []T, cmp func(a, b T) int) []T {
 * 	if len(xs) == 0 {
 * 		return nil
 * 	}
 * 
 * 	m := xs[0]
 * 	mins := []T{m}
 * 
 * 	for _, x := range xs[1:] {
 * 		c := cmp(x, m)
 * 		switch {
 * 		case c < 0:
 * 			m = x
 * 			mins = mins[:0]
 * 			mins = append(mins, x)
 * 		case c == 0:
 * 			mins = append(mins, x)
 * 		}
 * 	}
 * 
 * 	return mins
 * }
 */
export function MinAllFunc<T>(xs: GoSlice<T>, cmp: (a: T, b: T) => int): GoSlice<T> {
  if (xs.length === 0) {
    return [];
  }

  let m: T = xs[0]!;
  const mins: GoSlice<T> = [m];

  for (const x of xs.slice(1)) {
    const c = cmp(x, m);
    if (c < 0) {
      m = x;
      mins.length = 0;
      mins.push(x);
    } else if (c === 0) {
      mins.push(x);
    }
  }

  return mins;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::AppendIfUnique","kind":"func","status":"implemented","sigHash":"306355ba71b10478033aadff90f427c91e2f254307d310e3474ae0425de73760","bodyHash":"6f5d70207c81fe269c7d13c587b1d2f3284f804428389f17fb94675b97806258"}
 *
 * Go source:
 * func AppendIfUnique[T comparable](slice []T, element T) []T {
 * 	if slices.Contains(slice, element) {
 * 		return slice
 * 	}
 * 	return append(slice, element)
 * }
 */
export function AppendIfUnique<T extends GoComparable>(slice: GoPtr<GoSlice<T>>, element: T): GoSlice<T> {
  if (slices.Contains(slice, element)) {
    return slice ?? [];
  }
  return [...(slice ?? []), element];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Memoize","kind":"func","status":"implemented","sigHash":"bf3d5a24243b53fb586b7a917e212771d780a4104a57e141340c1fb6637a4d3b","bodyHash":"e27c5e42f809a8be53f7688bfe7f52e90f361d9c8299d6cd201293d4e930f6f9"}
 *
 * Go source:
 * func Memoize[T any](create func() T) func() T {
 * 	var value T
 * 	return func() T {
 * 		if create != nil {
 * 			value = create()
 * 			create = nil
 * 		}
 * 		return value
 * 	}
 * }
 */
export function Memoize<T>(create: () => T): () => T {
  let value = undefined as T;
  // Go reassigns `create = nil` after the first call to release it and gate
  // re-invocation. The scaffold signature keeps `create` non-nullable, so the
  // nil-able gate is held in a local copy.
  let createOrNil: GoPtr<() => T> = create;
  return (): T => {
    if (createOrNil !== undefined) {
      value = createOrNil();
      createOrNil = undefined;
    }
    return value;
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::IfElse","kind":"func","status":"implemented","sigHash":"a885cdcd35f5b127118071066d82fcbe47229dc9abfb02116b6392b9aab9bbc9","bodyHash":"47fae8c8a91b839e8e9f5b8a7a8db273787b9b371dd781ed04212c532c65af95"}
 *
 * Go source:
 * func IfElse[T any](b bool, whenTrue T, whenFalse T) T {
 * 	if b {
 * 		return whenTrue
 * 	}
 * 	return whenFalse
 * }
 */
export function IfElse<T>(b: bool, whenTrue: T, whenFalse: T): T {
  if (b) {
    return whenTrue;
  }
  return whenFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::OrElse","kind":"func","status":"implemented","sigHash":"9673f73c97aa3a1b08241a6c2c75f525437fce5ef18c9352bce103faac12a8a1","bodyHash":"8d04fc668c1d41cf88c595e4814b6b304c9dc861254a8d390505000eee77a7cd"}
 *
 * Go source:
 * func OrElse[T comparable](value T, defaultValue T) T {
 * 	if value != *new(T) {
 * 		return value
 * 	}
 * 	return defaultValue
 * }
 */
export function OrElse<T extends GoComparable>(value: T, defaultValue: T): T {
  if (!isGoZeroValue(value)) {
    return value;
  }
  return defaultValue;
}

function isGoZeroValue(value: unknown): bool {
  switch (typeof value) {
    case "undefined":
      return true;
    case "boolean":
      return value === false;
    case "number":
      return value === 0;
    case "bigint":
      return value === 0n;
    case "string":
      return value === "";
    default:
      return false;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Coalesce","kind":"func","status":"implemented","sigHash":"3487e3a18f54eaba0aeed69bc66accfb683e2b5af4f624c7bbd4f428fc62a5e1","bodyHash":"bade413da935f81cba83a0cc44255ad2d0ea5148719a8bfa1c3661715b21372d"}
 *
 * Go source:
 * func Coalesce[T *U, U any](a T, b T) T {
 * 	if a == nil {
 * 		return b
 * 	} else {
 * 		return a
 * 	}
 * }
 */
export function Coalesce<T, U>(a: T, b: T): T {
  // T is a pointer type *U in Go, so the zero value tested against nil is undefined.
  if (a === (undefined as T)) {
    return b;
  } else {
    return a;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::type::ECMALineStarts","kind":"type","status":"implemented","sigHash":"fb01d2df42e8ccb7e242320ebd8e18954ef5f02d7bc60ecf0c770975af3dae4d","bodyHash":"593ae08679195c95688abf8458f68ac4d519bae486e94f51f0632c480559168b"}
 *
 * Go source:
 * ECMALineStarts []TextPos
 */
export type ECMALineStarts = GoSlice<TextPos>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ComputeECMALineStarts","kind":"func","status":"implemented","sigHash":"b13aa73414e321c686bbc5459e2a16d89ef07cf199d497b29a4d76aa8c502aeb","bodyHash":"ea172cb24caea391868c6faff5133950326c3bb2a04e6609aa4c377dd9052c8c"}
 *
 * Go source:
 * func ComputeECMALineStarts(text string) ECMALineStarts {
 * 	result := make([]TextPos, 0, strings.Count(text, "\n")+1)
 * 	return slices.AppendSeq(result, ComputeECMALineStartsSeq(text))
 * }
 */
export function ComputeECMALineStarts(text: string): ECMALineStarts {
  const result: GoSlice<TextPos> = [];
  return slices.AppendSeq(result, ComputeECMALineStartsSeq(text));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ComputeECMALineStartsSeq","kind":"func","status":"implemented","sigHash":"911fb066c24cc7312e67a544bedd9232d274063c961ddc2bacdafd2fc1a900f1","bodyHash":"884c51f4ef304850f9e39c3cf3a2dac6dd8989655699793d01756eec8d80b956"}
 *
 * Go source:
 * func ComputeECMALineStartsSeq(text string) iter.Seq[TextPos] {
 * 	return func(yield func(TextPos) bool) {
 * 		textLen := TextPos(len(text))
 * 		var pos TextPos
 * 		var lineStart TextPos
 * 		for pos < textLen {
 * 			b := text[pos]
 * 			if b < utf8.RuneSelf {
 * 				pos++
 * 				switch b {
 * 				case '\r':
 * 					if pos < textLen && text[pos] == '\n' {
 * 						pos++
 * 					}
 * 					fallthrough
 * 				case '\n':
 * 					if !yield(lineStart) {
 * 						return
 * 					}
 * 					lineStart = pos
 * 				}
 * 			} else {
 * 				ch, size := utf8.DecodeRuneInString(text[pos:])
 * 				pos += TextPos(size)
 * 				if stringutil.IsLineBreak(ch) {
 * 					if !yield(lineStart) {
 * 						return
 * 					}
 * 					lineStart = pos
 * 				}
 * 			}
 * 		}
 * 		yield(lineStart)
 * 	}
 * }
 */
export function ComputeECMALineStartsSeq(text: string): GoSeq<TextPos> {
  return (yield_: (value: TextPos) => bool): void => {
    // Go strings index bytes; operate over the UTF-8 byte view.
    const bytes = utf8Encoder.encode(text);
    const textLen: TextPos = bytes.length;
    let pos: TextPos = 0;
    let lineStart: TextPos = 0;
    while (pos < textLen) {
      const b = bytes[pos]!;
      if (b < utf8.RuneSelf) {
        pos++;
        switch (b) {
          case 0x0d /* '\r' */:
            if (pos < textLen && bytes[pos]! === 0x0a /* '\n' */) {
              pos++;
            }
          // fallthrough
          case 0x0a /* '\n' */:
            if (!yield_(lineStart)) {
              return;
            }
            lineStart = pos;
            break;
        }
      } else {
        const [ch, size] = utf8.DecodeRuneInString(utf8Decoder.decode(bytes.subarray(pos)));
        pos += size;
        if (IsLineBreak(ch)) {
          if (!yield_(lineStart)) {
            return;
          }
          lineStart = pos;
        }
      }
    }
    yield_(lineStart);
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::PositionToLineAndByteOffset","kind":"func","status":"implemented","sigHash":"ce41d8eb62678c0a76288e9ab3aed800153dd6fa24c29ba8a0bb6b0c52a941a2","bodyHash":"bd50fb766bba3455ae0fbbb939b2c60e95c8a03a3dee8a14261946a816dd1f04"}
 *
 * Go source:
 * func PositionToLineAndByteOffset(position int, lineStarts []TextPos) (line int, byteOffset int) {
 * 	line = max(sort.Search(len(lineStarts), func(i int) bool {
 * 		return int(lineStarts[i]) > position
 * 	})-1, 0)
 * 	return line, position - int(lineStarts[line])
 * }
 */
export function PositionToLineAndByteOffset(position: int, lineStarts: GoSlice<TextPos>): [int, int] {
  const line = globalThis.Math.max(
    sort.Search(lineStarts.length, (i: int): bool => {
      return lineStarts[i]! > position;
    }) - 1,
    0,
  );
  return [line, position - lineStarts[line]!];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::type::UTF16Offset","kind":"type","status":"implemented","sigHash":"99b2db95c9727ad37164ce05c3a6c709b3efc78152b26ed124f417200ceb77a3","bodyHash":"90db5c6b3adf593e66bf8f2d2b3c216beb38406955cf0b46acbf88fe786db10f"}
 *
 * Go source:
 * UTF16Offset int
 */
export type UTF16Offset = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::UTF16Len","kind":"func","status":"implemented","sigHash":"08a30f04fbc495b785be284545417ab70df1fd4079f69a0b09fc73ce87fb4254","bodyHash":"6117f4167e836bcb53d144ac39dec841ae2f4513c8cb13fa1b3db29e9651bb20"}
 *
 * Go source:
 * func UTF16Len(s string) UTF16Offset {
 * 	// Fast path: scan for non-ASCII bytes. For ASCII-only strings,
 * 	// each byte is one UTF-16 code unit, so we can return len(s) directly.
 * 	for i := range len(s) {
 * 		if s[i] >= utf8.RuneSelf {
 * 			// Found non-ASCII; count the ASCII prefix, then decode the rest.
 * 			n := UTF16Offset(i)
 * 			for _, r := range s[i:] {
 * 				n += UTF16Offset(utf16.RuneLen(r))
 * 			}
 * 			return n
 * 		}
 * 	}
 * 	return UTF16Offset(len(s))
 * }
 */
export function UTF16Len(s: string): UTF16Offset {
  // Go strings index bytes; operate over the UTF-8 byte view.
  const bytes = utf8Encoder.encode(s);
  // Fast path: scan for non-ASCII bytes. For ASCII-only strings,
  // each byte is one UTF-16 code unit, so we can return len(s) directly.
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i]! >= utf8.RuneSelf) {
      // Found non-ASCII; count the ASCII prefix, then decode the rest.
      let n: UTF16Offset = i;
      const rest = utf8Decoder.decode(bytes.subarray(i));
      for (const ch of rest) {
        const r: GoRune = ch.codePointAt(0)!;
        n += utf16.RuneLen(r);
      }
      return n;
    }
  }
  return bytes.length;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Flatten","kind":"func","status":"implemented","sigHash":"d8d271526c45a14d27b1acd6f48cadeed4d8a4dea11b24d94baf324e6ff37446","bodyHash":"eae0b55c9762c6193f6ccfe8b73f873160751ce79b7b20b2cd26617d3edd8b50"}
 *
 * Go source:
 * func Flatten[T any](array [][]T) []T {
 * 	var result []T
 * 	for _, subArray := range array {
 * 		result = append(result, subArray...)
 * 	}
 * 	return result
 * }
 */
export function Flatten<T>(array: GoSlice<GoSlice<T>>): GoSlice<T> {
  const result: GoSlice<T> = [];
  for (const subArray of array) {
    for (const e of subArray) {
      result.push(e);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Must","kind":"func","status":"implemented","sigHash":"7b1c16cc9133d57575a5501bad69c8a1cfb8803e2e5bf81c8486faf90b1a903d","bodyHash":"3a4ce165eedf20185da50c958aaff7a17aa1b0dc12883d84c11c99a2cfda7a2e"}
 *
 * Go source:
 * func Must[T any](v T, err error) T {
 * 	if err != nil {
 * 		panic(err)
 * 	}
 * 	return v
 * }
 */
export function Must<T>(v: T, err: GoError): T {
  if (err !== undefined) {
    throw err;
  }
  return v;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::FirstResult","kind":"func","status":"implemented","sigHash":"297bfb4d14b2ad4139c3bfea78997f0b7cea7715da6c8a72ec5e7eff0bfee8fe","bodyHash":"daa9435ef37fda3bd3eede6c1f8239b34aed43084368154de777fdaaa35d38bf"}
 *
 * Go source:
 * func FirstResult[T1 any](t1 T1, _ ...any) T1 {
 * 	return t1
 * }
 */
export function FirstResult<T1>(t1: T1, ...arg: Array<unknown>): T1 {
  return t1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::StringifyJson","kind":"func","status":"implemented","sigHash":"6bc065d9c75940c8f06ab9bf844f14e0e55f64b90d5739d442a18736989c8187","bodyHash":"ccd6f01bb3c6d283bfc6db38a8085bd9529572d745a88ebf550f416041956bdb"}
 *
 * Go source:
 * func StringifyJson(input any, prefix string, indent string) (string, error) {
 * 	output, err := json.MarshalIndent(input, prefix, indent)
 * 	return string(output), err
 * }
 */
export function StringifyJson(input: unknown, prefix: string, indent: string): [string, GoError] {
  const [output, err] = MarshalIndent(input, prefix, indent);
  return [utf8Decoder.decode(globalThis.Uint8Array.from(output)), err];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::GetScriptKindFromFileName","kind":"func","status":"implemented","sigHash":"c3c316f0fb33499d86ceee6412056582e1e099739254e187fc4c2e582b91953b","bodyHash":"bff74f49e7487b2d95626b097a103458b908598d5af40816410c1ed855ff9a76"}
 *
 * Go source:
 * func GetScriptKindFromFileName(fileName string) ScriptKind {
 * 	dotPos := strings.LastIndex(fileName, ".")
 * 	if dotPos >= 0 {
 * 		switch strings.ToLower(fileName[dotPos:]) {
 * 		case tspath.ExtensionJs, tspath.ExtensionCjs, tspath.ExtensionMjs:
 * 			return ScriptKindJS
 * 		case tspath.ExtensionJsx:
 * 			return ScriptKindJSX
 * 		case tspath.ExtensionTs, tspath.ExtensionCts, tspath.ExtensionMts:
 * 			return ScriptKindTS
 * 		case tspath.ExtensionTsx:
 * 			return ScriptKindTSX
 * 		case tspath.ExtensionJson:
 * 			return ScriptKindJSON
 * 		}
 * 	}
 * 	return ScriptKindUnknown
 * }
 */
export function GetScriptKindFromFileName(fileName: string): ScriptKind {
  const dotPos = strings.LastIndex(fileName, ".");
  if (dotPos >= 0) {
    switch (strings.ToLower(byteSliceFrom(fileName, dotPos))) {
      case ExtensionJs:
      case ExtensionCjs:
      case ExtensionMjs:
        return ScriptKindJS;
      case ExtensionJsx:
        return ScriptKindJSX;
      case ExtensionTs:
      case ExtensionCts:
      case ExtensionMts:
        return ScriptKindTS;
      case ExtensionTsx:
        return ScriptKindTSX;
      case ExtensionJson:
        return ScriptKindJSON;
    }
  }
  return ScriptKindUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::GetSpellingSuggestion","kind":"func","status":"implemented","sigHash":"971be06af4af217009a0ac68576e7d5fbb4686b6c0e82c8a9b6d7bd09ba6b162","bodyHash":"4c5e8cc03570026c0fb713bbd2b2b3f447b1ad7cb9e48ea91fbceeb4e4ae43fd"}
 *
 * Go source:
 * func GetSpellingSuggestion[T any](name string, candidates iter.Seq[T], getName func(T) string, compare func(T, T) int) T {
 * 	maximumLengthDifference := max(2, int(float64(len(name))*0.34))
 * 	bestDistance := math.Floor(float64(len(name))*0.4) + 0.9 // If the best result is worse than this, don't bother.
 * 	runeName := []rune(name)
 * 	buffers := levenshteinBuffersPool.Get().(*levenshteinBuffers)
 * 	defer levenshteinBuffersPool.Put(buffers)
 * 	var bestCandidate T
 * 	hasBest := false
 * 	for candidate := range candidates {
 * 		candidateName := getName(candidate)
 * 		maxLen := max(len(candidateName), len(name))
 * 		minLen := min(len(candidateName), len(name))
 * 		if candidateName != "" && maxLen-minLen <= maximumLengthDifference {
 * 			if candidateName == name {
 * 				continue
 * 			}
 * 			// Only consider candidates less than 3 characters long when they differ by case.
 * 			// Otherwise, don't bother, since a user would usually notice differences of a 2-character name.
 * 			if len(candidateName) < 3 && !strings.EqualFold(candidateName, name) {
 * 				continue
 * 			}
 * 			distance := levenshteinWithMax(buffers, runeName, []rune(candidateName), bestDistance)
 * 			if distance < 0 {
 * 				continue
 * 			}
 * 			debug.Assert(distance <= bestDistance) // Else `levenshteinWithMax` should return undefined
 * 			if distance < bestDistance {
 * 				bestDistance = distance
 * 				bestCandidate = candidate
 * 				hasBest = true
 * 			} else if !hasBest || compare(candidate, bestCandidate) < 0 {
 * 				bestCandidate = candidate
 * 				hasBest = true
 * 			}
 * 		}
 * 	}
 * 	return bestCandidate
 * }
 */
export function GetSpellingSuggestion<T>(name: string, candidates: GoSeq<T>, getName: (arg0: T) => string, compare: (arg0: T, arg1: T) => int): T {
  const searchName = name ?? "";
  const maximumLengthDifference = globalThis.Math.max(2, globalThis.Math.trunc(byteLen(searchName) * 0.34));
  let bestDistance = math.Floor(byteLen(searchName) * 0.4) + 0.9; // If the best result is worse than this, don't bother.
  const runeName = stringToRunes(searchName);
  // Go: levenshteinBuffersPool.Get().(*levenshteinBuffers) — the New factory is
  // always set, so the pool never yields nil and the type assertion holds.
  const buffers = levenshteinBuffersPool.Get()!;
  try {
    let bestCandidate = undefined as T;
    let hasBest = false;
    candidates((candidate: T): bool => {
      const candidateName = getName(candidate) ?? "";
      const maxLen = globalThis.Math.max(byteLen(candidateName), byteLen(searchName));
      const minLen = globalThis.Math.min(byteLen(candidateName), byteLen(searchName));
      if (candidateName !== "" && maxLen - minLen <= maximumLengthDifference) {
        if (candidateName === searchName) {
          return true;
        }
        // Only consider candidates less than 3 characters long when they differ by case.
        // Otherwise, don't bother, since a user would usually notice differences of a 2-character name.
        if (byteLen(candidateName) < 3 && !strings.EqualFold(candidateName, searchName)) {
          return true;
        }
        const distance = levenshteinWithMax(buffers, runeName, stringToRunes(candidateName), bestDistance);
        if (distance < 0) {
          return true;
        }
        Assert(distance <= bestDistance); // Else `levenshteinWithMax` should return undefined
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCandidate = candidate;
          hasBest = true;
        } else if (!hasBest || compare(candidate, bestCandidate) < 0) {
          bestCandidate = candidate;
          hasBest = true;
        }
      }
      return true;
    });
    return bestCandidate;
  } finally {
    levenshteinBuffersPool.Put(buffers);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::GetSpellingSuggestionForStrings","kind":"func","status":"implemented","sigHash":"107bd01a9ffab497eaa7857629b7d71e7cc299a68b28603675778788477d8aa4","bodyHash":"81f4203de15449bb97c3ce3df6e41c54209853932ad0cdc3457cc82ac8aa4755"}
 *
 * Go source:
 * func GetSpellingSuggestionForStrings(name string, candidates iter.Seq[string]) string {
 * 	return GetSpellingSuggestion(name, candidates, Identity, strings.Compare)
 * }
 */
export function GetSpellingSuggestionForStrings(name: string, candidates: GoSeq<string>): string {
  // Go instantiates GetSpellingSuggestion with T=string, whose zero value is "" — the
  // value callers test for "no suggestion". The generic port yields undefined instead.
  return GetSpellingSuggestion(name, candidates, Identity, strings.Compare) ?? "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::type::levenshteinBuffers","kind":"type","status":"implemented","sigHash":"309a2b2d0ce21de3b08e33935adb32ec89595c5afa10079715e09e7e5258447b","bodyHash":"88cdf73846a8c42946ea4db3107e8349f29c6f1dc3aa5939cdf5c08246f58f26"}
 *
 * Go source:
 * levenshteinBuffers struct {
 * 	previous []float64
 * 	current  []float64
 * }
 */
export interface levenshteinBuffers {
  previous: GoSlice<double>;
  current: GoSlice<double>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::varGroup::levenshteinBuffersPool","kind":"varGroup","status":"implemented","sigHash":"f73cd6a6740af43768f3ed3b4d193581ee5336a7de6a8a87a3b32eda65cb9133","bodyHash":"32d80bcc1299c82e6daca5392f8e7b0312096e620f6b33be1f7c88204c69f13b"}
 *
 * Go source:
 * var levenshteinBuffersPool = sync.Pool{
 * 	New: func() any {
 * 		return &levenshteinBuffers{}
 * 	},
 * }
 */
export const levenshteinBuffersPool: Pool<levenshteinBuffers> = globalThis.Object.assign(new Pool<levenshteinBuffers>(), {
  New: (): levenshteinBuffers => {
    return { previous: [], current: [] };
  },
});

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::levenshteinWithMax","kind":"func","status":"implemented","sigHash":"e13904897a0737b8b10a09c26aec62e3357225fe00c2a4810d4b77b74c74ef76","bodyHash":"ca41d6ceb18683b2e2bb5d08b94cf40bb2071cd015d2a90aefb225399234cdcd"}
 *
 * Go source:
 * func levenshteinWithMax(buffers *levenshteinBuffers, s1 []rune, s2 []rune, maxValue float64) float64 {
 * 	bufferSize := len(s2) + 1
 * 	buffers.previous = slices.Grow(buffers.previous[:0], bufferSize)[:bufferSize]
 * 	buffers.current = slices.Grow(buffers.current[:0], bufferSize)[:bufferSize]
 * 
 * 	previous := buffers.previous
 * 	current := buffers.current
 * 
 * 	big := maxValue + 0.01
 * 	for i := range previous {
 * 		previous[i] = float64(i)
 * 	}
 * 	for i := 1; i <= len(s1); i++ {
 * 		c1 := s1[i-1]
 * 		minJ := max(int(math.Ceil(float64(i)-maxValue)), 1)
 * 		maxJ := min(int(math.Floor(maxValue+float64(i))), len(s2))
 * 		colMin := float64(i)
 * 		current[0] = colMin
 * 		for j := 1; j < minJ; j++ {
 * 			current[j] = big
 * 		}
 * 		for j := minJ; j <= maxJ; j++ {
 * 			var substitutionDistance, dist float64
 * 			if unicode.ToLower(s1[i-1]) == unicode.ToLower(s2[j-1]) {
 * 				substitutionDistance = previous[j-1] + 0.1
 * 			} else {
 * 				substitutionDistance = previous[j-1] + 2
 * 			}
 * 			if c1 == s2[j-1] {
 * 				dist = previous[j-1]
 * 			} else {
 * 				dist = math.Min(previous[j]+1, math.Min(current[j-1]+1, substitutionDistance))
 * 			}
 * 			current[j] = dist
 * 			colMin = math.Min(colMin, dist)
 * 		}
 * 		for j := maxJ + 1; j <= len(s2); j++ {
 * 			current[j] = big
 * 		}
 * 		if colMin > maxValue {
 * 			// Give up -- everything in this column is > max and it can't get better in future columns.
 * 			return -1
 * 		}
 * 		previous, current = current, previous
 * 	}
 * 	res := previous[len(s2)]
 * 	if res > maxValue {
 * 		return -1
 * 	}
 * 	return res
 * }
 */
export function levenshteinWithMax(buffers: GoPtr<levenshteinBuffers>, s1: GoSlice<GoRune>, s2: GoSlice<GoRune>, maxValue: double): double {
  const bufferSize = s2.length + 1;
  buffers!.previous = slices.Grow(buffers!.previous.slice(0, 0), bufferSize);
  buffers!.previous.length = bufferSize;
  buffers!.current = slices.Grow(buffers!.current.slice(0, 0), bufferSize);
  buffers!.current.length = bufferSize;

  let previous = buffers!.previous;
  let current = buffers!.current;

  const big = maxValue + 0.01;
  for (let i = 0; i < previous.length; i++) {
    previous[i] = i;
  }
  for (let i = 1; i <= s1.length; i++) {
    const c1 = s1[i - 1]!;
    const minJ = globalThis.Math.max(globalThis.Math.trunc(math.Ceil(i - maxValue)), 1);
    const maxJ = globalThis.Math.min(globalThis.Math.trunc(math.Floor(maxValue + i)), s2.length);
    let colMin = i;
    current[0] = colMin;
    for (let j = 1; j < minJ; j++) {
      current[j] = big;
    }
    for (let j = minJ; j <= maxJ; j++) {
      let substitutionDistance: double;
      let dist: double;
      if (unicode.ToLower(s1[i - 1]!) === unicode.ToLower(s2[j - 1]!)) {
        substitutionDistance = previous[j - 1]! + 0.1;
      } else {
        substitutionDistance = previous[j - 1]! + 2;
      }
      if (c1 === s2[j - 1]!) {
        dist = previous[j - 1]!;
      } else {
        dist = math.Min(previous[j]! + 1, math.Min(current[j - 1]! + 1, substitutionDistance));
      }
      current[j] = dist;
      colMin = math.Min(colMin, dist);
    }
    for (let j = maxJ + 1; j <= s2.length; j++) {
      current[j] = big;
    }
    if (colMin > maxValue) {
      // Give up -- everything in this column is > max and it can't get better in future columns.
      return -1;
    }
    [previous, current] = [current, previous];
  }
  const res = previous[s2.length]!;
  if (res > maxValue) {
    return -1;
  }
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Identity","kind":"func","status":"implemented","sigHash":"ec53e6504ecbd1f24f2ab6622de13214e48c19d842aef2d296537bfdefa656de","bodyHash":"bdc7acbb68cc890934c83f6ca3882e180a015191d70c30e92cb618c30e1cba0f"}
 *
 * Go source:
 * func Identity[T any](t T) T {
 * 	return t
 * }
 */
export function Identity<T>(t: T): T {
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::CheckEachDefined","kind":"func","status":"implemented","sigHash":"4fcaee62e139bdf23ff61239ea5ef45cacdc4765b079002722dba2c6f7d3d2ee","bodyHash":"3ad3ce69576dd3b83fea5af7dd7b3967b8093ad3e1153961dd25b40a0e8cc471"}
 *
 * Go source:
 * func CheckEachDefined[S any](s []*S, msg string) []*S {
 * 	for _, value := range s {
 * 		if value == nil {
 * 			panic(msg)
 * 		}
 * 	}
 * 	return s
 * }
 */
export function CheckEachDefined<S>(s: GoSlice<GoPtr<S>>, msg: string): GoSlice<GoPtr<S>> {
  for (const value of s) {
    if (value === undefined) {
      throw new globalThis.Error(msg);
    }
  }
  return s;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::IndexAfter","kind":"func","status":"implemented","sigHash":"2d6ab76ab57cdd5d5f0c6ea811f6c9ae3df44ca8efc6ceff27c16cdb3d1542bf","bodyHash":"7deb55f81c228fb16f824b5fc3c271dfa77f240d40ef3e5612bbe57903afdb39"}
 *
 * Go source:
 * func IndexAfter(s string, pattern string, startIndex int) int {
 * 	matched := strings.Index(s[startIndex:], pattern)
 * 	if matched == -1 {
 * 		return -1
 * 	} else {
 * 		return matched + startIndex
 * 	}
 * }
 */
export function IndexAfter(s: string, pattern: string, startIndex: int): int {
  const matched = strings.Index(byteSliceFrom(s, startIndex), pattern);
  if (matched === -1) {
    return -1;
  } else {
    return matched + startIndex;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ShouldRewriteModuleSpecifier","kind":"func","status":"implemented","sigHash":"dd5d830c720d5ad0563b93923446e0d325a690863120fd2d6f5d2747a047d500","bodyHash":"58cda48327c5b90fc9b1e43be0b3c72877e64450f4d1224bf2f7e87fb01fe78f"}
 *
 * Go source:
 * func ShouldRewriteModuleSpecifier(specifier string, compilerOptions *CompilerOptions) bool {
 * 	return compilerOptions.RewriteRelativeImportExtensions.IsTrue() && tspath.PathIsRelative(specifier) && !tspath.IsDeclarationFileName(specifier) && tspath.HasTSFileExtension(specifier)
 * }
 */
export function ShouldRewriteModuleSpecifier(specifier: string, compilerOptions: GoPtr<CompilerOptions>): bool {
  return Tristate_IsTrue(compilerOptions!.RewriteRelativeImportExtensions) && PathIsRelative(specifier) && !IsDeclarationFileName(specifier) && HasTSFileExtension(specifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::SingleElementSlice","kind":"func","status":"implemented","sigHash":"408e51ce0a659f1db8b999d49da2dbe6bf20b3b1cfdfd0c97d6083a7140aea3e","bodyHash":"ea5ec7c9bd030f577f86ec45861ddde99d1de3f8f2b4f83e2c955f7c3b806e4d"}
 *
 * Go source:
 * func SingleElementSlice[T any](element *T) []*T {
 * 	if element == nil {
 * 		return nil
 * 	}
 * 	return []*T{element}
 * }
 */
export function SingleElementSlice<T>(element: GoPtr<T>): GoSlice<GoPtr<T>> {
  if (element === undefined) {
    return [];
  }
  return [element];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::ConcatenateSeq","kind":"func","status":"implemented","sigHash":"7051ed3377b99c1d7e59067ccc2248cf0080c305fc803b7ac379ad6f14ff742f","bodyHash":"188d8ba0a7738cd8e78fb7b014616c6dcb125dcee6c734b9ffb42c9dcced30e5"}
 *
 * Go source:
 * func ConcatenateSeq[T any](seqs ...iter.Seq[T]) iter.Seq[T] {
 * 	return func(yield func(T) bool) {
 * 		for _, seq := range seqs {
 * 			if seq == nil {
 * 				continue
 * 			}
 * 			for e := range seq {
 * 				if !yield(e) {
 * 					return
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function ConcatenateSeq<T>(...seqs: Array<GoSeq<T>>): GoSeq<T> {
  return (yield_: (value: T) => bool): void => {
    for (const seq of seqs) {
      if (seq === undefined) {
        continue;
      }
      let stopped = false;
      seq((e: T): bool => {
        if (!yield_(e)) {
          stopped = true;
          return false;
        }
        return true;
      });
      if (stopped) {
        return;
      }
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Enumerate","kind":"func","status":"implemented","sigHash":"7e05a3338cd8712bd954f423a85fa508c77646a878a01e4bf3a6b13b319f19ef","bodyHash":"cbe8f986dc8b4400fc18b5f246370b6f43342ea87577cda66a4c7508bb4b7c8f"}
 *
 * Go source:
 * func Enumerate[T any](seq iter.Seq[T]) iter.Seq2[int, T] {
 * 	return func(yield func(int, T) bool) {
 * 		i := 0
 * 		for v := range seq {
 * 			if !yield(i, v) {
 * 				return
 * 			}
 * 			i++
 * 		}
 * 	}
 * }
 */
export function Enumerate<T>(seq: GoSeq<T>): GoSeq2<int, T> {
  return (yield_: (key: int, value: T) => bool): void => {
    let i = 0;
    seq((v: T): bool => {
      if (!yield_(i, v)) {
        return false;
      }
      i++;
      return true;
    });
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::comparableValuesEqual","kind":"func","status":"implemented","sigHash":"b8f1bf1bfa79a35f285653c43edf369a51e87e9329f4f46fb1afc65183aa2e25","bodyHash":"2fcd59a807f5e2fce4117e60660079da0b387646fb2bb3652bffafb44d7b5c04"}
 *
 * Go source:
 * func comparableValuesEqual[T comparable](a, b T) bool {
 * 	return a == b
 * }
 */
export function comparableValuesEqual<T extends GoComparable>(a: T, b: T): bool {
  return a === b;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::DiffMaps","kind":"func","status":"implemented","sigHash":"705db3666dc504a1dfe1f8fde907c1e04acb85ea6aa1fa4ad8a5345267c3dee1","bodyHash":"62c045a8b0d548794626503e461876f2429c0dbd39f18c6958c5d8f54a04d2aa"}
 *
 * Go source:
 * func DiffMaps[K comparable, V comparable](m1 map[K]V, m2 map[K]V, onAdded func(K, V), onRemoved func(K, V), onChanged func(K, V, V)) {
 * 	DiffMapsFunc(m1, m2, comparableValuesEqual, onAdded, onRemoved, onChanged)
 * }
 */
export function DiffMaps<K extends GoComparable, V extends GoComparable>(m1: GoMap<K, V>, m2: GoMap<K, V>, onAdded: (arg0: K, arg1: V) => void, onRemoved: (arg0: K, arg1: V) => void, onChanged: (arg0: K, arg1: V, arg2: V) => void): void {
  DiffMapsFunc(m1, m2, comparableValuesEqual, onAdded, onRemoved, onChanged);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::DiffMapsFunc","kind":"func","status":"implemented","sigHash":"d971788535050b31bbe52adec4163cb63ec813005b5dfcaf15aa85df793e58d6","bodyHash":"6f2d0a72112baada79df75d0cf693b942e492fde8974dc2b5918a57693cde12f"}
 *
 * Go source:
 * func DiffMapsFunc[K comparable, V1 any, V2 any](m1 map[K]V1, m2 map[K]V2, equalValues func(V1, V2) bool, onAdded func(K, V2), onRemoved func(K, V1), onChanged func(K, V1, V2)) {
 * 	if onAdded != nil {
 * 		for k, v2 := range m2 {
 * 			if _, ok := m1[k]; !ok {
 * 				onAdded(k, v2)
 * 			}
 * 		}
 * 	}
 * 	if onChanged == nil && onRemoved == nil {
 * 		return
 * 	}
 * 	for k, v1 := range m1 {
 * 		if v2, ok := m2[k]; ok {
 * 			if onChanged != nil && !equalValues(v1, v2) {
 * 				onChanged(k, v1, v2)
 * 			}
 * 		} else {
 * 			onRemoved(k, v1)
 * 		}
 * 	}
 * }
 */
export function DiffMapsFunc<K extends GoComparable, V1, V2>(m1: GoMap<K, V1>, m2: GoMap<K, V2>, equalValues: (arg0: V1, arg1: V2) => bool, onAdded: (arg0: K, arg1: V2) => void, onRemoved: (arg0: K, arg1: V1) => void, onChanged: (arg0: K, arg1: V1, arg2: V2) => void): void {
  if (onAdded !== undefined) {
    for (const [k, v2] of m2) {
      if (!m1.has(k)) {
        onAdded(k, v2);
      }
    }
  }
  if (onChanged === undefined && onRemoved === undefined) {
    return;
  }
  for (const [k, v1] of m1) {
    if (m2.has(k)) {
      const v2 = m2.get(k)!;
      if (onChanged !== undefined && !equalValues(v1, v2)) {
        onChanged(k, v1, v2);
      }
    } else {
      onRemoved(k, v1);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::CopyMapInto","kind":"func","status":"implemented","sigHash":"fd702b4259fea6ec44fd16663c03f9e2ba72382a6560f546b7da5bf9d476cd56","bodyHash":"3410fce65c4fd853ac74c528911a11c401dd4e3ba2b83eb060eac2ad5d16d27e"}
 *
 * Go source:
 * func CopyMapInto[M1 ~map[K]V, M2 ~map[K]V, K comparable, V any](dst M1, src M2) map[K]V {
 * 	if dst == nil {
 * 		return maps.Clone(src)
 * 	}
 * 	maps.Copy(dst, src)
 * 	return dst
 * }
 */
export function CopyMapInto<M1 extends GoMap<K, V>, M2 extends GoMap<K, V>, K extends GoComparable, V>(dst: M1, src: M2): GoMap<K, V> {
  if (dst === undefined) {
    return maps.Clone(src)!;
  }
  maps.Copy(dst, src);
  return dst;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::UnorderedEqual","kind":"func","status":"implemented","sigHash":"a4912c0012afa2fb516bd04ccdd04b7e8f552b9fa648abf3c0d14ef6162be25c","bodyHash":"2a1152640cd213b271db8db096f36733b02a164a2a14314ac52edab18f43e338"}
 *
 * Go source:
 * func UnorderedEqual[T comparable](s1 []T, s2 []T) bool {
 * 	if len(s1) != len(s2) {
 * 		return false
 * 	}
 * 	counts := make(map[T]int)
 * 	for _, v := range s1 {
 * 		counts[v]++
 * 	}
 * 	for _, v := range s2 {
 * 		counts[v]--
 * 		if counts[v] < 0 {
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export function UnorderedEqual<T extends GoComparable>(s1: GoSlice<T>, s2: GoSlice<T>): bool {
  if (s1.length !== s2.length) {
    return false;
  }
  const counts: GoMap<T, int> = new globalThis.Map<T, int>();
  for (const v of s1) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  for (const v of s2) {
    counts.set(v, (counts.get(v) ?? 0) - 1);
    if ((counts.get(v) ?? 0) < 0) {
      return false;
    }
  }
  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::Deduplicate","kind":"func","status":"implemented","sigHash":"9a48c7a2471597670d0e43bc7482ff4566ad093029c455021cff6f30490e2bd3","bodyHash":"c504ca61247b8feff6113bd3f6f1403253a79ff5d3094774be98766305d39ba1"}
 *
 * Go source:
 * func Deduplicate[T comparable](slice []T) []T {
 * 	if len(slice) > 1 {
 * 		for i, value := range slice {
 * 			if slices.Contains(slice[:i], value) {
 * 				result := slices.Clone(slice[:i])
 * 				for i++; i < len(slice); i++ {
 * 					value = slice[i]
 * 					if !slices.Contains(result, value) {
 * 						result = append(result, value)
 * 					}
 * 				}
 * 				return result
 * 			}
 * 		}
 * 	}
 * 	return slice
 * }
 */
export function Deduplicate<T extends GoComparable>(slice: GoSlice<T>): GoSlice<T> {
  if (slice.length > 1) {
    for (let i = 0; i < slice.length; i++) {
      let value = slice[i]!;
      if (slices.Contains(slice.slice(0, i), value)) {
        const result = slices.Clone(slice.slice(0, i))!;
        for (i++; i < slice.length; i++) {
          value = slice[i]!;
          if (!slices.Contains(result, value)) {
            result.push(value);
          }
        }
        return result;
      }
    }
  }
  return slice;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::DeduplicateSorted","kind":"func","status":"implemented","sigHash":"12b85e5ed219868935300ff9c7e3be0ab744d40fa405cee9957a43b28e5225d3","bodyHash":"ffc9de69d4bf0e6db80991b2c79168c63a9c720b666fca7f857212ceda321e5f"}
 *
 * Go source:
 * func DeduplicateSorted[T any](slice []T, isEqual func(a, b T) bool) []T {
 * 	if len(slice) == 0 {
 * 		return slice
 * 	}
 * 	last := slice[0]
 * 	deduplicated := slice[:1]
 * 	for i := 1; i < len(slice); i++ {
 * 		next := slice[i]
 * 		if isEqual(last, next) {
 * 			continue
 * 		}
 * 
 * 		deduplicated = append(deduplicated, next)
 * 		last = next
 * 	}
 * 
 * 	return deduplicated
 * }
 */
export function DeduplicateSorted<T>(slice: GoSlice<T>, isEqual: (a: T, b: T) => bool): GoSlice<T> {
  if (slice.length === 0) {
    return slice;
  }
  let last = slice[0]!;
  // Go uses `slice[:1]`, which aliases the input backing array and is then
  // grown via append. We build an equivalent fresh prefix; callers only consume
  // the returned slice, and aliasing Go's backing array is out of scope here.
  const deduplicated: GoSlice<T> = slice.slice(0, 1);
  for (let i = 1; i < slice.length; i++) {
    const next = slice[i]!;
    if (isEqual(last, next)) {
      continue;
    }

    deduplicated.push(next);
    last = next;
  }

  return deduplicated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/core.go::func::CompareBooleans","kind":"func","status":"implemented","sigHash":"e19ab8966ffa3148416ece58a6c261723cecd152a3ac17f4f2b2171b3cec7787","bodyHash":"8a07c362eb06180e44c6d757e1c801c4fd87e05316ab2c32304034310363c13c"}
 *
 * Go source:
 * func CompareBooleans(a, b bool) int {
 * 	if a && !b {
 * 		return 1
 * 	} else if !a && b {
 * 		return -1
 * 	}
 * 	return 0
 * }
 */
export function CompareBooleans(a: bool, b: bool): int {
  if (a && !b) {
    return 1;
  } else if (!a && b) {
    return -1;
  }
  return 0;
}
