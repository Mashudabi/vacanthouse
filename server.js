// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json());

// ===== File Paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const dbPath = path.join(__dirname, "db.json");

// ===== Ensure db.json exists =====
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify({ users: [], houses: [], bookings: [], viewRequests: [], dashboardBackground: null, supportNumbers: { phone1: "", phone2: "" }, payments: [] }, null, 2)
  );
  console.log("🗃️ db.json created");
}

// ===== Admin Auto-Creation =====
const ensureAdminAccount = () => {
  const db = JSON.parse(fs.readFileSync(dbPath));
  const adminPhone = process.env.ADMIN_USER || "0724159345";
  const adminPass = process.env.ADMIN_PASS || "38935567";
  const existingAdmin = db.users.find(u => u.phone === adminPhone && u.isAdmin);

  if (!existingAdmin) {
    const newAdmin = {
      id: Date.now(),
      name: "System Admin",
      phone: adminPhone,
      pass: adminPass,
      isAdmin: true,
    };
    db.users.push(newAdmin);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log("✅ Default admin created:", adminPhone);
  }
};
ensureAdminAccount();

// ===== Cloudinary Config =====
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "vacant_houses",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const upload = multer({ storage });

// ===== Helpers =====
const readDB = () => JSON.parse(fs.readFileSync(dbPath));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ==========================
// ✅ USER SIGNUP
// ==========================
app.post("/api/signup", (req, res) => {
  const { name, phone, pass, isAdmin } = req.body;
  const db = readDB();

  if (!name || !phone || !pass) {
    return res.json({ success: false, message: "All fields are required" });
  }

  if (db.users.find(u => u.phone === phone)) {
    return res.json({ success: false, message: "Phone number already exists" });
  }

  const newUser = {
    id: Date.now(),
    name,
    phone,
    pass,
    isAdmin: !!isAdmin
  };
  db.users.push(newUser);
  writeDB(db);

  res.json({ success: true, message: "Account created successfully" });
});

// ==========================
// ✅ USER LOGIN
// ==========================
app.post("/api/login", (req, res) => {
  const { phone, pass } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.phone === phone && u.pass === pass);
  if (!user) return res.json({ success: false, message: "Invalid phone or password" });

  res.json({
    success: true,
    token: user.phone,
    user: { name: user.name, phone: user.phone, isAdmin: !!user.isAdmin }
  });
});

// ==========================
// ✅ ADMIN LOGIN
// ==========================
app.post("/api/admin/login", (req, res) => {
  const { phone, pass } = req.body;
  const db = readDB();
  const admin = db.users.find(u => u.phone === phone && u.pass === pass && u.isAdmin);
  if (!admin) return res.json({ success: false, message: "Not authorized" });

  res.json({
    success: true,
    token: admin.phone,
    user: { name: admin.name, phone: admin.phone, isAdmin: true }
  });
});

// ==========================
// 🏠 HOUSES ROUTES
// ==========================
app.get("/api/houses", (req, res) => {
  const db = readDB();
  res.json(db.houses || []);
});

app.get("/api/houses/:id", (req, res) => {
  const db = readDB();
  const house = db.houses.find(h => String(h.id) === req.params.id);
  if (!house) return res.status(404).json({ message: "House not found" });
  res.json(house);
});

app.post("/api/houses", upload.single("image"), (req, res) => {
  let { title, location, price, description, image } = req.body;
  const db = readDB();

  // Handle both file upload (multer) and Cloudinary URL (JSON)
  let imagePath = null;
  if (req.file) {
    // File uploaded via multer
    imagePath = req.file.path;
  } else if (image && typeof image === 'string' && image.startsWith('http')) {
    // Cloudinary URL sent in JSON body
    imagePath = image;
  } else if (image) {
    // Local path sent in JSON
    imagePath = image;
  }

  const newHouse = {
    id: Date.now(),
    title,
    location,
    price: Number(price) || 0,
    description,
    image: imagePath,
    isBooked: false
  };

  db.houses.push(newHouse);
  writeDB(db);
  res.json({ success: true, message: "House added successfully", house: newHouse });
});

