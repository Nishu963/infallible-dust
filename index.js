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

// Helper: read DB
function readDB() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [], rides: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbFile));
}

// Helper: write DB
function writeDB(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// Middleware: verify JWT
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

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "🚖 Taxi Backend is running!",
    features: [
      { method: "POST", endpoint: "/api/signup", description: "Create new user" },
      { method: "POST", endpoint: "/api/login", description: "Login user" },
      { method: "GET", endpoint: "/api/test", description: "Health check" },
      {
        method: "POST",
        endpoint: "/api/rides/request",
        description: "Request a ride (Auth required)",
      },
    ],
  });
});

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const db = readDB();
    const existingUser = db.users.find((u) => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
    };

    db.users.push(newUser);
    writeDB(db);

    res.json({
      message: "User created successfully",
      user: { id: newUser.id, username: newUser.username },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const db = readDB();
    const user = db.users.find((u) => u.username === username);

    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Ride request (Auth required)
app.post("/api/rides/request", authenticateToken, (req, res) => {
  try {
    const { pickup, destination } = req.body;

    if (!pickup || !destination) {
      return res
        .status(400)
        .json({ error: "Pickup and destination are required" });
    }

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

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
