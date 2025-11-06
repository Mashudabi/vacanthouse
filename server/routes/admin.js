// server/routes/admin.js
import express from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

const router = express.Router();

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, "../db.json");

// ENV
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// Middleware: verify admin
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized: No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") throw new Error();
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
}

// ✅ LOGIN
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// ✅ GET ALL HOUSES
router.get("/houses", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  res.json(data.houses || []);
});

// ✅ ADD OR EDIT HOUSE
router.post("/houses", verifyAdmin, (req, res) => {
  const { id, title, location, price, image } = req.body;
  const data = JSON.parse(fs.readFileSync(dataFile));

  if (id) {
    // Edit existing
    const house = data.houses.find((h) => h.id === id);
    if (!house) return res.status(404).json({ message: "House not found" });
    Object.assign(house, { title, location, price, image });
  } else {
    // Add new
    const newHouse = {
      id: Date.now().toString(),
      title,
      location,
      price,
      image,
    };
    data.houses.push(newHouse);
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  res.json({ message: "House saved successfully" });
});

// ✅ DELETE HOUSE + IMAGE
router.delete("/houses/:id", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  const index = data.houses.findIndex((h) => String(h.id) === req.params.id);
  if (index === -1) return res.status(404).json({ message: "House not found" });

  const house = data.houses[index];
  if (house.image) {
    const imgPath = path.join(__dirname, "../../uploads", path.basename(house.image));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  data.houses.splice(index, 1);
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  res.json({ message: "House deleted successfully" });
});

// ✅ GET VIEWING REQUESTS
router.get("/view-requests", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  res.json(data.viewRequests || []);
});

// ✅ APPROVE VIEWING REQUEST
router.post("/view-requests/:id/approve", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  const request = data.viewRequests.find((r) => String(r.id) === req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });

  request.status = "approved";
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  res.json({ message: "Request approved" });
});

// ✅ GET BOOKINGS
router.get("/bookings", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  res.json(data.bookings || []);
});

// ✅ APPROVE BOOKING
router.post("/bookings/:id/approve", verifyAdmin, (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  const booking = data.bookings.find((b) => String(b.id) === req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  booking.status = "approved";
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  res.json({ message: "Booking approved" });
});

export default router;
