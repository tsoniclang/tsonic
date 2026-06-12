import type { bool, double, int, uint } from "@tsonic/core/types.js";
import * as math from "../../go/math.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::constGroup::MaxSafeInteger+MinSafeInteger","kind":"constGroup","status":"implemented","sigHash":"eeb6206bb04a088d45d5d8f9107fc8d2685d70335a0ccd8f8be01bf3e87013c6","bodyHash":"f4f39b0cd2fc02369e64024483b63f6b7f98205037426833f6f8e9c61ddda516"}
 *
 * Go source:
 * const (
 * 	MaxSafeInteger Number = 1<<53 - 1
 * 	MinSafeInteger Number = -MaxSafeInteger
 * )
 */
export const MaxSafeInteger: Number = (2 ** 53 - 1) as Number;
export const MinSafeInteger: Number = -MaxSafeInteger as Number;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::type::Number","kind":"type","status":"implemented","sigHash":"bba19200e7db1d43f3330c9d32b24112fef0d2e1d010038ec978a3513506c9ad","bodyHash":"85a1467d656e7508c2c4423ee1e20dc12278ec2cae6295a1023c1567fe859537"}
 *
 * Go source:
 * Number float64
 */
export type Number = double;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::func::NaN","kind":"func","status":"implemented","sigHash":"995f7fd220017b2cc971cad50be39804e37732d2828d24b4da1fc63fcf6464c0","bodyHash":"f26d44e4cbaea1810e4a304ba9811f3cbef95b1567a36a5c6cc69ec7446a852a"}
 *
 * Go source:
 * func NaN() Number {
 * 	return Number(math.NaN())
 * }
 */
