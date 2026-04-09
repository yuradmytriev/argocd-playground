const http = require("http");

const PORT = process.env.PORT || 8080;
const UPSTREAM = process.env.UPSTREAM || "http://localhost:3000";

// --- WAF Rules ---

const BLOCKED_PATTERNS = [
  // SQL injection
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)/i,
  /(';\s*--)/,
  /(\bOR\b\s+1\s*=\s*1)/i,

  // XSS
  /<script[\s>]/i,
  /javascript:/i,
  /on(load|error|click|mouseover)\s*=/i,

  // Path traversal
  /\.\.\//,
  /\.\.%2[fF]/,

  // Command injection
  /[;&|`$]\s*(cat|ls|rm|wget|curl|bash|sh|nc)\b/,
];

const BLOCKED_HEADERS = ["x-forwarded-host"];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;
const rateCounts = new Map();

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
}

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateCounts.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateCounts.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function checkWafRules(req) {
  const ip = getClientIp(req);

  // Rate limiting
  if (isRateLimited(ip)) {
    return { blocked: true, status: 429, reason: "rate_limit_exceeded" };
  }

  // Check URL + query string
  const fullUrl = req.url;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(decodeURIComponent(fullUrl))) {
      return { blocked: true, status: 403, reason: "blocked_by_waf", pattern: pattern.source };
    }
  }

  // Check blocked headers
  for (const header of BLOCKED_HEADERS) {
    if (req.headers[header]) {
      return { blocked: true, status: 403, reason: "blocked_header", header };
    }
  }

  // Check body-bearing methods for patterns (buffered in proxy)
  return { blocked: false };
}

function proxyRequest(req, res, body) {
  const url = new URL(req.url, UPSTREAM);
  const proxyReq = http.request(
    url,
    {
      method: req.method,
      headers: {
        ...req.headers,
        "x-waf-inspected": "true",
        "x-real-ip": getClientIp(req),
        host: url.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    console.error("Upstream error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "bad_gateway", detail: err.message }));
  });

  if (body) {
    proxyReq.end(body);
  } else {
    req.pipe(proxyReq);
  }
}

const server = http.createServer((req, res) => {
  // Health check endpoint for the WAF itself
  if (req.url === "/waf/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "waf" }));
    return;
  }

  const result = checkWafRules(req);

  if (result.blocked) {
    console.log(`[WAF] BLOCKED ${req.method} ${req.url} — ${result.reason}`);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: result.reason,
        blocked: true,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // For POST/PUT/PATCH — buffer body to inspect it
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const bodyStr = body.toString();

      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(bodyStr)) {
          console.log(`[WAF] BLOCKED ${req.method} ${req.url} body — ${pattern.source}`);
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "blocked_by_waf",
              blocked: true,
              timestamp: new Date().toISOString(),
            }),
          );
          return;
        }
      }

      proxyRequest(req, res, body);
    });
    return;
  }

  proxyRequest(req, res);
});

// Cleanup stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateCounts) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS) rateCounts.delete(ip);
  }
}, 300_000);

server.listen(PORT, () => {
  console.log(`[WAF] Listening on :${PORT}, proxying to ${UPSTREAM}`);
});
