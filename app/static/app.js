const API_BASE = "";
let accessToken = localStorage.getItem("access_token") || null;
let currentUserId = null;

// Staged (not-yet-saved) image changes per coin, keyed by coin id (as string).
// { removals: Set<number> (image ids to delete on save),
//   newFiles: [{ id, file, url }] (files to upload on save) }
const pendingImageState = new Map();

function getPendingState(coinId) {
    const key = String(coinId);
    if (!pendingImageState.has(key)) {
        pendingImageState.set(key, { removals: new Set(), newFiles: [] });
    }
    return pendingImageState.get(key);
}

function clearPendingState(coinId) {
    const key = String(coinId);
    const state = pendingImageState.get(key);
    if (state) {
        state.newFiles.forEach((f) => URL.revokeObjectURL(f.url));
    }
    pendingImageState.delete(key);
}

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

async function uploadImage(coinId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const headers = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const res = await fetch(`/coins/${coinId}/images`, {
        method: "POST",
        headers,
        body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { data };
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

function groupCountriesForSelect(countries) {
    const current = countries.filter((c) => !c.is_historical);
    const historical = countries.filter((c) => c.is_historical);

    const byRegion = (list) => {
        const groups = {};
        list.forEach((c) => {
            const region = c.region || "Other";
            if (!groups[region]) groups[region] = [];
            groups[region].push(c);
        });
        return groups;
    };

    const renderOptgroups = (groups) =>
        Object.keys(groups)
            .sort()
            .map((region) => {
                const options = groups[region]
                    .map((c) => `<option value="${c.id}">${c.name}</option>`)
                    .join("");
                return `<optgroup label="${region}">${options}</optgroup>`;
            })
            .join("");

    let html = renderOptgroups(byRegion(current));
    if (historical.length > 0) {
        html += `<optgroup label="Historical / defunct">${historical
            .map((c) => `<option value="${c.id}">${c.name}</option>`)
            .join("")}</optgroup>`;
    }
    return html;
}

async function loadCountries() {
    const countries = await api("/countries");
    const list = document.getElementById("countries-list");
    list.innerHTML = countries
        .map(
            (c) =>
                `<li>${c.name} (${c.code || "-"}) — ${c.region || "Unknown"}${c.is_historical ? " · historical" : ""}</li>`
        )
        .join("");

    const selects = [
        document.querySelector('select[name="country_id"]'),
        document.getElementById("filter-country"),
    ];
    selects.forEach((select) => {
        const keepFirst = select.options[0].outerHTML;
        select.innerHTML = keepFirst + groupCountriesForSelect(countries);
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

// ---- Coins: read-only gallery (shown always) ----

function coinGalleryHtml(c) {
    const images = c.images || [];
    if (images.length === 0) return "";
    const tags = images.map((img) => `<img src="${img.url}" alt="${c.name}">`).join("");
    return `<div class="coin-images">${tags}</div>`;
}

// ---- Coins: staged photo editor (inside the Edit form) ----

function renderPhotosSectionHtml(coinId, images) {
    const state = getPendingState(coinId);

    const existingHtml = images
        .map((img) => {
            const isRemoved = state.removals.has(img.id);
            const btn = isRemoved
                ? `<button type="button" class="coin-image-restore" data-restore-image="${coinId}:${img.id}" title="Undo remove">&#8635;</button>`
                : `<button type="button" class="coin-image-remove" data-mark-remove="${coinId}:${img.id}" title="Remove">x</button>`;
            const wrapClass = isRemoved ? "coin-image-wrap removed" : "coin-image-wrap";
            return `<div class="${wrapClass}"><img src="${img.url}" alt="">${btn}</div>`;
        })
        .join("");

    const pendingHtml = state.newFiles
        .map(
            (f) => `
            <div class="coin-image-wrap pending">
                <img src="${f.url}" alt="">
                <button type="button" class="coin-image-remove" data-cancel-pending="${coinId}:${f.id}" title="Cancel">x</button>
            </div>`
        )
        .join("");

    return `
        <div class="coin-images">${existingHtml}${pendingHtml}</div>
        <div class="upload-row">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-pending-input="${coinId}">
        </div>
    `;
}

function bindPhotosSectionHandlers(container, coinId, images) {
    const section = container.querySelector(`[data-photos-section="${coinId}"]`);
    if (!section) return;

    const refresh = () => {
        section.innerHTML = renderPhotosSectionHtml(coinId, images);
        bindPhotosSectionHandlers(container, coinId, images);
    };

    section.querySelectorAll("[data-mark-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const [, imgId] = btn.dataset.markRemove.split(":");
            getPendingState(coinId).removals.add(parseInt(imgId, 10));
            refresh();
        });
    });

    section.querySelectorAll("[data-restore-image]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const [, imgId] = btn.dataset.restoreImage.split(":");
            getPendingState(coinId).removals.delete(parseInt(imgId, 10));
            refresh();
        });
    });

    section.querySelectorAll("[data-cancel-pending]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const [, fileId] = btn.dataset.cancelPending.split(":");
            const state = getPendingState(coinId);
            const idx = state.newFiles.findIndex((f) => f.id === fileId);
            if (idx !== -1) {
                URL.revokeObjectURL(state.newFiles[idx].url);
                state.newFiles.splice(idx, 1);
            }
            refresh();
        });
    });

    section.querySelectorAll("[data-pending-input]").forEach((input) => {
        input.addEventListener("change", () => {
            const state = getPendingState(coinId);
            Array.from(input.files).forEach((file) => {
                const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                state.newFiles.push({ id, file, url: URL.createObjectURL(file) });
            });
            input.value = "";
            refresh();
        });
    });
}

