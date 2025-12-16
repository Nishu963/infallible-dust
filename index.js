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
      transactions: [],
      settings: {
        notifications: true,
        darkMode: false,
        language: "English",
      },
    },
  ],

  rides: [],

  drivers: [
    {
      id: 1,
      name: "Ramesh Kumar",
      phone: "9876543210",
      car: "Swift Dzire",
      rating: 4.7,
      lat: 28.6129,
      lng: 77.2295,
    },
    {
      id: 2,
      name: "Amit Singh",
      phone: "9876500001",
      car: "WagonR",
      rating: 4.5,
      lat: 28.6139,
      lng: 77.2280,
    },
    {
      id: 3,
      name: "Suresh Yadav",
      phone: "9876500002",
      car: "Alto",
      rating: 4.6,
      lat: 28.6110,
      lng: 77.2300,
    },
  ],
};

/* ---------------- AUTH ---------------- */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function getUser(id) {
  return db.users.find((u) => u.id === id);
}

/* ---------------- NEARBY DRIVER LOGIC ---------------- */
function assignNearestDriver() {
  // Random nearest simulation
  const index = Math.floor(Math.random() * db.drivers.length);
  return db.drivers[index];
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

/* ---------------- CREATE RIDE ---------------- */
app.post("/api/rides/request", auth, (req, res) => {
  const user = getUser(req.user.id);

  const ride = {
    id: Date.now().toString(),
    userId: user.id,
    vehicleType: req.body.vehicleType,
    baseFare: req.body.baseFare,
    tax: req.body.tax,
    discount: req.body.discount,
    total: req.body.total,
    paymentMethod: null,
    status: "REQUESTED",
    driver: null,
    createdAt: new Date(),
  };

  db.rides.push(ride);
  res.json({ ride });
});

/* ---------------- GET RIDE ---------------- */
app.get("/api/rides/:id", auth, (req, res) => {
  const ride = db.rides.find((r) => r.id === req.params.id);
  if (!ride) return res.status(404).json({ error: "Ride not found" });
  res.json({ ride });
});

/* ---------------- AUTO PROMO (NO USER INPUT) ---------------- */
app.get("/api/promos/auto", auth, (req, res) => {
  const user = getUser(req.user.id);
  const rideTotal = Number(req.query.rideTotal);

  let promo;

  if (user.wallet < 100) {
    promo = {
      code: "LOWWALLET50",
      discount: 50,
      message: "Low wallet bonus ₹50",
    };
  } else if (rideTotal >= 200) {
    promo = {
      code: "RIDE100",
      discount: 100,
      message: "₹100 OFF on your ride",
    };
  } else {
    promo = {
      code: "SAVE20",
      discount: 20,
      message: "Save ₹20 instantly",
    };
  }

  res.json({ promo });
});

/* ---------------- CONFIRM PAYMENT ---------------- */
app.post("/api/payment/confirm", auth, (req, res) => {
  const { rideId, method } = req.body;
  const ride = db.rides.find((r) => r.id === rideId);
  const user = getUser(req.user.id);

  if (!ride) return res.status(404).json({ error: "Ride not found" });

  if (method === "WALLET") {
    if (user.wallet < ride.total)
      return res.status(400).json({ error: "Insufficient wallet" });

    user.wallet -= ride.total;

    user.transactions.push({
      type: "RIDE_PAYMENT",
      amount: ride.total,
      message: `Ride payment (${ride.vehicleType})`,
      date: new Date(),
    });
  }

  ride.paymentMethod = method;
  ride.status = "CONFIRMED";
  ride.driver = assignNearestDriver();

  res.json({ success: true, ride, wallet: user.wallet });
});

/* ---------------- CANCEL RIDE ---------------- */
app.post("/api/rides/:id/cancel", auth, (req, res) => {
  const ride = db.rides.find((r) => r.id === req.params.id);
  if (!ride) return res.status(404).json({ error: "Ride not found" });

  ride.status = "CANCELLED";
  res.json({ success: true, message: "Ride cancelled successfully" });
});

/* ---------------- DONATION ---------------- */
app.post("/api/donate", auth, (req, res) => {
  const { amount, message } = req.body;
  const user = getUser(req.user.id);

  if (user.wallet < amount)
    return res.status(400).json({ error: "Insufficient wallet balance" });

  user.wallet -= amount;

  user.transactions.push({
    type: "DONATION",
    amount,
    message: message || "Thank you for your donation ❤️",
    date: new Date(),
  });

  res.json({
    success: true,
    wallet: user.wallet,
    message: "Donation successful",
  });
});

/* ---------------- WALLET TRANSACTIONS ---------------- */
app.get("/api/wallet/transactions", auth, (req, res) => {
  const user = getUser(req.user.id);
  res.json({ transactions: user.transactions.reverse() });
});

/* ---------------- SERVER ---------------- */
app.listen(10000, () =>
  console.log("🚖 OlaGo Backend running on port 10000")
);
