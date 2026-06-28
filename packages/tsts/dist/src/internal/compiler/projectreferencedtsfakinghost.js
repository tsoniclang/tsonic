import { Map as sync_Map } from "../../go/sync.js";
import * as strings from "../../go/strings.js";
import { IfElse } from "../core/core.js";
import { TSTrue, TSFalse, TSUnknown } from "../core/tristate.js";
import { KnownSymlinks_Directories, KnownSymlinks_Files, KnownSymlinks_SetDirectory, KnownSymlinks_SetFile } from "../symlinks/knownsymlinks.js";
import { SyncMap_Load, SyncMap_Range, SyncMap_Size } from "../collections/syncmap.js";
import { ContainsIgnoredPath, } from "../tspath/ignoredpaths.js";
import { EnsureTrailingDirectorySeparator, GetNormalizedAbsolutePath, ToPath, } from "../tspath/path.js";
import { IsDeclarationFileName } from "../tspath/extension.js";
import { From as cachedvfs_From, FS_as_vfs_FS as cachedvfsAsVfsFS } from "../vfs/cachedvfs/cachedvfs.js";
import { projectReferenceFileMapper_getProjectReferenceFromOutputDts, } from "./projectreferencefilemapper.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"1cef503f05dfcffb796e2ef6587f72aba4cfd076455a452610e42da898746249"}
 *
 * Go source:
 * var _ module.ResolutionHost = (*projectReferenceDtsFakingHost)(nil)
 */
export let __1046bc8a_0 = projectReferenceDtsFakingHost_as_module_ResolutionHost(undefined);
export function projectReferenceDtsFakingHost_as_module_ResolutionHost(receiver) {
    return {
        FS: () => projectReferenceDtsFakingHost_FS(receiver),
        GetCurrentDirectory: () => projectReferenceDtsFakingHost_GetCurrentDirectory(receiver),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::func::newProjectReferenceDtsFakingHost","kind":"func","status":"implemented","sigHash":"4729644a2e27a6113e16ed92d375b4bb743e69147d5a180f71446f8e22512ce6","bodyHash":"fb845c84f6f3d6b6531115a99968c587b1da976c9f7b028ac071d6bc23ef7c60"}
 *
 * Go source:
 * func newProjectReferenceDtsFakingHost(loader *fileLoader) module.ResolutionHost {
 * 	// Create a new host that will fake the dts files
 * 	host := &projectReferenceDtsFakingHost{
 * 		host: loader.opts.Host,
 * 		fs: cachedvfs.From(&projectReferenceDtsFakingVfs{
 * 			projectReferenceFileMapper: loader.projectReferenceFileMapper,
 * 			dtsDirectories:             loader.dtsDirectories,
 * 			knownSymlinks:              symlinks.KnownSymlinks{},
 * 		}),
 * 	}
 * 	return host
 * }
 */
export function newProjectReferenceDtsFakingHost(loader) {
    const vfsObj = {
        projectReferenceFileMapper: loader.projectReferenceFileMapper,
        dtsDirectories: loader.dtsDirectories,
        knownSymlinks: {
            directories: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() },
            directoriesByRealpath: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() },
            files: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() },
            filesByRealpath: { __tsgoBlank0: [], __tsgoBlank1: [], m: new sync_Map() },
            cwd: "",
            useCaseSensitiveFileNames: false,
        },
    };
    const host = {
        host: loader.opts.Host,
        fs: cachedvfs_From(projectReferenceDtsFakingVfs_as_vfs_FS(vfsObj)),
    };
    return projectReferenceDtsFakingHost_as_module_ResolutionHost(host);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingHost.FS","kind":"method","status":"implemented","sigHash":"0a19f206431dabeed665e48b50af6e35976d660ca595c7857208bfbace4be30a","bodyHash":"f9a74a07bdea00d4c9cf09d56a61400e86592e5985ea4a3c2fb567886ccdbff7"}
 *
 * Go source:
 * func (h *projectReferenceDtsFakingHost) FS() vfs.FS {
 * 	return h.fs
 * }
 */
