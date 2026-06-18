const jsRuntimePrelude = (usesJson: boolean): string =>
  [
    "#nullable enable",
    "using System;",
    "using System.Collections.Generic;",
    "using System.Linq;",
    ...(usesJson ? ["using System.Text.Json;"] : []),
    ...(usesJson ? ["using System.Text.Json.Serialization.Metadata;"] : []),
    "using System.Text.RegularExpressions;",
    "",
    "namespace js;",
    "",
  ].join("\n");

const jsErrorSupport = `public class Error : Exception
{
    public Error(string? message = null) : base(message ?? "") { }
}

public sealed class RangeError : Error
{
    public RangeError(string? message = null) : base(message ?? "") { }
}
`;

const jsRegExpSupport = `public sealed class RegExp
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
    internal Match Match(string value) => regex.Match(value);
    internal MatchCollection Matches(string value) => regex.Matches(value);
}
`;

const jsStringSupport = `public static class String
{
    public static string coerce(object? value) => Convert.ToString(value) ?? "";
    public static string template(object? value, string nullishText) => value == null ? nullishText : Convert.ToString(value) ?? "";
    public static string trim(string value) => value.Trim();
    public static string trimStart(string value) => value.TrimStart();
    public static string trimEnd(string value) => value.TrimEnd();
    public static string trimLeft(string value) => trimStart(value);
    public static string trimRight(string value) => trimEnd(value);
    public static string toLowerCase(string value) => value.ToLowerInvariant();
    public static string toUpperCase(string value) => value.ToUpperInvariant();
    public static string toLocaleLowerCase(string value) => value.ToLowerInvariant();
    public static string toLocaleUpperCase(string value) => value.ToUpperInvariant();
    public static string at(string value, int index)
    {
        var actual = index < 0 ? value.Length + index : index;
        return actual >= 0 && actual < value.Length ? value[actual].ToString() : "";
    }
    public static string charAt(string value, int index) => index >= 0 && index < value.Length ? value[index].ToString() : "";
    public static int charCodeAt(string value, int index) => index >= 0 && index < value.Length ? char.ConvertToUtf32(value, index) : -1;
    public static int codePointAt(string value, int index) => charCodeAt(value, index);
    public static string concat(string value, params string[] strings) => value + string.Concat(strings);
    public static string[] split(string value) => new[] { value };
    public static string[] split(string value, string separator) => value.Split(separator);
    public static List<string>? match(string value, object pattern)
    {
        var matched = (pattern is RegExp regex ? regex : new RegExp(Convert.ToString(pattern) ?? "")).Match(value);
        if (!matched.Success) return null;
        var result = new List<string>();
        foreach (Group group in matched.Groups) result.Add(group.Value);
        return result;
    }
    public static List<List<string>> matchAll(string value, object pattern)
    {
        var matches = (pattern is RegExp regex ? regex : new RegExp(Convert.ToString(pattern) ?? "")).Matches(value);
        var result = new List<List<string>>();
        foreach (Match match in matches)
        {
            var groups = new List<string>();
            foreach (Group group in match.Groups) groups.Add(group.Value);
            result.Add(groups);
        }
        return result;
    }
    public static bool startsWith(string value, string search) => value.StartsWith(search, StringComparison.Ordinal);
    public static bool endsWith(string value, string search) => value.EndsWith(search, StringComparison.Ordinal);
    public static bool includes(string value, string search) => value.Contains(search, StringComparison.Ordinal);
    public static int indexOf(string value, string search) => value.IndexOf(search, StringComparison.Ordinal);
    public static int lastIndexOf(string value, string search) => value.LastIndexOf(search, StringComparison.Ordinal);
    public static int localeCompare(string value, string compare) => string.Compare(value, compare, StringComparison.CurrentCulture);
    public static string normalize(string value) => value.Normalize();
    public static string padEnd(string value, int targetLength, string padString = " ") => value.PadRight(targetLength, padString.Length == 0 ? ' ' : padString[0]);
    public static string padStart(string value, int targetLength, string padString = " ") => value.PadLeft(targetLength, padString.Length == 0 ? ' ' : padString[0]);
    public static string repeat(string value, int count) => string.Concat(Enumerable.Repeat(value, count));
    public static int search(string value, object pattern) => (pattern is RegExp regex ? regex : new RegExp(Convert.ToString(pattern) ?? "")).Match(value).Index;
    public static string substring(string value, int start) => value.Substring(start);
    public static string substring(string value, int start, int end) => value.Substring(start, end - start);
    public static string substr(string value, int start) => start >= 0 ? value.Substring(start) : value.Substring(System.Math.Max(value.Length + start, 0));
    public static string substr(string value, int start, int length) => substr(value, start).Substring(0, length);
    public static string slice(string value, int start) => start >= 0 ? value.Substring(start) : value.Substring(System.Math.Max(value.Length + start, 0));
    public static string slice(string value, int start, int end)
    {
        var normalizedStart = start >= 0 ? start : System.Math.Max(value.Length + start, 0);
        var normalizedEnd = end >= 0 ? end : System.Math.Max(value.Length + end, 0);
        return value.Substring(normalizedStart, System.Math.Max(normalizedEnd - normalizedStart, 0));
    }
    public static string replace(string value, string search, string replacement) => value.Replace(search, replacement, StringComparison.Ordinal);
    public static string replaceAll(string value, string search, string replacement) => value.Replace(search, replacement, StringComparison.Ordinal);
    public static bool isWellFormed(string value) => true;
    public static string toWellFormed(string value) => value;
    public static string valueOf(string value) => value;
    public static string fromCharCode(params int[] codes) => new string(codes.Select(code => (char)code).ToArray());
    public static string fromCodePoint(params int[] codes) => string.Concat(codes.Select(char.ConvertFromUtf32));
}
`;

