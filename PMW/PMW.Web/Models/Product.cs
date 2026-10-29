namespace PMW.Web.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public string ImageUrl { get; set; } = "";
    public string Category { get; set; } = "";   // camisetas, moletons, calcas, acessorios
    public string Sizes { get; set; } = "P,M,G,GG";
    public int Stock { get; set; }                // unidades disponíveis (0 = não aparece no site)
}