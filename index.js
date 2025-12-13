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
    {
      id: 1,
      name: "Rahul Kumar",
      phone: "9000000001",
      rating: 4.8,
      car: "Swift Dzire",
      lat: 25.2,
      lng: 87.0,
      available: true,
    },
    {
      id: 2,
      name: "Amit Singh",
      phone: "9000000002",
      rating: 4.6,
      car: "WagonR",
      lat: 25.21,
      lng: 87.01,
      available: true,
    },
    {
      id: 3,
      name: "Deepak Yadav",
      phone: "9000000003",
      rating: 4.9,
      car: "Innova",
      lat: 25.19,
      lng: 87.02,
      available: true,
    },
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
            walletHistory: [],
            rideHistory: [],
          },
        ],
        drivers: sampleDrivers(),
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai", "Kolkata", "Bangalore"],
        promoCodes: [
          { code: "SAVE50", discount: 50, usedBy: [] },
          { code: "NEW20", discount: 20, usedBy: [] },
        ],
        rides: [],
        contacts: [],
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
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// -------------------- FARE LOGIC --------------------
function calculateFare(rideType = "Ride") {
  if (rideType === "Rent") return 300;
  if (rideType === "Outstation") return 600;
  return 150; // Normal Ride
}

// -------------------- ROOT --------------------
app.get("/", (req, res) => {
  res.json({ message: "🚖 OlaGo Backend Running" });
});

// -------------------- AUTH --------------------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  const user = db.users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

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
});

// -------------------- CITIES (AUTOFILL) --------------------
app.get("/api/cities", (req, res) => {
  const db = readDB();
  res.json({ cities: db.cities });
});

// -------------------- NEARBY DRIVERS --------------------
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const db = readDB();
  const drivers = db.drivers.filter((d) => d.available);
  res.json({ drivers });
});

// -------------------- RIDE PREVIEW (PRE-SUGGESTION) --------------------
app.post("/api/rides/preview", verifyToken, (req, res) => {
  const { pickup, destination, rideType } = req.body;

  if (!pickup || !destination)
    return res.status(400).json({ error: "Pickup & destination required" });

  const fare = calculateFare(rideType);

  res.json({
    pickup,
    destination,
    rideType,
    estimatedFare: fare,
    eta: "5 mins",
  });
});

// -------------------- RIDE REQUEST (WALLET DEDUCTION) --------------------
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination, rideType, promoCode } = req.body;
  const db = readDB();

  const user = db.users.find((u) => u.id === req.user.id);
  const driver = db.drivers.find((d) => d.available);

  if (!driver)
    return res.status(404).json({ error: "No drivers available" });

  let fare = calculateFare(rideType);

  // PROMO CODE
  if (promoCode) {
    const promo = db.promoCodes.find((p) => p.code === promoCode);
    if (promo && !promo.usedBy.includes(user.id)) {
      fare -= promo.discount;
      promo.usedBy.push(user.id);
    }
  }

  if (user.wallet < fare)
    return res.status(400).json({ error: "Insufficient wallet balance" });

  // 💰 Deduct Wallet
  user.wallet -= fare;
  user.walletHistory.push({
    amount: -fare,
    reason: "Ride Payment",
    date: new Date(),
  });

  driver.available = false;

  const ride = {
    id: Date.now(),
    userId: user.id,
    pickup,
    destination,
    rideType,
    fare,
    driver,
    status: "CONFIRMED",
    createdAt: new Date(),
  };

  db.rides.push(ride);
  user.rideHistory.push(ride);

  writeDB(db);

  res.json({ ride, walletBalance: user.wallet });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚖 OlaGo Backend running on port ${PORT}`)
);