const jsObjectSupport = `public static class Object
{
    public static bool @is(object? left, object? right) => object.Equals(left, right);
    public static IEnumerable<string> keys<T>(Dictionary<string, T> value) => value.Keys;
    public static IEnumerable<T> values<T>(Dictionary<string, T> value) => value.Values;
    public static IEnumerable<KeyValuePair<string, T>> entries<T>(Dictionary<string, T> value) => value;
    public static Dictionary<string, T> fromEntries<T>(IEnumerable<KeyValuePair<string, T>> entries) => entries.ToDictionary(entry => entry.Key, entry => entry.Value);
}
`;

const jsGlobalsSupport = `public static class Globals
{
    private static int nextTimerId;
    public static int setTimeout(Action handler, int timeout = 0)
    {
        handler();
        return System.Threading.Interlocked.Increment(ref nextTimerId);
    }

    public static int setTimeout(Action<object?[]> handler, int timeout = 0, params object?[] args)
    {
        handler(args);
        return System.Threading.Interlocked.Increment(ref nextTimerId);
    }

    public static int setInterval(Action handler, int timeout = 0)
    {
        handler();
        return System.Threading.Interlocked.Increment(ref nextTimerId);
    }

    public static int setInterval(Action<object?[]> handler, int timeout = 0, params object?[] args)
    {
        handler(args);
        return System.Threading.Interlocked.Increment(ref nextTimerId);
    }

    public static void clearTimeout(int id) { }
    public static void clearInterval(int id) { }
    public static double parseInt(string value, int radix = 10)
    {
        var trimmed = value.TrimStart();
        if (trimmed.Length == 0) return double.NaN;
        if (radix < 2 || radix > 36) return double.NaN;
        var index = 0;
        var sign = 1;
        if (trimmed[index] == '+' || trimmed[index] == '-')
        {
            sign = trimmed[index] == '-' ? -1 : 1;
            index++;
        }
        var parsed = 0.0;
        var sawDigit = false;
        for (; index < trimmed.Length; index++)
        {
            var ch = trimmed[index];
            var digit = ch >= '0' && ch <= '9'
                ? ch - '0'
                : ch >= 'a' && ch <= 'z'
                    ? ch - 'a' + 10
                    : ch >= 'A' && ch <= 'Z'
                        ? ch - 'A' + 10
                        : -1;
            if (digit < 0 || digit >= radix) break;
            parsed = parsed * radix + digit;
            sawDigit = true;
        }
        return sawDigit ? sign * parsed : double.NaN;
    }
    public static double parseFloat(string value) => double.TryParse(value.Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var parsed) ? parsed : double.NaN;
    public static bool isFinite(double value) => double.IsFinite(value);
    public static bool isNaN(double value) => double.IsNaN(value);
    public static string encodeURIComponent(string component) => Uri.EscapeDataString(component);
    public static string decodeURIComponent(string component) => Uri.UnescapeDataString(component);
    public static string encodeURI(string uri) => Uri.EscapeUriString(uri);
    public static string decodeURI(string uri) => Uri.UnescapeDataString(uri);
    public static int length(object? value) => value switch
    {
        string text => text.Length,
        System.Collections.ICollection collection => collection.Count,
        System.Collections.IEnumerable enumerable => System.Linq.Enumerable.Count(System.Linq.Enumerable.Cast<object?>(enumerable)),
        System.Delegate => 0,
        null => 0,
        _ => throw new InvalidOperationException("Value does not expose JavaScript length semantics.")
    };
}
`;

