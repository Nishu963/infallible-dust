const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();

// --- Configuration ---
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const JWT_SECRET = "supersecretkey_for_taxi_app_2024";
const dbFile = path.join(__dirname, "db.json");

// --- Helper Functions for File-Based DB ---

/**
 * Reads the 'db.json' file, initializes it if missing, and returns the data.
 * @returns {{users: Array, rides: Array}} The database content.
 */
function readDB() {
    if (!fs.existsSync(dbFile)) {
        // Initialize with empty arrays if file does not exist
        fs.writeFileSync(dbFile, JSON.stringify({ users: [], rides: [] }, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (err) {
        console.error("Error reading DB (file corruption likely):", err);
        return { users: [], rides: [] };
    }
}

/**
 * Writes the provided data object back to 'db.json'.
 * @param {object} data - The full database object to write.
 */
function writeDB(data) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing DB:", err);
    }
}

// --- Middleware: JWT Authentication ---

/**
 * Verifies the JWT provided in the Authorization header.
 * If successful, attaches the decoded user payload to req.user and calls next().
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    // Expected format: "Bearer <TOKEN>"
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied: No token provided" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Log the specific error (e.g., TokenExpiredError) for debugging
            console.error("JWT Verification Failed:", err.name, err.message);
            return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
        }

        // Token is valid; attach the user payload (id, username) to the request
        req.user = user;
        next();
    });
}
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
ensureDriversInDB();

// --- Routes ---

// Root route (API documentation)
app.get("/", (req, res) => {
    res.json({
        message: "🚖 Taxi Backend is running!",
        status: "OK",
        available_endpoints: [
            { method: "POST", endpoint: "/api/signup", description: "Create new user" },
            { method: "POST", endpoint: "/api/login", description: "Login user and receive JWT" },
            { method: "GET", endpoint: "/api/test", description: "Health check" },
            { method: "POST", endpoint: "/api/rides/request", description: "Request a ride (Auth required)" },
        ],
    });
});

// Health check
app.get("/api/test", (req, res) => {
    res.json({ status: "ok", message: "Backend is working!" });
});

// Signup Route
app.post("/api/signup", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const db = readDB();
        if (db.users.find((u) => u.username === username)) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now().toString(), username, password: hashedPassword };

        db.users.push(newUser);
        writeDB(db);

        res.status(201).json({ 
            message: "User created successfully", 
            user: { id: newUser.id, username } 
        });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ error: "Server error during signup" });
    }
});

// Login Route
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

        // Create JWT payload with user ID and username
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });
        
        res.json({ message: "Login successful", token });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ error: "Server error during login" });
    }
});

// Ride request (Auth required)
app.post("/api/rides/request", authenticateToken, (req, res) => {
    try {
        // req.user is guaranteed to exist here due to authenticateToken middleware
        const userId = req.user.id; 
        const { pickup, destination } = req.body;

        if (!pickup || !destination) {
            return res.status(400).json({ error: "Pickup and destination are required" });
        }

        const db = readDB();
        const newRide = {
            id: Date.now().toString(),
            userId: userId, // Use the ID from the validated token
            pickup,
            destination,
            status: "requested",
            createdAt: new Date().toISOString()
        };

        db.rides.push(newRide);
        writeDB(db);

        res.status(201).json({ message: "Ride requested successfully", ride: newRide });
    } catch (err) {
        console.error("RIDE REQUEST ERROR:", err);
        res.status(500).json({ error: "Server error during ride request" });
    }
});

// --- Start Server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
