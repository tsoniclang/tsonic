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
}