app.put("/api/houses/:id", upload.single("image"), (req, res) => {
  const db = readDB();
  const idx = db.houses.findIndex(h => String(h.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "House not found" });

  const old = db.houses[idx];
  let { title, location, price, description, image } = req.body;

  // Handle image update: file upload, Cloudinary URL, or keep existing
  let imagePath = old.image;
  if (req.file) {
    // File uploaded via multer
    imagePath = req.file.path;
  } else if (image && typeof image === 'string' && image.startsWith('http')) {
    // Cloudinary URL sent in JSON body
    imagePath = image;
  } else if (image && image !== 'null' && image !== 'undefined') {
    // Local path or other image value sent in JSON
    imagePath = image;
  }

  db.houses[idx] = {
    ...old,
    title: title || old.title,
    location: location || old.location,
    price: price ? Number(price) : old.price,
    description: description || old.description,
    image: imagePath
  };

  writeDB(db);
  res.json({ success: true, message: "House updated successfully", house: db.houses[idx] });
});

app.delete("/api/houses/:id", (req, res) => {
  const db = readDB();
  const idx = db.houses.findIndex(h => String(h.id) === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "House not found" });

  db.houses.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, message: "House deleted successfully" });
});

// ==========================
// 👀 VIEWING REQUESTS
// ==========================
app.post("/api/view-requests", (req, res) => {
  const { name, phone, houseId, houseTitle, date } = req.body;
  const db = readDB();

  const request = {
    id: Date.now(),
    name,
    phone,
    houseId,
    houseTitle,
    date,
    status: "pending"
  };
  db.viewRequests.push(request);
  writeDB(db);
  res.json({ success: true, message: "Viewing request submitted", request });
});

app.get("/api/view-requests", (req, res) => {
  const db = readDB();
  res.json(db.viewRequests || []);
});

app.post("/api/view-requests/:id/approve", (req, res) => {
  const db = readDB();
  const reqItem = db.viewRequests.find(r => String(r.id) === req.params.id);
  if (!reqItem) return res.status(404).json({ message: "Request not found" });

  reqItem.status = "approved";
  writeDB(db);
  res.json({ success: true, message: "Request approved", request: reqItem });
});

// ==========================
// 💳 BOOKINGS
// ==========================
app.post("/api/book", (req, res) => {
  const { houseId, customerName, customerPhone, amount } = req.body;
  const db = readDB();

  const house = db.houses.find(h => String(h.id) === String(houseId));
  if (!house) return res.status(404).json({ success: false, message: "House not found" });
  
  // Check if house is unavailable
  if (house.status === "unavailable" || house.isBooked) {
    return res.json({ success: false, message: "House is no longer available" });
  }

  // Check if user already has a booking for this house
  const existingBooking = db.bookings.find(b => 
    String(b.houseId) === String(houseId) && 
    b.customerPhone === customerPhone &&
    (b.status === "pending" || b.status === "waiting" || b.status === "approved")
  );

  if (existingBooking) {
    return res.json({ success: false, message: "You already have a booking request for this house" });
  }

  const booking = {
    id: Date.now(),
    houseId: house.id,
    houseTitle: house.title,
    amount,
    customerName,
    customerPhone,
    status: "waiting", // Changed to "waiting" for admin approval
    createdAt: new Date().toISOString()
  };
  
  db.bookings.push(booking);
  writeDB(db);

  res.json({ success: true, message: "Booking request submitted. Waiting for admin approval.", booking });
});

app.get("/api/bookings", (req, res) => {
  const db = readDB();
  res.json(db.bookings || []);
});

