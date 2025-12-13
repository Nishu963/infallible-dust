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
            phone: "9999999999",
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
        contacts: []
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

// Signup (phone added)
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password, phone } = req.body;
    if (!username || !password || !phone)
      return res.status(400).json({ error: "Username, password and phone required" });

    const db = readDB();
    if (db.users.find((u) => u.username === username))
      return res.status(409).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.users.push({
      id: Date.now(),
      username,
      phone,
      password: hashedPassword,
      wallet: 500,
      rideHistory: [],
      walletHistory: [],
    });

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
    const db = readDB();
    const user = db.users.find((u) => u.username === username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        wallet: user.wallet,
      },
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// -------------------- PROFILE --------------------
app.get("/api/profile", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  res.json({
    id: user.id,
    username: user.username,
    phone: user.phone,
    wallet: user.wallet,
    rideHistory: user.rideHistory,
    walletHistory: user.walletHistory,
  });
});

// Update profile (phone allowed)
app.put("/api/profile", verifyToken, (req, res) => {
  const { username, phone } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  if (username) user.username = username;
  if (phone) user.phone = phone;

  writeDB(db);
  res.json({ message: "Profile updated", user });
});

// -------------------- CONTACT SUPPORT --------------------
app.post("/api/contact", verifyToken, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const db = readDB();
  db.contacts.push({
    id: Date.now(),
    userId: req.user.id,
    message,
    date: new Date(),
  });

  writeDB(db);
  res.json({ message: "Support message sent successfully" });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚖 OlaGo Backend running at port ${PORT}`)) 
