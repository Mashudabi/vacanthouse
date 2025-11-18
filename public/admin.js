// Use Render backend API directly
const API = "https://vacant-houses-backend-1.onrender.com/api";

// --- ADMIN LOGIN ---
document.getElementById("adminLogin")?.addEventListener("click", async () => {
  const phone = document.getElementById("adminPhone").value;
  const pass = document.getElementById("adminPass").value;

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password: pass })
    });

    const data = await res.json();
    if (!data.success) return alert(data.message);

    localStorage.setItem("adminAuth", data.token);
    alert("✅ Admin Login Successful");
    location.href = "admin_dashboard.html";
  } catch (err) {
    console.error(err);
    alert("❌ Failed to connect to server");
  }
});

// --- ADD HOUSE ---
document.getElementById("houseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = new FormData();
  form.append("title", document.getElementById("title").value);
  form.append("location", document.getElementById("location").value);
  form.append("price", document.getElementById("price").value);
  form.append("description", document.getElementById("description").value);
  form.append("image", document.getElementById("image").files[0]);

  try {
    const res = await fetch(`${API}/houses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("adminAuth")}` },
      body: form
    });

    const data = await res.json();
    if (!data.success) return alert(data.message);

    alert("✅ House Added");
    location.href = "admin_dashboard.html";
  } catch (err) {
    console.error(err);
    alert("❌ Failed to add house");
  }
});

// --- LOGOUT ---
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("adminAuth");
  alert("Logged out");
  location.href = "admin.html";
});
