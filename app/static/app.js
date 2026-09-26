const API_BASE = "";
let accessToken = localStorage.getItem("access_token") || null;
let currentUserId = null;

// ---- Helpers ----

function log(elId, msg) {
    const el = document.getElementById(elId);
    el.textContent += `${JSON.stringify(msg, null, 2)}\n`;
}

async function api(path, options = {}) {
    const headers = options.headers || {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, data };
    return data;
}

function requireAuth() {
    if (!accessToken) {
        alert("Please log in first.");
        return false;
    }
    return true;
}

async function updateAuthUI() {
    const status = document.getElementById("auth-status");
    const logoutBtn = document.getElementById("logout-btn");
    if (accessToken) {
        try {
            const me = await api("/users/me");
            currentUserId = me.id;
            status.textContent = `Logged in as ${me.email}`;
        } catch {
            accessToken = null;
            localStorage.removeItem("access_token");
            status.textContent = "Not logged in";
        }
        logoutBtn.style.display = "inline-block";
    } else {
        currentUserId = null;
        status.textContent = "Not logged in";
        logoutBtn.style.display = "none";
    }
    await refreshCartBadge();
}

async function refreshCartBadge() {
    const badge = document.getElementById("cart-badge");
    if (!accessToken) {
        badge.style.display = "none";
        return;
    }
    try {
        const cart = await api("/cart");
        badge.textContent = `Cart: ${cart.items.length}`;
        badge.style.display = "inline-block";
    } catch {
        badge.style.display = "none";
    }
}

// ---- Tabs ----

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");

        if (btn.dataset.tab === "sell") loadMyListings();
        if (btn.dataset.tab === "browse") loadCoins();
        if (btn.dataset.tab === "cart") loadCart();
        if (btn.dataset.tab === "purchases") loadPurchases();
    });
});

// ---- Auth ----

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
        const data = await api("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: form.get("email"),
                password: form.get("password"),
                full_name: form.get("full_name") || null,
            }),
        });
        log("auth-log", { registered: data });
        e.target.reset();
    } catch (err) {
        log("auth-log", { error: err.data });
    }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const body = new URLSearchParams();
    body.set("username", form.get("email"));
    body.set("password", form.get("password"));
    try {
        const data = await api("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        accessToken = data.access_token;
        localStorage.setItem("access_token", accessToken);
        await updateAuthUI();
        log("auth-log", { logged_in: true });
        e.target.reset();
    } catch (err) {
        log("auth-log", { error: err.data });
    }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
    accessToken = null;
    localStorage.removeItem("access_token");
    await updateAuthUI();
});

// ---- Reference data ----

async function loadCountries() {
    const countries = await api("/countries");
    const list = document.getElementById("countries-list");
    list.innerHTML = countries.map((c) => `<li>${c.name} (${c.code || "-"})</li>`).join("");

    const selects = [
        document.querySelector('select[name="country_id"]'),
        document.getElementById("filter-country"),
    ];
    selects.forEach((select) => {
        const keepFirst = select.options[0].outerHTML;
        select.innerHTML =
            keepFirst + countries.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    });
}

async function loadMetals() {
    const metals = await api("/metals");
    document.getElementById("metals-list").innerHTML =
        metals.map((m) => `<li>${m.name}</li>`).join("");

    const select = document.querySelector('select[name="metal_id"]');
    const keepFirst = select.options[0].outerHTML;
    select.innerHTML =
        keepFirst + metals.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
}

// ---- Coins ----

function coinImagesHtml(c, allowManage) {
    const images = c.images || [];
    const imageTags = images
        .map((img) => {
            const removeBtn = allowManage
                ? `<button class="coin-image-remove" data-remove-image="${c.id}:${img.id}" title="Remove">x</button>`
                : "";
            return `<div class="coin-image-wrap"><img src="${img.url}" alt="${c.name}">${removeBtn}</div>`;
        })
        .join("");

    const uploadHtml = allowManage
        ? `
        <div class="upload-row">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-upload-input="${c.id}">
            <button data-upload-btn="${c.id}">Upload</button>
        </div>`
        : "";

    if (!imageTags && !uploadHtml) return "";

    return `<div class="coin-images">${imageTags}</div>${uploadHtml}`;
}

