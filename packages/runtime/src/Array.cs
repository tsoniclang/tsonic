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
    }
}
