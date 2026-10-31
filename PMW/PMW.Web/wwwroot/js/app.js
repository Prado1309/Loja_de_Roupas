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

// ---------- página do carrinho ----------
function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCount();
}
function mais(id) { addToCart(id); loadCart(); }
function menos(id) {
  const c = getCart();
  const i = c.indexOf(id);
  if (i > -1) c.splice(i, 1);
  saveCart(c);
  loadCart();
}
function clearCart() { saveCart([]); loadCart(); }

async function loadCart() {
  const box = document.getElementById("itens");
  if (!box) return;   // não estamos na página do carrinho
  const resumo = document.getElementById("resumo");

  const qtd = {};
  getCart().forEach(id => qtd[id] = (qtd[id] || 0) + 1);
  const ids = Object.keys(qtd).map(Number);

  if (!ids.length) {
    box.innerHTML = `<p class="vazio">seu carrinho está vazio.</p>`;
    resumo.hidden = true;
    return;
  }

  try {
    const prods = await Promise.all(ids.map(id => fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null)));
    let total = 0;
    box.innerHTML = prods.filter(Boolean).map(p => {
      const n = qtd[p.id];
      total += p.price * n;
      return `
        <article class="item">
          <div class="thumb" style="--img:url('${p.imageUrl}')"></div>
          <div>
            <h3>${p.name}</h3>
            <p>${brl(p.price)}</p>
            <div class="qtd">
              <button onclick="menos(${p.id})" aria-label="tirar um">−</button>
              <span>${n}</span>
              <button onclick="mais(${p.id})" aria-label="adicionar mais um" ${n >= p.stock ? "disabled" : ""}>+</button>
            </div>
          </div>
          <p class="sub">${brl(p.price * n)}</p>
        </article>`;
    }).join("");
    document.getElementById("total").textContent = brl(total);
    resumo.hidden = false;
  } catch {
    box.innerHTML = `<p class="vazio">não foi possível carregar o carrinho. confira se o servidor está rodando.</p>`;
  }
}
loadCart();