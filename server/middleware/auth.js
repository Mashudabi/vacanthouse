// ===== Admin Auth Middleware =====

export function verifyAdmin(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ message: "Admin token missing" });
    }

    // For now simple token check
    if (token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ message: "Invalid Admin token" });
    }

    next();
}
