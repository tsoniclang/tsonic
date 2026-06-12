import { test } from "node:test";
import assert from "node:assert/strict";
import type { Number as JsNumber } from "./jsnum.js";
import { Number_String } from "./string.js";

const float64Buffer = new ArrayBuffer(8);
const float64View = new Float64Array(float64Buffer);
const bigUint64View = new BigUint64Array(float64Buffer);
const maxMantissa = (1n << 53n) - 1n;

function numberFromBits(bits: bigint): JsNumber {
  bigUint64View[0] = bits;
  return float64View[0] as JsNumber;
}

function ieeeParts2Double(sign: boolean, ieeeExponent: number, ieeeMantissa: bigint): JsNumber {
  if (ieeeExponent > 2047) {
    throw new Error("ieeeExponent > 2047");
  }
  if (ieeeMantissa > maxMantissa) {
    throw new Error("ieeeMantissa > maxMantissa");
  }
  const signBit = sign ? 1n : 0n;
  return numberFromBits((signBit << 63n) | (BigInt(ieeeExponent) << 52n) | ieeeMantissa);
}

test("Number.String mirrors upstream Ryu d2s regression cases", () => {
  const cases: Array<[JsNumber, string]> = [
    [2.2250738585072014e-308 as JsNumber, "2.2250738585072014e-308"],
    [numberFromBits(0x7fefffffffffffffn), "1.7976931348623157e+308"],
    [numberFromBits(1n), "5e-324"],
    [2.98023223876953125e-8 as JsNumber, "2.9802322387695312e-8"],
    [-2.109808898695963e16 as JsNumber, "-21098088986959630"],
    [4.940656e-318 as JsNumber, "4.940656e-318"],
    [1.18575755e-316 as JsNumber, "1.18575755e-316"],
    [2.989102097996e-312 as JsNumber, "2.989102097996e-312"],
    [9.0608011534336e15 as JsNumber, "9060801153433600"],
    [4.708356024711512e18 as JsNumber, "4708356024711512000"],
    [9.409340012568248e18 as JsNumber, "9409340012568248000"],
    [1.2345678 as JsNumber, "1.2345678"],
    [numberFromBits(0x4830f0cf064dd592n), "5.764607523034235e+39"],
    [numberFromBits(0x4840f0cf064dd592n), "1.152921504606847e+40"],
    [numberFromBits(0x4850f0cf064dd592n), "2.305843009213694e+40"],
    [1.2 as JsNumber, "1.2"],
    [1.23 as JsNumber, "1.23"],
    [1.234 as JsNumber, "1.234"],
    [1.2345 as JsNumber, "1.2345"],
    [1.23456 as JsNumber, "1.23456"],
    [1.234567 as JsNumber, "1.234567"],
    [1.2345678 as JsNumber, "1.2345678"],
    [1.23456789 as JsNumber, "1.23456789"],
    [1.234567895 as JsNumber, "1.234567895"],
    [1.2345678901 as JsNumber, "1.2345678901"],
    [1.23456789012 as JsNumber, "1.23456789012"],
    [1.234567890123 as JsNumber, "1.234567890123"],
    [1.2345678901234 as JsNumber, "1.2345678901234"],
    [1.23456789012345 as JsNumber, "1.23456789012345"],
    [1.234567890123456 as JsNumber, "1.234567890123456"],
    [1.2345678901234567 as JsNumber, "1.2345678901234567"],
    [4.294967294 as JsNumber, "4.294967294"],
    [4.294967295 as JsNumber, "4.294967295"],
    [4.294967296 as JsNumber, "4.294967296"],
    [4.294967297 as JsNumber, "4.294967297"],
    [4.294967298 as JsNumber, "4.294967298"],
    [ieeeParts2Double(false, 4, 0n), "1.7800590868057611e-307"],
    [ieeeParts2Double(false, 6, maxMantissa), "2.8480945388892175e-306"],
    [ieeeParts2Double(false, 41, 0n), "2.446494580089078e-296"],
    [ieeeParts2Double(false, 40, maxMantissa), "4.8929891601781557e-296"],
    [ieeeParts2Double(false, 1077, 0n), "18014398509481984"],
    [ieeeParts2Double(false, 1076, maxMantissa), "36028797018963964"],
    [ieeeParts2Double(false, 307, 0n), "2.900835519859558e-216"],
    [ieeeParts2Double(false, 306, maxMantissa), "5.801671039719115e-216"],
    [ieeeParts2Double(false, 934, 0x000fa7161a4d6e0cn), "3.196104012172126e-27"],
    [9007199254740991.0 as JsNumber, "9007199254740991"],
    [9007199254740992.0 as JsNumber, "9007199254740992"],
    [1.0e0 as JsNumber, "1"],
    [1.2e1 as JsNumber, "12"],
    [1.23e2 as JsNumber, "123"],
    [1.234e3 as JsNumber, "1234"],
    [1.2345e4 as JsNumber, "12345"],
    [1.23456e5 as JsNumber, "123456"],
    [1.234567e6 as JsNumber, "1234567"],
    [1.2345678e7 as JsNumber, "12345678"],
    [1.23456789e8 as JsNumber, "123456789"],
    [1.23456789e9 as JsNumber, "1234567890"],
    [1.234567895e9 as JsNumber, "1234567895"],
    [1.2345678901e10 as JsNumber, "12345678901"],
    [1.23456789012e11 as JsNumber, "123456789012"],
    [1.234567890123e12 as JsNumber, "1234567890123"],
    [1.2345678901234e13 as JsNumber, "12345678901234"],
    [1.23456789012345e14 as JsNumber, "123456789012345"],
    [1.234567890123456e15 as JsNumber, "1234567890123456"],
    [1000000000000001 as JsNumber, "1000000000000001"],
    [1000000000000010 as JsNumber, "1000000000000010"],
    [1000000000000100 as JsNumber, "1000000000000100"],
    [1000000000001000 as JsNumber, "1000000000001000"],
    [1000000000010000 as JsNumber, "1000000000010000"],
    [1000000000100000 as JsNumber, "1000000000100000"],
    [1000000001000000 as JsNumber, "1000000001000000"],
    [1000000010000000 as JsNumber, "1000000010000000"],
    [1000000100000000 as JsNumber, "1000000100000000"],
    [1000001000000000 as JsNumber, "1000001000000000"],
    [1000010000000000 as JsNumber, "1000010000000000"],
    [1000100000000000 as JsNumber, "1000100000000000"],
    [1001000000000000 as JsNumber, "1001000000000000"],
    [1010000000000000 as JsNumber, "1010000000000000"],
    [1100000000000000 as JsNumber, "1100000000000000"],
    [8.0 as JsNumber, "8"],
    [64.0 as JsNumber, "64"],
    [512.0 as JsNumber, "512"],
    [8192.0 as JsNumber, "8192"],
    [65536.0 as JsNumber, "65536"],
    [524288.0 as JsNumber, "524288"],
    [8388608.0 as JsNumber, "8388608"],
    [67108864.0 as JsNumber, "67108864"],
    [536870912.0 as JsNumber, "536870912"],
    [8589934592.0 as JsNumber, "8589934592"],
    [68719476736.0 as JsNumber, "68719476736"],
    [549755813888.0 as JsNumber, "549755813888"],
    [8796093022208.0 as JsNumber, "8796093022208"],
    [70368744177664.0 as JsNumber, "70368744177664"],
    [562949953421312.0 as JsNumber, "562949953421312"],
    [9007199254740992.0 as JsNumber, "9007199254740992"],
    [8.0e3 as JsNumber, "8000"],
    [64.0e3 as JsNumber, "64000"],
    [512.0e3 as JsNumber, "512000"],
    [8192.0e3 as JsNumber, "8192000"],
    [65536.0e3 as JsNumber, "65536000"],
    [524288.0e3 as JsNumber, "524288000"],
    [8388608.0e3 as JsNumber, "8388608000"],
    [67108864.0e3 as JsNumber, "67108864000"],
    [536870912.0e3 as JsNumber, "536870912000"],
    [8589934592.0e3 as JsNumber, "8589934592000"],
    [68719476736.0e3 as JsNumber, "68719476736000"],
    [549755813888.0e3 as JsNumber, "549755813888000"],
    [8796093022208.0e3 as JsNumber, "8796093022208000"],
  ];

  for (const [number, expected] of cases) {
    assert.equal(Number_String(number), expected, expected);
  }
});
