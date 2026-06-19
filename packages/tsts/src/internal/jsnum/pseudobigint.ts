import type { bool, byte, int } from "../../go/scalars.js";
import { CutPrefix, TrimLeft, TrimSuffix } from "../../go/strings.js";
import { Sprintf } from "../../go/fmt.js";
import { StringByteAt, StringByteLen } from "../../go/unicode/utf8.js";

const byteLen = StringByteLen;
const byteAt = (s: string, i: int): byte => StringByteAt(s, i) as byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::type::PseudoBigInt","kind":"type","status":"implemented","sigHash":"2c01c32f11727dc20097bc5fac4f0bef01a1d77c02fc05f3278b26533303babe","bodyHash":"0f4106f2abbd21512eb0198f560df140685b532155644faf40e4a5c29c804ae9"}
 *
 * Go source:
 * PseudoBigInt struct {
 * 	Negative    bool   // true if the value is a non-zero negative number.
 * 	Base10Value string // The absolute value in base 10 with no leading zeros. The value zero is represented as an empty string.
 * }
 */
export interface PseudoBigInt {
  Negative: bool;
  Base10Value: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::func::NewPseudoBigInt","kind":"func","status":"implemented","sigHash":"a71ed6b6132e52566a30675b6565119a452f2153ea9b07f909cacc9d1f9369b0","bodyHash":"e741a5dad5d64dd12a6c1035e4299f057e473af5502d9233765df76a6b2591d5"}
 *
 * Go source:
 * func NewPseudoBigInt(value string, negative bool) PseudoBigInt {
 * 	value = strings.TrimLeft(value, "0")
 * 	return PseudoBigInt{Negative: negative && len(value) != 0, Base10Value: value}
 * }
 */
export function NewPseudoBigInt(value: string, negative: bool): PseudoBigInt {
  value = TrimLeft(value, "0");
  return { Negative: negative && byteLen(value) !== 0, Base10Value: value };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::method::PseudoBigInt.String","kind":"method","status":"implemented","sigHash":"e89d6ccff06de0fe26f8b9acbbf29c76654d8de35ae48800308591fada16ced0","bodyHash":"7ee1bcba3fe521eecbcb90a1dcd4d62427c11794113efc1136d6199f839ecb13"}
 *
 * Go source:
 * func (value PseudoBigInt) String() string {
 * 	if len(value.Base10Value) == 0 {
 * 		return "0"
 * 	}
 * 	if value.Negative {
 * 		return "-" + value.Base10Value
 * 	}
 * 	return value.Base10Value
 * }
 */
export function PseudoBigInt_String(receiver: PseudoBigInt): string {
  if (byteLen(receiver.Base10Value) === 0) {
    return "0";
  }
  if (receiver.Negative) {
    return "-" + receiver.Base10Value;
  }
  return receiver.Base10Value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::method::PseudoBigInt.Sign","kind":"method","status":"implemented","sigHash":"50983c1bb782f167760a57008c49ae11ca213619d4b5732d800587339d84e8f9","bodyHash":"0358322f4a6c23b77820110d778b8e86999e8c05fc0ce3f3e0027fc745eeb21c"}
 *
 * Go source:
 * func (value PseudoBigInt) Sign() int {
 * 	if len(value.Base10Value) == 0 {
 * 		return 0
 * 	}
 * 	if value.Negative {
 * 		return -1
 * 	}
 * 	return 1
 * }
 */
export function PseudoBigInt_Sign(receiver: PseudoBigInt): int {
  if (byteLen(receiver.Base10Value) === 0) {
    return 0;
  }
  if (receiver.Negative) {
    return -1;
  }
  return 1;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::func::ParseValidBigInt","kind":"func","status":"implemented","sigHash":"0427aeeae20ff9bd799383a405b5244d1900eeb2e8d3595d1771ecce9cd13331","bodyHash":"65afc922c9cfe2091e79e54fa162fa3780bbeb53bdaeee24317e011ab74675eb"}
 *
 * Go source:
 * func ParseValidBigInt(text string) PseudoBigInt {
 * 	text, negative := strings.CutPrefix(text, "-")
 * 	return NewPseudoBigInt(ParsePseudoBigInt(text), negative)
 * }
 */
export function ParseValidBigInt(text: string): PseudoBigInt {
  let negative: bool;
  [text, negative] = CutPrefix(text, "-");
  return NewPseudoBigInt(ParsePseudoBigInt(text), negative);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsnum/pseudobigint.go::func::ParsePseudoBigInt","kind":"func","status":"implemented","sigHash":"7c956c53486e004ed5b295d5a96a01cd9f865a47daf6b333c1d2672698e040d5","bodyHash":"6ec628050fe614f4afed93b4ce1ba257734b021a8b1238f06e3cef85c7131f12"}
 *
 * Go source:
 * func ParsePseudoBigInt(stringValue string) string {
 * 	stringValue = strings.TrimSuffix(stringValue, "n")
 * 	var b1 byte
 * 	if len(stringValue) > 1 {
 * 		b1 = stringValue[1]
 * 	}
 * 	switch b1 {
 * 	case 'b', 'B', 'o', 'O', 'x', 'X':
 * 		// Not decimal.
 * 	default:
 * 		stringValue = strings.TrimLeft(stringValue, "0")
 * 		if stringValue == "" {
 * 			return "0"
 * 		}
 * 		return stringValue
 * 	}
 * 	bi, ok := new(big.Int).SetString(stringValue, 0)
 * 	if !ok {
 * 		panic(fmt.Sprintf("Failed to parse big int: %q", stringValue))
 * 	}
 * 	return bi.String() // !!!
 * }
 */
export function ParsePseudoBigInt(stringValue: string): string {
  stringValue = TrimSuffix(stringValue, "n");
  stringValue = stringValue.replaceAll("_", "");
  let b1: byte = 0 as byte;
  if (byteLen(stringValue) > 1) {
    b1 = byteAt(stringValue, 1);
  }
  switch (b1) {
    case 0x62 /* 'b' */:
    case 0x42 /* 'B' */:
    case 0x6f /* 'o' */:
    case 0x4f /* 'O' */:
    case 0x78 /* 'x' */:
    case 0x58 /* 'X' */:
      // Not decimal.
      break;
    default:
      stringValue = TrimLeft(stringValue, "0");
      if (stringValue === "") {
        return "0";
      }
      return stringValue;
  }
  // `new(big.Int).SetString(stringValue, 0)` parses with base inference. Go's
  // parser accepts numeric separators in base-inferred strings, while native
  // BigInt requires a separator-free string, so separators are stripped above
  // before this positive, prefix-tagged integer string reaches BigInt. A
  // malformed string makes Go report ok=false and panic; native BigInt throws on
  // the same malformed input, so the panic is mirrored as a throw with the same
  // message.
  let bi: bigint;
  try {
    bi = globalThis.BigInt(stringValue);
  } catch {
    throw new globalThis.Error(Sprintf("Failed to parse big int: %q", stringValue));
  }
  return bi.toString(); // !!!
}
