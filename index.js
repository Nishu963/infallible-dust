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
            password: bcrypt.hashSync("123456", 10),
            wallet: 500,
          },
        ],
        drivers: sampleDrivers(),
        rides: [],
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

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET);
  res.json({ token, user });
});

// ---------------- PAYMENT METHODS ----------------
app.get("/api/payment/methods", verifyToken, (req, res) => {
  res.json({
    methods: [
      { id: "CASH", label: "Cash" },
      { id: "UPI", label: "UPI" },
      { id: "WALLET", label: "Wallet" },
      { id: "PAY_LATER", label: "Pay After Ride" },
    ],
  });
});

// ---------------- PROMO SUGGEST ----------------
app.get("/api/promos/suggest", verifyToken, (req, res) => {
  const db = readDB();
  const promos = db.promoCodes.sort((a, b) => b.discount - a.discount);
  res.json({ promos });
});

// ---------------- REQUEST RIDE ----------------
app.post("/api/rides/request", verifyToken, (req, res) => {
  const db = readDB();

  const baseFare = 70;
  const tax = 30;

  const ride = {
    id: Date.now(),
    userId: req.user.id,
    baseFare,
    tax,
    discount: 0,
    total: baseFare + tax,
    status: "REQUESTED",
    paymentMethod: null,
    paymentStatus: "UNPAID",
  };

  db.rides.push(ride);
  writeDB(db);
  res.json({ ride });
});

// ---------------- APPLY PROMO ----------------
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

// ---------------- CONFIRM PAYMENT ----------------
app.post("/api/payment/confirm", verifyToken, (req, res) => {
  const { rideId, method } = req.body;
  const db = readDB();

  const ride = db.rides.find((r) => r.id === rideId);
  const user = db.users.find((u) => u.id === req.user.id);

  if (method === "WALLET") {
    if (user.wallet < ride.total)
      return res.status(400).json({ error: "Insufficient wallet" });

    user.wallet -= ride.total;
    ride.paymentStatus = "PAID";
  } else if (method === "CASH") {
    ride.paymentStatus = "PAY_ON_RIDE";
  } else {
    ride.paymentStatus = "PENDING";
  }

  ride.paymentMethod = method;
  ride.status = "CONFIRMED";

  writeDB(db);
  res.json({ ride });
});

app.listen(10000, () => console.log("🚖 Backend running on 10000"));
