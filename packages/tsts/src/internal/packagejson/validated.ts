import type { bool } from "@tsonic/core/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/validated.go::type::TypeValidatedField","kind":"type","status":"implemented","sigHash":"08c3fe5eb807bce46c07e1e32d6458a3fa43db13a594f15d6db9cc33159d4e62","bodyHash":"1e3286f4ea9ea46b59467ea03b05c91efc3d2cfacd691f04e33ebda87fb88b6d"}
 *
 * Go source:
 * TypeValidatedField interface {
 * 	IsPresent() bool
 * 	IsValid() bool
 * 	ExpectedJSONType() string
 * 	ActualJSONType() string
 * }
 */
export interface TypeValidatedField {
  IsPresent(): bool;
  IsValid(): bool;
  ExpectedJSONType(): string;
  ActualJSONType(): string;
}
