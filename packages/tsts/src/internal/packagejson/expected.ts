import type { bool, byte } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::type::Expected","kind":"type","status":"implemented","sigHash":"0578b81f0116b83fc7391bb752528a2a0749e2b333b2c137bdcb48192067b93b","bodyHash":"41b5bba1ecb1d12dd768979039da756c40c2058df2ffd4e7cb129d45a8bfbeaf"}
 *
 * Go source:
 * Expected[T any] struct {
 * 	actualJSONType string
 * 	Null           bool
 * 	Valid          bool
 * 	Value          T
 * }
 */
export interface Expected<T = unknown> {
  actualJSONType: string;
  Null: bool;
  Valid: bool;
  Value: T;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"9b8483a42fe647f7a39db7f3368e9697ada696b748d0db98690cca9ad1067f70","bodyHash":"d40dd5710ef481d9514b2cf60ed31c2d3c1ee39c7c4a3fd02132a4e448eaeee1"}
 *
 * Go source:
 * func (e *Expected[T]) UnmarshalJSON(data []byte) error {
 * 	if string(data) == "null" {
 * 		*e = Expected[T]{Null: true, actualJSONType: "null"}
 * 		return nil
 * 	}
 * 	if json.Unmarshal(data, &e.Value) == nil {
 * 		e.Valid = true
 * 	}
 * 	switch data[0] {
 * 	case '"':
 * 		e.actualJSONType = "string"
 * 	case 't', 'f':
 * 		e.actualJSONType = "boolean"
 * 	case '[':
 * 		e.actualJSONType = "array"
 * 	case '{':
 * 		e.actualJSONType = "object"
 * 	default:
 * 		e.actualJSONType = "number"
 * 	}
 * 	return nil
 * }
 */
export function Expected_UnmarshalJSON<T>(receiver: GoPtr<Expected<T>>, data: GoSlice<byte>): GoError {
  const str = new globalThis.TextDecoder("utf-8").decode(new globalThis.Uint8Array(data as number[]));
  if (str === "null") {
    receiver!.Null = true as bool;
    receiver!.Valid = false as bool;
    receiver!.actualJSONType = "null";
    return undefined;
  }
  const first = data[0] ?? 0;
  receiver!.actualJSONType =
    first === 0x22 ? "string" :
    first === 0x74 || first === 0x66 ? "boolean" :
    first === 0x5b ? "array" :
    first === 0x7b ? "object" :
    "number";
  try {
    const value = globalThis.JSON.parse(str);
    const expectedJSONType = Expected_ExpectedJSONType(receiver);
    if (expectedJSONType === "unknown" || expectedJSONType === receiver!.actualJSONType) {
      receiver!.Value = value as T;
      receiver!.Valid = true as bool;
    }
  } catch (_) {
    // leave Valid false
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.IsPresent","kind":"method","status":"implemented","sigHash":"af31a608be8438d95d8504fbeab00f0681b62be0f074b4549ff5ce9ed351088d","bodyHash":"f527fc53a559146bbb9afb94d683ef8489bf6c83a9d3155f565ced6b84d72edd"}
 *
 * Go source:
 * func (e *Expected[T]) IsPresent() bool {
 * 	return e.actualJSONType != ""
 * }
 */
export function Expected_IsPresent<T>(receiver: GoPtr<Expected<T>>): bool {
  return ((receiver?.actualJSONType ?? "") !== "") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.GetValue","kind":"method","status":"implemented","sigHash":"7664cdf05b8d89bad5ce110db78deb7d46fd093d77a69d99791c214d3c62fb20","bodyHash":"613845e1a10d7748c0d74d8c605c48942a1f6a7300e95999e19fc3834138e0b4"}
 *
 * Go source:
 * func (e *Expected[T]) GetValue() (value T, ok bool) {
 * 	return e.Value, e.Valid
 * }
 */
export function Expected_GetValue<T>(receiver: GoPtr<Expected<T>>): [T, bool] {
  return [receiver?.Value as T, receiver?.Valid ?? false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.IsValid","kind":"method","status":"implemented","sigHash":"89c0a7c3eef468dfda5acaf15d6c93172e011dabac7c054ffa5fc41d84ed7925","bodyHash":"f37c7a053300624182f526602d97c457d250b5b9eb228ae85ff6522d394d30ba"}
 *
 * Go source:
 * func (e *Expected[T]) IsValid() bool {
 * 	return e.Valid
 * }
 */
export function Expected_IsValid<T>(receiver: GoPtr<Expected<T>>): bool {
  return receiver?.Valid ?? false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.ExpectedJSONType","kind":"method","status":"implemented","sigHash":"625d2bc98f54f53650359714bbb4cda5a5ad44aea9c0ed9367c74879e6b67c06","bodyHash":"c5abe3603688eeb357e83b00fac9cb4aa3f548c1cd00d884be6b70de87f70936"}
 *
 * Go source:
 * func (e *Expected[T]) ExpectedJSONType() string {
 * 	switch reflect.TypeFor[T]().Kind() {
 * 	case reflect.String:
 * 		return "string"
 * 	case reflect.Bool:
 * 		return "boolean"
 * 	case reflect.Slice, reflect.Array:
 * 		return "array"
 * 	case reflect.Map:
 * 		return "object"
 * 	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
 * 		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
 * 		return "number"
 * 	default:
 * 		return "unknown"
 * 	}
 * }
 */
export function Expected_ExpectedJSONType<T>(receiver: GoPtr<Expected<T>>): string {
  const value = receiver !== undefined ? receiver.Value : undefined;
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (globalThis.Array.isArray(value)) return "array";
  if (typeof value === "number") return "number";
  if (value !== null && value !== undefined && typeof value === "object") return "object";
  return "unknown";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::method::Expected.ActualJSONType","kind":"method","status":"implemented","sigHash":"a52ec75c53d9ec213026e0b8234c7500d927f234728c5feb02325901923ecaad","bodyHash":"19f36aa66558e7daf2b69ebb271cfaac3fe6dbc7eacfb7779c6d176a12c6cc10"}
 *
 * Go source:
 * func (e *Expected[T]) ActualJSONType() string {
 * 	return e.actualJSONType
 * }
 */
export function Expected_ActualJSONType<T>(receiver: GoPtr<Expected<T>>): string {
  return receiver?.actualJSONType ?? "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/expected.go::func::ExpectedOf","kind":"func","status":"implemented","sigHash":"9f196fa4f56681f6a3a5b110be018dc38c89a1ccce8b036d552934477122dbd2","bodyHash":"d12fb4753708aa6c4b99afd83d336685aee6104ba0a872f29753d1c34901d423"}
 *
 * Go source:
 * func ExpectedOf[T any](value T) Expected[T] {
 * 	return Expected[T]{Value: value, Valid: true, actualJSONType: (*Expected[T])(nil).ExpectedJSONType()}
 * }
 */
export function ExpectedOf<T>(value: T): Expected<T> {
  const actualJSONType =
    typeof value === "string" ? "string" :
    typeof value === "boolean" ? "boolean" :
    globalThis.Array.isArray(value) ? "array" :
    typeof value === "number" ? "number" :
    value !== null && value !== undefined && typeof value === "object" ? "object" : "unknown";
  return { Value: value, Valid: true as bool, Null: false as bool, actualJSONType };
}
