import type { bool, byte, int } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { Value } from "../json/json.js";
import * as errors from "../../go/errors.js";
import * as fmt from "../../go/fmt.js";
import * as strconv from "../../go/strconv.js";
import * as json from "../json/json.js";

// Go's []byte(string) conversion: the UTF-8 encoding of the string.
const utf8Encoder = new globalThis.TextEncoder();
const stringToBytes = (s: string): GoSlice<byte> => globalThis.Array.from(utf8Encoder.encode(s));

// Go's string([]byte) conversion: decode the byte slice as UTF-8.
const utf8Decoder = new globalThis.TextDecoder();
const bytesToString = (b: GoSlice<byte>): string => utf8Decoder.decode(globalThis.Uint8Array.from(b));

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::JSONRPCVersion","kind":"type","status":"implemented","sigHash":"862966cbb3a87b3378ef0da3be95168f5876f23143ed055aeb03ff5807c0075b","bodyHash":"57944aa730fa3a5d0bf36879dfd621160da87adcffba194e603f65a468f2c624"}
 *
 * Go source:
 * JSONRPCVersion struct{}
 */
export interface JSONRPCVersion {
  readonly __tsgoEmpty?: never;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::constGroup::jsonRPCVersion","kind":"constGroup","status":"implemented","sigHash":"6019cfecab09cf4803b7e947f7d811d15d2c91673ccf221002817e1176f64f15","bodyHash":"c8a44f13517477103995855cd149816ab2bf7ec44f04ef651c5c8028c908c9ee"}
 *
 * Go source:
 * const jsonRPCVersion = `"2.0"`
 */
export const jsonRPCVersion: string = `"2.0"`;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::JSONRPCVersion.MarshalJSON","kind":"method","status":"implemented","sigHash":"41328545af96741aa90376e95c2362acfb4d6123410c701cd4a9e285b6385a78","bodyHash":"2e6860204c3849711448e76d1497af5215c36e5f5229a005f04bac1b96f5549f"}
 *
 * Go source:
 * func (JSONRPCVersion) MarshalJSON() ([]byte, error) {
 * 	return []byte(jsonRPCVersion), nil
 * }
 */
export function JSONRPCVersion_MarshalJSON(receiver: JSONRPCVersion): [GoSlice<byte>, GoError] {
  return [stringToBytes(jsonRPCVersion), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::varGroup::ErrInvalidJSONRPCVersion","kind":"varGroup","status":"implemented","sigHash":"9fd721a1bd0323199f24e00eed6a40a4e7328da7f362cfe65139e09abf18ed3e","bodyHash":"f80535dc4b1ce6ebce3e5fe6107e07c2ecb7b698ba30706e1669032ccec61557"}
 *
 * Go source:
 * var ErrInvalidJSONRPCVersion = errors.New("invalid JSON-RPC version")
 */
export let ErrInvalidJSONRPCVersion: GoError = errors.New("invalid JSON-RPC version");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::JSONRPCVersion.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"a64b96577d2d4da61797dfe2f3691b2c4dd3364e6d303a413bd2a93fd11fd12b","bodyHash":"05e89b6f6293ba238917722e357f40ce80dfb781cb34cbe6d745a97314ed7ece"}
 *
 * Go source:
 * func (*JSONRPCVersion) UnmarshalJSON(data []byte) error {
 * 	if string(data) != jsonRPCVersion {
 * 		return ErrInvalidJSONRPCVersion
 * 	}
 * 	return nil
 * }
 */
export function JSONRPCVersion_UnmarshalJSON(receiver: GoPtr<JSONRPCVersion>, data: GoSlice<byte>): GoError {
  if (bytesToString(data) !== jsonRPCVersion) {
    return ErrInvalidJSONRPCVersion;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::ID","kind":"type","status":"implemented","sigHash":"3fb5aa3d6164f0282f2f474b4946382f626b3ecdb6b13b0886574e4892aca88d","bodyHash":"019362e4003e5b0099fa97e4501f178df1776c0a025f6fb59afa91f9cd0efd9e"}
 *
 * Go source:
 * ID struct {
 * 	str string
 * 	int int32
 * }
 */
export interface ID {
  str: string;
  int: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::func::NewID","kind":"func","status":"implemented","sigHash":"5b4fa60531ea281646f70b64289aa0f4ffed2a098d24fdb5a075e154007d539e","bodyHash":"f90c50daf5d268d4c60b7958f07ee4110382d1286417a3ceabce93d0da14fe6d"}
 *
 * Go source:
 * func NewID(rawValue IntegerOrString) *ID {
 * 	if rawValue.String != nil {
 * 		return &ID{str: *rawValue.String}
 * 	}
 * 	return &ID{int: *rawValue.Integer}
 * }
 */
export function NewID(rawValue: IntegerOrString): GoPtr<ID> {
  if (rawValue.String !== undefined) {
    return { str: rawValue.String, int: 0 };
  }
  return { str: "", int: rawValue.Integer! };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::func::NewIDString","kind":"func","status":"implemented","sigHash":"5a9b195cbc88a8e1f0350842888cc34dd4e603891856af1ce9f2563df2b1cde4","bodyHash":"7e5131c5a51af6f79d2188d41a50203e28885c3c5736f2e901e7a70442e697a7"}
 *
 * Go source:
 * func NewIDString(str string) *ID {
 * 	return &ID{str: str}
 * }
 */
export function NewIDString(str: string): GoPtr<ID> {
  return { str: str, int: 0 };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::func::NewIDInt","kind":"func","status":"implemented","sigHash":"b92b83fbeeaf0f40c2fef72bef1d699c60eb2d8660820c5ab3ff5d59008f061f","bodyHash":"707400ae6debe0a359037643aea78740edda9dcb7da23053e5ca6a25b88ea428"}
 *
 * Go source:
 * func NewIDInt(i int32) *ID {
 * 	return &ID{int: i}
 * }
 */
export function NewIDInt(i: int): GoPtr<ID> {
  return { str: "", int: i };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ID.String","kind":"method","status":"implemented","sigHash":"6b6917e65e77ef16d5f4f874c63eda322fac28fe0a62dd95fb89c590300d536d","bodyHash":"c9912215a9f18df6652324a7c7efbae1e58b2942f95524003f59d0b9545d3226"}
 *
 * Go source:
 * func (id *ID) String() string {
 * 	if id.str != "" {
 * 		return id.str
 * 	}
 * 	return strconv.Itoa(int(id.int))
 * }
 */
export function ID_String(receiver: GoPtr<ID>): string {
  const id = receiver!;
  if (id.str !== "") {
    return id.str;
  }
  return strconv.Itoa(id.int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ID.MarshalJSON","kind":"method","status":"implemented","sigHash":"b12ea8402f1eb23f0ee8073a9ad5784c8b0a8b2aada279e036126b3f676961c9","bodyHash":"d8bfc7373886240fafb57dbc298ee938f7b8b410a4df9c71ba6b913d570b3056"}
 *
 * Go source:
 * func (id *ID) MarshalJSON() ([]byte, error) {
 * 	if id.str != "" {
 * 		return json.Marshal(id.str)
 * 	}
 * 	return json.Marshal(id.int)
 * }
 */
export function ID_MarshalJSON(receiver: GoPtr<ID>): [GoSlice<byte>, GoError] {
  const id = receiver!;
  if (id.str !== "") {
    return json.Marshal(id.str);
  }
  return json.Marshal(id.int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ID.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"a53e0eeb85ec7afe048658fe9d5a0a5d3dcef421949d19f2c94c72af4943ab9f","bodyHash":"505df2733dbb0ed9c7b75dfe81e0ea60866f1aebb9fa4adced14e8dff4b8986b"}
 *
 * Go source:
 * func (id *ID) UnmarshalJSON(data []byte) error {
 * 	*id = ID{}
 * 	if len(data) > 0 && data[0] == '"' {
 * 		return json.Unmarshal(data, &id.str)
 * 	}
 * 	return json.Unmarshal(data, &id.int)
 * }
 */
export function ID_UnmarshalJSON(receiver: GoPtr<ID>, data: GoSlice<byte>): GoError {
  const id = receiver!;
  id.str = "";
  id.int = 0;
  try {
    const value = globalThis.JSON.parse(bytesToString(data)) as unknown;
    if (typeof value === "string") {
      id.str = value;
      return undefined;
    }
    if (typeof value === "number" && globalThis.Number.isInteger(value)) {
      id.int = value as int;
      return undefined;
    }
    return new globalThis.Error("jsonrpc ID must be a string or integer");
  } catch (error) {
    return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ID.TryInt","kind":"method","status":"implemented","sigHash":"604dd27bd26ede0b547dbc14bbdf362bbe13d690ddea1046c50ab7fec46a0f52","bodyHash":"37b2ff292266f62b09812839c601e9e453eaeb23e7c89fb24145387efcf876a1"}
 *
 * Go source:
 * func (id *ID) TryInt() (int32, bool) {
 * 	if id == nil || id.str != "" {
 * 		return 0, false
 * 	}
 * 	return id.int, true
 * }
 */
export function ID_TryInt(receiver: GoPtr<ID>): [int, bool] {
  const id = receiver;
  if (id === undefined || id.str !== "") {
    return [0, false];
  }
  return [id.int, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ID.MustInt","kind":"method","status":"implemented","sigHash":"c2665aab5ac9c21f4669f8c083b2b596ff80f79a795e57212c647fe9dec251f2","bodyHash":"e96eb2294da8cd479d0dafa32a4759ac2f83cda88633f2f0472ae7fc93a6a0a7"}
 *
 * Go source:
 * func (id *ID) MustInt() int32 {
 * 	if id.str != "" {
 * 		panic("ID is not an integer")
 * 	}
 * 	return id.int
 * }
 */
export function ID_MustInt(receiver: GoPtr<ID>): int {
  const id = receiver!;
  if (id.str !== "") {
    throw new globalThis.Error("ID is not an integer");
  }
  return id.int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::IntegerOrString","kind":"type","status":"implemented","sigHash":"8d1839679e464bd8e9b0ce0a5136c109f88e1773d24a0abf77e27ee663801312","bodyHash":"8c5993b849f8633c2e87f09c606e01e0d774f9057e350573bfbfef08c5629728"}
 *
 * Go source:
 * IntegerOrString struct {
 * 	Integer *int32
 * 	String  *string
 * }
 */
export interface IntegerOrString {
  Integer: GoPtr<int>;
  String: GoPtr<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::ResponseError","kind":"type","status":"implemented","sigHash":"dc4efbd12b7dcb1c860060cfd7e40832477d4ecfb0d951bc5bc312d315c89f4e","bodyHash":"512e3bbd51a2bd267981fae634b61a976b260c2ac632a60f59e75f83f816d3b8"}
 *
 * Go source:
 * ResponseError struct {
 * 	Code    int32  `json:"code"`
 * 	Message string `json:"message"`
 * 	Data    any    `json:"data,omitzero"`
 * }
 */
export interface ResponseError {
  Code: int;
  Message: string;
  Data: unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ResponseError.String","kind":"method","status":"implemented","sigHash":"078342a1d72e84cd3a4819b474a6c365c50c9d29679690933d2806ac4f2b0a8a","bodyHash":"059c68916fed6c8813787debd0368efb0028ee6df07d23f4617557642933143e"}
 *
 * Go source:
 * func (r *ResponseError) String() string {
 * 	if r == nil {
 * 		return ""
 * 	}
 * 	data, err := json.Marshal(r.Data)
 * 	if err != nil {
 * 		return fmt.Sprintf("[%d]: %s\n%v", r.Code, r.Message, data)
 * 	}
 * 	return fmt.Sprintf("[%d]: %s", r.Code, r.Message)
 * }
 */
export function ResponseError_String(receiver: GoPtr<ResponseError>): string {
  const r = receiver;
  if (r === undefined) {
    return "";
  }
  const [data, err] = json.Marshal(r.Data);
  if (err !== undefined) {
    return fmt.Sprintf("[%d]: %s\n%v", r.Code, r.Message, data);
  }
  return fmt.Sprintf("[%d]: %s", r.Code, r.Message);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::ResponseError.Error","kind":"method","status":"implemented","sigHash":"d3151d4585406cb4c4fc1b2ecae44375ff52e57491f936ecaf1de45cfcc9585a","bodyHash":"2abe6d13a8c0c5b5d093621c7d2bf714ce9618ff66f2e0d3104dff28d831ee63"}
 *
 * Go source:
 * func (r *ResponseError) Error() string {
 * 	return r.String()
 * }
 */
export function ResponseError_Error(receiver: GoPtr<ResponseError>): string {
  const r = receiver!;
  return ResponseError_String(r);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::constGroup::CodeParseError+CodeInvalidRequest+CodeMethodNotFound+CodeInvalidParams+CodeInternalError","kind":"constGroup","status":"implemented","sigHash":"887ab2b2a0ae8658fb4dd5bb206925a792e547a88fd2d870ec4d8fcd7f7e7603","bodyHash":"efa2ea66d9039bde978596e11b0d5246ac4bedbf034514deed72bcb48757388e"}
 *
 * Go source:
 * const (
 * 	CodeParseError     int32 = -32700
 * 	CodeInvalidRequest int32 = -32600
 * 	CodeMethodNotFound int32 = -32601
 * 	CodeInvalidParams  int32 = -32602
 * 	CodeInternalError  int32 = -32603
 * )
 */
export const CodeParseError: int = -32700;
export const CodeInvalidRequest: int = -32600;
export const CodeMethodNotFound: int = -32601;
export const CodeInvalidParams: int = -32602;
export const CodeInternalError: int = -32603;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::MessageKind","kind":"type","status":"implemented","sigHash":"72ff49b8dd3eeb5eab0a0efc66724caefaacef797f0eec347eb1c307dd29d571","bodyHash":"360de883f8c7cf9d47f7d2fea8d26892fe3ad442fa4f8d68ab9a49146f26416b"}
 *
 * Go source:
 * MessageKind int
 */
export type MessageKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::constGroup::MessageKindNotification+MessageKindRequest+MessageKindResponse","kind":"constGroup","status":"implemented","sigHash":"9607231e573f0cd1201064ee819b46f28a3d51bbf4e002fab03ffb299c02afb8","bodyHash":"feeca1ff8cfbdc07d27f2e79f821a853d11c79f4bbca882ac3a2d5006393cd8b"}
 *
 * Go source:
 * const (
 * 	MessageKindNotification MessageKind = iota
 * 	MessageKindRequest
 * 	MessageKindResponse
 * )
 */
export const MessageKindNotification: MessageKind = 0;
export const MessageKindRequest: MessageKind = 1;
export const MessageKindResponse: MessageKind = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::Message","kind":"type","status":"implemented","sigHash":"a05b801837f37f9f77d233878f4cf76702957e58f1f0d2ebead3dd26d36b5861","bodyHash":"9ba7751eedf8edc9929829adaa8f6cecc7037f14a4f631038b23d57490966cbf"}
 *
 * Go source:
 * Message struct {
 * 	JSONRPC JSONRPCVersion `json:"jsonrpc"`
 * 	ID      *ID            `json:"id,omitzero"`
 * 	Method  string         `json:"method,omitzero"`
 * 	Params  json.Value     `json:"params,omitzero"`
 * 	Result  json.Value     `json:"result,omitzero"`
 * 	Error   *ResponseError `json:"error,omitzero"`
 * }
 */
export interface Message {
  JSONRPC: JSONRPCVersion;
  ID: GoPtr<ID>;
  Method: string;
  Params: Value;
  Result: Value;
  Error: GoPtr<ResponseError>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::Message.Kind","kind":"method","status":"implemented","sigHash":"7ec366b5e0f6537af7a9bec0edf751bd93b787380c06a4bbff48b1cb5a9217ae","bodyHash":"9ac523d7d20ac3bed72f89683357e71ece83ffb693ea38966f5ed2c1844b3ce3"}
 *
 * Go source:
 * func (m *Message) Kind() MessageKind {
 * 	if m.ID != nil && m.Method == "" {
 * 		return MessageKindResponse
 * 	}
 * 	if m.ID == nil {
 * 		return MessageKindNotification
 * 	}
 * 	return MessageKindRequest
 * }
 */
export function Message_Kind(receiver: GoPtr<Message>): MessageKind {
  const m = receiver!;
  if (m.ID !== undefined && m.Method === "") {
    return MessageKindResponse;
  }
  if (m.ID === undefined) {
    return MessageKindNotification;
  }
  return MessageKindRequest;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::Message.IsRequest","kind":"method","status":"implemented","sigHash":"f730f752f56194459abfbf2ced03e6b23335c6674378a6dd0b71aaa47c05ef67","bodyHash":"95b478ccb99285e5f76a93de31f2797134e66d1c6e0be5000858f7f7e257d8f8"}
 *
 * Go source:
 * func (m *Message) IsRequest() bool {
 * 	return m.ID != nil && m.Method != ""
 * }
 */
export function Message_IsRequest(receiver: GoPtr<Message>): bool {
  const m = receiver!;
  return m.ID !== undefined && m.Method !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::Message.IsNotification","kind":"method","status":"implemented","sigHash":"0daea8f67364519eddf20240eba67a60a9c5d5e3c77971af5c212da7fdc96224","bodyHash":"70950a0e72f74c0db09ec8b8608e886e78f1d5be3fa47c573c1bc910f069e8d7"}
 *
 * Go source:
 * func (m *Message) IsNotification() bool {
 * 	return m.ID == nil && m.Method != ""
 * }
 */
export function Message_IsNotification(receiver: GoPtr<Message>): bool {
  const m = receiver!;
  return m.ID === undefined && m.Method !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::method::Message.IsResponse","kind":"method","status":"implemented","sigHash":"484a7ac987f91c8aa0f23c3ab33ca05a7fec36d4fe4616b6b94e9330e122209c","bodyHash":"bdfffc9c10a1e2895c0d92d95d0a7c7c9a16319cd2039f506c309e9248f0ace5"}
 *
 * Go source:
 * func (m *Message) IsResponse() bool {
 * 	return m.ID != nil && m.Method == ""
 * }
 */
export function Message_IsResponse(receiver: GoPtr<Message>): bool {
  const m = receiver!;
  return m.ID !== undefined && m.Method === "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::RequestMessage","kind":"type","status":"implemented","sigHash":"4a33a8eafda826cc927f37e10dc1c50997d9ddb42da8c7180ee0940715c78f9e","bodyHash":"130aebd0ccbc36b5e24eb55ef0d4fb3053ac6086e0e9841ccbb9b4ab2d4bbc04"}
 *
 * Go source:
 * RequestMessage struct {
 * 	JSONRPC JSONRPCVersion `json:"jsonrpc"`
 * 	ID      *ID            `json:"id,omitzero"`
 * 	Method  string         `json:"method"`
 * 	Params  any            `json:"params,omitzero"`
 * }
 */
export interface RequestMessage {
  JSONRPC: JSONRPCVersion;
  ID: GoPtr<ID>;
  Method: string;
  Params: unknown;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/jsonrpc.go::type::ResponseMessage","kind":"type","status":"implemented","sigHash":"549281559d9afe85a1c939a420fa85e4a588f7c1acf73aa3645931b5bf8978d7","bodyHash":"e1e1ab59b79b0a01b898a6a4415a48684a158ea4151dd3562effc43cf452693c"}
 *
 * Go source:
 * ResponseMessage struct {
 * 	JSONRPC JSONRPCVersion `json:"jsonrpc"`
 * 	ID      *ID            `json:"id,omitzero"`
 * 	Result  any            `json:"result,omitzero"`
 * 	Error   *ResponseError `json:"error,omitzero"`
 * }
 */
export interface ResponseMessage {
  JSONRPC: JSONRPCVersion;
  ID: GoPtr<ID>;
  Result: unknown;
  Error: GoPtr<ResponseError>;
}
