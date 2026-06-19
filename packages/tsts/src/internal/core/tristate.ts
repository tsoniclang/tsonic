import type { bool, byte } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::type::Tristate","kind":"type","status":"implemented","sigHash":"afc2764db09003807b774c75192ce4d8150e55a00bf72b284d91e19797999d52","bodyHash":"7bb9787ef02fc7bd59b07d8edddadec446bab331efa88f5fbd40737102585308"}
 *
 * Go source:
 * Tristate byte
 */
export type Tristate = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::constGroup::TSUnknown+TSFalse+TSTrue","kind":"constGroup","status":"implemented","sigHash":"447b9f2dd352c5faa8755a1f78e19219fb1b0c9281c6a560301494c883f4ea9e","bodyHash":"dfb53b589ec56ac4acea7bdbde84729fb9154132c46e2e132ece20228016762a"}
 *
 * Go source:
 * const (
 * 	TSUnknown Tristate = iota
 * 	TSFalse
 * 	TSTrue
 * )
 */
export const TSUnknown: Tristate = 0;
export const TSFalse: Tristate = 1;
export const TSTrue: Tristate = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.IsTrue","kind":"method","status":"implemented","sigHash":"e6195916d72df7c155a5d2804d4ab17ef5a2fba381fec9cbcad3abdf2f2fd31f","bodyHash":"9056bb5488ffe3e6338984fb54bf198a1caa86bb27a35820e5066b7e440ece6d"}
 *
 * Go source:
 * func (t Tristate) IsTrue() bool {
 * 	return t == TSTrue
 * }
 */
