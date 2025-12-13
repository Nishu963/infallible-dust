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

/* ---------------- SAMPLE DRIVERS ---------------- */
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire", lat: 25.25, lng: 87.03 },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR", lat: 25.26, lng: 87.04 },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova", lat: 25.24, lng: 87.02 },
  ];
}

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
            walletTransactions: [],
          },
        ],
        drivers: sampleDrivers(),
      },
      null,
      2
    )
  );
}

/* ---------------- DB HELPERS ---------------- */
const readDB = () => JSON.parse(fs.readFileSync(dbPath));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

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

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, wallet: user.wallet },
  });
});

// Profile
app.get("/api/profile", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      wallet: user.wallet,
      totalRides: user.rideHistory.length,
    },
  });
});

// Nearby Drivers
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  const db = readDB();
  const nearbyDrivers = db.drivers.filter(
    (d) => Math.abs(d.lat - lat) <= 0.05 && Math.abs(d.lng - lng) <= 0.05
  );

  res.json({ drivers: nearbyDrivers });
});

// Request Ride (wallet + transaction)
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  const fare = 100;

  if (!pickup || !destination) {
    return res.status(400).json({ error: "Pickup & destination required" });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  if (user.wallet < fare) {
    return res.status(400).json({ error: "Insufficient wallet balance" });
  }

  user.wallet -= fare;

  const driver = db.drivers[Math.floor(Math.random() * db.drivers.length)];

  const ride = {
    id: Date.now(),
    pickup,
    destination,
    fare,
    driver,
    timestamp: new Date().toISOString(),
  };

  user.rideHistory.unshift(ride);

  user.walletTransactions.unshift({
    id: "txn_" + Date.now(),
    title: `Ride to ${destination}`,
    amount: -fare,
    date: new Date().toLocaleString(),
  });

  writeDB(db);

  res.json({ success: true, ride, wallet: user.wallet });
});

// Ride History
app.get("/api/rides/history", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ rideHistory: user.rideHistory });
});

// ✅ WALLET API (FOR WalletScreen)
app.get("/api/wallet", verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);

  res.json({
    balance: user.wallet,
    transactions: user.walletTransactions || [],
  });
});

/* ---------------- START ---------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚖 OlaGo Backend running on port ${PORT}`);
});
