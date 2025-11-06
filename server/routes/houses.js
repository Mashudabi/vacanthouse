import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { adminAuth } from "../middleware/adminAuth.js"; // ✅ admin security

const router = express.Router();

// ==== File Paths ====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, "../db.json");
const uploadDir = path.join(process.cwd(), "uploads");

// ==== Multer Image Upload ====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ==== Helper ====
const readData = () => JSON.parse(fs.readFileSync(dataFile));
const writeData = data =>
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

/* ===============================
   GET ALL HOUSES
================================ */
router.get("/", (req, res) => {
  const data = readData();
  res.json(data.houses || []);
});

/* ===============================
   GET HOUSE BY ID
================================ */
router.get("/:id", (req, res) => {
  const data = readData();
  const house = data.houses.find(h => String(h.id) === req.params.id);
  if (!house) return res.status(404).json({ message: "House not found" });
  res.json(house);
});

/* ===============================
   UPDATE HOUSE (Admin only)
================================ */
router.put("/:id", adminAuth, upload.single("image"), (req, res) => {
  const data = readData();
  const houseIndex = data.houses.findIndex(h => String(h.id) === req.params.id);
  if (houseIndex === -1)
    return res.status(404).json({ success: false, message: "House not found" });

  const house = data.houses[houseIndex];

  // Update fields
  house.title = req.body.title || house.title;
  house.location = req.body.location || house.location;
  house.price = req.body.price ? Number(req.body.price) : house.price;
  house.description = req.body.description || house.description;

  // ✅ If new image uploaded → delete old one
  if (req.file) {
    const oldImage = house.image?.replace("/uploads/", "");
    const oldPath = path.join(uploadDir, oldImage);

    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    house.image = "/uploads/" + req.file.filename;
  }

  data.houses[houseIndex] = house;
  writeData(data);

  res.json({ success: true, message: "House updated", house });
});

/* ===============================
   DELETE HOUSE (Admin only)
================================ */
router.delete("/:id", adminAuth, (req, res) => {
  const data = readData();
  const index = data.houses.findIndex(h => String(h.id) === req.params.id);

  if (index === -1)
    return res.status(404).json({ success: false, message: "House not found" });

  const house = data.houses[index];

  // ✅ Delete image file
  if (house.image) {
    const imgName = house.image.replace("/uploads/", "");
    const imgPath = path.join(uploadDir, imgName);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  data.houses.splice(index, 1);
  writeData(data);

  res.json({ success: true, message: "✅ House & image deleted" });
});

export default router;
