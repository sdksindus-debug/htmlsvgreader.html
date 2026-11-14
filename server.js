const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3000;
const DB_FILE = path.join(__dirname, "blockchain-db.json");
const HTML_FILE = path.join(__dirname, "index.html");

// Initialize separate database file if it does not exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ chain: [] }, null, 2), "utf8");
}

function getLocalLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { chain: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

const server = http.createServer((req, res) => {
  // Enable CORS so any device on the LAN can connect via IP
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Serve the HTML interface over LAN
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    if (!fs.existsSync(HTML_FILE)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("index.html not found in the same folder as server.js");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(fs.readFileSync(HTML_FILE, "utf8"));
  }

  // GET /api/chain -> Fetch full ledger from separate database
  if (req.method === "GET" && req.url === "/api/chain") {
    const db = readDB();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(db));
  }

  // POST /api/block -> Save a newly mined/hashed block to the database
  if (req.method === "POST" && req.url === "/api/block") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const newBlock = JSON.parse(body);
        const db = readDB();

        // Prevent duplicate index overwrite
        if (db.chain.length === newBlock.index) {
          db.chain.push(newBlock);
          writeDB(db);
        } else if (newBlock.index === 0 && db.chain.length === 0) {
          db.chain = [newBlock];
          writeDB(db);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "saved", chain: db.chain }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/restore -> Overwrite database from uploaded ledger file or reset
  if (req.method === "POST" && req.url === "/api/restore") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        if (!Array.isArray(payload.chain)) {
          throw new Error("Invalid chain array.");
        }
        writeDB({ updatedAt: new Date().toISOString(), chain: payload.chain });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "restored", chain: payload.chain }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

const LAN_IP = getLocalLanIP();
server.listen(PORT, "0.0.0.0", () => {
  console.log("====================================================");
  console.log(" LAN Multimedia Blockchain & Database Node Running");
  console.log(` Localhost URL : http://localhost:${PORT}`);
  console.log(` LAN IP URL    : http://${LAN_IP}:${PORT}`);
  console.log(` Database File : ${DB_FILE}`);
  console.log("====================================================");
});