function coinCardHtml(c, allowManage = false) {
    const isOwner = currentUserId !== null && c.owner.id === currentUserId;
    const canBuy = accessToken && !isOwner && c.is_for_sale;

    let actionHtml = "";
    if (!c.is_for_sale) {
        actionHtml = `<p class="sold-tag">Sold</p>`;
    } else if (isOwner) {
        actionHtml = `<p class="sold-tag">Your listing</p>`;
    } else if (canBuy) {
        actionHtml = `
            <div class="coin-actions">
                <button class="btn-buy" data-add-to-cart="${c.id}">Add to cart</button>
            </div>`;
    }

    return `
        <div class="coin-card">
            <h3>${c.name}</h3>
            <p>Year: ${c.year}</p>
            <p>Country: ${c.country?.name || "-"}</p>
            <p>Metal: ${c.metal?.name || "-"}</p>
            <p>Weight: ${c.weight} ${c.weight_unit}</p>
            ${c.composition ? `<p>Composition: ${c.composition}</p>` : ""}
            ${c.price !== null ? `<p class="price-tag">$${c.price.toFixed(2)}</p>` : ""}
            ${coinImagesHtml(c, allowManage)}
            ${actionHtml}
        </div>
    `;
}

async function uploadCoinImage(coinId, fileInput) {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please choose a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
        const headers = {};
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const res = await fetch(`/coins/${coinId}/images`, {
            method: "POST",
            headers,
            body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw { data };
        await loadMyListings();
    } catch (err) {
        alert(`Upload error: ${err.data?.detail || JSON.stringify(err.data)}`);
    }
}

async function deleteCoinImage(coinId, imageId) {
    try {
        await api(`/coins/${coinId}/images/${imageId}`, { method: "DELETE" });
        await loadMyListings();
    } catch (err) {
        alert(`Error: ${err.data?.detail || JSON.stringify(err.data)}`);
    }
}

function bindImageHandlers(container) {
    container.querySelectorAll("[data-upload-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const coinId = btn.dataset.uploadBtn;
            const input = container.querySelector(`[data-upload-input="${coinId}"]`);
            uploadCoinImage(coinId, input);
        });
    });

    container.querySelectorAll("[data-remove-image]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const [coinId, imageId] = btn.dataset.removeImage.split(":");
            deleteCoinImage(coinId, imageId);
        });
    });
}

function renderCoins(page) {
    const container = document.getElementById("coins-list");
    if (page.items.length === 0) {
        container.innerHTML = "<p>No coins found</p>";
        return;
    }
    container.innerHTML = page.items.map((c) => coinCardHtml(c, false)).join("");

    container.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!requireAuth()) return;
            try {
                await api("/cart/items", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ coin_id: parseInt(btn.dataset.addToCart, 10) }),
                });
                await refreshCartBadge();
                alert("Added to cart.");
            } catch (err) {
                alert(`Error: ${err.data?.detail || JSON.stringify(err.data)}`);
            }
        });
    });
}

async function loadCoins() {
    const countryId = document.getElementById("filter-country").value;
    const q = document.getElementById("filter-q").value;
    const forSaleOnly = document.getElementById("filter-for-sale").checked;

    const params = new URLSearchParams();
    if (countryId) params.set("country_id", countryId);
    if (q) params.set("q", q);
    if (forSaleOnly) params.set("for_sale_only", "true");

    const page = await api(`/coins?${params.toString()}`);
    renderCoins(page);
}

document.getElementById("coin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const form = new FormData(e.target);
    try {
        await api("/coins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                country_id: parseInt(form.get("country_id"), 10),
                denomination: form.get("denomination") || null,
                year: parseInt(form.get("year"), 10),
                metal_id: parseInt(form.get("metal_id"), 10),
                weight: parseFloat(form.get("weight")),
                weight_unit: form.get("weight_unit"),
                composition: form.get("composition") || null,
                extra_info: form.get("extra_info") || null,
                price: parseFloat(form.get("price")),
                is_for_sale: true,
            }),
        });
        e.target.reset();
        await loadMyListings();
    } catch (err) {
        alert(`Error: ${JSON.stringify(err.data)}`);
    }
});

