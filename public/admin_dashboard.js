// ==========================
// 🌐 CONFIG
// ==========================
const API = "http://localhost:5000/api"; // backend API
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dxc7la2j8/image/upload"; // Cloud name
const CLOUDINARY_UPLOAD_PRESET = "YuZRVuRnJbfeouz2TPU5lRCGiKE"; // Upload preset

// ==========================
// ✅ AUTH HELPERS
// ==========================
function getAdminToken() {
  return localStorage.getItem("adminAuth") || "";
}

if (!getAdminToken()) location.href = "admin.html";

function imageUrl(path) {
  if (!path) return "https://via.placeholder.com/110x75?text=No+Image";
  return path.startsWith("http") ? path : `http://localhost:5000${path}`;
}

// ==========================
// 📤 CLOUDINARY IMAGE UPLOAD
// ==========================
async function uploadToCloudinary(file) {
  if (!file) return null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_URL, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  return data.secure_url; // Cloud URL of the uploaded image
}

// ==========================
// 🏠 HOUSES
// ==========================
async function loadHouses() {
  const token = getAdminToken();
  const res = await fetch(`${API}/houses`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const div = document.getElementById("houseList");

  if (!data.length) {
    div.innerHTML = "No houses added yet.";
    return;
  }

  div.innerHTML = data.map(h => `
    <div class="list-item">
      <div class="flex">
        <img src="${imageUrl(h.image)}" class="house-thumb">
        <div>
          <b>${h.title}</b><br>${h.location} — KES ${Number(h.price).toLocaleString()}
        </div>
      </div>
      <button onclick="openEditModal(${h.id})" class="btn-small blue">Edit</button>
      <button onclick="deleteHouse(${h.id})" class="btn-small danger">Delete</button>
    </div>
  `).join("");
}

async function deleteHouse(id) {
  if (!confirm("Delete house permanently?")) return;

  const token = getAdminToken();
  const res = await fetch(`${API}/houses/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();
  if (!data.success) {
    alert(data.message || "Delete failed");
    return;
  }

  alert("✅ House deleted");
  loadHouses();
}

// ==========================
// ➕ ADD HOUSE
// ==========================
document.getElementById("addHouseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = getAdminToken();
  const title = document.getElementById("title").value;
  const location = document.getElementById("location").value;
  const price = document.getElementById("price").value;
  const description = document.getElementById("description").value;
  const imageFile = document.getElementById("image").files[0];

  try {
    const cloudUrl = await uploadToCloudinary(imageFile);

    const res = await fetch(`${API}/houses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        location,
        price,
        description,
        image: cloudUrl
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Failed to add house");

    alert("✅ House added successfully!");
    document.getElementById("addHouseForm").reset();
    loadHouses();
  } catch (err) {
    console.error(err);
    alert("❌ Error adding house: " + err.message);
  }
});

// ==========================
// ✏️ EDIT HOUSE
// ==========================
let currentEditId = null;

async function openEditModal(id) {
  currentEditId = id;
  const token = getAdminToken();

  try {
    const res = await fetch(`${API}/houses/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const h = await res.json();

    document.getElementById("editTitle").value = h.title || "";
    document.getElementById("editLocation").value = h.location || "";
    document.getElementById("editPrice").value = h.price || "";
    document.getElementById("editDesc").value = h.description || "";
    document.getElementById("editModal").classList.add("active");
  } catch (err) {
    alert("❌ Failed to load house for editing: " + err.message);
  }
}

document.getElementById("cancelEditBtn").onclick = () => {
  document.getElementById("editModal").classList.remove("active");
};

document.getElementById("saveEditBtn").onclick = async () => {
  if (!currentEditId) return alert("No house selected");

  const token = getAdminToken();
  const title = document.getElementById("editTitle").value;
  const location = document.getElementById("editLocation").value;
  const price = document.getElementById("editPrice").value;
  const description = document.getElementById("editDesc").value;
  const imageFile = document.getElementById("editImage").files[0];

  try {
    const cloudUrl = imageFile ? await uploadToCloudinary(imageFile) : null;

    const res = await fetch(`${API}/houses/${currentEditId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        location,
        price,
        description,
        image: cloudUrl // If null, backend keeps old image
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Update failed");

    alert("✅ House updated successfully!");
    document.getElementById("editModal").classList.remove("active");
    loadHouses();
  } catch (err) {
    console.error(err);
    alert("❌ Failed to update house: " + err.message);
  }
};

// ==========================
// 👀 VIEWING REQUESTS
// ==========================
async function loadRequests() {
  const token = getAdminToken();
  const res = await fetch(`${API}/view-requests`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const div = document.getElementById("reqList");

  if (!data.length) {
    div.innerHTML = "No viewing requests.";
    return;
  }

  div.innerHTML = data.map(r => `
    <div class="list-item">
      <b>${r.name}</b> (${r.phone})<br>
      House: ${r.houseTitle}<br>Date: ${r.date}
    </div>
  `).join("");
}

// ==========================
// 💳 BOOKINGS
// ==========================
async function loadBookings() {
  const token = getAdminToken();
  const res = await fetch(`${API}/bookings`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const div = document.getElementById("booksList");

  if (!data.length) {
    div.innerHTML = "No bookings yet.";
    return;
  }

  div.innerHTML = data.map(b => `
    <div class="list-item">
      <b>${b.customerName}</b> (${b.customerPhone})<br>
      House: ${b.houseTitle}<br>
      Amount: KES ${b.amount}
    </div>
  `).join("");
}

// ==========================
// 🔄 INIT
// ==========================
loadHouses();
loadRequests();
loadBookings();
