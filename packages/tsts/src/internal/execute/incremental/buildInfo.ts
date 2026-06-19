import type { bool, byte, int } from "../../../go/scalars.js";
import type { GoError, GoMap, GoPtr, GoSeq, GoSeq2, GoSlice } from "../../../go/compat.js";
import { Errorf } from "../../../go/fmt.js";
import type { RepopulateDiagnosticKind } from "../../ast/diagnostic.js";
import {
  NewOrderedMapWithSizeHint,
  OrderedMap_Entries,
  OrderedMap_Get,
  OrderedMap_Keys,
  OrderedMap_Set,
} from "../../collections/ordered_map.js";
import type { OrderedMap } from "../../collections/ordered_map.js";
import { SyncMap_Load } from "../../collections/syncmap.js";
import type { SyncMap } from "../../collections/syncmap.js";
import { CompilerOptions_GetEmitDeclarations, ResolutionModeCommonJS } from "../../core/compileroptions.js";
import type { CompilerOptions, ResolutionMode } from "../../core/compileroptions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { IfElse } from "../../core/core.js";
import { Version } from "../../core/version.js";
import type { Category, Key } from "../../diagnostics/diagnostics.js";
import * as json from "../../json/json.js";
import { ParsedCommandLine_CompilerOptions } from "../../tsoptions/parsedcommandline.js";
import {
  ConvertOptionToAbsolutePath,
  ParseCompilerOptions,
} from "../../tsoptions/parsinghelpers.js";
import { CommandLineCompilerOptionsMap } from "../../tsoptions/tsconfigparsing.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { ToPath } from "../../tspath/path.js";
import type { ComparePathsOptions, Path } from "../../tspath/path.js";
import {
  FileEmitKindDts,
  FileEmitKindDtsErrors,
  getPendingEmitKindWithOptions,
} from "./snapshot.js";
import type { emitSignature, FileEmitKind, FileInfo } from "./snapshot.js";

// Go's []byte(string) conversion: the UTF-8 encoding of the string.
const utf8Encoder = new globalThis.TextEncoder();
const stringToBytes = (s: string): GoSlice<byte> => globalThis.Array.from(utf8Encoder.encode(s)) as GoSlice<byte>;

// Go's string([]byte) conversion: decode the byte slice as UTF-8.
const utf8Decoder = new globalThis.TextDecoder();
const bytesToString = (b: GoSlice<byte>): string => utf8Decoder.decode(globalThis.Uint8Array.from(b as number[]));

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoFileId","kind":"type","status":"implemented","sigHash":"43b939ce2e739f9570670812570b77390410c8392b6a9eea22564ef8663e9375","bodyHash":"0d9d45eed8c1fdbb0f6dab17363f4fa25eeb917e9ffd0f31fb91c7d00280adb6"}
 *
 * Go source:
 * BuildInfoFileId       int
 */
export type BuildInfoFileId = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoFileIdListId","kind":"type","status":"implemented","sigHash":"4ce98801bb49ddb565f8ab3e04790023a0fd3d2534116f9567610bbaba6418d1","bodyHash":"e6c30c0cca5b10544a5c4b07e5c1c456a7222fa6acb6fb3cc9fe7009a481a061"}
 *
 * Go source:
 * BuildInfoFileIdListId int
 */
export type BuildInfoFileIdListId = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoRoot","kind":"type","status":"implemented","sigHash":"c2c65d3d6f2fc73a23f8ef10f5ef2baff5151d28d203f9339c56f9e77f7874b3","bodyHash":"03191216ca576e48fe51018b028d6152c69747d5c9f730ba8dafb486a86a10e5"}
 *
 * Go source:
 * BuildInfoRoot struct {
 * 	Start          BuildInfoFileId
 * 	End            BuildInfoFileId
 * 	NonIncremental string // Root of a non incremental program
 * }
 */
