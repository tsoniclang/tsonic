import type { bool, byte, int } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSeq } from "../../go/compat.js";
import { New as errorsNew } from "../../go/errors.js";
import { Arena_New } from "../core/arena.js";
import type { Arena } from "../core/arena.js";
import { IfElse } from "../core/core.js";
import type { UTF16Offset } from "../core/core.js";
import type { NameIndex, SourceIndex } from "./generator.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// `s[i]` is a byte. We mirror that contract by operating over the UTF-8 byte
// view of the mappings string.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const byteLenOf = (s: string): int => utf8Encoder.encode(s).length;
const byteAtOf = (s: string, i: int): byte => utf8Encoder.encode(s)[i]!;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::type::Mapping","kind":"type","status":"implemented","sigHash":"bd841521f01c848dc826ea94cec7f3ffecf995df4d0214f41418f6f021b944e6","bodyHash":"a4dc4d99ab173be3ab1d79b138f717b599478ebe163bc0b01b918bd4ab044eb9"}
 *
 * Go source:
 * Mapping struct {
 * 	GeneratedLine      int
 * 	GeneratedCharacter core.UTF16Offset
 * 	SourceIndex        SourceIndex
 * 	SourceLine         int
 * 	SourceCharacter    core.UTF16Offset
 * 	NameIndex          NameIndex
 * }
 */