export function NaN(): Number {
  return math.NaN() as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.IsNaN","kind":"method","status":"implemented","sigHash":"65d9dd4518ec6452b48a321304a002f750c42743a7d01dd9e1fe8f25557b714f","bodyHash":"61af22dde7eaa196c067b013336f10fad382d2c8e768e41991bd98c81ad69b4a"}
 *
 * Go source:
 * func (n Number) IsNaN() bool {
 * 	return math.IsNaN(float64(n))
 * }
 */
export function Number_IsNaN(receiver: Number): bool {
  return math.IsNaN(receiver as double);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::func::Inf","kind":"func","status":"implemented","sigHash":"cf53296be6324bc83abe909dd244faa6a89abbc67fbd7b51ee27ba5cb14fead3","bodyHash":"4cecbcb90fc0541bf72ebaae24931b823d5874641c94dd6d9e3ae79ee9b17fa4"}
 *
 * Go source:
 * func Inf(sign int) Number {
 * 	return Number(math.Inf(sign))
 * }
 */
export function Inf(sign: int): Number {
  return math.Inf(sign) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.IsInf","kind":"method","status":"implemented","sigHash":"27d64766a626ebddaf4578f820ca4fa8fc3650d434a7cc49ed305887de73f5ca","bodyHash":"6b70ec18f1a43362c1a7fb68ff671654fc693d4de8a598e858e128e9ee549e14"}
 *
 * Go source:
 * func (n Number) IsInf() bool {
 * 	return math.IsInf(float64(n), 0)
 * }
 */
export function Number_IsInf(receiver: Number): bool {
  return math.IsInf(receiver as double, 0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::func::isNonFinite","kind":"func","status":"implemented","sigHash":"8efbb66e26529903a31355d2541d1839400a09ef3363fce538eb24d798cd501a","bodyHash":"b0b11ecdb190fe5d63fbca5c37f01c4c12b3b2b822f1c5ed1a2e2d70e148190e"}
 *
 * Go source:
 * func isNonFinite(x float64) bool {
 * 	// This is equivalent to checking `math.IsNaN(x) || math.IsInf(x, 0)` in one operation.
 * 	const mask = 0x7FF0000000000000
 * 	return math.Float64bits(x)&mask == mask
 * }
 */
export function isNonFinite(x: double): bool {
  // This is equivalent to checking `math.IsNaN(x) || math.IsInf(x, 0)` in one operation.
  // The 64-bit AND against the exponent mask is performed via BigInt because the
  // mask (0x7FF0000000000000) and the uint64 bit pattern exceed JS's 32-bit
  // bitwise-operator range.
  const mask: bigint = 0x7ff0000000000000n;
  return (globalThis.BigInt(math.Float64bits(x)) & mask) === mask;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.toUint32","kind":"method","status":"implemented","sigHash":"6c220da26a4f43d20fc8f7ef9abc0c42aadbbac54cdf4f072c2f763259130e3e","bodyHash":"c725b7f4ab2f5255c518cbb0d1366b181b2d0cf5359b2d8d6d10f0500d476e24"}
 *
 * Go source:
 * func (x Number) toUint32() uint32 {
 * 	// The only difference between ToUint32 and ToInt32 is the interpretation of the bits.
 * 	return uint32(x.toInt32())
 * }
 */
export function Number_toUint32(receiver: Number): uint {
  // The only difference between ToUint32 and ToInt32 is the interpretation of the bits.
  // `uint32(int32)` reinterprets the same bit pattern as unsigned: `>>> 0`.
  return (Number_toInt32(receiver) >>> 0) as uint;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.toInt32","kind":"method","status":"implemented","sigHash":"c2d070156e54216d0672454ee47774fe109c0947ae1d4a11010c8570443352e7","bodyHash":"fa83d027c78624331fc8d95d84234a09c533ce4e8b5689b0d4dd41c2c795f048"}
 *
 * Go source:
 * func (n Number) toInt32() int32 {
 * 	x := float64(n)
 *
 * 	// Fast path: if the number is in the range (-2^31, 2^32), i.e. an SMI,
 * 	// then we don't need to do any special mapping.
 * 	if smi := int32(x); float64(smi) == x {
 * 		return smi
 * 	}
 *
 * 	// 2. If number is not finite or number is either +0𝔽 or -0𝔽, return +0𝔽.
 * 	// Zero was covered by the test above.
 * 	if isNonFinite(x) {
 * 		return 0
 * 	}
 *
 * 	// Let int be truncate(ℝ(number)).
 * 	x = math.Trunc(x)
 * 	// Let int32bit be int modulo 2**32.
 * 	x = math.Mod(x, 1<<32)
 * 	// If int32bit ≥ 2**31, return 𝔽(int32bit - 2**32); otherwise return 𝔽(int32bit).
 * 	return int32(int64(x))
 * }
 */
export function Number_toInt32(receiver: Number): int {
  const x: double = receiver as double;

  // Fast path: if the number is in the range (-2^31, 2^32), i.e. an SMI,
  // then we don't need to do any special mapping.
  // `int32(x)` truncates toward zero with 32-bit signed wrap, matched by `| 0`.
  const smi = (x | 0) as int;
  if ((smi as double) === x) {
    return smi;
  }

  // 2. If number is not finite or number is either +0𝔽 or -0𝔽, return +0𝔽.
  // Zero was covered by the test above.
  if (isNonFinite(x)) {
    return 0 as int;
  }

  // Let int be truncate(ℝ(number)).
  const truncated = math.Trunc(x);
  // Let int32bit be int modulo 2**32.
  const int32bit = math.Mod(truncated, 2 ** 32);
  // If int32bit ≥ 2**31, return 𝔽(int32bit - 2**32); otherwise return 𝔽(int32bit).
  // `int32(int64(x))` reinterprets the low 32 bits as signed, matched by `| 0`.
  return (int32bit | 0) as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.toShiftCount","kind":"method","status":"implemented","sigHash":"c94c787fa8a05ec52b53588106181f42f75e9b1066d2113554a425510ebc5ef0","bodyHash":"17b4559015cdd7f161c1aa26a1aa874bfb599d2b7a19925eab4771f84e963be8"}
 *
 * Go source:
 * func (x Number) toShiftCount() uint32 {
 * 	return x.toUint32() & 31
 * }
 */
export function Number_toShiftCount(receiver: Number): uint {
  return (Number_toUint32(receiver) & 31) as uint;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.SignedRightShift","kind":"method","status":"implemented","sigHash":"40dd33bd117dd588fc3852b8bdf6839be1d0f11f573e6700553b10d9ef285d48","bodyHash":"feba4e4d5eca8946e72763a083ed540ac5a82058948290bbdf282900e1af0059"}
 *
 * Go source:
 * func (x Number) SignedRightShift(y Number) Number {
 * 	return Number(x.toInt32() >> y.toShiftCount())
 * }
 */
export function Number_SignedRightShift(receiver: Number, y: Number): Number {
  return (Number_toInt32(receiver) >> Number_toShiftCount(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.UnsignedRightShift","kind":"method","status":"implemented","sigHash":"fd95b63e2723a69fddc999e7b5b7d13345abaaf8d52e74b6e6ddfd5c25933d18","bodyHash":"ade509ec440d8e9780338299ac581653c6987ea22ab635441da4602de4ed92ef"}
 *
 * Go source:
 * func (x Number) UnsignedRightShift(y Number) Number {
 * 	return Number(x.toUint32() >> y.toShiftCount())
 * }
 */
export function Number_UnsignedRightShift(receiver: Number, y: Number): Number {
  // `uint32 >> n` is a logical shift; `>>>` performs the unsigned right shift.
  return (Number_toUint32(receiver) >>> Number_toShiftCount(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.LeftShift","kind":"method","status":"implemented","sigHash":"fc2cd3bdea01fd3b8937f09387e73e56f69210e38e4cd84348c7984a87c9134e","bodyHash":"644a593b6dc6217e714bbc09993c8e20160ddbf63a3a1da909c5eabbe357742e"}
 *
 * Go source:
 * func (x Number) LeftShift(y Number) Number {
 * 	return Number(x.toInt32() << y.toShiftCount())
 * }
 */
export function Number_LeftShift(receiver: Number, y: Number): Number {
  return (Number_toInt32(receiver) << Number_toShiftCount(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.BitwiseNOT","kind":"method","status":"implemented","sigHash":"6e9f297c27f45264bf5587701d3329e458bad04f6f9c0f08355e0ea3e829a1e2","bodyHash":"226e572dc3a33e7d47272f80022fcc36013d84ff26d400b5fc63b962e81b9352"}
 *
 * Go source:
 * func (x Number) BitwiseNOT() Number {
 * 	return Number(^x.toInt32())
 * }
 */
export function Number_BitwiseNOT(receiver: Number): Number {
  return ~Number_toInt32(receiver) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.BitwiseOR","kind":"method","status":"implemented","sigHash":"69bdb8b8ebde18f045773310557b9f580bf0cefe8797cd85a44e85f088497148","bodyHash":"fb894a5b644d71cfaa50c7d33a26dbae755666cfc7e2f659dcaa348481146ca0"}
 *
 * Go source:
 * func (x Number) BitwiseOR(y Number) Number {
 * 	return Number(x.toInt32() | y.toInt32())
 * }
 */
export function Number_BitwiseOR(receiver: Number, y: Number): Number {
  return (Number_toInt32(receiver) | Number_toInt32(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.BitwiseAND","kind":"method","status":"implemented","sigHash":"58ea1c23770da4ee38cec951ffbf4deb9ec409ead82bb0ec95906c0022a9596f","bodyHash":"94664ff3a412c108f510f4a8561982e5fcde3fc0e952829644948bfd7991d211"}
 *
 * Go source:
 * func (x Number) BitwiseAND(y Number) Number {
 * 	return Number(x.toInt32() & y.toInt32())
 * }
 */
export function Number_BitwiseAND(receiver: Number, y: Number): Number {
  return (Number_toInt32(receiver) & Number_toInt32(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.BitwiseXOR","kind":"method","status":"implemented","sigHash":"a4bb81fc7bd5c40c8036959a4594213cea0fefdaed64190704ff297bf04e27fb","bodyHash":"57f2dc5555775adb255e78203a9b678a1f18228dadce981e37d9ec22a038e056"}
 *
 * Go source:
 * func (x Number) BitwiseXOR(y Number) Number {
 * 	return Number(x.toInt32() ^ y.toInt32())
 * }
 */
export function Number_BitwiseXOR(receiver: Number, y: Number): Number {
  return (Number_toInt32(receiver) ^ Number_toInt32(y)) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.trunc","kind":"method","status":"implemented","sigHash":"5e5a3f872a0293a663bcc0f32fae7510aa85c23a24d94e4166720f3039abddaa","bodyHash":"775bbff6c008f423d78f04074c8066ce100264f220b72fca4f37285e3db2efa2"}
 *
 * Go source:
 * func (x Number) trunc() Number {
 * 	return Number(math.Trunc(float64(x)))
 * }
 */
export function Number_trunc(receiver: Number): Number {
  return math.Trunc(receiver as double) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.Floor","kind":"method","status":"implemented","sigHash":"e6ebe87deaa9aa180804103288e5994b5758a4960deabf0c35a2cf1d64e44c06","bodyHash":"f74d935fdf15653151a9d985657dabef963b3eaaeb98600eed297ec202cc78c5"}
 *
 * Go source:
 * func (x Number) Floor() Number {
 * 	return Number(math.Floor(float64(x)))
 * }
 */
export function Number_Floor(receiver: Number): Number {
  return math.Floor(receiver as double) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.Abs","kind":"method","status":"implemented","sigHash":"31156d92815a7804aa0491fb8699f2804b5abd4a377b073838f4cb4410a17c20","bodyHash":"1a8adcb38425f8dcb604d6bad7004e1f051f3bdfe55fc71e126f1fc4da982636"}
 *
 * Go source:
 * func (x Number) Abs() Number {
 * 	return Number(math.Abs(float64(x)))
 * }
 */
export function Number_Abs(receiver: Number): Number {
  return math.Abs(receiver as double) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::varGroup::negativeZero","kind":"varGroup","status":"implemented","sigHash":"24acde1b150cee3f0353907004d55424b57fed096e411ba6b2ca18b5136408dc","bodyHash":"1fd81f742ae3b88b2171d40a4df80acb957941aa0298754fd75533e43bf248ba"}
 *
 * Go source:
 * var negativeZero = Number(math.Copysign(0, -1))
 */
export const negativeZero: Number = math.Copysign(0, -1) as Number;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.Remainder","kind":"method","status":"implemented","sigHash":"f9622ca1c6207c341cfd19c4568786ffbd5f8d91763bd8d71063441a4a482de6","bodyHash":"593adc70856ec82537da33fde2831f046fe13a16000ba74fe631c27b882105e6"}
 *
 * Go source:
 * func (n Number) Remainder(d Number) Number {
 * 	switch {
 * 	case n.IsNaN() || d.IsNaN():
 * 		return NaN()
 * 	case n.IsInf():
 * 		return NaN()
 * 	case d.IsInf():
 * 		return n
 * 	case d == 0:
 * 		return NaN()
 * 	case n == 0:
 * 		return n
 * 	}
 * 	return Number(math.Mod(float64(n), float64(d)))
 * }
 */
export function Number_Remainder(receiver: Number, d: Number): Number {
  switch (true) {
    case Number_IsNaN(receiver) || Number_IsNaN(d):
      return NaN();
    case Number_IsInf(receiver):
      return NaN();
    case Number_IsInf(d):
      return receiver;
    case d === (0 as Number):
      return NaN();
    case receiver === (0 as Number):
      return receiver;
  }
  return math.Mod(receiver as double, d as double) as Number;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/jsnum.go::method::Number.Exponentiate","kind":"method","status":"implemented","sigHash":"a9cd4318b3af4cb04ca38cec0dd7138184f5c70de84202b4019022f6c540e014","bodyHash":"628ff842be7201b8a53d5ac64594007430157fbdf83b4bd2ed98f634252a554a"}
 *
 * Go source:
 * func (base Number) Exponentiate(exponent Number) Number {
 * 	switch {
 * 	case (base == 1 || base == -1) && exponent.IsInf():
 * 		return NaN()
 * 	case base == 1 && exponent.IsNaN():
 * 		return NaN()
 * 	}
 *
 * 	b := float64(base)
 * 	e := float64(exponent)
 *
 * 	// For integer base ** integer exponent where the result exceeds 53 bits,
 * 	// math.Pow can be off by multiple ULPs vs JS engines. Use exact big.Int
 * 	// arithmetic and IEEE 754 round-to-nearest-even conversion instead.
 * 	// The ES spec (§6.1.6.1.3) says exponentiate returns an
 * 	// "implementation-approximated" value, so engines are allowed to differ.
 * 	// This won't exactly match every engine (V8's fdlibm-compiled pow can
 * 	// round halfway ties differently), but will always be within 1 ULP
 * 	// (unit in the last place, i.e. the least significant bit of the result).
 * 	if b >= math.MinInt64 && b <= math.MaxInt64 && b == math.Trunc(b) &&
 * 		e >= 0 && e <= math.MaxInt64 && e == math.Trunc(e) && !math.IsInf(e, 0) {
 * 		magnitude := e * math.Log2(math.Abs(b))
 * 		if magnitude > 53 && magnitude <= math.Log2(math.MaxFloat64) {
 * 			ri := new(big.Int).Exp(big.NewInt(int64(b)), big.NewInt(int64(e)), nil)
 * 			result, _ := new(big.Float).SetPrec(256).SetInt(ri).Float64()
 * 			return Number(result)
 * 		}
 * 	}
 *
 * 	return Number(math.Pow(b, e))
 * }
 */
export function Number_Exponentiate(receiver: Number, exponent: Number): Number {
  switch (true) {
    case (receiver === (1 as Number) || receiver === (-1 as Number)) && Number_IsInf(exponent):
      return NaN();
    case receiver === (1 as Number) && Number_IsNaN(exponent):
      return NaN();
  }

  const b: double = receiver as double;
  const e: double = exponent as double;

  // For integer base ** integer exponent where the result exceeds 53 bits,
  // use exact BigInt arithmetic and IEEE 754 round-to-nearest-even conversion.
  if (
    b >= math.MinInt64 &&
    b <= math.MaxInt64 &&
    b === math.Trunc(b) &&
    e >= 0 &&
    e <= math.MaxInt64 &&
    e === math.Trunc(e) &&
    !math.IsInf(e, 0)
  ) {
    const magnitude: double = e * math.Log2(math.Abs(b));
    if (magnitude > 53 && magnitude <= math.Log2(math.MaxFloat64)) {
      // Use BigInt for exact integer exponentiation, then convert to float64.
      const bBig = globalThis.BigInt(globalThis.Math.trunc(b));
      const eBig = globalThis.BigInt(globalThis.Math.trunc(e));
      const riBig = bBig ** eBig;
      const result: double = globalThis.Number(riBig) as double;
      return result as Number;
    }
  }

  return math.Pow(b, e) as Number;
}
