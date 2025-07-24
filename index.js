import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SELF_URL = "https://degendocdata.onrender.com/leaderboard/top14";
const API_KEY = "9emj7LErCZydUlTRZpHCuiWdn64atsNF";

// 🧠 Biweekly Start Date (UTC): July 21, 2025
const BASE_START = new Date(Date.UTC(2025, 6, 21, 0, 0, 0)); // Month is 0-indexed
const MS_IN_14_DAYS = 14 * 24 * 60 * 60 * 1000;

let cachedData = [];

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function maskUsername(username) {
  if (username.length <= 4) return username;
  return username.slice(0, 2) + "***" + username.slice(-2);
}

function getBiweeklyRange(offset = 0) {
  const now = new Date();
  const diff = now.getTime() - BASE_START.getTime();
  const periodIndex = Math.floor(diff / MS_IN_14_DAYS) + offset;

  const start = new Date(BASE_START.getTime() + periodIndex * MS_IN_14_DAYS);
  const end = new Date(start.getTime() + MS_IN_14_DAYS - 1);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  return { startStr, endStr };
}

async function fetchLeaderboard(offset = 0) {
  const { startStr, endStr } = getBiweeklyRange(offset);
  const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${startStr}&end_at=${endStr}&key=${API_KEY}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.affiliates) throw new Error("No data found");

  const sorted = json.affiliates.sort(
    (a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount)
  );

  const top10 = sorted.slice(0, 10);
  if (top10.length >= 2) [top10[0], top10[1]] = [top10[1], top10[0]];

  return top10.map(entry => ({
    username: maskUsername(entry.username),
    wagered: Math.round(parseFloat(entry.wagered_amount)),
    weightedWager: Math.round(parseFloat(entry.wagered_amount)),
  }));
}

// ⏱️ Fetch and cache current leaderboard every 5 mins
async function fetchAndCacheData() {
  try {
    const data = await fetchLeaderboard(0);
    cachedData = data;
    console.log(`[✅] Biweekly leaderboard updated`);
  } catch (err) {
    console.error("[❌] Failed to fetch biweekly data:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000);

// 🚀 Endpoints
app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedData);
});

app.get("/leaderboard/prev", async (req, res) => {
  try {
    const data = await fetchLeaderboard(-1);
    res.json(data);
  } catch (err) {
    console.error("[❌] Failed to fetch previous biweekly:", err.message);
    res.status(500).json({ error: "Failed to fetch previous leaderboard data." });
  }
});

// 🔁 Self-ping every 4.5 mins
setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch(err => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000);

app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
