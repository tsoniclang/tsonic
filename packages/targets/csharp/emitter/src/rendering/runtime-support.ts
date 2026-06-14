const jsRuntimeSupport = `#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace js;

public sealed class Error : Exception
{
    public Error(string? message = null) : base(message ?? "") { }
}

public sealed class RegExp
{
    private readonly Regex regex;

    public RegExp(string pattern) : this(pattern, "") { }

    public RegExp(string pattern, string flags)
    {
        var options = RegexOptions.ECMAScript;
        if (flags.Contains("i")) options |= RegexOptions.IgnoreCase;
        regex = new Regex(pattern, options);
    }

    public bool test(string value) => regex.IsMatch(value);
}

public static class String
{
    public static string trim(string value) => value.Trim();
    public static string trimStart(string value) => value.TrimStart();
    public static string trimEnd(string value) => value.TrimEnd();
    public static string toLowerCase(string value) => value.ToLowerInvariant();
    public static string toUpperCase(string value) => value.ToUpperInvariant();
    public static string charAt(string value, int index) => index >= 0 && index < value.Length ? value[index].ToString() : "";
    public static string[] split(string value, string separator) => value.Split(separator);
    public static bool startsWith(string value, string search) => value.StartsWith(search, StringComparison.Ordinal);
    public static bool endsWith(string value, string search) => value.EndsWith(search, StringComparison.Ordinal);
    public static bool includes(string value, string search) => value.Contains(search, StringComparison.Ordinal);
    public static int indexOf(string value, string search) => value.IndexOf(search, StringComparison.Ordinal);
    public static string substring(string value, int start) => value.Substring(start);
    public static string substring(string value, int start, int end) => value.Substring(start, end - start);
    public static string slice(string value, int start) => start >= 0 ? value.Substring(start) : value.Substring(Math.Max(value.Length + start, 0));
    public static string slice(string value, int start, int end)
    {
        var normalizedStart = start >= 0 ? start : Math.Max(value.Length + start, 0);
        var normalizedEnd = end >= 0 ? end : Math.Max(value.Length + end, 0);
        return value.Substring(normalizedStart, Math.Max(normalizedEnd - normalizedStart, 0));
    }
    public static string replace(string value, string search, string replacement) => value.Replace(search, replacement, StringComparison.Ordinal);
    public static string fromCharCode(params int[] codes) => new string(codes.Select(code => (char)code).ToArray());
    public static string fromCodePoint(params int[] codes) => string.Concat(codes.Select(char.ConvertFromUtf32));
}

public static class Object
{
    public static bool @is(object? left, object? right) => object.Equals(left, right);
    public static IEnumerable<string> keys<T>(Dictionary<string, T> value) => value.Keys;
    public static IEnumerable<T> values<T>(Dictionary<string, T> value) => value.Values;
    public static IEnumerable<KeyValuePair<string, T>> entries<T>(Dictionary<string, T> value) => value;
    public static Dictionary<string, T> fromEntries<T>(IEnumerable<KeyValuePair<string, T>> entries) => entries.ToDictionary(entry => entry.Key, entry => entry.Value);
}

public static class JSON
{
    public static T? parse<T>(string value) => JsonSerializer.Deserialize<T>(value);
    public static string stringify(object? value) => JsonSerializer.Serialize(value);
}

public sealed class Array<T> : List<T>
{
    public Array() { }
    public Array(IEnumerable<T> values) : base(values) { }
    public int length => Count;
}

public sealed class Map<TKey, TValue> : Dictionary<TKey, TValue>
    where TKey : notnull
{
    public Map() { }
    public Map(IEnumerable<KeyValuePair<TKey, TValue>> values) : base(values) { }
}

public sealed class Set<T> : HashSet<T>
{
    public Set() { }
    public Set(IEnumerable<T> values) : base(values) { }
}

public sealed class Uint8Array : List<byte>
{
    public Uint8Array() { }
    public Uint8Array(IEnumerable<byte> values) : base(values) { }
    public int length => Count;
}

public sealed class Uint8ClampedArray : List<byte>
{
    public Uint8ClampedArray() { }
    public Uint8ClampedArray(IEnumerable<byte> values) : base(values) { }
    public int length => Count;
}

public sealed class Int8Array : List<sbyte>
{
    public Int8Array() { }
    public Int8Array(IEnumerable<sbyte> values) : base(values) { }
    public int length => Count;
}

public sealed class Uint16Array : List<ushort>
{
    public Uint16Array() { }
    public Uint16Array(IEnumerable<ushort> values) : base(values) { }
    public int length => Count;
}

public sealed class Int16Array : List<short>
{
    public Int16Array() { }
    public Int16Array(IEnumerable<short> values) : base(values) { }
    public int length => Count;
}

public sealed class Uint32Array : List<uint>
{
    public Uint32Array() { }
    public Uint32Array(IEnumerable<uint> values) : base(values) { }
    public int length => Count;
}

public sealed class Int32Array : List<int>
{
    public Int32Array() { }
    public Int32Array(IEnumerable<int> values) : base(values) { }
    public int length => Count;
}

public sealed class Float32Array : List<float>
{
    public Float32Array() { }
    public Float32Array(IEnumerable<float> values) : base(values) { }
    public int length => Count;
}

public sealed class Float64Array : List<double>
{
    public Float64Array() { }
    public Float64Array(IEnumerable<double> values) : base(values) { }
    public int length => Count;
}

public sealed class DataView
{
    private readonly byte[] bytes;

    public DataView(byte[] bytes)
    {
        this.bytes = bytes;
    }

    public byte getUint8(int offset) => bytes[offset];
    public sbyte getInt8(int offset) => unchecked((sbyte)bytes[offset]);
}
`;

export const csharpRuntimeSupportFiles = (
  emittedFiles: ReadonlyMap<string, string>
): ReadonlyMap<string, string> => {
  if (![...emittedFiles.values()].some((code) => code.includes("global::js."))) {
    return new Map();
  }
  return new Map([["__tsonic_runtime/js.cs", jsRuntimeSupport]]);
};