export interface BuildInfoRoot {
  Start: BuildInfoFileId;
  End: BuildInfoFileId;
  NonIncremental: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoRoot.MarshalJSON","kind":"method","status":"implemented","sigHash":"a8b016fada2f1bed22d1a618d01cf9f19773ce841c77e10889c4a497c8bd2e66","bodyHash":"cd61bfb79eb30c4715cbdbe9459bc29a68938b83f722f02afad482ff3a311417"}
 *
 * Go source:
 * func (b *BuildInfoRoot) MarshalJSON() ([]byte, error) {
 * 	if b.Start != 0 {
 * 		if b.End != 0 {
 * 			return json.Marshal([2]BuildInfoFileId{b.Start, b.End})
 * 		} else {
 * 			return json.Marshal(b.Start)
 * 		}
 * 	} else {
 * 		return json.Marshal(b.NonIncremental)
 * 	}
 * }
 */
export function BuildInfoRoot_MarshalJSON(receiver: GoPtr<BuildInfoRoot>): [GoSlice<byte>, GoError] {
  if (receiver!.Start !== 0) {
    if (receiver!.End !== 0) {
      return [stringToBytes(globalThis.JSON.stringify([receiver!.Start, receiver!.End])), undefined];
    } else {
      return [stringToBytes(globalThis.JSON.stringify(receiver!.Start)), undefined];
    }
  } else {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.NonIncremental)), undefined];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoRoot.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"ad738d4c531b37786cc45f51845da5b1cf123c08fa6b333225f4524def473be0","bodyHash":"c0cbb74497a0861003311c10e5cfc14cb0c6d6ba6c71bd8ed35e134a44133e67"}
 *
 * Go source:
 * func (b *BuildInfoRoot) UnmarshalJSON(data []byte) error {
 * 	var startAndEnd *[2]int
 * 	if err := json.Unmarshal(data, &startAndEnd); err != nil {
 * 		var start int
 * 		if err := json.Unmarshal(data, &start); err != nil {
 * 			var name string
 * 			if err := json.Unmarshal(data, &name); err != nil {
 * 				return fmt.Errorf("invalid BuildInfoRoot: %s", data)
 * 			}
 * 			*b = BuildInfoRoot{
 * 				NonIncremental: name,
 * 			}
 * 			return nil
 * 		}
 * 		*b = BuildInfoRoot{
 * 			Start: BuildInfoFileId(start),
 * 		}
 * 		return nil
 * 	}
 * 	*b = BuildInfoRoot{
 * 		Start: BuildInfoFileId(startAndEnd[0]),
 * 		End:   BuildInfoFileId(startAndEnd[1]),
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoRoot_UnmarshalJSON(receiver: GoPtr<BuildInfoRoot>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoRoot: %s", str);
  }
  if (globalThis.Array.isArray(parsed) && (parsed as unknown[]).length === 2) {
    const arr = parsed as number[];
    receiver!.Start = arr[0] as BuildInfoFileId;
    receiver!.End = arr[1] as BuildInfoFileId;
    receiver!.NonIncremental = "";
    return undefined;
  }
  if (typeof parsed === "number") {
    receiver!.Start = parsed as BuildInfoFileId;
    receiver!.End = 0 as BuildInfoFileId;
    receiver!.NonIncremental = "";
    return undefined;
  }
  if (typeof parsed === "string") {
    receiver!.Start = 0 as BuildInfoFileId;
    receiver!.End = 0 as BuildInfoFileId;
    receiver!.NonIncremental = parsed;
    return undefined;
  }
  return Errorf("invalid BuildInfoRoot: %s", str);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::buildInfoFileInfoNoSignature","kind":"type","status":"implemented","sigHash":"bdc75f2ed5f6a8da118fc7e553b5e3e58a54c88d9d58803fc98db2ea0faddab1","bodyHash":"0272a4885a788040d915270906e44a0f85250228eaefd217ae513314bacffb0f"}
 *
 * Go source:
 * buildInfoFileInfoNoSignature struct {
 * 	Version            string              `json:"version,omitzero"`
 * 	NoSignature        bool                `json:"noSignature,omitzero"`
 * 	AffectsGlobalScope bool                `json:"affectsGlobalScope,omitzero"`
 * 	ImpliedNodeFormat  core.ResolutionMode `json:"impliedNodeFormat,omitzero"`
 * }
 */
export interface buildInfoFileInfoNoSignature {
  Version: string;
  NoSignature: bool;
  AffectsGlobalScope: bool;
  ImpliedNodeFormat: ResolutionMode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::buildInfoFileInfoWithSignature","kind":"type","status":"implemented","sigHash":"dd7c16998a3247d7fefc58c82f938d9c154c1a0d61e17732a1bb8a5f6520002b","bodyHash":"896bc369792213e1afab4659e51bb107dee9f308c57de1a2447a8d7422c1da41"}
 *
 * Go source:
 * buildInfoFileInfoWithSignature struct {
 * 	Version            string              `json:"version,omitzero"`
 * 	Signature          string              `json:"signature,omitzero"`
 * 	AffectsGlobalScope bool                `json:"affectsGlobalScope,omitzero"`
 * 	ImpliedNodeFormat  core.ResolutionMode `json:"impliedNodeFormat,omitzero"`
 * }
 */
export interface buildInfoFileInfoWithSignature {
  Version: string;
  Signature: string;
  AffectsGlobalScope: bool;
  ImpliedNodeFormat: ResolutionMode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoFileInfo","kind":"type","status":"implemented","sigHash":"a2ca7deb9e69021b0c381f518f57ce8b4a24d18bbae771489f3ae577b61acee5","bodyHash":"b22ec3bb4237fbcf7e2f9c8363946bbb608d37339134b273a759aeee7ab5520d"}
 *
 * Go source:
 * BuildInfoFileInfo struct {
 * 	signature   string
 * 	noSignature *buildInfoFileInfoNoSignature
 * 	fileInfo    *buildInfoFileInfoWithSignature
 * }
 */
export interface BuildInfoFileInfo {
  signature: string;
  noSignature: GoPtr<buildInfoFileInfoNoSignature>;
  fileInfo: GoPtr<buildInfoFileInfoWithSignature>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::func::newBuildInfoFileInfo","kind":"func","status":"implemented","sigHash":"8da464a0a5fe97a08d70a74859abac3355b7ded8430dda237d2ef6a9022c1c92","bodyHash":"e2b32f1c2da06d7b53aa53c28996e16789c704a099d7bb49ce63300023d77c5b"}
 *
 * Go source:
 * func newBuildInfoFileInfo(fileInfo *FileInfo) *BuildInfoFileInfo {
 * 	if fileInfo.version == fileInfo.signature {
 * 		if !fileInfo.affectsGlobalScope && fileInfo.impliedNodeFormat == core.ResolutionModeCommonJS {
 * 			return &BuildInfoFileInfo{signature: fileInfo.signature}
 * 		}
 * 	} else if fileInfo.signature == "" {
 * 		return &BuildInfoFileInfo{noSignature: &buildInfoFileInfoNoSignature{
 * 			Version:            fileInfo.version,
 * 			NoSignature:        true,
 * 			AffectsGlobalScope: fileInfo.affectsGlobalScope,
 * 			ImpliedNodeFormat:  fileInfo.impliedNodeFormat,
 * 		}}
 * 	}
 * 	return &BuildInfoFileInfo{fileInfo: &buildInfoFileInfoWithSignature{
 * 		Version:            fileInfo.version,
 * 		Signature:          core.IfElse(fileInfo.signature == fileInfo.version, "", fileInfo.signature),
 * 		AffectsGlobalScope: fileInfo.affectsGlobalScope,
 * 		ImpliedNodeFormat:  fileInfo.impliedNodeFormat,
 * 	}}
 * }
 */
export function newBuildInfoFileInfo(fileInfo: GoPtr<FileInfo>): GoPtr<BuildInfoFileInfo> {
  if (fileInfo!.version === fileInfo!.signature) {
    if (!fileInfo!.affectsGlobalScope && fileInfo!.impliedNodeFormat === ResolutionModeCommonJS) {
      return { signature: fileInfo!.signature, noSignature: undefined, fileInfo: undefined };
    }
  } else if (fileInfo!.signature === "") {
    return {
      signature: "",
      noSignature: {
        Version: fileInfo!.version,
        NoSignature: true,
        AffectsGlobalScope: fileInfo!.affectsGlobalScope,
        ImpliedNodeFormat: fileInfo!.impliedNodeFormat,
      },
      fileInfo: undefined,
    };
  }
  return {
    signature: "",
    noSignature: undefined,
    fileInfo: {
      Version: fileInfo!.version,
      Signature: IfElse(fileInfo!.signature === fileInfo!.version, "", fileInfo!.signature),
      AffectsGlobalScope: fileInfo!.affectsGlobalScope,
      ImpliedNodeFormat: fileInfo!.impliedNodeFormat,
    },
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFileInfo.GetFileInfo","kind":"method","status":"implemented","sigHash":"23b95b7f5a6a4384ee006a6a6ab550fdfd9741c5902087f92156b641c033d292","bodyHash":"cafde2f474aa9e60ed852497af8f5ceae7861b55b79d5b7ed07837e42b4a2256"}
 *
 * Go source:
 * func (b *BuildInfoFileInfo) GetFileInfo() *FileInfo {
 * 	if b == nil {
 * 		return nil
 * 	}
 * 	if b.signature != "" {
 * 		return &FileInfo{
 * 			version:           b.signature,
 * 			signature:         b.signature,
 * 			impliedNodeFormat: core.ResolutionModeCommonJS,
 * 		}
 * 	}
 * 	if b.noSignature != nil {
 * 		return &FileInfo{
 * 			version:            b.noSignature.Version,
 * 			affectsGlobalScope: b.noSignature.AffectsGlobalScope,
 * 			impliedNodeFormat:  b.noSignature.ImpliedNodeFormat,
 * 		}
 * 	}
 * 	return &FileInfo{
 * 		version:            b.fileInfo.Version,
 * 		signature:          core.IfElse(b.fileInfo.Signature == "", b.fileInfo.Version, b.fileInfo.Signature),
 * 		affectsGlobalScope: b.fileInfo.AffectsGlobalScope,
 * 		impliedNodeFormat:  b.fileInfo.ImpliedNodeFormat,
 * 	}
 * }
 */
export function BuildInfoFileInfo_GetFileInfo(receiver: GoPtr<BuildInfoFileInfo>): GoPtr<FileInfo> {
  if (receiver === undefined) {
    return undefined;
  }
  if (receiver.signature !== "") {
    return {
      version: receiver.signature,
      signature: receiver.signature,
      affectsGlobalScope: false,
      impliedNodeFormat: ResolutionModeCommonJS,
    };
  }
  if (receiver.noSignature !== undefined) {
    return {
      version: receiver.noSignature.Version,
      signature: "",
      affectsGlobalScope: receiver.noSignature.AffectsGlobalScope,
      impliedNodeFormat: receiver.noSignature.ImpliedNodeFormat,
    };
  }
  return {
    version: receiver.fileInfo!.Version,
    signature: IfElse(receiver.fileInfo!.Signature === "", receiver.fileInfo!.Version, receiver.fileInfo!.Signature),
    affectsGlobalScope: receiver.fileInfo!.AffectsGlobalScope,
    impliedNodeFormat: receiver.fileInfo!.ImpliedNodeFormat,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFileInfo.HasSignature","kind":"method","status":"implemented","sigHash":"7d2cd3ecf1137e088daedf9326a1afd1a48e8bc722233e614a8ba5d2d2fae7f6","bodyHash":"b26d71ef36036ee70d2ed688cb7b4d8fc736945e7840c2948ab3293741f9ee13"}
 *
 * Go source:
 * func (b *BuildInfoFileInfo) HasSignature() bool {
 * 	return b.signature != ""
 * }
 */
export function BuildInfoFileInfo_HasSignature(receiver: GoPtr<BuildInfoFileInfo>): bool {
  return receiver!.signature !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFileInfo.MarshalJSON","kind":"method","status":"implemented","sigHash":"aeb478e5b67faa3430424680fe99148dd768283e956493ece378aa2b1c58430b","bodyHash":"097bcb96ca3c87562cc7972e9ed262a91c82add03d2b0baae4837b289cf77a72"}
 *
 * Go source:
 * func (b *BuildInfoFileInfo) MarshalJSON() ([]byte, error) {
 * 	if b.signature != "" {
 * 		return json.Marshal(b.signature)
 * 	}
 * 	if b.noSignature != nil {
 * 		return json.Marshal(b.noSignature)
 * 	}
 * 	return json.Marshal(b.fileInfo)
 * }
 */
export function BuildInfoFileInfo_MarshalJSON(receiver: GoPtr<BuildInfoFileInfo>): [GoSlice<byte>, GoError] {
  if (receiver!.signature !== "") {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.signature)), undefined];
  }
  if (receiver!.noSignature !== undefined) {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.noSignature)), undefined];
  }
  return [stringToBytes(globalThis.JSON.stringify(receiver!.fileInfo)), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFileInfo.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"ab7a78e74d95fc7d6afd7959f5a4a937ed1f9c31de75073ab6528aced213e81b","bodyHash":"c87f41d6c8c515cf96b5f43f371667328d68f8aa6bac236a86560c845f5a8d20"}
 *
 * Go source:
 * func (b *BuildInfoFileInfo) UnmarshalJSON(data []byte) error {
 * 	var vSignature string
 * 	if err := json.Unmarshal(data, &vSignature); err != nil {
 * 		var noSignature buildInfoFileInfoNoSignature
 * 		if err := json.Unmarshal(data, &noSignature); err != nil || !noSignature.NoSignature {
 * 			var fileInfo buildInfoFileInfoWithSignature
 * 			if err := json.Unmarshal(data, &fileInfo); err != nil {
 * 				return fmt.Errorf("invalid BuildInfoFileInfo: %s", data)
 * 			}
 * 			*b = BuildInfoFileInfo{fileInfo: &fileInfo}
 * 			return nil
 * 		}
 * 		*b = BuildInfoFileInfo{noSignature: &noSignature}
 * 		return nil
 * 	}
 * 	*b = BuildInfoFileInfo{signature: vSignature}
 * 	return nil
 * }
 */
export function BuildInfoFileInfo_UnmarshalJSON(receiver: GoPtr<BuildInfoFileInfo>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoFileInfo: %s", str);
  }
  if (typeof parsed === "string") {
    receiver!.signature = parsed;
    receiver!.noSignature = undefined;
    receiver!.fileInfo = undefined;
    return undefined;
  }
  if (parsed !== null && typeof parsed === "object" && (parsed as Record<string, unknown>)["noSignature"] === true) {
    const obj = parsed as Record<string, unknown>;
    receiver!.signature = "";
    receiver!.noSignature = {
      Version: (obj["version"] as string) ?? "",
      NoSignature: true,
      AffectsGlobalScope: (obj["affectsGlobalScope"] as bool) ?? false,
      ImpliedNodeFormat: (obj["impliedNodeFormat"] as ResolutionMode) ?? 0,
    };
    receiver!.fileInfo = undefined;
    return undefined;
  }
  if (parsed !== null && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    receiver!.signature = "";
    receiver!.noSignature = undefined;
    receiver!.fileInfo = {
      Version: (obj["version"] as string) ?? "",
      Signature: (obj["signature"] as string) ?? "",
      AffectsGlobalScope: (obj["affectsGlobalScope"] as bool) ?? false,
      ImpliedNodeFormat: (obj["impliedNodeFormat"] as ResolutionMode) ?? 0,
    };
    return undefined;
  }
  return Errorf("invalid BuildInfoFileInfo: %s", str);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoReferenceMapEntry","kind":"type","status":"implemented","sigHash":"138b9440bcf3230afead2fcdd1ee91ffab9c5e31ba5b31f1c5714da8250a1c1e","bodyHash":"a6d8307dde4d3c397c25247849403a7c6090486a5903a84e6cb2567d97f622c5"}
 *
 * Go source:
 * BuildInfoReferenceMapEntry struct {
 * 	FileId       BuildInfoFileId
 * 	FileIdListId BuildInfoFileIdListId
 * }
 */
export interface BuildInfoReferenceMapEntry {
  FileId: BuildInfoFileId;
  FileIdListId: BuildInfoFileIdListId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoReferenceMapEntry.MarshalJSON","kind":"method","status":"implemented","sigHash":"2e73e2a3b3ddd2245b8d81416cf51a5321cda51244682f80a7abc0e4c3581529","bodyHash":"baba5c9adae5a5a02cfb09bd5b488c2f3c1c3792ec9b23640e99ee5658b15077"}
 *
 * Go source:
 * func (b *BuildInfoReferenceMapEntry) MarshalJSON() ([]byte, error) {
 * 	return json.Marshal([2]int{int(b.FileId), int(b.FileIdListId)})
 * }
 */
export function BuildInfoReferenceMapEntry_MarshalJSON(receiver: GoPtr<BuildInfoReferenceMapEntry>): [GoSlice<byte>, GoError] {
  return [stringToBytes(globalThis.JSON.stringify([receiver!.FileId, receiver!.FileIdListId])), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoReferenceMapEntry.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"73d0bd80f50d7dea0ba808a0ed40fd11f4a7eb100de08f2b197c315016b4f855","bodyHash":"1449181ec1901e840c9ee0a72a4e942c1e2ad7edeeefbbe69047055d6e634f30"}
 *
 * Go source:
 * func (b *BuildInfoReferenceMapEntry) UnmarshalJSON(data []byte) error {
 * 	var v *[2]int
 * 	if err := json.Unmarshal(data, &v); err != nil {
 * 		return err
 * 	}
 * 	*b = BuildInfoReferenceMapEntry{
 * 		FileId:       BuildInfoFileId(v[0]),
 * 		FileIdListId: BuildInfoFileIdListId(v[1]),
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoReferenceMapEntry_UnmarshalJSON(receiver: GoPtr<BuildInfoReferenceMapEntry>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoReferenceMapEntry: %s", str);
  }
  if (!globalThis.Array.isArray(parsed) || (parsed as unknown[]).length !== 2) {
    return Errorf("invalid BuildInfoReferenceMapEntry: %s", str);
  }
  const arr = parsed as number[];
  receiver!.FileId = arr[0] as BuildInfoFileId;
  receiver!.FileIdListId = arr[1] as BuildInfoFileIdListId;
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoDiagnostic","kind":"type","status":"implemented","sigHash":"f9d75c486731a00418a54c10b6452ad50d9114e06e72ec0ea66649ee02d7d8de","bodyHash":"e1120ef01a8bf630483c18ec5cace365e2121a4ca3f5c993573cbe859b7a1562"}
 *
 * Go source:
 * BuildInfoDiagnostic struct {
 * 	// BuildInfoFileId if it is for a File thats other than its stored for
 * 	File               BuildInfoFileId          `json:"file,omitzero"`
 * 	NoFile             bool                     `json:"noFile,omitzero"`
 * 	Pos                int                      `json:"pos,omitzero"`
 * 	End                int                      `json:"end,omitzero"`
 * 	Code               int32                    `json:"code,omitzero"`
 * 	Category           diagnostics.Category     `json:"category,omitzero"`
 * 	MessageKey         diagnostics.Key          `json:"messageKey,omitzero"`
 * 	MessageArgs        []string                 `json:"messageArgs,omitzero"`
 * 	MessageChain       []*BuildInfoDiagnostic   `json:"messageChain,omitzero"`
 * 	RelatedInformation []*BuildInfoDiagnostic   `json:"relatedInformation,omitzero"`
 * 	ReportsUnnecessary bool                     `json:"reportsUnnecessary,omitzero"`
 * 	ReportsDeprecated  bool                     `json:"reportsDeprecated,omitzero"`
 * 	SkippedOnNoEmit    bool                     `json:"skippedOnNoEmit,omitzero"`
 * 	RepopulateInfo     *BuildInfoRepopulateInfo `json:"repopulateInfo,omitzero"`
 * }
 */
export interface BuildInfoDiagnostic {
  File: BuildInfoFileId;
  NoFile: bool;
  Pos: int;
  End: int;
  Code: int;
  Category: Category;
  MessageKey: Key;
  MessageArgs: GoSlice<string>;
  MessageChain: GoSlice<GoPtr<BuildInfoDiagnostic>>;
  RelatedInformation: GoSlice<GoPtr<BuildInfoDiagnostic>>;
  ReportsUnnecessary: bool;
  ReportsDeprecated: bool;
  SkippedOnNoEmit: bool;
  RepopulateInfo: GoPtr<BuildInfoRepopulateInfo>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoRepopulateInfo","kind":"type","status":"implemented","sigHash":"4b69c4ef4d7b11ea29cdff11e30aa97c2599ae873012e60c9a121b929e56d870","bodyHash":"e44a59fcc5ba121161bddc29652fb3acfe61b3dbf0c4388dd59c7ad65f6926a6"}
 *
 * Go source:
 * BuildInfoRepopulateInfo struct {
 * 	Kind            ast.RepopulateDiagnosticKind `json:"kind"`
 * 	ModuleReference string                       `json:"moduleReference,omitzero"`
 * 	Mode            core.ResolutionMode          `json:"mode,omitzero"`
 * 	PackageName     string                       `json:"packageName,omitzero"`
 * }
 */
export interface BuildInfoRepopulateInfo {
  Kind: RepopulateDiagnosticKind;
  ModuleReference: string;
  Mode: ResolutionMode;
  PackageName: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoDiagnosticsOfFile","kind":"type","status":"implemented","sigHash":"a764df163f6be6639e204e09c2e624f2575dceb7ce56124e331a5400ff68c179","bodyHash":"0a7019fd6356082fe666db8dd9935f542f573e3b52187064aeae4f556c831432"}
 *
 * Go source:
 * BuildInfoDiagnosticsOfFile struct {
 * 	FileId      BuildInfoFileId
 * 	Diagnostics []*BuildInfoDiagnostic
 * }
 */
export interface BuildInfoDiagnosticsOfFile {
  FileId: BuildInfoFileId;
  Diagnostics: GoSlice<GoPtr<BuildInfoDiagnostic>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoDiagnosticsOfFile.MarshalJSON","kind":"method","status":"implemented","sigHash":"838d49b6124ab924c22d5014ff2267b65bb544b551ffe9831e4400af7f811e4e","bodyHash":"5f8c58f1e334a9959cb7d8cea860b52ac4510664c677da9d649c3f55b99e4b1c"}
 *
 * Go source:
 * func (b *BuildInfoDiagnosticsOfFile) MarshalJSON() ([]byte, error) {
 * 	fileIdAndDiagnostics := make([]any, 0, 2)
 * 	fileIdAndDiagnostics = append(fileIdAndDiagnostics, b.FileId)
 * 	fileIdAndDiagnostics = append(fileIdAndDiagnostics, b.Diagnostics)
 * 	return json.Marshal(fileIdAndDiagnostics)
 * }
 */
export function BuildInfoDiagnosticsOfFile_MarshalJSON(receiver: GoPtr<BuildInfoDiagnosticsOfFile>): [GoSlice<byte>, GoError] {
  return [stringToBytes(globalThis.JSON.stringify([receiver!.FileId, receiver!.Diagnostics])), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoDiagnosticsOfFile.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"38f0c415ef8423bfbf174b3d4c1532008c931a2ef53ff8063422ec969bf19cf6","bodyHash":"9eafa802ad1ce539d4b0df2936ca9a494cd3859dcbf826e513876f754c61bac0"}
 *
 * Go source:
 * func (b *BuildInfoDiagnosticsOfFile) UnmarshalJSON(data []byte) error {
 * 	var fileIdAndDiagnostics []json.Value
 * 	if err := json.Unmarshal(data, &fileIdAndDiagnostics); err != nil {
 * 		return fmt.Errorf("invalid BuildInfoDiagnosticsOfFile: %s", data)
 * 	}
 * 	if len(fileIdAndDiagnostics) != 2 {
 * 		return fmt.Errorf("invalid BuildInfoDiagnosticsOfFile: expected 2 elements, got %d", len(fileIdAndDiagnostics))
 * 	}
 * 	var fileId BuildInfoFileId
 * 	if err := json.Unmarshal(fileIdAndDiagnostics[0], &fileId); err != nil {
 * 		return fmt.Errorf("invalid fileId in BuildInfoDiagnosticsOfFile: %w", err)
 * 	}
 *
 * 	var diagnostics []*BuildInfoDiagnostic
 * 	if err := json.Unmarshal(fileIdAndDiagnostics[1], &diagnostics); err != nil {
 * 		return fmt.Errorf("invalid diagnostics in BuildInfoDiagnosticsOfFile: %w", err)
 * 	}
 * 	*b = BuildInfoDiagnosticsOfFile{
 * 		FileId:      fileId,
 * 		Diagnostics: diagnostics,
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoDiagnosticsOfFile_UnmarshalJSON(receiver: GoPtr<BuildInfoDiagnosticsOfFile>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoDiagnosticsOfFile: %s", str);
  }
  if (!globalThis.Array.isArray(parsed)) {
    return Errorf("invalid BuildInfoDiagnosticsOfFile: %s", str);
  }
  const arr = parsed as unknown[];
  if (arr.length !== 2) {
    return Errorf("invalid BuildInfoDiagnosticsOfFile: expected 2 elements, got %d", arr.length);
  }
  if (typeof arr[0] !== "number") {
    return Errorf("invalid fileId in BuildInfoDiagnosticsOfFile: %s", str);
  }
  receiver!.FileId = arr[0] as BuildInfoFileId;
  receiver!.Diagnostics = (arr[1] as GoSlice<GoPtr<BuildInfoDiagnostic>>) ?? [];
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoSemanticDiagnostic","kind":"type","status":"implemented","sigHash":"647298c9c32af58dbcbff6c100db6ce2814624f9108494a99b099764f23e544d","bodyHash":"67adce572163ff90e2af3bbfff14bfe0e25953d8f16367dec672ce8404492b96"}
 *
 * Go source:
 * BuildInfoSemanticDiagnostic struct {
 * 	FileId      BuildInfoFileId             // File is not in changedSet and still doesnt have cached diagnostics
 * 	Diagnostics *BuildInfoDiagnosticsOfFile // Diagnostics for file
 * }
 */
export interface BuildInfoSemanticDiagnostic {
  FileId: BuildInfoFileId;
  Diagnostics: GoPtr<BuildInfoDiagnosticsOfFile>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoSemanticDiagnostic.MarshalJSON","kind":"method","status":"implemented","sigHash":"0b6d3a287d7ddfa8943ffdd44bc7bc23fd4ebfdf0fab2987a082281d8fd43525","bodyHash":"16f3c0827a170f1fcf692729b35aecf263e67808e53c5c1c1f35f5316ff476c8"}
 *
 * Go source:
 * func (b *BuildInfoSemanticDiagnostic) MarshalJSON() ([]byte, error) {
 * 	if b.FileId != 0 {
 * 		return json.Marshal(b.FileId)
 * 	}
 * 	return json.Marshal(b.Diagnostics)
 * }
 */
export function BuildInfoSemanticDiagnostic_MarshalJSON(receiver: GoPtr<BuildInfoSemanticDiagnostic>): [GoSlice<byte>, GoError] {
  if (receiver!.FileId !== 0) {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.FileId)), undefined];
  }
  return [stringToBytes(globalThis.JSON.stringify(receiver!.Diagnostics)), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoSemanticDiagnostic.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"6e59520c23a89f087429a7acbc7a7478f2235f9c53725cb7493e41f8c03661ea","bodyHash":"f47eef106319ec566914e2437d0c67cf7b9bb38cdcf32159743e5a7c3c71900f"}
 *
 * Go source:
 * func (b *BuildInfoSemanticDiagnostic) UnmarshalJSON(data []byte) error {
 * 	var fileId BuildInfoFileId
 * 	if err := json.Unmarshal(data, &fileId); err != nil {
 * 		var diagnostics BuildInfoDiagnosticsOfFile
 * 		if err := json.Unmarshal(data, &diagnostics); err != nil {
 * 			return fmt.Errorf("invalid BuildInfoSemanticDiagnostic: %s", data)
 * 		}
 * 		*b = BuildInfoSemanticDiagnostic{
 * 			Diagnostics: &diagnostics,
 * 		}
 * 		return nil
 * 	}
 * 	*b = BuildInfoSemanticDiagnostic{
 * 		FileId: fileId,
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoSemanticDiagnostic_UnmarshalJSON(receiver: GoPtr<BuildInfoSemanticDiagnostic>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoSemanticDiagnostic: %s", str);
  }
  if (typeof parsed === "number") {
    receiver!.FileId = parsed as BuildInfoFileId;
    receiver!.Diagnostics = undefined;
    return undefined;
  }
  // Try to parse as BuildInfoDiagnosticsOfFile (an array [fileId, diagnostics[]])
  if (globalThis.Array.isArray(parsed)) {
    const arr = parsed as unknown[];
    const diagnostics: BuildInfoDiagnosticsOfFile = {
      FileId: 0 as BuildInfoFileId,
      Diagnostics: [],
    };
    const err = BuildInfoDiagnosticsOfFile_UnmarshalJSON(diagnostics, data);
    if (err !== undefined) {
      return Errorf("invalid BuildInfoSemanticDiagnostic: %s", str);
    }
    receiver!.FileId = 0 as BuildInfoFileId;
    receiver!.Diagnostics = diagnostics;
    return undefined;
  }
  return Errorf("invalid BuildInfoSemanticDiagnostic: %s", str);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoFilePendingEmit","kind":"type","status":"implemented","sigHash":"104c71acc3eed9f8ca13f3cca84cbfd597db35024746dc97573e61c92a523a7c","bodyHash":"041721a272455dee4cbadd156a07fa61606b0b04c2637f3e09f5b737069d5800"}
 *
 * Go source:
 * BuildInfoFilePendingEmit struct {
 * 	FileId   BuildInfoFileId
 * 	EmitKind FileEmitKind
 * }
 */
export interface BuildInfoFilePendingEmit {
  FileId: BuildInfoFileId;
  EmitKind: FileEmitKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFilePendingEmit.MarshalJSON","kind":"method","status":"implemented","sigHash":"db9aa0a51d533dd09237d6a1ba55753507df93c7a557f1a52d6478bae37c611e","bodyHash":"6cfcf2655a2f29aca2eeaaf3e2a8cd0e5ff933ee6adb937012a932ede01788cf"}
 *
 * Go source:
 * func (b *BuildInfoFilePendingEmit) MarshalJSON() ([]byte, error) {
 * 	if b.EmitKind == 0 {
 * 		return json.Marshal(b.FileId)
 * 	}
 * 	if b.EmitKind == FileEmitKindDts {
 * 		fileListIds := []BuildInfoFileId{b.FileId}
 * 		return json.Marshal(fileListIds)
 * 	}
 * 	fileAndEmitKind := []int{int(b.FileId), int(b.EmitKind)}
 * 	return json.Marshal(fileAndEmitKind)
 * }
 */
export function BuildInfoFilePendingEmit_MarshalJSON(receiver: GoPtr<BuildInfoFilePendingEmit>): [GoSlice<byte>, GoError] {
  if (receiver!.EmitKind === 0) {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.FileId)), undefined];
  }
  if (receiver!.EmitKind === FileEmitKindDts) {
    return [stringToBytes(globalThis.JSON.stringify([receiver!.FileId])), undefined];
  }
  return [stringToBytes(globalThis.JSON.stringify([receiver!.FileId, receiver!.EmitKind])), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoFilePendingEmit.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"3d758dbd829bd8c880b64da3e5dee7e2672612e555a888d1235041f76eaf18d8","bodyHash":"12d02599149d2ac3071607bb6ffa365c531acc55f9e43ab9e02622ab32f78ab9"}
 *
 * Go source:
 * func (b *BuildInfoFilePendingEmit) UnmarshalJSON(data []byte) error {
 * 	var fileId BuildInfoFileId
 * 	if err := json.Unmarshal(data, &fileId); err != nil {
 * 		var intTuple []int
 * 		if err := json.Unmarshal(data, &intTuple); err != nil || len(intTuple) == 0 {
 * 			return fmt.Errorf("invalid BuildInfoFilePendingEmit: %s", data)
 * 		}
 * 		switch len(intTuple) {
 * 		case 1:
 * 			*b = BuildInfoFilePendingEmit{
 * 				FileId:   BuildInfoFileId(intTuple[0]),
 * 				EmitKind: FileEmitKindDts,
 * 			}
 * 			return nil
 * 		case 2:
 * 			*b = BuildInfoFilePendingEmit{
 * 				FileId:   BuildInfoFileId(intTuple[0]),
 * 				EmitKind: FileEmitKind(intTuple[1]),
 * 			}
 * 			return nil
 * 		default:
 * 			return fmt.Errorf("invalid BuildInfoFilePendingEmit: expected 1 or 2 integers, got %d", len(intTuple))
 * 		}
 * 	}
 * 	*b = BuildInfoFilePendingEmit{
 * 		FileId: fileId,
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoFilePendingEmit_UnmarshalJSON(receiver: GoPtr<BuildInfoFilePendingEmit>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoFilePendingEmit: %s", str);
  }
  if (typeof parsed === "number") {
    receiver!.FileId = parsed as BuildInfoFileId;
    receiver!.EmitKind = 0 as FileEmitKind;
    return undefined;
  }
  if (globalThis.Array.isArray(parsed)) {
    const arr = parsed as number[];
    if (arr.length === 0) {
      return Errorf("invalid BuildInfoFilePendingEmit: %s", str);
    }
    if (arr.length === 1) {
      receiver!.FileId = arr[0] as BuildInfoFileId;
      receiver!.EmitKind = FileEmitKindDts;
      return undefined;
    }
    if (arr.length === 2) {
      receiver!.FileId = arr[0] as BuildInfoFileId;
      receiver!.EmitKind = arr[1] as FileEmitKind;
      return undefined;
    }
    return Errorf("invalid BuildInfoFilePendingEmit: expected 1 or 2 integers, got %d", arr.length);
  }
  return Errorf("invalid BuildInfoFilePendingEmit: %s", str);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoEmitSignature","kind":"type","status":"implemented","sigHash":"45cfb7e42e49f33d5cde207c6bf4e64f0d193c5755dc5d052fa1c21687df7401","bodyHash":"1c6ce31aebf4b48970e3f016b575294f12634b918119cb82aa260c69d51b1368"}
 *
 * Go source:
 * BuildInfoEmitSignature struct {
 * 	FileId              BuildInfoFileId
 * 	Signature           string // Signature if it is different from file's Signature
 * 	DiffersOnlyInDtsMap bool   // true if signature is different only in dtsMap value
 * 	DiffersInOptions    bool   // true if signature is different in options used to emit file
 * }
 */
export interface BuildInfoEmitSignature {
  FileId: BuildInfoFileId;
  Signature: string;
  DiffersOnlyInDtsMap: bool;
  DiffersInOptions: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoEmitSignature.noEmitSignature","kind":"method","status":"implemented","sigHash":"db7bdacc98e65b4dfa3ae70cabbb622e2cf3bab14a3cac2d86f107b7839195c5","bodyHash":"f93c10322f9f71a247974feddeabdfe247f95f47d4495d7b5d648c76f5b28752"}
 *
 * Go source:
 * func (b *BuildInfoEmitSignature) noEmitSignature() bool {
 * 	return b.Signature == "" && !b.DiffersOnlyInDtsMap && !b.DiffersInOptions
 * }
 */
export function BuildInfoEmitSignature_noEmitSignature(receiver: GoPtr<BuildInfoEmitSignature>): bool {
  return receiver!.Signature === "" && !receiver!.DiffersOnlyInDtsMap && !receiver!.DiffersInOptions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoEmitSignature.toEmitSignature","kind":"method","status":"implemented","sigHash":"f23d598923ee98b6787a6a4d9fc0f8173bf9a290a1d93c8b72c824d8c30c0980","bodyHash":"cb729e689777cf506dd97c1044b0c72d2fa49ae21a79e47ad9039561770a993c"}
 *
 * Go source:
 * func (b *BuildInfoEmitSignature) toEmitSignature(path tspath.Path, emitSignatures *collections.SyncMap[tspath.Path, *emitSignature]) *emitSignature {
 * 	var signature string
 * 	var signatureWithDifferentOptions []string
 * 	if b.DiffersOnlyInDtsMap {
 * 		signatureWithDifferentOptions = make([]string, 0, 1)
 * 		info, _ := emitSignatures.Load(path)
 * 		signatureWithDifferentOptions = append(signatureWithDifferentOptions, info.signature)
 * 	} else if b.DiffersInOptions {
 * 		signatureWithDifferentOptions = make([]string, 0, 1)
 * 		signatureWithDifferentOptions = append(signatureWithDifferentOptions, b.Signature)
 * 	} else {
 * 		signature = b.Signature
 * 	}
 * 	return &emitSignature{
 * 		signature:                     signature,
 * 		signatureWithDifferentOptions: signatureWithDifferentOptions,
 * 	}
 * }
 */
export function BuildInfoEmitSignature_toEmitSignature(receiver: GoPtr<BuildInfoEmitSignature>, path: Path, emitSignatures: GoPtr<SyncMap<Path, GoPtr<emitSignature>>>): GoPtr<emitSignature> {
  let signature = "";
  let signatureWithDifferentOptions: GoSlice<string> | undefined;
  if (receiver!.DiffersOnlyInDtsMap) {
    signatureWithDifferentOptions = [];
    const [info] = SyncMap_Load(emitSignatures as import("../../collections/syncmap.js").SyncMap<Path, GoPtr<emitSignature>>, path);
    signatureWithDifferentOptions.push(info!.signature);
  } else if (receiver!.DiffersInOptions) {
    signatureWithDifferentOptions = [receiver!.Signature];
  } else {
    signature = receiver!.Signature;
  }
  return {
    signature,
    signatureWithDifferentOptions: signatureWithDifferentOptions ?? [],
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoEmitSignature.MarshalJSON","kind":"method","status":"implemented","sigHash":"5269700e6a0a2799bee094aacf9e7e88f06d3e5eca2f7dada7cc8ceaa15a0384","bodyHash":"b51c02b2f9bf15c316b6434e6fcc98085bdf4009f3a45c4d618c41e45e70f7db"}
 *
 * Go source:
 * func (b *BuildInfoEmitSignature) MarshalJSON() ([]byte, error) {
 * 	if b.noEmitSignature() {
 * 		return json.Marshal(b.FileId)
 * 	}
 * 	fileIdAndSignature := make([]any, 2)
 * 	fileIdAndSignature[0] = b.FileId
 * 	var signature any
 * 	if b.DiffersOnlyInDtsMap {
 * 		signature = []string{}
 * 	} else if b.DiffersInOptions {
 * 		signature = []string{b.Signature}
 * 	} else {
 * 		signature = b.Signature
 * 	}
 * 	fileIdAndSignature[1] = signature
 * 	return json.Marshal(fileIdAndSignature)
 * }
 */
export function BuildInfoEmitSignature_MarshalJSON(receiver: GoPtr<BuildInfoEmitSignature>): [GoSlice<byte>, GoError] {
  if (BuildInfoEmitSignature_noEmitSignature(receiver)) {
    return [stringToBytes(globalThis.JSON.stringify(receiver!.FileId)), undefined];
  }
  let signature: unknown;
  if (receiver!.DiffersOnlyInDtsMap) {
    signature = [] as string[];
  } else if (receiver!.DiffersInOptions) {
    signature = [receiver!.Signature];
  } else {
    signature = receiver!.Signature;
  }
  return [stringToBytes(globalThis.JSON.stringify([receiver!.FileId, signature])), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoEmitSignature.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"fc7f1bcaae5c1998f92b2e096ba5842691ce3970c5af07f5758b8c1f90afa9e1","bodyHash":"cfff1ec3b1f5eb77984e50675b4aee07685a5080c35559b4e1b72e0bf72331e3"}
 *
 * Go source:
 * func (b *BuildInfoEmitSignature) UnmarshalJSON(data []byte) error {
 * 	var fileId BuildInfoFileId
 * 	if err := json.Unmarshal(data, &fileId); err != nil {
 * 		var fileIdAndSignature []any
 * 		if err := json.Unmarshal(data, &fileIdAndSignature); err != nil {
 * 			return fmt.Errorf("invalid BuildInfoEmitSignature: %s", data)
 * 		}
 * 		if len(fileIdAndSignature) != 2 {
 * 			return fmt.Errorf("invalid BuildInfoEmitSignature: expected 2 elements, got %d", len(fileIdAndSignature))
 * 		}
 * 		var fileId BuildInfoFileId
 * 		if id, ok := fileIdAndSignature[0].(float64); !ok {
 * 			return fmt.Errorf("invalid fileId in BuildInfoEmitSignature: expected float64, got %T", fileIdAndSignature[0])
 * 		} else {
 * 			fileId = BuildInfoFileId(id)
 * 		}
 * 		var signature string
 * 		var differsOnlyInDtsMap, differsInOptions bool
 * 		if signatureV, ok := fileIdAndSignature[1].(string); !ok {
 * 			if signatureList, ok := fileIdAndSignature[1].([]any); !ok {
 * 				return fmt.Errorf("invalid signature in BuildInfoEmitSignature: expected string or []string, got %T", fileIdAndSignature[1])
 * 			} else {
 * 				switch len(signatureList) {
 * 				case 0:
 * 					differsOnlyInDtsMap = true
 * 				case 1:
 * 					if sig, ok := signatureList[0].(string); !ok {
 * 						return fmt.Errorf("invalid signature in BuildInfoEmitSignature: expected string, got %T", signatureList[0])
 * 					} else {
 * 						signature = sig
 * 						differsInOptions = true
 * 					}
 * 				default:
 * 					return fmt.Errorf("invalid signature in BuildInfoEmitSignature: expected string or []string with 0 or 1 element, got %d elements", len(signatureList))
 * 				}
 * 			}
 * 		} else {
 * 			signature = signatureV
 * 		}
 * 		*b = BuildInfoEmitSignature{
 * 			FileId:              fileId,
 * 			Signature:           signature,
 * 			DiffersOnlyInDtsMap: differsOnlyInDtsMap,
 * 			DiffersInOptions:    differsInOptions,
 * 		}
 * 		return nil
 *
 * 	}
 * 	*b = BuildInfoEmitSignature{
 * 		FileId: fileId,
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoEmitSignature_UnmarshalJSON(receiver: GoPtr<BuildInfoEmitSignature>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoEmitSignature: %s", str);
  }
  if (typeof parsed === "number") {
    receiver!.FileId = parsed as BuildInfoFileId;
    receiver!.Signature = "";
    receiver!.DiffersOnlyInDtsMap = false;
    receiver!.DiffersInOptions = false;
    return undefined;
  }
  if (!globalThis.Array.isArray(parsed)) {
    return Errorf("invalid BuildInfoEmitSignature: %s", str);
  }
  const arr = parsed as unknown[];
  if (arr.length !== 2) {
    return Errorf("invalid BuildInfoEmitSignature: expected 2 elements, got %d", arr.length);
  }
  if (typeof arr[0] !== "number") {
    return Errorf("invalid fileId in BuildInfoEmitSignature: expected float64, got %s", typeof arr[0]);
  }
  const fileId = arr[0] as BuildInfoFileId;
  let signature = "";
  let differsOnlyInDtsMap = false;
  let differsInOptions = false;
  if (typeof arr[1] === "string") {
    signature = arr[1];
  } else if (globalThis.Array.isArray(arr[1])) {
    const signatureList = arr[1] as unknown[];
    if (signatureList.length === 0) {
      differsOnlyInDtsMap = true;
    } else if (signatureList.length === 1) {
      if (typeof signatureList[0] !== "string") {
        return Errorf("invalid signature in BuildInfoEmitSignature: expected string, got %s", typeof signatureList[0]);
      }
      signature = signatureList[0];
      differsInOptions = true;
    } else {
      return Errorf("invalid signature in BuildInfoEmitSignature: expected string or []string with 0 or 1 element, got %d elements", signatureList.length);
    }
  } else {
    return Errorf("invalid signature in BuildInfoEmitSignature: expected string or []string, got %s", typeof arr[1]);
  }
  receiver!.FileId = fileId;
  receiver!.Signature = signature;
  receiver!.DiffersOnlyInDtsMap = differsOnlyInDtsMap;
  receiver!.DiffersInOptions = differsInOptions;
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoResolvedRoot","kind":"type","status":"implemented","sigHash":"df3f2856e0487b3a20dd19c92a3210b03e434bf57204365d75d241f7c60db13b","bodyHash":"9d198ab004e468bd820068f894632d0882b74026de22c643a6b4eefbe59b67c9"}
 *
 * Go source:
 * BuildInfoResolvedRoot struct {
 * 	Resolved BuildInfoFileId
 * 	Root     BuildInfoFileId
 * }
 */
export interface BuildInfoResolvedRoot {
  Resolved: BuildInfoFileId;
  Root: BuildInfoFileId;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoResolvedRoot.MarshalJSON","kind":"method","status":"implemented","sigHash":"e2b9d71720ffd728ec28b8bc0aef84ac6971907d21325e3e5a4c32d85d898e49","bodyHash":"49389aeb8e6ee939e86b0ca609949a168f3b737e39ffed620297fd285d429461"}
 *
 * Go source:
 * func (b *BuildInfoResolvedRoot) MarshalJSON() ([]byte, error) {
 * 	return json.Marshal([2]BuildInfoFileId{b.Resolved, b.Root})
 * }
 */
export function BuildInfoResolvedRoot_MarshalJSON(receiver: GoPtr<BuildInfoResolvedRoot>): [GoSlice<byte>, GoError] {
  return [stringToBytes(globalThis.JSON.stringify([receiver!.Resolved, receiver!.Root])), undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoResolvedRoot.UnmarshalJSON","kind":"method","status":"implemented","sigHash":"07160a0b589d56385b20c07054e193f4899069ca9fd28fcb7dcf51be60925df8","bodyHash":"dd847727a9347a1bf42f252ae8d5a784b19d197a588075f970825f46611c8ed6"}
 *
 * Go source:
 * func (b *BuildInfoResolvedRoot) UnmarshalJSON(data []byte) error {
 * 	var resolvedAndRoot [2]int
 * 	if err := json.Unmarshal(data, &resolvedAndRoot); err != nil {
 * 		return fmt.Errorf("invalid BuildInfoResolvedRoot: %s", data)
 * 	}
 * 	*b = BuildInfoResolvedRoot{
 * 		Resolved: BuildInfoFileId(resolvedAndRoot[0]),
 * 		Root:     BuildInfoFileId(resolvedAndRoot[1]),
 * 	}
 * 	return nil
 * }
 */
export function BuildInfoResolvedRoot_UnmarshalJSON(receiver: GoPtr<BuildInfoResolvedRoot>, data: GoSlice<byte>): GoError {
  const str = bytesToString(data);
  let parsed: unknown;
  try {
    parsed = globalThis.JSON.parse(str);
  } catch (_) {
    return Errorf("invalid BuildInfoResolvedRoot: %s", str);
  }
  if (!globalThis.Array.isArray(parsed) || (parsed as unknown[]).length !== 2) {
    return Errorf("invalid BuildInfoResolvedRoot: %s", str);
  }
  const arr = parsed as number[];
  receiver!.Resolved = arr[0] as BuildInfoFileId;
  receiver!.Root = arr[1] as BuildInfoFileId;
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfo","kind":"type","status":"implemented","sigHash":"3047e84be7615e3b3f127ac18cf18d6dd08664a62e46a19d7b153de078e72299","bodyHash":"f4d8c92a4b2495d427c2a4ea4cc65a322281654b917dca432b7fe741e27754b8"}
 *
 * Go source:
 * BuildInfo struct {
 * 	Version string `json:"version,omitzero"`
 * 
 * 	// Common between incremental and tsc -b buildinfo for non incremental programs
 * 	Errors       bool             `json:"errors,omitzero"`
 * 	CheckPending bool             `json:"checkPending,omitzero"`
 * 	Root         []*BuildInfoRoot `json:"root,omitzero"`
 * 
 * 	// IncrementalProgram info
 * 	FileNames                  []string                             `json:"fileNames,omitzero"`
 * 	FileInfos                  []*BuildInfoFileInfo                 `json:"fileInfos,omitzero"`
 * 	FileIdsList                [][]BuildInfoFileId                  `json:"fileIdsList,omitzero"`
 * 	Options                    *collections.OrderedMap[string, any] `json:"options,omitzero"`
 * 	ReferencedMap              []*BuildInfoReferenceMapEntry        `json:"referencedMap,omitzero"`
 * 	SemanticDiagnosticsPerFile []*BuildInfoSemanticDiagnostic       `json:"semanticDiagnosticsPerFile,omitzero"`
 * 	EmitDiagnosticsPerFile     []*BuildInfoDiagnosticsOfFile        `json:"emitDiagnosticsPerFile,omitzero"`
 * 	ChangeFileSet              []BuildInfoFileId                    `json:"changeFileSet,omitzero"`
 * 	AffectedFilesPendingEmit   []*BuildInfoFilePendingEmit          `json:"affectedFilesPendingEmit,omitzero"`
 * 	LatestChangedDtsFile       string                               `json:"latestChangedDtsFile,omitzero"` // Because this is only output file in the program, we dont need fileId to deduplicate name
 * 	EmitSignatures             []*BuildInfoEmitSignature            `json:"emitSignatures,omitzero"`
 * 	ResolvedRoot               []*BuildInfoResolvedRoot             `json:"resolvedRoot,omitzero"`
 * 
 * 	// NonIncrementalProgram info
 * 	SemanticErrors bool `json:"semanticErrors,omitzero"`
 * }
 */
export interface BuildInfo {
  Version: string;
  Errors: bool;
  CheckPending: bool;
  Root: GoSlice<GoPtr<BuildInfoRoot>>;
  FileNames: GoSlice<string>;
  FileInfos: GoSlice<GoPtr<BuildInfoFileInfo>>;
  FileIdsList: GoSlice<GoSlice<BuildInfoFileId>>;
  Options: GoPtr<OrderedMap<string, unknown>>;
  ReferencedMap: GoSlice<GoPtr<BuildInfoReferenceMapEntry>>;
  SemanticDiagnosticsPerFile: GoSlice<GoPtr<BuildInfoSemanticDiagnostic>>;
  EmitDiagnosticsPerFile: GoSlice<GoPtr<BuildInfoDiagnosticsOfFile>>;
  ChangeFileSet: GoSlice<BuildInfoFileId>;
  AffectedFilesPendingEmit: GoSlice<GoPtr<BuildInfoFilePendingEmit>>;
  LatestChangedDtsFile: string;
  EmitSignatures: GoSlice<GoPtr<BuildInfoEmitSignature>>;
  ResolvedRoot: GoSlice<GoPtr<BuildInfoResolvedRoot>>;
  SemanticErrors: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.IsValidVersion","kind":"method","status":"implemented","sigHash":"2f82176a999832602de7880965e9a444f974432d2c7cfa2022862d79be77a44c","bodyHash":"bd07a93e30a1b9c51ee3896e38ddb6a182b96fe404015f060a130d0d77595391"}
 *
 * Go source:
 * func (b *BuildInfo) IsValidVersion() bool {
 * 	return b.Version == core.Version()
 * }
 */
export function BuildInfo_IsValidVersion(receiver: GoPtr<BuildInfo>): bool {
  return receiver!.Version === Version();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.IsIncremental","kind":"method","status":"implemented","sigHash":"0cd17a53844d08e00c2dccc6bd8de857b25d39667ca2898c673249c8d97b907b","bodyHash":"4f8dba7d85f01e625a00d270e15c150fac0cdcd1c211946ba66fd006d6abd044"}
 *
 * Go source:
 * func (b *BuildInfo) IsIncremental() bool {
 * 	return b != nil && len(b.FileNames) != 0
 * }
 */
export function BuildInfo_IsIncremental(receiver: GoPtr<BuildInfo>): bool {
  return receiver !== undefined && receiver.FileNames !== undefined && receiver.FileNames.length !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.fileName","kind":"method","status":"implemented","sigHash":"a8b9b770e47d758b56760dde2b5761c2329b96dec41bf8a84601b5bb84e59275","bodyHash":"aadcc8c67c418a66cce720f62e24c23b7d8bc9096c3d4acddc6e18e9ca7c5c06"}
 *
 * Go source:
 * func (b *BuildInfo) fileName(fileId BuildInfoFileId) string {
 * 	return b.FileNames[fileId-1]
 * }
 */
export function BuildInfo_fileName(receiver: GoPtr<BuildInfo>, fileId: BuildInfoFileId): string {
  return receiver!.FileNames[fileId - 1]!;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.fileInfo","kind":"method","status":"implemented","sigHash":"a59f1da707818907b0d5595846866e70a1151a826d4b78a43b4d922d555fe231","bodyHash":"17dc791c73aaf18239aec256fd3d3a03e422f78251f8afd67362d0ff82728f89"}
 *
 * Go source:
 * func (b *BuildInfo) fileInfo(fileId BuildInfoFileId) *BuildInfoFileInfo {
 * 	return b.FileInfos[fileId-1]
 * }
 */
export function BuildInfo_fileInfo(receiver: GoPtr<BuildInfo>, fileId: BuildInfoFileId): GoPtr<BuildInfoFileInfo> {
  return receiver!.FileInfos[fileId - 1];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.GetCompilerOptions","kind":"method","status":"implemented","sigHash":"ca67c31ae752dfd0fea42a4caa4184ea0db80641fe05209c6d832b60ae3da90e","bodyHash":"1f61d9103bb43f35c84703aff02a78532bc4b80e8842da45c0d3063ecc8b6774"}
 *
 * Go source:
 * func (b *BuildInfo) GetCompilerOptions(buildInfoDirectory string) *core.CompilerOptions {
 * 	options := &core.CompilerOptions{}
 * 	for option, value := range b.Options.Entries() {
 * 		if buildInfoDirectory != "" {
 * 			result, ok := tsoptions.ConvertOptionToAbsolutePath(option, value, tsoptions.CommandLineCompilerOptionsMap, buildInfoDirectory)
 * 			if ok {
 * 				tsoptions.ParseCompilerOptions(option, result, options)
 * 				continue
 * 			}
 * 		}
 * 		tsoptions.ParseCompilerOptions(option, value, options)
 *
 * 	}
 * 	return options
 * }
 */
export function BuildInfo_GetCompilerOptions(receiver: GoPtr<BuildInfo>, buildInfoDirectory: string): GoPtr<CompilerOptions> {
  const options: CompilerOptions = {} as CompilerOptions;
  const entries: GoSeq2<string, unknown> = OrderedMap_Entries(receiver!.Options as import("../../collections/ordered_map.js").OrderedMap<string, unknown>);
  entries((option: string, value: unknown): bool => {
    if (buildInfoDirectory !== "") {
      const [result, ok] = ConvertOptionToAbsolutePath(option, value, CommandLineCompilerOptionsMap, buildInfoDirectory);
      if (ok) {
        ParseCompilerOptions(option, result, options);
        return true;
      }
    }
    ParseCompilerOptions(option, value, options);
    return true;
  });
  return options;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.IsEmitPending","kind":"method","status":"implemented","sigHash":"53745a54b99d039add9ad22bf97f35fc47d3f30f012bfc6b47152bdd77b91fe5","bodyHash":"894f2b69c79a4128a6890b38c895f6e196114eb1983eabde9bc1c01f1a434acf"}
 *
 * Go source:
 * func (b *BuildInfo) IsEmitPending(resolved *tsoptions.ParsedCommandLine, buildInfoDirectory string) bool {
 * 	// Some of the emit files like source map or dts etc are not yet done
 * 	if !resolved.CompilerOptions().NoEmit.IsTrue() || resolved.CompilerOptions().GetEmitDeclarations() {
 * 		pendingEmit := getPendingEmitKindWithOptions(resolved.CompilerOptions(), b.GetCompilerOptions(buildInfoDirectory))
 * 		if resolved.CompilerOptions().NoEmit.IsTrue() {
 * 			pendingEmit &= FileEmitKindDtsErrors
 * 		}
 * 		return pendingEmit != 0
 * 	}
 * 	return false
 * }
 */
export function BuildInfo_IsEmitPending(receiver: GoPtr<BuildInfo>, resolved: GoPtr<ParsedCommandLine>, buildInfoDirectory: string): bool {
  const co = ParsedCommandLine_CompilerOptions(resolved);
  if (!Tristate_IsTrue(co!.NoEmit) || CompilerOptions_GetEmitDeclarations(co)) {
    let pendingEmit = getPendingEmitKindWithOptions(co, BuildInfo_GetCompilerOptions(receiver, buildInfoDirectory));
    if (Tristate_IsTrue(co!.NoEmit)) {
      pendingEmit = (pendingEmit & FileEmitKindDtsErrors) as typeof pendingEmit;
    }
    return pendingEmit !== 0;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfo.GetBuildInfoRootInfoReader","kind":"method","status":"implemented","sigHash":"2494d8d0486abcb7864f76a25b5d79f05fbe236179343345a25f5cb2dd961db4","bodyHash":"b259cbff841d3b48c8186898a31f097d2e0e06cb6d6df498846815ec47c0044e"}
 *
 * Go source:
 * func (b *BuildInfo) GetBuildInfoRootInfoReader(buildInfoDirectory string, comparePathOptions tspath.ComparePathsOptions) *BuildInfoRootInfoReader {
 * 	resolvedRootFileInfos := make(map[tspath.Path]*BuildInfoFileInfo, len(b.FileNames))
 * 	// Roots of the File
 * 	rootToResolved := collections.NewOrderedMapWithSizeHint[tspath.Path, tspath.Path](len(b.FileNames))
 * 	resolvedToRoot := make(map[tspath.Path]tspath.Path, len(b.ResolvedRoot))
 * 	toPath := func(fileName string) tspath.Path {
 * 		return tspath.ToPath(fileName, buildInfoDirectory, comparePathOptions.UseCaseSensitiveFileNames)
 * 	}
 *
 * 	// Create map from resolvedRoot to Root
 * 	for _, resolved := range b.ResolvedRoot {
 * 		resolvedToRoot[toPath(b.fileName(resolved.Resolved))] = toPath(b.fileName(resolved.Root))
 * 	}
 *
 * 	addRoot := func(resolvedRoot string, fileInfo *BuildInfoFileInfo) {
 * 		resolvedRootPath := toPath(resolvedRoot)
 * 		if rootPath, ok := resolvedToRoot[resolvedRootPath]; ok {
 * 			rootToResolved.Set(rootPath, resolvedRootPath)
 * 		} else {
 * 			rootToResolved.Set(resolvedRootPath, resolvedRootPath)
 * 		}
 * 		if fileInfo != nil {
 * 			resolvedRootFileInfos[resolvedRootPath] = fileInfo
 * 		}
 * 	}
 *
 * 	for _, root := range b.Root {
 * 		if root.NonIncremental != "" {
 * 			addRoot(root.NonIncremental, nil)
 * 		} else if root.End == 0 {
 * 			addRoot(b.fileName(root.Start), b.fileInfo(root.Start))
 * 		} else {
 * 			for i := root.Start; i <= root.End; i++ {
 * 				addRoot(b.fileName(i), b.fileInfo(i))
 * 			}
 * 		}
 * 	}
 *
 * 	return &BuildInfoRootInfoReader{
 * 		resolvedRootFileInfos: resolvedRootFileInfos,
 * 		rootToResolved:        rootToResolved,
 * 	}
 * }
 */
export function BuildInfo_GetBuildInfoRootInfoReader(receiver: GoPtr<BuildInfo>, buildInfoDirectory: string, comparePathOptions: ComparePathsOptions): GoPtr<BuildInfoRootInfoReader> {
  const resolvedRootFileInfos: GoMap<Path, GoPtr<BuildInfoFileInfo>> = new Map<Path, GoPtr<BuildInfoFileInfo>>();
  const rootToResolved = NewOrderedMapWithSizeHint<Path, Path>(receiver!.FileNames?.length ?? 0);
  const resolvedToRoot: Map<Path, Path> = new Map<Path, Path>();
  const toPath = (fileName: string): Path => ToPath(fileName, buildInfoDirectory, comparePathOptions.UseCaseSensitiveFileNames);

  for (const resolved of receiver!.ResolvedRoot ?? []) {
    resolvedToRoot.set(toPath(BuildInfo_fileName(receiver, resolved!.Resolved)), toPath(BuildInfo_fileName(receiver, resolved!.Root)));
  }

  const addRoot = (resolvedRoot: string, fileInfo: GoPtr<BuildInfoFileInfo>): void => {
    const resolvedRootPath = toPath(resolvedRoot);
    const rootPath = resolvedToRoot.get(resolvedRootPath);
    if (rootPath !== undefined) {
      OrderedMap_Set(rootToResolved, rootPath, resolvedRootPath);
    } else {
      OrderedMap_Set(rootToResolved, resolvedRootPath, resolvedRootPath);
    }
    if (fileInfo !== undefined) {
      resolvedRootFileInfos.set(resolvedRootPath, fileInfo);
    }
  };

  for (const root of receiver!.Root ?? []) {
    if (root!.NonIncremental !== "") {
      addRoot(root!.NonIncremental, undefined);
    } else if (root!.End === 0) {
      addRoot(BuildInfo_fileName(receiver, root!.Start), BuildInfo_fileInfo(receiver, root!.Start));
    } else {
      for (let i = root!.Start; i <= root!.End; i++) {
        addRoot(BuildInfo_fileName(receiver, i as BuildInfoFileId), BuildInfo_fileInfo(receiver, i as BuildInfoFileId));
      }
    }
  }

  return {
    resolvedRootFileInfos,
    rootToResolved,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::type::BuildInfoRootInfoReader","kind":"type","status":"implemented","sigHash":"ad64ba70f88796a0d1cafe928159cdb4bacfafd3ab7678042eb52d057427909e","bodyHash":"81045cbd0106607b26c4c888758586367aca2868b354d22473c2791e65c4190f"}
 *
 * Go source:
 * BuildInfoRootInfoReader struct {
 * 	resolvedRootFileInfos map[tspath.Path]*BuildInfoFileInfo
 * 	rootToResolved        *collections.OrderedMap[tspath.Path, tspath.Path]
 * }
 */
export interface BuildInfoRootInfoReader {
  resolvedRootFileInfos: GoMap<Path, GoPtr<BuildInfoFileInfo>>;
  rootToResolved: GoPtr<OrderedMap<Path, Path>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoRootInfoReader.GetBuildInfoFileInfo","kind":"method","status":"implemented","sigHash":"28524a83d300039c33bd3801cba3bcf201d28a90939e358ffb847a92e0f48669","bodyHash":"ccd69dc08c20b370d9be346178c30c5fb4c721e21e5c710578e33d1c6fa474a8"}
 *
 * Go source:
 * func (b *BuildInfoRootInfoReader) GetBuildInfoFileInfo(inputFilePath tspath.Path) (*BuildInfoFileInfo, tspath.Path) {
 * 	if info, ok := b.resolvedRootFileInfos[inputFilePath]; ok {
 * 		return info, inputFilePath
 * 	}
 * 	if resolved, ok := b.rootToResolved.Get(inputFilePath); ok {
 * 		return b.resolvedRootFileInfos[resolved], resolved
 * 	}
 * 	return nil, ""
 * }
 */
export function BuildInfoRootInfoReader_GetBuildInfoFileInfo(receiver: GoPtr<BuildInfoRootInfoReader>, inputFilePath: Path): [GoPtr<BuildInfoFileInfo>, Path] {
  const info = (receiver!.resolvedRootFileInfos as Map<Path, GoPtr<BuildInfoFileInfo>>).get(inputFilePath);
  if (info !== undefined) {
    return [info, inputFilePath];
  }
  const [resolved, ok] = OrderedMap_Get(receiver!.rootToResolved as import("../../collections/ordered_map.js").OrderedMap<Path, Path>, inputFilePath);
  if (ok) {
    return [(receiver!.resolvedRootFileInfos as Map<Path, GoPtr<BuildInfoFileInfo>>).get(resolved), resolved];
  }
  return [undefined, "" as Path];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/buildInfo.go::method::BuildInfoRootInfoReader.Roots","kind":"method","status":"implemented","sigHash":"e7e74c39fa24de048d3c8b39b292f58548dabfe4c3fee65ed9427881751ba849","bodyHash":"2ca5d4b09baddc87a3743b9f3c5899d060bb1c075beb07256f70cfc4f7efc098"}
 *
 * Go source:
 * func (b *BuildInfoRootInfoReader) Roots() iter.Seq[tspath.Path] {
 * 	return b.rootToResolved.Keys()
 * }
 */
export function BuildInfoRootInfoReader_Roots(receiver: GoPtr<BuildInfoRootInfoReader>): GoSeq<Path> {
  return OrderedMap_Keys(receiver!.rootToResolved as import("../../collections/ordered_map.js").OrderedMap<Path, Path>);
}
