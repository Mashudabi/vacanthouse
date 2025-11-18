// ===============================
// Vacant Houses Portal - Frontend
// ===============================

const API_URL = "http://localhost:5000/api/houses";
const LOGIN_URL = "http://localhost:5000/api/login";

// Check stored user session
let USER = JSON.parse(localStorage.getItem("user")) || null;

// DOM references
const housesGrid = document.getElementById("housesGrid");
const mainPage = document.getElementById("mainPage");
const profilePage = document.getElementById("profilePage");
const profileBtn = document.getElementById("profileBtn");
const pfName = document.getElementById("pfName");
const pfPhone = document.getElementById("pfPhone");

/* =============================
   ✅ LOGIN FUNCTION
============================= */
async function loginUser(phone, pass) {
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pass }),
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Invalid login");
      return false;
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    USER = data.user;

    alert("✅ Login successful");
    window.location.href = "index.html";
  } catch (err) {
    alert("⚠️ Unable to reach server. Start backend first.");
  }
}

/* Called from login.html */
async function doLogin() {
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!phone || !password) {
    alert("Enter phone & password");
    return;
  }

  loginUser(phone, password);
}

/* =============================
   ✅ FETCH HOUSES
============================= */
async function fetchHouses() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    renderHouses(data);
  } catch (err) {
    housesGrid.innerHTML = "<p>⚠️ Failed to load houses</p>";
  }
}

/* =============================
   ✅ DISPLAY HOUSES
============================= */
function renderHouses(houses) {
  housesGrid.innerHTML = "";

  if (!houses.length) {
    housesGrid.innerHTML = "<p>No houses available yet.</p>";
    return;
  }

  houses.forEach(h => {
    const el = document.createElement("div");
    el.className = "amount-card";

    // Handle both Cloudinary URLs and local paths
    let imageUrl = h.image || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      // Local path - prepend base URL
      imageUrl = "http://localhost:5000" + imageUrl;
    }

    el.innerHTML = `
      ${imageUrl ? `<img src="${imageUrl}" style="width:100%; height:120px; border-radius:8px; object-fit:cover;" onerror="this.style.display='none'">` : '<div style="width:100%;height:120px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>'}
      <div style="margin-top:6px; font-weight:700;">KES ${Number(h.price).toLocaleString()}</div>
      <div class="tiny">${h.location}</div>
      <div class="tiny">${h.title}</div>

      <a href="house.html?id=${h.id}" class="btn" style="margin-top:6px;">View Details</a>
    `;

    housesGrid.appendChild(el);
  });
}

/* =============================
   ✅ PROFILE PAGE
============================= */
if (USER) {
  pfName.textContent = USER.name;
  pfPhone.textContent = USER.phone;
}

profileBtn.onclick = () => {
  if (!USER) return alert("Please login first.");
  mainPage.classList.add("hidden");
  profilePage.classList.remove("hidden");
};

function logout() {
  localStorage.removeItem("user");
  alert("Logged out");
  location.reload();
}

/* =============================
   ✅ INIT
============================= */
if (housesGrid) fetchHouses();
