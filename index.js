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
            rideHistory: [],
            walletHistory: [],
          },
        ],
        drivers: sampleDrivers(),
        cities: ["Bhagalpur", "Patna", "Delhi", "Mumbai", "Kolkata", "Bangalore"],
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
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// -------------------- ROOT --------------------
app.get("/", (req, res) => {
  res.json({ message: "🚖 OlaGo Backend Running" });
});

// -------------------- AUTH APIs --------------------
app.post("/api/signup", async (req, res) => {
  const { username, password, phone } = req.body;
  if (!username || !password || !phone)
    return res.status(400).json({ error: "All fields required" });

  const db = readDB();
  if (db.users.find((u) => u.username === username))
    return res.status(409).json({ error: "User exists" });

  db.users.push({
    id: Date.now(),
    username,
    phone,
    password: await bcrypt.hash(password, 10),
    wallet: 500,
    rideHistory: [],
    walletHistory: [],
  });

  writeDB(db);
  res.json({ message: "Signup successful" });
});

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

// -------------------- DRIVERS --------------------
app.get("/api/drivers/nearby", verifyToken, (req, res) => {
  const { lat, lng } = req.query;
  const db = readDB();

  // DEMO: return all available drivers
  const drivers = db.drivers.filter((d) => d.available);

  res.json({ drivers });
});

// -------------------- RIDE REQUEST --------------------
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;
  if (!pickup || !destination)
    return res.status(400).json({ error: "Pickup & destination required" });

  const db = readDB();
  const driver = db.drivers.find((d) => d.available);

  if (!driver)
    return res.status(404).json({ error: "No drivers available" });

  driver.available = false;

  const ride = {
    id: Date.now(),
    userId: req.user.id,
    driver,
    pickup,
    destination,
    status: "CONFIRMED",
    fare: 150,
    createdAt: new Date(),
  };

  db.rides.push(ride);
  writeDB(db);

  res.json({ ride });
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚖 OlaGo Backend running on port ${PORT}`)
);
