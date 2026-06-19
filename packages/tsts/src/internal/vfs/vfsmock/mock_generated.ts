import type { bool } from "../../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../../go/compat.js";
import type { RWMutex } from "../../../go/sync.js";
import type { Time } from "../../../go/time.js";
import type { Entries, FileInfo, FS, WalkDirFunc } from "../vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"becd17795858d6bc1ce786ea719bd003a78794f0eae151fd48e00e3959292ac1"}
 *
 * Go source:
 * var _ vfs.FS = &FSMock{}
 */
export let __611a48db_0: FS = FSMock_as_vfs_FS(undefined);

export function FSMock_as_vfs_FS(receiver: GoPtr<FSMock>): FS {
  return {
    UseCaseSensitiveFileNames: (): bool => FSMock_UseCaseSensitiveFileNames(receiver),
    FileExists: (path: string): bool => FSMock_FileExists(receiver, path),
    ReadFile: (path: string): [string, bool] => FSMock_ReadFile(receiver, path),
    WriteFile: (path: string, data: string): GoError => FSMock_WriteFile(receiver, path, data),
    AppendFile: (path: string, data: string): GoError => FSMock_AppendFile(receiver, path, data),
    Remove: (path: string): GoError => FSMock_Remove(receiver, path),
    Chtimes: (path: string, aTime: Time, mTime: Time): GoError => FSMock_Chtimes(receiver, path, aTime, mTime),
    DirectoryExists: (path: string): bool => FSMock_DirectoryExists(receiver, path),
    GetAccessibleEntries: (path: string): Entries => FSMock_GetAccessibleEntries(receiver, path),
    Stat: (path: string): GoPtr<FileInfo> => FSMock_Stat(receiver, path),
    WalkDir: (root: string, walkFn: WalkDirFunc): GoError => FSMock_WalkDir(receiver, root, walkFn),
    Realpath: (path: string): string => FSMock_Realpath(receiver, path),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::type::FSMock","kind":"type","status":"implemented","sigHash":"63137d3b9716b0d6541d9642ae022defa81415558200782dbaf65612ae45fa6b","bodyHash":"237f4b01b75bf87a26cb7cd26c4f96e0d6a5e3cb5190d95e3b50d7452063626d"}
 *
 * Go source:
 * FSMock struct {
 * 	// AppendFileFunc mocks the AppendFile method.
 * 	AppendFileFunc func(path string, data string) error
 * 
 * 	// ChtimesFunc mocks the Chtimes method.
 * 	ChtimesFunc func(path string, aTime time.Time, mTime time.Time) error
 * 
 * 	// DirectoryExistsFunc mocks the DirectoryExists method.
 * 	DirectoryExistsFunc func(path string) bool
 * 
 * 	// FileExistsFunc mocks the FileExists method.
 * 	FileExistsFunc func(path string) bool
 * 
 * 	// GetAccessibleEntriesFunc mocks the GetAccessibleEntries method.
 * 	GetAccessibleEntriesFunc func(path string) vfs.Entries
 * 
 * 	// ReadFileFunc mocks the ReadFile method.
 * 	ReadFileFunc func(path string) (string, bool)
 * 
 * 	// RealpathFunc mocks the Realpath method.
 * 	RealpathFunc func(path string) string
 * 
 * 	// RemoveFunc mocks the Remove method.
 * 	RemoveFunc func(path string) error
 * 
 * 	// StatFunc mocks the Stat method.
 * 	StatFunc func(path string) vfs.FileInfo
 * 
 * 	// UseCaseSensitiveFileNamesFunc mocks the UseCaseSensitiveFileNames method.
 * 	UseCaseSensitiveFileNamesFunc func() bool
 * 
 * 	// WalkDirFunc mocks the WalkDir method.
 * 	WalkDirFunc func(root string, walkFn vfs.WalkDirFunc) error
 * 
 * 	// WriteFileFunc mocks the WriteFile method.
 * 	WriteFileFunc func(path string, data string) error
 * 
 * 	// calls tracks calls to the methods.
 * 	calls struct {
 * 		// AppendFile holds details about calls to the AppendFile method.
 * 		AppendFile []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 			// Data is the data argument value.
 * 			Data string
 * 		}
 * 		// Chtimes holds details about calls to the Chtimes method.
 * 		Chtimes []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 			// ATime is the aTime argument value.
 * 			ATime time.Time
 * 			// MTime is the mTime argument value.
 * 			MTime time.Time
 * 		}
 * 		// DirectoryExists holds details about calls to the DirectoryExists method.
 * 		DirectoryExists []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// FileExists holds details about calls to the FileExists method.
 * 		FileExists []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// GetAccessibleEntries holds details about calls to the GetAccessibleEntries method.
 * 		GetAccessibleEntries []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// ReadFile holds details about calls to the ReadFile method.
 * 		ReadFile []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// Realpath holds details about calls to the Realpath method.
 * 		Realpath []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// Remove holds details about calls to the Remove method.
 * 		Remove []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// Stat holds details about calls to the Stat method.
 * 		Stat []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 		}
 * 		// UseCaseSensitiveFileNames holds details about calls to the UseCaseSensitiveFileNames method.
 * 		UseCaseSensitiveFileNames []struct{}
 * 		// WalkDir holds details about calls to the WalkDir method.
 * 		WalkDir []struct {
 * 			// Root is the root argument value.
 * 			Root string
 * 			// WalkFn is the walkFn argument value.
 * 			WalkFn vfs.WalkDirFunc
 * 		}
 * 		// WriteFile holds details about calls to the WriteFile method.
 * 		WriteFile []struct {
 * 			// Path is the path argument value.
 * 			Path string
 * 			// Data is the data argument value.
 * 			Data string
 * 		}
 * 	}
 * 	lockAppendFile                sync.RWMutex
 * 	lockChtimes                   sync.RWMutex
 * 	lockDirectoryExists           sync.RWMutex
 * 	lockFileExists                sync.RWMutex
 * 	lockGetAccessibleEntries      sync.RWMutex
 * 	lockReadFile                  sync.RWMutex
 * 	lockRealpath                  sync.RWMutex
 * 	lockRemove                    sync.RWMutex
 * 	lockStat                      sync.RWMutex
 * 	lockUseCaseSensitiveFileNames sync.RWMutex
 * 	lockWalkDir                   sync.RWMutex
 * 	lockWriteFile                 sync.RWMutex
 * }
 */
