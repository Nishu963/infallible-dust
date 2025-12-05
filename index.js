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

// --- Helpers ---
function readDB() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [], rides: [], drivers: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile));
  } catch {
    return { users: [], rides: [], drivers: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// JWT Middleware
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

// --- Seed multiple users ---
function seedUsers() {
  const db = readDB();
  const users = [
    { username: "nishu8521", password: bcrypt.hashSync("12345", 10) },
    { username: "userdemo1", password: bcrypt.hashSync("12345", 10) },
    { username: "testuser", password: bcrypt.hashSync("123456", 10) },
  ];
  users.forEach(u => {
    if (!db.users.find(x => x.username === u.username)) {
      db.users.push({ id: Date.now().toString() + Math.random(), ...u });
    }
  });
  writeDB(db);
}

// --- Seed drivers ---
function seedDrivers() {
  const db = readDB();
  if (!db.drivers || db.drivers.length < 3) {
    db.drivers = [
      { id: "1", name: "John Doe", car: "Swift Dzire", rating: 4.8 },
      { id: "2", name: "Jane Smith", car: "Honda City", rating: 4.6 },
      { id: "3", name: "Alex Brown", car: "Hyundai Verna", rating: 4.7 },
    ];
    writeDB(db);
  }
}

// --- Run seeds ---
seedUsers();
seedDrivers();

// --- Routes ---
app.get("/", (req, res) => res.json({ message: "Taxi backend running!" }));

app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const db = readDB();
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: "Username exists" });

  const hashed = await bcrypt.hash(password, 10);
  const newUser = { id: Date.now().toString(), username, password: hashed };
  db.users.push(newUser);
  writeDB(db);

  res.json({ message: "User created", user: { id: newUser.id, username } });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: "Invalid username or password" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Invalid username or password" });

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ message: "Login successful", token });
});

app.get("/api/drivers", authenticateToken, (req, res) => {
  const db = readDB();
  res.json({ drivers: db.drivers });
});

app.post("/api/rides/request", authenticateToken, (req, res) => {
  const { pickup, destination } = req.body;
  if (!pickup || !destination) return res.status(400).json({ error: "Pickup & destination required" });

  const db = readDB();
  const ride = { id: Date.now().toString(), userId: req.user.id, pickup, destination, status: "requested" };
  db.rides.push(ride);
  writeDB(db);

  res.json({ message: "Ride requested successfully", ride });
});

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
