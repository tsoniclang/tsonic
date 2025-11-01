/**
 * JavaScript Array<T> implementation with sparse array support
 */

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Array<T> with JavaScript semantics including sparse arrays
    /// </summary>
    public class Array<T> : IEnumerable<T>
    {
        private Dictionary<int, T> _items;
        private int _length;

        /// <summary>
        /// Create empty array
        /// </summary>
        public Array()
        {
            _items = new Dictionary<int, T>();
            _length = 0;
        }

        /// <summary>
        /// Create array from items
        /// </summary>
        public Array(params T[] items)
        {
            _items = new Dictionary<int, T>();
            _length = items.Length;

            for (int i = 0; i < items.Length; i++)
            {
                _items[i] = items[i];
            }
        }

        /// <summary>
        /// Array length property
        /// </summary>
        public int length
        {
            get => _length;
            set
            {
                if (value < 0)
                {
                    throw new ArgumentException("Invalid array length");
                }

                if (value < _length)
                {
                    // Truncate - remove items beyond new length
                    var keysToRemove = _items.Keys.Where(k => k >= value).ToList();
                    foreach (var key in keysToRemove)
                    {
                        _items.Remove(key);
                    }
                }

                _length = value;
            }
        }

        /// <summary>
        /// Indexer - supports sparse arrays
        /// </summary>
        public T this[int index]
        {
            get => _items.ContainsKey(index) ? _items[index] : default(T)!;
            set
            {
                _items[index] = value;
                if (index >= _length)
                {
                    _length = index + 1;
                }
            }
        }

        /// <summary>
        /// Add item to end of array
        /// </summary>
        public void push(T item)
        {
            _items[_length] = item;
            _length++;
        }

        /// <summary>
        /// Remove and return last item
        /// </summary>
        public T pop()
        {
            if (_length == 0)
            {
                return default(T)!;
            }

            _length--;
            T item = _items.ContainsKey(_length) ? _items[_length] : default(T)!;
            _items.Remove(_length);
            return item;
        }

        /// <summary>
        /// Remove and return first item
        /// </summary>
        public T shift()
        {
            if (_length == 0)
            {
                return default(T)!;
            }

            T item = _items.ContainsKey(0) ? _items[0] : default(T)!;

            // Shift all items down
            var newItems = new Dictionary<int, T>();
            for (int i = 1; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    newItems[i - 1] = _items[i];
                }
            }

            _items = newItems;
            _length--;
            return item;
        }

        /// <summary>
        /// Add item to beginning of array
        /// </summary>
        public void unshift(T item)
        {
            // Shift all items up
            var newItems = new Dictionary<int, T>();
            newItems[0] = item;

            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    newItems[i + 1] = _items[i];
                }
            }

            _items = newItems;
            _length++;
        }

        /// <summary>
        /// Return shallow copy of portion of array
        /// </summary>
        public Array<T> slice(int start = 0, int? end = null)
        {
            int actualStart = start < 0 ? System.Math.Max(0, _length + start) : start;
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? System.Math.Max(0, _length + end.Value) : end.Value)
                : _length;

            var result = new Array<T>();
            int resultIndex = 0;

            for (int i = actualStart; i < actualEnd && i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    result[resultIndex] = _items[i];
                }
                resultIndex++;
            }

            return result;
        }

        /// <summary>
        /// Find index of element
        /// </summary>
        public int indexOf(T searchElement, int fromIndex = 0)
        {
            for (int i = fromIndex; i < _length; i++)
            {
                if (_items.ContainsKey(i) && EqualityComparer<T>.Default.Equals(_items[i], searchElement))
                {
                    return i;
                }
            }
            return -1;
        }

        /// <summary>
        /// Check if array includes element
        /// </summary>
        public bool includes(T searchElement)
        {
            return indexOf(searchElement) >= 0;
        }

        /// <summary>
        /// Join array elements into string
        /// </summary>
        public string join(string separator = ",")
        {
            var parts = new List<string>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    parts.Add(_items[i]?.ToString() ?? "");
                }
                else
                {
                    parts.Add(""); // Sparse array hole
                }
            }
            return string.Join(separator, parts);
        }

        /// <summary>
        /// Reverse array in place
        /// </summary>
        public void reverse()
        {
            var temp = new Dictionary<int, T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    temp[_length - 1 - i] = _items[i];
                }
            }
            _items = temp;
        }

        /// <summary>
        /// Map array elements to new array
        /// </summary>
        public Array<TResult> map<TResult>(Func<T, int, Array<T>, TResult> callback)
        {
            var result = new Array<TResult>();
            for (int i = 0; i < _length; i++)
            {
                T value = _items.ContainsKey(i) ? _items[i] : default(T)!;
                result[i] = callback(value, i, this);
            }
            return result;
        }

        /// <summary>
        /// Filter array elements
        /// </summary>
        public Array<T> filter(Func<T, int, Array<T>, bool> callback)
        {
            var result = new Array<T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    T value = _items[i];
                    if (callback(value, i, this))
                    {
                        result.push(value);
                    }
                }
            }
            return result;
        }

        /// <summary>
        /// Reduce array to single value
        /// </summary>
        public TResult reduce<TResult>(Func<TResult, T, int, Array<T>, TResult> callback, TResult initialValue)
        {
            TResult accumulator = initialValue;
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    accumulator = callback(accumulator, _items[i], i, this);
                }
            }
            return accumulator;
        }

        /// <summary>
        /// Reduce array to single value (no initial value)
        /// </summary>
        public T reduce(Func<T, T, int, Array<T>, T> callback)
        {
            if (_length == 0)
            {
                throw new InvalidOperationException("Reduce of empty array with no initial value");
            }

            T accumulator = this[0];
            for (int i = 1; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    accumulator = callback(accumulator, _items[i], i, this);
                }
            }
            return accumulator;
        }

        /// <summary>
        /// Reduce array from right to left
        /// </summary>
        public TResult reduceRight<TResult>(Func<TResult, T, int, Array<T>, TResult> callback, TResult initialValue)
        {
            TResult accumulator = initialValue;
            for (int i = _length - 1; i >= 0; i--)
            {
                if (_items.ContainsKey(i))
                {
                    accumulator = callback(accumulator, _items[i], i, this);
                }
            }
            return accumulator;
        }

        /// <summary>
        /// Reduce array from right to left (no initial value)
        /// </summary>
        public T reduceRight(Func<T, T, int, Array<T>, T> callback)
        {
            if (_length == 0)
            {
                throw new InvalidOperationException("Reduce of empty array with no initial value");
            }

            T accumulator = this[_length - 1];
            for (int i = _length - 2; i >= 0; i--)
            {
                if (_items.ContainsKey(i))
                {
                    accumulator = callback(accumulator, _items[i], i, this);
                }
            }
            return accumulator;
        }

        /// <summary>
        /// Execute callback for each element
        /// </summary>
        public void forEach(Action<T, int, Array<T>> callback)
        {
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    callback(_items[i], i, this);
                }
            }
        }

        /// <summary>
        /// Add/remove elements at position
        /// </summary>
        public Array<T> splice(int start, int? deleteCount = null, params T[] items)
        {
            int actualStart = start < 0 ? System.Math.Max(0, _length + start) : System.Math.Min(start, _length);
            int actualDeleteCount = deleteCount ?? (_length - actualStart);
            actualDeleteCount = System.Math.Max(0, System.Math.Min(actualDeleteCount, _length - actualStart));

            // Extract deleted elements
            var deleted = new Array<T>();
            for (int i = 0; i < actualDeleteCount; i++)
            {
                int index = actualStart + i;
                if (_items.ContainsKey(index))
                {
                    deleted.push(_items[index]);
                }
                else
                {
                    deleted.push(default(T)!);
                }
            }

            // Calculate new length
            int itemsToAdd = items.Length;
            int newLength = _length - actualDeleteCount + itemsToAdd;

            // Create new dictionary
            var newItems = new Dictionary<int, T>();

            // Copy elements before start
            for (int i = 0; i < actualStart; i++)
            {
                if (_items.ContainsKey(i))
                {
                    newItems[i] = _items[i];
                }
            }

            // Insert new items
            for (int i = 0; i < itemsToAdd; i++)
            {
                newItems[actualStart + i] = items[i];
            }

            // Copy remaining elements
            for (int i = actualStart + actualDeleteCount; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    newItems[i - actualDeleteCount + itemsToAdd] = _items[i];
                }
            }

            _items = newItems;
            _length = newLength;

            return deleted;
        }

        /// <summary>
        /// Concatenate arrays
        /// </summary>
        public Array<T> concat(params object[] items)
        {
            var result = new Array<T>();

            // Copy this array
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    result.push(_items[i]);
                }
                else
                {
                    result.push(default(T)!);
                }
            }

            // Add items
            foreach (var item in items)
            {
                if (item is Array<T> arr)
                {
                    for (int i = 0; i < arr.length; i++)
                    {
                        result.push(arr[i]);
                    }
                }
                else if (item is T value)
                {
                    result.push(value);
                }
            }

            return result;
        }

        /// <summary>
        /// Find first element matching predicate
        /// </summary>
        public T find(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    T value = _items[i];
                    if (callback(value, i, this))
                    {
                        return value;
                    }
                }
            }
            return default(T)!;
        }

        /// <summary>
        /// Find index of first element matching predicate
        /// </summary>
        public int findIndex(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    if (callback(_items[i], i, this))
                    {
                        return i;
                    }
                }
            }
            return -1;
        }

        /// <summary>
        /// Find last element matching predicate
        /// </summary>
        public T findLast(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = _length - 1; i >= 0; i--)
            {
                if (_items.ContainsKey(i))
                {
                    T value = _items[i];
                    if (callback(value, i, this))
                    {
                        return value;
                    }
                }
            }
            return default(T)!;
        }

        /// <summary>
        /// Find index of last element matching predicate
        /// </summary>
        public int findLastIndex(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = _length - 1; i >= 0; i--)
            {
                if (_items.ContainsKey(i))
                {
                    if (callback(_items[i], i, this))
                    {
                        return i;
                    }
                }
            }
            return -1;
        }

        /// <summary>
        /// Test if all elements match predicate
        /// </summary>
        public bool every(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    if (!callback(_items[i], i, this))
                    {
                        return false;
                    }
                }
            }
            return true;
        }

        /// <summary>
        /// Test if any element matches predicate
        /// </summary>
        public bool some(Func<T, int, Array<T>, bool> callback)
        {
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    if (callback(_items[i], i, this))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        /// <summary>
        /// Find last index of element
        /// </summary>
        public int lastIndexOf(T searchElement, int? fromIndex = null)
        {
            int startIndex = fromIndex ?? _length - 1;
            if (startIndex < 0)
            {
                startIndex = _length + startIndex;
            }
            startIndex = System.Math.Min(startIndex, _length - 1);

            for (int i = startIndex; i >= 0; i--)
            {
                if (_items.ContainsKey(i) && EqualityComparer<T>.Default.Equals(_items[i], searchElement))
                {
                    return i;
                }
            }
            return -1;
        }

        /// <summary>
        /// Sort array in place
        /// </summary>
        public void sort(Func<T, T, double>? compareFunc = null)
        {
            var nonSparseItems = new List<(int index, T value)>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    nonSparseItems.Add((i, _items[i]));
                }
            }

            if (compareFunc != null)
            {
                nonSparseItems.Sort((a, b) =>
                {
                    double result = compareFunc(a.value, b.value);
                    return result < 0 ? -1 : result > 0 ? 1 : 0;
                });
            }
            else
            {
                nonSparseItems.Sort((a, b) =>
                {
                    string aStr = a.value?.ToString() ?? "";
                    string bStr = b.value?.ToString() ?? "";
                    return string.Compare(aStr, bStr, StringComparison.Ordinal);
                });
            }

            _items.Clear();
            for (int i = 0; i < nonSparseItems.Count; i++)
            {
                _items[i] = nonSparseItems[i].value;
            }
        }

        /// <summary>
        /// Get element at index (supports negative indices)
        /// </summary>
        public T at(int index)
        {
            int actualIndex = index < 0 ? _length + index : index;
            if (actualIndex < 0 || actualIndex >= _length)
            {
                return default(T)!;
            }
            return _items.ContainsKey(actualIndex) ? _items[actualIndex] : default(T)!;
        }

        /// <summary>
        /// Flatten nested arrays by specified depth
        /// </summary>
        public Array<object> flat(int depth = 1)
        {
            var result = new Array<object>();
            FlattenHelper(this, result, depth);
            return result;
        }

        private static void FlattenHelper(object arr, Array<object> result, int depth)
        {
            if (arr is Array<T> typedArr)
            {
                for (int i = 0; i < typedArr.length; i++)
                {
                    if (typedArr._items.ContainsKey(i))
                    {
                        var item = typedArr._items[i];
                        if (depth > 0 && item != null && item.GetType().IsGenericType &&
                            item.GetType().GetGenericTypeDefinition() == typeof(Array<>))
                        {
                            FlattenHelper(item, result, depth - 1);
                        }
                        else
                        {
                            result.push(item!);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Map then flatten result
        /// </summary>
        public Array<TResult> flatMap<TResult>(Func<T, int, Array<T>, object> callback)
        {
            var result = new Array<TResult>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    T value = _items[i];
                    var mapped = callback(value, i, this);

                    if (mapped is Array<TResult> arr)
                    {
                        for (int j = 0; j < arr.length; j++)
                        {
                            result.push(arr[j]);
                        }
                    }
                    else if (mapped is TResult singleValue)
                    {
                        result.push(singleValue);
                    }
                }
            }
            return result;
        }

        /// <summary>
        /// Fill array with value
        /// </summary>
        public Array<T> fill(T value, int start = 0, int? end = null)
        {
            int actualStart = start < 0 ? System.Math.Max(0, _length + start) : start;
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? _length + end.Value : end.Value)
                : _length;

            for (int i = actualStart; i < actualEnd && i < _length; i++)
            {
                _items[i] = value;
            }
            return this;
        }

        /// <summary>
        /// Copy array section to another location
        /// </summary>
        public Array<T> copyWithin(int target, int start = 0, int? end = null)
        {
            int actualTarget = target < 0 ? System.Math.Max(0, _length + target) : target;
            int actualStart = start < 0 ? System.Math.Max(0, _length + start) : start;
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? _length + end.Value : end.Value)
                : _length;

            int count = System.Math.Min(actualEnd - actualStart, _length - actualTarget);

            var temp = new Dictionary<int, T>();
            for (int i = 0; i < count; i++)
            {
                int srcIndex = actualStart + i;
                if (_items.ContainsKey(srcIndex))
                {
                    temp[i] = _items[srcIndex];
                }
            }

            for (int i = 0; i < count; i++)
            {
                int destIndex = actualTarget + i;
                if (temp.ContainsKey(i))
                {
                    _items[destIndex] = temp[i];
                }
                else
                {
                    _items.Remove(destIndex);
                }
            }

            return this;
        }

        /// <summary>
        /// Get iterator for [index, value] pairs
        /// </summary>
        public IEnumerable<(int index, T value)> entries()
        {
            for (int i = 0; i < _length; i++)
            {
                yield return (i, _items.ContainsKey(i) ? _items[i] : default(T)!);
            }
        }

        /// <summary>
        /// Get iterator for keys (indices)
        /// </summary>
        public IEnumerable<int> keys()
        {
            for (int i = 0; i < _length; i++)
            {
                yield return i;
            }
        }

        /// <summary>
        /// Get iterator for values
        /// </summary>
        public IEnumerable<T> values()
        {
            for (int i = 0; i < _length; i++)
            {
                yield return _items.ContainsKey(i) ? _items[i] : default(T)!;
            }
        }

        /// <summary>
        /// Convert to string
        /// </summary>
        public override string ToString()
        {
            return join(",");
        }

        /// <summary>
        /// Convert to locale string
        /// </summary>
        public string toLocaleString()
        {
            return join(",");
        }

        /// <summary>
        /// Create new array with element replaced (immutable)
        /// </summary>
        public Array<T> @with(int index, T value)
        {
            int actualIndex = index < 0 ? _length + index : index;
            if (actualIndex < 0 || actualIndex >= _length)
            {
                throw new ArgumentOutOfRangeException(nameof(index));
            }

            var result = new Array<T>();
            for (int i = 0; i < _length; i++)
            {
                if (i == actualIndex)
                {
                    result[i] = value;
                }
                else if (_items.ContainsKey(i))
                {
                    result[i] = _items[i];
                }
            }
            return result;
        }

        /// <summary>
        /// Create new reversed array (immutable)
        /// </summary>
        public Array<T> toReversed()
        {
            var result = new Array<T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    result[_length - 1 - i] = _items[i];
                }
            }
            return result;
        }

        /// <summary>
        /// Create new sorted array (immutable)
        /// </summary>
        public Array<T> toSorted(Func<T, T, double>? compareFunc = null)
        {
            var result = new Array<T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    result[i] = _items[i];
                }
            }
            result.sort(compareFunc);
            return result;
        }

        /// <summary>
        /// Create new spliced array (immutable)
        /// </summary>
        public Array<T> toSpliced(int start, int? deleteCount = null, params T[] items)
        {
            var result = new Array<T>();
            for (int i = 0; i < _length; i++)
            {
                if (_items.ContainsKey(i))
                {
                    result[i] = _items[i];
                }
            }
            result.splice(start, deleteCount, items);
            return result;
        }

        /// <summary>
        /// Convert to native C# array
        /// </summary>
        public T[] ToArray()
        {
            var result = new T[_length];
            for (int i = 0; i < _length; i++)
            {
                result[i] = _items.ContainsKey(i) ? _items[i] : default(T)!;
            }
            return result;
        }

        /// <summary>
        /// IEnumerable<T> implementation for foreach and LINQ
        /// </summary>
        public IEnumerator<T> GetEnumerator()
        {
            for (int i = 0; i < _length; i++)
            {
                yield return _items.ContainsKey(i) ? _items[i] : default(T)!;
            }
        }

        IEnumerator IEnumerable.GetEnumerator()
        {
            return GetEnumerator();
        }

        /// <summary>
        /// Static method: Check if value is an array
        /// </summary>
        public static bool isArray(object? value)
        {
            if (value == null) return false;
            Type type = value.GetType();
            return type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Array<>);
        }

        /// <summary>
        /// Static method: Create array from iterable
        /// </summary>
        public static Array<T> from(IEnumerable<T> iterable)
        {
            var result = new Array<T>();
            foreach (var item in iterable)
            {
                result.push(item);
            }
            return result;
        }

        /// <summary>
        /// Static method: Create array from iterable with map function
        /// </summary>
        public static Array<TResult> from<TSource, TResult>(IEnumerable<TSource> iterable, Func<TSource, int, TResult> mapFunc)
        {
            var result = new Array<TResult>();
            int index = 0;
            foreach (var item in iterable)
            {
                result.push(mapFunc(item, index++));
            }
            return result;
        }

        /// <summary>
        /// Static method: Create array from arguments
        /// </summary>
        public static Array<T> of(params T[] items)
        {
            return new Array<T>(items);
        }
    }
}
