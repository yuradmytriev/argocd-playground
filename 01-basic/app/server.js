const http = require("http");
const os = require("os");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      {
        message: "Hello from Node.js on ArgoCD!",
        hostname: os.hostname(),
        version: 1,
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
