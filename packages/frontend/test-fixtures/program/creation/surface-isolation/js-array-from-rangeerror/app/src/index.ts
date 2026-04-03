const chars = Array.from("abc");
const err = new RangeError("bad range");
export const ok = chars.join("") + err.message;