const jsMathSupport = `public static class Math
{
    public static readonly double E = System.Math.E;
    public static readonly double PI = System.Math.PI;
    public static double abs(double value) => System.Math.Abs(value);
    public static double acos(double value) => System.Math.Acos(value);
    public static double asin(double value) => System.Math.Asin(value);
    public static double atan(double value) => System.Math.Atan(value);
    public static double atan2(double left, double right) => System.Math.Atan2(left, right);
    public static double ceil(double value) => System.Math.Ceiling(value);
    public static double cos(double value) => System.Math.Cos(value);
    public static double exp(double value) => System.Math.Exp(value);
    public static double floor(double value) => System.Math.Floor(value);
    public static double log(double value) => System.Math.Log(value);
    public static double log10(double value) => System.Math.Log10(value);
    public static double log2(double value) => System.Math.Log2(value);
    public static double max(params double[] values) => values.Length == 0 ? double.NegativeInfinity : values.Max();
    public static double min(params double[] values) => values.Length == 0 ? double.PositiveInfinity : values.Min();
    public static double pow(double left, double right) => System.Math.Pow(left, right);
    public static double random() => Random.Shared.NextDouble();
    public static double round(double value) => System.Math.Round(value);
    public static double sign(double value) => System.Math.Sign(value);
    public static double sin(double value) => System.Math.Sin(value);
    public static double sqrt(double value) => System.Math.Sqrt(value);
    public static double tan(double value) => System.Math.Tan(value);
    public static double trunc(double value) => System.Math.Truncate(value);
}
`;

const jsDateSupport = `public sealed class Date
{
    private readonly DateTimeOffset value;

    public Date()
    {
        value = DateTimeOffset.Now;
    }

    public Date(double milliseconds)
    {
        value = DateTimeOffset.UnixEpoch.AddMilliseconds(milliseconds);
    }

    public static long now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    public static double parse(string value) => DateTimeOffset.TryParse(value, out var parsed) ? parsed.ToUnixTimeMilliseconds() : double.NaN;
    public static double UTC(int year, int month, int day = 1, int hours = 0, int minutes = 0, int seconds = 0, int milliseconds = 0)
    {
        try
        {
            return new DateTimeOffset(year, month + 1, day, hours, minutes, seconds, milliseconds, TimeSpan.Zero).ToUnixTimeMilliseconds();
        }
        catch
        {
            return double.NaN;
        }
    }
    public long getTime() => value.ToUnixTimeMilliseconds();
    public string toISOString() => value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", System.Globalization.CultureInfo.InvariantCulture);
    public override string ToString() => value.ToString(System.Globalization.CultureInfo.InvariantCulture);
    public string toString() => ToString();
    public string valueOf() => ToString();
}
`;

const jsConsoleSupport = `public static class ConsoleModule
{
    public static void log(params object?[] data) => Console.WriteLine(string.Join(" ", data.Select(Convert.ToString)));
    public static void info(params object?[] data) => log(data);
    public static void debug(params object?[] data) => log(data);
    public static void warn(params object?[] data) => Console.Error.WriteLine(string.Join(" ", data.Select(Convert.ToString)));
    public static void error(params object?[] data) => Console.Error.WriteLine(string.Join(" ", data.Select(Convert.ToString)));
}
`;

