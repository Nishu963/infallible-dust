// -----------------------------------------------------
// OlaGo Backend (Final Working Version for Render)
// -----------------------------------------------------

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// ROOT ROUTE (Required for Render Health & Browser Test)
// -----------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "🚖 OlaGo Backend running successfully on Render!",
    endpoints: {
      signup: "/api/signup",
      login: "/api/login",
      drivers: "/api/drivers",
      requestRide: "/api/rides/request"
    }
  });
});

// -----------------------------------------------------
// Database File (db.json)
// -----------------------------------------------------
const dbPath = path.join(__dirname, "db.json");

// create db.json if missing
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify({ users: [], drivers: sampleDrivers() }, null, 2)
  );
}

function readDB() {
  return JSON.parse(fs.readFileSync(dbPath));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// -----------------------------------------------------
// Sample Drivers (For Home Screen)
// -----------------------------------------------------
function sampleDrivers() {
  return [
    { id: 1, name: "Rahul Kumar", rating: 4.8, car: "Swift Dzire" },
    { id: 2, name: "Amit Singh", rating: 4.6, car: "WagonR" },
    { id: 3, name: "Deepak Yadav", rating: 4.9, car: "Innova" },
  ];
}

// -----------------------------------------------------
// TOKEN AUTH MIDDLEWARE
// -----------------------------------------------------
const JWT_SECRET = "supersecret_olago_key_2024";

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.json({ error: "Invalid token" });
  }
}

// -----------------------------------------------------
// SIGNUP
// -----------------------------------------------------
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ error: "Username and password required" });

  const db = readDB();

  if (db.users.find((u) => u.username === username))
    return res.json({ error: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);

  db.users.push({ id: Date.now(), username, password: hashed });
  writeDB(db);

  res.json({ message: "Signup successful" });
});

// -----------------------------------------------------
// LOGIN
// -----------------------------------------------------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ error: "Username and password required" });

  const db = readDB();
  const user = db.users.find((u) => u.username === username);

  if (!user) return res.json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.json({ error: "Wrong password" });

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ message: "Login success", token });
});

// -----------------------------------------------------
// GET DRIVERS (Protected)
// -----------------------------------------------------
app.get("/api/drivers", verifyToken, (req, res) => {
  const db = readDB();
  res.json({ drivers: db.drivers });
});

// -----------------------------------------------------
// REQUEST RIDE (Protected)
// -----------------------------------------------------
app.post("/api/rides/request", verifyToken, (req, res) => {
  const { pickup, destination } = req.body;

  if (!pickup || !destination)
    return res.json({ error: "Pickup & destination required" });

  res.json({
    success: true,
    ride: {
      id: Date.now(),
      message: "Ride requested successfully",
      pickup,
      destination,
    },
  });
});

// -----------------------------------------------------
// START SERVER (Render will override port)
// -----------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚖 OlaGo Backend running at ${PORT}`);
});
