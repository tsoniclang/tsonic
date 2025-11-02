namespace Tsonic.Runtime;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

/// <summary>
/// Structural utilities for cloning and adapting objects.
/// Per spec/16-types-and-interfaces.md §6 - Runtime Helpers
/// </summary>
public static class Structural
{
    /// <summary>
    /// Clone a source object into a target type T.
    /// Copies properties from source to a new instance of T.
    /// </summary>
    /// <typeparam name="T">Target type to clone into</typeparam>
    /// <param name="source">Source object to clone from</param>
    /// <returns>New instance of T with properties copied from source</returns>
    public static T? Clone<T>(object? source) where T : new()
    {
        if (source == null)
        {
            return default;
        }

        var target = new T();
        var sourceType = source.GetType();
        var targetType = typeof(T);

        // Get all writable properties of target type
        var targetProperties = targetType.GetProperties(
            BindingFlags.Public | BindingFlags.Instance
        ).Where(p => p.CanWrite);

        foreach (var targetProp in targetProperties)
        {
            // Try to find corresponding property in source
            var sourceProp = sourceType.GetProperty(
                targetProp.Name,
                BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase
            );

            if (sourceProp != null && sourceProp.CanRead)
            {
                try
                {
                    var sourceValue = sourceProp.GetValue(source);

                    // Try to convert and set the value
                    if (sourceValue != null)
                    {
                        var convertedValue = ConvertValue(sourceValue, targetProp.PropertyType);
                        targetProp.SetValue(target, convertedValue);
                    }
                }
                catch
                {
                    // Ignore properties that can't be copied
                }
            }
        }

        return target;
    }

    /// <summary>
    /// Clone a dictionary into a target type T.
    /// </summary>
    /// <typeparam name="T">Target type to clone into</typeparam>
    /// <param name="source">Source dictionary</param>
    /// <returns>New instance of T with properties from dictionary</returns>
    public static T? CloneFromDictionary<T>(Dictionary<string, object?> source) where T : new()
    {
        if (source == null)
        {
            return default;
        }

        var target = new T();
        var targetType = typeof(T);

        var targetProperties = targetType.GetProperties(
            BindingFlags.Public | BindingFlags.Instance
        ).Where(p => p.CanWrite);

        foreach (var targetProp in targetProperties)
        {
            if (source.TryGetValue(targetProp.Name, out var value))
            {
                try
                {
                    if (value != null)
                    {
                        var convertedValue = ConvertValue(value, targetProp.PropertyType);
                        targetProp.SetValue(target, convertedValue);
                    }
                }
                catch
                {
                    // Ignore properties that can't be set
                }
            }
        }

        return target;
    }

    /// <summary>
    /// Convert an object to a dictionary.
    /// Useful for working with index signatures.
    /// </summary>
    /// <param name="source">Source object</param>
    /// <returns>Dictionary representation of object properties</returns>
    public static Dictionary<string, object?> ToDictionary(object? source)
    {
        var result = new Dictionary<string, object?>();

        if (source == null)
        {
            return result;
        }

        var sourceType = source.GetType();
        var properties = sourceType.GetProperties(BindingFlags.Public | BindingFlags.Instance);

        foreach (var prop in properties)
        {
            if (prop.CanRead)
            {
                try
                {
                    result[prop.Name] = prop.GetValue(source);
                }
                catch
                {
                    // Ignore properties that can't be read
                }
            }
        }

        return result;
    }

    /// <summary>
    /// Create a dictionary adapter that wraps a dictionary with typed access.
    /// Supports TypeScript index signatures like { [key: string]: T }
    /// </summary>
    /// <typeparam name="T">Value type</typeparam>
    /// <param name="source">Source dictionary</param>
    /// <returns>Dictionary adapter instance</returns>
    public static DictionaryAdapter<T> CreateDictionaryAdapter<T>(Dictionary<string, object?> source)
    {
        return new DictionaryAdapter<T>(source);
    }

    /// <summary>
    /// Helper method to convert a value to a target type
    /// </summary>
    private static object? ConvertValue(object value, Type targetType)
    {
        // Handle nullable types
        var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

        // If types match, return as-is
        if (underlyingType.IsAssignableFrom(value.GetType()))
        {
            return value;
        }

        // Try direct conversion
        try
        {
            return Convert.ChangeType(value, underlyingType);
        }
        catch
        {
            // If direct conversion fails, try recursive cloning for complex types
            if (underlyingType.IsClass && underlyingType != typeof(string))
            {
                var cloneMethod = typeof(Structural)
                    .GetMethod(nameof(Clone))
                    ?.MakeGenericMethod(underlyingType);

                return cloneMethod?.Invoke(null, new[] { value });
            }

            return null;
        }
    }
}

/// <summary>
/// Dictionary adapter that provides typed access to dictionary values.
/// Supports TypeScript index signatures.
/// </summary>
/// <typeparam name="T">Value type</typeparam>
public class DictionaryAdapter<T>
{
    private readonly Dictionary<string, object?> _dictionary;

    public DictionaryAdapter(Dictionary<string, object?> dictionary)
    {
        _dictionary = dictionary ?? new Dictionary<string, object?>();
    }

    /// <summary>
    /// Indexer for typed dictionary access
    /// </summary>
    /// <param name="key">Dictionary key</param>
    /// <returns>Typed value or default(T) if not found or wrong type</returns>
    public T? this[string key]
    {
        get
        {
            if (_dictionary.TryGetValue(key, out var value))
            {
                if (value is T typedValue)
                {
                    return typedValue;
                }

                try
                {
                    return (T?)Convert.ChangeType(value, typeof(T));
                }
                catch
                {
                    return default;
                }
            }

            return default;
        }
        set => _dictionary[key] = value;
    }

    /// <summary>
    /// Get all keys
    /// </summary>
    public IEnumerable<string> Keys => _dictionary.Keys;

    /// <summary>
    /// Get all values (typed)
    /// </summary>
    public IEnumerable<T?> Values =>
        _dictionary.Values.Select(v =>
        {
            if (v is T typedValue)
            {
                return typedValue;
            }

            try
            {
                return (T?)Convert.ChangeType(v, typeof(T));
            }
            catch
            {
                return default(T);
            }
        });

    /// <summary>
    /// Check if key exists
    /// </summary>
    public bool ContainsKey(string key) => _dictionary.ContainsKey(key);

    /// <summary>
    /// Get the underlying dictionary
    /// </summary>
    public Dictionary<string, object?> GetDictionary() => new Dictionary<string, object?>(_dictionary);
}
