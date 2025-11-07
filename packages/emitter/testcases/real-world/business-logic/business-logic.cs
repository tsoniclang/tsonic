
using Tsonic.Runtime;

namespace TestCases.realworld
{
    public class Product
    {
        public string id { get; set; }

        public string name { get; set; }

        public double price { get; set; }

        public double stock { get; set; }

        public string category { get; set; }
    }
    public class CartItem
    {
        public Product product { get; set; }

        public double quantity { get; set; }
    }
    public class Order
    {
        public string id { get; set; }

        public Tsonic.Runtime.Array<CartItem> items { get; set; }

        public double total { get; set; }

        public OrderStatus status { get; set; }

        public Date createdAt { get; set; }
    }
    public class ShoppingCart
    {
        private Tsonic.Runtime.Array<CartItem> items = new Tsonic.Runtime.Array<object>();

        public bool addItem(Product product, double quantity)
            {
            if (quantity <= 0.0 || quantity > product.stock)
                {
                return false;
                }
            var existingItem = this.items.find((item) => item.product.id == product.id);
            if (existingItem)
                {
                var newQuantity = existingItem.quantity + quantity;
                if (newQuantity > product.stock)
                    {
                    return false;
                    }
                existingItem.quantity = newQuantity;
                }
            else
                {
                this.items.push(new { product = product, quantity = quantity });
                }
            return true;
            }

        public bool removeItem(string productId)
            {
            var index = this.items.findIndex((item) => item.product.id == productId);
            if (index != -1.0)
                {
                this.items.splice(index, 1.0);
                return true;
                }
            return false;
            }

        public bool updateQuantity(string productId, double quantity)
            {
            var item = this.items.find((item) => item.product.id == productId);
            if (!item)
                {
                return false;
                }
            if (quantity <= 0.0)
                {
                return this.removeItem(productId);
                }
            if (quantity > item.product.stock)
                {
                return false;
                }
            item.quantity = quantity;
            return true;
            }

        public double getTotal()
            {
            return this.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0.0);
            }

        public double getItemCount()
            {
            return this.items.reduce((sum, item) => sum + item.quantity, 0.0);
            }

        public Tsonic.Runtime.Array<CartItem> getItems()
            {
            return this.items;
            }

        public void clear()
            {
            this.items = new Tsonic.Runtime.Array<object>();
            }
    }
    public class DiscountCalculator
    {
        public static double applyPercentageDiscount(double price, double percentage)
            {
            if (percentage < 0.0 || percentage > 100.0)
                {
                throw new Error("Invalid discount percentage");
                }
            return price * 1.0 - percentage / 100.0;
            }

        public static double applyFixedDiscount(double price, double discount)
            {
            var result = price - discount;
            return result < 0.0 ? 0.0 : result;
            }

        public static double calculateBulkDiscount(double quantity, double price)
            {
            if (quantity >= 100.0)
                {
                return this.applyPercentageDiscount(price, 20.0);
                }
            else
                if (quantity >= 50.0)
                    {
                    return this.applyPercentageDiscount(price, 15.0);
                    }
                else
                    if (quantity >= 10.0)
                        {
                        return this.applyPercentageDiscount(price, 10.0);
                        }
            return price;
            }
    }
    public class OrderProcessor
    {
        private double nextOrderId = 1.0;

        public Order createOrder(ShoppingCart cart)
            {
            var items = cart.getItems();
            if (items.length == 0.0)
                {
                throw new Error("Cannot create order from empty cart");
                }
            Order order = new { id = $"ORD-{this.nextOrderId++}", items = items, total = cart.getTotal(), status = "pending", createdAt = new Date() };
            return order;
            }

        public void updateOrderStatus(Order order, OrderStatus newStatus)
            {
            Record<OrderStatus, Tsonic.Runtime.Array<OrderStatus>> validTransitions = new { pending = new Tsonic.Runtime.Array<object>("processing", "cancelled"), processing = new Tsonic.Runtime.Array<object>("shipped", "cancelled"), shipped = new Tsonic.Runtime.Array<object>("delivered"), delivered = new Tsonic.Runtime.Array<object>(), cancelled = new Tsonic.Runtime.Array<object>() };
            var allowed = validTransitions[order.status];
            if (!allowed.includes(newStatus))
                {
                throw new Error($"Cannot transition from {order.status} to {newStatus}");
                }
            order.status = newStatus;
            }

        public bool cancelOrder(Order order)
            {
            if (order.status == "delivered")
                {
                return false;
                }
            if (order.status == "cancelled")
                {
                return false;
                }
            order.status = "cancelled";
            return true;
            }
    }

    public static class businesslogic
    {
        // type OrderStatus = Union<string, string, string, string, string>

        public static Tsonic.Runtime.Array<Product> searchProducts(Tsonic.Runtime.Array<Product> products, string query)
            {
            var lowerQuery = Tsonic.Runtime.String.toLowerCase(query);
            return products.filter((p) => Tsonic.Runtime.String.includes(Tsonic.Runtime.String.toLowerCase(p.name), lowerQuery) || Tsonic.Runtime.String.includes(Tsonic.Runtime.String.toLowerCase(p.category), lowerQuery));
            }

        public static Tsonic.Runtime.Array<Product> filterByCategory(Tsonic.Runtime.Array<Product> products, string category)
            {
            return products.filter((p) => p.category == category);
            }

        public static Tsonic.Runtime.Array<Product> filterByPriceRange(Tsonic.Runtime.Array<Product> products, double minPrice, double maxPrice)
            {
            return products.filter((p) => p.price >= minPrice && p.price <= maxPrice);
            }

        public static Tsonic.Runtime.Array<Product> sortByPrice(Tsonic.Runtime.Array<Product> products, bool ascending = true)
            {
            var sorted = products;
            sorted.sort((a, b) =>
            {
            return ascending ? a.price - b.price : b.price - a.price;
            });
            return sorted;
            }
    }
}