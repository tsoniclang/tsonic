import { NewGoStructMap } from "../../go/compat.js";
import { Errorf, Sprintf } from "../../go/fmt.js";
import { SortFunc } from "../../go/slices.js";
import { Builder, Compare } from "../../go/strings.js";
import { Itoa } from "../../go/strconv.js";
import { Mutex } from "../../go/sync.js";
import { Bool } from "../../go/sync/atomic.js";
import * as xxh3 from "../../go/github.com/zeebo/xxh3.js";
import { SourceFile_ECMALineMap, SourceFile_FileName, SourceFile_Text } from "../ast/ast.js";
import { EscapeAllInternalSymbolNames } from "../ast/symbol.js";
import { Node_End } from "../ast/spine.js";
import { GetSourceFileOfNode } from "../ast/utilities.js";
import { Deterministic, MarshalIndent, MarshalWrite } from "../json/json.js";
import { GetECMALineAndUTF16CharacterOfPosition, GetTokenPosOfNode } from "../scanner/scanner.js";
import { CombinePaths, ToPath } from "../tspath/path.js";
// string([]byte) conversion, matching the established decode idiom used by the
// other ported internal files.
const utf8Decoder = new globalThis.TextDecoder("utf-8");
const bytesToString = (b) => utf8Decoder.decode(globalThis.Uint8Array.from(b));
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::sampleInterval","kind":"constGroup","status":"implemented","sigHash":"25c973b1afe221ef6ac3524ebb2277caae5ae583959b55818a02cf688bcce16d","bodyHash":"63ef002d0cd8813105bc046fa2b3273461b215f34158c33d7a816aa530b3d6fa"}
 *
 * Go source:
 * const sampleInterval = 10 * time.Millisecond
 */
// 10 * time.Millisecond expressed in nanoseconds (Go time.Duration unit).
// Push uses sampleInterval / 1000.0 to convert to microseconds for comparison.
export const sampleInterval = 10_000_000;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::traceFileName","kind":"constGroup","status":"implemented","sigHash":"5ce6bcd3404ffeb42b22630f2857b4ab142cfc3b645f64ab3fde0715b125adb1","bodyHash":"5e409ad7ec15a4441743658e2084dfb54340ea5f500b8faa5633c6b04dce2adb"}
 *
 * Go source:
 * const traceFileName = "trace.json"
 */
export const traceFileName = "trace.json";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::flushThreshold","kind":"constGroup","status":"implemented","sigHash":"cef73237434416f0a15d4a047bdf3f741fa02d391e4498a7d55a733ffb954c41","bodyHash":"2837be96789ec61b1d70ba31dff156fd49bf42bf74bfca597af48616205ca359"}
 *
 * Go source:
 * const flushThreshold = 256 * 1024
 */
export const flushThreshold = 256 * 1024;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::PhaseParse+PhaseProgram+PhaseBind+PhaseCheck+PhaseCheckTypes+PhaseEmit+PhaseSession","kind":"constGroup","status":"implemented","sigHash":"06b838ba2c0b7f081e06caa541fc7c5a4921203fdbe61907e8f7fe5abbb73bc4","bodyHash":"4c308e475b18aa5105166da12a5ad8b5e888a5be050b026bc086647b79e468a3"}
 *
 * Go source:
 * const (
 * 	PhaseParse      Phase = "parse"
 * 	PhaseProgram    Phase = "program"
 * 	PhaseBind       Phase = "bind"
 * 	PhaseCheck      Phase = "check"
 * 	PhaseCheckTypes Phase = "checkTypes"
 * 	PhaseEmit       Phase = "emit"
 * 	PhaseSession    Phase = "session"
 * )
 */
export const PhaseParse = "parse";
export const PhaseProgram = "program";
export const PhaseBind = "bind";
export const PhaseCheck = "check";
export const PhaseCheckTypes = "checkTypes";
export const PhaseEmit = "emit";
export const PhaseSession = "session";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::StartTracing","kind":"func","status":"implemented","sigHash":"f8a080c13c359705b29a921436a3d137cb4907b12330f2a0394850336b83a2e4","bodyHash":"16525da0ff94556d0b22d94d20908e75912cd2cc34c613a3939632cbd119ac1f"}
 *
 * Go source:
 * func StartTracing(fs vfs.FS, traceDir string, configFilePath string, deterministic bool) (*Tracing, error) {
 * 	tr := &Tracing{
 * 		fs:             fs,
 * 		traceDir:       traceDir,
 * 		tracePath:      tspath.CombinePaths(traceDir, traceFileName),
 * 		configFilePath: configFilePath,
 * 		legend:         []TraceRecord{},
 * 		tracers:        []*typeTracer{},
 * 		deterministic:  deterministic,
 * 		startTime:      time.Now(),
 * 	}
 * 	tr.traceStarted.Store(true)
 *
 * 	// Write the trace file header with metadata events
 * 	tr.traceContent.WriteString("[\n")
 *
 * 	// Write metadata events (matching TypeScript's format)
 * 	metaTs := tr.timestamp()
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "process_name", Args: map[string]any{"name": "tsgo"}})
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "__metadata", TS: metaTs, Name: "thread_name", Args: map[string]any{"name": "Main"}})
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "M", Cat: "disabled-by-default-devtools.timeline", TS: metaTs, Name: "TracingStartedInBrowser"})
 *
 * 	// Truncate any existing trace file with the header so subsequent AppendFile
 * 	// calls extend a clean file.
 * 	if err := tr.fs.WriteFile(tr.tracePath, tr.traceContent.String()); err != nil {
 * 		return nil, fmt.Errorf("failed to write trace file header: %w", err)
 * 	}
 * 	tr.traceContent.Reset()
 *
 * 	return tr, nil
 * }
 */
