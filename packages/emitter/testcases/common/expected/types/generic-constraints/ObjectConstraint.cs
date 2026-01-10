namespace TestCases.common.types.genericconstraints
{
    public class RefWrapper<T>
        where T : class
    {
        public T? Value;

        public RefWrapper(T? value)
            {
            this.Value = value;
            }

        public bool IsNull()
            {
            return this.Value is null;
            }
    }
}