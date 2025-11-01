# Tsonic.Runtime Specification

## Design Principles

1. **Exact Names**: JavaScript objects keep their exact names (including case)
2. **Exact Semantics**: Implement JavaScript behavior precisely
3. **No Shortcuts**: Don't map to "similar" .NET types if behavior differs
4. **Incremental Growth**: Add methods as needed, throw clear errors for unsupported

## Core Runtime Classes

### Array<T>

JavaScript arrays with exact semantics:

```csharp
namespace Tsonic.Runtime
{
    public class Array<T>
    {
        // Sparse array support
        private Dictionary<int, T> _sparse = new Dictionary<int, T>();
        private int _length = 0;

        // Mutable length (JS feature)
        public int length { get; set; }

        // Indexer with JS semantics
        public T this[int index] { get; set; }
        public T this[string key] { get; set; }  // JS allows string indices

        // Core methods
        public int push(params T[] elements);
        public T pop();
        public T shift();
        public int unshift(params T[] elements);
        public Array<T> slice(int start = 0, int? end = null);
        public String join(String separator = null);
        public Array<T> concat(params Array<T>[] arrays);
        public int indexOf(T searchElement, int fromIndex = 0);
        public bool includes(T searchElement, int fromIndex = 0);
        public Array<T> reverse();
        public Array<T> sort(Func<T, T, int> compareFunction = null);

        // NOT IMPLEMENTED (throw runtime error)
        public Array<U> map<U>(Func<T, U> callback);
        public Array<T> filter(Func<T, bool> predicate);
        public U reduce<U>(Func<U, T, U> callback, U initialValue);
        public T find(Func<T, bool> predicate);
        public int findIndex(Func<T, bool> predicate);
        public bool some(Func<T, bool> predicate);
        public bool every(Func<T, bool> predicate);
        public void forEach(Action<T> callback);
    }
}
```

**Key JavaScript Behaviors:**

- Sparse arrays: `arr[100] = 'x'` creates holes
- Mutable length: `arr.length = 5` truncates/extends
- Negative indices don't wrap (unlike Python)
- `undefined` (default(T)) for missing elements

### String

JavaScript string wrapper (when methods needed):

```csharp
namespace Tsonic.Runtime
{
    public class String
    {
        public string Value { get; }
        public int length => Value?.Length ?? 0;

        // Constructors
        public String(string value);
        public String(object value);  // JS String() conversion

        // Methods with JS semantics
        public String toLowerCase();
        public String toUpperCase();
        public String trim();
        public String trimStart();
        public String trimEnd();
        public String substring(int start, int? end = null);
        public String substr(int start, int? length = null);  // Deprecated but common
        public String slice(int start, int? end = null);
        public Array<String> split(String separator, int? limit = null);
        public int indexOf(String searchString, int position = 0);
        public int lastIndexOf(String searchString, int? position = null);
        public bool startsWith(String searchString, int? position = null);
        public bool endsWith(String searchString, int? length = null);
        public bool includes(String searchString, int? position = null);
        public String replace(String search, String replacement);
        public String repeat(int count);
        public String padStart(int targetLength, String padString = null);
        public String padEnd(int targetLength, String padString = null);
        public char charAt(int index);
        public double charCodeAt(int index);

        // Implicit conversions
        public static implicit operator String(string s);
        public static implicit operator string(String s);

        // Operators
        public static String operator +(String a, String b);
    }
}
```

### Date

JavaScript Date object:

```csharp
namespace Tsonic.Runtime
{
    public class Date
    {
        private DateTime _value;

        // Constructors (JS Date constructors)
        public Date();  // Current date/time
        public Date(long milliseconds);  // Since Unix epoch
        public Date(string dateString);
        public Date(int year, int month, int day = 1,
                   int hours = 0, int minutes = 0,
                   int seconds = 0, int ms = 0);

        // Getters (0-based month!)
        public int getFullYear();
        public int getMonth();      // 0-11 in JS!
        public int getDate();        // Day of month
        public int getDay();         // Day of week
        public int getHours();
        public int getMinutes();
        public int getSeconds();
        public int getMilliseconds();
        public long getTime();       // MS since epoch

        // Setters
        public long setFullYear(int year);
        public long setMonth(int month);
        public long setDate(int day);
        public long setHours(int hours);

        // Conversion
        public string toString();
        public string toISOString();
        public string toJSON();
        public string toDateString();
        public string toTimeString();
        public string toLocaleString();

        // Static methods
        public static long now();
        public static long parse(string dateString);
        public static long UTC(int year, int month, ...);
    }
}
```

### Global Functions

```csharp
namespace Tsonic.Runtime
{
    public static class Globals
    {
        // Parsing
        public static int parseInt(string str, int radix = 10);
        public static double parseFloat(string str);

        // Type checking
        public static bool isNaN(double value);
        public static bool isFinite(double value);
        public static bool isInteger(double value);

        // Encoding/Decoding
        public static string encodeURI(string uri);
        public static string decodeURI(string uri);
        public static string encodeURIComponent(string component);
        public static string decodeURIComponent(string component);

        // Deprecated but common
        public static string escape(string str);
        public static string unescape(string str);
    }
}
```

