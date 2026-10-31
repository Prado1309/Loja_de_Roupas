namespace PMW.Web.Models;

// Pedido feito pelo cliente
public class Order
{
    public int Id { get; set; }
    public string Code { get; set; } = "";                 // código público do pedido (ex.: 3F9A1C0B22D4)
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "aguardando pagamento";

    // dados do cliente e da entrega
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Zip { get; set; } = "";
    public string Street { get; set; } = "";
    public string Number { get; set; } = "";
    public string Complement { get; set; } = "";
    public string District { get; set; } = "";
    public string City { get; set; } = "";
    public string State { get; set; } = "";

    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}

// Uma linha do pedido. Guarda nome e preço da época da compra.
public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public string Size { get; set; } = "";
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}

// Dados que o navegador envia ao criar um pedido
public record OrderItemRequest(int ProductId, string? Size, int Quantity);
public record CreateOrderRequest(
    string? Name, string? Email, string? Phone, string? Zip, string? Street,
    string? Number, string? Complement, string? District, string? City, string? State,
    List<OrderItemRequest>? Items);