import process from "node:process";
export function GetSize(descriptor) {
    const stream = streamForDescriptor(descriptor);
    const width = positiveInt(stream?.columns);
    const height = positiveInt(stream?.rows);
    if (width === 0 || height === 0) {
        return [width, height, new globalThis.Error("terminal size is unavailable")];
    }
    return [width, height, undefined];
}
export function IsTerminal(descriptor) {
    return streamForDescriptor(descriptor)?.isTTY === true;
}
function streamForDescriptor(descriptor) {
    const fd = descriptorFd(descriptor);
    return terminalStreams().find((stream) => stream.fd === fd);
}
function descriptorFd(descriptor) {
    if (typeof descriptor === "number") {
        return descriptor;
    }
    return descriptor.Fd();
}
function positiveInt(value) {
    if (value === undefined || !Number.isInteger(value) || value <= 0) {
        return 0;
    }
    return value;
}
function terminalStreams() {
    return [process.stdin, process.stdout, process.stderr];
}
//# sourceMappingURL=term.js.map