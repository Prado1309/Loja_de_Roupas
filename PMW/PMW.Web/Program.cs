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

// POST /api/orders -> cria um pedido
// O servidor NUNCA confia nos preços do navegador: recalcula tudo a partir do banco.
app.MapPost("/api/orders", async (CreateOrderRequest req, AppDbContext db) =>
{
    var erros = new List<string>();
    string Txt(string? s) => (s ?? "").Trim();
    string Num(string? s) => new string((s ?? "").Where(char.IsDigit).ToArray());

    var nome = Txt(req.Name); var email = Txt(req.Email);
    var fone = Num(req.Phone); var cep = Num(req.Zip);
    var rua = Txt(req.Street); var numero = Txt(req.Number); var compl = Txt(req.Complement);
    var bairro = Txt(req.District); var cidade = Txt(req.City); var uf = Txt(req.State).ToUpper();

    if (nome.Length < 3) erros.Add("Informe seu nome completo.");
    if (!email.Contains('@') || !email.Contains('.')) erros.Add("Informe um e-mail válido.");
    if (fone.Length < 10 || fone.Length > 11) erros.Add("Informe um telefone com DDD.");
    if (cep.Length != 8) erros.Add("Informe um CEP com 8 números.");
    if (rua.Length < 3) erros.Add("Informe a rua.");
    if (numero.Length == 0) erros.Add("Informe o número.");
    if (bairro.Length < 2) erros.Add("Informe o bairro.");
    if (cidade.Length < 2) erros.Add("Informe a cidade.");
    if (uf.Length != 2) erros.Add("Informe o estado com 2 letras (ex.: DF).");
    if (req.Items is null || req.Items.Count == 0) erros.Add("O carrinho está vazio.");
    if (erros.Count > 0) return Results.BadRequest(new { errors = erros });

    var ids = req.Items!.Select(i => i.ProductId).Distinct().ToList();
    var produtos = await db.Products.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);

    var pedido = new Order
    {
        Code = Guid.NewGuid().ToString("N")[..12].ToUpper(),
        CreatedAt = DateTime.UtcNow,
        Name = nome, Email = email, Phone = fone, Zip = cep, Street = rua, Number = numero,
        Complement = compl, District = bairro, City = cidade, State = uf
    };

    foreach (var i in req.Items!)
    {
        if (i.Quantity < 1 || i.Quantity > 20) { erros.Add("Quantidade inválida."); continue; }
        if (!produtos.TryGetValue(i.ProductId, out var p)) { erros.Add("Um dos produtos não existe mais."); continue; }
        if (!p.Sizes.Split(',').Contains(i.Size ?? "")) { erros.Add($"Tamanho inválido para {p.Name}."); continue; }
        pedido.Items.Add(new OrderItem { ProductId = p.Id, ProductName = p.Name, Size = i.Size!, UnitPrice = p.Price, Quantity = i.Quantity });
    }

    // estoque é por produto: soma todas as linhas do mesmo produto
    foreach (var g in pedido.Items.GroupBy(x => x.ProductId))
    {
        var p = produtos[g.Key];
        if (g.Sum(x => x.Quantity) > p.Stock) erros.Add($"Estoque insuficiente de {p.Name}: restam {p.Stock}.");
    }
    if (erros.Count > 0) return Results.BadRequest(new { errors = erros });

    foreach (var g in pedido.Items.GroupBy(x => x.ProductId))
        produtos[g.Key].Stock -= g.Sum(x => x.Quantity);   // reserva o estoque

    pedido.Total = pedido.Items.Sum(x => x.UnitPrice * x.Quantity);
    db.Orders.Add(pedido);
    await db.SaveChangesAsync();

    return Results.Ok(new { code = pedido.Code, total = pedido.Total, status = pedido.Status });
});

app.Run();