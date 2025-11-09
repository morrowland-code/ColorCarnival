// 🎨 Color Carnival — unified frontend controller
// Works with main.py backend for palettes, grid, and pressure

// ===================== CONFIG =====================
const API_BASE = ""; // same-origin for Flask

// =============== THEME HANDLER ===============
// Save the selected theme and apply it across pages
function applySavedTheme() {
  const saved = localStorage.getItem("cc_theme") || "strawberry";
  document.documentElement.setAttribute("data-theme", saved);
  const sel = document.getElementById("themeSelect");
  if (sel) sel.value = saved;
}

// When user changes dropdown, update theme live
function initThemeSelector() {
  const sel = document.getElementById("themeSelect");
  if (!sel) return;
  sel.addEventListener("change", () => {
    const val = sel.value || "strawberry";
    document.documentElement.setAttribute("data-theme", val);
    localStorage.setItem("cc_theme", val);
  });
}

// Apply theme immediately on page load
document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  initThemeSelector();
});

// ===================== ALERTS & CONFETTI =====================
let alertTimeout = null;

function showAlert(message, isSuccess = true) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.textContent = message;
  box.classList.remove("success", "error");
  box.classList.add(isSuccess ? "success" : "error");
  box.style.display = "block";
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => (box.style.display = "none"), 2500);
}

// ===================== FETCH WRAPPER =====================
async function fetchWithAuth(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  return res;
}

// ===================== PALETTE PAGE =====================
async function initPalettePage() {
  const paletteSelect = document.getElementById("paletteSelect");
  const paletteInput = document.getElementById("paletteNameInput");
  const createPaletteBtn = document.getElementById("createPaletteBtn");
  const deletePaletteBtn = document.getElementById("deletePaletteBtn");
  const savedColors = document.getElementById("savedColors");

  if (!paletteSelect) return; // only run on palette.html

  // 🎨 Load palettes
  async function loadPalettes(selectId = null) {
    try {
      const res = await fetchWithAuth("/api/palettes");
      const list = await res.json();
      paletteSelect.innerHTML = "";

      if (!Array.isArray(list) || !list.length) {
        const opt = document.createElement("option");
        opt.textContent = "— No palettes yet —";
        opt.value = "";
        paletteSelect.appendChild(opt);
        savedColors.innerHTML = "";
        return;
      }

      list.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        paletteSelect.appendChild(opt);
      });

      // Auto-select a palette if needed
      if (selectId) paletteSelect.value = selectId;
      else if (!paletteSelect.value) paletteSelect.value = list[list.length - 1].id;

      await loadPaletteColors();
    } catch (e) {
      showAlert("Error loading palettes", false);
    }
  }

  // 💾 Create or select palette
  createPaletteBtn?.addEventListener("click", async () => {
    const name = paletteInput.value.trim();
    if (!name) return showAlert("Enter a palette name 💕", false);

    try {
      const res = await fetchWithAuth("/api/palettes", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok && !data.id)
        return showAlert(data.error || "Error saving palette", false);

      showAlert("Palette saved! 🎉", true);
      paletteInput.value = "";
      await loadPalettes(data.id);
    } catch {
      showAlert("Network error 💔", false);
    }
  });

  // 🗑️ Delete palette
  deletePaletteBtn?.addEventListener("click", async () => {
    const id = parseInt(paletteSelect.value || "0");
    if (!id) return showAlert("No palette selected", false);
    if (!confirm("Delete this palette?")) return;
    const res = await fetchWithAuth(`/api/palettes/${id}`, { method: "DELETE" });
    if (!res.ok) return showAlert("Delete failed", false);
    showAlert("Palette deleted 🗑️", true);
    loadPalettes(false);
  });

  // 🎨 Load palette colors
  async function loadPaletteColors() {
    const id = parseInt(paletteSelect.value || "0");
    savedColors.innerHTML = "";
    if (!id) return;
    const res = await fetchWithAuth("/api/palettes");
    const list = await res.json();
    const pal = list.find((p) => p.id === id);
    if (!pal || !pal.colors) return;

    for (const c of pal.colors) {
      const div = document.createElement("div");
      div.className = "saved-color";
      div.innerHTML = `
        <div class="swatch" style="background:${c.hex};"></div>
        <p><b>${c.name}</b></p>
        <p>${c.hex}</p>
        <p>rgb(${c.rgb?.r || "?"}, ${c.rgb?.g || "?"}, ${c.rgb?.b || "?"})</p>
        <button>❌ Delete</button>
      `;
      div.querySelector("button").addEventListener("click", async () => {
        await fetchWithAuth(`/api/palettes/${id}/colors/${c.id}`, {
          method: "DELETE",
        });
        showAlert("Color deleted", true);
        loadPaletteColors();
      });
      savedColors.appendChild(div);
    }
  }

  paletteSelect.addEventListener("change", loadPaletteColors);

  // Initialize on load
  loadPalettes(false);
}

