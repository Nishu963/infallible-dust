const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const JWT_SECRET = "supersecretkey_for_olago_app";
const dbFile = path.join(__dirname, "db.json");

const loadDB = () => {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(
      dbFile,
      JSON.stringify({
        users: [],
        rides: [],
        drivers: [],
        cities: ["Patna", "Bihar", "Delhi", "Mumbai", "Kolkata"],
      })
    );
  }
  return JSON.parse(fs.readFileSync(dbFile));
};

const saveDB = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};


app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ error: "Fill all fields" });

  const db = loadDB();
  if (db.users.find((u) => u.username === username))
    return res.json({ error: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);
  db.users.push({ username, password: hashed, wallet: 0, rating: 5, rides: [] });
  saveDB(db);
  res.json({ message: "Signup success" });
});


app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find((u) => u.username === username);
  if (!user) return res.json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ error: "Invalid password" });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});


app.get("/api/cities", (req, res) => {
  const db = loadDB();
  res.json({ cities: db.cities });
});

app.get("/api/drivers", authenticate, (req, res) => {
  const db = loadDB();
  if (!db.drivers.length) {
    db.drivers = [
      { id: "1", name: "Rohit", car: "Swift Dzire", rating: 4.9 },
      { id: "2", name: "Amit", car: "Ertiga", rating: 4.7 },
      { id: "3", name: "Neha", car: "Baleno", rating: 4.8 },
    ];
    saveDB(db);
  }
 
  const drivers = db.drivers.map((d) => ({
    ...d,
    eta: `${Math.floor(Math.random() * 5) + 2}–${Math.floor(Math.random() * 5) + 5} min`,
  }));
  res.json({ drivers });
});


app.post("/api/rides/request", authenticate, (req, res) => {
  const { pickup, destination } = req.body;
  if (!pickup || !destination) return res.json({ error: "Pickup & destination required" });

  const db = loadDB();
  const driver = db.drivers[Math.floor(Math.random() * db.drivers.length)];
  const rideCost = Math.floor(Math.random() * 300) + 100;

  const ride = {
    id: Date.now().toString(),
    user: req.user.username,
    pickup,
    destination,
    status: "pending",
    driver,
    cost: rideCost,
    timestamp: new Date(),
  };

  db.rides.push(ride);

  const user = db.users.find((u) => u.username === req.user.username);
  if (user.wallet >= rideCost) {
    user.wallet -= rideCost;
    ride.status = "accepted"; 
  }

  user.rides.push(ride);
  saveDB(db);

  res.json({ ride });
});

app.post("/api/rides/:rideId/status", authenticate, (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body; 

  const db = loadDB();
  const ride = db.rides.find((r) => r.id === rideId && r.user === req.user.username);
  if (!ride) return res.json({ error: "Ride not found" });

  ride.status = status;
  saveDB(db);

  res.json({ ride });
});

app.get("/api/profile", authenticate, (req, res) => {
  const db = loadDB();
  const user = db.users.find((u) => u.username === req.user.username);
  if (!user) return res.json({ error: "User not found" });

  res.json({
    username: user.username,
    totalRides: user.rides.length,
    rating: user.rating,
    wallet: user.wallet,
    rideHistory: user.rides,
  });
});

app.get("/api/wallet", authenticate, (req, res) => {
  const db = loadDB();
  const user = db.users.find((u) => u.username === req.user.username);
  if (!user) return res.json({ error: "User not found" });

  res.json({
    balance: user.wallet,
    transactions: [
      { id: "1", title: "Ride Deduction", amount: -120, date: "Today, 4:30 PM" },
      { id: "2", title: "Added Money", amount: +300, date: "Today, 1:20 PM" },
    ],
  });
});

app.post("/api/wallet/add", authenticate, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.json({ error: "Invalid amount" });

  const db = loadDB();
  const user = db.users.find((u) => u.username === req.user.username);
  if (!user) return res.json({ error: "User not found" });

  user.wallet += amount;
  saveDB(db);

  res.json({ balance: user.wallet, message: "Money added successfully" });
});


app.listen(PORT, () => {
  console.log(`🚖 OlaGo Backend running at http://localhost:${PORT}`);
});
