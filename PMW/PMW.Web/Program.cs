using Microsoft.EntityFrameworkCore;
using PMW.Web.Data;
using PMW.Web.Models;

var builder = WebApplication.CreateBuilder(args);

// No Azure (Linux) a pasta /home é preservada entre reinícios
var dbPath = builder.Environment.IsDevelopment() ? "pmw.db" : "/home/pmw.db";
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite($"Data Source={dbPath}"));

var app = builder.Build();

app.UseDefaultFiles();   // "/" abre o index.html
app.UseStaticFiles();    // serve a pasta wwwroot

// Cria o banco e cadastra produtos de exemplo (só se a tabela estiver vazia)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    if (!db.Products.Any())
    {
        db.Products.AddRange(
            new Product { Name = "Camiseta Oversized PMW", Description = "100% algodão, estampa frontal.", Price = 129.90m, Category = "camisetas", ImageUrl = "/img/p-camiseta1.jpg", Stock = 12 },
            new Product { Name = "Camiseta Graphic 01", Description = "Estampa nas costas, caimento largo.", Price = 139.90m, Category = "camisetas", ImageUrl = "/img/p-camiseta2.jpg", Stock = 8 },
            new Product { Name = "Moletom Boxy PMW", Description = "Felpudo, caimento largo.", Price = 249.90m, Category = "moletons", ImageUrl = "/img/p-moletom1.jpg", Stock = 5 },
            new Product { Name = "Moletom Zip Tech", Description = "Zíper frontal e bolso canguru.", Price = 279.90m, Category = "moletons", ImageUrl = "/img/p-moletom2.jpg", Stock = 0 }, // sem estoque: não aparece
            new Product { Name = "Calça Cargo Tech", Description = "Bolsos laterais, tecido leve.", Price = 219.90m, Category = "calcas", ImageUrl = "/img/p-calca1.jpg", Stock = 7 },
            new Product { Name = "Calça Wide Jeans", Description = "Jeans largo, lavagem escura.", Price = 229.90m, Category = "calcas", ImageUrl = "/img/p-calca2.jpg", Stock = 4 },
            new Product { Name = "Boné Five Panel", Description = "Aba curva, regulagem traseira.", Price = 89.90m, Category = "acessorios", ImageUrl = "/img/p-bone1.jpg", Sizes = "Único", Stock = 15 },
            new Product { Name = "Ecobag PMW", Description = "Algodão cru, estampa em serigrafia.", Price = 59.90m, Category = "acessorios", ImageUrl = "/img/p-ecobag1.jpg", Sizes = "Único", Stock = 20 }
        );
        db.SaveChanges();
    }
}

// GET /api/products                      -> todos os produtos em estoque
// GET /api/products?category=camisetas   -> só os dessa categoria
app.MapGet("/api/products", async (string? category, AppDbContext db) =>
{
    var query = db.Products.Where(p => p.Stock > 0);          // só o que tem estoque
    if (!string.IsNullOrWhiteSpace(category))
        query = query.Where(p => p.Category == category);     // filtra pela categoria
    return await query.ToListAsync();
});

// GET /api/products/1 -> um produto pelo Id
app.MapGet("/api/products/{id:int}", async (int id, AppDbContext db) =>
    await db.Products.FindAsync(id) is Product p
        ? Results.Ok(p)
        : Results.NotFound());

app.Run();