const API_BASE = "";
let accessToken = localStorage.getItem("access_token") || null;

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

function updateAuthUI() {
    const status = document.getElementById("auth-status");
    const logoutBtn = document.getElementById("logout-btn");
    if (accessToken) {
        status.textContent = "Logged in";
        logoutBtn.style.display = "inline-block";
    } else {
        status.textContent = "Not logged in";
        logoutBtn.style.display = "none";
    }
}

// ---- Tabs ----

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
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
        updateAuthUI();
        log("auth-log", { logged_in: true });
        e.target.reset();
    } catch (err) {
        log("auth-log", { error: err.data });
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    accessToken = null;
    localStorage.removeItem("access_token");
    updateAuthUI();
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
        select.innerHTML = keepFirst + countries.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    });
}

async function loadMetals() {
    const metals = await api("/metals");
    document.getElementById("metals-list").innerHTML =
        metals.map((m) => `<li>${m.name}</li>`).join("");

    const select = document.querySelector('select[name="metal_id"]');
    const keepFirst = select.options[0].outerHTML;
    select.innerHTML = keepFirst + metals.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
}

// ---- Coins ----

function renderCoins(page) {
    const container = document.getElementById("coins-list");
    if (page.items.length === 0) {
        container.innerHTML = "<p>No coins found</p>";
        return;
    }
    container.innerHTML = page.items
        .map(
            (c) => `
        <div class="coin-card">
            <h3>${c.name}</h3>
            <p>Year: ${c.year}</p>
            <p>Country: ${c.country?.name || "-"}</p>
            <p>Metal: ${c.metal?.name || "-"}</p>
            <p>Weight: ${c.weight} ${c.weight_unit}</p>
            ${c.composition ? `<p>Composition: ${c.composition}</p>` : ""}
            <p>Denomination: ${c.denomination || "-"}</p>
        </div>
    `
        )
        .join("");
}

async function loadCoins() {
    const countryId = document.getElementById("filter-country").value;
    const q = document.getElementById("filter-q").value;

    const params = new URLSearchParams();
    if (countryId) params.set("country_id", countryId);
    if (q) params.set("q", q);

    const page = await api(`/coins?${params.toString()}`);
    renderCoins(page);
}

document.getElementById("coin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
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
            }),
        });
        e.target.reset();
        await loadCoins();
    } catch (err) {
        alert(`Error: ${JSON.stringify(err.data)}`);
    }
});

document.getElementById("filter-apply").addEventListener("click", loadCoins);

// ---- Init ----

updateAuthUI();
loadCountries();
loadMetals();
loadCoins();