### console

```csharp
namespace Tsonic.Runtime
{
    public static class console  // lowercase!
    {
        public static void log(params object[] data);
        public static void error(params object[] data);
        public static void warn(params object[] data);
        public static void info(params object[] data);
        public static void debug(params object[] data);
        public static void trace(params object[] data);
        public static void assert(bool condition, params object[] data);
        public static void clear();
        public static void count(string label = "default");
        public static void countReset(string label = "default");
        public static void group(params object[] data);
        public static void groupCollapsed(params object[] data);
        public static void groupEnd();
        public static void time(string label = "default");
        public static void timeLog(string label = "default", params object[] data);
        public static void timeEnd(string label = "default");
        public static void table(object tabularData, Array<String> properties = null);
    }
}
```

### Math

```csharp
namespace Tsonic.Runtime
{
    public static class Math  // Exact name
    {
        // Constants (exact JS values)
        public const double E = 2.718281828459045;
        public const double LN2 = 0.6931471805599453;
        public const double LN10 = 2.302585092994046;
        public const double LOG2E = 1.4426950408889634;
        public const double LOG10E = 0.4342944819032518;
        public const double PI = 3.141592653589793;
        public const double SQRT1_2 = 0.7071067811865476;
        public const double SQRT2 = 1.4142135623730951;

        // Methods
        public static double abs(double x);
        public static double acos(double x);
        public static double asin(double x);
        public static double atan(double x);
        public static double atan2(double y, double x);
        public static double ceil(double x);
        public static double cos(double x);
        public static double exp(double x);
        public static double floor(double x);
        public static double log(double x);
        public static double max(params double[] values);
        public static double min(params double[] values);
        public static double pow(double x, double y);
        public static double random();  // 0 <= n < 1
        public static double round(double x);
        public static double sin(double x);
        public static double sqrt(double x);
        public static double tan(double x);
        public static double trunc(double x);
        public static double sign(double x);

        // ES6+
        public static double cbrt(double x);
        public static double hypot(params double[] values);
        public static double imul(double a, double b);
        public static double clz32(double x);
    }
}
```

### JSON

```csharp
namespace Tsonic.Runtime
{
    public static class JSON
    {
        public static string stringify(object value,
            object replacer = null, object space = null);
        public static T parse<T>(string text, object reviver = null);

        // Overload for dynamic parsing
        public static object parse(string text, object reviver = null);
    }
}
```

### Union<T1, T2>

For TypeScript union types:

```csharp
namespace Tsonic.Runtime
{
    public readonly struct Union<T1, T2>
    {
        private readonly object _value;
        private readonly int _index;  // Which type: 0=T1, 1=T2

        public Union(T1 value);
        public Union(T2 value);

        public bool IsT1 => _index == 0;
        public bool IsT2 => _index == 1;

        public T1 AsT1();  // Throws if not T1
        public T2 AsT2();  // Throws if not T2

        public TResult Match<TResult>(
            Func<T1, TResult> onT1,
            Func<T2, TResult> onT2);

        public void Match(Action<T1> onT1, Action<T2> onT2);

        public override string ToString();
    }
}
```

## Not Implemented (MVP)

These throw runtime errors with clear messages:

### Array Methods

- `map()` - "Array.map() not yet supported. Use a for loop instead."
- `filter()` - "Array.filter() not yet supported. Use a for loop with conditions."
- `reduce()` - "Array.reduce() not yet supported. Use a for loop with accumulator."
- `forEach()` - "Array.forEach() not yet supported. Use a for...of loop."

### Object Methods

- `Object.keys()` - "Object.keys() not yet supported."
- `Object.values()` - "Object.values() not yet supported."
- `Object.entries()` - "Object.entries() not yet supported."

### Other Types

- `Map<K,V>` - Planned for phase 2
- `Set<T>` - Planned for phase 2
- `WeakMap<K,V>` - Planned for phase 3
- `WeakSet<T>` - May not support
- `RegExp` - Planned for phase 2
- `Promise.all()`, `Promise.race()` - Use Task methods

## Usage Examples

### TypeScript Input

```typescript
const arr = [1, 2, 3];
arr.push(4, 5);
arr[10] = 99; // Sparse
console.log(`Length: ${arr.length}`);

const text = "Hello World";
const lower = text.toLowerCase();
const words = lower.split(" ");

const now = Date.now();
const date = new Date(2024, 0, 15); // Jan 15, 2024

const pi = Math.PI;
const max = Math.max(10, 20, 30);
const random = Math.random();
```

### C# Output

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

var arr = new Array<double>(1, 2, 3);
arr.push(4, 5);
arr[10] = 99;  // Sparse
console.log($"Length: {arr.length}");

var text = "Hello World";
var lower = new String(text).toLowerCase();
var words = lower.split(new String(" "));

var now = Date.now();
var date = new Date(2024, 0, 15);  // Jan 15, 2024

var pi = Math.PI;
var max = Math.max(10, 20, 30);
var random = Math.random();
```
