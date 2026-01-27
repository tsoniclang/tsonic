namespace TestCases.common.types.genericconstraints
{
    public class RefWrapper<T>
        where T : class
    {
        public T? value { get; set; }

        public RefWrapper(T? value)
            {
            this.value = value;
            }

        public bool isNull()
            {
            return this.value == null;
            }
    }
}