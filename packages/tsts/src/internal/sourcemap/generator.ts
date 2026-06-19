import type { bool, byte, int } from "../../go/scalars.js";
import type { GoError, GoMap, GoPtr, GoRune, GoSlice } from "../../go/compat.js";
import { NewEncoder as base64NewEncoder, StdEncoding as base64StdEncoding } from "../../go/encoding/base64.js";
import { New as errorsNew } from "../../go/errors.js";
import type { WriteCloser } from "../../go/io.js";
import { Builder } from "../../go/strings.js";
import { Clone as slicesClone } from "../../go/slices.js";
import type { UTF16Offset } from "../core/core.js";
import { JsonFieldNames, Marshal as jsonMarshal } from "../json/json.js";
import type { JsonFieldNameMap } from "../json/json.js";
import { GetRelativePathToDirectoryOrUrl } from "../tspath/path.js";
import type { ComparePathsOptions } from "../tspath/path.js";

// Go's `string([]byte)` decodes the bytes as UTF-8. We mirror that with a
// TextDecoder over the byte view.
const utf8Decoder: TextDecoder = new globalThis.TextDecoder("utf-8");
const bytesToString = (b: GoSlice<byte>): string => utf8Decoder.decode(Uint8Array.from(b));

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::type::SourceIndex","kind":"type","status":"implemented","sigHash":"3f30fda3ce8b05b5e5e9e211ffbe8fb3d5491183d629c35529fd2131d0658f4c","bodyHash":"bcdc04b218231d8992b21da3adb809fc7dd7c45fdb47a77a083bdb9986622a31"}
 *
 * Go source:
 * SourceIndex int
 */
export type SourceIndex = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::type::NameIndex","kind":"type","status":"implemented","sigHash":"7d45245cdf16881c524927f8167b7f78d85d7bd4c4a5a194d5a43951dbc58909","bodyHash":"ec2d94acdf03f641d9321f908d82da9aa197f56f8ca3fa553d8b315a06024679"}
 *
 * Go source:
 * NameIndex   int
 */
export type NameIndex = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::constGroup::sourceIndexNotSet+nameIndexNotSet+notSet+notSetUTF16","kind":"constGroup","status":"implemented","sigHash":"1251c3416de0b5742808be9c90ae5a85c7ca97ca86f3678eb9b37e964fca4069","bodyHash":"ad8864169058ddbcb27c5f1b2ffb107110d2cbeb2f7759912b7117747b7922c7"}
 *
 * Go source:
 * const (
 * 	sourceIndexNotSet SourceIndex      = -1
 * 	nameIndexNotSet   NameIndex        = -1
 * 	notSet            int              = -1
 * 	notSetUTF16       core.UTF16Offset = -1
 * )
 */
export const sourceIndexNotSet: SourceIndex = -1;
export const nameIndexNotSet: NameIndex = -1;
export const notSet: int = -1;
export const notSetUTF16: UTF16Offset = -1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::type::Generator","kind":"type","status":"implemented","sigHash":"610a92a8c4e5c4389263ff910a2867cc82668ceca75a12d85910dda54280fcf6","bodyHash":"5bf3a963be1b1845dec38ef31975804319106f42873a50c435aedf8eef8ebd82"}
 *
 * Go source:
 * Generator struct {
 * 	pathOptions               tspath.ComparePathsOptions
 * 	file                      string
 * 	sourceRoot                string
 * 	sourcesDirectoryPath      string
 * 	rawSources                []string
 * 	sources                   []string
 * 	sourceToSourceIndexMap    map[string]SourceIndex
 * 	sourcesContent            []*string
 * 	names                     []string
 * 	nameToNameIndexMap        map[string]NameIndex
 * 	mappings                  strings.Builder
 * 	lastGeneratedLine         int
 * 	lastGeneratedCharacter    core.UTF16Offset
 * 	lastSourceIndex           SourceIndex
 * 	lastSourceLine            int
 * 	lastSourceCharacter       core.UTF16Offset
 * 	lastNameIndex             NameIndex
 * 	hasLast                   bool
 * 	pendingGeneratedLine      int
 * 	pendingGeneratedCharacter core.UTF16Offset
 * 	pendingSourceIndex        SourceIndex
 * 	pendingSourceLine         int
 * 	pendingSourceCharacter    core.UTF16Offset
 * 	pendingNameIndex          NameIndex
 * 	hasPending                bool
 * 	hasPendingSource          bool
 * 	hasPendingName            bool
 * }
 */