document.getElementById("filter-apply").addEventListener("click", loadCoins);

async function loadMyListings() {
    const container = document.getElementById("my-listings-list");
    if (!accessToken || currentUserId === null) {
        container.innerHTML = "<p>Please log in to see your listings.</p>";
        return;
    }

    const page = await api(`/coins?owner_id=${currentUserId}&page_size=100`);
    if (page.items.length === 0) {
        container.innerHTML = "<p>You have not listed any coins yet.</p>";
        return;
    }
    container.innerHTML = page.items.map((c) => coinCardHtml(c, true)).join("");
    bindImageHandlers(container);
}

// ---- Cart ----

function cartRowHtml(item) {
    const c = item.coin;
    const priceLabel = c.price !== null ? `$${c.price.toFixed(2)}` : "Price not set";
    const thumb = c.images && c.images.length > 0
        ? `<img src="${c.images[0].url}" alt="${c.name}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;margin-right:10px;">`
        : "";
    return `
        <div class="cart-row">
            <div style="display:flex;align-items:center;">
                ${thumb}
                <div>
                    <strong>${c.name}</strong>
                    <div class="price-tag">${priceLabel}</div>
                </div>
            </div>
            <button class="btn-remove" data-remove-from-cart="${c.id}">Remove</button>
        </div>
    `;
}

async function loadCart() {
    if (!accessToken) {
        document.getElementById("cart-list").innerHTML = "<p>Please log in to view your cart.</p>";
        document.getElementById("checkout-card").style.display = "none";
        return;
    }

    const cart = await api("/cart");
    const list = document.getElementById("cart-list");
    const totalEl = document.getElementById("cart-total");
    const checkoutCard = document.getElementById("checkout-card");

    if (cart.items.length === 0) {
        list.innerHTML = "<p>Your cart is empty.</p>";
        totalEl.textContent = "";
        checkoutCard.style.display = "none";
        return;
    }

    list.innerHTML = cart.items.map(cartRowHtml).join("");
    totalEl.textContent = `Total: $${cart.total_price.toFixed(2)}`;
    checkoutCard.style.display = "block";

    list.querySelectorAll("[data-remove-from-cart]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await api(`/cart/items/${btn.dataset.removeFromCart}`, { method: "DELETE" });
            await refreshCartBadge();
            await loadCart();
        });
    });
}

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
        const order = await api("/orders/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shipping_address: form.get("shipping_address") }),
        });
        log("checkout-log", { order_placed: order });
        e.target.reset();
        await refreshCartBadge();
        await loadCart();
    } catch (err) {
        log("checkout-log", { error: err.data });
    }
});

// ---- Purchases ----

function purchaseCardHtml(order) {
    const itemsHtml = order.items
        .map(
            (item) => `
        <div class="purchase-item">
            ${item.coin_name_snapshot} — $${item.price_paid.toFixed(2)}
        </div>
    `
        )
        .join("");

    return `
        <div class="purchase-card">
            <h3>Order #${order.id}</h3>
            <div class="order-meta">
                ${new Date(order.created_at).toLocaleString()} · ${order.status} · Total: $${order.total_price.toFixed(2)}
            </div>
            <div class="order-meta">Shipping to: ${order.shipping_address}</div>
            ${itemsHtml}
        </div>
    `;
}

async function loadPurchases() {
    const container = document.getElementById("purchases-list");
    if (!accessToken) {
        container.innerHTML = "<p>Please log in to view your purchases.</p>";
        return;
    }

    const orders = await api("/orders/me");
    if (orders.length === 0) {
        container.innerHTML = "<p>No purchases yet.</p>";
        return;
    }

    container.innerHTML = orders.map(purchaseCardHtml).join("");
}

// ---- Init ----

(async () => {
    await updateAuthUI();
    await loadCountries();
    await loadMetals();
})();
