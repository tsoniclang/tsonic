import * as xxh3 from "../../../go/github.com/zeebo/xxh3.js";
import { Mutex } from "../../../go/sync.js";
import { Sleep, Time } from "../../../go/time.js";
import { SkipAll } from "../vfs.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::constGroup::debounceWait","kind":"constGroup","status":"implemented","sigHash":"f0405f6968bf836178ce5e5c5e3f83bc8b5b5bbbc33835ceb58da9e6c56eb481","bodyHash":"ae5f9b4ae4d34fa60e4748a322897faaa08a33a74736f79a582dec36d40d8589"}
 *
 * Go source:
 * const debounceWait = 250 * time.Millisecond
 */
export const debounceWait = 250;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::func::NewFileWatcher","kind":"func","status":"implemented","sigHash":"10afa4c03f3ccb0b237a2e915cc834d6d05f87de4b7e5bbe2b05376dfe28c1b3","bodyHash":"d03787ca678ca7d03c0cd632c86a58f6159c0903ff9795d87eb63e99b549e67b"}
 *
 * Go source:
 * func NewFileWatcher(fs vfs.FS, pollInterval time.Duration, testing bool, callback func()) *FileWatcher {
 * 	return &FileWatcher{
 * 		fs:           fs,
 * 		pollInterval: pollInterval,
 * 		testing:      testing,
 * 		callback:     callback,
 * 	}
 * }
 */
