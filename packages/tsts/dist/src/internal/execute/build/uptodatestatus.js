/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::constGroup::upToDateStatusTypeConfigFileNotFound+upToDateStatusTypeBuildErrors+upToDateStatusTypeUpstreamErrors+upToDateStatusTypeUpToDate+upToDateStatusTypeUpToDateWithUpstreamTypes+upToDateStatusTypeUpToDateWithInputFileText+upToDateStatusTypeInputFileMissing+upToDateStatusTypeOutputMissing+upToDateStatusTypeInputFileNewer+upToDateStatusTypeOutOfDateBuildInfoWithPendingEmit+upToDateStatusTypeOutOfDateBuildInfoWithErrors+upToDateStatusTypeOutOfDateOptions+upToDateStatusTypeOutOfDateRoots+upToDateStatusTypeTsVersionOutputOfDate+upToDateStatusTypeForceBuild+upToDateStatusTypeSolution","kind":"constGroup","status":"implemented","sigHash":"c38712ce49a620ef2a6e931c9c457f65484f3f8041532fca014556ddb803a7ba","bodyHash":"2b1311e3c678423be300f6ac8f623793e700bddebd974d7d44a853831da1b261"}
 *
 * Go source:
 * const (
 * 	// Errors:
 *
 * 	// config file was not found
 * 	upToDateStatusTypeConfigFileNotFound upToDateStatusType = iota
 * 	// found errors during build
 * 	upToDateStatusTypeBuildErrors
 * 	// did not build because upstream project has errors - and we have option to stop build on upstream errors
 * 	upToDateStatusTypeUpstreamErrors
 *
 * 	// Its all good, no work to do
 * 	upToDateStatusTypeUpToDate
 *
 * 	// Pseudo-builds - touch timestamps, no actual build:
 *
 * 	// The project appears out of date because its upstream inputs are newer than its outputs,
 * 	// but all of its outputs are actually newer than the previous identical outputs of its (.d.ts) inputs.
 * 	// This means we can Pseudo-build (just touch timestamps), as if we had actually built this project.
 * 	upToDateStatusTypeUpToDateWithUpstreamTypes
 * 	// The project appears up to date and even though input file changed, its text didnt so just need to update timestamps
 * 	upToDateStatusTypeUpToDateWithInputFileText
 *
 * 	// Needs build:
 *
 * 	// input file is missing
 * 	upToDateStatusTypeInputFileMissing
 * 	// output file is missing
 * 	upToDateStatusTypeOutputMissing
 * 	// input file is newer than output file
 * 	upToDateStatusTypeInputFileNewer
 * 	// build info is out of date as we need to emit some files
 * 	upToDateStatusTypeOutOfDateBuildInfoWithPendingEmit
 * 	// build info indicates that project has errors and they need to be reported
 * 	upToDateStatusTypeOutOfDateBuildInfoWithErrors
 * 	// build info options indicate there is work to do based on changes in options
 * 	upToDateStatusTypeOutOfDateOptions
 * 	// file was root when built but not any more
 * 	upToDateStatusTypeOutOfDateRoots
 * 	// buildInfo.version mismatch with current ts version
 * 	upToDateStatusTypeTsVersionOutputOfDate
 * 	// build because --force was specified
 * 	upToDateStatusTypeForceBuild
 *
 * 	// solution file
 * 	upToDateStatusTypeSolution
 * )
 */