export interface Mapping {
  GeneratedLine: int;
  GeneratedCharacter: UTF16Offset;
  SourceIndex: SourceIndex;
  SourceLine: int;
  SourceCharacter: UTF16Offset;
  NameIndex: NameIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::Mapping.Equals","kind":"method","status":"implemented","sigHash":"206387b36f011946248cc914011541d2bedb97cf76548957f8f4a8a9581aee5a","bodyHash":"34536d79934d2ed29b4c500045f0afee39827c72c88a77b2753ac8aeff009e76"}
 *
 * Go source:
 * func (m *Mapping) Equals(other *Mapping) bool {
 * 	return m == other || m.GeneratedLine == other.GeneratedLine &&
 * 		m.GeneratedCharacter == other.GeneratedCharacter &&
 * 		m.SourceIndex == other.SourceIndex &&
 * 		m.SourceLine == other.SourceLine &&
 * 		m.SourceCharacter == other.SourceCharacter &&
 * 		m.NameIndex == other.NameIndex
 * }
 */
export function Mapping_Equals(receiver: GoPtr<Mapping>, other: GoPtr<Mapping>): bool {
  const m: Mapping = receiver!;
  const o: Mapping = other!;
  return m === o || (m.GeneratedLine === o.GeneratedLine &&
    m.GeneratedCharacter === o.GeneratedCharacter &&
    m.SourceIndex === o.SourceIndex &&
    m.SourceLine === o.SourceLine &&
    m.SourceCharacter === o.SourceCharacter &&
    m.NameIndex === o.NameIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::Mapping.IsSourceMapping","kind":"method","status":"implemented","sigHash":"ba3aeb4f44b2fa95ec28f238a2723e20395f08ec8f09df7ae68f6466ae4211b8","bodyHash":"f58d7233b0164bcbaede960a66f8148738914beb750e95741475a7403cdd60fe"}
 *
 * Go source:
 * func (m *Mapping) IsSourceMapping() bool {
 * 	return m.SourceIndex != MissingSource &&
 * 		m.SourceLine != MissingLineOrColumn &&
 * 		m.SourceCharacter != MissingUTF16Column
 * }
 */
export function Mapping_IsSourceMapping(receiver: GoPtr<Mapping>): bool {
  const m: Mapping = receiver!;
  return m.SourceIndex !== MissingSource &&
    m.SourceLine !== MissingLineOrColumn &&
    m.SourceCharacter !== MissingUTF16Column;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::constGroup::MissingSource+MissingName+MissingLineOrColumn+MissingUTF16Column","kind":"constGroup","status":"implemented","sigHash":"62c89211d5982e97d9e61d4d1ecbd8604e535ef2dde3259b49e17ef62f2f11a2","bodyHash":"e50f668287fd046299f78615885cf7de3eeb14abe5bd34a6481d7d30ea599aef"}
 *
 * Go source:
 * const (
 * 	MissingSource       SourceIndex      = -1
 * 	MissingName         NameIndex        = -1
 * 	MissingLineOrColumn int              = -1
 * 	MissingUTF16Column  core.UTF16Offset = -1
 * )
 */
export const MissingSource: SourceIndex = -1;
export const MissingName: NameIndex = -1;
export const MissingLineOrColumn: int = -1;
export const MissingUTF16Column: UTF16Offset = -1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::type::MappingsDecoder","kind":"type","status":"implemented","sigHash":"6b80851acc4c1c102e5b85dbba34bfce95f220f38579502e12509f8ab28852d9","bodyHash":"ede3b585a4c58ace9bcedd3930b337ed3ffc5d9b8d4ed68cbdd1d2a6eebf56fe"}
 *
 * Go source:
 * MappingsDecoder struct {
 * 	mappings           string
 * 	done               bool
 * 	pos                int
 * 	generatedLine      int
 * 	generatedCharacter core.UTF16Offset
 * 	sourceIndex        SourceIndex
 * 	sourceLine         int
 * 	sourceCharacter    core.UTF16Offset
 * 	nameIndex          NameIndex
 * 	error              error
 * 	mappingArena       core.Arena[Mapping]
 * }
 */
export interface MappingsDecoder {
  mappings: string;
  done: bool;
  pos: int;
  generatedLine: int;
  generatedCharacter: UTF16Offset;
  sourceIndex: SourceIndex;
  sourceLine: int;
  sourceCharacter: UTF16Offset;
  nameIndex: NameIndex;
  error: GoError;
  mappingArena: Arena<Mapping>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::func::DecodeMappings","kind":"func","status":"implemented","sigHash":"e8b9e010ac156e3ed39bab8d5f56fce4971cdafe43b42658456a53b3a61f25ca","bodyHash":"a31bf2a62ff8e3ffed430f7b41cc483cea93d3d90e69ab2691d60ad8e995b215"}
 *
 * Go source:
 * func DecodeMappings(mappings string) *MappingsDecoder {
 * 	return &MappingsDecoder{mappings: mappings}
 * }
 */
export function DecodeMappings(mappings: string): GoPtr<MappingsDecoder> {
  return {
    mappings: mappings,
    done: false,
    pos: 0,
    generatedLine: 0,
    generatedCharacter: 0,
    sourceIndex: 0,
    sourceLine: 0,
    sourceCharacter: 0,
    nameIndex: 0,
    error: undefined,
    mappingArena: { data: [] },
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.MappingsString","kind":"method","status":"implemented","sigHash":"22002a7f060723a1bc467a46cdf9fd9faebd14549d8d89f2f7bd719a995b942e","bodyHash":"160c7916a443fcf335fb0d3b56835fd541b0d4c057bdaaad639268f16e30dd70"}
 *
 * Go source:
 * func (d *MappingsDecoder) MappingsString() string {
 * 	return d.mappings
 * }
 */
export function MappingsDecoder_MappingsString(receiver: GoPtr<MappingsDecoder>): string {
  const d: MappingsDecoder = receiver!;
  return d.mappings;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.Pos","kind":"method","status":"implemented","sigHash":"00b172d77e2906a84eebc2f4e5f7c83ecab480fb112b60bf8fbc1eacfdc796a5","bodyHash":"69789cfbb727687802c8376ad3c0ccf2f3a4541cc5f697af1e0155304d6db5b7"}
 *
 * Go source:
 * func (d *MappingsDecoder) Pos() int {
 * 	return d.pos
 * }
 */
export function MappingsDecoder_Pos(receiver: GoPtr<MappingsDecoder>): int {
  const d: MappingsDecoder = receiver!;
  return d.pos;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.Error","kind":"method","status":"implemented","sigHash":"39ec8268c2f1eda2d67a3f92cfdc35c7f64c19639334661b9b6a5842b4c83f13","bodyHash":"64b549f0c4c04afb06d6356be46991ac13e4ee18e58043e1349dcc32c5fe8d36"}
 *
 * Go source:
 * func (d *MappingsDecoder) Error() error {
 * 	return d.error
 * }
 */
export function MappingsDecoder_Error(receiver: GoPtr<MappingsDecoder>): GoError {
  const d: MappingsDecoder = receiver!;
  return d.error;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.State","kind":"method","status":"implemented","sigHash":"5f6a0b9be7446633362e091f562e75addd78adf3a4fafd0b89ffb350b5ca1cfd","bodyHash":"d448ffe448b6d90ab2df5789e86451ef14f84de1aee3f6d6296fdfc057e4a1d9"}
 *
 * Go source:
 * func (d *MappingsDecoder) State() *Mapping {
 * 	return d.captureMapping(true /*hasSource* /, true /*hasName* /)
 * }
 */
export function MappingsDecoder_State(receiver: GoPtr<MappingsDecoder>): GoPtr<Mapping> {
  const d: MappingsDecoder = receiver!;
  return MappingsDecoder_captureMapping(d, true /*hasSource*/, true /*hasName*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.Values","kind":"method","status":"implemented","sigHash":"67838f77a79c4b37fdc25503f157263c36153f0cb5705f1a376e313f57ff4d96","bodyHash":"496d2322fc2f88c4da2f65d9ca86017bc3ab67789174a70c8cb7fdb1676d2c4c"}
 *
 * Go source:
 * func (d *MappingsDecoder) Values() iter.Seq[*Mapping] {
 * 	return func(yield func(*Mapping) bool) {
 * 		for value, done := d.Next(); !done; value, done = d.Next() {
 * 			if !yield(value) {
 * 				break
 * 			}
 * 		}
 * 	}
 * }
 */
export function MappingsDecoder_Values(receiver: GoPtr<MappingsDecoder>): GoSeq<GoPtr<Mapping>> {
  const d: MappingsDecoder = receiver!;
  return (yield_: (value: GoPtr<Mapping>) => bool): void => {
    for (let [value, done] = MappingsDecoder_Next(d); !done; [value, done] = MappingsDecoder_Next(d)) {
      if (!yield_(value)) {
        break;
      }
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.Next","kind":"method","status":"implemented","sigHash":"ccf40ea0a918018b8468ace2187c3f4d1d5de970e4aa360f3e2f3cb48655532a","bodyHash":"bef82f7154c0312fc75bb07ee24a802feba7368978d3e0d25300a3a7d64149a0"}
 *
 * Go source:
 * func (d *MappingsDecoder) Next() (value *Mapping, done bool) {
 * 	for !d.done && d.pos < len(d.mappings) {
 * 		ch := d.mappings[d.pos]
 * 		if ch == ';' {
 * 			// new line
 * 			d.generatedLine++
 * 			d.generatedCharacter = 0
 * 			d.pos++
 * 			continue
 * 		}
 * 
 * 		if ch == ',' {
 * 			// Next entry is on same line - no action needed
 * 			d.pos++
 * 			continue
 * 		}
 * 
 * 		hasSource := false
 * 		hasName := false
 * 		d.generatedCharacter += core.UTF16Offset(d.base64VLQFormatDecode())
 * 		if d.hasReportedError() {
 * 			return d.stopIterating()
 * 		}
 * 		if d.generatedCharacter < 0 {
 * 			return d.setErrorAndStopIterating("Invalid generatedCharacter found")
 * 		}
 * 
 * 		if !d.isSourceMappingSegmentEnd() {
 * 			hasSource = true
 * 
 * 			d.sourceIndex += SourceIndex(d.base64VLQFormatDecode())
 * 			if d.hasReportedError() {
 * 				return d.stopIterating()
 * 			}
 * 			if d.sourceIndex < 0 {
 * 				return d.setErrorAndStopIterating("Invalid sourceIndex found")
 * 			}
 * 			if d.isSourceMappingSegmentEnd() {
 * 				return d.setErrorAndStopIterating("Unsupported Format: No entries after sourceIndex")
 * 			}
 * 
 * 			d.sourceLine += d.base64VLQFormatDecode()
 * 			if d.hasReportedError() {
 * 				return d.stopIterating()
 * 			}
 * 			if d.sourceLine < 0 {
 * 				return d.setErrorAndStopIterating("Invalid sourceLine found")
 * 			}
 * 			if d.isSourceMappingSegmentEnd() {
 * 				return d.setErrorAndStopIterating("Unsupported Format: No entries after sourceLine")
 * 			}
 * 
 * 			d.sourceCharacter += core.UTF16Offset(d.base64VLQFormatDecode())
 * 			if d.hasReportedError() {
 * 				return d.stopIterating()
 * 			}
 * 			if d.sourceCharacter < 0 {
 * 				return d.setErrorAndStopIterating("Invalid sourceCharacter found")
 * 			}
 * 
 * 			if !d.isSourceMappingSegmentEnd() {
 * 				hasName = true
 * 				d.nameIndex += NameIndex(d.base64VLQFormatDecode())
 * 				if d.hasReportedError() {
 * 					return d.stopIterating()
 * 				}
 * 				if d.nameIndex < 0 {
 * 					return d.setErrorAndStopIterating("Invalid nameIndex found")
 * 				}
 * 
 * 				if !d.isSourceMappingSegmentEnd() {
 * 					return d.setErrorAndStopIterating("Unsupported Error Format: Entries after nameIndex")
 * 				}
 * 			}
 * 		}
 * 
 * 		return d.captureMapping(hasSource, hasName), false
 * 	}
 * 
 * 	return d.stopIterating()
 * }
 */
export function MappingsDecoder_Next(receiver: GoPtr<MappingsDecoder>): [GoPtr<Mapping>, bool] {
  const d: MappingsDecoder = receiver!;
  while (!d.done && d.pos < byteLenOf(d.mappings)) {
    const ch: byte = byteAtOf(d.mappings, d.pos);
    if (ch === 0x3b /* ';' */) {
      // new line
      d.generatedLine++;
      d.generatedCharacter = 0;
      d.pos++;
      continue;
    }

    if (ch === 0x2c /* ',' */) {
      // Next entry is on same line - no action needed
      d.pos++;
      continue;
    }

    let hasSource = false;
    let hasName = false;
    d.generatedCharacter += MappingsDecoder_base64VLQFormatDecode(d);
    if (MappingsDecoder_hasReportedError(d)) {
      return MappingsDecoder_stopIterating(d);
    }
    if (d.generatedCharacter < 0) {
      return MappingsDecoder_setErrorAndStopIterating(d, "Invalid generatedCharacter found");
    }

    if (!MappingsDecoder_isSourceMappingSegmentEnd(d)) {
      hasSource = true;

      d.sourceIndex += MappingsDecoder_base64VLQFormatDecode(d);
      if (MappingsDecoder_hasReportedError(d)) {
        return MappingsDecoder_stopIterating(d);
      }
      if (d.sourceIndex < 0) {
        return MappingsDecoder_setErrorAndStopIterating(d, "Invalid sourceIndex found");
      }
      if (MappingsDecoder_isSourceMappingSegmentEnd(d)) {
        return MappingsDecoder_setErrorAndStopIterating(d, "Unsupported Format: No entries after sourceIndex");
      }

      d.sourceLine += MappingsDecoder_base64VLQFormatDecode(d);
      if (MappingsDecoder_hasReportedError(d)) {
        return MappingsDecoder_stopIterating(d);
      }
      if (d.sourceLine < 0) {
        return MappingsDecoder_setErrorAndStopIterating(d, "Invalid sourceLine found");
      }
      if (MappingsDecoder_isSourceMappingSegmentEnd(d)) {
        return MappingsDecoder_setErrorAndStopIterating(d, "Unsupported Format: No entries after sourceLine");
      }

      d.sourceCharacter += MappingsDecoder_base64VLQFormatDecode(d);
      if (MappingsDecoder_hasReportedError(d)) {
        return MappingsDecoder_stopIterating(d);
      }
      if (d.sourceCharacter < 0) {
        return MappingsDecoder_setErrorAndStopIterating(d, "Invalid sourceCharacter found");
      }

      if (!MappingsDecoder_isSourceMappingSegmentEnd(d)) {
        hasName = true;
        d.nameIndex += MappingsDecoder_base64VLQFormatDecode(d);
        if (MappingsDecoder_hasReportedError(d)) {
          return MappingsDecoder_stopIterating(d);
        }
        if (d.nameIndex < 0) {
          return MappingsDecoder_setErrorAndStopIterating(d, "Invalid nameIndex found");
        }

        if (!MappingsDecoder_isSourceMappingSegmentEnd(d)) {
          return MappingsDecoder_setErrorAndStopIterating(d, "Unsupported Error Format: Entries after nameIndex");
        }
      }
    }

    return [MappingsDecoder_captureMapping(d, hasSource, hasName), false];
  }

  return MappingsDecoder_stopIterating(d);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.captureMapping","kind":"method","status":"implemented","sigHash":"6e3a544bc41e17f1b940b715caf942841b26aa9d8a77b854cee17373ac50d584","bodyHash":"77f73a7f0728fc9ffc806ca3889622ea7f93c84296e4b67686ea503540e64f34"}
 *
 * Go source:
 * func (d *MappingsDecoder) captureMapping(hasSource bool, hasName bool) *Mapping {
 * 	mapping := d.mappingArena.New()
 * 	mapping.GeneratedLine = d.generatedLine
 * 	mapping.GeneratedCharacter = d.generatedCharacter
 * 	mapping.SourceIndex = core.IfElse(hasSource, d.sourceIndex, MissingSource)
 * 	mapping.SourceLine = core.IfElse(hasSource, d.sourceLine, MissingLineOrColumn)
 * 	mapping.SourceCharacter = core.IfElse(hasSource, d.sourceCharacter, MissingUTF16Column)
 * 	mapping.NameIndex = core.IfElse(hasName, d.nameIndex, MissingName)
 * 	return mapping
 * }
 */
export function MappingsDecoder_captureMapping(receiver: GoPtr<MappingsDecoder>, hasSource: bool, hasName: bool): GoPtr<Mapping> {
  const d: MappingsDecoder = receiver!;
  const mapping: Mapping = Arena_New<Mapping>(d.mappingArena)!;
  mapping.GeneratedLine = d.generatedLine;
  mapping.GeneratedCharacter = d.generatedCharacter;
  mapping.SourceIndex = IfElse(hasSource, d.sourceIndex, MissingSource);
  mapping.SourceLine = IfElse(hasSource, d.sourceLine, MissingLineOrColumn);
  mapping.SourceCharacter = IfElse(hasSource, d.sourceCharacter, MissingUTF16Column);
  mapping.NameIndex = IfElse(hasName, d.nameIndex, MissingName);
  return mapping;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.stopIterating","kind":"method","status":"implemented","sigHash":"13ddcc69dc018cfda5eeeef426123516fe1390bb318c445c9b4151eee2b43aea","bodyHash":"f2ca4e57d29d2996a9349829729b85fa1e35d04eb77ff6b64c4fe5435b80d3c4"}
 *
 * Go source:
 * func (d *MappingsDecoder) stopIterating() (*Mapping, bool) {
 * 	d.done = true
 * 	return nil, true
 * }
 */
export function MappingsDecoder_stopIterating(receiver: GoPtr<MappingsDecoder>): [GoPtr<Mapping>, bool] {
  const d: MappingsDecoder = receiver!;
  d.done = true;
  return [undefined, true];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.setError","kind":"method","status":"implemented","sigHash":"ed8930a77b35ebe60f87144c5c98fe304d1963e2aea58ac4e4f1b89e935571e2","bodyHash":"c98afde13c3447b210bd4eabc361265a4df1d9e2379a4ddcd611caad0858f975"}
 *
 * Go source:
 * func (d *MappingsDecoder) setError(err string) {
 * 	d.error = errors.New(err)
 * }
 */
export function MappingsDecoder_setError(receiver: GoPtr<MappingsDecoder>, err: string): void {
  const d: MappingsDecoder = receiver!;
  d.error = errorsNew(err);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.setErrorAndStopIterating","kind":"method","status":"implemented","sigHash":"cfe8f6c0f97fd4ce078273d5240f6f5814f6a88879fb31448e7e366b7ba50f74","bodyHash":"40b5faa79f1843bd9076b7f267db38fc704abba619671c9c51c5f9141ec1e65b"}
 *
 * Go source:
 * func (d *MappingsDecoder) setErrorAndStopIterating(err string) (*Mapping, bool) {
 * 	d.setError(err)
 * 	return d.stopIterating()
 * }
 */
export function MappingsDecoder_setErrorAndStopIterating(receiver: GoPtr<MappingsDecoder>, err: string): [GoPtr<Mapping>, bool] {
  const d: MappingsDecoder = receiver!;
  MappingsDecoder_setError(d, err);
  return MappingsDecoder_stopIterating(d);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.hasReportedError","kind":"method","status":"implemented","sigHash":"a5c3cc5c490b9494e8e6801172b0ced7b9b8eaa86d7ea24123db34982d13e0a9","bodyHash":"48ac7f890c45ed7878823beb2024fbee92f43f1e75b61c46f5c401a725935b19"}
 *
 * Go source:
 * func (d *MappingsDecoder) hasReportedError() bool {
 * 	return d.error != nil
 * }
 */
export function MappingsDecoder_hasReportedError(receiver: GoPtr<MappingsDecoder>): bool {
  const d: MappingsDecoder = receiver!;
  return d.error !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.isSourceMappingSegmentEnd","kind":"method","status":"implemented","sigHash":"52ac435c49ab3189e1dae8dab2a2e595ad1071739bf8311d75dbbf699046c92c","bodyHash":"70324f30876de32a4d57647adc8e26b9686c0236f951551b56b25c2a6fdf1f5b"}
 *
 * Go source:
 * func (d *MappingsDecoder) isSourceMappingSegmentEnd() bool {
 * 	return d.pos == len(d.mappings) || d.mappings[d.pos] == ',' || d.mappings[d.pos] == ';'
 * }
 */
export function MappingsDecoder_isSourceMappingSegmentEnd(receiver: GoPtr<MappingsDecoder>): bool {
  const d: MappingsDecoder = receiver!;
  return d.pos === byteLenOf(d.mappings) || byteAtOf(d.mappings, d.pos) === 0x2c /* ',' */ || byteAtOf(d.mappings, d.pos) === 0x3b /* ';' */;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::method::MappingsDecoder.base64VLQFormatDecode","kind":"method","status":"implemented","sigHash":"64ab8108a2e98f5654993149b2834f58ef1844f90bfdca9d09f2cb2146615f09","bodyHash":"ef5c5a1002de10c5fc0e9c3f2762498f9ad80e24edd5974ffd4f6988de251fc5"}
 *
 * Go source:
 * func (d *MappingsDecoder) base64VLQFormatDecode() int {
 * 	moreDigits := true
 * 	shiftCount := 0
 * 	value := 0
 * 	for ; moreDigits; d.pos++ {
 * 		if d.pos >= len(d.mappings) {
 * 			d.setError("Error in decoding base64VLQFormatDecode, past the mapping string")
 * 			return -1
 * 		}
 * 
 * 		// 6 digit number
 * 		currentByte := base64FormatDecode(d.mappings[d.pos])
 * 		if currentByte == -1 {
 * 			d.setError("Invalid character in VLQ")
 * 			return -1
 * 		}
 * 
 * 		// If msb is set, we still have more bits to continue
 * 		moreDigits = (currentByte & 32) != 0
 * 
 * 		// least significant 5 bits are the next msbs in the final value.
 * 		value = value | ((currentByte & 31) << shiftCount)
 * 		shiftCount += 5
 * 	}
 * 
 * 	// Least significant bit if 1 represents negative and rest of the msb is actual absolute value
 * 	if (value & 1) == 0 {
 * 		// + number
 * 		value = value >> 1
 * 	} else {
 * 		// - number
 * 		value = value >> 1
 * 		value = -value
 * 	}
 * 
 * 	return value
 * }
 */
export function MappingsDecoder_base64VLQFormatDecode(receiver: GoPtr<MappingsDecoder>): int {
  const d: MappingsDecoder = receiver!;
  let moreDigits = true;
  let shiftCount = 0;
  let value = 0;
  for (; moreDigits; d.pos++) {
    if (d.pos >= byteLenOf(d.mappings)) {
      MappingsDecoder_setError(d, "Error in decoding base64VLQFormatDecode, past the mapping string");
      return -1;
    }

    // 6 digit number
    const currentByte: int = base64FormatDecode(byteAtOf(d.mappings, d.pos));
    if (currentByte === -1) {
      MappingsDecoder_setError(d, "Invalid character in VLQ");
      return -1;
    }

    // If msb is set, we still have more bits to continue
    moreDigits = (currentByte & 32) !== 0;

    // least significant 5 bits are the next msbs in the final value.
    value = value | ((currentByte & 31) << shiftCount);
    shiftCount += 5;
  }

  // Least significant bit if 1 represents negative and rest of the msb is actual absolute value
  if ((value & 1) === 0) {
    // + number
    value = value >> 1;
  } else {
    // - number
    value = value >> 1;
    value = -value;
  }

  return value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/decoder.go::func::base64FormatDecode","kind":"func","status":"implemented","sigHash":"66e128933cd210a92ab84896028cfcdd0152d9dc20764060f57cfb94d196e988","bodyHash":"0c87c8713847c4d4f49892f4935df81a6bd7bf9bffd36de602568ba420fe51a6"}
 *
 * Go source:
 * func base64FormatDecode(ch byte) int {
 * 	switch {
 * 	case ch >= 'A' && ch <= 'Z':
 * 		return int(ch - 'A')
 * 	case ch >= 'a' && ch <= 'z':
 * 		return int(ch - 'a' + 26)
 * 	case ch >= '0' && ch <= '9':
 * 		return int(ch - '0' + 52)
 * 	case ch == '+':
 * 		return 62
 * 	case ch == '/':
 * 		return 63
 * 	default:
 * 		return -1
 * 	}
 * }
 */
export function base64FormatDecode(ch: byte): int {
  if (ch >= 0x41 /* 'A' */ && ch <= 0x5a /* 'Z' */) {
    return ch - 0x41 /* 'A' */;
  } else if (ch >= 0x61 /* 'a' */ && ch <= 0x7a /* 'z' */) {
    return ch - 0x61 /* 'a' */ + 26;
  } else if (ch >= 0x30 /* '0' */ && ch <= 0x39 /* '9' */) {
    return ch - 0x30 /* '0' */ + 52;
  } else if (ch === 0x2b /* '+' */) {
    return 62;
  } else if (ch === 0x2f /* '/' */) {
    return 63;
  } else {
    return -1;
  }
}
