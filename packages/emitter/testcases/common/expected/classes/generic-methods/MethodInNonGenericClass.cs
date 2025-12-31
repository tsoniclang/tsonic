namespace TestCases.common.classes.genericmethods
{
    public class Utils
    {
        public static T identity<T>(T value)
            {
            return value;
            }

        public Utils__wrap__0<T> wrap<T>(T value)
            {
            return new Utils__wrap__0<T> { value = value };
            }

        public Utils__pair__0<K, V> pair<K, V>(K key, V value)
            {
            return new Utils__pair__0<K, V> { key = key, value = value };
            }
    }
    public sealed class Utils__wrap__0<T>
    {
        public T value;
    }
    public sealed class Utils__pair__0<K, V>
    {
        public K key;
        public V value;
    }
}
