/**
 * Union type helpers for TypeScript union types
 * Supports TypeScript unions like string | number
 */

using System;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Union of two types (T1 | T2 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2>
    {
        private readonly object? _value;
        private readonly int _index; // 0 for T1, 1 for T2

        private Union(object? value, int index)
        {
            _value = value;
            _index = index;
        }

        /// <summary>
        /// Create union from first type
        /// </summary>
        public static Union<T1, T2> From1(T1 value) => new Union<T1, T2>(value, 0);

        /// <summary>
        /// Create union from second type
        /// </summary>
        public static Union<T1, T2> From2(T2 value) => new Union<T1, T2>(value, 1);

        /// <summary>
        /// Check if union holds first type
        /// </summary>
        public bool Is1() => _index == 0;

        /// <summary>
        /// Check if union holds second type
        /// </summary>
        public bool Is2() => _index == 1;

        /// <summary>
        /// Get value as first type (throws if not T1)
        /// </summary>
        public T1 As1()
        {
            if (_index != 0)
                throw new InvalidOperationException($"Union does not contain type {typeof(T1).Name}");
            return (T1)_value!;
        }

        /// <summary>
        /// Get value as second type (throws if not T2)
        /// </summary>
        public T2 As2()
        {
            if (_index != 1)
                throw new InvalidOperationException($"Union does not contain type {typeof(T2).Name}");
            return (T2)_value!;
        }

        /// <summary>
        /// Try to get value as first type
        /// </summary>
        public bool TryAs1(out T1? value)
        {
            if (_index == 0)
            {
                value = (T1)_value!;
                return true;
            }
            value = default;
            return false;
        }

        /// <summary>
        /// Try to get value as second type
        /// </summary>
        public bool TryAs2(out T2? value)
        {
            if (_index == 1)
            {
                value = (T2)_value!;
                return true;
            }
            value = default;
            return false;
        }

        /// <summary>
        /// Pattern match on the union value
        /// </summary>
        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2)
        {
            return _index == 0 ? onT1((T1)_value!) : onT2((T2)_value!);
        }

        /// <summary>
        /// Pattern match on the union value (void return)
        /// </summary>
        public void Match(Action<T1> onT1, Action<T2> onT2)
        {
            if (_index == 0)
                onT1((T1)_value!);
            else
                onT2((T2)_value!);
        }

        /// <summary>
        /// Implicit conversion from T1
        /// </summary>
        public static implicit operator Union<T1, T2>(T1 value) => From1(value);

        /// <summary>
        /// Implicit conversion from T2
        /// </summary>
        public static implicit operator Union<T1, T2>(T2 value) => From2(value);

        public override string? ToString()
        {
            return _value?.ToString();
        }

        public override bool Equals(object? obj)
        {
            if (obj is Union<T1, T2> other)
            {
                return _index == other._index && Equals(_value, other._value);
            }
            return false;
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(_value, _index);
        }
    }

    /// <summary>
    /// Union of three types (T1 | T2 | T3 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3>
    {
        private readonly object? _value;
        private readonly int _index; // 0 for T1, 1 for T2, 2 for T3

        private Union(object? value, int index)
        {
            _value = value;
            _index = index;
        }

        public static Union<T1, T2, T3> From1(T1 value) => new Union<T1, T2, T3>(value, 0);
        public static Union<T1, T2, T3> From2(T2 value) => new Union<T1, T2, T3>(value, 1);
        public static Union<T1, T2, T3> From3(T3 value) => new Union<T1, T2, T3>(value, 2);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;

        public T1 As1()
        {
            if (_index != 0)
                throw new InvalidOperationException($"Union does not contain type {typeof(T1).Name}");
            return (T1)_value!;
        }

        public T2 As2()
        {
            if (_index != 1)
                throw new InvalidOperationException($"Union does not contain type {typeof(T2).Name}");
            return (T2)_value!;
        }

        public T3 As3()
        {
            if (_index != 2)
                throw new InvalidOperationException($"Union does not contain type {typeof(T3).Name}");
            return (T3)_value!;
        }

        public bool TryAs1(out T1? value)
        {
            if (_index == 0)
            {
                value = (T1)_value!;
                return true;
            }
            value = default;
            return false;
        }

        public bool TryAs2(out T2? value)
        {
            if (_index == 1)
            {
                value = (T2)_value!;
                return true;
            }
            value = default;
            return false;
        }

        public bool TryAs3(out T3? value)
        {
            if (_index == 2)
            {
                value = (T3)_value!;
                return true;
            }
            value = default;
            return false;
        }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3)
        {
            return _index switch
            {
                0 => onT1((T1)_value!),
                1 => onT2((T2)_value!),
                2 => onT3((T3)_value!),
                _ => throw new InvalidOperationException("Invalid union index")
            };
        }

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3)
        {
            switch (_index)
            {
                case 0: onT1((T1)_value!); break;
                case 1: onT2((T2)_value!); break;
                case 2: onT3((T3)_value!); break;
                default: throw new InvalidOperationException("Invalid union index");
            }
        }

        public static implicit operator Union<T1, T2, T3>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3>(T3 value) => From3(value);

        public override string? ToString() => _value?.ToString();

        public override bool Equals(object? obj)
        {
            if (obj is Union<T1, T2, T3> other)
            {
                return _index == other._index && Equals(_value, other._value);
            }
            return false;
        }

        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }

    /// <summary>
    /// Union of four types (T1 | T2 | T3 | T4 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3, T4>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index) { _value = value; _index = index; }

        public static Union<T1, T2, T3, T4> From1(T1 value) => new(value, 0);
        public static Union<T1, T2, T3, T4> From2(T2 value) => new(value, 1);
        public static Union<T1, T2, T3, T4> From3(T3 value) => new(value, 2);
        public static Union<T1, T2, T3, T4> From4(T4 value) => new(value, 3);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;
        public bool Is4() => _index == 3;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();
        public T3 As3() => _index == 2 ? (T3)_value! : throw new InvalidOperationException();
        public T4 As4() => _index == 3 ? (T4)_value! : throw new InvalidOperationException();

        public bool TryAs1(out T1? value) { if (_index == 0) { value = (T1)_value!; return true; } value = default; return false; }
        public bool TryAs2(out T2? value) { if (_index == 1) { value = (T2)_value!; return true; } value = default; return false; }
        public bool TryAs3(out T3? value) { if (_index == 2) { value = (T3)_value!; return true; } value = default; return false; }
        public bool TryAs4(out T4? value) { if (_index == 3) { value = (T4)_value!; return true; } value = default; return false; }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3, Func<T4, TResult> onT4) =>
            _index switch { 0 => onT1((T1)_value!), 1 => onT2((T2)_value!), 2 => onT3((T3)_value!), 3 => onT4((T4)_value!), _ => throw new InvalidOperationException() };

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3, Action<T4> onT4)
        {
            switch (_index) { case 0: onT1((T1)_value!); break; case 1: onT2((T2)_value!); break; case 2: onT3((T3)_value!); break; case 3: onT4((T4)_value!); break; }
        }

        public static implicit operator Union<T1, T2, T3, T4>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3, T4>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3, T4>(T3 value) => From3(value);
        public static implicit operator Union<T1, T2, T3, T4>(T4 value) => From4(value);

        public override string? ToString() => _value?.ToString();
        public override bool Equals(object? obj) => obj is Union<T1, T2, T3, T4> other && _index == other._index && Equals(_value, other._value);
        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }

    /// <summary>
    /// Union of five types (T1 | T2 | T3 | T4 | T5 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3, T4, T5>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index) { _value = value; _index = index; }

        public static Union<T1, T2, T3, T4, T5> From1(T1 value) => new(value, 0);
        public static Union<T1, T2, T3, T4, T5> From2(T2 value) => new(value, 1);
        public static Union<T1, T2, T3, T4, T5> From3(T3 value) => new(value, 2);
        public static Union<T1, T2, T3, T4, T5> From4(T4 value) => new(value, 3);
        public static Union<T1, T2, T3, T4, T5> From5(T5 value) => new(value, 4);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;
        public bool Is4() => _index == 3;
        public bool Is5() => _index == 4;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();
        public T3 As3() => _index == 2 ? (T3)_value! : throw new InvalidOperationException();
        public T4 As4() => _index == 3 ? (T4)_value! : throw new InvalidOperationException();
        public T5 As5() => _index == 4 ? (T5)_value! : throw new InvalidOperationException();

        public bool TryAs1(out T1? value) { if (_index == 0) { value = (T1)_value!; return true; } value = default; return false; }
        public bool TryAs2(out T2? value) { if (_index == 1) { value = (T2)_value!; return true; } value = default; return false; }
        public bool TryAs3(out T3? value) { if (_index == 2) { value = (T3)_value!; return true; } value = default; return false; }
        public bool TryAs4(out T4? value) { if (_index == 3) { value = (T4)_value!; return true; } value = default; return false; }
        public bool TryAs5(out T5? value) { if (_index == 4) { value = (T5)_value!; return true; } value = default; return false; }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3, Func<T4, TResult> onT4, Func<T5, TResult> onT5) =>
            _index switch { 0 => onT1((T1)_value!), 1 => onT2((T2)_value!), 2 => onT3((T3)_value!), 3 => onT4((T4)_value!), 4 => onT5((T5)_value!), _ => throw new InvalidOperationException() };

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3, Action<T4> onT4, Action<T5> onT5)
        {
            switch (_index) { case 0: onT1((T1)_value!); break; case 1: onT2((T2)_value!); break; case 2: onT3((T3)_value!); break; case 3: onT4((T4)_value!); break; case 4: onT5((T5)_value!); break; }
        }

        public static implicit operator Union<T1, T2, T3, T4, T5>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3, T4, T5>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3, T4, T5>(T3 value) => From3(value);
        public static implicit operator Union<T1, T2, T3, T4, T5>(T4 value) => From4(value);
        public static implicit operator Union<T1, T2, T3, T4, T5>(T5 value) => From5(value);

        public override string? ToString() => _value?.ToString();
        public override bool Equals(object? obj) => obj is Union<T1, T2, T3, T4, T5> other && _index == other._index && Equals(_value, other._value);
        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }

    /// <summary>
    /// Union of six types (T1 | T2 | T3 | T4 | T5 | T6 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3, T4, T5, T6>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index) { _value = value; _index = index; }

        public static Union<T1, T2, T3, T4, T5, T6> From1(T1 value) => new(value, 0);
        public static Union<T1, T2, T3, T4, T5, T6> From2(T2 value) => new(value, 1);
        public static Union<T1, T2, T3, T4, T5, T6> From3(T3 value) => new(value, 2);
        public static Union<T1, T2, T3, T4, T5, T6> From4(T4 value) => new(value, 3);
        public static Union<T1, T2, T3, T4, T5, T6> From5(T5 value) => new(value, 4);
        public static Union<T1, T2, T3, T4, T5, T6> From6(T6 value) => new(value, 5);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;
        public bool Is4() => _index == 3;
        public bool Is5() => _index == 4;
        public bool Is6() => _index == 5;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();
        public T3 As3() => _index == 2 ? (T3)_value! : throw new InvalidOperationException();
        public T4 As4() => _index == 3 ? (T4)_value! : throw new InvalidOperationException();
        public T5 As5() => _index == 4 ? (T5)_value! : throw new InvalidOperationException();
        public T6 As6() => _index == 5 ? (T6)_value! : throw new InvalidOperationException();

        public bool TryAs1(out T1? value) { if (_index == 0) { value = (T1)_value!; return true; } value = default; return false; }
        public bool TryAs2(out T2? value) { if (_index == 1) { value = (T2)_value!; return true; } value = default; return false; }
        public bool TryAs3(out T3? value) { if (_index == 2) { value = (T3)_value!; return true; } value = default; return false; }
        public bool TryAs4(out T4? value) { if (_index == 3) { value = (T4)_value!; return true; } value = default; return false; }
        public bool TryAs5(out T5? value) { if (_index == 4) { value = (T5)_value!; return true; } value = default; return false; }
        public bool TryAs6(out T6? value) { if (_index == 5) { value = (T6)_value!; return true; } value = default; return false; }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3, Func<T4, TResult> onT4, Func<T5, TResult> onT5, Func<T6, TResult> onT6) =>
            _index switch { 0 => onT1((T1)_value!), 1 => onT2((T2)_value!), 2 => onT3((T3)_value!), 3 => onT4((T4)_value!), 4 => onT5((T5)_value!), 5 => onT6((T6)_value!), _ => throw new InvalidOperationException() };

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3, Action<T4> onT4, Action<T5> onT5, Action<T6> onT6)
        {
            switch (_index) { case 0: onT1((T1)_value!); break; case 1: onT2((T2)_value!); break; case 2: onT3((T3)_value!); break; case 3: onT4((T4)_value!); break; case 4: onT5((T5)_value!); break; case 5: onT6((T6)_value!); break; }
        }

        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T3 value) => From3(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T4 value) => From4(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T5 value) => From5(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6>(T6 value) => From6(value);

        public override string? ToString() => _value?.ToString();
        public override bool Equals(object? obj) => obj is Union<T1, T2, T3, T4, T5, T6> other && _index == other._index && Equals(_value, other._value);
        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }

    /// <summary>
    /// Union of seven types (T1 | T2 | T3 | T4 | T5 | T6 | T7 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3, T4, T5, T6, T7>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index) { _value = value; _index = index; }

        public static Union<T1, T2, T3, T4, T5, T6, T7> From1(T1 value) => new(value, 0);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From2(T2 value) => new(value, 1);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From3(T3 value) => new(value, 2);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From4(T4 value) => new(value, 3);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From5(T5 value) => new(value, 4);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From6(T6 value) => new(value, 5);
        public static Union<T1, T2, T3, T4, T5, T6, T7> From7(T7 value) => new(value, 6);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;
        public bool Is4() => _index == 3;
        public bool Is5() => _index == 4;
        public bool Is6() => _index == 5;
        public bool Is7() => _index == 6;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();
        public T3 As3() => _index == 2 ? (T3)_value! : throw new InvalidOperationException();
        public T4 As4() => _index == 3 ? (T4)_value! : throw new InvalidOperationException();
        public T5 As5() => _index == 4 ? (T5)_value! : throw new InvalidOperationException();
        public T6 As6() => _index == 5 ? (T6)_value! : throw new InvalidOperationException();
        public T7 As7() => _index == 6 ? (T7)_value! : throw new InvalidOperationException();

        public bool TryAs1(out T1? value) { if (_index == 0) { value = (T1)_value!; return true; } value = default; return false; }
        public bool TryAs2(out T2? value) { if (_index == 1) { value = (T2)_value!; return true; } value = default; return false; }
        public bool TryAs3(out T3? value) { if (_index == 2) { value = (T3)_value!; return true; } value = default; return false; }
        public bool TryAs4(out T4? value) { if (_index == 3) { value = (T4)_value!; return true; } value = default; return false; }
        public bool TryAs5(out T5? value) { if (_index == 4) { value = (T5)_value!; return true; } value = default; return false; }
        public bool TryAs6(out T6? value) { if (_index == 5) { value = (T6)_value!; return true; } value = default; return false; }
        public bool TryAs7(out T7? value) { if (_index == 6) { value = (T7)_value!; return true; } value = default; return false; }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3, Func<T4, TResult> onT4, Func<T5, TResult> onT5, Func<T6, TResult> onT6, Func<T7, TResult> onT7) =>
            _index switch { 0 => onT1((T1)_value!), 1 => onT2((T2)_value!), 2 => onT3((T3)_value!), 3 => onT4((T4)_value!), 4 => onT5((T5)_value!), 5 => onT6((T6)_value!), 6 => onT7((T7)_value!), _ => throw new InvalidOperationException() };

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3, Action<T4> onT4, Action<T5> onT5, Action<T6> onT6, Action<T7> onT7)
        {
            switch (_index) { case 0: onT1((T1)_value!); break; case 1: onT2((T2)_value!); break; case 2: onT3((T3)_value!); break; case 3: onT4((T4)_value!); break; case 4: onT5((T5)_value!); break; case 5: onT6((T6)_value!); break; case 6: onT7((T7)_value!); break; }
        }

        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T3 value) => From3(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T4 value) => From4(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T5 value) => From5(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T6 value) => From6(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7>(T7 value) => From7(value);

        public override string? ToString() => _value?.ToString();
        public override bool Equals(object? obj) => obj is Union<T1, T2, T3, T4, T5, T6, T7> other && _index == other._index && Equals(_value, other._value);
        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }

    /// <summary>
    /// Union of eight types (T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 in TypeScript)
    /// </summary>
    public sealed class Union<T1, T2, T3, T4, T5, T6, T7, T8>
    {
        private readonly object? _value;
        private readonly int _index;

        private Union(object? value, int index) { _value = value; _index = index; }

        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From1(T1 value) => new(value, 0);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From2(T2 value) => new(value, 1);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From3(T3 value) => new(value, 2);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From4(T4 value) => new(value, 3);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From5(T5 value) => new(value, 4);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From6(T6 value) => new(value, 5);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From7(T7 value) => new(value, 6);
        public static Union<T1, T2, T3, T4, T5, T6, T7, T8> From8(T8 value) => new(value, 7);

        public bool Is1() => _index == 0;
        public bool Is2() => _index == 1;
        public bool Is3() => _index == 2;
        public bool Is4() => _index == 3;
        public bool Is5() => _index == 4;
        public bool Is6() => _index == 5;
        public bool Is7() => _index == 6;
        public bool Is8() => _index == 7;

        public T1 As1() => _index == 0 ? (T1)_value! : throw new InvalidOperationException();
        public T2 As2() => _index == 1 ? (T2)_value! : throw new InvalidOperationException();
        public T3 As3() => _index == 2 ? (T3)_value! : throw new InvalidOperationException();
        public T4 As4() => _index == 3 ? (T4)_value! : throw new InvalidOperationException();
        public T5 As5() => _index == 4 ? (T5)_value! : throw new InvalidOperationException();
        public T6 As6() => _index == 5 ? (T6)_value! : throw new InvalidOperationException();
        public T7 As7() => _index == 6 ? (T7)_value! : throw new InvalidOperationException();
        public T8 As8() => _index == 7 ? (T8)_value! : throw new InvalidOperationException();

        public bool TryAs1(out T1? value) { if (_index == 0) { value = (T1)_value!; return true; } value = default; return false; }
        public bool TryAs2(out T2? value) { if (_index == 1) { value = (T2)_value!; return true; } value = default; return false; }
        public bool TryAs3(out T3? value) { if (_index == 2) { value = (T3)_value!; return true; } value = default; return false; }
        public bool TryAs4(out T4? value) { if (_index == 3) { value = (T4)_value!; return true; } value = default; return false; }
        public bool TryAs5(out T5? value) { if (_index == 4) { value = (T5)_value!; return true; } value = default; return false; }
        public bool TryAs6(out T6? value) { if (_index == 5) { value = (T6)_value!; return true; } value = default; return false; }
        public bool TryAs7(out T7? value) { if (_index == 6) { value = (T7)_value!; return true; } value = default; return false; }
        public bool TryAs8(out T8? value) { if (_index == 7) { value = (T8)_value!; return true; } value = default; return false; }

        public TResult Match<TResult>(Func<T1, TResult> onT1, Func<T2, TResult> onT2, Func<T3, TResult> onT3, Func<T4, TResult> onT4, Func<T5, TResult> onT5, Func<T6, TResult> onT6, Func<T7, TResult> onT7, Func<T8, TResult> onT8) =>
            _index switch { 0 => onT1((T1)_value!), 1 => onT2((T2)_value!), 2 => onT3((T3)_value!), 3 => onT4((T4)_value!), 4 => onT5((T5)_value!), 5 => onT6((T6)_value!), 6 => onT7((T7)_value!), 7 => onT8((T8)_value!), _ => throw new InvalidOperationException() };

        public void Match(Action<T1> onT1, Action<T2> onT2, Action<T3> onT3, Action<T4> onT4, Action<T5> onT5, Action<T6> onT6, Action<T7> onT7, Action<T8> onT8)
        {
            switch (_index) { case 0: onT1((T1)_value!); break; case 1: onT2((T2)_value!); break; case 2: onT3((T3)_value!); break; case 3: onT4((T4)_value!); break; case 4: onT5((T5)_value!); break; case 5: onT6((T6)_value!); break; case 6: onT7((T7)_value!); break; case 7: onT8((T8)_value!); break; }
        }

        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T1 value) => From1(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T2 value) => From2(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T3 value) => From3(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T4 value) => From4(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T5 value) => From5(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T6 value) => From6(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T7 value) => From7(value);
        public static implicit operator Union<T1, T2, T3, T4, T5, T6, T7, T8>(T8 value) => From8(value);

        public override string? ToString() => _value?.ToString();
        public override bool Equals(object? obj) => obj is Union<T1, T2, T3, T4, T5, T6, T7, T8> other && _index == other._index && Equals(_value, other._value);
        public override int GetHashCode() => HashCode.Combine(_value, _index);
    }
}