export function StartTracing(fs, traceDir, configFilePath, deterministic) {
    const traceContent = new Builder();
    const traceStarted = new Bool();
    const tr = {
        fs: fs,
        traceDir: traceDir,
        tracePath: CombinePaths(traceDir, traceFileName),
        configFilePath: configFilePath,
        legend: [],
        tracers: [],
        traceContent: traceContent,
        traceStarted: traceStarted,
        threadIDs: NewGoStructMap(),
        threadKeys: new globalThis.Map(),
        metadataTS: 0,
        deterministic: deterministic,
        timestampCounter: 0,
        startTime: {},
        mu: new Mutex(),
        flushErr: undefined,
    };
    tr.traceStarted.Store(true);
    // Write the trace file header with metadata events
    tr.traceContent.WriteString("[\n");
    // Write metadata events (matching TypeScript's format)
    const metaTs = Tracing_timestamp(tr);
    tr.metadataTS = metaTs;
    Tracing_writeEvent(tr, { PID: 1, TID: mainThreadID, PH: "M", Cat: "__metadata", TS: metaTs, Name: "process_name", S: "", Dur: undefined, Args: new globalThis.Map([["name", "tsgo"]]) });
    tr.traceContent.WriteString(",\n");
    Tracing_writeEvent(tr, { PID: 1, TID: mainThreadID, PH: "M", Cat: "__metadata", TS: metaTs, Name: "thread_name", S: "", Dur: undefined, Args: new globalThis.Map([["name", "Main"]]) });
    tr.traceContent.WriteString(",\n");
    Tracing_writeEvent(tr, { PID: 1, TID: mainThreadID, PH: "M", Cat: "disabled-by-default-devtools.timeline", TS: metaTs, Name: "TracingStartedInBrowser", S: "", Dur: undefined, Args: undefined });
    // Truncate any existing trace file with the header so subsequent AppendFile
    // calls extend a clean file.
    const err = tr.fs.WriteFile(tr.tracePath, tr.traceContent.String());
    if (err !== undefined) {
        return [undefined, Errorf("failed to write trace file header: %w", err)];
    }
    tr.traceContent.Reset();
    return [tr, undefined];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.timestamp","kind":"method","status":"implemented","sigHash":"7b52274f7d713d510dc1aac4a8e1f31e498084e240ba050f6b871fde75fcebc6","bodyHash":"f9b5765e3183bdf2a02a5cd15497698464424bab3a66006595e19d0aa2b68adb"}
 *
 * Go source:
 * func (tr *Tracing) timestamp() float64 {
 * 	if tr.deterministic {
 * 		tr.timestampCounter++
 * 		return float64(tr.timestampCounter)
 * 	}
 * 	return float64(time.Since(tr.startTime).Nanoseconds()) / 1000.0
 * }
 */
export function Tracing_timestamp(receiver) {
    const tr = receiver;
    if (tr.deterministic) {
        tr.timestampCounter = (tr.timestampCounter + 1);
        return tr.timestampCounter;
    }
    // time.Since(tr.startTime).Nanoseconds() / 1000.0 — performance.now() gives ms, multiply by 1000 for microseconds
    return (globalThis.performance.now() * 1000.0);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::writeEventTo","kind":"func","status":"implemented","sigHash":"dd8580a528968c3a11ce3a4ed88fd012df13a8619b9d4eaf033fb2028d175f59","bodyHash":"354a91fd0a37d0bef9f8e1afbe5bde4ff0242de50af38dcc4ee97bff9d668c64"}
 *
 * Go source:
 * func writeEventTo(buf *strings.Builder, event traceEvent) {
 * 	if err := json.MarshalWrite(buf, event, json.Deterministic(true)); err != nil {
 * 		panic(fmt.Sprintf("failed to marshal trace event: %v", err))
 * 	}
 * }
 */
export function writeEventTo(buf, event) {
    const err = MarshalWrite(buf, event, Deterministic(true));
    if (err !== undefined) {
        throw new globalThis.Error(Sprintf("failed to marshal trace event: %v", err));
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.writeEvent","kind":"method","status":"implemented","sigHash":"e861cdb9e060a518b3ee4c97ac32052b0fadb6d511261c038cac20e1ae0f86c2","bodyHash":"11f7d57e84140f0c6ccbcbe384b724dfcdd8375f5f591a8bc97c0d7d5f25be92"}
 *
 * Go source:
 * func (tr *Tracing) writeEvent(event traceEvent) {
 * 	writeEventTo(&tr.traceContent, event)
 * }
 */
export function Tracing_writeEvent(receiver, event) {
    writeEventTo(receiver.traceContent, event);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.maybeFlushLocked","kind":"method","status":"implemented","sigHash":"24eeee0eae95bc40185fcdfcb5fdea50b0541197ca2b454417c6df002d527c45","bodyHash":"547f1210d18dffa787df8fd73106079b580d244d2adfdd5ebf306cdba9c49822"}
 *
 * Go source:
 * func (tr *Tracing) maybeFlushLocked() {
 * 	if tr.flushErr != nil {
 * 		tr.traceContent.Reset()
 * 		return
 * 	}
 * 	if tr.traceContent.Len() < flushThreshold {
 * 		return
 * 	}
 * 	if err := tr.fs.AppendFile(tr.tracePath, tr.traceContent.String()); err != nil {
 * 		tr.flushErr = fmt.Errorf("failed to flush trace file: %w", err)
 * 	}
 * 	tr.traceContent.Reset()
 * }
 */
export function Tracing_maybeFlushLocked(receiver) {
    const tr = receiver;
    if (tr.flushErr !== undefined) {
        tr.traceContent.Reset();
        return;
    }
    if (tr.traceContent.Len() < flushThreshold) {
        return;
    }
    const err = tr.fs.AppendFile(tr.tracePath, tr.traceContent.String());
    if (err !== undefined) {
        tr.flushErr = Errorf("failed to flush trace file: %w", err);
    }
    tr.traceContent.Reset();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.Instant","kind":"method","status":"implemented","sigHash":"e72ba6ff68ef9b87d7ce9af888330afdabda477c1cc3070b04b1a13d81c2c477","bodyHash":"8a069e49367f2e7fe80f5f42b9ee914598bfb7011bc7eec8a75cecdef07bebfd"}
 *
 * Go source:
 * func (tr *Tracing) Instant(phase Phase, name string, args map[string]any) {
 * 	if tr == nil || !tr.traceStarted.Load() {
 * 		return
 * 	}
 *
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	// Re-check under the lock: StopTracing may have run between the load above
 * 	// and acquiring the lock. Once stopped, further writes would land in a buffer
 * 	// that has already been flushed and the closing "]" written.
 * 	if !tr.traceStarted.Load() {
 * 		return
 * 	}
 *
 * 	ts := tr.timestamp()
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "I", Cat: string(phase), TS: ts, Name: name, S: "g", Args: args})
 * 	tr.maybeFlushLocked()
 * }
 */
export function Tracing_Instant(receiver, phase, name, args) {
    const tr = receiver;
    if (tr === undefined || !tr.traceStarted.Load()) {
        return;
    }
    tr.mu.Lock();
    try {
        // Re-check under the lock: StopTracing may have run between the load above
        // and acquiring the lock. Once stopped, further writes would land in a buffer
        // that has already been flushed and the closing "]" written.
        if (!tr.traceStarted.Load()) {
            return;
        }
        const ts = Tracing_timestamp(tr);
        const tid = Tracing_threadIDLocked(tr, args);
        tr.traceContent.WriteString(",\n");
        Tracing_writeEvent(tr, { PID: 1, TID: tid, PH: "I", Cat: phase, TS: ts, Name: name, S: "g", Args: args, Dur: undefined });
        Tracing_maybeFlushLocked(tr);
    }
    finally {
        tr.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.Push","kind":"method","status":"implemented","sigHash":"f718c05374a354a9bd493a2b4808be89935c9995e89990c29664a18f9c0d8253","bodyHash":"8405e0cf4cb3df02e667cda24b786ace3e373b28cbc260e7a2bf93974eb71650"}
 *
 * Go source:
 * func (tr *Tracing) Push(phase Phase, name string, args map[string]any, separateBeginAndEnd bool) func() {
 * 	if tr == nil || !tr.traceStarted.Load() {
 * 		return func() {}
 * 	}
 *
 * 	if separateBeginAndEnd {
 * 		tr.mu.Lock()
 * 		if !tr.traceStarted.Load() {
 * 			tr.mu.Unlock()
 * 			return func() {}
 * 		}
 * 		ts := tr.timestamp()
 * 		tr.traceContent.WriteString(",\n")
 * 		tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "B", Cat: string(phase), TS: ts, Name: name, Args: args})
 * 		tr.maybeFlushLocked()
 * 		tr.mu.Unlock()
 *
 * 		return func() {
 * 			tr.mu.Lock()
 * 			defer tr.mu.Unlock()
 * 			if !tr.traceStarted.Load() {
 * 				return
 * 			}
 * 			endTs := tr.timestamp()
 * 			tr.traceContent.WriteString(",\n")
 * 			tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "E", Cat: string(phase), TS: endTs, Name: name, Args: args})
 * 			tr.maybeFlushLocked()
 * 		}
 * 	}
 *
 * 	// Sampled event: only record if duration crosses a sampling boundary.
 * 	// In deterministic mode, sampled events are skipped entirely to avoid flaky baselines,
 * 	// so avoid the cost of cloning args / capturing the start time.
 * 	if tr.deterministic {
 * 		return func() {}
 * 	}
 * 	startTime := time.Now()
 * 	args = maps.Clone(args)
 * 	return func() {
 * 		dur := float64(time.Since(startTime).Nanoseconds()) / 1000.0
 * 		startMicros := float64(startTime.Sub(tr.startTime).Nanoseconds()) / 1000.0
 * 		intervalMicros := float64(sampleInterval.Nanoseconds()) / 1000.0
 * 		if intervalMicros-math.Mod(startMicros, intervalMicros) > dur {
 * 			return
 * 		}
 * 		tr.mu.Lock()
 * 		defer tr.mu.Unlock()
 * 		if !tr.traceStarted.Load() {
 * 			return
 * 		}
 * 		tr.traceContent.WriteString(",\n")
 * 		tr.writeEvent(traceEvent{PID: 1, TID: 1, PH: "X", Cat: string(phase), TS: startMicros, Name: name, Dur: &dur, Args: args})
 * 		tr.maybeFlushLocked()
 * 	}
 * }
 */
export function Tracing_Push(receiver, phase, name, args, separateBeginAndEnd) {
    const tr = receiver;
    if (tr === undefined || !tr.traceStarted.Load()) {
        return () => { };
    }
    if (separateBeginAndEnd) {
        tr.mu.Lock();
        if (!tr.traceStarted.Load()) {
            tr.mu.Unlock();
            return () => { };
        }
        const ts = Tracing_timestamp(tr);
        const tid = Tracing_threadIDLocked(tr, args);
        tr.traceContent.WriteString(",\n");
        Tracing_writeEvent(tr, { PID: 1, TID: tid, PH: "B", Cat: phase, TS: ts, Name: name, S: "", Dur: undefined, Args: args });
        Tracing_maybeFlushLocked(tr);
        tr.mu.Unlock();
        return () => {
            tr.mu.Lock();
            try {
                if (!tr.traceStarted.Load()) {
                    return;
                }
                const endTs = Tracing_timestamp(tr);
                tr.traceContent.WriteString(",\n");
                Tracing_writeEvent(tr, { PID: 1, TID: tid, PH: "E", Cat: phase, TS: endTs, Name: name, S: "", Dur: undefined, Args: args });
                Tracing_maybeFlushLocked(tr);
            }
            finally {
                tr.mu.Unlock();
            }
        };
    }
    // Sampled event: only record if duration crosses a sampling boundary.
    // In deterministic mode, sampled events are skipped entirely to avoid flaky baselines.
    if (tr.deterministic) {
        return () => { };
    }
    const startMicros = (globalThis.performance.now() * 1000.0);
    const argsClone = new globalThis.Map(args);
    return () => {
        const endMicros = (globalThis.performance.now() * 1000.0);
        const dur = endMicros - startMicros;
        const intervalMicros = (sampleInterval / 1000.0);
        if (intervalMicros - (startMicros % intervalMicros) > dur) {
            return;
        }
        tr.mu.Lock();
        try {
            if (!tr.traceStarted.Load()) {
                return;
            }
            const tid = Tracing_threadIDLocked(tr, argsClone);
            tr.traceContent.WriteString(",\n");
            Tracing_writeEvent(tr, { PID: 1, TID: tid, PH: "X", Cat: phase, TS: startMicros, Name: name, S: "", Dur: dur, Args: argsClone });
            Tracing_maybeFlushLocked(tr);
        }
        finally {
            tr.mu.Unlock();
        }
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::mainThreadID+firstSyntheticThreadID+firstFileThreadID+fileThreadIDHashRange","kind":"constGroup","status":"implemented","sigHash":"60e7590297c05ffd027e870a840301d2b6ac1414b64383ce11f3afbd17a7edaf","bodyHash":"3fa047d29ab928ac01022d74e3ddc3f30bc66bc5e0e8391f17e76788f513ca13"}
 *
 * Go source:
 * const (
 * 	mainThreadID           = 1
 * 	firstSyntheticThreadID = 2
 * 	firstFileThreadID      = 1_000_000
 * 	fileThreadIDHashRange  = 1_000_000_000
 * )
 */
export const mainThreadID = 1;
export const firstSyntheticThreadID = 2;
export const firstFileThreadID = 1_000_000;
export const fileThreadIDHashRange = 1_000_000_000;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::varGroup::traceThreadArgKeys","kind":"varGroup","status":"implemented","sigHash":"8833f96a4cab6103fbed8e8d7111a13a908e203063040d13de4ee77fd99de5e8","bodyHash":"9417cbffd7c0e527a62aa76bbcd4b85ab717815dd7737d538c976204577c8e01"}
 *
 * Go source:
 * var traceThreadArgKeys = [...]string{"path", "fileName", "containingFileName", "jsFilePath", "declarationFilePath"}
 */
export const traceThreadArgKeys = ["path", "fileName", "containingFileName", "jsFilePath", "declarationFilePath"];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::constGroup::traceThreadKindChecker+traceThreadKindFile","kind":"constGroup","status":"implemented","sigHash":"58da3dc4aee3c81f7e7f68ebc820eab886e35c9099192ab2ecabf450ed93c7e6","bodyHash":"e49edb3db2a2be667b307cdfae95228c3b358d0250dc8f741a2d22572b686f69"}
 *
 * Go source:
 * const (
 * 	traceThreadKindChecker traceThreadKind = "checker"
 * 	traceThreadKindFile    traceThreadKind = "file"
 * )
 */
export const traceThreadKindChecker = "checker";
export const traceThreadKindFile = "file";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.threadIDLocked","kind":"method","status":"implemented","sigHash":"304e42395e9673f6b5b3d524230ffeca9053b6177cdeba9f70994df31a81167a","bodyHash":"2c65a947c18fcc4f12f1d8a35ac445946dc4ec6342a3ee151cc5668edb35a2f0"}
 *
 * Go source:
 * func (tr *Tracing) threadIDLocked(args map[string]any) int {
 * 	key, ok := traceThreadKeyFromArgs(args)
 * 	if !ok {
 * 		return mainThreadID
 * 	}
 * 	if tid, ok := tr.threadIDs[key]; ok {
 * 		return tid
 * 	}
 * 	tid := key.defaultThreadID()
 * 	for {
 * 		if existingKey, ok := tr.threadKeys[tid]; !ok || existingKey == key {
 * 			break
 * 		}
 * 		tid++
 * 	}
 * 	tr.threadIDs[key] = tid
 * 	tr.threadKeys[tid] = key
 * 	tr.writeThreadNameEventLocked(tid, key.displayName())
 * 	return tid
 * }
 */
export function Tracing_threadIDLocked(receiver, args) {
    const tr = receiver;
    const [key, ok] = traceThreadKeyFromArgs(args);
    if (!ok) {
        return mainThreadID;
    }
    const existing = tr.threadIDs.get(key);
    if (existing !== undefined) {
        return existing;
    }
    let tid = traceThreadKey_defaultThreadID(key);
    for (;;) {
        const existingKey = tr.threadKeys.get(tid);
        if (existingKey === undefined ||
            (existingKey.kind === key.kind && existingKey.text === key.text && existingKey.index === key.index && existingKey.hasIndex === key.hasIndex)) {
            break;
        }
        tid = (tid + 1);
    }
    tr.threadIDs.set(key, tid);
    tr.threadKeys.set(tid, key);
    Tracing_writeThreadNameEventLocked(tr, tid, traceThreadKey_displayName(key));
    return tid;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.writeThreadNameEventLocked","kind":"method","status":"implemented","sigHash":"3dc9dd268ba56bc3075bbbdba4cd70301eb9e0ca4c32807bca9306b882c29c7e","bodyHash":"a676a82629b7ca71436557ada5561504fa689ae7efc4bd84e7a4ea0da324f108"}
 *
 * Go source:
 * func (tr *Tracing) writeThreadNameEventLocked(tid int, name string) {
 * 	tr.traceContent.WriteString(",\n")
 * 	tr.writeEvent(traceEvent{PID: 1, TID: tid, PH: "M", Cat: "__metadata", TS: tr.metadataTS, Name: "thread_name", Args: map[string]any{"name": name}})
 * }
 */
export function Tracing_writeThreadNameEventLocked(receiver, tid, name) {
    const tr = receiver;
    tr.traceContent.WriteString(",\n");
    Tracing_writeEvent(tr, { PID: 1, TID: tid, PH: "M", Cat: "__metadata", TS: tr.metadataTS, Name: "thread_name", S: "", Dur: undefined, Args: new globalThis.Map([["name", name]]) });
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::traceThreadKeyFromArgs","kind":"func","status":"implemented","sigHash":"cbdb4de76873e98fafdc5a2f4f1aac74d7766fe349836f97b6c7fa38d06d46c0","bodyHash":"ca4b501f6ecc1cebc57bbbe2b6719130150298dcfbef477f5e4689932953920c"}
 *
 * Go source:
 * func traceThreadKeyFromArgs(args map[string]any) (traceThreadKey, bool) {
 * 	if len(args) == 0 {
 * 		return traceThreadKey{}, false
 * 	}
 * 	if checkerID, ok := args["checkerId"].(int); ok {
 * 		return traceThreadKey{kind: traceThreadKindChecker, index: checkerID, hasIndex: true}, true
 * 	}
 * 	for _, key := range traceThreadArgKeys {
 * 		if value, ok := args[key]; ok {
 * 			if path, ok := value.(string); ok && path != "" {
 * 				return traceThreadKey{kind: traceThreadKindFile, text: path}, true
 * 			}
 * 		}
 * 	}
 * 	return traceThreadKey{}, false
 * }
 */
export function traceThreadKeyFromArgs(args) {
    if ((args?.size ?? 0) === 0) {
        return [{ kind: "", text: "", index: 0, hasIndex: false }, false];
    }
    const checkerID = args.get("checkerId");
    if (typeof checkerID === "number") {
        return [{ kind: traceThreadKindChecker, text: "", index: checkerID, hasIndex: true }, true];
    }
    for (const key of traceThreadArgKeys) {
        if (args.has(key)) {
            const value = args.get(key);
            if (typeof value === "string" && value !== "") {
                const path = value;
                return [{ kind: traceThreadKindFile, text: path, index: 0, hasIndex: false }, true];
            }
        }
    }
    return [{ kind: "", text: "", index: 0, hasIndex: false }, false];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::traceThreadKey.defaultThreadID","kind":"method","status":"implemented","sigHash":"0c8fc69363c5075f52f725337f67f97330c6e457ef768ce72acf2189f986e98d","bodyHash":"0585eed593c610a5aa94493b8d6cb60159a7c097df546de8b84a88cb9faac679"}
 *
 * Go source:
 * func (key traceThreadKey) defaultThreadID() int {
 * 	if key.kind == traceThreadKindChecker && key.hasIndex && key.index >= 0 {
 * 		return firstSyntheticThreadID + key.index
 * 	}
 * 	return stableTraceThreadID(key)
 * }
 */
export function traceThreadKey_defaultThreadID(receiver) {
    const key = receiver;
    if (key.kind === traceThreadKindChecker && key.hasIndex && key.index >= 0) {
        return (firstSyntheticThreadID + key.index);
    }
    return stableTraceThreadID(key);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::traceThreadKey.displayName","kind":"method","status":"implemented","sigHash":"af124d3df76bb3036a31429f9ddbb97fc58bdef59f317b5fbdc5eb2d45a13a88","bodyHash":"d4befe4a98a857ea4602f2c9427c5e21820f394175e65b9b9c718f98136c1a11"}
 *
 * Go source:
 * func (key traceThreadKey) displayName() string {
 * 	if key.hasIndex {
 * 		return string(key.kind) + ":" + strconv.Itoa(key.index)
 * 	}
 * 	return string(key.kind) + ":" + key.text
 * }
 */
export function traceThreadKey_displayName(receiver) {
    const key = receiver;
    if (key.hasIndex) {
        return key.kind + ":" + Itoa(key.index);
    }
    return key.kind + ":" + key.text;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::stableTraceThreadID","kind":"func","status":"implemented","sigHash":"9f3ff73ae7deb2d1f61e170327a20d4e0fc2ef05af5634cced4912b838046b41","bodyHash":"df776e05b389188aacf18ac03304eba07c6b397b347a30cfb1b99f4d5e962a77"}
 *
 * Go source:
 * func stableTraceThreadID(key traceThreadKey) int {
 * 	hash := xxh3.New()
 * 	_, _ = hash.WriteString(string(key.kind))
 * 	_, _ = hash.WriteString(":")
 * 	if key.hasIndex {
 * 		_, _ = hash.WriteString(strconv.Itoa(key.index))
 * 	} else {
 * 		_, _ = hash.WriteString(key.text)
 * 	}
 * 	return firstFileThreadID + int(hash.Sum64()%fileThreadIDHashRange)
 * }
 */
export function stableTraceThreadID(key) {
    const hash = xxh3.New();
    hash.WriteString(key.kind);
    hash.WriteString(":");
    if (key.hasIndex) {
        hash.WriteString(Itoa(key.index));
    }
    else {
        hash.WriteString(key.text);
    }
    const sum = hash.Sum64();
    return (firstFileThreadID + globalThis.Number(sum % globalThis.BigInt(fileThreadIDHashRange)));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.NewTypeTracer","kind":"method","status":"implemented","sigHash":"15d85ee1a5aee224cc129c19c1afa25e103db4ab07b29d61d08fc2d1c9bcfb64","bodyHash":"ba3f3dc34781cf258f63b6a42fc942e561ecfdf84623bf11d48676ab03308bb1"}
 *
 * Go source:
 * func (tr *Tracing) NewTypeTracer(checkerIndex int) Tracer {
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	typesPath := tspath.CombinePaths(tr.traceDir, fmt.Sprintf("types_%d.json", checkerIndex))
 * 	tracer := &typeTracer{
 * 		fs:           tr.fs,
 * 		checkerIndex: checkerIndex,
 * 		typesPath:    typesPath,
 * 		types:        []TracedType{},
 * 	}
 * 	tr.tracers = append(tr.tracers, tracer)
 * 	tr.legend = append(tr.legend, TraceRecord{
 * 		ConfigFilePath: tr.configFilePath,
 * 		TracePath:      tr.tracePath,
 * 		TypesPath:      typesPath,
 * 		CheckerID:      checkerIndex,
 * 	})
 * 	return tracer
 * }
 */
export function Tracing_NewTypeTracer(receiver, checkerIndex) {
    const tr = receiver;
    tr.mu.Lock();
    try {
        const typesPath = CombinePaths(tr.traceDir, Sprintf("types_%d.json", checkerIndex));
        const tracer = {
            fs: tr.fs,
            checkerIndex: checkerIndex,
            typesPath: typesPath,
            types: [],
            mu: new Mutex(),
        };
        tr.tracers = [...tr.tracers, tracer];
        tr.legend = [
            ...tr.legend,
            {
                ConfigFilePath: tr.configFilePath,
                TracePath: tr.tracePath,
                TypesPath: typesPath,
                CheckerID: checkerIndex,
            },
        ];
        return typeTracer_as_Tracer(tracer);
    }
    finally {
        tr.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::Tracing.StopTracing","kind":"method","status":"implemented","sigHash":"d03472b1307ce51d2332d35aeb4c650ed9277e5b6cd2b2739ed9fc586a559797","bodyHash":"eff1ffa5ddae7375a845e4cb70832f590d03cab823a4bc0c377fd6b42d521078"}
 *
 * Go source:
 * func (tr *Tracing) StopTracing() error {
 * 	// Dump types from all tracers BEFORE acquiring the lock, because
 * 	// DumpTypes → buildTypeDescriptor → Display() → TypeToString can
 * 	// re-enter the checker which calls Push/Pop (which need tr.mu).
 * 	for _, tracer := range tr.tracers {
 * 		if err := tracer.DumpTypes(); err != nil {
 * 			return fmt.Errorf("failed to dump types for checker %d: %w", tracer.checkerIndex, err)
 * 		}
 * 	}
 *
 * 	tr.mu.Lock()
 * 	defer tr.mu.Unlock()
 *
 * 	// Close the trace file(s)
 * 	if tr.traceStarted.Load() {
 * 		// Surface any buffered flush failure before attempting the final write.
 * 		if tr.flushErr != nil {
 * 			tr.traceContent.Reset()
 * 			tr.traceStarted.Store(false)
 * 			return tr.flushErr
 * 		}
 * 		// Flush any remaining buffered content and close the JSON array.
 * 		if err := tr.fs.AppendFile(tr.tracePath, tr.traceContent.String()+"\n]\n"); err != nil {
 * 			return fmt.Errorf("failed to write trace file: %w", err)
 * 		}
 * 		tr.traceContent.Reset()
 * 		tr.traceStarted.Store(false)
 * 	}
 *
 * 	// Sort legend entries by typesPath for deterministic output
 * 	slices.SortFunc(tr.legend, func(a, b TraceRecord) int {
 * 		return strings.Compare(a.TypesPath, b.TypesPath)
 * 	})
 *
 * 	// Write the legend file
 * 	legendPath := tspath.CombinePaths(tr.traceDir, "legend.json")
 * 	legendData, err := json.MarshalIndent(tr.legend, "", "  ")
 * 	if err != nil {
 * 		return fmt.Errorf("failed to marshal legend file: %w", err)
 * 	}
 * 	if err := tr.fs.WriteFile(legendPath, string(legendData)); err != nil {
 * 		return fmt.Errorf("failed to write legend file: %w", err)
 * 	}
 *
 * 	return nil
 * }
 */
export function Tracing_StopTracing(receiver) {
    const tr = receiver;
    // Dump types from all tracers BEFORE acquiring the lock, because
    // DumpTypes → buildTypeDescriptor → Display() → TypeToString can
    // re-enter the checker which calls Push/Pop (which need tr.mu).
    for (const tracer of tr.tracers) {
        const err = typeTracer_DumpTypes(tracer);
        if (err !== undefined) {
            return Errorf("failed to dump types for checker %d: %w", tracer.checkerIndex, err);
        }
    }
    tr.mu.Lock();
    try {
        // Close the trace file(s)
        if (tr.traceStarted.Load()) {
            // Surface any buffered flush failure before attempting the final write.
            if (tr.flushErr !== undefined) {
                tr.traceContent.Reset();
                tr.traceStarted.Store(false);
                return tr.flushErr;
            }
            // Flush any remaining buffered content and close the JSON array.
            const err = tr.fs.AppendFile(tr.tracePath, tr.traceContent.String() + "\n]\n");
            if (err !== undefined) {
                return Errorf("failed to write trace file: %w", err);
            }
            tr.traceContent.Reset();
            tr.traceStarted.Store(false);
        }
        // Sort legend entries by typesPath for deterministic output
        SortFunc(tr.legend, (a, b) => {
            return Compare(a.TypesPath, b.TypesPath);
        });
        // Write the legend file
        const legendPath = CombinePaths(tr.traceDir, "legend.json");
        const [legendData, err] = MarshalIndent(tr.legend, "", "  ");
        if (err !== undefined) {
            return Errorf("failed to marshal legend file: %w", err);
        }
        const writeErr = tr.fs.WriteFile(legendPath, bytesToString(legendData));
        if (writeErr !== undefined) {
            return Errorf("failed to write legend file: %w", writeErr);
        }
        return undefined;
    }
    finally {
        tr.mu.Unlock();
    }
}
// typeTracer satisfies the Tracer interface; this method-bearing adapter binds
// the free functions to a concrete typeTracer receiver, matching Go interface
// satisfaction (the *typeTracer methods RecordType/DumpTypes).
export function typeTracer_as_Tracer(receiver) {
    return {
        RecordType(t) {
            typeTracer_RecordType(receiver, t);
        },
        DumpTypes() {
            return typeTracer_DumpTypes(receiver);
        },
    };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.RecordType","kind":"method","status":"implemented","sigHash":"9cc9e8c2a24e98a39130d1a9f22f9512e83d749c4572cf5c30873db16031cc4b","bodyHash":"0758d69293f2a188784c492ff4f2e062784bc579eed5172af20bc9f5cff4c808"}
 *
 * Go source:
 * func (t *typeTracer) RecordType(typ TracedType) {
 * 	t.mu.Lock()
 * 	defer t.mu.Unlock()
 * 	t.types = append(t.types, typ)
 * }
 */
export function typeTracer_RecordType(receiver, typ) {
    const t = receiver;
    t.mu.Lock();
    try {
        t.types = [...t.types, typ];
    }
    finally {
        t.mu.Unlock();
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.DumpTypes","kind":"method","status":"implemented","sigHash":"b119c267de31b5f4c742509c5db527378d5db1ac537ecaa34a7e6c346e860342","bodyHash":"56f8cb2d83dc9fbbf0c0e7c3895101938f1e8f190b34286c46a805b05d48b256"}
 *
 * Go source:
 * func (t *typeTracer) DumpTypes() error {
 * 	// Copy the types slice under lock, then release so Display() calls during
 * 	// buildTypeDescriptor don't deadlock when they create new types
 * 	t.mu.Lock()
 * 	types := slices.Clone(t.types)
 * 	t.mu.Unlock()
 *
 * 	if len(types) == 0 {
 * 		return nil
 * 	}
 *
 * 	var sb strings.Builder
 * 	// Write opening bracket (no newline so type ID matches line number)
 * 	sb.WriteString("[")
 *
 * 	recursionIdentityMap := make(map[any]int)
 *
 * 	for i, typ := range types {
 * 		descriptor := t.buildTypeDescriptor(typ, recursionIdentityMap)
 *
 * 		if err := json.MarshalWrite(&sb, descriptor); err != nil {
 * 			return fmt.Errorf("failed to marshal type %d: %w", typ.Id(), err)
 * 		}
 *
 * 		if i < len(types)-1 {
 * 			sb.WriteString(",\n")
 * 		}
 * 	}
 *
 * 	sb.WriteString("]\n")
 *
 * 	return t.fs.WriteFile(t.typesPath, sb.String())
 * }
 */
export function typeTracer_DumpTypes(receiver) {
    const t = receiver;
    // Copy the types slice under lock, then release so Display() calls during
    // buildTypeDescriptor don't deadlock when they create new types
    t.mu.Lock();
    const types = [...t.types];
    t.mu.Unlock();
    if (types.length === 0) {
        return undefined;
    }
    const sb = new Builder();
    // Write opening bracket (no newline so type ID matches line number)
    sb.WriteString("[");
    const recursionIdentityMap = new globalThis.Map();
    for (let i = 0; i < types.length; i++) {
        const typ = types[i];
        const descriptor = typeTracer_buildTypeDescriptor(t, typ, recursionIdentityMap);
        const err = MarshalWrite(sb, descriptor);
        if (err !== undefined) {
            return Errorf("failed to marshal type %d: %w", typ.Id(), err);
        }
        if (i < types.length - 1) {
            sb.WriteString(",\n");
        }
    }
    sb.WriteString("]\n");
    return t.fs.WriteFile(t.typesPath, sb.String());
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::method::typeTracer.buildTypeDescriptor","kind":"method","status":"implemented","sigHash":"04a6b82115bb4c64bc764c4e925957f93321131049d34ac7b904ba88c3294b8f","bodyHash":"358963800d018eeae6200128b36497e486790b6453e02be3d7ceecb9e8670c5c"}
 *
 * Go source:
 * func (t *typeTracer) buildTypeDescriptor(typ TracedType, recursionIdentityMap map[any]int) TypeDescriptor {
 * 	symbol := typ.Symbol()
 * 	aliasSymbol := typ.AliasSymbol()
 *
 * 	desc := TypeDescriptor{
 * 		ID:    typ.Id(),
 * 		Flags: typ.FormatFlags(),
 * 	}
 *
 * 	// Assign a unique integer token per recursion identity, matching TypeScript's behavior.
 * 	// This lets trace analysis tools detect which types share the same recursion identity.
 * 	if identity := typ.RecursionIdentity(); identity != nil {
 * 		token, ok := recursionIdentityMap[identity]
 * 		if !ok {
 * 			token = len(recursionIdentityMap)
 * 			recursionIdentityMap[identity] = token
 * 		}
 * 		desc.RecursionID = &token
 * 	}
 *
 * 	// Intrinsic name
 * 	if name := typ.IntrinsicName(); name != "" {
 * 		desc.IntrinsicName = name
 * 	}
 *
 * 	// Symbol name - escape the internal symbol name prefix for valid JSON
 * 	if sym := aliasSymbol; sym != nil {
 * 		desc.SymbolName = ast.EscapeAllInternalSymbolNames(sym.Name)
 * 	} else if symbol != nil {
 * 		desc.SymbolName = ast.EscapeAllInternalSymbolNames(symbol.Name)
 * 	}
 *
 * 	// Tuple flag
 * 	if typ.IsTuple() {
 * 		desc.IsTuple = true
 * 	}
 *
 * 	// Union types
 * 	if types := typ.UnionTypes(); len(types) > 0 {
 * 		desc.UnionTypes = mapTypeIds(types)
 * 	}
 *
 * 	// Intersection types
 * 	if types := typ.IntersectionTypes(); len(types) > 0 {
 * 		desc.IntersectionTypes = mapTypeIds(types)
 * 	}
 *
 * 	// Alias type arguments
 * 	if args := typ.AliasTypeArguments(); len(args) > 0 {
 * 		desc.AliasTypeArguments = mapTypeIds(args)
 * 	}
 *
 * 	// Index type (keyof)
 * 	if indexType := typ.IndexType(); indexType != nil {
 * 		desc.KeyofType = new(indexType.Id())
 * 	}
 *
 * 	// Indexed access type
 * 	if objType := typ.IndexedAccessObjectType(); objType != nil {
 * 		desc.IndexedAccessObjectType = new(objType.Id())
 * 	}
 * 	if idxType := typ.IndexedAccessIndexType(); idxType != nil {
 * 		desc.IndexedAccessIndexType = new(idxType.Id())
 * 	}
 *
 * 	// Conditional type
 * 	if typ.IsConditional() {
 * 		if checkType := typ.ConditionalCheckType(); checkType != nil {
 * 			desc.ConditionalCheckType = new(checkType.Id())
 * 		}
 * 		if extendsType := typ.ConditionalExtendsType(); extendsType != nil {
 * 			desc.ConditionalExtendsType = new(extendsType.Id())
 * 		}
 * 		if trueType := typ.ConditionalTrueType(); trueType != nil {
 * 			desc.ConditionalTrueType = new(int32(trueType.Id()))
 * 		} else {
 * 			desc.ConditionalTrueType = new(int32(-1))
 * 		}
 * 		if falseType := typ.ConditionalFalseType(); falseType != nil {
 * 			desc.ConditionalFalseType = new(int32(falseType.Id()))
 * 		} else {
 * 			desc.ConditionalFalseType = new(int32(-1))
 * 		}
 * 	}
 *
 * 	// Substitution type
 * 	if baseType := typ.SubstitutionBaseType(); baseType != nil {
 * 		desc.SubstitutionBaseType = new(baseType.Id())
 * 	}
 * 	if constraint := typ.SubstitutionConstraintType(); constraint != nil {
 * 		desc.ConstraintType = new(constraint.Id())
 * 	}
 *
 * 	// Reference type
 * 	if target := typ.ReferenceTarget(); target != nil {
 * 		desc.InstantiatedType = new(target.Id())
 * 	}
 * 	if args := typ.ReferenceTypeArguments(); len(args) > 0 {
 * 		desc.TypeArguments = mapTypeIds(args)
 * 	}
 * 	if node := typ.ReferenceNode(); node != nil {
 * 		desc.ReferenceLocation = getLocation(node)
 * 	}
 *
 * 	// Reverse mapped type
 * 	if sourceType := typ.ReverseMappedSourceType(); sourceType != nil {
 * 		desc.ReverseMappedSourceType = new(sourceType.Id())
 * 	}
 * 	if mappedType := typ.ReverseMappedMappedType(); mappedType != nil {
 * 		desc.ReverseMappedMappedType = new(mappedType.Id())
 * 	}
 * 	if constraintType := typ.ReverseMappedConstraintType(); constraintType != nil {
 * 		desc.ReverseMappedConstraintType = new(constraintType.Id())
 * 	}
 *
 * 	// Evolving array type
 * 	if elemType := typ.EvolvingArrayElementType(); elemType != nil {
 * 		desc.EvolvingArrayElementType = new(elemType.Id())
 * 	}
 * 	if finalType := typ.EvolvingArrayFinalType(); finalType != nil {
 * 		desc.EvolvingArrayFinalType = new(finalType.Id())
 * 	}
 *
 * 	// Pattern (destructuring)
 * 	if pattern := typ.Pattern(); pattern != nil {
 * 		desc.DestructuringPattern = getLocation(pattern)
 * 	}
 *
 * 	// First declaration - prefer aliasSymbol, matching TypeScript's `aliasSymbol ?? symbol`
 * 	firstDeclSymbol := aliasSymbol
 * 	if firstDeclSymbol == nil {
 * 		firstDeclSymbol = symbol
 * 	}
 * 	if firstDeclSymbol != nil && len(firstDeclSymbol.Declarations) > 0 {
 * 		desc.FirstDeclaration = getLocation(firstDeclSymbol.Declarations[0])
 * 	}
 *
 * 	// Display text
 * 	if display := typ.Display(); display != "" {
 * 		desc.Display = display
 * 	}
 *
 * 	return desc
 * }
 */
export function typeTracer_buildTypeDescriptor(receiver, typ, recursionIdentityMap) {
    const symbol = typ.Symbol();
    const aliasSymbol = typ.AliasSymbol();
    const desc = {
        ID: typ.Id(),
        Flags: typ.FormatFlags(),
        IntrinsicName: "",
        SymbolName: "",
        RecursionID: undefined,
        IsTuple: false,
        UnionTypes: [],
        IntersectionTypes: [],
        AliasTypeArguments: [],
        KeyofType: undefined,
        IndexedAccessObjectType: undefined,
        IndexedAccessIndexType: undefined,
        ConditionalCheckType: undefined,
        ConditionalExtendsType: undefined,
        ConditionalTrueType: undefined,
        ConditionalFalseType: undefined,
        SubstitutionBaseType: undefined,
        ConstraintType: undefined,
        InstantiatedType: undefined,
        TypeArguments: [],
        ReferenceLocation: undefined,
        ReverseMappedSourceType: undefined,
        ReverseMappedMappedType: undefined,
        ReverseMappedConstraintType: undefined,
        EvolvingArrayElementType: undefined,
        EvolvingArrayFinalType: undefined,
        DestructuringPattern: undefined,
        FirstDeclaration: undefined,
        Display: "",
    };
    // Assign a unique integer token per recursion identity, matching TypeScript's behavior.
    if (typ.RecursionIdentity() !== undefined && typ.RecursionIdentity() !== null) {
        const identity = typ.RecursionIdentity();
        let token = recursionIdentityMap.get(identity);
        const ok = recursionIdentityMap.has(identity);
        if (!ok) {
            token = recursionIdentityMap.size;
            recursionIdentityMap.set(identity, token);
        }
        desc.RecursionID = token;
    }
    // Intrinsic name
    const intrinsicName = typ.IntrinsicName();
    if (intrinsicName !== "") {
        desc.IntrinsicName = intrinsicName;
    }
    // Symbol name - escape the internal symbol name prefix for valid JSON
    if (aliasSymbol !== undefined) {
        desc.SymbolName = EscapeAllInternalSymbolNames(aliasSymbol.Name);
    }
    else if (symbol !== undefined) {
        desc.SymbolName = EscapeAllInternalSymbolNames(symbol.Name);
    }
    // Tuple flag
    if (typ.IsTuple()) {
        desc.IsTuple = true;
    }
    // Union types
    const unionTypes = typ.UnionTypes();
    if (unionTypes.length > 0) {
        desc.UnionTypes = mapTypeIds(unionTypes);
    }
    // Intersection types
    const intersectionTypes = typ.IntersectionTypes();
    if (intersectionTypes.length > 0) {
        desc.IntersectionTypes = mapTypeIds(intersectionTypes);
    }
    // Alias type arguments
    const aliasArgs = typ.AliasTypeArguments();
    if (aliasArgs.length > 0) {
        desc.AliasTypeArguments = mapTypeIds(aliasArgs);
    }
    // Index type (keyof)
    const indexType = typ.IndexType();
    if (indexType !== undefined && indexType !== null) {
        desc.KeyofType = indexType.Id();
    }
    // Indexed access type
    const objType = typ.IndexedAccessObjectType();
    if (objType !== undefined && objType !== null) {
        desc.IndexedAccessObjectType = objType.Id();
    }
    const idxType = typ.IndexedAccessIndexType();
    if (idxType !== undefined && idxType !== null) {
        desc.IndexedAccessIndexType = idxType.Id();
    }
    // Conditional type
    if (typ.IsConditional()) {
        const checkType = typ.ConditionalCheckType();
        if (checkType !== undefined && checkType !== null) {
            desc.ConditionalCheckType = checkType.Id();
        }
        const extendsType = typ.ConditionalExtendsType();
        if (extendsType !== undefined && extendsType !== null) {
            desc.ConditionalExtendsType = extendsType.Id();
        }
        const trueType = typ.ConditionalTrueType();
        if (trueType !== undefined && trueType !== null) {
            desc.ConditionalTrueType = trueType.Id();
        }
        else {
            desc.ConditionalTrueType = -1;
        }
        const falseType = typ.ConditionalFalseType();
        if (falseType !== undefined && falseType !== null) {
            desc.ConditionalFalseType = falseType.Id();
        }
        else {
            desc.ConditionalFalseType = -1;
        }
    }
    // Substitution type
    const baseType = typ.SubstitutionBaseType();
    if (baseType !== undefined && baseType !== null) {
        desc.SubstitutionBaseType = baseType.Id();
    }
    const constraintType = typ.SubstitutionConstraintType();
    if (constraintType !== undefined && constraintType !== null) {
        desc.ConstraintType = constraintType.Id();
    }
    // Reference type
    const target = typ.ReferenceTarget();
    if (target !== undefined && target !== null) {
        desc.InstantiatedType = target.Id();
    }
    const refArgs = typ.ReferenceTypeArguments();
    if (refArgs.length > 0) {
        desc.TypeArguments = mapTypeIds(refArgs);
    }
    const refNode = typ.ReferenceNode();
    if (refNode !== undefined) {
        desc.ReferenceLocation = getLocation(refNode);
    }
    // Reverse mapped type
    const sourceType = typ.ReverseMappedSourceType();
    if (sourceType !== undefined && sourceType !== null) {
        desc.ReverseMappedSourceType = sourceType.Id();
    }
    const mappedType = typ.ReverseMappedMappedType();
    if (mappedType !== undefined && mappedType !== null) {
        desc.ReverseMappedMappedType = mappedType.Id();
    }
    const revConstraintType = typ.ReverseMappedConstraintType();
    if (revConstraintType !== undefined && revConstraintType !== null) {
        desc.ReverseMappedConstraintType = revConstraintType.Id();
    }
    // Evolving array type
    const elemType = typ.EvolvingArrayElementType();
    if (elemType !== undefined && elemType !== null) {
        desc.EvolvingArrayElementType = elemType.Id();
    }
    const finalType = typ.EvolvingArrayFinalType();
    if (finalType !== undefined && finalType !== null) {
        desc.EvolvingArrayFinalType = finalType.Id();
    }
    // Pattern (destructuring)
    const pattern = typ.Pattern();
    if (pattern !== undefined) {
        desc.DestructuringPattern = getLocation(pattern);
    }
    // First declaration - prefer aliasSymbol, matching TypeScript's `aliasSymbol ?? symbol`
    let firstDeclSymbol = aliasSymbol;
    if (firstDeclSymbol === undefined) {
        firstDeclSymbol = symbol;
    }
    if (firstDeclSymbol !== undefined && (firstDeclSymbol.Declarations?.length ?? 0) > 0) {
        desc.FirstDeclaration = getLocation(firstDeclSymbol.Declarations[0]);
    }
    // Display text
    const display = typ.Display();
    if (display !== "") {
        desc.Display = display;
    }
    return desc;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::mapTypeIds","kind":"func","status":"implemented","sigHash":"d19b55124c78fdf345d4bc1f8eec6bb30a47f63baf28f5ccbd9ae15e97ac8d0b","bodyHash":"e61ad13c5b60e1afa2294c3f439de116a0b00782debdd8afa766a5f92dbc201e"}
 *
 * Go source:
 * func mapTypeIds(types []TracedType) []uint32 {
 * 	if len(types) == 0 {
 * 		return nil
 * 	}
 * 	ids := make([]uint32, len(types))
 * 	for i, t := range types {
 * 		if t != nil {
 * 			ids[i] = t.Id()
 * 		}
 * 	}
 * 	return ids
 * }
 */
export function mapTypeIds(types) {
    if (types.length === 0) {
        return [];
    }
    return types.map((t) => (t !== undefined ? t.Id() : 0));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tracing/tracing.go::func::getLocation","kind":"func","status":"implemented","sigHash":"478a29accac1440a4f12f914c0c7cf1caf54dd255362938116cddd86d8fc067b","bodyHash":"cc3ae306110e60d4bc975f3259e6219726b16162bd46355f4228ab2e51a5a277"}
 *
 * Go source:
 * func getLocation(node *ast.Node) *Location {
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	file := ast.GetSourceFileOfNode(node)
 * 	if file == nil {
 * 		return nil
 * 	}
 *
 * 	startPos := scanner.GetTokenPosOfNode(node, file, false)
 * 	startLine, startChar := scanner.GetECMALineAndUTF16CharacterOfPosition(file, startPos)
 * 	endLine, endChar := scanner.GetECMALineAndUTF16CharacterOfPosition(file, node.End())
 *
 * 	return &Location{
 * 		Path: string(tspath.ToPath(file.FileName(), "", false)),
 * 		Start: &LineAndChar{
 * 			Line:      startLine + 1,
 * 			Character: int(startChar) + 1,
 * 		},
 * 		End: &LineAndChar{
 * 			Line:      endLine + 1,
 * 			Character: int(endChar) + 1,
 * 		},
 * 	}
 * }
 */
export function getLocation(node) {
    if (node === undefined) {
        return undefined;
    }
    const file = GetSourceFileOfNode(node);
    if (file === undefined) {
        return undefined;
    }
    // Build a SourceFileLike adapter so the scanner position functions can accept it.
    const sourceFileLike = {
        Text: () => SourceFile_Text(file),
        ECMALineMap: () => SourceFile_ECMALineMap(file),
    };
    const startPos = GetTokenPosOfNode(node, file, false);
    const [startLine, startChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFileLike, startPos);
    const [endLine, endChar] = GetECMALineAndUTF16CharacterOfPosition(sourceFileLike, Node_End(node));
    return {
        Path: ToPath(SourceFile_FileName(file), "", false),
        Start: {
            Line: (startLine + 1),
            Character: (startChar + 1),
        },
        End: {
            Line: (endLine + 1),
            Character: (endChar + 1),
        },
    };
}
//# sourceMappingURL=tracing.js.map