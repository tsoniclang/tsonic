namespace TestCases.common.classes.inheritance
{
    public class Animal
    {
        public string Name;

        public Animal(string name)
            {
            this.Name = name;
            }

        public string MakeSound()
            {
            return "Some sound";
            }
    }
    public class Dog : Animal
    {
        public string Breed;

        public Dog(string name, string breed) : base(name)
            {
            this.Breed = breed;
            }

        public override string MakeSound()
            {
            return "Woof!";
            }
    }
}