export interface Generator {
  pathOptions: ComparePathsOptions;
  file: string;
  sourceRoot: string;
  sourcesDirectoryPath: string;
  rawSources: GoSlice<string>;
  sources: GoSlice<string>;
  sourceToSourceIndexMap: GoMap<string, SourceIndex>;
  sourcesContent: GoSlice<GoPtr<string>> | undefined;
  names: GoSlice<string>;
  nameToNameIndexMap: GoMap<string, NameIndex>;
  mappings: Builder;
  lastGeneratedLine: int;
  lastGeneratedCharacter: UTF16Offset;
  lastSourceIndex: SourceIndex;
  lastSourceLine: int;
  lastSourceCharacter: UTF16Offset;
  lastNameIndex: NameIndex;
  hasLast: bool;
  pendingGeneratedLine: int;
  pendingGeneratedCharacter: UTF16Offset;
  pendingSourceIndex: SourceIndex;
  pendingSourceLine: int;
  pendingSourceCharacter: UTF16Offset;
  pendingNameIndex: NameIndex;
  hasPending: bool;
  hasPendingSource: bool;
  hasPendingName: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::type::RawSourceMap","kind":"type","status":"implemented","sigHash":"d434ff395ac342979724943a02f02ef450750c76ddc3367d71323f60d4cce023","bodyHash":"d7eeacd8719eefd83b0802cd00cbb316fcbfc4020d76158135c318e27e8d7e94"}
 *
 * Go source:
 * RawSourceMap struct {
 * 	Version        int       `json:"version"`
 * 	File           string    `json:"file"`
 * 	SourceRoot     string    `json:"sourceRoot"`
 * 	Sources        []string  `json:"sources"`
 * 	Names          []string  `json:"names"`
 * 	Mappings       string    `json:"mappings"`
 * 	SourcesContent []*string `json:"sourcesContent,omitzero"`
 * }
 */
export interface RawSourceMap {
  [JsonFieldNames]?: JsonFieldNameMap;
  Version: int;
  File: string;
  SourceRoot: string;
  Sources: GoSlice<string>;
  Names: GoSlice<string>;
  Mappings: string;
  SourcesContent: GoSlice<GoPtr<string>> | undefined;
}

export const rawSourceMapJsonFieldNames: JsonFieldNameMap = {
  Version: "version",
  File: "file",
  SourceRoot: "sourceRoot",
  Sources: "sources",
  Names: "names",
  Mappings: "mappings",
  SourcesContent: { name: "sourcesContent", omitZero: true },
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::func::NewGenerator","kind":"func","status":"implemented","sigHash":"c47b2eee893e75a4b3c33c30638e0ba067f4f3e0bab5e3c8d63aa6bec6033aea","bodyHash":"ceb2044bd99d55af4bf12a12ff7c5dcad99d41b4fd772161cae7e8d8e15b5da9"}
 *
 * Go source:
 * func NewGenerator(file string, sourceRoot string, sourcesDirectoryPath string, options tspath.ComparePathsOptions) *Generator {
 * 	return &Generator{
 * 		file:                 file,
 * 		sourceRoot:           sourceRoot,
 * 		sourcesDirectoryPath: sourcesDirectoryPath,
 * 		pathOptions:          options,
 * 	}
 * }
 */
export function NewGenerator(file: string, sourceRoot: string, sourcesDirectoryPath: string, options: ComparePathsOptions): GoPtr<Generator> {
  return {
    file: file,
    sourceRoot: sourceRoot,
    sourcesDirectoryPath: sourcesDirectoryPath,
    pathOptions: options,
    rawSources: [],
    sources: [],
    sourceToSourceIndexMap: new globalThis.Map<string, SourceIndex>(),
    sourcesContent: undefined,
    names: [],
    nameToNameIndexMap: new globalThis.Map<string, NameIndex>(),
    mappings: new Builder(),
    lastGeneratedLine: 0,
    lastGeneratedCharacter: 0,
    lastSourceIndex: 0,
    lastSourceLine: 0,
    lastSourceCharacter: 0,
    lastNameIndex: 0,
    hasLast: false,
    pendingGeneratedLine: 0,
    pendingGeneratedCharacter: 0,
    pendingSourceIndex: 0,
    pendingSourceLine: 0,
    pendingSourceCharacter: 0,
    pendingNameIndex: 0,
    hasPending: false,
    hasPendingSource: false,
    hasPendingName: false,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.Sources","kind":"method","status":"implemented","sigHash":"9601984ee7c414e22e25ee3e75b365529548249add54484bf40c641c80035f99","bodyHash":"053b7bdeb930d7b3ab0229e165ae3c77b544a9836cadc6813a41bad77e7f9260"}
 *
 * Go source:
 * func (gen *Generator) Sources() []string { return gen.rawSources }
 */
export function Generator_Sources(receiver: GoPtr<Generator>): GoSlice<string> {
  const gen: Generator = receiver!;
  return gen.rawSources;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.AddSource","kind":"method","status":"implemented","sigHash":"417b5784016e1e4fcd765868206db8d328849bafbbfb2d3bbc3ac54c6103c7cf","bodyHash":"5a3a583fc681a10ddd281bd776b29646e85cd0dba51d56fd1b633cdf46170854"}
 *
 * Go source:
 * func (gen *Generator) AddSource(fileName string) SourceIndex {
 * 	source := tspath.GetRelativePathToDirectoryOrUrl(
 * 		gen.sourcesDirectoryPath,
 * 		fileName,
 * 		true, /*isAbsolutePathAnUrl* /
 * 		gen.pathOptions,
 * 	)
 * 
 * 	sourceIndex, found := gen.sourceToSourceIndexMap[source]
 * 	if !found {
 * 		sourceIndex = SourceIndex(len(gen.sources))
 * 		gen.sources = append(gen.sources, source)
 * 		gen.rawSources = append(gen.rawSources, fileName)
 * 		if gen.sourceToSourceIndexMap == nil {
 * 			gen.sourceToSourceIndexMap = make(map[string]SourceIndex)
 * 		}
 * 		gen.sourceToSourceIndexMap[source] = sourceIndex
 * 	}
 * 
 * 	return sourceIndex
 * }
 */
export function Generator_AddSource(receiver: GoPtr<Generator>, fileName: string): SourceIndex {
  const gen: Generator = receiver!;
  const source: string = GetRelativePathToDirectoryOrUrl(
    gen.sourcesDirectoryPath,
    fileName,
    true /*isAbsolutePathAnUrl*/,
    gen.pathOptions,
  );

  const found: bool = gen.sourceToSourceIndexMap.has(source);
  let sourceIndex: SourceIndex = found ? gen.sourceToSourceIndexMap.get(source)! : 0;
  if (!found) {
    sourceIndex = gen.sources.length;
    gen.sources.push(source);
    gen.rawSources.push(fileName);
    if (gen.sourceToSourceIndexMap === undefined) {
      gen.sourceToSourceIndexMap = new globalThis.Map<string, SourceIndex>();
    }
    gen.sourceToSourceIndexMap.set(source, sourceIndex);
  }

  return sourceIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.SetSourceContent","kind":"method","status":"implemented","sigHash":"fffd2caf50955aa927a6b85e869fa9e47eb6d3e0092e093ee55d77654a9196f3","bodyHash":"6be8b1cb38e6d845b47719c5b3da5671f5a1805f2410fd27fc00657e416aba16"}
 *
 * Go source:
 * func (gen *Generator) SetSourceContent(sourceIndex SourceIndex, content string) error {
 * 	if sourceIndex < 0 || int(sourceIndex) >= len(gen.sources) {
 * 		return errors.New("sourceIndex is out of range")
 * 	}
 * 	for len(gen.sourcesContent) <= int(sourceIndex) {
 * 		gen.sourcesContent = append(gen.sourcesContent, nil)
 * 	}
 * 	gen.sourcesContent[sourceIndex] = &content
 * 	return nil
 * }
 */
export function Generator_SetSourceContent(receiver: GoPtr<Generator>, sourceIndex: SourceIndex, content: string): GoError {
  const gen: Generator = receiver!;
  if (sourceIndex < 0 || sourceIndex >= gen.sources.length) {
    return errorsNew("sourceIndex is out of range");
  }
  while ((gen.sourcesContent ?? []).length <= sourceIndex) {
    gen.sourcesContent = [...(gen.sourcesContent ?? []), undefined];
  }
  gen.sourcesContent![sourceIndex] = content;
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.AddName","kind":"method","status":"implemented","sigHash":"339f9a5627f06ea5a98956cd6e3a1bc5e54e56ff2cbf315bec53c51d425596e7","bodyHash":"9f8ccbea1765382fcbc75967978e2216e2ea919d52f03828a8309bb6c5283aee"}
 *
 * Go source:
 * func (gen *Generator) AddName(name string) NameIndex {
 * 	nameIndex, found := gen.nameToNameIndexMap[name]
 * 	if !found {
 * 		nameIndex = NameIndex(len(gen.names))
 * 		gen.names = append(gen.names, name)
 * 		if gen.nameToNameIndexMap == nil {
 * 			gen.nameToNameIndexMap = make(map[string]NameIndex)
 * 		}
 * 		gen.nameToNameIndexMap[name] = nameIndex
 * 	}
 * 	return nameIndex
 * }
 */
export function Generator_AddName(receiver: GoPtr<Generator>, name: string): NameIndex {
  const gen: Generator = receiver!;
  const found: bool = gen.nameToNameIndexMap.has(name);
  let nameIndex: NameIndex = found ? gen.nameToNameIndexMap.get(name)! : 0;
  if (!found) {
    nameIndex = gen.names.length;
    gen.names.push(name);
    if (gen.nameToNameIndexMap === undefined) {
      gen.nameToNameIndexMap = new globalThis.Map<string, NameIndex>();
    }
    gen.nameToNameIndexMap.set(name, nameIndex);
  }
  return nameIndex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.isNewGeneratedPosition","kind":"method","status":"implemented","sigHash":"0e663d37d8749683ac6f735e7834f1ddf38b180918a8202a34e2732c1c0a9cd8","bodyHash":"d657c6e3186db3d3c857e19cc9403409cb5dad939594239bf128705ba474fe0f"}
 *
 * Go source:
 * func (gen *Generator) isNewGeneratedPosition(generatedLine int, generatedCharacter core.UTF16Offset) bool {
 * 	return !gen.hasPending ||
 * 		gen.pendingGeneratedLine != generatedLine ||
 * 		gen.pendingGeneratedCharacter != generatedCharacter
 * }
 */
export function Generator_isNewGeneratedPosition(receiver: GoPtr<Generator>, generatedLine: int, generatedCharacter: UTF16Offset): bool {
  const gen: Generator = receiver!;
  return !gen.hasPending ||
    gen.pendingGeneratedLine !== generatedLine ||
    gen.pendingGeneratedCharacter !== generatedCharacter;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.isBacktrackingSourcePosition","kind":"method","status":"implemented","sigHash":"4ca609bf83a659eaf55384a84914bcddb42f0f68606c1cce1d5b7d59afb2e801","bodyHash":"7bca54dce660b8343c8ca688f9a5086f39441bfc9048b4c39da21692d800f7d3"}
 *
 * Go source:
 * func (gen *Generator) isBacktrackingSourcePosition(sourceIndex SourceIndex, sourceLine int, sourceCharacter core.UTF16Offset) bool {
 * 	return sourceIndex != sourceIndexNotSet &&
 * 		sourceLine != notSet &&
 * 		sourceCharacter != notSetUTF16 &&
 * 		gen.pendingSourceIndex == sourceIndex &&
 * 		(gen.pendingSourceLine > sourceLine ||
 * 			gen.pendingSourceLine == sourceLine && gen.pendingSourceCharacter > sourceCharacter)
 * }
 */
export function Generator_isBacktrackingSourcePosition(receiver: GoPtr<Generator>, sourceIndex: SourceIndex, sourceLine: int, sourceCharacter: UTF16Offset): bool {
  const gen: Generator = receiver!;
  return sourceIndex !== sourceIndexNotSet &&
    sourceLine !== notSet &&
    sourceCharacter !== notSetUTF16 &&
    gen.pendingSourceIndex === sourceIndex &&
    (gen.pendingSourceLine > sourceLine ||
      (gen.pendingSourceLine === sourceLine && gen.pendingSourceCharacter > sourceCharacter));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.shouldCommitMapping","kind":"method","status":"implemented","sigHash":"9fac8173f219aa541c3d70aa394005e2260bd85bd441c0fd0a9fc45ebd4475d9","bodyHash":"76468ded1337fbb0336d8382f87c41677781631f7eb2263792bbb610d6681638"}
 *
 * Go source:
 * func (gen *Generator) shouldCommitMapping() bool {
 * 	return gen.hasPending && (!gen.hasLast ||
 * 		gen.lastGeneratedLine != gen.pendingGeneratedLine ||
 * 		gen.lastGeneratedCharacter != gen.pendingGeneratedCharacter ||
 * 		gen.lastSourceIndex != gen.pendingSourceIndex ||
 * 		gen.lastSourceLine != gen.pendingSourceLine ||
 * 		gen.lastSourceCharacter != gen.pendingSourceCharacter ||
 * 		gen.lastNameIndex != gen.pendingNameIndex)
 * }
 */
export function Generator_shouldCommitMapping(receiver: GoPtr<Generator>): bool {
  const gen: Generator = receiver!;
  return gen.hasPending && (!gen.hasLast ||
    gen.lastGeneratedLine !== gen.pendingGeneratedLine ||
    gen.lastGeneratedCharacter !== gen.pendingGeneratedCharacter ||
    gen.lastSourceIndex !== gen.pendingSourceIndex ||
    gen.lastSourceLine !== gen.pendingSourceLine ||
    gen.lastSourceCharacter !== gen.pendingSourceCharacter ||
    gen.lastNameIndex !== gen.pendingNameIndex);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.appendMappingCharCode","kind":"method","status":"implemented","sigHash":"31a950d24499aa97eeb03121b1835ab9adbe1d725037bfa5e347274125ab7d3f","bodyHash":"24500ebfb25d03bcd195f2958f79d6652d44a6f2c6f4b5ceeae9f43e7dd0104d"}
 *
 * Go source:
 * func (gen *Generator) appendMappingCharCode(charCode rune) {
 * 	gen.mappings.WriteRune(charCode)
 * }
 */
export function Generator_appendMappingCharCode(receiver: GoPtr<Generator>, charCode: GoRune): void {
  const gen: Generator = receiver!;
  gen.mappings.WriteRune(charCode);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.appendBase64VLQ","kind":"method","status":"implemented","sigHash":"554db0708dd4a1544034837f163e804005b9ecdb677b70204140a842d6c716f9","bodyHash":"0f13758a59895fc20d21841b0938d86cc3051953bd3b8508a1c75f6076a80962"}
 *
 * Go source:
 * func (gen *Generator) appendBase64VLQ(inValue int) {
 * 	// Add a new least significant bit that has the sign of the value.
 * 	// if negative number the least significant bit that gets added to the number has value 1
 * 	// else least significant bit value that gets added is 0
 * 	// eg. -1 changes to binary : 01 [1] => 3
 * 	//     +1 changes to binary : 01 [0] => 2
 * 	if inValue < 0 {
 * 		inValue = ((-inValue) << 1) + 1
 * 	} else {
 * 		inValue = inValue << 1
 * 	}
 * 
 * 	// Encode 5 bits at a time starting from least significant bits
 * 	for {
 * 		currentDigit := inValue & 31 // 11111
 * 		inValue = inValue >> 5
 * 		if inValue > 0 {
 * 			// There are still more digits to decode, set the msb (6th bit)
 * 			currentDigit = currentDigit | 32
 * 		}
 * 		gen.appendMappingCharCode(base64FormatEncode(currentDigit))
 * 		if inValue <= 0 {
 * 			break
 * 		}
 * 	}
 * }
 */
export function Generator_appendBase64VLQ(receiver: GoPtr<Generator>, inValue: int): void {
  const gen: Generator = receiver!;
  // Add a new least significant bit that has the sign of the value.
  // if negative number the least significant bit that gets added to the number has value 1
  // else least significant bit value that gets added is 0
  // eg. -1 changes to binary : 01 [1] => 3
  //     +1 changes to binary : 01 [0] => 2
  if (inValue < 0) {
    inValue = ((-inValue) << 1) + 1;
  } else {
    inValue = inValue << 1;
  }

  // Encode 5 bits at a time starting from least significant bits
  for (;;) {
    let currentDigit: int = inValue & 31; // 11111
    inValue = inValue >> 5;
    if (inValue > 0) {
      // There are still more digits to decode, set the msb (6th bit)
      currentDigit = currentDigit | 32;
    }
    Generator_appendMappingCharCode(gen, base64FormatEncode(currentDigit));
    if (inValue <= 0) {
      break;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.commitPendingMapping","kind":"method","status":"implemented","sigHash":"54cf566eb97eb65c6a917dc9a2e36e4a3dd6a87fb8d4911bf83f006af69e676f","bodyHash":"ec6bea5db81ab22c8463ed1ce2a266ff4a47158fe82925179e1628b91dba93ff"}
 *
 * Go source:
 * func (gen *Generator) commitPendingMapping() {
 * 	if !gen.shouldCommitMapping() {
 * 		return
 * 	}
 * 
 * 	// Line/Comma delimiters
 * 	if gen.lastGeneratedLine < gen.pendingGeneratedLine {
 * 		// Emit line delimiters
 * 		for {
 * 			gen.appendMappingCharCode(';')
 * 			gen.lastGeneratedLine++
 * 			if gen.lastGeneratedLine >= gen.pendingGeneratedLine {
 * 				break
 * 			}
 * 		}
 * 		// Only need to set this once
 * 		gen.lastGeneratedCharacter = 0
 * 	} else {
 * 		if gen.lastGeneratedLine != gen.pendingGeneratedLine {
 * 			// panic rather than error as an invariant has been violated
 * 			panic("generatedLine cannot backtrack")
 * 		}
 * 		// Emit comma to separate the entry
 * 		if gen.hasLast {
 * 			gen.appendMappingCharCode(',')
 * 		}
 * 	}
 * 
 * 	// 1. Relative generated character
 * 	gen.appendBase64VLQ(int(gen.pendingGeneratedCharacter - gen.lastGeneratedCharacter))
 * 	gen.lastGeneratedCharacter = gen.pendingGeneratedCharacter
 * 
 * 	if gen.hasPendingSource {
 * 		// 2. Relative sourceIndex
 * 		gen.appendBase64VLQ(int(gen.pendingSourceIndex - gen.lastSourceIndex))
 * 		gen.lastSourceIndex = gen.pendingSourceIndex
 * 
 * 		// 3. Relative source line
 * 		gen.appendBase64VLQ(gen.pendingSourceLine - gen.lastSourceLine)
 * 		gen.lastSourceLine = gen.pendingSourceLine
 * 
 * 		// 4. Relative source character
 * 		gen.appendBase64VLQ(int(gen.pendingSourceCharacter - gen.lastSourceCharacter))
 * 		gen.lastSourceCharacter = gen.pendingSourceCharacter
 * 
 * 		if gen.hasPendingName {
 * 			// 5. Relative nameIndex
 * 			gen.appendBase64VLQ(int(gen.pendingNameIndex - gen.lastNameIndex))
 * 			gen.lastNameIndex = gen.pendingNameIndex
 * 		}
 * 	}
 * 
 * 	gen.hasLast = true
 * }
 */
export function Generator_commitPendingMapping(receiver: GoPtr<Generator>): void {
  const gen: Generator = receiver!;
  if (!Generator_shouldCommitMapping(gen)) {
    return;
  }

  // Line/Comma delimiters
  if (gen.lastGeneratedLine < gen.pendingGeneratedLine) {
    // Emit line delimiters
    for (;;) {
      Generator_appendMappingCharCode(gen, 0x3b /* ';' */);
      gen.lastGeneratedLine++;
      if (gen.lastGeneratedLine >= gen.pendingGeneratedLine) {
        break;
      }
    }
    // Only need to set this once
    gen.lastGeneratedCharacter = 0;
  } else {
    if (gen.lastGeneratedLine !== gen.pendingGeneratedLine) {
      // panic rather than error as an invariant has been violated
      throw new globalThis.Error("generatedLine cannot backtrack");
    }
    // Emit comma to separate the entry
    if (gen.hasLast) {
      Generator_appendMappingCharCode(gen, 0x2c /* ',' */);
    }
  }

  // 1. Relative generated character
  Generator_appendBase64VLQ(gen, gen.pendingGeneratedCharacter - gen.lastGeneratedCharacter);
  gen.lastGeneratedCharacter = gen.pendingGeneratedCharacter;

  if (gen.hasPendingSource) {
    // 2. Relative sourceIndex
    Generator_appendBase64VLQ(gen, gen.pendingSourceIndex - gen.lastSourceIndex);
    gen.lastSourceIndex = gen.pendingSourceIndex;

    // 3. Relative source line
    Generator_appendBase64VLQ(gen, gen.pendingSourceLine - gen.lastSourceLine);
    gen.lastSourceLine = gen.pendingSourceLine;

    // 4. Relative source character
    Generator_appendBase64VLQ(gen, gen.pendingSourceCharacter - gen.lastSourceCharacter);
    gen.lastSourceCharacter = gen.pendingSourceCharacter;

    if (gen.hasPendingName) {
      // 5. Relative nameIndex
      Generator_appendBase64VLQ(gen, gen.pendingNameIndex - gen.lastNameIndex);
      gen.lastNameIndex = gen.pendingNameIndex;
    }
  }

  gen.hasLast = true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.addMapping","kind":"method","status":"implemented","sigHash":"66e0cd0de7218761242b709fea38f6254ee8750ac6fd80500c353ea76ecf0d06","bodyHash":"3c3ba27474212f9adb56ef5868f63113c01fcedbdae6cbc6560306fadbda8d0e"}
 *
 * Go source:
 * func (gen *Generator) addMapping(generatedLine int, generatedCharacter core.UTF16Offset, sourceIndex SourceIndex, sourceLine int, sourceCharacter core.UTF16Offset, nameIndex NameIndex) {
 * 	if gen.isNewGeneratedPosition(generatedLine, generatedCharacter) ||
 * 		gen.isBacktrackingSourcePosition(sourceIndex, sourceLine, sourceCharacter) {
 * 		gen.commitPendingMapping()
 * 		gen.pendingGeneratedLine = generatedLine
 * 		gen.pendingGeneratedCharacter = generatedCharacter
 * 		gen.hasPendingSource = false
 * 		gen.hasPendingName = false
 * 		gen.hasPending = true
 * 	}
 * 
 * 	if sourceIndex != sourceIndexNotSet && sourceLine != notSet && sourceCharacter != notSetUTF16 {
 * 		gen.pendingSourceIndex = sourceIndex
 * 		gen.pendingSourceLine = sourceLine
 * 		gen.pendingSourceCharacter = sourceCharacter
 * 		gen.hasPendingSource = true
 * 		if nameIndex != nameIndexNotSet {
 * 			gen.pendingNameIndex = nameIndex
 * 			gen.hasPendingName = true
 * 		}
 * 	}
 * }
 */
export function Generator_addMapping(receiver: GoPtr<Generator>, generatedLine: int, generatedCharacter: UTF16Offset, sourceIndex: SourceIndex, sourceLine: int, sourceCharacter: UTF16Offset, nameIndex: NameIndex): void {
  const gen: Generator = receiver!;
  if (Generator_isNewGeneratedPosition(gen, generatedLine, generatedCharacter) ||
    Generator_isBacktrackingSourcePosition(gen, sourceIndex, sourceLine, sourceCharacter)) {
    Generator_commitPendingMapping(gen);
    gen.pendingGeneratedLine = generatedLine;
    gen.pendingGeneratedCharacter = generatedCharacter;
    gen.hasPendingSource = false;
    gen.hasPendingName = false;
    gen.hasPending = true;
  }

  if (sourceIndex !== sourceIndexNotSet && sourceLine !== notSet && sourceCharacter !== notSetUTF16) {
    gen.pendingSourceIndex = sourceIndex;
    gen.pendingSourceLine = sourceLine;
    gen.pendingSourceCharacter = sourceCharacter;
    gen.hasPendingSource = true;
    if (nameIndex !== nameIndexNotSet) {
      gen.pendingNameIndex = nameIndex;
      gen.hasPendingName = true;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.AddGeneratedMapping","kind":"method","status":"implemented","sigHash":"014b2bccae8aa85f405ebc9c171ec2fdd900568cbba9676f78c2e594b56c131d","bodyHash":"2601eddc7f24cbbe8e5d4641e5cd071cef2303d9e97632bfb67e4dad6d563d2e"}
 *
 * Go source:
 * func (gen *Generator) AddGeneratedMapping(generatedLine int, generatedCharacter core.UTF16Offset) error {
 * 	if generatedLine < gen.pendingGeneratedLine {
 * 		return errors.New("generatedLine cannot backtrack")
 * 	}
 * 	if generatedCharacter < 0 {
 * 		return errors.New("generatedCharacter cannot be negative")
 * 	}
 * 	gen.addMapping(generatedLine, generatedCharacter, sourceIndexNotSet, notSet /*sourceLine* /, notSetUTF16 /*sourceCharacter* /, nameIndexNotSet)
 * 	return nil
 * }
 */
export function Generator_AddGeneratedMapping(receiver: GoPtr<Generator>, generatedLine: int, generatedCharacter: UTF16Offset): GoError {
  const gen: Generator = receiver!;
  if (generatedLine < gen.pendingGeneratedLine) {
    return errorsNew("generatedLine cannot backtrack");
  }
  if (generatedCharacter < 0) {
    return errorsNew("generatedCharacter cannot be negative");
  }
  Generator_addMapping(gen, generatedLine, generatedCharacter, sourceIndexNotSet, notSet /*sourceLine*/, notSetUTF16 /*sourceCharacter*/, nameIndexNotSet);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.AddSourceMapping","kind":"method","status":"implemented","sigHash":"74956c99b00db571bae5520ae494b5cb1e377e85f50750937b40b53aa336200e","bodyHash":"4bc5456f19565ee44f1f7f6a14afc8358b342fe1c9188d4e57172d1f0f6401d0"}
 *
 * Go source:
 * func (gen *Generator) AddSourceMapping(generatedLine int, generatedCharacter core.UTF16Offset, sourceIndex SourceIndex, sourceLine int, sourceCharacter core.UTF16Offset) error {
 * 	if generatedLine < gen.pendingGeneratedLine {
 * 		return errors.New("generatedLine cannot backtrack")
 * 	}
 * 	if generatedCharacter < 0 {
 * 		return errors.New("generatedCharacter cannot be negative")
 * 	}
 * 	if sourceIndex < 0 || int(sourceIndex) >= len(gen.sources) {
 * 		return errors.New("sourceIndex is out of range")
 * 	}
 * 	if sourceLine < 0 {
 * 		return errors.New("sourceLine cannot be negative")
 * 	}
 * 	if sourceCharacter < 0 {
 * 		return errors.New("sourceCharacter cannot be negative")
 * 	}
 * 	gen.addMapping(generatedLine, generatedCharacter, sourceIndex, sourceLine, sourceCharacter, nameIndexNotSet)
 * 	return nil
 * }
 */
export function Generator_AddSourceMapping(receiver: GoPtr<Generator>, generatedLine: int, generatedCharacter: UTF16Offset, sourceIndex: SourceIndex, sourceLine: int, sourceCharacter: UTF16Offset): GoError {
  const gen: Generator = receiver!;
  if (generatedLine < gen.pendingGeneratedLine) {
    return errorsNew("generatedLine cannot backtrack");
  }
  if (generatedCharacter < 0) {
    return errorsNew("generatedCharacter cannot be negative");
  }
  if (sourceIndex < 0 || sourceIndex >= gen.sources.length) {
    return errorsNew("sourceIndex is out of range");
  }
  if (sourceLine < 0) {
    return errorsNew("sourceLine cannot be negative");
  }
  if (sourceCharacter < 0) {
    return errorsNew("sourceCharacter cannot be negative");
  }
  Generator_addMapping(gen, generatedLine, generatedCharacter, sourceIndex, sourceLine, sourceCharacter, nameIndexNotSet);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.AddNamedSourceMapping","kind":"method","status":"implemented","sigHash":"03cf66678c21b122ef49685cf7951be97dbda1a3ae39807d7af72e384ee053a4","bodyHash":"7d2a476160e7c6ec58a5e58afa9da27a62200c7d9db159069e62e91d8bd23808"}
 *
 * Go source:
 * func (gen *Generator) AddNamedSourceMapping(generatedLine int, generatedCharacter core.UTF16Offset, sourceIndex SourceIndex, sourceLine int, sourceCharacter core.UTF16Offset, nameIndex NameIndex) error {
 * 	if generatedLine < gen.pendingGeneratedLine {
 * 		return errors.New("generatedLine cannot backtrack")
 * 	}
 * 	if generatedCharacter < 0 {
 * 		return errors.New("generatedCharacter cannot be negative")
 * 	}
 * 	if sourceIndex < 0 || int(sourceIndex) >= len(gen.sources) {
 * 		return errors.New("sourceIndex is out of range")
 * 	}
 * 	if sourceLine < 0 {
 * 		return errors.New("sourceLine cannot be negative")
 * 	}
 * 	if sourceCharacter < 0 {
 * 		return errors.New("sourceCharacter cannot be negative")
 * 	}
 * 	if nameIndex < 0 || int(nameIndex) >= len(gen.names) {
 * 		return errors.New("nameIndex is out of range")
 * 	}
 * 	gen.addMapping(generatedLine, generatedCharacter, sourceIndex, sourceLine, sourceCharacter, nameIndex)
 * 	return nil
 * }
 */
export function Generator_AddNamedSourceMapping(receiver: GoPtr<Generator>, generatedLine: int, generatedCharacter: UTF16Offset, sourceIndex: SourceIndex, sourceLine: int, sourceCharacter: UTF16Offset, nameIndex: NameIndex): GoError {
  const gen: Generator = receiver!;
  if (generatedLine < gen.pendingGeneratedLine) {
    return errorsNew("generatedLine cannot backtrack");
  }
  if (generatedCharacter < 0) {
    return errorsNew("generatedCharacter cannot be negative");
  }
  if (sourceIndex < 0 || sourceIndex >= gen.sources.length) {
    return errorsNew("sourceIndex is out of range");
  }
  if (sourceLine < 0) {
    return errorsNew("sourceLine cannot be negative");
  }
  if (sourceCharacter < 0) {
    return errorsNew("sourceCharacter cannot be negative");
  }
  if (nameIndex < 0 || nameIndex >= gen.names.length) {
    return errorsNew("nameIndex is out of range");
  }
  Generator_addMapping(gen, generatedLine, generatedCharacter, sourceIndex, sourceLine, sourceCharacter, nameIndex);
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.RawSourceMap","kind":"method","status":"implemented","sigHash":"11347078b73a243c6b9d683e3a4b3f662e6bf0dc9acd1e5a89179f3889b21400","bodyHash":"dd8ca3afb9ac06964ff8d7964bda4838282ac2c6737dee02781753a98106b0f6"}
 *
 * Go source:
 * func (gen *Generator) RawSourceMap() *RawSourceMap {
 * 	gen.commitPendingMapping()
 * 	sources := slices.Clone(gen.sources)
 * 	if sources == nil {
 * 		sources = []string{}
 * 	}
 * 	names := slices.Clone(gen.names)
 * 	if names == nil {
 * 		names = []string{}
 * 	}
 * 	return &RawSourceMap{
 * 		Version:        3,
 * 		File:           gen.file,
 * 		SourceRoot:     gen.sourceRoot,
 * 		Sources:        sources,
 * 		Names:          names,
 * 		Mappings:       gen.mappings.String(),
 * 		SourcesContent: slices.Clone(gen.sourcesContent),
 * 	}
 * }
 */
export function Generator_RawSourceMap(receiver: GoPtr<Generator>): GoPtr<RawSourceMap> {
  const gen: Generator = receiver!;
  Generator_commitPendingMapping(gen);
  let sources: GoSlice<string> | undefined = slicesClone(gen.sources);
  if (sources === undefined) {
    sources = [];
  }
  let names: GoSlice<string> | undefined = slicesClone(gen.names);
  if (names === undefined) {
    names = [];
  }
  return {
    [JsonFieldNames]: rawSourceMapJsonFieldNames,
    Version: 3,
    File: gen.file,
    SourceRoot: gen.sourceRoot,
    Sources: sources,
    Names: names,
    Mappings: gen.mappings.String(),
    SourcesContent: slicesClone(gen.sourcesContent),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.bytes","kind":"method","status":"implemented","sigHash":"8f1964c38d60f1e45d9153a5985a8e3f73d4904e386848860e896c49fb9ea1e7","bodyHash":"7863a9524e57ee3a0e211647e44d618756f5e07cf346e6fa27794012907223b1"}
 *
 * Go source:
 * func (gen *Generator) bytes() []byte {
 * 	buf, err := json.Marshal(gen.RawSourceMap())
 * 	if err != nil {
 * 		panic(err.Error())
 * 	}
 * 	return buf
 * }
 */
export function Generator_bytes(receiver: GoPtr<Generator>): GoSlice<byte> {
  const gen: Generator = receiver!;
  const [buf, err] = jsonMarshal(Generator_RawSourceMap(gen));
  if (err !== undefined) {
    throw new globalThis.Error(err.message);
  }
  return buf;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.String","kind":"method","status":"implemented","sigHash":"7890530d80f1a26633f9c5e35916b4e21cd2703f10ea8d65e2331f79af290a9b","bodyHash":"8dea4de8bc06335d7ef60e041038b26341b5090a828bd8c15f9665b36e90803a"}
 *
 * Go source:
 * func (gen *Generator) String() string {
 * 	return string(gen.bytes())
 * }
 */
export function Generator_String(receiver: GoPtr<Generator>): string {
  const gen: Generator = receiver!;
  return bytesToString(Generator_bytes(gen));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::method::Generator.Base64DataURL","kind":"method","status":"implemented","sigHash":"171fd81356d7a0ef504898a5828516a31b685252f7c0bc4bc151b98569f953bc","bodyHash":"f089cbed2cc3d1b40b436e644adec3e7118e7d07a21ec58052282e339712f778"}
 *
 * Go source:
 * func (gen *Generator) Base64DataURL() string {
 * 	const prefix = "data:application/json;base64,"
 * 	data := gen.bytes()
 * 	var sb strings.Builder
 * 	sb.Grow(len(prefix) + base64.StdEncoding.EncodedLen(len(data)))
 * 	sb.WriteString(prefix)
 * 	encoder := base64.NewEncoder(base64.StdEncoding, &sb)
 * 	_, _ = encoder.Write(data)
 * 	encoder.Close()
 * 	return sb.String()
 * }
 */
export function Generator_Base64DataURL(receiver: GoPtr<Generator>): string {
  const gen: Generator = receiver!;
  const prefix: string = "data:application/json;base64,";
  const data: GoSlice<byte> = Generator_bytes(gen);
  const sb: Builder = new Builder();
  sb.Grow(prefix.length + base64StdEncoding.EncodedLen(data.length));
  sb.WriteString(prefix);
  const encoder: WriteCloser = base64NewEncoder(base64StdEncoding, sb);
  encoder.Write(data);
  encoder.Close();
  return sb.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/generator.go::func::base64FormatEncode","kind":"func","status":"implemented","sigHash":"a719977eff51f1fcab2017a6efd63cb684145ec8887b436692bc5784403d386a","bodyHash":"09db4dd67f12f8e60ffe8c7e9f5eed187467602e1103b02e71ef212899e4903b"}
 *
 * Go source:
 * func base64FormatEncode(value int) rune {
 * 	switch {
 * 	case value >= 0 && value < 26:
 * 		return 'A' + rune(value)
 * 	case value >= 26 && value < 52:
 * 		return 'a' + rune(value) - 26
 * 	case value >= 52 && value < 62:
 * 		return '0' + rune(value) - 52
 * 	case value == 62:
 * 		return '+'
 * 	case value == 63:
 * 		return '/'
 * 	default:
 * 		panic("not a base64 value")
 * 	}
 * }
 */
export function base64FormatEncode(value: int): GoRune {
  if (value >= 0 && value < 26) {
    return 0x41 /* 'A' */ + value;
  } else if (value >= 26 && value < 52) {
    return 0x61 /* 'a' */ + value - 26;
  } else if (value >= 52 && value < 62) {
    return 0x30 /* '0' */ + value - 52;
  } else if (value === 62) {
    return 0x2b /* '+' */;
  } else if (value === 63) {
    return 0x2f /* '/' */;
  } else {
    throw new globalThis.Error("not a base64 value");
  }
}