export const upToDateStatusTypeConfigFileNotFound = 0;
export const upToDateStatusTypeBuildErrors = 1;
export const upToDateStatusTypeUpstreamErrors = 2;
export const upToDateStatusTypeUpToDate = 3;
export const upToDateStatusTypeUpToDateWithUpstreamTypes = 4;
export const upToDateStatusTypeUpToDateWithInputFileText = 5;
export const upToDateStatusTypeInputFileMissing = 6;
export const upToDateStatusTypeOutputMissing = 7;
export const upToDateStatusTypeInputFileNewer = 8;
export const upToDateStatusTypeOutOfDateBuildInfoWithPendingEmit = 9;
export const upToDateStatusTypeOutOfDateBuildInfoWithErrors = 10;
export const upToDateStatusTypeOutOfDateOptions = 11;
export const upToDateStatusTypeOutOfDateRoots = 12;
export const upToDateStatusTypeTsVersionOutputOfDate = 13;
export const upToDateStatusTypeForceBuild = 14;
export const upToDateStatusTypeSolution = 15;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.isError","kind":"method","status":"implemented","sigHash":"a179f791a9a811200bd6a8d814e3b3a53c710126dd17f1680eaab1a13bc366b1","bodyHash":"135d1a8ae681ecb810e057c32cc5933332a484e485dda8fd4bbb4bb879b09850"}
 *
 * Go source:
 * func (s *upToDateStatus) isError() bool {
 * 	switch s.kind {
 * 	case upToDateStatusTypeConfigFileNotFound,
 * 		upToDateStatusTypeBuildErrors,
 * 		upToDateStatusTypeUpstreamErrors:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function upToDateStatus_isError(receiver) {
    switch (receiver.kind) {
        case upToDateStatusTypeConfigFileNotFound:
        case upToDateStatusTypeBuildErrors:
        case upToDateStatusTypeUpstreamErrors:
            return true;
        default:
            return false;
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.isPseudoBuild","kind":"method","status":"implemented","sigHash":"0d8f1726c3fb1319366e743b9f543067d6a3626c35277abc8d516756259dafc9","bodyHash":"57b82f566e1b8d823c4f72881f5fe914fa21dfdfd276afb229723174abd4d163"}
 *
 * Go source:
 * func (s *upToDateStatus) isPseudoBuild() bool {
 * 	switch s.kind {
 * 	case upToDateStatusTypeUpToDateWithUpstreamTypes,
 * 		upToDateStatusTypeUpToDateWithInputFileText:
 * 		return true
 * 	default:
 * 		return false
 * 	}
 * }
 */
export function upToDateStatus_isPseudoBuild(receiver) {
    switch (receiver.kind) {
        case upToDateStatusTypeUpToDateWithUpstreamTypes:
        case upToDateStatusTypeUpToDateWithInputFileText:
            return true;
        default:
            return false;
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.inputOutputFileAndTime","kind":"method","status":"implemented","sigHash":"5de7a0b0501000ee62631a778edc319cc7c98e8b4f89df1575aec6ccb38c3f2f","bodyHash":"5537b94a97223f17a6ddd701d0d17a2a29385ce031d1f2f2486a0e16c35bc0bc"}
 *
 * Go source:
 * func (s *upToDateStatus) inputOutputFileAndTime() *inputOutputFileAndTime {
 * 	data, ok := s.data.(*inputOutputFileAndTime)
 * 	if !ok {
 * 		return nil
 * 	}
 * 	return data
 * }
 */
export function upToDateStatus_inputOutputFileAndTime(receiver) {
    const data = receiver.data;
    if (data === undefined || data === null || typeof data !== "object" || !("input" in data && "output" in data && "buildInfo" in data)) {
        return undefined;
    }
    return data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.inputOutputName","kind":"method","status":"implemented","sigHash":"327e8e770b9f91406681d66bb9c7ed62b5a94ae2aebac650e0469fd806f3dbcb","bodyHash":"2596c0ea3ef1e433fd9a88564b0738d6fa7942f9e862f9cb37987b15363e3270"}
 *
 * Go source:
 * func (s *upToDateStatus) inputOutputName() *inputOutputName {
 * 	data, ok := s.data.(*inputOutputName)
 * 	if !ok {
 * 		return nil
 * 	}
 * 	return data
 * }
 */
export function upToDateStatus_inputOutputName(receiver) {
    const data = receiver.data;
    if (data === undefined || data === null || typeof data !== "object" || !("input" in data && "output" in data) || "buildInfo" in data) {
        return undefined;
    }
    return data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.oldestOutputFileName","kind":"method","status":"implemented","sigHash":"3a3691fc1607c320043d04cc9a0ca79265ac2f28488e108901b3428ad48e9e91","bodyHash":"bcc37ae40f3c2bc9cb4d80ee5d7119591512d7bde5574bf974a8d2aebcd9a00b"}
 *
 * Go source:
 * func (s *upToDateStatus) oldestOutputFileName() string {
 * 	if !s.isPseudoBuild() && s.kind != upToDateStatusTypeUpToDate {
 * 		panic("only valid for up to date status of pseudo-build or up to date")
 * 	}
 *
 * 	if inputOutputFileAndTime := s.inputOutputFileAndTime(); inputOutputFileAndTime != nil {
 * 		return inputOutputFileAndTime.output.file
 * 	}
 * 	if inputOutputName := s.inputOutputName(); inputOutputName != nil {
 * 		return inputOutputName.output
 * 	}
 * 	return s.data.(string)
 * }
 */
export function upToDateStatus_oldestOutputFileName(receiver) {
    if (!upToDateStatus_isPseudoBuild(receiver) && receiver.kind !== upToDateStatusTypeUpToDate) {
        throw new globalThis.Error("only valid for up to date status of pseudo-build or up to date");
    }
    const ioFileAndTime = upToDateStatus_inputOutputFileAndTime(receiver);
    if (ioFileAndTime !== undefined) {
        return ioFileAndTime.output.file;
    }
    const ioName = upToDateStatus_inputOutputName(receiver);
    if (ioName !== undefined) {
        return ioName.output;
    }
    return receiver.data;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/uptodatestatus.go::method::upToDateStatus.upstreamErrors","kind":"method","status":"implemented","sigHash":"a2c1b2e8a3554bef17898fddeb0d2fb9784934ea00a8425491519252c74a0ff1","bodyHash":"581a5b93483e0c9cfe2b94f719a9a7e0f9fbc94abdcd331fccafe2ba2dda4c05"}
 *
 * Go source:
 * func (s *upToDateStatus) upstreamErrors() *upstreamErrors {
 * 	return s.data.(*upstreamErrors)
 * }
 */
export function upToDateStatus_upstreamErrors(receiver) {
    return receiver.data;
}
//# sourceMappingURL=uptodatestatus.js.map