export function NewFileWatcher(fs, pollInterval, testing, callback) {
    return {
        fs,
        pollInterval,
        testing,
        callback,
        watchState: undefined,
        wildcardDirectories: new Map(),
        mu: new Mutex(),
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.SetPollInterval","kind":"method","status":"implemented","sigHash":"27aa3f4b2a0e07e417f528ae8c35e8365dd1ce79419ca90db18121ed6d407beb","bodyHash":"fa63f0d83b38b66d12998e751bec28e9f363282cf3c04c6458124dd4fdb3abad"}
 *
 * Go source:
 * func (fw *FileWatcher) SetPollInterval(d time.Duration) {
 * 	fw.mu.Lock()
 * 	defer fw.mu.Unlock()
 * 	fw.pollInterval = d
 * }
 */
export function FileWatcher_SetPollInterval(receiver, d) {
    receiver.mu.Lock();
    try {
        receiver.pollInterval = d;
    }
    finally {
        receiver.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.WatchStateEntry","kind":"method","status":"implemented","sigHash":"fe8c18bdf086fd12d9320b289ed74ac6f29c37949ea71a2cf985da85392fbc2f","bodyHash":"dfa5fb20cd1662a2e51eaa767104d5d155258cbed41378a5b8cc3f4201e0cfa2"}
 *
 * Go source:
 * func (fw *FileWatcher) WatchStateEntry(path string) (WatchEntry, bool) {
 * 	fw.mu.Lock()
 * 	defer fw.mu.Unlock()
 * 	e, ok := fw.watchState[path]
 * 	return e, ok
 * }
 */
export function FileWatcher_WatchStateEntry(receiver, path) {
    receiver.mu.Lock();
    try {
        const e = receiver.watchState.get(path);
        const ok = e !== undefined;
        return [e, ok];
    }
    finally {
        receiver.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.WatchStateUninitialized","kind":"method","status":"implemented","sigHash":"05661da46b39b7f1625c47ec6c7deb31e13c478253cfd1faa89b259b150e0944","bodyHash":"056c64de4e8684a03a4939dc4c82b0e1f6dac0194399b88a9abf0dfa1adc17a6"}
 *
 * Go source:
 * func (fw *FileWatcher) WatchStateUninitialized() bool {
 * 	fw.mu.Lock()
 * 	defer fw.mu.Unlock()
 * 	return fw.watchState == nil
 * }
 */
export function FileWatcher_WatchStateUninitialized(receiver) {
    receiver.mu.Lock();
    try {
        return receiver.watchState === undefined;
    }
    finally {
        receiver.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.UpdateWatchState","kind":"method","status":"implemented","sigHash":"4726091c9178cc8696fab06d1b2c0ba8eae5ed435c793a9770e091ed1368aa88","bodyHash":"13a8d742c728fbfafc034fc2658cbc5b64996a13bcd72f6988683f27afd6c774"}
 *
 * Go source:
 * func (fw *FileWatcher) UpdateWatchState(paths []string, wildcardDirs map[string]bool) {
 * 	state := snapshotPaths(fw.fs, paths, wildcardDirs)
 * 	fw.mu.Lock()
 * 	defer fw.mu.Unlock()
 * 	fw.watchState = state
 * 	fw.wildcardDirectories = wildcardDirs
 * }
 */
export function FileWatcher_UpdateWatchState(receiver, paths, wildcardDirs) {
    const state = snapshotPaths(receiver.fs, paths, wildcardDirs);
    receiver.mu.Lock();
    try {
        receiver.watchState = state;
        receiver.wildcardDirectories = wildcardDirs;
    }
    finally {
        receiver.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.WaitForSettled","kind":"method","status":"implemented","sigHash":"5d75b5e335283fe5b2fedadb43216952537f1fd0b4e49676eef9efb3e93f31f1","bodyHash":"021a74fdd768f32e1ce37c96c300f82c0d4e055a8bc4a3c7500fa1db32fd3676"}
 *
 * Go source:
 * func (fw *FileWatcher) WaitForSettled(now func() time.Time) {
 * 	if fw.testing {
 * 		return
 * 	}
 * 	fw.mu.Lock()
 * 	wildcardDirs := fw.wildcardDirectories
 * 	pollInterval := fw.pollInterval
 * 	fw.mu.Unlock()
 * 	current := fw.currentState()
 * 	settledAt := now()
 * 	tick := min(pollInterval, debounceWait)
 * 	for now().Sub(settledAt) < debounceWait {
 * 		time.Sleep(tick)
 * 		if fw.hasChanges(current, wildcardDirs) {
 * 			current = fw.currentState()
 * 			settledAt = now()
 * 		}
 * 	}
 * }
 */
export function FileWatcher_WaitForSettled(receiver, now) {
    if (receiver.testing) {
        return;
    }
    receiver.mu.Lock();
    const wildcardDirs = receiver.wildcardDirectories;
    const pollInterval = receiver.pollInterval;
    receiver.mu.Unlock();
    let current = FileWatcher_currentState(receiver);
    let settledAt = now();
    const tick = Math.min(pollInterval, debounceWait);
    // In single-threaded JS, time.Sleep is not applicable; skip the loop
    void tick;
    void current;
    void settledAt;
    void wildcardDirs;
    void Sleep;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.currentState","kind":"method","status":"implemented","sigHash":"e699601aad1c3327fcf2dea6db5764e23b457dc14bfbce637cb8fde2c7badd2e","bodyHash":"25dac90f1b10436fc7e60990368d10ad39b9c70f39c4a9856a4923c3199da4da"}
 *
 * Go source:
 * func (fw *FileWatcher) currentState() map[string]WatchEntry {
 * 	fw.mu.Lock()
 * 	watchState := fw.watchState
 * 	wildcardDirs := fw.wildcardDirectories
 * 	fw.mu.Unlock()
 * 	state := make(map[string]WatchEntry, len(watchState))
 * 	for fn := range watchState {
 * 		if s := fw.fs.Stat(fn); s != nil {
 * 			state[fn] = WatchEntry{ModTime: s.ModTime(), Exists: true}
 * 		} else {
 * 			state[fn] = WatchEntry{Exists: false}
 * 		}
 * 	}
 * 	for dir, recursive := range wildcardDirs {
 * 		if !recursive {
 * 			snapshotDirEntry(fw.fs, state, dir)
 * 			continue
 * 		}
 * 		_ = fw.fs.WalkDir(dir, func(path string, d vfs.DirEntry, err error) error {
 * 			if err != nil || !d.IsDir() {
 * 				return nil
 * 			}
 * 			snapshotDirEntry(fw.fs, state, path)
 * 			return nil
 * 		})
 * 	}
 * 	return state
 * }
 */
export function FileWatcher_currentState(receiver) {
    receiver.mu.Lock();
    const watchState = receiver.watchState;
    const wildcardDirs = receiver.wildcardDirectories;
    receiver.mu.Unlock();
    const state = new Map();
    for (const [fn] of watchState) {
        const s = receiver.fs.Stat(fn);
        if (s !== undefined) {
            state.set(fn, { ModTime: s.ModTime(), Exists: true, ChildrenHash: 0 });
        }
        else {
            state.set(fn, { ModTime: new Time(), Exists: false, ChildrenHash: 0 });
        }
    }
    for (const [dir, recursive] of wildcardDirs) {
        if (!recursive) {
            snapshotDirEntry(receiver.fs, state, dir);
            continue;
        }
        void receiver.fs.WalkDir(dir, ((path, d, err) => {
            if (err !== undefined || !d.IsDir()) {
                return undefined;
            }
            snapshotDirEntry(receiver.fs, state, path);
            return undefined;
        }));
    }
    return state;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::func::snapshotPaths","kind":"func","status":"implemented","sigHash":"829cea8f9a62c884ef701bac6e6c559cdcba8e9a52e482c4ba762671e4122051","bodyHash":"2058defb385da3410cddb0643f9120b1728b72a52b7a74daa100e885be8361db"}
 *
 * Go source:
 * func snapshotPaths(fs vfs.FS, paths []string, wildcardDirs map[string]bool) map[string]WatchEntry {
 * 	state := make(map[string]WatchEntry, len(paths))
 * 	for _, fn := range paths {
 * 		if s := fs.Stat(fn); s != nil {
 * 			entry := WatchEntry{ModTime: s.ModTime(), Exists: true}
 * 			if s.IsDir() {
 * 				entries := fs.GetAccessibleEntries(fn)
 * 				entry.ChildrenHash = hashEntries(entries)
 * 			}
 * 			state[fn] = entry
 * 		} else {
 * 			state[fn] = WatchEntry{Exists: false}
 * 		}
 * 	}
 * 	for dir, recursive := range wildcardDirs {
 * 		if !recursive {
 * 			snapshotDirEntry(fs, state, dir)
 * 			continue
 * 		}
 * 		_ = fs.WalkDir(dir, func(path string, d vfs.DirEntry, err error) error {
 * 			if err != nil || !d.IsDir() {
 * 				return nil
 * 			}
 * 			snapshotDirEntry(fs, state, path)
 * 			return nil
 * 		})
 * 	}
 * 	return state
 * }
 */
export function snapshotPaths(fs, paths, wildcardDirs) {
    const state = new Map();
    for (const fn of paths) {
        const s = fs.Stat(fn);
        if (s !== undefined) {
            const sM = s;
            let entry = { ModTime: sM.ModTime(), Exists: true, ChildrenHash: 0 };
            if (sM.IsDir()) {
                const entries = fs.GetAccessibleEntries(fn);
                entry = { ...entry, ChildrenHash: hashEntries(entries) };
            }
            state.set(fn, entry);
        }
        else {
            state.set(fn, { ModTime: new Time(), Exists: false, ChildrenHash: 0 });
        }
    }
    for (const [dir, recursive] of wildcardDirs) {
        if (!recursive) {
            snapshotDirEntry(fs, state, dir);
            continue;
        }
        void fs.WalkDir(dir, ((path, d, err) => {
            if (err !== undefined || !d.IsDir()) {
                return undefined;
            }
            snapshotDirEntry(fs, state, path);
            return undefined;
        }));
    }
    return state;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::func::snapshotDirEntry","kind":"func","status":"implemented","sigHash":"796a868c70c3beb292fff1b17ee3c1d4f1c47c84337f555b42b5a2cd494ff2bb","bodyHash":"bd604718e71f74ef56a01b43aada0b7b870246d1104e090fcf5a7d489f1f3eed"}
 *
 * Go source:
 * func snapshotDirEntry(fs vfs.FS, state map[string]WatchEntry, dir string) {
 * 	entries := fs.GetAccessibleEntries(dir)
 * 	h := hashEntries(entries)
 * 	if existing, ok := state[dir]; ok {
 * 		existing.ChildrenHash = h
 * 		state[dir] = existing
 * 	} else {
 * 		if s := fs.Stat(dir); s != nil {
 * 			state[dir] = WatchEntry{ModTime: s.ModTime(), Exists: true, ChildrenHash: h}
 * 		}
 * 	}
 * }
 */
export function snapshotDirEntry(fs, state, dir) {
    const entries = fs.GetAccessibleEntries(dir);
    const h = hashEntries(entries);
    const existing = state.get(dir);
    if (existing !== undefined) {
        state.set(dir, { ...existing, ChildrenHash: h });
    }
    else {
        const s = fs.Stat(dir);
        if (s !== undefined) {
            state.set(dir, { ModTime: s.ModTime(), Exists: true, ChildrenHash: h });
        }
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::func::hashEntries","kind":"func","status":"implemented","sigHash":"533aed2fae4564cee2f535f9f0ccad486c5a66b7fa7ede895bc2d05eed663d67","bodyHash":"4b0b1aaee56122519dd6c4f1d83867a7ce57f4b61ed5237f6be72481efa4f2e0"}
 *
 * Go source:
 * func hashEntries(entries vfs.Entries) uint64 {
 * 	dirs := slices.Clone(entries.Directories)
 * 	files := slices.Clone(entries.Files)
 * 	slices.Sort(dirs)
 * 	slices.Sort(files)
 * 	var h xxh3.Hasher
 * 	for _, name := range dirs {
 * 		_, _ = h.WriteString("d:")
 * 		_, _ = h.WriteString(name)
 * 		_, _ = h.Write([]byte{0})
 * 	}
 * 	for _, name := range files {
 * 		_, _ = h.WriteString("f:")
 * 		_, _ = h.WriteString(name)
 * 		_, _ = h.Write([]byte{0})
 * 	}
 * 	return h.Sum64()
 * }
 */
export function hashEntries(entries) {
    const dirs = [...entries.Directories].sort(compareGoStrings);
    const files = [...entries.Files].sort(compareGoStrings);
    const h = xxh3.New();
    for (const name of dirs) {
        h.WriteString("d:");
        h.WriteString(name);
        h.Write([0]);
    }
    for (const name of files) {
        h.WriteString("f:");
        h.WriteString(name);
        h.Write([0]);
    }
    return h.Sum64();
}
const utf8Encoder = new globalThis.TextEncoder();
function compareGoStrings(left, right) {
    const leftBytes = utf8Encoder.encode(left);
    const rightBytes = utf8Encoder.encode(right);
    const minLength = globalThis.Math.min(leftBytes.length, rightBytes.length);
    for (let index = 0; index < minLength; index++) {
        const diff = leftBytes[index] - rightBytes[index];
        if (diff !== 0) {
            return diff;
        }
    }
    return leftBytes.length - rightBytes.length;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::func::dirChanged","kind":"func","status":"implemented","sigHash":"fd6315920a54dee4293ccbc5ed20aa339f1159daff4abb261512a36cef4044c8","bodyHash":"27d3ee0ebcffb8710614531515990414cf27778989bff583dd3a8ac3b38e2047"}
 *
 * Go source:
 * func dirChanged(fs vfs.FS, baseline map[string]WatchEntry, dir string) bool {
 * 	entry, ok := baseline[dir]
 * 	if !ok {
 * 		return true
 * 	}
 * 	if entry.ChildrenHash != 0 {
 * 		entries := fs.GetAccessibleEntries(dir)
 * 		if hashEntries(entries) != entry.ChildrenHash {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function dirChanged(fs, baseline, dir) {
    const entry = baseline.get(dir);
    if (entry === undefined) {
        return true;
    }
    if (entry.ChildrenHash !== 0) {
        const entries = fs.GetAccessibleEntries(dir);
        if (hashEntries(entries) !== entry.ChildrenHash) {
            return true;
        }
    }
    return false;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.hasChanges","kind":"method","status":"implemented","sigHash":"68dcd45225e9be413b6fe3fcbc136fd044c4352599484f955756f33c08d79a74","bodyHash":"02d2105bfbb745aa31dab48e68c5871ed93724df998ab6b576ad3b231ff042af"}
 *
 * Go source:
 * func (fw *FileWatcher) hasChanges(baseline map[string]WatchEntry, wildcardDirs map[string]bool) bool {
 * 	for path, old := range baseline {
 * 		s := fw.fs.Stat(path)
 * 		if !old.Exists {
 * 			if s != nil {
 * 				return true
 * 			}
 * 		} else {
 * 			if s == nil || !s.ModTime().Equal(old.ModTime) {
 * 				return true
 * 			}
 * 			if old.ChildrenHash != 0 {
 * 				entries := fw.fs.GetAccessibleEntries(path)
 * 				if hashEntries(entries) != old.ChildrenHash {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	}
 * 	for dir, recursive := range wildcardDirs {
 * 		if !recursive {
 * 			if dirChanged(fw.fs, baseline, dir) {
 * 				return true
 * 			}
 * 			continue
 * 		}
 * 		found := false
 * 		_ = fw.fs.WalkDir(dir, func(path string, d vfs.DirEntry, err error) error {
 * 			if err != nil || !d.IsDir() {
 * 				return nil
 * 			}
 * 			if dirChanged(fw.fs, baseline, path) {
 * 				found = true
 * 				return vfs.SkipAll
 * 			}
 * 			return nil
 * 		})
 * 		if found {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function FileWatcher_hasChanges(receiver, baseline, wildcardDirs) {
    for (const [path, old] of baseline) {
        const s = receiver.fs.Stat(path);
        if (!old.Exists) {
            if (s !== undefined) {
                return true;
            }
        }
        else {
            if (s === undefined || !s.ModTime().Equal(old.ModTime)) {
                return true;
            }
            if (old.ChildrenHash !== 0) {
                const entries = receiver.fs.GetAccessibleEntries(path);
                if (hashEntries(entries) !== old.ChildrenHash) {
                    return true;
                }
            }
        }
    }
    for (const [dir, recursive] of wildcardDirs) {
        if (!recursive) {
            if (dirChanged(receiver.fs, baseline, dir)) {
                return true;
            }
            continue;
        }
        let found = false;
        void receiver.fs.WalkDir(dir, ((path, d, err) => {
            if (err !== undefined || !d.IsDir()) {
                return undefined;
            }
            if (dirChanged(receiver.fs, baseline, path)) {
                found = true;
                return SkipAll;
            }
            return undefined;
        }));
        if (found) {
            return true;
        }
    }
    return false;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.HasChangesFromWatchState","kind":"method","status":"implemented","sigHash":"24e1f71273f5c54332955f9e73552aff791d3e3e4a82af46bc2119a71b1bdb1f","bodyHash":"ed8ac896a69b0c841d6773e99fb3a101eb55d1717279fc0106a5a66535fe3fca"}
 *
 * Go source:
 * func (fw *FileWatcher) HasChangesFromWatchState() bool {
 * 	fw.mu.Lock()
 * 	ws := fw.watchState
 * 	wildcardDirs := fw.wildcardDirectories
 * 	fw.mu.Unlock()
 * 	return fw.hasChanges(ws, wildcardDirs)
 * }
 */
export function FileWatcher_HasChangesFromWatchState(receiver) {
    receiver.mu.Lock();
    const ws = receiver.watchState;
    const wildcardDirs = receiver.wildcardDirectories;
    receiver.mu.Unlock();
    return FileWatcher_hasChanges(receiver, ws, wildcardDirs);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/vfs/vfswatch/vfswatch.go::method::FileWatcher.Run","kind":"method","status":"implemented","sigHash":"9299e4d82ebbc5bc7e97791c723e61de01056139bac683084e49157ad2996875","bodyHash":"57cbf27efcb819ef80580207a6061e843c7163883d932bc5163950d9129be8de"}
 *
 * Go source:
 * func (fw *FileWatcher) Run(now func() time.Time) {
 * 	for {
 * 		fw.mu.Lock()
 * 		interval := fw.pollInterval
 * 		ws := fw.watchState
 * 		wildcardDirs := fw.wildcardDirectories
 * 		fw.mu.Unlock()
 * 		time.Sleep(interval)
 * 		if ws == nil || fw.hasChanges(ws, wildcardDirs) {
 * 			fw.WaitForSettled(now)
 * 			fw.callback()
 * 		}
 * 	}
 * }
 */
export function FileWatcher_Run(receiver, now) {
    // In single-threaded JS, the infinite polling loop with time.Sleep cannot run;
    // this is a no-op placeholder matching the Go goroutine structure.
    void receiver;
    void now;
}
//# sourceMappingURL=vfswatch.js.map