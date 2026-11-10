const certificate = "-----BEGIN CERTIFICATE-----\nMIIDJTCCAg2gAwIBAgIUDCouFfDe+OsGoZyvZ0GF0Y72rS0wDQYJKoZIhvcNAQEL\nBQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDgyOTAxMzIyNFoXDTM2MDgy\nNjAxMzIyNFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEA16Bm+QdBVQ6p3b+O5A+qdupjPXCf055B3tm4HUjBl5TT\nMK3OIkiLVBSQtOZfXdufxDcvooEqkiPGRhBwo/gN/+QCTViPM7kkYBe9rhw8UnIc\nL6wW4SkAp3q7DvtNO5bRS2usduDBUMS7D47voFMEhp1huEKeS/eqlVSgM7rOxah6\no60hjnmZmjB/4KSE/dHCDNxLu61MhKAaKHCaShl0SSIlqpT6dR2ndyqQEkv409nr\nJEwzjqCeRx17acCwp0WXr0eM+dyWuh6x3FON8xJxn+q/caUQzLHLYXsPOQF8r1Iq\nNW7az8zvZyp8FDHAdbl8g9Foq0WEvY+hk49RARQstQIDAQABo28wbTAdBgNVHQ4E\nFgQUQrzjdlm6QIq/Iu4H2VjDzX7PdxMwHwYDVR0jBBgwFoAUQrzjdlm6QIq/Iu4H\n2VjDzX7PdxMwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgglsb2NhbGhvc3SH\nBH8AAAEwDQYJKoZIhvcNAQELBQADggEBADvMnDS9NAiQM37kIWxYFp22qsEaPM1k\njT2vYD8sJ8ZmCRlwuAzNaGItRJj3z97B4ooXpz8dTf0gO3tCUmLJXf3TG9NIVszq\neETuoalRmMM5w3WIdziESvolOMjXGmoAgfmZkKdA/QMiXkAn9z4wTDVS+/TSADy2\nTjxaMzm+vHgB/5ZQbNrZ5bBrBaHMYMp+Yq4ChLsjcO9n4IgRiyNal1nDJ5HlBHYI\na5x1/XQZeiDy7DH8kRMvmp87VjLLyt3/LIqusZbTjyorEZbrch1Opqqjn8N7CLbk\nc4ramADWdN+AoS5kqc4z1qf/CX3lnes5olfR+6y6jMFm7fBvRfXNHOs=\n-----END CERTIFICATE-----";
const key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDXoGb5B0FVDqnd\nv47kD6p26mM9cJ/TnkHe2bgdSMGXlNMwrc4iSItUFJC05l9d25/ENy+igSqSI8ZG\nEHCj+A3/5AJNWI8zuSRgF72uHDxSchwvrBbhKQCnersO+007ltFLa6x24MFQxLsP\nju+gUwSGnWG4Qp5L96qVVKAzus7FqHqjrSGOeZmaMH/gpIT90cIM3Eu7rUyEoBoo\ncJpKGXRJIiWqlPp1Had3KpASS/jT2eskTDOOoJ5HHXtpwLCnRZevR4z53Ja6HrHc\nU43zEnGf6r9xpRDMscthew85AXyvUio1btrPzO9nKnwUMcB1uXyD0WirRYS9j6GT\nj1EBFCy1AgMBAAECggEAMLIkXywQyJVBrncS3ZVeIXHojJkRNzjf1mSj7FUgh0uQ\ncEdoLJzmfkwQrBH0yp0NVUJDSzdRdmSG5A7VaWpdOwNys6YC3SL8QIlMCHSO+O2V\nSPzbw+i/IZOZiBYfyIvUY2yDK+uxLLzpI+fbXQEynfYP+g1tc2mQyB2u+k+/X6q1\nPN9EV+66+DWtOBKWbsoM0stvffKwKYyl0dlzI/beyUpR04l0CIeu0uYQcmOgyT2U\niB/djOnJZrutPYkF4cSheej4WgmOCWPhvhTXYWctxVbl4ITJFL7Bag9c4M42okPO\nP4WOxoB4f43bbcmyVBYVQyW8swyxg6fFpym95lAg4QKBgQDrHM7lxB2FGLcDHgfb\nT6reDYxiYqBqdzhlan71fU6/IDeOoX0O2OIirr9GWIf6ORbWmKieEmWv69xN/0GG\njCB7leBtxaAqH5gLR/XsTGoN4Z0OB1LKXX4fxZX1Nbkjh0r09m+8RqV15s6+xM9k\niAj/tI3jtyw0kQ3yQrTNpmbkcQKBgQDqyGws4JN3QytVWGejv+hEExhZec6jjiOg\n4HI6Sc268VuEqQXNAz97br8IXu49HfxhKpbDl+8HFO73clPdFCgojVot7pwXUIGQ\nLBu9gwRRkqb+AbDVpFlL7T7HCZ7KJcNpzhzoYPPPMFrbjz3TkKA/oI3R7XVzoEb1\nCAcPSJ5ehQKBgGIHH+jC7T/6PwwosEProqV05qx6zMG3NadrUMYQWg3sY92vTVIs\ncZTeYVf2P7O/q9sLyXom14kTAUbv/6UWtdBxfCKovI/znlRNy6abcbiZ8f7QZN+F\nPboHiu+zV58NoN4kBhBtMD3JXzhBHOugoIflAygHzoGYXUU+NN5t3AaxAoGBAKmU\nKc4gR2MU+O+j8verXTAOOsAl4sLvn3xLoTXIqPgl7FxdWPtDJU8aJpD9QEaUqf3k\nrRCJZPRQgmnoAfrk3DyuHDyg481TMMHZmg+/2haxPjypK/ijxHu62GUa5b5MmGCL\npwWRQYic/IMpaxasl5JdfRHr2bGySo4hRjgb04ehAoGBANq9TT7xsC5cj2hQvExB\n2s2QuDXJjZvM/ouN3peEMZIwxvzWAiJIRZzzqAagOldO2DQ8Tys1AXGr6Zox1Xj6\nFE4CTN/wKnzOFgSS3cjWy3A8WfhHn6KDHRaZ3MdDNUhJr8zb1Ek4J3MDysZcXHbA\n2i/ZPzXn29BOTHe0EP9tk1HH\n-----END PRIVATE KEY-----";
const options = `{ key: ${JSON.stringify(key)}, cert: ${JSON.stringify(certificate)} }`;

export const nativeTlsCompletionSource = `
import { createServer } from "node:tls";

export function main(): void {
  const server = createServer(${options}, socket => { socket.end(); });
  server.listen(0, "127.0.0.1", () => {
    server.close();
    console.log("native TLS completion");
  });
}
`;

export const nativeTlsFailureSource = `
import { createServer } from "node:tls";

let delivered = 0;
export function schedule(): Error {
  const original = new Error("original TLS failure");
  const first = createServer(${options}, socket => { socket.end(); });
  const second = createServer(${options}, socket => { socket.end(); });
  first.listen(0, "127.0.0.1", () => { first.close(); throw original; });
  second.listen(0, "127.0.0.1", () => { second.close(); delivered++; });
  return original;
}
export function count(): number { return delivered; }
`;
