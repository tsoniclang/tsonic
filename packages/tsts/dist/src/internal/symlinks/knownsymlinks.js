import { Map } from "../../go/sync.js";
import * as strings from "../../go/strings.js";
import { SyncMap_Load, SyncMap_LoadOrStore, SyncMap_Store } from "../collections/syncmap.js";
import { SyncSet_Add } from "../collections/syncset.js";
import { ContainsIgnoredPath, } from "../tspath/ignoredpaths.js";
import { EnsureTrailingDirectorySeparator, GetCanonicalFileName, GetNormalizedAbsolutePath, GetPathComponents, GetPathFromPathComponents, ToPath, } from "../tspath/path.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.HasDirectory","kind":"method","status":"implemented","sigHash":"57c213c92dab05e700d6d1dcc6fd8ee5d96a3a20c30181f79afdb950f4ab18ae","bodyHash":"6557252177dcdda29628a6dbbeb88d9ece7a23eb09e74d994d3f2b2be0fdea6a"}
 *
 * Go source:
 * func (cache *KnownSymlinks) HasDirectory(symlinkPath tspath.Path) bool {
 * 	_, ok := cache.directories.Load(symlinkPath.EnsureTrailingDirectorySeparator())
 * 	return ok
 * }
 */
export function KnownSymlinks_HasDirectory(receiver, symlinkPath) {
    const [, ok] = SyncMap_Load(receiver.directories, EnsureTrailingDirectorySeparator(symlinkPath));
    return ok;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.Directories","kind":"method","status":"implemented","sigHash":"c5828b7dd0bad8cbc5fd38d12103aec1285dae9d5aef742c22b6b2d53a90e9bb","bodyHash":"f53525a9cdf0a41097aa8c48cd84da6a600212cc3b82174b3b9b385297898d14"}
 *
 * Go source:
 * func (cache *KnownSymlinks) Directories() *collections.SyncMap[tspath.Path, *KnownDirectoryLink] {
 * 	return &cache.directories
 * }
 */
export function KnownSymlinks_Directories(receiver) {
    return receiver.directories;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.DirectoriesByRealpath","kind":"method","status":"implemented","sigHash":"44569f4c74eb3ba6282dd0546c619ca43e3a4e04a518217cc0d76ec2aac53be3","bodyHash":"ecb25c728fe58248d329e11196ca33f74664be2b45323e3d721138cd3eb18851"}
 *
 * Go source:
 * func (cache *KnownSymlinks) DirectoriesByRealpath() *collections.SyncMap[tspath.Path, *collections.SyncSet[string]] {
 * 	return &cache.directoriesByRealpath
 * }
 */
export function KnownSymlinks_DirectoriesByRealpath(receiver) {
    return receiver.directoriesByRealpath;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.Files","kind":"method","status":"implemented","sigHash":"45f66d6d541c210fb1c40f4c6964557abcf66051a8868b320e18b032ad417346","bodyHash":"614263e6a63a9a49ec661505dc0ccc34af5d22f4e45359d3460912f872a55421"}
 *
 * Go source:
 * func (cache *KnownSymlinks) Files() *collections.SyncMap[tspath.Path, string] {
 * 	return &cache.files
 * }
 */
export function KnownSymlinks_Files(receiver) {
    return receiver.files;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.FilesByRealpath","kind":"method","status":"implemented","sigHash":"ada2043b9ee6ced36e4849849da4613136759e2d5e6a618a1d0485ac921d0581","bodyHash":"8e41a3d19c6819df8eed5e11e184c436ad605639b065fc3439cfdb7d5fa3c453"}
 *
 * Go source:
 * func (cache *KnownSymlinks) FilesByRealpath() *collections.SyncMap[tspath.Path, *collections.SyncSet[string]] {
 * 	return &cache.filesByRealpath
 * }
 */
export function KnownSymlinks_FilesByRealpath(receiver) {
    return receiver.filesByRealpath;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.SetDirectory","kind":"method","status":"implemented","sigHash":"fa874e8ca2f7e0f0f1e0fef292fbd851209730042418e91ddb63b596e1772fb8","bodyHash":"01cec043a829cc447f5d97b303271a953621c1cd3ca25723a10ac039a5b0b777"}
 *
 * Go source:
 * func (cache *KnownSymlinks) SetDirectory(symlink string, symlinkPath tspath.Path, realDirectory *KnownDirectoryLink) {
 * 	if realDirectory != nil {
 * 		if _, ok := cache.directories.Load(symlinkPath); !ok {
 * 			set, _ := cache.directoriesByRealpath.LoadOrStore(realDirectory.RealPath, &collections.SyncSet[string]{})
 * 			set.Add(symlink)
 * 		}
 * 	}
 * 	cache.directories.Store(symlinkPath, realDirectory)
 * }
 */
export function KnownSymlinks_SetDirectory(receiver, symlink, symlinkPath, realDirectory) {
    if (realDirectory !== undefined) {
        const [, ok] = SyncMap_Load(receiver.directories, symlinkPath);
        if (!ok) {
            const newSet = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() } };
            const [set] = SyncMap_LoadOrStore(receiver.directoriesByRealpath, realDirectory.RealPath, newSet);
            SyncSet_Add(set, symlink);
        }
    }
    SyncMap_Store(receiver.directories, symlinkPath, realDirectory);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.SetFile","kind":"method","status":"implemented","sigHash":"8764f673095679be97c463b2fade52e8b38dd31c80dcb03c920949cc9a774f6b","bodyHash":"a7bcad20254a5758169e0167e1118bd72d0991accc29616edab766c39ef38f9e"}
 *
 * Go source:
 * func (cache *KnownSymlinks) SetFile(symlink string, symlinkPath tspath.Path, realpath string) {
 * 	if _, ok := cache.files.Load(symlinkPath); !ok {
 * 		realpathPath := tspath.ToPath(realpath, cache.cwd, cache.useCaseSensitiveFileNames)
 * 		set, _ := cache.filesByRealpath.LoadOrStore(realpathPath, &collections.SyncSet[string]{})
 * 		set.Add(symlink)
 * 	}
 * 	cache.files.Store(symlinkPath, realpath)
 * }
 */
export function KnownSymlinks_SetFile(receiver, symlink, symlinkPath, realpath) {
    const [, ok] = SyncMap_Load(receiver.files, symlinkPath);
    if (!ok) {
        const realpathPath = ToPath(realpath, receiver.cwd, receiver.useCaseSensitiveFileNames);
        const newSet = { m: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() } };
        const [set] = SyncMap_LoadOrStore(receiver.filesByRealpath, realpathPath, newSet);
        SyncSet_Add(set, symlink);
    }
    SyncMap_Store(receiver.files, symlinkPath, realpath);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::func::NewKnownSymlink","kind":"func","status":"implemented","sigHash":"9d5189b9875d687ad89478c43dcc27b3f1c77f85fcf6556bb1e867d319e66bc2","bodyHash":"28dd26d69e1d9e1df6bd45fd576745f2c86e19618bb07058b2f42c7f18eb708e"}
 *
 * Go source:
 * func NewKnownSymlink(currentDirectory string, useCaseSensitiveFileNames bool) *KnownSymlinks {
 * 	return &KnownSymlinks{
 * 		cwd:                       currentDirectory,
 * 		useCaseSensitiveFileNames: useCaseSensitiveFileNames,
 * 	}
 * }
 */
export function NewKnownSymlink(currentDirectory, useCaseSensitiveFileNames) {
    return {
        directories: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() },
        directoriesByRealpath: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() },
        files: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() },
        filesByRealpath: { __tsgoBlank0: [], __tsgoBlank1: [], m: new Map() },
        cwd: currentDirectory,
        useCaseSensitiveFileNames: useCaseSensitiveFileNames,
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.SetSymlinksFromResolutions","kind":"method","status":"implemented","sigHash":"0cf9d0ac5de20250019205c0c98b1a2c08f2a1b784c93d194d8e6b898787d28d","bodyHash":"43e0c999c616461a207709bf221769daf9faf1cd69b0fcf42a01d49157364280"}
 *
 * Go source:
 * func (cache *KnownSymlinks) SetSymlinksFromResolutions(
 * 	forEachResolvedModule func(callback func(resolution *module.ResolvedModule, moduleName string, mode core.ResolutionMode, filePath tspath.Path), file *ast.SourceFile),
 * 	forEachResolvedTypeReferenceDirective func(callback func(resolution *module.ResolvedTypeReferenceDirective, moduleName string, mode core.ResolutionMode, filePath tspath.Path), file *ast.SourceFile),
 * ) {
 * 	forEachResolvedModule(func(resolution *module.ResolvedModule, moduleName string, mode core.ResolutionMode, filePath tspath.Path) {
 * 		cache.ProcessResolution(resolution.OriginalPath, resolution.ResolvedFileName)
 * 	}, nil)
 * 	forEachResolvedTypeReferenceDirective(func(resolution *module.ResolvedTypeReferenceDirective, moduleName string, mode core.ResolutionMode, filePath tspath.Path) {
 * 		cache.ProcessResolution(resolution.OriginalPath, resolution.ResolvedFileName)
 * 	}, nil)
 * }
 */
export function KnownSymlinks_SetSymlinksFromResolutions(receiver, forEachResolvedModule, forEachResolvedTypeReferenceDirective) {
    forEachResolvedModule((resolution, _moduleName, _mode, _filePath) => {
        KnownSymlinks_ProcessResolution(receiver, resolution.OriginalPath, resolution.ResolvedFileName);
    }, undefined);
    forEachResolvedTypeReferenceDirective((resolution, _moduleName, _mode, _filePath) => {
        KnownSymlinks_ProcessResolution(receiver, resolution.OriginalPath, resolution.ResolvedFileName);
    }, undefined);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.ProcessResolution","kind":"method","status":"implemented","sigHash":"b3699e7843cd6fe0b24fc4755c054b66c23ab6c2360c5205a8d2d42ffff826a2","bodyHash":"92a48b9f2b54a585a9fb09ce062efb9105400c20d56b22316f06837b3bf7adca"}
 *
 * Go source:
 * func (cache *KnownSymlinks) ProcessResolution(originalPath string, resolvedFileName string) {
 * 	if originalPath == "" || resolvedFileName == "" {
 * 		return
 * 	}
 * 	cache.SetFile(originalPath, tspath.ToPath(originalPath, cache.cwd, cache.useCaseSensitiveFileNames), resolvedFileName)
 * 	commonResolved, commonOriginal := cache.guessDirectorySymlink(resolvedFileName, originalPath, cache.cwd)
 * 	if commonResolved != "" && commonOriginal != "" {
 * 		symlinkPath := tspath.ToPath(commonOriginal, cache.cwd, cache.useCaseSensitiveFileNames)
 * 		if !tspath.ContainsIgnoredPath(string(symlinkPath)) {
 * 			cache.SetDirectory(
 * 				commonOriginal,
 * 				symlinkPath.EnsureTrailingDirectorySeparator(),
 * 				&KnownDirectoryLink{
 * 					Real:     tspath.EnsureTrailingDirectorySeparator(commonResolved),
 * 					RealPath: tspath.ToPath(commonResolved, cache.cwd, cache.useCaseSensitiveFileNames).EnsureTrailingDirectorySeparator(),
 * 				},
 * 			)
 * 		}
 * 	}
 * }
 */
export function KnownSymlinks_ProcessResolution(receiver, originalPath, resolvedFileName) {
    if (originalPath === "" || resolvedFileName === "") {
        return;
    }
    KnownSymlinks_SetFile(receiver, originalPath, ToPath(originalPath, receiver.cwd, receiver.useCaseSensitiveFileNames), resolvedFileName);
    const [commonResolved, commonOriginal] = KnownSymlinks_guessDirectorySymlink(receiver, resolvedFileName, originalPath, receiver.cwd);
    if (commonResolved !== "" && commonOriginal !== "") {
        const symlinkPath = ToPath(commonOriginal, receiver.cwd, receiver.useCaseSensitiveFileNames);
        if (!ContainsIgnoredPath(symlinkPath)) {
            KnownSymlinks_SetDirectory(receiver, commonOriginal, EnsureTrailingDirectorySeparator(symlinkPath), {
                Real: EnsureTrailingDirectorySeparator(commonResolved),
                RealPath: EnsureTrailingDirectorySeparator(ToPath(commonResolved, receiver.cwd, receiver.useCaseSensitiveFileNames)),
            });
        }
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.guessDirectorySymlink","kind":"method","status":"implemented","sigHash":"dc215e3149e8096e8d3847a92f18d88ec8b8f401126054b6354c52a5387bcacf","bodyHash":"308e2bb436585c00f714845ea228e80d0d2a8854942ec79cafa953652eb6dce3"}
 *
 * Go source:
 * func (cache *KnownSymlinks) guessDirectorySymlink(a string, b string, cwd string) (string, string) {
 * 	aParts := tspath.GetPathComponents(tspath.GetNormalizedAbsolutePath(a, cwd), "")
 * 	bParts := tspath.GetPathComponents(tspath.GetNormalizedAbsolutePath(b, cwd), "")
 * 	isDirectory := false
 * 	for len(aParts) >= 2 && len(bParts) >= 2 &&
 * 		!cache.isNodeModulesOrScopedPackageDirectory(aParts[len(aParts)-2]) &&
 * 		!cache.isNodeModulesOrScopedPackageDirectory(bParts[len(bParts)-2]) &&
 * 		tspath.GetCanonicalFileName(aParts[len(aParts)-1], cache.useCaseSensitiveFileNames) == tspath.GetCanonicalFileName(bParts[len(bParts)-1], cache.useCaseSensitiveFileNames) {
 * 		aParts = aParts[:len(aParts)-1]
 * 		bParts = bParts[:len(bParts)-1]
 * 		isDirectory = true
 * 	}
 * 	if isDirectory {
 * 		return tspath.GetPathFromPathComponents(aParts), tspath.GetPathFromPathComponents(bParts)
 * 	}
 * 	return "", ""
 * }
 */
export function KnownSymlinks_guessDirectorySymlink(receiver, a, b, cwd) {
    const canStrip = (ap, bp) => ap.length >= 2 &&
        bp.length >= 2 &&
        !KnownSymlinks_isNodeModulesOrScopedPackageDirectory(receiver, ap[ap.length - 2]) &&
        !KnownSymlinks_isNodeModulesOrScopedPackageDirectory(receiver, bp[bp.length - 2]) &&
        GetCanonicalFileName(ap[ap.length - 1], receiver.useCaseSensitiveFileNames) === GetCanonicalFileName(bp[bp.length - 1], receiver.useCaseSensitiveFileNames);
    let finalA = GetPathComponents(GetNormalizedAbsolutePath(a, cwd), "");
    let finalB = GetPathComponents(GetNormalizedAbsolutePath(b, cwd), "");
    let isDirectory = false;
    while (canStrip(finalA, finalB)) {
        finalA = finalA.slice(0, -1);
        finalB = finalB.slice(0, -1);
        isDirectory = true;
    }
    if (!isDirectory) {
        return ["", ""];
    }
    return [GetPathFromPathComponents(finalA), GetPathFromPathComponents(finalB)];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/symlinks/knownsymlinks.go::method::KnownSymlinks.isNodeModulesOrScopedPackageDirectory","kind":"method","status":"implemented","sigHash":"0ac362b40a88fcb6666029d6e67b0a5b1495b43ca54492baa0342906598f5e69","bodyHash":"00cfc03d2f58325a3a7b5efd1cc86460973cb3eb25c6d127aa50a11fa6f3a1d0"}
 *
 * Go source:
 * func (cache *KnownSymlinks) isNodeModulesOrScopedPackageDirectory(s string) bool {
 * 	return s != "" && (tspath.GetCanonicalFileName(s, cache.useCaseSensitiveFileNames) == "node_modules" || strings.HasPrefix(s, "@"))
 * }
 */
export function KnownSymlinks_isNodeModulesOrScopedPackageDirectory(receiver, s) {
    return s !== "" && (GetCanonicalFileName(s, receiver.useCaseSensitiveFileNames) === "node_modules" || strings.HasPrefix(s, "@"));
}
//# sourceMappingURL=knownsymlinks.js.map