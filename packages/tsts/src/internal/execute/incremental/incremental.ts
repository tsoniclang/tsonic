import type { GoPtr } from "../../../go/compat.js";
import type { CompilerHost } from "../../compiler/host.js";
import { Unmarshal } from "../../json/json.js";
import { ParsedCommandLine_GetBuildInfoFileName } from "../../tsoptions/parsedcommandline.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import { BuildInfo_IsIncremental, BuildInfo_IsValidVersion } from "./buildInfo.js";
import type { BuildInfo } from "./buildInfo.js";
import { buildInfoToSnapshot } from "./buildinfotosnapshot.js";
import type { Program } from "./program.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::type::BuildInfoReader","kind":"type","status":"implemented","sigHash":"19c6bf62c57e783f64019b1642c54ad12b18d1ff63eaeac0f0351389a5a531a8","bodyHash":"75a2e9874229cdbb91c0c700fe8d5a56f5bd47968c12613050be6aca3b12d9f0"}
 *
 * Go source:
 * BuildInfoReader interface {
 * 	ReadBuildInfo(config *tsoptions.ParsedCommandLine) *BuildInfo
 * }
 */
export interface BuildInfoReader {
  ReadBuildInfo(config: GoPtr<ParsedCommandLine>): GoPtr<BuildInfo>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"41aa0d98e7be6aab2bbf8974ccc1007ce37161750d790fee18b3f3a73993c661"}
 *
 * Go source:
 * var _ BuildInfoReader = (*buildInfoReader)(nil)
 */
export let __1917d4a9_0: BuildInfoReader = buildInfoReader_as_incremental_BuildInfoReader(undefined);

export function buildInfoReader_as_incremental_BuildInfoReader(receiver: GoPtr<buildInfoReader>): BuildInfoReader {
  return {
    ReadBuildInfo: (config: GoPtr<ParsedCommandLine>): GoPtr<BuildInfo> => buildInfoReader_ReadBuildInfo(receiver, config),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::type::buildInfoReader","kind":"type","status":"implemented","sigHash":"dfcce53f3de3062ceba253db9672d0aa2dd5f2e4895a9996dcf6421e72c32a7d","bodyHash":"ba7d35becd314c10ca258da4954fdddc73591b483af58b1f17d596b5b4455553"}
 *
 * Go source:
 * buildInfoReader struct {
 * 	host compiler.CompilerHost
 * }
 */
export interface buildInfoReader {
  host: CompilerHost;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::method::buildInfoReader.ReadBuildInfo","kind":"method","status":"implemented","sigHash":"e2ecaf8041f36bcc603f558d18887b283a10e14267d9121a9424402818dbaa8a","bodyHash":"dfa0fbdbaa6c764f9a105e49556fc78880e9004a520309f36e536749393e0dfb"}
 *
 * Go source:
 * func (r *buildInfoReader) ReadBuildInfo(config *tsoptions.ParsedCommandLine) *BuildInfo {
 * 	buildInfoFileName := config.GetBuildInfoFileName()
 * 	if buildInfoFileName == "" {
 * 		return nil
 * 	}
 * 
 * 	// Read build info file
 * 	data, ok := r.host.FS().ReadFile(buildInfoFileName)
 * 	if !ok {
 * 		return nil
 * 	}
 * 	var buildInfo BuildInfo
 * 	err := json.Unmarshal([]byte(data), &buildInfo)
 * 	if err != nil {
 * 		return nil
 * 	}
 * 	return &buildInfo
 * }
 */
export function buildInfoReader_ReadBuildInfo(receiver: GoPtr<buildInfoReader>, config: GoPtr<ParsedCommandLine>): GoPtr<BuildInfo> {
  const buildInfoFileName = ParsedCommandLine_GetBuildInfoFileName(config);
  if (buildInfoFileName === "") {
    return undefined;
  }

  // Read build info file
  const [data, ok] = receiver!.host.FS().ReadFile(buildInfoFileName);
  if (!ok) {
    return undefined;
  }
  const buildInfo: BuildInfo = {} as BuildInfo;
  const err = Unmarshal(data as unknown as never, buildInfo);
  if (err !== undefined) {
    return undefined;
  }
  return buildInfo;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::func::NewBuildInfoReader","kind":"func","status":"implemented","sigHash":"22d51c4acb88d7fb8ff63dab34e85e3f15102f94d0abc32144c93730d4481bf3","bodyHash":"c7c61ddc90486ed9f7288d18c30ee981392b747376a916e477f9d0ba81ecb616"}
 *
 * Go source:
 * func NewBuildInfoReader(
 * 	host compiler.CompilerHost,
 * ) BuildInfoReader {
 * 	return &buildInfoReader{host: host}
 * }
 */
export function NewBuildInfoReader(host: CompilerHost): BuildInfoReader {
  const r: buildInfoReader = { host };
  return buildInfoReader_as_incremental_BuildInfoReader(r);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::func::ReadBuildInfoProgram","kind":"func","status":"implemented","sigHash":"aabfc1a4730dca7e74e80efbb98a5957de1dff563e1c77c8fbcf401f17e0b3c8","bodyHash":"277cba8bfccb75c29b9e38d195873c724803eb67346f2d602ebf96ff03c536f5"}
 *
 * Go source:
 * func ReadBuildInfoProgram(config *tsoptions.ParsedCommandLine, reader BuildInfoReader, host compiler.CompilerHost) *Program {
 * 	// Read buildInfo file
 * 	buildInfo := reader.ReadBuildInfo(config)
 * 	if buildInfo == nil || !buildInfo.IsValidVersion() || !buildInfo.IsIncremental() {
 * 		return nil
 * 	}
 *
 * 	// Convert to information that can be used to create incremental program
 * 	incrementalProgram := &Program{
 * 		snapshot: buildInfoToSnapshot(buildInfo, config, host),
 * 	}
 * 	return incrementalProgram
 * }
 */
export function ReadBuildInfoProgram(config: GoPtr<ParsedCommandLine>, reader: BuildInfoReader, host: CompilerHost): GoPtr<Program> {
  // Read buildInfo file
  const buildInfo = reader.ReadBuildInfo(config);
  if (buildInfo === undefined || !BuildInfo_IsValidVersion(buildInfo) || !BuildInfo_IsIncremental(buildInfo)) {
    return undefined;
  }

  // Convert to information that can be used to create incremental program
  const incrementalProgram: Program = {
    snapshot: buildInfoToSnapshot(buildInfo, config, host),
    program: undefined,
    host: undefined as unknown as import("./host.js").Host,
    testingData: undefined,
  };
  return incrementalProgram;
}
