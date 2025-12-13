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
          },
        ],
        drivers: sampleDrivers(),
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai", "Kolkata", "Bangalore"],
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

// -------------------- SAMPLE DRIVERS --------------------
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire", lat: 25.2, lng: 87.0 },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR", lat: 25.21, lng: 87.01 },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova", lat: 25.19, lng: 87.02 },
  ];
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
    db.users.push({ id: Date.now(), username, password: hashedPassword, wallet: 500, rideHistory: [] });
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

// Profile
app.get("/api/profile", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// Wallet Topup
app.post("/api/wallet/topup", verifyToken, (req, res) => {
  const { amount } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.wallet += Number(amount);
  writeDB(db);
  res.json({ message: `Wallet updated. Balance: ₹${user.wallet}` });
});

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

// Request ride
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  if (!pickup || !destination) return res.status(400).json({ error: "Pickup & destination required" });

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  const ride = { id: Date.now(), pickup, destination, driver: db.drivers[Math.floor(Math.random() * db.drivers.length)], timestamp: new Date() };
  user.rideHistory.push(ride);
  writeDB(db);

  res.json({ success: true, ride });
});

// Ride history
app.get("/api/rides/history", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ rideHistory: user.rideHistory || [] });
});

// Promo
const promoCodes = { SAVE10: 0.1, NEW20: 0.2, FIRST50: 0.5 };
app.post("/api/promo/apply", verifyToken, (req, res) => {
  const { code, fare } = req.body;
  const discount = promoCodes[code?.toUpperCase()];
  if (!discount) return res.json({ error: "Invalid promo code" });
  res.json({ discount: fare * discount });
});

// Cities
app.get("/api/cities", (req, res) => {
  const db = readDB();
  res.json({ cities: db.cities });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚖 OlaGo Backend running at port ${PORT}`));
