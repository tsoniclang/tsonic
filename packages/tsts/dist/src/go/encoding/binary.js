class byteOrder {
    endian;
    constructor(endian) {
        this.endian = endian;
    }
    Uint16(bytes) {
        const b0 = bytes[0] ?? 0;
        const b1 = bytes[1] ?? 0;
        return (this.endian === "big" ? (b0 << 8) | b1 : (b1 << 8) | b0);
    }
    PutUint16(bytes, value) {
        const v = value & 0xffff;
        if (this.endian === "big") {
            bytes[0] = (v >> 8);
            bytes[1] = (v & 0xff);
        }
        else {
            bytes[0] = (v & 0xff);
            bytes[1] = (v >> 8);
        }
    }
}
export const BigEndian = new byteOrder("big");
export const LittleEndian = new byteOrder("little");
function isByteReader(value) {
    return value !== undefined && value !== null && typeof value.ReadByte === "function";
}
function isByteWriter(value) {
    return value !== undefined && value !== null && typeof value.Write === "function";
}
export function Append(buf, order, data) {
    const out = buf.slice();
    if (typeof data === "number") {
        const bytes = [0, 0];
        order.PutUint16(bytes, data);
        out.push(...bytes);
        return [out, undefined];
    }
    for (const value of data) {
        const bytes = [0, 0];
        order.PutUint16(bytes, value);
        out.push(...bytes);
    }
    return [out, undefined];
}
export function Read(reader, order, data) {
    if (!isByteReader(reader)) {
        return new globalThis.Error("encoding/binary: reader does not implement ReadByte");
    }
    for (let i = 0; i < data.length; i++) {
        const [b0, err0] = reader.ReadByte();
        if (err0 !== undefined) {
            return err0;
        }
        const [b1, err1] = reader.ReadByte();
        if (err1 !== undefined) {
            return err1;
        }
        data[i] = order.Uint16([b0, b1]);
    }
    return undefined;
}
export function Write(writer, order, data) {
    if (!isByteWriter(writer)) {
        return new globalThis.Error("encoding/binary: writer does not implement Write");
    }
    const values = typeof data === "number" ? [data] : data;
    const bytes = [];
    for (const value of values) {
        const encoded = [0, 0];
        order.PutUint16(encoded, value);
        bytes.push(...encoded);
    }
    const [, err] = writer.Write(bytes);
    return err;
}
//# sourceMappingURL=binary.js.map