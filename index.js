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

      favouriteLocations: [],
      emergencyContacts: [],
    },
  ],

  drivers: [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire", lat: 25.2, lng: 87.0, available: true },
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

function getUser(req, res) {
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return user;
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
  const user = getUser(req, res);
  if (!user) return;
  res.json({ user });
});

/* ---------------- SETTINGS (UPDATED) ---------------- */
app.get("/api/settings", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  res.json({
    settings: {
      notifications: user.settings.notifications,
      darkMode: user.settings.darkMode,
      language: user.settings.language,
    },
  });
});

app.post("/api/settings/update", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  const { notifications, darkMode, language } = req.body;

  if (typeof notifications === "boolean") {
    user.settings.notifications = notifications;
  }

  if (typeof darkMode === "boolean") {
    user.settings.darkMode = darkMode;
  }

  if (language) {
    user.settings.language = language;
  }

  res.json({
    message: "Settings updated successfully",
    settings: user.settings,
  });
});

/* ---------------- FAVOURITE LOCATIONS ---------------- */
app.get("/api/favourites", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  res.json({ favourites: user.favouriteLocations });
});

app.post("/api/favourites/add", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  user.favouriteLocations.push(req.body.place);
  res.json({ favourites: user.favouriteLocations });
});

/* ---------------- EMERGENCY CONTACTS ---------------- */
app.get("/api/emergency", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  res.json({ contacts: user.emergencyContacts });
});

app.post("/api/emergency/add", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  const { name, phone } = req.body;
  user.emergencyContacts.push({ name, phone });
  res.json({ contacts: user.emergencyContacts });
});

/* ---------------- DONATION ---------------- */
app.post("/api/donate", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  const { amount } = req.body;
  if (user.wallet < amount)
    return res.status(400).json({ error: "Insufficient wallet" });

  user.wallet -= amount;
  res.json({ message: "Donation successful", wallet: user.wallet });
});

/* ---------------- PLACES ---------------- */
app.get("/api/places/suggest", verifyToken, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const results = PLACES.filter((p) => p.toLowerCase().includes(q)).slice(0, 6);
  res.json({ suggestions: results });
});

/* ---------------- DRIVERS ---------------- */
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng))
    return res.status(400).json({ error: "Invalid coordinates" });

  const nearby = db.drivers.filter(
    (d) =>
      d.available &&
      Math.abs(d.lat - lat) <= 0.05 &&
      Math.abs(d.lng - lng) <= 0.05
  );

  res.json({ drivers: nearby });
});

/* ---------------- RIDES ---------------- */
app.post("/api/rides/request", verifyToken, (req, res) => {
  const user = getUser(req, res);
  if (!user) return;

  const baseFare = 70;
  const tax = 30;

  const driver = db.drivers.find((d) => d.available);
  if (!driver) return res.status(400).json({ error: "No drivers available" });

  driver.available = false;

  const ride = {
    id: Date.now(),
    userId: user.id,
    baseFare,
    tax,
    discount: 0,
    total: baseFare + tax,
    status: "REQUESTED",
    paymentStatus: "UNPAID",
    paymentMethod: null,
    driverId: driver.id,
  };

  db.rides.push(ride);
  res.json({ ride });
});

app.get("/api/rides/all", verifyToken, (req, res) => {
  const rides = db.rides.filter((r) => r.userId === req.user.id);
  res.json({ rides });
});

/* ---------------- PAYMENT ---------------- */
app.post("/api/payment/confirm", verifyToken, (req, res) => {
  const { rideId, method } = req.body;

  const ride = db.rides.find((r) => r.id === rideId);
  const user = getUser(req, res);
  if (!ride || !user) return;

  if (method === "WALLET") {
    if (user.wallet < ride.total)
      return res.status(400).json({ error: "Insufficient wallet" });

    user.wallet -= ride.total;
    ride.paymentStatus = "PAID";
  } else {
    ride.paymentStatus = "PAY_ON_RIDE";
  }

  ride.status = "COMPLETED";
  ride.paymentMethod = method;

  const driver = db.drivers.find((d) => d.id === ride.driverId);
  if (driver) driver.available = true;

  res.json({ ride, wallet: user.wallet });
});

/* ---------------- SERVER ---------------- */
app.listen(10000, () =>
  console.log("🚖 OlaGo Backend running on port 10000")
);