// ---- Coins: edit form (fields + staged photo editor) ----

function coinEditFormHtml(c) {
    return `
        <form class="coin-edit-form" data-edit-form="${c.id}" style="display:none">
            <h4>Photos</h4>
            <div data-photos-section="${c.id}">${renderPhotosSectionHtml(c.id, c.images || [])}</div>
            <h4>Details</h4>
            <input type="text" name="denomination" placeholder="Denomination" value="${c.denomination || ""}">
            <input type="number" name="year" placeholder="Year" value="${c.year}" required>
            <div class="weight-row">
                <input type="number" step="0.01" name="weight" placeholder="Weight" value="${c.weight}" required>
                <select name="weight_unit">
                    <option value="oz" ${c.weight_unit === "oz" ? "selected" : ""}>oz</option>
                    <option value="g" ${c.weight_unit === "g" ? "selected" : ""}>g</option>
                    <option value="kg" ${c.weight_unit === "kg" ? "selected" : ""}>kg</option>
                </select>
            </div>
            <input type="text" name="composition" placeholder="Composition" value="${c.composition || ""}">
            <input type="text" name="extra_info" placeholder="Extra info" value="${c.extra_info || ""}">
            <input type="number" step="0.01" name="price" placeholder="Price" value="${c.price ?? ""}">
            <div class="coin-edit-actions">
                <button type="submit" class="btn-edit">Save</button>
                <button type="button" class="btn-cancel" data-cancel-edit="${c.id}">Cancel</button>
            </div>
        </form>
    `;
}

// ---- Coins: card ----

function coinCardHtml(c) {
    const isOwner = currentUserId !== null && c.owner.id === currentUserId;
    const canBuy = accessToken && !isOwner && c.is_for_sale;
    const canEdit = isOwner && c.is_for_sale;

    let actionHtml = "";
    if (!c.is_for_sale) {
        actionHtml = `<p class="sold-tag">Sold</p>`;
    } else if (canBuy) {
        actionHtml = `
            <div class="coin-actions">
                <button class="btn-buy" data-add-to-cart="${c.id}">Add to cart</button>
            </div>`;
    }

    const editButtonHtml = canEdit
        ? `<div class="coin-actions"><button class="btn-edit" data-toggle-edit="${c.id}">Edit</button></div>`
        : "";

    return `
        <div class="coin-card" data-coin-card="${c.id}">
            <h3>${c.name}</h3>
            <p>Year: ${c.year}</p>
            <p>Country: ${c.country?.name || "-"}</p>
            <p>Metal: ${c.metal?.name || "-"}</p>
            <p>Weight: ${c.weight} ${c.weight_unit}</p>
            ${c.composition ? `<p>Composition: ${c.composition}</p>` : ""}
            ${c.price !== null ? `<p class="price-tag">$${c.price.toFixed(2)}</p>` : ""}
            ${coinGalleryHtml(c)}
            ${actionHtml}
            ${editButtonHtml}
            ${canEdit ? coinEditFormHtml(c) : ""}
        </div>
    `;
}

