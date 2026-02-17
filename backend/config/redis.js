const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    reconnectStrategy: (retries) => {
      // Log a warning periodically (every 20 retries) to avoid log spam
      if (retries % 20 === 0) {
        console.warn(`Redis connection retrying (attempt ${retries})... Ensure Redis is running.`);
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

client.on("error", (err) => {
  // Suppress ECONNREFUSED to avoid spamming console, handled by reconnectStrategy
  if (err.code !== "ECONNREFUSED") {
    console.error("Redis Client Error", err);
  }
});

(async () => {
  try {
    await client.connect();
    console.log("Redis Connected");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

module.exports = client;
