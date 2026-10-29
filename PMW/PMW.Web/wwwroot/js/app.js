// ---------- carrinho (salvo no navegador, não some ao recarregar) ----------
const CART_KEY = "pmw-cart";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function updateCount() {
  document.querySelectorAll(".cart-count").forEach(el => el.textContent = getCart().length);
}

function addToCart(id) {
  const cart = getCart();
  cart.push(id);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCount();
}

const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- página de categoria ----------
const NOMES = { camisetas: "camisetas", moletons: "moletons", calcas: "calças", acessorios: "acessórios" };

async function loadCategory() {
  const grid = document.getElementById("produtos");
  if (!grid) return;   // não estamos na página de categoria

  const slug = new URLSearchParams(location.search).get("c") || "camisetas";
  const nome = NOMES[slug] || slug;
  document.getElementById("titulo").textContent = nome;
  document.title = `PMW | ${nome}`;
  document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("on", a.dataset.c === slug));

  try {
    const res = await fetch(`/api/products?category=${encodeURIComponent(slug)}`);
    const lista = await res.json();

    document.getElementById("qtd").textContent =
      lista.length === 1 ? "1 peça em estoque" : `${lista.length} peças em estoque`;

    grid.innerHTML = lista.length
      ? lista.map(p => `
        <article class="card">
          <div class="thumb" style="--img:url('${p.imageUrl}')"></div>
          <h3>${p.name}</h3>
          <p class="preco">${brl(p.price)}</p>
          <div class="tam">${p.sizes.split(",").map(t => `<span>${t}</span>`).join("")}</div>
          <p class="estoque">${p.stock <= 3 ? "últimas unidades" : p.stock + " em estoque"}</p>
          <button onclick="addToCart(${p.id})">adicionar ao carrinho</button>
        </article>`).join("")
      : `<p class="vazio">nada em estoque nesta categoria por enquanto. veja as outras acima.</p>`;
  } catch {
    grid.innerHTML = `<p class="vazio">não foi possível carregar os produtos. confira se o servidor está rodando.</p>`;
  }
}

updateCount();
loadCategory();