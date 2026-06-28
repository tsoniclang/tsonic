let activeCpuProfile;
export function Lookup(name) {
    switch (name) {
        case "heap":
        case "allocs":
            return {
                WriteTo: (writer, debug) => writeProfile(writer, name, debug, undefined),
            };
        default:
            return undefined;
    }
}
export function StartCPUProfile(writer) {
    if (activeCpuProfile !== undefined) {
        return new globalThis.Error("CPU profiling already in progress");
    }
    activeCpuProfile = { writer, startedAt: globalThis.Date.now() };
    return undefined;
}
export function StopCPUProfile() {
    if (activeCpuProfile === undefined) {
        return;
    }
    const session = activeCpuProfile;
    activeCpuProfile = undefined;
    writeProfile(session.writer, "cpu", 0, session.startedAt);
}
const encoder = new globalThis.TextEncoder();
function writeProfile(writer, name, debug, startedAt) {
    const endedAt = globalThis.Date.now();
    const payload = {
        format: "tsts-runtime-pprof",
        profile: name,
        debug,
        startedAt,
        endedAt,
        durationMs: startedAt === undefined ? 0 : endedAt - startedAt,
    };
    const bytes = globalThis.Array.from(encoder.encode(globalThis.JSON.stringify(payload) + "\n"));
    const [, err] = writer.Write(bytes);
    return err;
}
//# sourceMappingURL=pprof.js.map