using Microsoft.EntityFrameworkCore;
using PMW.Web.Models;

namespace PMW.Web.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Product> Products => Set<Product>();
}