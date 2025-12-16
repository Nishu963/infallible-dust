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

/* ---------------- DRIVER ASSIGN ---------------- */
function assignDriver() {
  return {
    name: "Ramesh Kumar",
    phone: "9876543210",
    car: "Swift Dzire",
    rating: 4.7,
  };
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
      message: `Ride payment for ${ride.vehicleType}`,
      date: new Date(),
    });
  }

  ride.paymentMethod = method;
  ride.status = "CONFIRMED";
  ride.driver = assignDriver();

  res.json({ success: true, ride, wallet: user.wallet });
});

/* ---------------- CANCEL RIDE + LOGOUT ---------------- */
app.post("/api/rides/:id/cancel", auth, (req, res) => {
  const ride = db.rides.find((r) => r.id === req.params.id);
  if (!ride) return res.status(404).json({ error: "Ride not found" });

  ride.status = "CANCELLED";
  res.json({ success: true, message: "Ride cancelled" });
});

/* ---------------- DONATION (WITH MESSAGE) ---------------- */
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
