import * as errors from "./errors.js";
export const EOF = errors.New("EOF");
export const ErrUnexpectedEOF = errors.New("unexpected EOF");
class discardWriter {
    Write(p) {
        return [p.length, undefined];
    }
}
export const Discard = new discardWriter();
export function ReadFull(reader, buffer) {
    let total = 0;
    while (total < buffer.length) {
        const view = buffer.slice(total);
        const [count, err] = reader.Read(view);
        if (count > 0) {
            for (let index = 0; index < count; index++) {
                buffer[total + index] = view[index];
            }
            total += count;
        }
        if (err !== undefined) {
            if (total === buffer.length) {
                return [total, undefined];
            }
            if (err === EOF && total > 0) {
                return [total, ErrUnexpectedEOF];
            }
            return [total, err];
        }
        if (count === 0) {
            return [total, total === 0 ? EOF : ErrUnexpectedEOF];
        }
    }
    return [total, undefined];
}
//# sourceMappingURL=io.js.map