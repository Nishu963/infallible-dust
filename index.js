const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "supersecret_olago_key_2025";
const dbPath = path.join(__dirname, "db.json");

// -------------------- INIT DB --------------------
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire", lat: 25.2, lng: 87.0, available: true },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR", lat: 25.21, lng: 87.01, available: true },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova", lat: 25.19, lng: 87.02, available: true },
  ];
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      {
        users: [
          {
            id: 1,
            username: "demo",
            password: bcrypt.hashSync("123456", 10),
            wallet: 500,
            rideHistory: [],
            walletHistory: [],
          },
        ],
        drivers: sampleDrivers(),
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai", "Kolkata", "Bangalore"],
        promoCodes: [
          { code: "SAVE50", discount: 50, usedBy: [] },
          { code: "NEW20", discount: 20, usedBy: [] },
          { code: "RIDE100", discount: 100, usedBy: [] },
        ],
      },
      null,
      2
    )
  );
}

function readDB() {
  return JSON.parse(fs.readFileSync(dbPath));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// -------------------- AUTH --------------------
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// -------------------- ROUTES --------------------

// Root
app.get("/", (req, res) => {
  res.json({ message: "🚖 OlaGo Backend Running" });
});

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const db = readDB();
    if (db.users.find((u) => u.username === username)) return res.status(409).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.users.push({ id: Date.now(), username, password: hashedPassword, wallet: 500, rideHistory: [], walletHistory: [] });
    writeDB(db);

    res.status(201).json({ message: "Signup successful" });
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const db = readDB();
    const user = db.users.find((u) => u.username === username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful", token, user: { id: user.id, username: user.username, wallet: user.wallet } });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// -------------------- PROFILE --------------------

// Get profile
app.get("/api/profile", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const profile = {
    id: user.id,
    username: user.username,
    wallet: user.wallet,
    totalRides: user.rideHistory.length,
    rideHistory: user.rideHistory,
    walletHistory: user.walletHistory || [],
  };

  res.json({ user: profile });
});

// Update profile
app.put("/api/profile", verifyToken, (req, res) => {
  const { username } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (username) user.username = username;
  writeDB(db);

  res.json({ message: "Profile updated", user });
});

// -------------------- WALLET --------------------

// Top-up wallet
app.post("/api/wallet/topup", verifyToken, (req, res) => {
  const { amount } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

  user.wallet += amt;

  if (!user.walletHistory) user.walletHistory = [];
  user.walletHistory.push({ type: "topup", amount: amt, date: new Date() });

  writeDB(db);
  res.json({ message: `Wallet updated. Balance: ₹${user.wallet}`, wallet: user.wallet });
});

// Wallet history
app.get("/api/wallet/history", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ walletHistory: user.walletHistory || [] });
});

// -------------------- DRIVERS --------------------

// All drivers
app.get("/api/drivers", verifyToken, (req, res) => {
  const db = readDB();
  res.json({ drivers: db.drivers });
});

// Nearby drivers
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "Invalid coordinates" });

  const db = readDB();
  const nearby = db.drivers.filter((d) => Math.abs(d.lat - lat) < 0.05 && Math.abs(d.lng - lng) < 0.05);
  res.json({ drivers: nearby });
});

// -------------------- RIDES --------------------

// Request a ride (assign nearest available driver)
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination, lat, lng, fare } = req.body;
  if (!pickup || !destination || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Pickup, destination, and coordinates required" });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Find nearest available driver
  const availableDrivers = db.drivers.filter((d) => d.available);
  if (availableDrivers.length === 0) return res.status(400).json({ error: "No drivers available nearby" });

  function distance(lat1, lng1, lat2, lng2) {
    return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
  }

  availableDrivers.sort((a, b) => distance(lat, lng, a.lat, a.lng) - distance(lat, lng, b.lat, b.lng));
  const assignedDriver = availableDrivers[0];
  assignedDriver.available = false;

  const rideFare = Number(fare) || 0;
  if (rideFare > 0 && user.wallet < rideFare) return res.status(400).json({ error: "Insufficient wallet balance" });

  if (rideFare > 0) {
    user.wallet -= rideFare;
    if (!user.walletHistory) user.walletHistory = [];
    user.walletHistory.push({ type: "ride_payment", amount: rideFare, date: new Date() });
  }

  const ride = {
    id: Date.now(),
    pickup,
    destination,
    driver: assignedDriver,
    fare: rideFare,
    status: "requested",
    timestamp: new Date(),
  };

  user.rideHistory.push(ride);
  writeDB(db);

  res.json({ success: true, ride, walletBalance: user.wallet });
});

// Update ride status
app.put("/api/rides/:rideId/status", verifyToken, (req, res) => {
  const { status } = req.body;
  const rideId = Number(req.params.rideId);

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const ride = user.rideHistory.find((r) => r.id === rideId);
  if (!ride) return res.status(404).json({ error: "Ride not found" });

  ride.status = status;

  if (status === "completed" || status === "cancelled") {
    const driver = db.drivers.find((d) => d.id === ride.driver.id);
    if (driver) driver.available = true;
  }

  writeDB(db);
  res.json({ message: `Ride status updated to ${status}`, ride });
});

// Ride history
app.get("/api/rides/history", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ rideHistory: user.rideHistory || [] });
});

// -------------------- PROMO --------------------

// List promo codes
app.get("/api/promo/list", verifyToken, (req, res) => {
  const db = readDB();
  res.json({ promoCodes: db.promoCodes.map((p) => p.code) });
});

// Apply promo
app.post("/api/promo/apply", verifyToken, (req, res) => {
  const { code, fare } = req.body;
  const db = readDB();
  const promo = db.promoCodes.find((p) => p.code.toUpperCase() === code?.toUpperCase());
  if (!promo) return res.json({ error: "Invalid promo code" });

  if (promo.usedBy.includes(req.user.id)) return res.json({ error: "Promo already used" });

  const discount = Math.min(fare, promo.discount);
  promo.usedBy.push(req.user.id);
  writeDB(db);

  res.json({ discount });
});

// -------------------- CITIES --------------------
app.get("/api/cities", (req, res) => {
  const db = readDB();
  res.json({ cities: db.cities });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚖 OlaGo Backend running at port ${PORT}`));
