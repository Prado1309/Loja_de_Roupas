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


// ---------- checkout ----------
async function loadCheckout() {
  const form = document.getElementById("form-pedido");
  if (!form) return;

  const cart = getCart();
  if (!cart.length) { location.href = "/carrinho.html"; return; }

  // agrupa unidades iguais em linhas { productId, size, quantity }
  const grupos = {};
  cart.forEach(i => {
    const k = `${i.id}|${i.size}`;
    grupos[k] = grupos[k] || { productId: i.id, size: i.size, quantity: 0 };
    grupos[k].quantity++;
  });
  const itens = Object.values(grupos);

  // resumo na lateral (o servidor recalcula o total de verdade ao criar o pedido)
  const ids = [...new Set(itens.map(i => i.productId))];
  const prods = await Promise.all(ids.map(id => fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null)));
  const porId = {};
  prods.filter(Boolean).forEach(p => porId[p.id] = p);
  let total = 0;
  document.getElementById("resumo-itens").innerHTML = itens.filter(i => porId[i.productId]).map(i => {
    const p = porId[i.productId];
    total += p.price * i.quantity;
    return `<li><span>${i.quantity}× ${p.name} (${i.size})</span><span>${brl(p.price * i.quantity)}</span></li>`;
  }).join("");
  document.getElementById("resumo-total").textContent = brl(total);

  const erroBox = document.getElementById("erro-pedido");
  const btn = form.querySelector("button[type=submit]");

  form.onsubmit = async e => {
    e.preventDefault();
    erroBox.textContent = "";
    btn.disabled = true;
    btn.textContent = "enviando...";
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), items: itens })
      });
      const out = await res.json();
      if (!res.ok) {
        erroBox.innerHTML = (out.errors || ["Não foi possível criar o pedido."]).map(m => `<p>${m}</p>`).join("");
        btn.disabled = false;
        btn.textContent = "confirmar pedido";
        return;
      }
      saveCart([]);
      document.getElementById("checkout").innerHTML = `
        <section class="confirmado">
          <h3>pedido recebido!</h3>
          <p class="codigo">${out.code}</p>
          <p>total: <strong>${brl(out.total)}</strong></p>
          <p class="status">${out.status}</p>
          <p>guarde o código do pedido. o pagamento entra na próxima etapa da loja.</p>
          <p><a class="btn" href="/">voltar para a loja</a></p>
        </section>`;
    } catch {
      erroBox.textContent = "Erro de conexão. Confira se o servidor está rodando.";
      btn.disabled = false;
      btn.textContent = "confirmar pedido";
    }
  };
}

updateCount();
loadCategory();
loadProduct();
loadCart();
loadCheckout();