// ===================== GRID PAGE =====================
async function initGridPage() {
  const uploadInput = document.getElementById("gridImageUpload");
  const analyzeBtn = document.getElementById("analyzeGridBtn");
  const gridOutput = document.getElementById("gridOutput");

  if (!uploadInput) return; // only run on grid.html

  analyzeBtn?.addEventListener("click", async () => {
    const file = uploadInput.files[0];
    if (!file) return showAlert("Upload an image first 🖼️", false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      showAlert("Analyzing image... ⏳", true);
      const res = await fetchWithAuth("/api/grid/analyze", {
        method: "POST",
        body: JSON.stringify({ image: base64, grid_size: 40 }),
      });
      const data = await res.json();
      if (!res.ok) return showAlert("Analysis failed 💔", false);
      showAlert(`Analyzed ${data.count} squares 🎨`, true);

      gridOutput.innerHTML = "";
      for (const c of data.cells.slice(0, 300)) {
        const div = document.createElement("div");
        div.style.width = "10px";
        div.style.height = "10px";
        div.style.background = c.hex;
        div.style.display = "inline-block";
        gridOutput.appendChild(div);
      }
    };
    reader.readAsDataURL(file);
  });
}

// ===================== PRESSURE PAGE =====================
async function initPressurePage() {
  const computeBtn = document.getElementById("computePressure");
  const satDiff = document.getElementById("satDiff");
  const pressureVal = document.getElementById("pressureVal");
  const pressureBar = document.getElementById("pressureBarInner");

  if (!computeBtn) return;

  computeBtn.addEventListener("click", async () => {
    const targetHex = document.getElementById("targetHex").value;
    const actualHex = document.getElementById("actualHex").value;

    const hexToRgb = (h) => {
      const c = h.replace("#", "");
      return {
        r: parseInt(c.substr(0, 2), 16),
        g: parseInt(c.substr(2, 2), 16),
        b: parseInt(c.substr(4, 2), 16),
      };
    };

    const res = await fetchWithAuth("/api/pressure", {
      method: "POST",
      body: JSON.stringify({
        target: hexToRgb(targetHex),
        actual: hexToRgb(actualHex),
      }),
    });
    const data = await res.json();
    if (!res.ok) return showAlert("Error computing pressure 💔", false);
    satDiff.textContent = `${data.saturation_difference}%`;
    pressureVal.textContent = `${data.pressure_value}%`;
    pressureBar.style.width = `${data.pressure_value}%`;
    pressureBar.style.background =
      data.pressure_value > 70 ? "#ff4fa1" : "#89f8a5";
    showAlert("Pressure calculated ✅", true);
  });
}

// ===================== INIT PAGE ROUTING =====================
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path.includes("palette")) initPalettePage();
  else if (path.includes("grid")) initGridPage();
  else if (path.includes("pressure")) initPressurePage();
});
// 🧑‍🎨 Login/Register popup logic
const authModal = document.getElementById("authModal");
const loginButton = document.getElementById("loginStatusButton");
const authTitle = document.getElementById("authTitle");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const toggleAuthMode = document.getElementById("toggleAuthMode");

let authMode = "login"; // or "register"

// 💡 Open modal when button clicked
loginButton.addEventListener("click", () => {
  authModal.style.display = "flex";
  authMode = "login";
  updateAuthUI();
});

// 💡 Toggle between login/register
toggleAuthMode.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  updateAuthUI();
});

function updateAuthUI() {
  authTitle.textContent = authMode === "login" ? "Sign In" : "Create Account";
  authSubmit.textContent = authMode === "login" ? "Sign In" : "Register";
  toggleAuthMode.textContent =
    authMode === "login" ? "Need an account?" : "Already have one?";
}

// 💾 Submit login or register
authSubmit.addEventListener("click", async () => {
  const username = authUsername.value.trim();
  const password = authPassword.value.trim();
  if (!username || !password) return alert("Please fill in both fields!");

  const endpoint = authMode === "login" ? "/api/login" : "/api/register";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Something went wrong!");
      return;
    }

    if (authMode === "login") {
      localStorage.setItem("cc_username", username);
      loginButton.textContent = `Signed in as ${username}`;
      alert("Welcome back, " + username + "!");
    } else {
      alert("Account created! You can sign in now.");
      authMode = "login";
      updateAuthUI();
    }

    authModal.style.display = "none";
    authUsername.value = "";
    authPassword.value = "";
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// 💫 Close modal when clicking outside the box
authModal.addEventListener("click", (e) => {
  if (e.target === authModal) authModal.style.display = "none";
});
if (localStorage.getItem("cc_username")) {
  loginButton.textContent = `Signed in as ${localStorage.getItem("cc_username")}`;
}
// Existing code...

// === LOGOUT FUNCTIONALITY ===
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutButton");
  const loginStatusButton = document.getElementById("loginStatusButton");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Clear stored login info
      localStorage.removeItem("cc_user");
      localStorage.removeItem("cc_token");

      // Reset UI
      if (loginStatusButton) {
        loginStatusButton.textContent = "Not signed in";
      }

      alert("You’ve been logged out 🎈");
      window.location.reload();
    });
  }
});
// === GLOBAL LOGIN STATUS + LOGOUT HANDLER ===
document.addEventListener("DOMContentLoaded", () => {
  const loginStatusButton = document.getElementById("loginStatusButton");

  // Detect saved login (if using localStorage)
  const savedUser = localStorage.getItem("cc_user");

  if (loginStatusButton) {
    if (savedUser) {
      loginStatusButton.textContent = `Signed in as ${savedUser}`;
    } else {
      loginStatusButton.textContent = "Not signed in";
    }
  }

  // Handle logout click globally
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("cc_user");
      localStorage.removeItem("cc_token");
      if (loginStatusButton) loginStatusButton.textContent = "Not signed in";
      alert("You’ve been logged out 🎈");
      window.location.reload();
    });
  }
});