export function projectReferenceDtsFakingHost_FS(receiver) {
    return cachedvfsAsVfsFS(receiver.fs);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingHost.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"d840f402b061850b65ae141431dd3121adb67b4182f1f4c6eee0d9d2d086845c","bodyHash":"b80ed5cf1fab63dbf418ba0f7a33b9c14ee33d2fd734ce5b03486fb6853305f6"}
 *
 * Go source:
 * func (h *projectReferenceDtsFakingHost) GetCurrentDirectory() string {
 * 	return h.host.GetCurrentDirectory()
 * }
 */
export function projectReferenceDtsFakingHost_GetCurrentDirectory(receiver) {
    return receiver.host.GetCurrentDirectory();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::varGroup::_::#2","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"ec4db191ffd6c018fdababeedd9f0a8b4d994ae42c3cfb70fc410966dfd0d21b"}
 *
 * Go source:
 * var _ vfs.FS = (*projectReferenceDtsFakingVfs)(nil)
 */
export let __fca3b3b1_0 = projectReferenceDtsFakingVfs_as_vfs_FS(undefined);
export function projectReferenceDtsFakingVfs_as_vfs_FS(receiver) {
    return {
        UseCaseSensitiveFileNames: () => projectReferenceDtsFakingVfs_UseCaseSensitiveFileNames(receiver),
        FileExists: (path) => projectReferenceDtsFakingVfs_FileExists(receiver, path),
        ReadFile: (path) => projectReferenceDtsFakingVfs_ReadFile(receiver, path),
        WriteFile: (path, data) => projectReferenceDtsFakingVfs_WriteFile(receiver, path, data),
        AppendFile: (path, data) => projectReferenceDtsFakingVfs_AppendFile(receiver, path, data),
        Remove: (path) => projectReferenceDtsFakingVfs_Remove(receiver, path),
        Chtimes: (path, aTime, mTime) => projectReferenceDtsFakingVfs_Chtimes(receiver, path, aTime, mTime),
        DirectoryExists: (path) => projectReferenceDtsFakingVfs_DirectoryExists(receiver, path),
        GetAccessibleEntries: (path) => projectReferenceDtsFakingVfs_GetAccessibleEntries(receiver, path),
        Stat: (path) => projectReferenceDtsFakingVfs_Stat(receiver, path),
        WalkDir: (root, walkFn) => projectReferenceDtsFakingVfs_WalkDir(receiver, root, walkFn),
        Realpath: (path) => projectReferenceDtsFakingVfs_Realpath(receiver, path),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"8af5ab81dae25f2eef6026113bd0204057925d04b33c1ae5c645d486b6933456","bodyHash":"ca477bdeb90ea815faee2d7587e38d1246933170e6ece26398781eebdf7606f4"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) UseCaseSensitiveFileNames() bool {
 * 	return fs.projectReferenceFileMapper.opts.Host.FS().UseCaseSensitiveFileNames()
 * }
 */
export function projectReferenceDtsFakingVfs_UseCaseSensitiveFileNames(receiver) {
    return receiver.projectReferenceFileMapper.opts.Host.FS().UseCaseSensitiveFileNames();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.FileExists","kind":"method","status":"implemented","sigHash":"dd85faa29af68fca5ddc21c11a07b033a2df11b212db731abf9bf6f0251c5a96","bodyHash":"2c32074c469dc1923264a7d1340dad245256348a5a3d5f04a70783dfc276960a"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) FileExists(path string) bool {
 * 	if fs.projectReferenceFileMapper.opts.Host.FS().FileExists(path) {
 * 		return true
 * 	}
 * 	if !tspath.IsDeclarationFileName(path) {
 * 		return false
 * 	}
 * 	// Project references go to source file instead of .d.ts file
 * 	return fs.fileOrDirectoryExistsUsingSource(path /*isFile* /, true)
 * }
 */
export function projectReferenceDtsFakingVfs_FileExists(receiver, path) {
    if (receiver.projectReferenceFileMapper.opts.Host.FS().FileExists(path)) {
        return true;
    }
    if (!IsDeclarationFileName(path)) {
        return false;
    }
    // Project references go to source file instead of .d.ts file
    return projectReferenceDtsFakingVfs_fileOrDirectoryExistsUsingSource(receiver, path, true);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.ReadFile","kind":"method","status":"implemented","sigHash":"5cd4a0451ceaefd606cbb2432d4671cd1123a6bc7b43b476da2a7740798a24e0","bodyHash":"53cebd89d8c625918c2279cef8ba0e4d152559111ceb753c58828ed149ea3608"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) ReadFile(path string) (contents string, ok bool) {
 * 	// Dont need to override as we cannot mimick read file
 * 	return fs.projectReferenceFileMapper.opts.Host.FS().ReadFile(path)
 * }
 */
export function projectReferenceDtsFakingVfs_ReadFile(receiver, path) {
    // Dont need to override as we cannot mimick read file
    return receiver.projectReferenceFileMapper.opts.Host.FS().ReadFile(path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.WriteFile","kind":"method","status":"implemented","sigHash":"750904321c8162e6acd92661bf01a4cd28d16ca1108e083eb63ed8bbd22f1391","bodyHash":"436fb58a1b389e46e3ac2260944639febf957b342770bf7ec4f1ad0472a6e691"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) WriteFile(path string, data string) error {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_WriteFile(receiver, path, data) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.AppendFile","kind":"method","status":"implemented","sigHash":"f71e26bbe11a85cedca4875f3e07a36eff3afac9f5c9d69d0097287a23df271a","bodyHash":"f5e4c3da0590ef965b04cf6eb0928503e0a2b79965c25cd662670932501d1645"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) AppendFile(path string, data string) error {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_AppendFile(receiver, path, data) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.Remove","kind":"method","status":"implemented","sigHash":"7657dc77aa5833b25969b54da649af55cf2267754bb264e2e090dfda2b745e95","bodyHash":"690e2b328837995e1eb983f66ff2557cfd96eb151d2b8c78cc9b9184e911b721"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) Remove(path string) error {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_Remove(receiver, path) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.Chtimes","kind":"method","status":"implemented","sigHash":"a1452aa883021503e0d82e4e62c838d362214da9224e1ebedcfca752b5ff04fa","bodyHash":"1a2cf522104f40641870aceb62d90880f980271553ca8601e54e795f14d8397e"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_Chtimes(receiver, path, aTime, mTime) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.DirectoryExists","kind":"method","status":"implemented","sigHash":"264b608deae4a4e80d06de2e22c549a43cf87acd606b0509af36aa15e46b911c","bodyHash":"878f4bbd320307a3f79edb10900a53b16aaf6ae8ce7e33c4f009d5886823b6da"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) DirectoryExists(path string) bool {
 * 	if fs.projectReferenceFileMapper.opts.Host.FS().DirectoryExists(path) {
 * 		fs.handleDirectoryCouldBeSymlink(path)
 * 		return true
 * 	}
 * 	return fs.fileOrDirectoryExistsUsingSource(path /*isFile* /, false)
 * }
 */
export function projectReferenceDtsFakingVfs_DirectoryExists(receiver, path) {
    if (receiver.projectReferenceFileMapper.opts.Host.FS().DirectoryExists(path)) {
        projectReferenceDtsFakingVfs_handleDirectoryCouldBeSymlink(receiver, path);
        return true;
    }
    return projectReferenceDtsFakingVfs_fileOrDirectoryExistsUsingSource(receiver, path, false);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"f196a731dd4203c982755968e7a27fa72b847c534095403def64a7ebd2cfa8f8","bodyHash":"82b45572cb6839a7865636e6c781192c3274d25bbda55121b639546d95c21cba"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) GetAccessibleEntries(path string) vfs.Entries {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_GetAccessibleEntries(receiver, path) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.Stat","kind":"method","status":"implemented","sigHash":"f930f0d78fee817b6c00120721634c280d595206a11c63708f4175c74ae9ae34","bodyHash":"80ae5f19b1d4f340ec5292aae1cc17439db8eb6d5324811764b588eba21ff1cf"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) Stat(path string) vfs.FileInfo {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_Stat(receiver, path) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.WalkDir","kind":"method","status":"implemented","sigHash":"024439ce5ae380ece225e7c5b5ca167ff4257409a82f5e56a82baf136d5f5033","bodyHash":"a6567fc32ce90ad582abba529fef6130c593823d3526373b18c4bdcd8481b3bf"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	panic("should not be called by resolver")
 * }
 */
export function projectReferenceDtsFakingVfs_WalkDir(receiver, root, walkFn) {
    throw new globalThis.Error("should not be called by resolver");
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.Realpath","kind":"method","status":"implemented","sigHash":"dbe1b71fba9a21233841c674785c5289a935dd87bbadda3ae10e636502fb767d","bodyHash":"cc1aa4cf8a56fe8c697d62da5f73d904407685bde9f6a2ea9647b4cd7652ebbd"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) Realpath(path string) string {
 * 	result, ok := fs.knownSymlinks.Files().Load(fs.toPath(path))
 * 	if ok {
 * 		return result
 * 	}
 * 	return fs.projectReferenceFileMapper.opts.Host.FS().Realpath(path)
 * }
 */
export function projectReferenceDtsFakingVfs_Realpath(receiver, path) {
    const files = KnownSymlinks_Files(receiver.knownSymlinks);
    const [result, ok] = SyncMap_Load(files, projectReferenceDtsFakingVfs_toPath(receiver, path));
    if (ok) {
        return result;
    }
    return receiver.projectReferenceFileMapper.opts.Host.FS().Realpath(path);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.toPath","kind":"method","status":"implemented","sigHash":"485b44d12ff16c1f0db96cce95a6a54ce823efb644ac83869aab47d762a804be","bodyHash":"d38c2bdf23abc71563253ba4f173a0bb48616775e730ae6c487dd08af73e0df3"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) toPath(path string) tspath.Path {
 * 	return tspath.ToPath(path, fs.projectReferenceFileMapper.opts.Host.GetCurrentDirectory(), fs.UseCaseSensitiveFileNames())
 * }
 */
export function projectReferenceDtsFakingVfs_toPath(receiver, path) {
    return ToPath(path, receiver.projectReferenceFileMapper.opts.Host.GetCurrentDirectory(), projectReferenceDtsFakingVfs_UseCaseSensitiveFileNames(receiver));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.handleDirectoryCouldBeSymlink","kind":"method","status":"implemented","sigHash":"a733ee074a3635cfbc7951db675ce52ff5fa0386086af122eb5cf2e19c1d222a","bodyHash":"f31d71adea6b74ae543e0acf8c98d0f19b229910433e3e1304e862ad13c35fd5"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) handleDirectoryCouldBeSymlink(directory string) {
 * 	if tspath.ContainsIgnoredPath(directory) {
 * 		return
 * 	}
 *
 * 	// Because we already watch node_modules, handle symlinks in there
 * 	if !strings.Contains(directory, "/node_modules/") {
 * 		return
 * 	}
 *
 * 	directoryPath := tspath.Path(tspath.EnsureTrailingDirectorySeparator(string(fs.toPath(directory))))
 * 	if _, ok := fs.knownSymlinks.Directories().Load(directoryPath); ok {
 * 		return
 * 	}
 *
 * 	realDirectory := fs.Realpath(directory)
 * 	var realPath tspath.Path
 * 	if realDirectory == directory {
 * 		// not symlinked
 * 		return
 * 	}
 * 	if realPath = tspath.Path(tspath.EnsureTrailingDirectorySeparator(string(fs.toPath(realDirectory)))); realPath == directoryPath {
 * 		// not symlinked
 * 		return
 * 	}
 * 	fs.knownSymlinks.SetDirectory(directory, directoryPath, &symlinks.KnownDirectoryLink{
 * 		Real:     tspath.EnsureTrailingDirectorySeparator(realDirectory),
 * 		RealPath: realPath,
 * 	})
 * }
 */
export function projectReferenceDtsFakingVfs_handleDirectoryCouldBeSymlink(receiver, directory) {
    if (ContainsIgnoredPath(directory)) {
        return;
    }
    // Because we already watch node_modules, handle symlinks in there
    if (!strings.Contains(directory, "/node_modules/")) {
        return;
    }
    const directoryPath = EnsureTrailingDirectorySeparator(projectReferenceDtsFakingVfs_toPath(receiver, directory));
    const directories = KnownSymlinks_Directories(receiver.knownSymlinks);
    const [, ok] = SyncMap_Load(directories, directoryPath);
    if (ok) {
        return;
    }
    const realDirectory = projectReferenceDtsFakingVfs_Realpath(receiver, directory);
    if (realDirectory === directory) {
        // not symlinked
        return;
    }
    const realPath = EnsureTrailingDirectorySeparator(projectReferenceDtsFakingVfs_toPath(receiver, realDirectory));
    if (realPath === directoryPath) {
        // not symlinked
        return;
    }
    KnownSymlinks_SetDirectory(receiver.knownSymlinks, directory, directoryPath, {
        Real: EnsureTrailingDirectorySeparator(realDirectory),
        RealPath: realPath,
    });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.fileOrDirectoryExistsUsingSource","kind":"method","status":"implemented","sigHash":"1bf711f3786a780f72535cded662a9497e16a8b70f0cf9ec20baf52f3a4c8449","bodyHash":"8a53d725807e92eb4c163a9f57caa1361bb5f4e0899c617ffe3f1f8afde7aca3"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) fileOrDirectoryExistsUsingSource(fileOrDirectory string, isFile bool) bool {
 * 	fileOrDirectoryExistsUsingSource := core.IfElse(isFile, fs.fileExistsIfProjectReferenceDts, fs.directoryExistsIfProjectReferenceDeclDir)
 * 	// Check current directory or file
 * 	result := fileOrDirectoryExistsUsingSource(fileOrDirectory)
 * 	if result != core.TSUnknown {
 * 		return result == core.TSTrue
 * 	}
 *
 * 	knownDirectoryLinks := fs.knownSymlinks.Directories()
 * 	if knownDirectoryLinks.Size() == 0 {
 * 		return false
 * 	}
 * 	fileOrDirectoryPath := fs.toPath(fileOrDirectory)
 * 	if !strings.Contains(string(fileOrDirectoryPath), "/node_modules/") {
 * 		return false
 * 	}
 * 	if isFile {
 * 		_, ok := fs.knownSymlinks.Files().Load(fileOrDirectoryPath)
 * 		if ok {
 * 			return true
 * 		}
 * 	}
 *
 * 	// If it contains node_modules check if its one of the symlinked path we know of
 * 	var exists bool
 * 	knownDirectoryLinks.Range(func(directoryPath tspath.Path, knownDirectoryLink *symlinks.KnownDirectoryLink) bool {
 * 		relative, hasPrefix := strings.CutPrefix(string(fileOrDirectoryPath), string(directoryPath))
 * 		if !hasPrefix {
 * 			return true
 * 		}
 * 		if exists = fileOrDirectoryExistsUsingSource(string(knownDirectoryLink.RealPath) + relative).IsTrue(); exists {
 * 			if isFile {
 * 				// Store the real path for the file
 * 				absolutePath := tspath.GetNormalizedAbsolutePath(fileOrDirectory, fs.projectReferenceFileMapper.opts.Host.GetCurrentDirectory())
 * 				fs.knownSymlinks.SetFile(
 * 					absolutePath,
 * 					fileOrDirectoryPath,
 * 					knownDirectoryLink.Real+absolutePath[len(directoryPath):],
 * 				)
 * 			}
 * 			return false
 * 		}
 * 		return true
 * 	})
 * 	return exists
 * }
 */
export function projectReferenceDtsFakingVfs_fileOrDirectoryExistsUsingSource(receiver, fileOrDirectory, isFile) {
    const fileOrDirectoryExistsUsingSource = IfElse(isFile, projectReferenceDtsFakingVfs_fileExistsIfProjectReferenceDts, projectReferenceDtsFakingVfs_directoryExistsIfProjectReferenceDeclDir);
    // Check current directory or file
    const result = fileOrDirectoryExistsUsingSource(receiver, fileOrDirectory);
    if (result !== TSUnknown) {
        return result === TSTrue;
    }
    const knownDirectoryLinks = KnownSymlinks_Directories(receiver.knownSymlinks);
    if (SyncMap_Size(knownDirectoryLinks) === 0) {
        return false;
    }
    const fileOrDirectoryPath = projectReferenceDtsFakingVfs_toPath(receiver, fileOrDirectory);
    if (!strings.Contains(fileOrDirectoryPath, "/node_modules/")) {
        return false;
    }
    if (isFile) {
        const files = KnownSymlinks_Files(receiver.knownSymlinks);
        const [, okFile] = SyncMap_Load(files, fileOrDirectoryPath);
        if (okFile) {
            return true;
        }
    }
    // If it contains node_modules check if its one of the symlinked path we know of
    let exists = false;
    SyncMap_Range(knownDirectoryLinks, (directoryPath, knownDirectoryLink) => {
        const fileOrDirectoryPathStr = fileOrDirectoryPath;
        const directoryPathStr = directoryPath;
        if (!fileOrDirectoryPathStr.startsWith(directoryPathStr)) {
            return true;
        }
        const relative = fileOrDirectoryPathStr.slice(directoryPathStr.length);
        const checkResult = fileOrDirectoryExistsUsingSource(receiver, knownDirectoryLink.RealPath + relative);
        if (checkResult === TSTrue) {
            exists = true;
            if (isFile) {
                // Store the real path for the file
                const absolutePath = GetNormalizedAbsolutePath(fileOrDirectory, receiver.projectReferenceFileMapper.opts.Host.GetCurrentDirectory());
                KnownSymlinks_SetFile(receiver.knownSymlinks, absolutePath, fileOrDirectoryPath, knownDirectoryLink.Real + absolutePath.slice(directoryPathStr.length));
            }
            return false;
        }
        return true;
    });
    return exists;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.fileExistsIfProjectReferenceDts","kind":"method","status":"implemented","sigHash":"fe737e70a5ca94667b7177ca80a4a9fae2ab8882bf8563df6ab06ffa19b1d1ae","bodyHash":"88635f86d0d1d1af200b4540556639d3db9805f6253ce5ab35cf1b1c39ace70b"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) fileExistsIfProjectReferenceDts(file string) core.Tristate {
 * 	source := fs.projectReferenceFileMapper.getProjectReferenceFromOutputDts(fs.toPath(file))
 * 	if source != nil {
 * 		return core.IfElse(fs.projectReferenceFileMapper.opts.Host.FS().FileExists(source.Source), core.TSTrue, core.TSFalse)
 * 	}
 * 	return core.TSUnknown
 * }
 */
export function projectReferenceDtsFakingVfs_fileExistsIfProjectReferenceDts(receiver, file) {
    const source = projectReferenceFileMapper_getProjectReferenceFromOutputDts(receiver.projectReferenceFileMapper, projectReferenceDtsFakingVfs_toPath(receiver, file));
    if (source !== undefined) {
        return IfElse(receiver.projectReferenceFileMapper.opts.Host.FS().FileExists(source.Source), TSTrue, TSFalse);
    }
    return TSUnknown;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/projectreferencedtsfakinghost.go::method::projectReferenceDtsFakingVfs.directoryExistsIfProjectReferenceDeclDir","kind":"method","status":"implemented","sigHash":"f32d392dae9d3de1c29669b38b65b363fa4617e62232a635e3f08e61a1035496","bodyHash":"96218a003e900f259218e21482984115694efe8c335a7ed141bb5c10a4a71425"}
 *
 * Go source:
 * func (fs *projectReferenceDtsFakingVfs) directoryExistsIfProjectReferenceDeclDir(dir string) core.Tristate {
 * 	dirPath := fs.toPath(dir)
 * 	dirPathWithTrailingDirectorySeparator := dirPath + "/"
 * 	for declDirPath := range fs.dtsDirectories.Keys() {
 * 		if dirPath == declDirPath ||
 * 			// Any parent directory of declaration dir
 * 			strings.HasPrefix(string(declDirPath), string(dirPathWithTrailingDirectorySeparator)) ||
 * 			// Any directory inside declaration dir
 * 			strings.HasPrefix(string(dirPath), string(declDirPath)+"/") {
 * 			return core.TSTrue
 * 		}
 * 	}
 * 	return core.TSUnknown
 * }
 */
export function projectReferenceDtsFakingVfs_directoryExistsIfProjectReferenceDeclDir(receiver, dir) {
    const dirPath = projectReferenceDtsFakingVfs_toPath(receiver, dir);
    const dirPathWithTrailingDirectorySeparator = dirPath + "/";
    for (const [declDirPath] of receiver.dtsDirectories.M) {
        if (dirPath === declDirPath ||
            // Any parent directory of declaration dir
            strings.HasPrefix(declDirPath, dirPathWithTrailingDirectorySeparator) ||
            // Any directory inside declaration dir
            strings.HasPrefix(dirPath, declDirPath + "/")) {
            return TSTrue;
        }
    }
    return TSUnknown;
}
//# sourceMappingURL=projectreferencedtsfakinghost.js.map