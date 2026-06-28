import { Unmarshal } from "../../json/json.js";
import { ParsedCommandLine_GetBuildInfoFileName } from "../../tsoptions/parsedcommandline.js";
import { BuildInfo_IsIncremental, BuildInfo_IsValidVersion } from "./buildInfo.js";
import { buildInfoToSnapshot } from "./buildinfotosnapshot.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/incremental/incremental.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"41aa0d98e7be6aab2bbf8974ccc1007ce37161750d790fee18b3f3a73993c661"}
 *
 * Go source:
 * var _ BuildInfoReader = (*buildInfoReader)(nil)
 */
export let __1917d4a9_0 = buildInfoReader_as_incremental_BuildInfoReader(undefined);
export function buildInfoReader_as_incremental_BuildInfoReader(receiver) {
    return {
        ReadBuildInfo: (config) => buildInfoReader_ReadBuildInfo(receiver, config),
    };
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
export function buildInfoReader_ReadBuildInfo(receiver, config) {
    const buildInfoFileName = ParsedCommandLine_GetBuildInfoFileName(config);
    if (buildInfoFileName === "") {
        return undefined;
    }
    // Read build info file
    const [data, ok] = receiver.host.FS().ReadFile(buildInfoFileName);
    if (!ok) {
        return undefined;
    }
    const buildInfo = {};
    const err = Unmarshal(data, buildInfo);
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
export function NewBuildInfoReader(host) {
    const r = { host };
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
export function ReadBuildInfoProgram(config, reader, host) {
    // Read buildInfo file
    const buildInfo = reader.ReadBuildInfo(config);
    if (buildInfo === undefined || !BuildInfo_IsValidVersion(buildInfo) || !BuildInfo_IsIncremental(buildInfo)) {
        return undefined;
    }
    // Convert to information that can be used to create incremental program
    const incrementalProgram = {
        snapshot: buildInfoToSnapshot(buildInfo, config, host),
        program: undefined,
        host: undefined,
        testingData: undefined,
    };
    return incrementalProgram;
}
//# sourceMappingURL=incremental.js.map