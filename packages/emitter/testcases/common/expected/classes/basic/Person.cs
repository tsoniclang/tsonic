namespace TestCases.common.classes.basic
{
    public class Person
    {
        public string name { get; set; }

        public double age { get; set; }

        public string greet()
        {
            return $"Hello, I'm {this.name}";
        }

        public void birthday()
        {
            this.age++;
        }
    }
}