// house.js
const API = "http://localhost:5000/api";
const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");

// current logged-in user (from localStorage)
const USER = JSON.parse(localStorage.getItem("user") || "null");

// elements
const content = document.getElementById("content");

async function load() {
  if (!houseId) {
    content.innerHTML = "<div>Missing house id</div>";
    return;
  }

  // fetch house
  const hRes = await fetch(`${API}/houses/${houseId}`);
  if (!hRes.ok) {
    content.innerHTML = "<div>House not found</div>";
    return;
  }
  const house = await hRes.json();

  // fetch bookings for this house
  const bRes = await fetch(`${API}/bookings`);
  const bookings = await bRes.json();

  // count how many bookings are for this house (pending or approved)
  const houseBookings = bookings.filter(b => String(b.houseId) === String(house.id));
  const totalInterested = houseBookings.length;

  // does current user already have a booking for this house?
  const myBooking = USER ? houseBookings.find(b => b.customerPhone === USER.phone) : null;

  // is house already taken by someone (approved) OR there exists any booking and it's not mine?
  const approvedBooking = houseBookings.find(b => b.status === "approved");
  const someoneElseHasBooked = approvedBooking && (!myBooking || myBooking.id !== approvedBooking.id);

  // If there are pending bookings by others, treat as "booked" for others (per your requirement)
  const pendingByOthers = houseBookings.some(b => b.status === "pending" && (!myBooking || b.customerPhone !== USER?.phone));

  const bookedForOthers = someoneElseHasBooked || pendingByOthers;

  // Handle both Cloudinary URLs and local paths
  let imageUrl = house.image || '';
  if (imageUrl && !imageUrl.startsWith('http')) {
    // Local path - prepend base URL
    imageUrl = API.replace('/api','') + imageUrl;
  }

  // render
  content.innerHTML = `
    ${imageUrl ? `<img src="${imageUrl}" class="house-img" onerror="this.style.display='none'">` : '<div style="width:100%;height:220px;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>'}
    <h2 style="margin:8px 0;">${house.title}</h2>
    <div class="muted">${house.location} • KES ${Number(house.price).toLocaleString()}</div>
    <p style="margin-top:10px">${house.description || ""}</p>

    <div style="margin-top:10px" class="muted">Interested: <strong id="interestedCount">${totalInterested}</strong></div>

    <hr />

    <div id="actionArea">
      <!-- action area injected below -->
    </div>
  `;

  const actionArea = document.getElementById("actionArea");

  // If user not logged in, prompt to log in
  if (!USER) {
    actionArea.innerHTML = `<div class="muted">Please <a href="login.html">log in</a> to express interest or pay.</div>`;
    return;
  }

  // Show client details form (prefilled)
  let formHtml = `
    <div style="margin-top:8px;">
      <label>Your name</label><br />
      <input id="clientName" value="${USER.name || ""}" style="width:100%; padding:8px; margin-top:6px;" />
    </div>
    <div style="margin-top:8px;">
      <label>Your phone</label><br />
      <input id="clientPhone" value="${USER.phone || ""}" style="width:100%; padding:8px; margin-top:6px;" />
    </div>
    <div style="margin-top:8px;">
      <label>Payment phone (where you will pay from)</label><br />
      <input id="payPhone" placeholder="e.g. 0712345678" style="width:100%; padding:8px; margin-top:6px;" />
    </div>
  `;

  // Determine buttons & state
  if (myBooking && myBooking.status === "approved") {
    // already paid by me
    actionArea.innerHTML = formHtml + `
      <div style="margin-top:10px;"><strong style="color:green">You have booked this house (Paid)</strong></div>
      <div style="margin-top:10px;">
        <a href="profile.html" class="btn">Go to Profile</a>
      </div>
    `;
    return;
  }

  if (myBooking && myBooking.status === "pending") {
    // I have an existing pending booking — allow me to proceed to pay
    actionArea.innerHTML = formHtml + `
      <div style="margin-top:12px;">
        <button id="proceedPay" class="btn">Proceed to Pay (You have ${totalInterested} people interested)</button>
      </div>
    `;
    document.getElementById("proceedPay").addEventListener("click", async () => {
      // update local values and go to payment
      const name = document.getElementById("clientName").value.trim();
      const phone = document.getElementById("clientPhone").value.trim();
      const payFrom = document.getElementById("payPhone").value.trim();
      if (!name || !phone || !payFrom) return alert("Fill all details");
      // Save locally (some servers expect these on payment page)
      window.location.href = `payment.html?house=${house.id}&booking=${myBooking.id}`;
    });
    return;
  }

  // If house is booked/pending by others, and I don't have booking: block
  if (bookedForOthers) {
    actionArea.innerHTML = formHtml + `
      <div style="margin-top:12px;"><strong style="color:darkorange">This house is currently booked/pending by another customer. You cannot pay now.</strong></div>
    `;
    return;
  }

  // else: no booking yet — show button to create booking (and pay)
  actionArea.innerHTML = formHtml + `
    <div style="margin-top:12px;">
      <button id="expressInterest" class="btn">Express interest & Proceed to Pay</button>
    </div>
  `;

  document.getElementById("expressInterest").addEventListener("click", async () => {
    const name = document.getElementById("clientName").value.trim();
    const phone = document.getElementById("clientPhone").value.trim();
    const payFrom = document.getElementById("payPhone").value.trim();
    if (!name || !phone || !payFrom) return alert("Fill all details");

    // 1) create booking (status pending)
    const bkRes = await fetch(`${API}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseId: house.id, name, phone, payFrom })
    });
    const bk = await bkRes.json();
    if (!bk.success) return alert(bk.message || "Could not create booking");

    // 2) Redirect to payment page
    window.location.href = `payment.html?house=${house.id}&booking=${bk.booking.id}`;
  });
}

load().catch(err => {
  console.error(err);
  content.innerHTML = "<div>Error loading page</div>";
});
