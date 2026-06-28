export function EncodeToString(source) {
    let output = "";
    for (const value of source) {
        output += (value & 0xff).toString(16).padStart(2, "0");
    }
    return output;
}
//# sourceMappingURL=hex.js.map