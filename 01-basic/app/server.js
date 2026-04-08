const http = require("http");
const os = require("os");
const Redis = require("ioredis");

const PORT = process.env.PORT || 3000;
const MESSAGE = process.env.MESSAGE || "Hello from Node.js";
const VERSION = process.env.VERSION || "0";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const API_KEY = process.env.API_KEY || "";

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => console.error("Redis error:", err.message));

const server = http.createServer(async (req, res) => {
  // Protected admin endpoint: requires x-api-key header matching the Secret.
  if (req.url === "/admin") {
    const provided = req.headers["x-api-key"];
    if (!provided || provided !== API_KEY) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    let hits = null;
    try {
      hits = await redis.get("hits");
    } catch (err) {
      // ignore
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        {
          admin: true,
          hostname: os.hostname(),
          hits,
          apiKeyLength: API_KEY.length,
          uptimeSeconds: Math.round(process.uptime()),
        },
        null,
        2,
      ),
    );
    return;
  }

  // Public endpoint
  let hits = null;
  let redisError = null;

  try {
    hits = await redis.incr("hits");
  } catch (err) {
    redisError = err.message;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      {
        message: MESSAGE,
        hostname: os.hostname(),
        version: VERSION,
        hits,
        redisError,
        path: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
});

server.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
