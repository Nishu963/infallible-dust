const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "supersecret_olago_key_2025";

/* ---------------- IN-MEMORY DATABASE ---------------- */
let db = {
  users: [
    {
      id: 1,
      username: "demo",
      password: bcrypt.hashSync("123456", 10),
      wallet: 500,
      settings: {
        notifications: true,
        darkMode: false,
        language: "English",
      },
    },
  ],
  drivers: [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire", lat: 25.20, lng: 87.00, available: true },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR", lat: 25.21, lng: 87.01, available: true },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova", lat: 25.19, lng: 87.02, available: true },
  ],
  rides: [],
  promoCodes: [
    { code: "SAVE50", discount: 50 },
    { code: "NEW20", discount: 20 },
    { code: "RIDE100", discount: 100 },
  ],
};

const PLACES = [
  "Bhagalpur Railway Station",
  "Tilka Manjhi Chowk",
  "Ghantaghar Bhagalpur",
  "Sabour University",
  "Vikramshila Setu",
  "Nathnagar",
  "Mayaganj Hospital",
  "Kacheri Chowk",
  "Airport Road",
  "Bus Stand Bhagalpur",
];

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

/* ---------------- LOGIN ---------------- */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find((u) => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

/* ---------------- PROFILE ---------------- */
app.get("/api/login-info", verifyToken, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ user });
});

/* ---------------- USER RIDES ---------------- */
app.get("/api/rides/all", verifyToken, (req, res) => {
  const rides = db.rides.filter((r) => r.userId === req.user.id);
  res.json({ rides });
});

/* ---------------- SETTINGS ---------------- */
app.get("/api/settings", verifyToken, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  res.json({ settings: user.settings });
});

app.post("/api/settings/update", verifyToken, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.id);
  user.settings = { ...user.settings, ...req.body };
  res.json({ message: "Settings updated", settings: user.settings });
});

/* ---------------- PLACE SUGGEST ---------------- */
app.get("/api/places/suggest", verifyToken, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  res.json({
    suggestions: PLACES.filter((p) => p.toLowerCase().includes(q)).slice(0, 6),
  });
});

/* ---------------- PAYMENT METHODS (FIXED) ---------------- */
app.get("/api/payment/methods", verifyToken, (req, res) => {
  res.json({
    methods: [
      { id: "WALLET", label: "Wallet" },
      { id: "CASH", label: "Cash" },
    ],
  });
});

/* ---------------- REQUEST RIDE ---------------- */
app.post("/api/rides/request", verifyToken, (req, res) => {
  const baseFare = 70;
  const tax = 30;

  const driver = db.drivers.find((d) => d.available);
  if (driver) driver.available = false;

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
    driverId: driver?.id || null,
  };

  db.rides.push(ride);
  res.json({ ride });
});

/* ---------------- PROMO ---------------- */
app.get("/api/promos/suggest", verifyToken, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  res.json({
    promos: db.promoCodes.filter((p) => p.code.toLowerCase().includes(q)),
  });
});

app.post("/api/promos/apply", verifyToken, (req, res) => {
  const { rideId, code } = req.body;
  const promo = db.promoCodes.find((p) => p.code === code);
  const ride = db.rides.find((r) => r.id === rideId);

  if (!promo || !ride) return res.status(400).json({ error: "Invalid promo" });

  ride.discount = promo.discount;
  ride.total = Math.max(0, ride.baseFare + ride.tax - promo.discount);
  res.json({ ride });
});

/* ---------------- PAYMENT CONFIRM ---------------- */
app.post("/api/payment/confirm", verifyToken, (req, res) => {
  const { rideId, method } = req.body;
  const ride = db.rides.find((r) => r.id === rideId);
  const user = db.users.find((u) => u.id === req.user.id);

  if (!ride) return res.status(404).json({ error: "Ride not found" });

  if (method === "WALLET") {
    if (user.wallet < ride.total)
      return res.status(400).json({ error: "Insufficient wallet" });
    user.wallet -= ride.total;
    ride.paymentStatus = "PAID";
  } else {
    ride.paymentStatus = "PAY_ON_RIDE";
  }

  ride.paymentMethod = method;
  ride.status = "CONFIRMED";

  res.json({ ride, wallet: user.wallet });
});

/* ---------------- START ---------------- */
app.listen(10000, () =>
  console.log("🚖 OlaGo Backend running on port 10000")
);
