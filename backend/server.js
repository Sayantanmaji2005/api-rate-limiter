require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const redisClient = require("./config/redis");
const connectDB = require("./config/db");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed"));
    }
  })
);
app.use(express.json());
app.set("trust proxy", true);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      mongo: mongoose.connection.readyState === 1 ? "up" : "down",
      redis: redisClient.isOpen ? "up" : "down"
    }
  });
});

app.use("/auth", require("./routes/authRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/api", require("./routes/protectedRoutes"));

app.use((_req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

function startHttpServer() {
  const server = http.createServer(app);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the conflicting process or change PORT in backend/.env.`);
    } else {
      console.error("Server failed to start:", err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
  });
}

connectDB()
  .then(() => {
    startHttpServer();
  })
  .catch((err) => {
    console.error("Startup failed:", err.message);
    process.exit(1);
  });