const jsJsonSupport = `public static class JSON
{
    public static T? parse<T>(string value, JsonTypeInfo<T> typeInfo) => JsonSerializer.Deserialize(value, typeInfo);
    public static string stringify<T>(T value, JsonTypeInfo<T> typeInfo) => JsonSerializer.Serialize(value, typeInfo);
}
`;

const jsCollectionsSupport = `public sealed class Array<T> : List<T>
{
    public Array() { }
    public Array(IEnumerable<T> values) : base(values) { }
    public int length => Count;
}

public sealed class Map<TKey, TValue> : Dictionary<TKey, TValue?>
    where TKey : notnull
{
    public Map() { }
    public Map(IEnumerable<KeyValuePair<TKey, TValue?>> values) : base(values) { }
    public TValue? get(TKey key) => TryGetValue(key, out var value) ? value : default;
    public Map<TKey, TValue> set(TKey key, TValue value) { this[key] = value; return this; }
    public bool has(TKey key) => ContainsKey(key);
    public bool delete(TKey key) => Remove(key);
    public IEnumerable<TKey> keys() => Keys;
    public IEnumerable<TValue?> values() => Values;
    public IEnumerable<KeyValuePair<TKey, TValue?>> entries() => this;
}

public sealed class Set<T> : HashSet<T>
{
    public Set() { }
    public Set(IEnumerable<T> values) : base(values) { }
    public Set<T> add(T value) { Add(value); return this; }
    public bool has(T value) => Contains(value);
    public bool delete(T value) => Remove(value);
    public IEnumerable<T> keys() => this;
    public IEnumerable<T> values() => this;
    public IEnumerable<KeyValuePair<T, T>> entries() => this.Select(value => new KeyValuePair<T, T>(value, value));
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

const tsonicRuntimePrelude = `#nullable enable
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Tsonic.Runtime;

`;

const tsonicGeneratorSupport = `public sealed class GeneratorExchange<TYield, TNext>
{
    public TNext? Input { get; set; }
    public TYield Output { get; set; } = default!;
}

public sealed class Generator<TYield, TReturn, TNext>
{
    private readonly IEnumerator<GeneratorExchange<TYield, TNext>> enumerator;
    private readonly GeneratorExchange<TYield, TNext> exchange;
    private readonly Func<TReturn>? getReturnValue;
    private bool done;
    private TReturn storedReturnValue = default!;
    private bool wasExternallyTerminated;

    public Generator(
        IEnumerable<GeneratorExchange<TYield, TNext>> enumerable,
        GeneratorExchange<TYield, TNext> exchange,
        Func<TReturn>? getReturnValue = null)
    {
        enumerator = enumerable.GetEnumerator();
        this.exchange = exchange;
        this.getReturnValue = getReturnValue;
    }

    public IteratorResult<TYield> next(TNext? value = default)
    {
        if (done) return new IteratorResult<TYield>(default!, true);
        exchange.Input = value;
        if (enumerator.MoveNext())
        {
            return new IteratorResult<TYield>(exchange.Output, false);
        }
        done = true;
        return new IteratorResult<TYield>(default!, true);
    }

    public IteratorResult<TYield> @return(TReturn value = default!)
    {
        done = true;
        storedReturnValue = value;
        wasExternallyTerminated = true;
        enumerator.Dispose();
        return new IteratorResult<TYield>(default!, true);
    }

    public IteratorResult<TYield> @throw(object e)
    {
        done = true;
        enumerator.Dispose();
        if (e is Exception exception) throw exception;
        throw new Exception(Convert.ToString(e) ?? "Unknown error");
    }

    public TReturn returnValue => wasExternallyTerminated ? storedReturnValue : getReturnValue != null ? getReturnValue() : default!;
}

public sealed class AsyncGenerator<TYield, TReturn, TNext>
{
    private readonly IAsyncEnumerator<GeneratorExchange<TYield, TNext>> enumerator;
    private readonly GeneratorExchange<TYield, TNext> exchange;
    private readonly Func<TReturn>? getReturnValue;
    private bool done;
    private TReturn storedReturnValue = default!;
    private bool wasExternallyTerminated;

