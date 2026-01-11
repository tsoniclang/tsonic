namespace TestCases.common.classes.genericmethods
{
    public class Transformer<T>
    {
        public T Value;

        public Transformer(T value)
            {
            this.Value = value;
            }

        public Transformer<U> Map<U>(global::System.Func<T, U> fn)
            {
            return new Transformer<U>(fn(this.Value));
            }

        public Transformer<T> Combine(Transformer<T> other, global::System.Func<T, T, T> fn)
            {
            return new Transformer<T>(fn(this.Value, other.Value));
            }
    }
}