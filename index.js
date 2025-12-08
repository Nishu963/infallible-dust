// index.js — corrected OlaGo backend for Render

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------- Config -------------------
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret_olago_key_2024";

// use process.cwd() to avoid Render working-dir mismatch
const dbPath = path.join(process.cwd(), "db.json");

// ------------------- Helpers -------------------
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire" },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR" },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova" },
  ];
}

function ensureDB() {
  try {
    if (!fs.existsSync(dbPath)) {
      const init = { users: [], drivers: sampleDrivers() };
      fs.writeFileSync(dbPath, JSON.stringify(init, null, 2));
      console.log("db.json created at", dbPath);
    } else {
      // make sure file has required keys
      const raw = fs.readFileSync(dbPath, "utf8");
      let parsed = {};
      try {
        parsed = JSON.parse(raw || "{}");
      } catch (err) {
        console.error("db.json corrupted — recreating", err);
        parsed = {};
      }
      let changed = false;
      if (!Array.isArray(parsed.users)) {
        parsed.users = [];
        changed = true;
      }
      if (!Array.isArray(parsed.drivers)) {
        parsed.drivers = sampleDrivers();
        changed = true;
      }
      if (changed) fs.writeFileSync(dbPath, JSON.stringify(parsed, null, 2));
    }
  } catch (err) {
    console.error("ensureDB error:", err);
  }
}

function readDB() {
  try {
    ensureDB();
    const raw = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    console.error("readDB error:", err);
    return { users: [], drivers: sampleDrivers() };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("writeDB error:", err);
  }
}

// ------------------- Root / Health -------------------
app.get("/", (req, res) => {
  res.json({
    message: "🚖 OlaGo Backend running successfully on Render!",
    endpoints: {
      signup: "/api/signup",
      login: "/api/login",
      drivers: "/api/drivers",
      requestRide: "/api/rides/request",
    },
  });
});

// ------------------- Auth middleware -------------------
function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn("verifyToken failed:", err && err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ------------------- Signup -------------------
app.post("/api/signup", async (req, res) => {
  console.log("SIGNUP body:", req.body);
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const db = readDB();
  if (db.users.find((u) => u.username === username))
    return res.status(409).json({ error: "User already exists" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), username, password: hashed };
    db.users.push(newUser);
    writeDB(db);
    console.log("User signed up:", username);
    return res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------- Login -------------------
app.post("/api/login", async (req, res) => {
  console.log("LOGIN body:", req.body);
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username and password required" });

  const db = readDB();
  const user = db.users.find((u) => u.username === username);

  if (!user) {
    console.log("login failed - user not found:", username);
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("login failed - wrong password:", username);
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("login success:", username);
    return res.json({ token });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------- Drivers (protected) -------------------
app.get("/api/drivers", verifyToken, (req, res) => {
  const db = readDB();
  return res.json({ drivers: db.drivers });
});

// ------------------- Request Ride (protected) -------------------
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  if (!pickup || !destination)
    return res.status(400).json({ error: "Pickup & destination required" });

  // Very simple simulated ride response
  const ride = {
    id: Date.now(),
    user: req.user.username || req.user.id,
    pickup,
    destination,
    status: "requested",
    createdAt: new Date(),
  };

  // optionally store rides in DB — left out to keep sample lightweight
  console.log("ride requested:", ride);
  return res.json({ success: true, ride });
});

// ------------------- Start server -------------------
ensureDB();
app.listen(PORT, () => {
  console.log(`🚖 OlaGo Backend running at http://localhost:${PORT} (port ${PORT})`);
});
