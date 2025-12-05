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
const JWT_SECRET = "supersecretkey";
const dbFile = path.join(__dirname, "db.json");

// --- Helper: Read DB ---
function readDB() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [], rides: [], drivers: [], cities: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile));
  } catch (err) {
    console.error("Error reading DB:", err);
    return { users: [], rides: [], drivers: [], cities: [] };
  }
}

// --- Helper: Write DB ---
function writeDB(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing DB:", err);
  }
}

// --- JWT Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// --- Seed Drivers ---
function ensureDriversInDB() {
  const db = readDB();
  if (!db.drivers) db.drivers = [];
  if (db.drivers.length === 0) {
    db.drivers.push(
      { id: "1", name: "John Doe", car: "Swift Dzire", rating: 4.8 },
      { id: "2", name: "Jane Smith", car: "Honda City", rating: 4.6 },
      { id: "3", name: "Alex Brown", car: "Hyundai Verna", rating: 4.7 }
    );
    writeDB(db);
  }
}

// --- Seed Cities ---
function seedCities() {
  const db = readDB();
  if (!db.cities || db.cities.length === 0) {
    db.cities = ["Mumbai", "Bangalore", "Delhi"];
    writeDB(db);
    console.log("✅ Seeded cities added");
  }
}

// --- Seed Multiple Test Users ---
async function seedTestUsers() {
  const db = readDB();
  const testUsers = [
    { username: "nishu8521", password: "12345" },
    { username: "userdemo1", password: "12345" },
    { username: "testuser", password: "123456" },
  ];

  for (const user of testUsers) {
    if (!db.users.find(u => u.username === user.username)) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      db.users.push({ id: Date.now().toString(), username: user.username, password: hashedPassword });
    }
  }
  writeDB(db);
}

// Run seeds
ensureDriversInDB();
seedCities();
seedTestUsers();

// --- Routes ---
app.get("/", (req, res) => {
  res.json({
    message: "🚖 Taxi Backend is running!",
    features: [
      { method: "POST", endpoint: "/api/signup", description: "Create new user" },
      { method: "POST", endpoint: "/api/login", description: "Login user" },
      { method: "GET", endpoint: "/api/cities", description: "Get seeded cities" },
      { method: "GET", endpoint: "/api/drivers", description: "Get nearby drivers (Auth required)" },
      { method: "POST", endpoint: "/api/rides/request", description: "Request a ride (Auth required)" },
    ],
  });
});

// --- Test endpoint ---
app.get("/api/test", (req, res) => {
  res.json({ status: "ok", message: "Backend is working!" });
});

// --- Signup ---
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    const db = readDB();
    if (db.users.find(u => u.username === username))
      return res.status(400).json({ error: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), username, password: hashedPassword };

    db.users.push(newUser);
    writeDB(db);

    res.json({ message: "User created successfully", user: { id: newUser.id, username } });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Login ---
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user) return res.status(400).json({ error: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Get Cities ---
app.get("/api/cities", (req, res) => {
  const db = readDB();
  res.json({ cities: db.cities || [] });
});

// --- Get Drivers ---
app.get("/api/drivers", authenticateToken, (req, res) => {
  try {
    const db = readDB();
    res.json({ drivers: db.drivers || [] });
  } catch (err) {
    console.error("GET DRIVERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Request Ride ---
app.post("/api/rides/request", authenticateToken, (req, res) => {
  try {
    const { pickup, destination } = req.body;
    if (!pickup || !destination) return res.status(400).json({ error: "Pickup and destination are required" });

    const db = readDB();
    const newRide = {
      id: Date.now().toString(),
      userId: req.user.id,
      pickup,
      destination,
      status: "requested",
    };

    db.rides.push(newRide);
    writeDB(db);

    res.json({ message: "Ride requested successfully", ride: newRide });
  } catch (err) {
    console.error("RIDE REQUEST ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
