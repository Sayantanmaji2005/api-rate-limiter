const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

let mongoClient = null;
let db = null;

async function connectDb() {
  if (db) return db;
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/api-rate-limiter";
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  db = mongoClient.db();
  return db;
}

let redisClient = null;
let redisConnected = false;

async function connectRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.SPRING_REDIS_URL;
  if (!redisUrl || redisUrl === 'memory') {
    return null;
  }
  if (redisClient && redisConnected) {
    return redisClient;
  }
  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    redisConnected = true;
    return redisClient;
  } catch (err) {
    console.error('Failed to connect to Redis, running memory fallback', err);
    return null;
  }
}

module.exports = {
  connectDb,
  connectRedis
};
