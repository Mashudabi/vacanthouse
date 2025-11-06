// server/server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== File Paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧩 Public folder (for frontend)
const publicDir = path.join(__dirname, "../public");

// 🗃️ Local JSON database
const dbPath = path.join(__dirname, "./db.json");

// 📂 Upload folder
const uploadDir = path.join(process.cwd(), "uploads");

// ===== Ensure folders exist =====
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      { users: [], houses: [], bookings: [], viewRequests: [], payments: [] },
      null,
      2
    )
  );
  console.log("🗃️ db.json created");
}

// ===== Multer Upload Config =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// ===== Helpers =====
const readDB = () => JSON.parse(fs.readFileSync(dbPath));
const writeDB = (data) =>
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ==========================
// ✅ USER SIGNUP
// ==========================
app.post("/api/signup", (req, res) => {
  const { name, phone, pass, isAdmin } = req.body;
  const db = readDB();

  if (!name || !phone || !pass) {
    return res.json({ success: false, message: "All fields are required" });
  }

  if (db.users.find((u) => u.phone === phone)) {
    return res.json({ success: false, message: "Phone number already exists" });
  }

  const newUser = {
    id: Date.now(),
    name,
    phone,
    pass,
    isAdmin: !!isAdmin,
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

  const user = db.users.find((u) => u.phone === phone && u.pass === pass);
  if (!user) {
    return res.json({ success: false, message: "Invalid phone or password" });
  }

  const token = user.phone;

  res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      name: user.name,
      phone: user.phone,
      isAdmin: !!user.isAdmin,
    },
  });
});

// ==========================
// ✅ ADMIN LOGIN
// ==========================
app.post("/api/admin/login", (req, res) => {
  const { phone, pass } = req.body;
  const db = readDB();

  const admin = db.users.find(
    (u) => u.phone === phone && u.pass === pass && u.isAdmin
  );

  if (!admin) {
    return res.json({ success: false, message: "Not authorized" });
  }

  res.json({
    success: true,
    token: admin.phone,
    user: {
      name: admin.name,
      phone: admin.phone,
      isAdmin: true,
    },
  });
});

// ==========================
// 🏠 HOUSES ROUTES
// ==========================
app.get("/api/houses", (req, res) => {
  const db = readDB();
  res.json(db.houses);
});

app.get("/api/houses/:id", (req, res) => {
  const db = readDB();
  const house = db.houses.find((h) => String(h.id) === req.params.id);
  if (!house) return res.status(404).json({ message: "House not found" });
  res.json(house);
});

app.post("/api/houses", upload.single("image"), (req, res) => {
  const { title, location, price, description } = req.body;
  const db = readDB();

  const newHouse = {
    id: Date.now(),
    title,
    location,
    price: Number(price) || 0,
    description,
    image: req.file ? "/uploads/" + req.file.filename : null,
    isBooked: false,
  };

  db.houses.push(newHouse);
  writeDB(db);

  res.json({ success: true, message: "House added successfully", house: newHouse });
});

app.put("/api/houses/:id", upload.single("image"), (req, res) => {
  const db = readDB();
  const houseIndex = db.houses.findIndex((h) => String(h.id) === req.params.id);

  if (houseIndex === -1) return res.status(404).json({ message: "House not found" });

  const oldHouse = db.houses[houseIndex];

  if (req.file && oldHouse.image) {
    const oldImgPath = path.join(uploadDir, path.basename(oldHouse.image));
    if (fs.existsSync(oldImgPath)) fs.unlinkSync(oldImgPath);
  }

  db.houses[houseIndex] = {
    ...oldHouse,
    title: req.body.title || oldHouse.title,
    location: req.body.location || oldHouse.location,
    price: req.body.price ? Number(req.body.price) : oldHouse.price,
    description: req.body.description || oldHouse.description,
    image: req.file ? "/uploads/" + req.file.filename : oldHouse.image,
  };

  writeDB(db);
  res.json({ success: true, message: "House updated successfully" });
});

app.delete("/api/houses/:id", (req, res) => {
  const db = readDB();
  const houseIndex = db.houses.findIndex((h) => String(h.id) === req.params.id);
  if (houseIndex === -1)
    return res.status(404).json({ message: "House not found" });

  const house = db.houses[houseIndex];
  if (house.image) {
    const imgPath = path.join(uploadDir, path.basename(house.image));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.houses.splice(houseIndex, 1);
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
    status: "pending",
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
  const reqItem = db.viewRequests.find((r) => String(r.id) === req.params.id);
  if (!reqItem) return res.status(404).json({ message: "Request not found" });

  reqItem.status = "approved";
  writeDB(db);
  res.json({ success: true, message: "Request approved" });
});

// ==========================
// 💳 BOOKINGS + PAYMENTS
// ==========================
app.post("/api/book", (req, res) => {
  const { houseId, customerName, customerPhone, amount } = req.body;
  const db = readDB();

  const house = db.houses.find((h) => String(h.id) === String(houseId));
  if (!house)
    return res.status(404).json({ success: false, message: "House not found" });

  if (house.isBooked) {
    return res.json({ success: false, message: "House already booked" });
  }

  const booking = {
    id: Date.now(),
    houseId: house.id,
    houseTitle: house.title,
    amount,
    customerName,
    customerPhone,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  house.isBooked = true;
  db.bookings.push(booking);
  writeDB(db);

  res.json({ success: true, message: "Booking created", booking });
});

app.get("/api/bookings", (req, res) => {
  const db = readDB();
  res.json(db.bookings || []);
});

app.post("/api/bookings/:id/approve", (req, res) => {
  const db = readDB();
  const booking = db.bookings.find((b) => String(b.id) === req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  booking.status = "approved";
  writeDB(db);
  res.json({ success: true, message: "Booking approved", booking });
});

app.post("/api/payments", (req, res) => {
  const { bookingId, name, phone } = req.body;
  const db = readDB();

  const booking = db.bookings.find((b) => String(b.id) === String(bookingId));
  if (!booking)
    return res.status(404).json({ success: false, message: "Booking not found" });

  if (booking.status !== "approved") {
    return res.json({ success: false, message: "Booking not approved yet" });
  }

  const totalAmount = Number(booking.amount) + 257;

  const payment = {
    id: Date.now(),
    bookingId,
    name,
    phone,
    amount: totalAmount,
    date: new Date().toISOString(),
  };

  booking.status = "paid";
  db.payments = db.payments || [];
  db.payments.push(payment);

  writeDB(db);
  res.json({ success: true, message: "Payment successful", payment });
});

// ==========================
// ✅ STATIC ROUTES (Frontend)
// ==========================
app.use("/uploads", express.static(uploadDir));

// serve static frontend safely
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ message: "Frontend not found. API is running ✅" });
  });
}

// ==========================
// ✅ START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running at: http://localhost:${PORT}`)
);
