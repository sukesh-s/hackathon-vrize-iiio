const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const audioRoutes = require("./routes/audio");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const port = Number(process.env.PORT || 8894);

const uploadsDir = path.resolve(__dirname, "../tmp/uploads");
const outputsDir = path.resolve(__dirname, "../tmp/outputs");

for (const dirPath of [uploadsDir, outputsDir]) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/audio", audioRoutes);
app.use("/dashboard", dashboardRoutes);

app.listen(port, () => {
  console.log(`Node audio service listening on http://localhost:${port}`);
});
