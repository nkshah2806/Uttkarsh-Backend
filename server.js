require("dotenv").config();

const express = require("express");
const app = express();

const DEFAULT_PORT = 5000;
let port = Number(process.env.PORT) || DEFAULT_PORT;

app.get("/", (req, res) => {
  res.send("hello backend");
});

function startServer(p) {
  const server = app.listen(p, () => {
    console.log(`Server running on port ${p}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      const nextPort = p + 1;
      console.warn(`Port ${p} in use — trying ${nextPort}`);
      // Try next port once
      startServer(nextPort);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

startServer(port);