app.post("/api/bookings/:id/approve", (req, res) => {
  const db = readDB();
  const booking = db.bookings.find(b => String(b.id) === req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  booking.status = "approved";
  
  // Mark house as booked (but not unavailable yet - that happens after payment)
  const house = db.houses.find(h => String(h.id) === String(booking.houseId));
  if (house) {
    house.isBooked = true;
    house.status = "booked";
  }
  
  writeDB(db);
  res.json({ success: true, message: "Booking approved", booking });
});

// ==========================
// 💳 M-PESA PAYMENT
// ==========================
app.post("/api/mpesa/pay", (req, res) => {
  try {
    const { bookingId, houseId, phoneNumber, amount, houseTitle } = req.body;
    const db = readDB();

    if (!bookingId || !phoneNumber || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const booking = db.bookings.find(b => String(b.id) === String(bookingId));
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "approved") {
      return res.status(400).json({ success: false, message: "Booking must be approved before payment" });
    }

    // Format phone number (ensure it starts with 254)
    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("254")) {
      formattedPhone = "254" + formattedPhone;
    }

    // M-Pesa Till Number
    const tillNumber = "4128782";
    const serviceFee = 234;
    const rentAmount = Number(amount) - serviceFee;

    // In a real implementation, you would call Safaricom Daraja API here
    // For now, we'll simulate the STK push and store payment details
    const paymentRecord = {
      id: Date.now(),
      bookingId: booking.id,
      houseId: houseId || booking.houseId,
      phoneNumber: formattedPhone,
      amount: Number(amount),
      rentAmount: rentAmount,
      serviceFee: serviceFee,
      tillNumber: tillNumber,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    // Store payment record (in real app, this would be in a payments table)
    if (!db.payments) db.payments = [];
    db.payments.push(paymentRecord);

    // Update booking with payment info
    booking.paymentPhone = formattedPhone;
    booking.paymentAmount = Number(amount);
    booking.paymentStatus = "completed";
    booking.paymentDate = new Date().toISOString();
    booking.status = "paid";

    // Mark house as unavailable after payment
    const house = db.houses.find(h => String(h.id) === String(houseId || booking.houseId));
    if (house) {
      house.isBooked = true;
      house.status = "unavailable";
    }

    writeDB(db);

    // In production, you would integrate with Safaricom Daraja API:
    // 1. Generate access token
    // 2. Initiate STK Push
    // 3. Handle callback to confirm payment
    
    // For now, return success (client will need to confirm payment manually or via webhook)
    res.json({
      success: true,
      message: "M-Pesa payment initiated. Please check your phone and enter your PIN.",
      payment: {
        tillNumber: tillNumber,
        amount: amount,
        phoneNumber: formattedPhone,
        houseTitle: houseTitle || booking.houseTitle
      }
    });
  } catch (error) {
    console.error("M-Pesa payment error:", error);
    res.status(500).json({ success: false, message: "Payment processing failed" });
  }
});

// ==========================
// 📞 SUPPORT PHONE NUMBERS
// ==========================
app.get("/api/support-numbers", (req, res) => {
  try {
    const db = readDB();
    const supportNumbers = db.supportNumbers || { phone1: "", phone2: "" };
    res.json(supportNumbers);
  } catch (error) {
    console.error("Error loading support numbers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/support-numbers", (req, res) => {
  try {
    const { phone1, phone2 } = req.body;
    const db = readDB();
    
    db.supportNumbers = {
      phone1: phone1 || "",
      phone2: phone2 || ""
    };
    
    writeDB(db);
    res.json({ success: true, message: "Support numbers updated", supportNumbers: db.supportNumbers });
  } catch (error) {
    console.error("Error saving support numbers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ==========================
// 🎨 DASHBOARD BACKGROUND SETTINGS
// ==========================
app.get("/api/dashboard-background", (req, res) => {
  try {
    const db = readDB();
    const settings = db.dashboardBackground || {
      type: "gradient",
      gradient: { color1: "#007bff", color2: "#00ff88" }, // Default blue-green gradient
      image: null
    };
    res.json(settings);
  } catch (error) {
    console.error("Error loading dashboard background:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/dashboard-background", (req, res) => {
  const { type, gradient, image } = req.body;
  const db = readDB();
  
  if (!db.dashboardBackground) {
    db.dashboardBackground = {};
  }
  
  db.dashboardBackground = {
    type: type || "gradient",
    gradient: gradient || { color1: "#f5f6fa", color2: "#ffffff" },
    image: image || null
  };
  
  writeDB(db);
  res.json({ success: true, message: "Background settings updated", settings: db.dashboardBackground });
});

// ==========================
// ✅ STATIC FILES (must be after API routes)
// ==========================
// Only serve static files for non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(); // Skip static files for API routes
  }
  express.static(publicDir)(req, res, next);
});

// Catch-all route for SPA (must be last) - only for non-API GET requests
app.get("*", (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API endpoint not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

// ==========================
// ✅ START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
const backendURL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
app.listen(PORT, () => {
  console.log(`✅ Server running at: ${backendURL}`);
  console.log("📂 Serving static files from:", publicDir);
});
