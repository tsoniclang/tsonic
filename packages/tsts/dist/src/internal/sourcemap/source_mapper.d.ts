import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { NameIndex, RawSourceMap, SourceIndex } from "./generator.js";
import type { ECMALineInfo } from "./lineinfo.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::type::Host","kind":"type","status":"implemented","sigHash":"87dbe6f0cfe05a5aa6179f6a36adf26e7d8bf5f0f92113c8de338be891efa895","bodyHash":"b1bf4af2732113dcf17fee1f4e6faad1162ed68cb2e5a8e2d69cbc880e14e210"}
 *
 * Go source:
 * Host interface {
 * 	UseCaseSensitiveFileNames() bool
 * 	GetECMALineInfo(fileName string) *ECMALineInfo
 * 	ReadFile(fileName string) (string, bool)
 * }
 */
export interface Host {
    UseCaseSensitiveFileNames(): bool;
    GetECMALineInfo(fileName: string): GoPtr<ECMALineInfo>;
    ReadFile(fileName: string): [string, bool];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::type::MappedPosition","kind":"type","status":"implemented","sigHash":"60e3f0bb65a3e1662d9235975510a9c4b9e3e51dd226a544161605c59909f457","bodyHash":"61851ed315c339f101c87b841f7bc369c10703fd062a126a046b6f6c3a4a966e"}
 *
 * Go source:
 * MappedPosition struct {
 * 	generatedPosition int
 * 	sourcePosition    int
 * 	sourceIndex       SourceIndex
 * 	nameIndex         NameIndex
 * }
 */
export interface MappedPosition {
    generatedPosition: int;
    sourcePosition: int;
    sourceIndex: SourceIndex;
    nameIndex: NameIndex;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::constGroup::missingPosition","kind":"constGroup","status":"implemented","sigHash":"8631f72bd303e15bee0bb99c126778fb902a2f95ef775772f2cde69ceac7f85e","bodyHash":"f671143dc06a38520c791bc6e72a9dce779ec00cca1d9f52a4bae8656bda2cff"}
 *
 * Go source:
 * const (
 * 	missingPosition = -1
 * )
 */
export declare const missingPosition: int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::method::MappedPosition.isSourceMappedPosition","kind":"method","status":"implemented","sigHash":"e3939c5f93517db8ba20a4511dc6134b373329dc6a70b97f47afbce6fd0ea8ac","bodyHash":"3358173f192b99c01bfd0c66d3b349d75f270a3e6b89e03d67b3d51da9982e1a"}
 *
 * Go source:
 * func (m *MappedPosition) isSourceMappedPosition() bool {
 * 	return m.sourceIndex != MissingSource && m.sourcePosition != missingPosition
 * }
 */
export declare function MappedPosition_isSourceMappedPosition(receiver: GoPtr<MappedPosition>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::type::SourceMappedPosition","kind":"type","status":"implemented","sigHash":"c388ce027fa63fb1c9f6192754142e96d6005bb73b3c2769adb79597368addfa","bodyHash":"68f59dc927992b723df6ab63d3a25ef0d55880804b2a16098a1a5d1116fcb179"}
 *
 * Go source:
 * SourceMappedPosition = MappedPosition
 */
export type SourceMappedPosition = MappedPosition;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::type::DocumentPositionMapper","kind":"type","status":"implemented","sigHash":"a59b7ce882528e8dab419b7c4bc089b0bddd6d3602d26b4593d5bdadc8c3729b","bodyHash":"c04b12ae54e311960ea5d50b05291849fa3f128bea9fcf9ae9f3bab2a7ccdd3f"}
 *
 * Go source:
 * DocumentPositionMapper struct {
 * 	useCaseSensitiveFileNames bool
 *
 * 	sourceFileAbsolutePaths   []string
 * 	sourceToSourceIndexMap    map[string]SourceIndex
 * 	generatedAbsoluteFilePath string
 *
 * 	generatedMappings []*MappedPosition
 * 	sourceMappings    map[SourceIndex][]*SourceMappedPosition
 * }
 */
export interface DocumentPositionMapper {
    useCaseSensitiveFileNames: bool;
    sourceFileAbsolutePaths: GoSlice<string>;
    sourceToSourceIndexMap: GoMap<string, SourceIndex>;
    generatedAbsoluteFilePath: string;
    generatedMappings: GoSlice<GoPtr<MappedPosition>>;
    sourceMappings: GoMap<SourceIndex, GoSlice<GoPtr<SourceMappedPosition>>>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::createDocumentPositionMapper","kind":"func","status":"implemented","sigHash":"aa0fb35a859f95528dd71a98b53fd0075b18a2c1d45fbd59ae694cc5cac7c5a4","bodyHash":"e18b22aea19764bcf0f82882ef406ca9925ce75515b83d1f47ec461cabf585d6"}
 *
 * Go source:
 * func createDocumentPositionMapper(host Host, sourceMap *RawSourceMap, mapPath string) *DocumentPositionMapper {
 * 	mapDirectory := tspath.GetDirectoryPath(mapPath)
 * 	var sourceRoot string
 * 	if sourceMap.SourceRoot != "" {
 * 		sourceRoot = tspath.GetNormalizedAbsolutePath(sourceMap.SourceRoot, mapDirectory)
 * 	} else {
 * 		sourceRoot = mapDirectory
 * 	}
 * 	generatedAbsoluteFilePath := tspath.GetNormalizedAbsolutePath(sourceMap.File, mapDirectory)
 * 	sourceFileAbsolutePaths := core.Map(sourceMap.Sources, func(source string) string {
 * 		return tspath.GetNormalizedAbsolutePath(source, sourceRoot)
 * 	})
 * 	useCaseSensitiveFileNames := host.UseCaseSensitiveFileNames()
 * 	sourceToSourceIndexMap := make(map[string]SourceIndex, len(sourceFileAbsolutePaths))
 * 	for i, source := range sourceFileAbsolutePaths {
 * 		sourceToSourceIndexMap[tspath.GetCanonicalFileName(source, useCaseSensitiveFileNames)] = SourceIndex(i)
 * 	}
 *
 * 	var decodedMappings []*MappedPosition
 * 	var generatedMappings []*MappedPosition
 * 	sourceMappings := make(map[SourceIndex][]*SourceMappedPosition)
 *
 * 	// getDecodedMappings()
 * 	decoder := DecodeMappings(sourceMap.Mappings)
 * 	for mapping := range decoder.Values() {
 * 		// processMapping()
 * 		generatedPosition := -1
 * 		lineInfo := host.GetECMALineInfo(generatedAbsoluteFilePath)
 * 		if lineInfo != nil {
 * 			generatedPosition = scanner.ComputePositionOfLineAndUTF16Character(
 * 				lineInfo.lineStarts,
 * 				mapping.GeneratedLine,
 * 				mapping.GeneratedCharacter,
 * 				lineInfo.text,
 * 				true, /*allowEdits* /
 * 			)
 * 		}
 *
 * 		sourcePosition := -1
 * 		if mapping.IsSourceMapping() {
 * 			lineInfo := host.GetECMALineInfo(sourceFileAbsolutePaths[mapping.SourceIndex])
 * 			if lineInfo != nil {
 * 				pos := scanner.ComputePositionOfLineAndUTF16Character(
 * 					lineInfo.lineStarts,
 * 					mapping.SourceLine,
 * 					mapping.SourceCharacter,
 * 					lineInfo.text,
 * 					true, /*allowEdits* /
 * 				)
 * 				sourcePosition = pos
 * 			}
 * 		}
 *
 * 		decodedMappings = append(decodedMappings, &MappedPosition{
 * 			generatedPosition: generatedPosition,
 * 			sourceIndex:       mapping.SourceIndex,
 * 			sourcePosition:    sourcePosition,
 * 			nameIndex:         mapping.NameIndex,
 * 		})
 * 	}
 * 	if decoder.Error() != nil {
 * 		decodedMappings = nil
 * 	}
 *
 * 	// getSourceMappings()
 * 	for _, mapping := range decodedMappings {
 * 		if !mapping.isSourceMappedPosition() {
 * 			continue
 * 		}
 * 		sourceIndex := mapping.sourceIndex
 * 		list := sourceMappings[sourceIndex]
 * 		list = append(list, &SourceMappedPosition{
 * 			generatedPosition: mapping.generatedPosition,
 * 			sourceIndex:       sourceIndex,
 * 			sourcePosition:    mapping.sourcePosition,
 * 			nameIndex:         mapping.nameIndex,
 * 		})
 * 		sourceMappings[sourceIndex] = list
 * 	}
 * 	for i, list := range sourceMappings {
 * 		slices.SortFunc(list, func(a, b *SourceMappedPosition) int {
 * 			debug.Assert(a.sourceIndex == b.sourceIndex, "All source mappings should have the same source index")
 * 			return a.sourcePosition - b.sourcePosition
 * 		})
 * 		sourceMappings[i] = core.DeduplicateSorted(list, func(a, b *SourceMappedPosition) bool {
 * 			return a.generatedPosition == b.generatedPosition &&
 * 				a.sourceIndex == b.sourceIndex &&
 * 				a.sourcePosition == b.sourcePosition
 * 		})
 * 	}
 *
 * 	// getGeneratedMappings()
 * 	generatedMappings = decodedMappings
 * 	slices.SortFunc(generatedMappings, func(a, b *MappedPosition) int {
 * 		return a.generatedPosition - b.generatedPosition
 * 	})
 * 	generatedMappings = core.DeduplicateSorted(generatedMappings, func(a, b *MappedPosition) bool {
 * 		return a.generatedPosition == b.generatedPosition &&
 * 			a.sourceIndex == b.sourceIndex &&
 * 			a.sourcePosition == b.sourcePosition
 * 	})
 *
 * 	return &DocumentPositionMapper{
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 		sourceFileAbsolutePaths:   sourceFileAbsolutePaths,
 * 		sourceToSourceIndexMap:    sourceToSourceIndexMap,
 * 		generatedAbsoluteFilePath: generatedAbsoluteFilePath,
 * 		generatedMappings:         generatedMappings,
 * 		sourceMappings:            sourceMappings,
 * 	}
 * }
 */
export declare function createDocumentPositionMapper(host: Host, sourceMap: GoPtr<RawSourceMap>, mapPath: string): GoPtr<DocumentPositionMapper>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::type::DocumentPosition","kind":"type","status":"implemented","sigHash":"72d6aa15b60a245e4bf37bb7c3eb2704757e5db7c906cb277aff04ad44c598e5","bodyHash":"50d151d591632ea209d11a1010a40f51d0211eaa28ef3b16f49124c233e3ac2b"}
 *
 * Go source:
 * DocumentPosition struct {
 * 	FileName string
 * 	Pos      int
 * }
 */
export interface DocumentPosition {
    FileName: string;
    Pos: int;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::method::DocumentPositionMapper.GetSourcePosition","kind":"method","status":"implemented","sigHash":"a2edb4299755a31ef25d276639ee78066b3512a7d6e92c4d93e0cf90c12816cd","bodyHash":"2301c21feac19a78c37ab32366be3b9f5fe72a774f694a2e3433c49cabfa12c3"}
 *
 * Go source:
 * func (d *DocumentPositionMapper) GetSourcePosition(loc *DocumentPosition) *DocumentPosition {
 * 	if d == nil {
 * 		return nil
 * 	}
 * 	if len(d.generatedMappings) == 0 {
 * 		return nil
 * 	}
 *
 * 	targetIndex, _ := slices.BinarySearchFunc(d.generatedMappings, loc.Pos, func(m *MappedPosition, pos int) int {
 * 		return m.generatedPosition - pos
 * 	})
 *
 * 	if targetIndex < 0 || targetIndex >= len(d.generatedMappings) {
 * 		return nil
 * 	}
 *
 * 	mapping := d.generatedMappings[targetIndex]
 * 	if !mapping.isSourceMappedPosition() {
 * 		return nil
 * 	}
 *
 * 	// Closest position
 * 	return &DocumentPosition{
 * 		FileName: d.sourceFileAbsolutePaths[mapping.sourceIndex],
 * 		Pos:      mapping.sourcePosition,
 * 	}
 * }
 */
export declare function DocumentPositionMapper_GetSourcePosition(receiver: GoPtr<DocumentPositionMapper>, loc: GoPtr<DocumentPosition>): GoPtr<DocumentPosition>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::method::DocumentPositionMapper.GetGeneratedPosition","kind":"method","status":"implemented","sigHash":"12f70b52e1943fd1566ad4d411cd6325e6f58ec7c95a8833c624b8091bb57d3e","bodyHash":"39677053ead4d82685deff6630c2a28f58cc5b57853c01fd1b7cfd2d9b20d612"}
 *
 * Go source:
 * func (d *DocumentPositionMapper) GetGeneratedPosition(loc *DocumentPosition) *DocumentPosition {
 * 	if d == nil {
 * 		return nil
 * 	}
 * 	sourceIndex, ok := d.sourceToSourceIndexMap[tspath.GetCanonicalFileName(loc.FileName, d.useCaseSensitiveFileNames)]
 * 	if !ok {
 * 		return nil
 * 	}
 * 	if sourceIndex < 0 || int(sourceIndex) >= len(d.sourceMappings) {
 * 		return nil
 * 	}
 * 	sourceMappings := d.sourceMappings[sourceIndex]
 * 	targetIndex, _ := slices.BinarySearchFunc(sourceMappings, loc.Pos, func(m *SourceMappedPosition, pos int) int {
 * 		return m.sourcePosition - pos
 * 	})
 *
 * 	if targetIndex < 0 || targetIndex >= len(sourceMappings) {
 * 		return nil
 * 	}
 *
 * 	mapping := sourceMappings[targetIndex]
 * 	if mapping.sourceIndex != sourceIndex {
 * 		return nil
 * 	}
 *
 * 	// Closest position
 * 	return &DocumentPosition{
 * 		FileName: d.generatedAbsoluteFilePath,
 * 		Pos:      mapping.generatedPosition,
 * 	}
 * }
 */
export declare function DocumentPositionMapper_GetGeneratedPosition(receiver: GoPtr<DocumentPositionMapper>, loc: GoPtr<DocumentPosition>): GoPtr<DocumentPosition>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::GetDocumentPositionMapper","kind":"func","status":"implemented","sigHash":"a83374a7dcd8fe31c4879adfb4605af5d16023838ffcc5d782252d8f85624d75","bodyHash":"8e7920615216acea228452b2d9156529b77bab0a643da09062c71332b2a55f45"}
 *
 * Go source:
 * func GetDocumentPositionMapper(host Host, generatedFileName string) *DocumentPositionMapper {
 * 	mapFileName := tryGetSourceMappingURL(host, generatedFileName)
 * 	if mapFileName != "" {
 * 		if base64Object, matched := tryParseBase64Url(mapFileName); matched {
 * 			if base64Object != "" {
 * 				if decoded, err := base64.StdEncoding.DecodeString(base64Object); err == nil {
 * 					return convertDocumentToSourceMapper(host, string(decoded), generatedFileName)
 * 				}
 * 			}
 * 			// Not a data URL we can parse, skip it
 * 			mapFileName = ""
 * 		}
 * 	}
 *
 * 	var possibleMapLocations []string
 * 	if mapFileName != "" {
 * 		possibleMapLocations = append(possibleMapLocations, mapFileName)
 * 	}
 * 	possibleMapLocations = append(possibleMapLocations, generatedFileName+".map")
 * 	for _, location := range possibleMapLocations {
 * 		mapFileName := tspath.GetNormalizedAbsolutePath(location, tspath.GetDirectoryPath(generatedFileName))
 * 		if mapFileContents, ok := host.ReadFile(mapFileName); ok {
 * 			return convertDocumentToSourceMapper(host, mapFileContents, mapFileName)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function GetDocumentPositionMapper(host: Host, generatedFileName: string): GoPtr<DocumentPositionMapper>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::convertDocumentToSourceMapper","kind":"func","status":"implemented","sigHash":"e2228f77b8e746e1f19340626ef279437c66ff525e4a5224a3035ceb9a3357bb","bodyHash":"78c65eaebb0f2bb16f08f2939278a3d1bc1b148a76ef743a77bcac5571d1fada"}
 *
 * Go source:
 * func convertDocumentToSourceMapper(host Host, contents string, mapFileName string) *DocumentPositionMapper {
 * 	sourceMap := tryParseRawSourceMap(contents)
 * 	if sourceMap == nil || len(sourceMap.Sources) == 0 || sourceMap.File == "" || sourceMap.Mappings == "" {
 * 		// invalid map
 * 		return nil
 * 	}
 *
 * 	// Don't support source maps that contain inlined sources
 * 	if core.Some(sourceMap.SourcesContent, func(s *string) bool { return s != nil }) {
 * 		return nil
 * 	}
 *
 * 	return createDocumentPositionMapper(host, sourceMap, mapFileName)
 * }
 */
export declare function convertDocumentToSourceMapper(host: Host, contents: string, mapFileName: string): GoPtr<DocumentPositionMapper>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::tryParseRawSourceMap","kind":"func","status":"implemented","sigHash":"2c5011aad6978bf4b7d62b73da6e8ff1eaed6fcc32fe5c25b8c40759c34cf9ab","bodyHash":"0cf3bec4001635193685ad51e0234bedcc70d248db245d5e7d2ff630d1a6a83f"}
 *
 * Go source:
 * func tryParseRawSourceMap(contents string) *RawSourceMap {
 * 	sourceMap := &RawSourceMap{}
 * 	err := json.Unmarshal([]byte(contents), sourceMap)
 * 	if err != nil {
 * 		return nil
 * 	}
 * 	if sourceMap.Version != 3 {
 * 		return nil
 * 	}
 * 	return sourceMap
 * }
 */
export declare function tryParseRawSourceMap(contents: string): GoPtr<RawSourceMap>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::tryGetSourceMappingURL","kind":"func","status":"implemented","sigHash":"95c86edec2accb78fb8becae56fbdfe84d3b71de32920e052357e2a8eab8d3b5","bodyHash":"875b4c4de647aeec73abb26385500a2bfe32c3e4f869a29393f956124531b8f4"}
 *
 * Go source:
 * func tryGetSourceMappingURL(host Host, fileName string) string {
 * 	lineInfo := host.GetECMALineInfo(fileName)
 * 	return TryGetSourceMappingURL(lineInfo)
 * }
 */
export declare function tryGetSourceMappingURL(host: Host, fileName: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/sourcemap/source_mapper.go::func::tryParseBase64Url","kind":"func","status":"implemented","sigHash":"591897e461ea3547429946a75e6d2b9c92cc71539bbc9b1587aa4f12b0f1d9c7","bodyHash":"5088fcce9a6c3a6e87d44719810a92815ac021b5254f5a40377f009f7888d46e"}
 *
 * Go source:
 * func tryParseBase64Url(url string) (parseableUrl string, isBase64Url bool) {
 * 	var found bool
 * 	if url, found = strings.CutPrefix(url, `data:`); !found {
 * 		return "", false
 * 	}
 * 	if url, found = strings.CutPrefix(url, `application/json;`); !found {
 * 		return "", true
 * 	}
 * 	if url, found = strings.CutPrefix(url, `charset=`); found {
 * 		if !strings.EqualFold(url[:len(`utf-8;`)], `utf-8;`) {
 * 			return "", true
 * 		}
 * 		url = url[len(`utf-8;`):]
 * 	}
 * 	if url, found = strings.CutPrefix(url, `base64,`); !found {
 * 		return "", true
 * 	}
 * 	for _, r := range url {
 * 		if !(stringutil.IsASCIILetter(r) || stringutil.IsDigit(r) || r == '+' || r == '/' || r == '=') {
 * 			return "", true
 * 		}
 * 	}
 * 	return url, true
 * }
 */
export declare function tryParseBase64Url(url: string): [string, bool];
//# sourceMappingURL=source_mapper.d.ts.map