export function Tristate_IsTrue(receiver: Tristate): bool {
  const t: Tristate = receiver ?? TSUnknown;
  return t === TSTrue;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.IsTrueOrUnknown","kind":"method","status":"implemented","sigHash":"28fbf1eb632c5bf167b0b7674146fef02a27e4b1927eebbe27bea3ba106720ed","bodyHash":"e0419f25da6c1201776c621b9b69c3151bd797066bf26e4dc47d15e1890dc8d1"}
 *
 * Go source:
 * func (t Tristate) IsTrueOrUnknown() bool {
 * 	return t == TSTrue || t == TSUnknown
 * }
 */
export function Tristate_IsTrueOrUnknown(receiver: Tristate): bool {
  const t: Tristate = receiver ?? TSUnknown;
  return t === TSTrue || t === TSUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.IsFalse","kind":"method","status":"implemented","sigHash":"f4ba0f4ff98dbdcb25bd04b496476eb265e475242f7f68a14db0a1b7c95149e5","bodyHash":"9151c0745b3bb74406aa84ce28498b6e4fdc9df40315a51c2410317960952cb3"}
 *
 * Go source:
 * func (t Tristate) IsFalse() bool {
 * 	return t == TSFalse
 * }
 */
export function Tristate_IsFalse(receiver: Tristate): bool {
  const t: Tristate = receiver ?? TSUnknown;
  return t === TSFalse;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.IsFalseOrUnknown","kind":"method","status":"implemented","sigHash":"44c0296d061628aadeb77636c1f505b4898f0254ff42f40f29efcb4ac6aa7dd7","bodyHash":"34425bf34ba159790d2167cf2a661b9a4b663ec946f876e449c55a9ae09194ca"}
 *
 * Go source:
 * func (t Tristate) IsFalseOrUnknown() bool {
 * 	return t == TSFalse || t == TSUnknown
 * }
 */
export function Tristate_IsFalseOrUnknown(receiver: Tristate): bool {
  const t: Tristate = receiver ?? TSUnknown;
  return t === TSFalse || t === TSUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.IsUnknown","kind":"method","status":"implemented","sigHash":"ac5a996c6d167da37f512e1294620fb132b2113feb3a526389a8adce3cb8a446","bodyHash":"aab6cf9b50d569375e29f76772c3e8657d7011a4f17e4b5c08a8206fd5b0508e"}
 *
 * Go source:
 * func (t Tristate) IsUnknown() bool {
 * 	return t == TSUnknown
 * }
 */
export function Tristate_IsUnknown(receiver: Tristate): bool {
  const t: Tristate = receiver ?? TSUnknown;
  return t === TSUnknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.DefaultIfUnknown","kind":"method","status":"implemented","sigHash":"a4e9b26be60541b4fa0bc1871011329e5f51087b7425a02dafc12345576ab462","bodyHash":"9b717b22453b930928f044ee92badd2d1af07c307881ba6eb811ceb8135e4033"}
 *
 * Go source:
 * func (t Tristate) DefaultIfUnknown(value Tristate) Tristate {
 * 	if t == TSUnknown {
 * 		return value
 * 	}
 * 	return t
 * }
 */
export function Tristate_DefaultIfUnknown(receiver: Tristate, value: Tristate): Tristate {
  const t: Tristate = receiver ?? TSUnknown;
  if (t === TSUnknown) {
    return value;
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"dc8dfb64123d255e6a8b487249722136d46b033cde4fe500423025367c121db7","bodyHash":"36b2be3692b763fa578291e6a0e2254efb48fe042ff80115afb6ad7edfa23ab3"}
 *
 * Go source:
 * func (t *Tristate) UnmarshalJSON(data []byte) error {
 * 	switch string(data) {
 * 	case "true":
 * 		*t = TSTrue
 * 	case "false":
 * 		*t = TSFalse
 * 	default:
 * 		*t = TSUnknown
 * 	}
 * 	return nil
 * }
 */
export function Tristate_UnmarshalJSON(receiver: GoPtr<Tristate>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  const value = str === "true" ? TSTrue : str === "false" ? TSFalse : TSUnknown;
  if (typeof receiver === "object" && receiver !== null && "value" in receiver) {
    (receiver as unknown as { value: Tristate }).value = value;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::method::Tristate.MarshalJSON","kind":"method","status":"implemented","sigHash":"5f06b01d62b72021187964749c7c82392816dbd58dfc2c272820e257cc447a58","bodyHash":"014a9a2a5b07b8788d6cbc635146273246019b683ee4be8bfff8435c98251c4b"}
 *
 * Go source:
 * func (t Tristate) MarshalJSON() ([]byte, error) {
 * 	switch t {
 * 	case TSTrue:
 * 		return []byte("true"), nil
 * 	case TSFalse:
 * 		return []byte("false"), nil
 * 	default:
 * 		return []byte("null"), nil
 * 	}
 * }
 */
export function Tristate_MarshalJSON(receiver: Tristate): [GoSlice<byte>, GoError] {
  const t: Tristate = receiver;
  switch (t) {
    case TSTrue:
      return [stringToBytes("true"), undefined];
    case TSFalse:
      return [stringToBytes("false"), undefined];
    default:
      return [stringToBytes("null"), undefined];
  }
}

// Go's []byte(string) conversion: the UTF-8 encoding of the string as a byte slice.
const utf8Encoder = new globalThis.TextEncoder();
const utf8Decoder = new globalThis.TextDecoder();
function stringToBytes(s: string): GoSlice<byte> {
  return globalThis.Array.from(utf8Encoder.encode(s));
}

function bytesToString(data: GoSlice<byte>): string {
  return utf8Decoder.decode(new globalThis.Uint8Array(data as number[]));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/tristate.go::func::BoolToTristate","kind":"func","status":"implemented","sigHash":"4164fe9c4679bda4a48fd1cf34e5816a8563740d7d5d81243a3eeb4c62c60bbc","bodyHash":"6442c2c0921131136496507b99f2875af7320b68df3052996488faa3eb7ca5d0"}
 *
 * Go source:
 * func BoolToTristate(b bool) Tristate {
 * 	if b {
 * 		return TSTrue
 * 	}
 * 	return TSFalse
 * }
 */
export function BoolToTristate(b: bool): Tristate {
  if (b) {
    return TSTrue;
  }
  return TSFalse;
}
