namespace Tsonic.Runtime;

using System;
using System.Collections.Generic;
using System.Linq;

/// <summary>
/// DynamicObject provides runtime support for TypeScript keyof and indexed access patterns.
/// Per spec/15-generics.md §7.2 - Runtime Helpers for Generics
/// </summary>
public class DynamicObject
{
    private readonly Dictionary<string, object?> _properties = new();

    /// <summary>
    /// Get a property value with type safety
    /// </summary>
    /// <typeparam name="T">Expected type of the property</typeparam>
    /// <param name="key">Property name</param>
    /// <returns>Property value cast to T, or default(T) if not found</returns>
    public T? GetProperty<T>(string key)
    {
        if (_properties.TryGetValue(key, out var value))
        {
            if (value is T typedValue)
            {
                return typedValue;
            }

            // Try to convert if types don't match
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

    /// <summary>
    /// Set a property value
    /// </summary>
    /// <param name="key">Property name</param>
    /// <param name="value">Property value</param>
    public void SetProperty(string key, object? value)
    {
        _properties[key] = value;
    }

    /// <summary>
    /// Check if a property exists
    /// </summary>
    /// <param name="key">Property name</param>
    /// <returns>True if property exists</returns>
    public bool HasProperty(string key)
    {
        return _properties.ContainsKey(key);
    }

    /// <summary>
    /// Get all property keys (supports TypeScript keyof)
    /// </summary>
    /// <returns>Array of property names</returns>
    public string[] GetKeys()
    {
        return _properties.Keys.ToArray();
    }

    /// <summary>
    /// Get all property values
    /// </summary>
    /// <returns>Array of property values</returns>
    public object?[] GetValues()
    {
        return _properties.Values.ToArray();
    }

    /// <summary>
    /// Indexer for property access using [] syntax
    /// </summary>
    /// <param name="key">Property name</param>
    /// <returns>Property value or null if not found</returns>
    public object? this[string key]
    {
        get => _properties.TryGetValue(key, out var value) ? value : null;
        set => _properties[key] = value;
    }

    /// <summary>
    /// Create a DynamicObject from a dictionary
    /// </summary>
    /// <param name="properties">Dictionary of properties</param>
    /// <returns>New DynamicObject instance</returns>
    public static DynamicObject FromDictionary(Dictionary<string, object?> properties)
    {
        var obj = new DynamicObject();
        foreach (var (key, value) in properties)
        {
            obj.SetProperty(key, value);
        }
        return obj;
    }

    /// <summary>
    /// Convert this DynamicObject to a dictionary
    /// </summary>
    /// <returns>Dictionary representation</returns>
    public Dictionary<string, object?> ToDictionary()
    {
        return new Dictionary<string, object?>(_properties);
    }
}
