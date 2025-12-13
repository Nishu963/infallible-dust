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

/* ---------------- INIT DB ---------------- */
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
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai"],
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

/* ---------------- DRIVERS ---------------- */
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire" },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR" },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova" },
  ];
}

/* ---------------- AUTH ---------------- */
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ---------------- ROUTES ---------------- */

// Root
app.get("/", (req, res) => {
  res.json({ message: "🚖 OlaGo Backend Running" });
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  const user = db.users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, wallet: user.wallet },
  });
});

// Logout
app.post("/api/logout", verifyToken, (req, res) => {
  res.json({ message: "Logout successful" });
});

// Profile
app.get("/api/profile", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      wallet: user.wallet,
      totalRides: user.rideHistory.length,
    },
  });
});

// Request Ride (wallet deduction + history)
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  const fare = 100;

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  if (user.wallet < fare) {
    return res.status(400).json({ error: "Insufficient wallet balance" });
  }

  user.wallet -= fare;

  const ride = {
    id: Date.now(),
    pickup,
    destination,
    fare,
    driver: db.drivers[Math.floor(Math.random() * db.drivers.length)],
    timestamp: new Date(),
  };

  user.rideHistory.unshift(ride);
  writeDB(db);

  res.json({ success: true, ride, wallet: user.wallet });
});

// Ride History
app.get("/api/rides/history", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ rideHistory: user.rideHistory });
});

/* ---------------- START ---------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚖 OlaGo Backend running on port ${PORT}`)
);