    public AsyncGenerator(
        IAsyncEnumerable<GeneratorExchange<TYield, TNext>> enumerable,
        GeneratorExchange<TYield, TNext> exchange,
        Func<TReturn>? getReturnValue = null)
    {
        enumerator = enumerable.GetAsyncEnumerator();
        this.exchange = exchange;
        this.getReturnValue = getReturnValue;
    }

    public async Task<IteratorResult<TYield>> next(TNext? value = default)
    {
        if (done) return new IteratorResult<TYield>(default!, true);
        exchange.Input = value;
        if (await enumerator.MoveNextAsync())
        {
            return new IteratorResult<TYield>(exchange.Output, false);
        }
        done = true;
        return new IteratorResult<TYield>(default!, true);
    }

    public async Task<IteratorResult<TYield>> @return(TReturn value = default!)
    {
        done = true;
        storedReturnValue = value;
        wasExternallyTerminated = true;
        await enumerator.DisposeAsync();
        return new IteratorResult<TYield>(default!, true);
    }

    public async Task<IteratorResult<TYield>> @throw(object e)
    {
        done = true;
        await enumerator.DisposeAsync();
        if (e is Exception exception) throw exception;
        throw new Exception(Convert.ToString(e) ?? "Unknown error");
    }

    public TReturn returnValue => wasExternallyTerminated ? storedReturnValue : getReturnValue != null ? getReturnValue() : default!;
}
`;

const supportNeeded = (
  emittedFiles: ReadonlyMap<string, string>,
  runtimeName: string
): boolean =>
  [...emittedFiles.values()].some((code) => code.includes(runtimeName));

export const csharpRuntimeSupportFiles = (
  emittedFiles: ReadonlyMap<string, string>
): ReadonlyMap<string, string> => {
  const files = new Map<string, string>();
  const usesJsRuntime = [...emittedFiles.values()].some((code) =>
    code.includes("global::js.")
  );
  const usesTsonicRuntimeGenerator = [...emittedFiles.values()].some(
    (code) =>
      code.includes("global::Tsonic.Runtime.Generator<") ||
      code.includes("global::Tsonic.Runtime.AsyncGenerator<")
  );
  if (usesTsonicRuntimeGenerator) {
    files.set(
      "__tsonic_runtime/tsonic.cs",
      [tsonicRuntimePrelude, tsonicGeneratorSupport].join("\n")
    );
  }
  if (!usesJsRuntime) {
    return files;
  }
  const usesJson = supportNeeded(emittedFiles, "global::js.JSON");
  const usesString = supportNeeded(emittedFiles, "global::js.String");
  const sections = [
    jsRuntimePrelude(usesJson),
    ...(supportNeeded(emittedFiles, "global::js.Error") ||
    supportNeeded(emittedFiles, "global::js.RangeError")
      ? [jsErrorSupport]
      : []),
    ...(supportNeeded(emittedFiles, "global::js.RegExp") || usesString
      ? [jsRegExpSupport]
      : []),
    ...(supportNeeded(emittedFiles, "global::js.Date") ? [jsDateSupport] : []),
    ...(supportNeeded(emittedFiles, "global::js.Math") ? [jsMathSupport] : []),
    ...(usesString ? [jsStringSupport] : []),
    ...(supportNeeded(emittedFiles, "global::js.Object")
      ? [jsObjectSupport]
      : []),
    ...(supportNeeded(emittedFiles, "global::js.Globals")
      ? [jsGlobalsSupport]
      : []),
    ...(supportNeeded(emittedFiles, "global::js.ConsoleModule")
      ? [jsConsoleSupport]
      : []),
    ...(usesJson ? [jsJsonSupport] : []),
    ...(supportNeeded(emittedFiles, "global::js.Array") ||
    supportNeeded(emittedFiles, "global::js.Map") ||
    supportNeeded(emittedFiles, "global::js.Set") ||
    supportNeeded(emittedFiles, "global::js.Uint") ||
    supportNeeded(emittedFiles, "global::js.Int") ||
    supportNeeded(emittedFiles, "global::js.Float") ||
    supportNeeded(emittedFiles, "global::js.DataView")
      ? [jsCollectionsSupport]
      : []),
  ];
  files.set("__tsonic_runtime/js.cs", sections.join("\n"));
  return files;
};