// ---- Bind edit-related handlers for a rendered container ----

function bindEditHandlers(container, coins, onDone) {
    const findCoin = (id) => coins.find((c) => String(c.id) === String(id));

    container.querySelectorAll("[data-toggle-edit]").forEach((btn) => {
        const coinId = btn.dataset.toggleEdit;
        btn.addEventListener("click", () => {
            const form = container.querySelector(`[data-edit-form="${coinId}"]`);
            const opening = form.style.display === "none";
            form.style.display = opening ? "flex" : "none";
            if (opening) {
                const coin = findCoin(coinId);
                if (coin) bindPhotosSectionHandlers(container, coinId, coin.images || []);
            }
        });
    });

    container.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
        const coinId = btn.dataset.cancelEdit;
        btn.addEventListener("click", () => {
            clearPendingState(coinId);
            const coin = findCoin(coinId);
            const section = container.querySelector(`[data-photos-section="${coinId}"]`);
            if (coin && section) {
                section.innerHTML = renderPhotosSectionHtml(coinId, coin.images || []);
            }
            const form = container.querySelector(`[data-edit-form="${coinId}"]`);
            form.style.display = "none";
        });
    });

    container.querySelectorAll("[data-edit-form]").forEach((form) => {
        const coinId = form.dataset.editForm;
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = new FormData(form);

            try {
                await api(`/coins/${coinId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        denomination: data.get("denomination") || null,
                        year: parseInt(data.get("year"), 10),
                        weight: parseFloat(data.get("weight")),
                        weight_unit: data.get("weight_unit"),
                        composition: data.get("composition") || null,
                        extra_info: data.get("extra_info") || null,
                        price: data.get("price") ? parseFloat(data.get("price")) : null,
                    }),
                });

                const state = getPendingState(coinId);

                for (const imageId of state.removals) {
                    await api(`/coins/${coinId}/images/${imageId}`, { method: "DELETE" });
                }
                for (const pending of state.newFiles) {
                    await uploadImage(coinId, pending.file);
                }

                clearPendingState(coinId);
                if (onDone) await onDone();
            } catch (err) {
                alert(`Error: ${err.data?.detail || JSON.stringify(err.data)}`);
            }
        });
    });
}

// ---- Browse ----

function renderCoins(page) {
    const container = document.getElementById("coins-list");
    if (page.items.length === 0) {
        container.innerHTML = "<p>No coins found</p>";
        return;
    }
    container.innerHTML = page.items.map((c) => coinCardHtml(c)).join("");

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

    bindEditHandlers(container, page.items, loadCoins);
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

document.getElementById("filter-apply").addEventListener("click", loadCoins);

// ---- Sell: create listing (with images attached at creation time) ----

document.getElementById("coin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const form = new FormData(e.target);
    const imageFiles = form.getAll("images").filter((f) => f instanceof File && f.size > 0);

    try {
        const coin = await api("/coins", {
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

        for (const file of imageFiles) {
            await uploadImage(coin.id, file);
        }

        e.target.reset();
        alert("Coin listed successfully.");
    } catch (err) {
        alert(`Error: ${err.data?.detail || JSON.stringify(err.data)}`);
    }
});

// ---- Cart ----

function cartRowHtml(item) {
    const c = item.coin;
    const priceLabel = c.price !== null ? `$${c.price.toFixed(2)}` : "Price not set";
    const thumb =
        c.images && c.images.length > 0
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
