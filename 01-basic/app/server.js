const http = require("http");
const os = require("os");

const PORT = process.env.PORT || 3000;
const MESSAGE = process.env.MESSAGE || "Hello from Node.js (default)";
const VERSION = process.env.VERSION || "0";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      {
        message: MESSAGE,
        hostname: os.hostname(),
        version: VERSION,
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
