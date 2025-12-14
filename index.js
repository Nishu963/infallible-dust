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

// ---------------- INIT DB ----------------
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
        rides: [],
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai", "Kolkata", "Bangalore"],
        promoCodes: [
          { code: "SAVE50", discount: 50 },
          { code: "NEW20", discount: 20 },
          { code: "RIDE100", discount: 100 },
        ],
      },
      null,
      2
    )
  );
}

const readDB = () => JSON.parse(fs.readFileSync(dbPath));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// ---------------- AUTH ----------------
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

// ---------------- ROUTES ----------------

// Root
app.get("/", (req, res) => {
  res.json({ message: "🚖 OlaGo Backend Running" });
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  const user = db.users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

// Cities
app.get("/api/cities", (req, res) => {
  const db = readDB();
  res.json({ cities: db.cities });
});

// Nearby drivers
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const { lat, lng } = req.query;
  const db = readDB();

  const drivers = db.drivers.filter(
    (d) =>
      d.available &&
      Math.abs(d.lat - lat) < 1 &&
      Math.abs(d.lng - lng) < 1
  );

  res.json({ drivers });
});

// Promo suggestions
app.get("/api/promos", verifyToken, (req, res) => {
  const db = readDB();
  res.json({ promos: db.promoCodes });
});

// Request ride
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  const db = readDB();

  const baseFare = 70;
  const tax = 30;
  const total = baseFare + tax;

  const ride = {
    id: Date.now(),
    userId: req.user.id,
    pickup,
    destination,
    baseFare,
    tax,
    discount: 0,
    total,
    status: "REQUESTED",
    paymentMethod: null,
    paymentStatus: "UNPAID",
  };

  db.rides.push(ride);
  writeDB(db);

  res.json({ ride });
});

// Apply promo
app.post("/api/promos/apply", verifyToken, (req, res) => {
  const { rideId, code } = req.body;
  const db = readDB();

  const promo = db.promoCodes.find((p) => p.code === code);
  const ride = db.rides.find((r) => r.id === rideId);

  if (!promo || !ride) return res.status(400).json({ error: "Invalid promo" });

  ride.discount = promo.discount;
  ride.total = Math.max(0, ride.baseFare + ride.tax - promo.discount);

  writeDB(db);
  res.json({ ride });
});

// Payment confirm
app.post("/api/payment/confirm", verifyToken, (req, res) => {
  const { rideId, method } = req.body;
  const db = readDB();

  const ride = db.rides.find((r) => r.id === rideId);
  const user = db.users.find((u) => u.id === req.user.id);

  if (!ride) return res.status(404).json({ error: "Ride not found" });

  if (method === "WALLET") {
    if (user.wallet < ride.total)
      return res.status(400).json({ error: "Insufficient wallet" });

    user.wallet -= ride.total;
    ride.paymentStatus = "PAID";
  } else {
    ride.paymentStatus = "PENDING";
  }

  ride.paymentMethod = method;
  ride.status = "CONFIRMED";

  writeDB(db);
  res.json({ success: true, ride });
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚖 Backend running on ${PORT}`));