export interface FSMock {
  AppendFileFunc: (path: string, data: string) => GoError;
  ChtimesFunc: (path: string, aTime: Time, mTime: Time) => GoError;
  DirectoryExistsFunc: (path: string) => bool;
  FileExistsFunc: (path: string) => bool;
  GetAccessibleEntriesFunc: (path: string) => Entries;
  ReadFileFunc: (path: string) => [string, bool];
  RealpathFunc: (path: string) => string;
  RemoveFunc: (path: string) => GoError;
  StatFunc: (path: string) => GoPtr<FileInfo>;
  UseCaseSensitiveFileNamesFunc: () => bool;
  WalkDirFunc: (root: string, walkFn: WalkDirFunc) => GoError;
  WriteFileFunc: (path: string, data: string) => GoError;
  calls: { AppendFile: GoSlice<{ Path: string; Data: string }>; Chtimes: GoSlice<{ Path: string; ATime: Time; MTime: Time }>; DirectoryExists: GoSlice<{ Path: string }>; FileExists: GoSlice<{ Path: string }>; GetAccessibleEntries: GoSlice<{ Path: string }>; ReadFile: GoSlice<{ Path: string }>; Realpath: GoSlice<{ Path: string }>; Remove: GoSlice<{ Path: string }>; Stat: GoSlice<{ Path: string }>; UseCaseSensitiveFileNames: GoSlice<{ readonly __tsgoEmpty?: never }>; WalkDir: GoSlice<{ Root: string; WalkFn: WalkDirFunc }>; WriteFile: GoSlice<{ Path: string; Data: string }> };
  lockAppendFile: RWMutex;
  lockChtimes: RWMutex;
  lockDirectoryExists: RWMutex;
  lockFileExists: RWMutex;
  lockGetAccessibleEntries: RWMutex;
  lockReadFile: RWMutex;
  lockRealpath: RWMutex;
  lockRemove: RWMutex;
  lockStat: RWMutex;
  lockUseCaseSensitiveFileNames: RWMutex;
  lockWalkDir: RWMutex;
  lockWriteFile: RWMutex;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.AppendFile","kind":"method","status":"implemented","sigHash":"6f7dc2f4b2e2f1848a0dce08fbaf347d190e09b3ca6758b2c9180e3684ec7acb","bodyHash":"9b23502a919c7d7a1441d1af6ae98df7a1bb7938c57367deb85c804755d92ac7"}
 *
 * Go source:
 * func (mock *FSMock) AppendFile(path string, data string) error {
 * 	if mock.AppendFileFunc == nil {
 * 		panic("FSMock.AppendFileFunc: method is nil but FS.AppendFile was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 		Data string
 * 	}{
 * 		Path: path,
 * 		Data: data,
 * 	}
 * 	mock.lockAppendFile.Lock()
 * 	mock.calls.AppendFile = append(mock.calls.AppendFile, callInfo)
 * 	mock.lockAppendFile.Unlock()
 * 	return mock.AppendFileFunc(path, data)
 * }
 */
export function FSMock_AppendFile(receiver: GoPtr<FSMock>, path: string, data: string): GoError {
  if (receiver!.AppendFileFunc === undefined) {
    throw new globalThis.Error("FSMock.AppendFileFunc: method is nil but FS.AppendFile was just called");
  }
  const callInfo = { Path: path, Data: data };
  receiver!.lockAppendFile.Lock();
  receiver!.calls.AppendFile.push(callInfo);
  receiver!.lockAppendFile.Unlock();
  return receiver!.AppendFileFunc(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.AppendFileCalls","kind":"method","status":"implemented","sigHash":"2d41361f157f4fe180ce5c769fc9de61d4cf296417c68bed3ab9709ed975c177","bodyHash":"c0fde1071833ff0cc4802a35a596f04ab77e92e9a03dd49af97d056217e08b7d"}
 *
 * Go source:
 * func (mock *FSMock) AppendFileCalls() []struct {
 * 	Path string
 * 	Data string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 		Data string
 * 	}
 * 	mock.lockAppendFile.RLock()
 * 	calls = mock.calls.AppendFile
 * 	mock.lockAppendFile.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_AppendFileCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string; Data: string }> {
  receiver!.lockAppendFile.RLock();
  const calls = receiver!.calls.AppendFile;
  receiver!.lockAppendFile.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.Chtimes","kind":"method","status":"implemented","sigHash":"390bfea9730b32baf05187df677d0cc482a803dbd1629574e39f879f52b1ab41","bodyHash":"ee1e5359aee23984454c9b25de23e1bcde9c0caba4ec22b4b3c4f37c874eaeab"}
 *
 * Go source:
 * func (mock *FSMock) Chtimes(path string, aTime time.Time, mTime time.Time) error {
 * 	if mock.ChtimesFunc == nil {
 * 		panic("FSMock.ChtimesFunc: method is nil but FS.Chtimes was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path  string
 * 		ATime time.Time
 * 		MTime time.Time
 * 	}{
 * 		Path:  path,
 * 		ATime: aTime,
 * 		MTime: mTime,
 * 	}
 * 	mock.lockChtimes.Lock()
 * 	mock.calls.Chtimes = append(mock.calls.Chtimes, callInfo)
 * 	mock.lockChtimes.Unlock()
 * 	return mock.ChtimesFunc(path, aTime, mTime)
 * }
 */
export function FSMock_Chtimes(receiver: GoPtr<FSMock>, path: string, aTime: Time, mTime: Time): GoError {
  if (receiver!.ChtimesFunc === undefined) {
    throw new globalThis.Error("FSMock.ChtimesFunc: method is nil but FS.Chtimes was just called");
  }
  const callInfo = { Path: path, ATime: aTime, MTime: mTime };
  receiver!.lockChtimes.Lock();
  receiver!.calls.Chtimes.push(callInfo);
  receiver!.lockChtimes.Unlock();
  return receiver!.ChtimesFunc(path, aTime, mTime);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.ChtimesCalls","kind":"method","status":"implemented","sigHash":"5fb60baa29bbf5e4c25e447c4b4ef0cd199c304fdafc36ac6a53161ff5391c1c","bodyHash":"45262c7a0afca14aa2c5153b0bf76f0dcfb04afe5e3aeaa0a5900a25d10e0ce6"}
 *
 * Go source:
 * func (mock *FSMock) ChtimesCalls() []struct {
 * 	Path  string
 * 	ATime time.Time
 * 	MTime time.Time
 * } {
 * 	var calls []struct {
 * 		Path  string
 * 		ATime time.Time
 * 		MTime time.Time
 * 	}
 * 	mock.lockChtimes.RLock()
 * 	calls = mock.calls.Chtimes
 * 	mock.lockChtimes.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_ChtimesCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string; ATime: Time; MTime: Time }> {
  receiver!.lockChtimes.RLock();
  const calls = receiver!.calls.Chtimes;
  receiver!.lockChtimes.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.DirectoryExists","kind":"method","status":"implemented","sigHash":"bfd1e2c5f2169f22aa160088546dfa2ba939443f98b5f01e71e1228759e9bbfb","bodyHash":"1dee7f3cbcdd9ca6499f101e3a9d938cf2fb05b83485d642deb51897538ca656"}
 *
 * Go source:
 * func (mock *FSMock) DirectoryExists(path string) bool {
 * 	if mock.DirectoryExistsFunc == nil {
 * 		panic("FSMock.DirectoryExistsFunc: method is nil but FS.DirectoryExists was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockDirectoryExists.Lock()
 * 	mock.calls.DirectoryExists = append(mock.calls.DirectoryExists, callInfo)
 * 	mock.lockDirectoryExists.Unlock()
 * 	return mock.DirectoryExistsFunc(path)
 * }
 */
export function FSMock_DirectoryExists(receiver: GoPtr<FSMock>, path: string): bool {
  if (receiver!.DirectoryExistsFunc === undefined) {
    throw new globalThis.Error("FSMock.DirectoryExistsFunc: method is nil but FS.DirectoryExists was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockDirectoryExists.Lock();
  receiver!.calls.DirectoryExists.push(callInfo);
  receiver!.lockDirectoryExists.Unlock();
  return receiver!.DirectoryExistsFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.DirectoryExistsCalls","kind":"method","status":"implemented","sigHash":"6e193b95c8bf4ff5cc4a0749e1b738775e97f2c25ae7c5e160a0345ad29330f5","bodyHash":"781668a0ad042a330b3c697e537c71639fdbf061970b7454c56ff1d80f75c74f"}
 *
 * Go source:
 * func (mock *FSMock) DirectoryExistsCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockDirectoryExists.RLock()
 * 	calls = mock.calls.DirectoryExists
 * 	mock.lockDirectoryExists.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_DirectoryExistsCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockDirectoryExists.RLock();
  const calls = receiver!.calls.DirectoryExists;
  receiver!.lockDirectoryExists.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.FileExists","kind":"method","status":"implemented","sigHash":"60a9aae61ec522ab72621fffa07afb3393a039c936c658b8f275fd368f3224ed","bodyHash":"569320242e0fad2db8ba7736406e8220e94a14acd791946a764ec22d3e7ad1a9"}
 *
 * Go source:
 * func (mock *FSMock) FileExists(path string) bool {
 * 	if mock.FileExistsFunc == nil {
 * 		panic("FSMock.FileExistsFunc: method is nil but FS.FileExists was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockFileExists.Lock()
 * 	mock.calls.FileExists = append(mock.calls.FileExists, callInfo)
 * 	mock.lockFileExists.Unlock()
 * 	return mock.FileExistsFunc(path)
 * }
 */
export function FSMock_FileExists(receiver: GoPtr<FSMock>, path: string): bool {
  if (receiver!.FileExistsFunc === undefined) {
    throw new globalThis.Error("FSMock.FileExistsFunc: method is nil but FS.FileExists was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockFileExists.Lock();
  receiver!.calls.FileExists.push(callInfo);
  receiver!.lockFileExists.Unlock();
  return receiver!.FileExistsFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.FileExistsCalls","kind":"method","status":"implemented","sigHash":"5f2e868462bcead67726781ce2bbdc66b160f972b9ef2df9f7d6e85694adbe71","bodyHash":"879beb662ad58b10ded6717b68cdeee43621ba933bb0da311d8aee336d5086ba"}
 *
 * Go source:
 * func (mock *FSMock) FileExistsCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockFileExists.RLock()
 * 	calls = mock.calls.FileExists
 * 	mock.lockFileExists.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_FileExistsCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockFileExists.RLock();
  const calls = receiver!.calls.FileExists;
  receiver!.lockFileExists.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.GetAccessibleEntries","kind":"method","status":"implemented","sigHash":"b36270b53d87e0f6919f1c0e998ea015299849bacc24f0136ad000fd574c0ac7","bodyHash":"015a80a2aa861c85df2ff28470ef4b7cf25ba4b998393a8d90657641bc26a6f2"}
 *
 * Go source:
 * func (mock *FSMock) GetAccessibleEntries(path string) vfs.Entries {
 * 	if mock.GetAccessibleEntriesFunc == nil {
 * 		panic("FSMock.GetAccessibleEntriesFunc: method is nil but FS.GetAccessibleEntries was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockGetAccessibleEntries.Lock()
 * 	mock.calls.GetAccessibleEntries = append(mock.calls.GetAccessibleEntries, callInfo)
 * 	mock.lockGetAccessibleEntries.Unlock()
 * 	return mock.GetAccessibleEntriesFunc(path)
 * }
 */
export function FSMock_GetAccessibleEntries(receiver: GoPtr<FSMock>, path: string): Entries {
  if (receiver!.GetAccessibleEntriesFunc === undefined) {
    throw new globalThis.Error("FSMock.GetAccessibleEntriesFunc: method is nil but FS.GetAccessibleEntries was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockGetAccessibleEntries.Lock();
  receiver!.calls.GetAccessibleEntries.push(callInfo);
  receiver!.lockGetAccessibleEntries.Unlock();
  return receiver!.GetAccessibleEntriesFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.GetAccessibleEntriesCalls","kind":"method","status":"implemented","sigHash":"82ce85a3dc58de816679567740235d7ccaf079d3f1fd47b7211fa216089558bb","bodyHash":"a8adbdd3629dffd745a6cd380cd5096232de9ee581816a55d8c82c2a90adf739"}
 *
 * Go source:
 * func (mock *FSMock) GetAccessibleEntriesCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockGetAccessibleEntries.RLock()
 * 	calls = mock.calls.GetAccessibleEntries
 * 	mock.lockGetAccessibleEntries.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_GetAccessibleEntriesCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockGetAccessibleEntries.RLock();
  const calls = receiver!.calls.GetAccessibleEntries;
  receiver!.lockGetAccessibleEntries.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.ReadFile","kind":"method","status":"implemented","sigHash":"8118c5b65aae90f59d829de6f6d5bd7be2cde3fdcb87f87d883889b45f49d3e9","bodyHash":"c4e0403507ca3f1a30fa3efb78476504358add1e83c945cc9db85de5e4cc48c4"}
 *
 * Go source:
 * func (mock *FSMock) ReadFile(path string) (string, bool) {
 * 	if mock.ReadFileFunc == nil {
 * 		panic("FSMock.ReadFileFunc: method is nil but FS.ReadFile was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockReadFile.Lock()
 * 	mock.calls.ReadFile = append(mock.calls.ReadFile, callInfo)
 * 	mock.lockReadFile.Unlock()
 * 	return mock.ReadFileFunc(path)
 * }
 */
export function FSMock_ReadFile(receiver: GoPtr<FSMock>, path: string): [string, bool] {
  if (receiver!.ReadFileFunc === undefined) {
    throw new globalThis.Error("FSMock.ReadFileFunc: method is nil but FS.ReadFile was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockReadFile.Lock();
  receiver!.calls.ReadFile.push(callInfo);
  receiver!.lockReadFile.Unlock();
  return receiver!.ReadFileFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.ReadFileCalls","kind":"method","status":"implemented","sigHash":"4d72997a5687dc85b96bac9ee81b4c77c109709a4de4029391d2fc29ca1c36c8","bodyHash":"8959c2b83c074218852eed76e8f3069142a39d0fa097ba4a8c53bc58c5d163e9"}
 *
 * Go source:
 * func (mock *FSMock) ReadFileCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockReadFile.RLock()
 * 	calls = mock.calls.ReadFile
 * 	mock.lockReadFile.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_ReadFileCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockReadFile.RLock();
  const calls = receiver!.calls.ReadFile;
  receiver!.lockReadFile.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.Realpath","kind":"method","status":"implemented","sigHash":"660c0a69b1afd0a06e2656cef01cbcc502cf924e06a8b48b65ac278d077afc50","bodyHash":"dfd18388ea27c411de042385e3a8570a2f243d73ff6cc3f9a79e4b6d17368e53"}
 *
 * Go source:
 * func (mock *FSMock) Realpath(path string) string {
 * 	if mock.RealpathFunc == nil {
 * 		panic("FSMock.RealpathFunc: method is nil but FS.Realpath was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockRealpath.Lock()
 * 	mock.calls.Realpath = append(mock.calls.Realpath, callInfo)
 * 	mock.lockRealpath.Unlock()
 * 	return mock.RealpathFunc(path)
 * }
 */
export function FSMock_Realpath(receiver: GoPtr<FSMock>, path: string): string {
  if (receiver!.RealpathFunc === undefined) {
    throw new globalThis.Error("FSMock.RealpathFunc: method is nil but FS.Realpath was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockRealpath.Lock();
  receiver!.calls.Realpath.push(callInfo);
  receiver!.lockRealpath.Unlock();
  return receiver!.RealpathFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.RealpathCalls","kind":"method","status":"implemented","sigHash":"bcda6da60b683c088d7245bc9dcdc13fe74480d45bb4c8262a1f2b0fc7a07d64","bodyHash":"16947bc596817dffe2e379c98c913b64e3aa879d48e65563b873d7bd775d84b8"}
 *
 * Go source:
 * func (mock *FSMock) RealpathCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockRealpath.RLock()
 * 	calls = mock.calls.Realpath
 * 	mock.lockRealpath.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_RealpathCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockRealpath.RLock();
  const calls = receiver!.calls.Realpath;
  receiver!.lockRealpath.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.Remove","kind":"method","status":"implemented","sigHash":"eaad7d0fc0be5eb8ccaaecf0db1539bc4b36833262584b98bd3d2ebf4da51d7d","bodyHash":"b0ac153d06215725ea3e0b2fd4397a807de68d419c3db0da58e9a4b447baaad5"}
 *
 * Go source:
 * func (mock *FSMock) Remove(path string) error {
 * 	if mock.RemoveFunc == nil {
 * 		panic("FSMock.RemoveFunc: method is nil but FS.Remove was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockRemove.Lock()
 * 	mock.calls.Remove = append(mock.calls.Remove, callInfo)
 * 	mock.lockRemove.Unlock()
 * 	return mock.RemoveFunc(path)
 * }
 */
export function FSMock_Remove(receiver: GoPtr<FSMock>, path: string): GoError {
  if (receiver!.RemoveFunc === undefined) {
    throw new globalThis.Error("FSMock.RemoveFunc: method is nil but FS.Remove was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockRemove.Lock();
  receiver!.calls.Remove.push(callInfo);
  receiver!.lockRemove.Unlock();
  return receiver!.RemoveFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.RemoveCalls","kind":"method","status":"implemented","sigHash":"4704db2461f7902a54a6bf5ad5f5a9c99c8ed44f018792c2272e8bd2ae706bdc","bodyHash":"c54fbbe8af6a19aec138196b74d4327175707c1243975bbe2f613f7c65b9afb8"}
 *
 * Go source:
 * func (mock *FSMock) RemoveCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockRemove.RLock()
 * 	calls = mock.calls.Remove
 * 	mock.lockRemove.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_RemoveCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockRemove.RLock();
  const calls = receiver!.calls.Remove;
  receiver!.lockRemove.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.Stat","kind":"method","status":"implemented","sigHash":"711524571f2009d8ddaddbc7dfc43664f7a42ddf29a45b054235302b83240218","bodyHash":"11fef6baadc93e9ea6758f57abbfda27e94e32869c0d8b9d856548d677d0c6ad"}
 *
 * Go source:
 * func (mock *FSMock) Stat(path string) vfs.FileInfo {
 * 	if mock.StatFunc == nil {
 * 		panic("FSMock.StatFunc: method is nil but FS.Stat was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 	}{
 * 		Path: path,
 * 	}
 * 	mock.lockStat.Lock()
 * 	mock.calls.Stat = append(mock.calls.Stat, callInfo)
 * 	mock.lockStat.Unlock()
 * 	return mock.StatFunc(path)
 * }
 */
export function FSMock_Stat(receiver: GoPtr<FSMock>, path: string): GoPtr<FileInfo> {
  if (receiver!.StatFunc === undefined) {
    throw new globalThis.Error("FSMock.StatFunc: method is nil but FS.Stat was just called");
  }
  const callInfo = { Path: path };
  receiver!.lockStat.Lock();
  receiver!.calls.Stat.push(callInfo);
  receiver!.lockStat.Unlock();
  return receiver!.StatFunc(path);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.StatCalls","kind":"method","status":"implemented","sigHash":"82682f11e15be1497eac9fa54cc0f124c96450e62201dc57130420fd2b4c55c6","bodyHash":"542d5844cdb52e1d7ba854bff20730251b75135d991f251ca6f5acf0fed1c531"}
 *
 * Go source:
 * func (mock *FSMock) StatCalls() []struct {
 * 	Path string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 	}
 * 	mock.lockStat.RLock()
 * 	calls = mock.calls.Stat
 * 	mock.lockStat.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_StatCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string }> {
  receiver!.lockStat.RLock();
  const calls = receiver!.calls.Stat;
  receiver!.lockStat.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.UseCaseSensitiveFileNames","kind":"method","status":"implemented","sigHash":"2b45e8089b7d8c41eea034ed6e46b731516d742cd6a3e3c627c9c94daad35d83","bodyHash":"dd1468d66caeda03231d6b72d79eced4eba452c2742ec7e4acb1f0fc4d689782"}
 *
 * Go source:
 * func (mock *FSMock) UseCaseSensitiveFileNames() bool {
 * 	if mock.UseCaseSensitiveFileNamesFunc == nil {
 * 		panic("FSMock.UseCaseSensitiveFileNamesFunc: method is nil but FS.UseCaseSensitiveFileNames was just called")
 * 	}
 * 	callInfo := struct{}{}
 * 	mock.lockUseCaseSensitiveFileNames.Lock()
 * 	mock.calls.UseCaseSensitiveFileNames = append(mock.calls.UseCaseSensitiveFileNames, callInfo)
 * 	mock.lockUseCaseSensitiveFileNames.Unlock()
 * 	return mock.UseCaseSensitiveFileNamesFunc()
 * }
 */
export function FSMock_UseCaseSensitiveFileNames(receiver: GoPtr<FSMock>): bool {
  if (receiver!.UseCaseSensitiveFileNamesFunc === undefined) {
    throw new globalThis.Error("FSMock.UseCaseSensitiveFileNamesFunc: method is nil but FS.UseCaseSensitiveFileNames was just called");
  }
  const callInfo = {};
  receiver!.lockUseCaseSensitiveFileNames.Lock();
  receiver!.calls.UseCaseSensitiveFileNames.push(callInfo);
  receiver!.lockUseCaseSensitiveFileNames.Unlock();
  return receiver!.UseCaseSensitiveFileNamesFunc();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.UseCaseSensitiveFileNamesCalls","kind":"method","status":"implemented","sigHash":"a8642a2b0918d9a23ba6025e37e707c5e6ab444454d81af16e0b17e3d66e449f","bodyHash":"f304e04581daef1848a6eb3f227bbea732b265ebf542e9720e69fdc3e4172b95"}
 *
 * Go source:
 * func (mock *FSMock) UseCaseSensitiveFileNamesCalls() []struct{} {
 * 	var calls []struct{}
 * 	mock.lockUseCaseSensitiveFileNames.RLock()
 * 	calls = mock.calls.UseCaseSensitiveFileNames
 * 	mock.lockUseCaseSensitiveFileNames.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_UseCaseSensitiveFileNamesCalls(receiver: GoPtr<FSMock>): GoSlice<{ readonly __tsgoEmpty?: never }> {
  receiver!.lockUseCaseSensitiveFileNames.RLock();
  const calls = receiver!.calls.UseCaseSensitiveFileNames;
  receiver!.lockUseCaseSensitiveFileNames.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.WalkDir","kind":"method","status":"implemented","sigHash":"6d8fbe9e596541d707fe9e349e09ac3648b32ea002fa7c93cbe94274174c30de","bodyHash":"79e078097b2783ca9bccea6dc622e2b518cd69f7680fed946ec68589a1859c11"}
 *
 * Go source:
 * func (mock *FSMock) WalkDir(root string, walkFn vfs.WalkDirFunc) error {
 * 	if mock.WalkDirFunc == nil {
 * 		panic("FSMock.WalkDirFunc: method is nil but FS.WalkDir was just called")
 * 	}
 * 	callInfo := struct {
 * 		Root   string
 * 		WalkFn vfs.WalkDirFunc
 * 	}{
 * 		Root:   root,
 * 		WalkFn: walkFn,
 * 	}
 * 	mock.lockWalkDir.Lock()
 * 	mock.calls.WalkDir = append(mock.calls.WalkDir, callInfo)
 * 	mock.lockWalkDir.Unlock()
 * 	return mock.WalkDirFunc(root, walkFn)
 * }
 */
export function FSMock_WalkDir(receiver: GoPtr<FSMock>, root: string, walkFn: WalkDirFunc): GoError {
  if (receiver!.WalkDirFunc === undefined) {
    throw new globalThis.Error("FSMock.WalkDirFunc: method is nil but FS.WalkDir was just called");
  }
  const callInfo = { Root: root, WalkFn: walkFn };
  receiver!.lockWalkDir.Lock();
  receiver!.calls.WalkDir.push(callInfo);
  receiver!.lockWalkDir.Unlock();
  return receiver!.WalkDirFunc(root, walkFn);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.WalkDirCalls","kind":"method","status":"implemented","sigHash":"487bdfe2e8fbf00b6e8c1f5ac3c922838eaf9c67cb04cfa55449586f8e051cbd","bodyHash":"df74f94511b8f828a60649c05386819c090fe7209e8bb35b6c18aa55e6fc3fc4"}
 *
 * Go source:
 * func (mock *FSMock) WalkDirCalls() []struct {
 * 	Root   string
 * 	WalkFn vfs.WalkDirFunc
 * } {
 * 	var calls []struct {
 * 		Root   string
 * 		WalkFn vfs.WalkDirFunc
 * 	}
 * 	mock.lockWalkDir.RLock()
 * 	calls = mock.calls.WalkDir
 * 	mock.lockWalkDir.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_WalkDirCalls(receiver: GoPtr<FSMock>): GoSlice<{ Root: string; WalkFn: WalkDirFunc }> {
  receiver!.lockWalkDir.RLock();
  const calls = receiver!.calls.WalkDir;
  receiver!.lockWalkDir.RUnlock();
  return calls;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.WriteFile","kind":"method","status":"implemented","sigHash":"0c286757842638047c1e0f6649084239488fa8231487aaa114fab1f845c1cfb0","bodyHash":"e0c7284c994a85ca89107d04dc7e0e58687117bbc4139938d6b05c8af23c4404"}
 *
 * Go source:
 * func (mock *FSMock) WriteFile(path string, data string) error {
 * 	if mock.WriteFileFunc == nil {
 * 		panic("FSMock.WriteFileFunc: method is nil but FS.WriteFile was just called")
 * 	}
 * 	callInfo := struct {
 * 		Path string
 * 		Data string
 * 	}{
 * 		Path: path,
 * 		Data: data,
 * 	}
 * 	mock.lockWriteFile.Lock()
 * 	mock.calls.WriteFile = append(mock.calls.WriteFile, callInfo)
 * 	mock.lockWriteFile.Unlock()
 * 	return mock.WriteFileFunc(path, data)
 * }
 */
export function FSMock_WriteFile(receiver: GoPtr<FSMock>, path: string, data: string): GoError {
  if (receiver!.WriteFileFunc === undefined) {
    throw new globalThis.Error("FSMock.WriteFileFunc: method is nil but FS.WriteFile was just called");
  }
  const callInfo = { Path: path, Data: data };
  receiver!.lockWriteFile.Lock();
  receiver!.calls.WriteFile.push(callInfo);
  receiver!.lockWriteFile.Unlock();
  return receiver!.WriteFileFunc(path, data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfsmock/mock_generated.go::method::FSMock.WriteFileCalls","kind":"method","status":"implemented","sigHash":"56edfc83335fd59d0ea51bfc63ee1a8631c8c7c3dc30beb68d1622a8d22df079","bodyHash":"cd00f68ec3a049672c67438ea776e03c129d4847e0751c680faf53f693db8a73"}
 *
 * Go source:
 * func (mock *FSMock) WriteFileCalls() []struct {
 * 	Path string
 * 	Data string
 * } {
 * 	var calls []struct {
 * 		Path string
 * 		Data string
 * 	}
 * 	mock.lockWriteFile.RLock()
 * 	calls = mock.calls.WriteFile
 * 	mock.lockWriteFile.RUnlock()
 * 	return calls
 * }
 */
export function FSMock_WriteFileCalls(receiver: GoPtr<FSMock>): GoSlice<{ Path: string; Data: string }> {
  receiver!.lockWriteFile.RLock();
  const calls = receiver!.calls.WriteFile;
  receiver!.lockWriteFile.RUnlock();
  return calls;
}
