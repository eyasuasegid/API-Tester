const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws-logs" });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// WebSocket clients
const wsClients = new Set();
wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("close", () => wsClients.delete(ws));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Request logger middleware for /api/* routes
app.use("/api", (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseBody;

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };
  res.send = (body) => {
    if (!responseBody) responseBody = body;
    return originalSend(body);
  };

  res.on("finish", () => {
    const log = {
      id: Date.now() + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      responseBody,
    };
    console.log(`[${log.method}] ${log.path} → ${log.statusCode} (${log.duration}ms)`);
    broadcast({ type: "request", log });
  });

  next();
});

// ─── Demo API Endpoints ────────────────────────────────────────────────────
app.get("/api/demo", (req, res) => {
  res.json({
    message: "GET request received",
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/demo/:id", (req, res) => {
  res.json({
    message: `GET request for id: ${req.params.id}`,
    params: req.params,
    query: req.query,
    headers: req.headers,
  });
});

app.post("/api/demo", (req, res) => {
  res.status(201).json({
    message: "POST request received",
    body: req.body,
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
});

app.put("/api/demo/:id", (req, res) => {
  res.json({
    message: `PUT request for id: ${req.params.id}`,
    params: req.params,
    body: req.body,
    query: req.query,
    headers: req.headers,
  });
});

app.patch("/api/demo/:id", (req, res) => {
  res.json({
    message: `PATCH request for id: ${req.params.id}`,
    params: req.params,
    body: req.body,
    query: req.query,
    headers: req.headers,
  });
});

app.delete("/api/demo/:id", (req, res) => {
  res.json({
    message: `DELETE request for id: ${req.params.id}`,
    params: req.params,
    query: req.query,
    headers: req.headers,
    deleted: true,
  });
});

app.head("/api/demo", (req, res) => {
  res.set("X-Custom-Header", "head-response");
  res.set("X-Request-At", new Date().toISOString());
  res.status(200).end();
});

app.options("/api/demo", (req, res) => {
  res.set("Allow", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS");
  res.json({
    message: "OPTIONS request received",
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
  });
});

app.all("/api/echo", (req, res) => {
  res.json({
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
});

app.all("/api/status/:code", (req, res) => {
  const code = parseInt(req.params.code);
  if (code >= 100 && code <= 599) {
    res.status(code).json({
      status: code,
      message: `Responding with status ${code}`,
      body: req.body,
      query: req.query,
    });
  } else {
    res.status(400).json({ error: "Invalid status code" });
  }
});

app.all("/api/delay/:ms", async (req, res) => {
  const delay = Math.min(parseInt(req.params.ms) || 0, 10000);
  await new Promise((r) => setTimeout(r, delay));
  res.json({
    message: `Responded after ${delay}ms delay`,
    method: req.method,
    body: req.body,
    query: req.query,
  });
});

app.post("/api/__clear-logs", (req, res) => {
  broadcast({ type: "clear" });
  res.json({ cleared: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 API Tester running at http://localhost:${PORT}\n`);
  console.log("Available demo endpoints:");
  console.log("  GET    /api/demo");
  console.log("  GET    /api/demo/:id");
  console.log("  POST   /api/demo");
  console.log("  PUT    /api/demo/:id");
  console.log("  PATCH  /api/demo/:id");
  console.log("  DELETE /api/demo/:id");
  console.log("  ALL    /api/echo");
  console.log("  ALL    /api/status/:code");
  console.log("  ALL    /api/delay/:ms\n");
});
