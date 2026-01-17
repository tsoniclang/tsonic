// Generated from: MethodInNonGenericClass.ts
// Generated at: 2026-01-17T15:36:49.661Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.genericmethods
{
    public class Wrapper <T>
    {
        public required T value { get; set; }
    }
    public class Pair <K, V>
    {
        public required K key { get; set; }

        public required V value { get; set; }
    }
    public class Utils
    {
        public static T identity<T>(T value)
            {
            return value;
            }

        public Wrapper<T> wrap<T>(T value)
            {
            return new Wrapper<T> { value = value };
            }

        public Pair<K, V> pair<K, V>(K key, V value)
            {
            return new Pair<K, V> { key = key, value = value };
            }
    }
}