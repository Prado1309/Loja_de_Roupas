// ---------- carrinho (salvo no navegador) ----------
// v2: cada unidade no carrinho guarda { id, size } (produto + tamanho)
const CART_KEY = "pmw-cart-v2";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
  updateCount();
}
function updateCount() {
  document.querySelectorAll(".cart-count").forEach(el => el.textContent = getCart().length);
}
function addToCart(id, size) {
  const c = getCart();
  c.push({ id, size });
  saveCart(c);
}

const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NOMES = { camisetas: "camisetas", moletons: "moletons", calcas: "calças", acessorios: "acessórios" };

// ---------- página de categoria ----------
async function loadCategory() {
  const grid = document.getElementById("produtos");
  if (!grid) return;

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
          <a href="/produto.html?id=${p.id}"><div class="thumb" style="--img:url('${p.imageUrl}')"></div></a>
          <h3><a href="/produto.html?id=${p.id}">${p.name}</a></h3>
          <p class="preco">${brl(p.price)}</p>
          <div class="tam">${p.sizes.split(",").map(t => `<span>${t}</span>`).join("")}</div>
          <p class="estoque">${p.stock <= 3 ? "últimas unidades" : p.stock + " em estoque"}</p>
          <a class="ver" href="/produto.html?id=${p.id}">escolher tamanho</a>
        </article>`).join("")
      : `<p class="vazio">nada em estoque nesta categoria por enquanto. veja as outras acima.</p>`;
  } catch {
    grid.innerHTML = `<p class="vazio">não foi possível carregar os produtos. confira se o servidor está rodando.</p>`;
  }
}

// ---------- página de produto ----------
async function loadProduct() {
  const box = document.getElementById("produto");
  if (!box) return;

  const id = Number(new URLSearchParams(location.search).get("id"));
  try {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error("não encontrado");
    const p = await res.json();
    document.title = `PMW | ${p.name}`;

    const sizes = p.sizes.split(",");
    const esgotado = p.stock <= 0;
    let size = sizes.length === 1 ? sizes[0] : null;   // tamanho único já vem escolhido

    box.innerHTML = `
      <div class="foto thumb" style="--img:url('${p.imageUrl}')"></div>
      <div class="info">
        <p class="voltar"><a href="/categoria.html?c=${p.category}">← ${NOMES[p.category] || p.category}</a></p>
        <h2>${p.name}</h2>
        <p class="preco">${brl(p.price)}</p>
        <p class="desc">${p.description}</p>
        <p class="rotulo">tamanho</p>
        <div class="tamanhos">${sizes.map(t => `<button type="button" class="tm" data-t="${t}">${t}</button>`).join("")}</div>
        <p class="aviso" id="aviso"></p>
        <button class="comprar" id="comprar" ${esgotado ? "disabled" : ""}>${esgotado ? "esgotado" : "adicionar ao carrinho"}</button>
      </div>`;

    const aviso = document.getElementById("aviso");
    const botoes = document.querySelectorAll(".tm");
    botoes.forEach(b => {
      if (b.dataset.t === size) b.classList.add("on");
      b.onclick = () => {
        size = b.dataset.t;
        botoes.forEach(x => x.classList.toggle("on", x === b));
        aviso.textContent = "";
      };
    });

    document.getElementById("comprar").onclick = () => {
      if (!size) { aviso.textContent = "escolha um tamanho"; return; }
      const jaNoCarrinho = getCart().filter(i => i.id === p.id).length;
      if (jaNoCarrinho >= p.stock) { aviso.textContent = "você já tem todas as unidades em estoque no carrinho"; return; }
      addToCart(p.id, size);
      aviso.textContent = `adicionado: ${p.name} (${size})`;
    };
  } catch {
    box.innerHTML = `<p class="vazio">produto não encontrado. <a href="/">voltar para a home</a></p>`;
  }
}

// ---------- página do carrinho ----------
function addOne(id, size) { addToCart(id, size); loadCart(); }
function removeOne(id, size) {
  const c = getCart();
  const i = c.findIndex(x => x.id === id && x.size === size);
  if (i > -1) c.splice(i, 1);
  saveCart(c);
  loadCart();
}
function clearCart() { saveCart([]); loadCart(); }

async function loadCart() {
  const box = document.getElementById("itens");
  if (!box) return;
  const resumo = document.getElementById("resumo");
  const cart = getCart();

  const vazio = () => {
    box.innerHTML = `<p class="vazio">seu carrinho está vazio.</p>`;
    resumo.hidden = true;
  };
  if (!cart.length) return vazio();

  try {
    const ids = [...new Set(cart.map(i => i.id))];
    const prods = await Promise.all(ids.map(id => fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null)));
    const porId = {};
    prods.filter(Boolean).forEach(p => porId[p.id] = p);

    // agrupa unidades iguais (mesmo produto e mesmo tamanho)
    const grupos = {};
    cart.forEach(i => {
      if (!porId[i.id]) return;
      const k = `${i.id}|${i.size}`;
      grupos[k] = grupos[k] || { id: i.id, size: i.size, n: 0 };
      grupos[k].n++;
    });
    const lista = Object.values(grupos);
    if (!lista.length) return vazio();

    let total = 0;
    box.innerHTML = lista.map(g => {
      const p = porId[g.id];
      const noCarrinho = cart.filter(i => i.id === g.id).length;   // estoque é por produto
      total += p.price * g.n;
      return `
        <article class="item">
          <div class="thumb" style="--img:url('${p.imageUrl}')"></div>
          <div>
            <h3>${p.name}</h3>
            <p class="tam-item">tamanho ${g.size}</p>
            <p>${brl(p.price)}</p>
            <div class="qtd">
              <button onclick="removeOne(${p.id}, '${g.size}')" aria-label="tirar um">−</button>
              <span>${g.n}</span>
              <button onclick="addOne(${p.id}, '${g.size}')" aria-label="adicionar mais um" ${noCarrinho >= p.stock ? "disabled" : ""}>+</button>
            </div>
          </div>
          <p class="sub">${brl(p.price * g.n)}</p>
        </article>`;
    }).join("");
    document.getElementById("total").textContent = brl(total);
    resumo.hidden = false;
  } catch {
    box.innerHTML = `<p class="vazio">não foi possível carregar o carrinho. confira se o servidor está rodando.</p>`;
  }
}

updateCount();
loadCategory();
loadProduct();
loadCart();