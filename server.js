import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_CODE = process.env.ADMIN_CODE || "admin";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "game-state.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

function defaultState() {
  return {
    config: {
      title: "Customer Valuations Game",
      product: "Five-day all-inclusive premium yacht/cruise package",
      currency: "$",
      staticRound: "Static R1",
      dynamicRound: "Dynamic R1",
      postRound: "Postscreening R1",
      capacity: 10,
      cutoff: 1200,
      saleHorizonDays: 30,
      currentArrival: 1,
      activeRound: "Static R1",
      resultsVisible: false,
      acceptRejectVisible: true,
      valuationCollectionOpen: true,
      teamSubmissionsOpen: true,
    },
    teams: makeTeams(11),
    valuations: [],
    submissions: [],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTeams(count) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Team ${String(i + 1).padStart(2, "0")}`,
    pin: makePin(),
    members: "",
  }));
}

function makePin() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${digits}`;
}

let state = await loadState();

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    const fresh = defaultState();
    await saveState(fresh);
    return fresh;
  }
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

async function saveState(next = state) {
  next.updatedAt = new Date().toISOString();
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(next, null, 2));
}

function logEvent(type, detail = {}) {
  state.events.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type,
    detail,
  });
  state.events = state.events.slice(0, 200);
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(body);
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function adminOk(reqUrl) {
  return reqUrl.searchParams.get("code") === ADMIN_CODE;
}

function publicState() {
  const score = scoreGame();
  return {
    config: safeConfig(),
    teams: state.teams.map(({ id, name }) => ({ id, name })),
    valuationCount: state.valuations.length,
    scoreboard: state.config.resultsVisible ? score.scoreboard : [],
    currentArrival: currentArrivalPublic(),
  };
}

function safeConfig() {
  const { title, product, currency, activeRound, currentArrival, resultsVisible, acceptRejectVisible, valuationCollectionOpen, teamSubmissionsOpen, capacity, cutoff, saleHorizonDays } = state.config;
  return { title, product, currency, activeRound, currentArrival, resultsVisible, acceptRejectVisible, valuationCollectionOpen, teamSubmissionsOpen, capacity, cutoff, saleHorizonDays };
}

function teamState(team) {
  const score = scoreGame();
  const own = state.submissions.filter(s => s.teamId === team.id).slice(-40).reverse();
  const teamScore = score.scoreboard.find(row => row.teamId === team.id);
  return {
    config: safeConfig(),
    team: { id: team.id, name: team.name },
    submissions: own,
    ownScore: state.config.resultsVisible ? teamScore : null,
    scoreboard: state.config.resultsVisible ? score.scoreboard : [],
    currentArrival: currentArrivalPublic(),
  };
}

function adminState() {
  return {
    config: state.config,
    teams: state.teams,
    valuations: state.valuations,
    submissions: state.submissions.slice().reverse(),
    scores: scoreGame(),
    events: state.events,
    adminUrl: `http://${HOST}:${PORT}`,
  };
}

function currentArrivalPublic() {
  const arrival = state.valuations.find(v => v.arrival === Number(state.config.currentArrival));
  if (!arrival) return { arrival: Number(state.config.currentArrival), daysLeft: null, segment: null };
  return {
    arrival: arrival.arrival,
    daysLeft: daysLeft(arrival.arrival),
    segment: state.config.activeRound === state.config.postRound ? segmentFor(arrival.value) : null,
  };
}

function daysLeft(arrival) {
  const n = Math.max(1, state.valuations.length);
  return Math.max(0, Math.ceil(Number(state.config.saleHorizonDays || 30) * (n - arrival) / n));
}

function segmentFor(value) {
  return Number(value) < Number(state.config.cutoff) ? "Low" : "High";
}

function validValuations() {
  return state.valuations
    .filter(v => Number.isFinite(Number(v.value)))
    .map(v => ({ ...v, value: Number(v.value), arrival: Number(v.arrival) }))
    .sort((a, b) => a.arrival - b.arrival);
}

function latestSubmission(teamId, round, predicate = () => true) {
  return state.submissions
    .filter(s => s.teamId === teamId && s.round === round && predicate(s))
    .at(-1);
}

function latestDynamicPrice(teamId, arrival) {
  const sub = latestSubmission(teamId, state.config.dynamicRound, s => Number(s.arrival || 0) <= arrival && Number(s.dynamicPrice) > 0);
  return sub ? Number(sub.dynamicPrice) : null;
}

function scoreGame() {
  const valuations = validValuations();
  const staticResults = {};
  const dynamicResults = {};
  const postResults = {};
  const staticRows = [];
  const dynamicRows = [];
  const postRows = [];

  for (const team of state.teams) {
    const staticSub = latestSubmission(team.id, state.config.staticRound, s => Number(s.staticPrice) > 0);
    const staticPrice = staticSub ? Number(staticSub.staticPrice) : null;
    let staticRevenue = 0;
    let staticAccepts = 0;
    for (const v of valuations) {
      const accepted = staticPrice !== null && v.value >= staticPrice;
      if (accepted) {
        staticAccepts += 1;
        staticRevenue += staticPrice;
      }
      staticRows.push({ teamId: team.id, team: team.name, arrival: v.arrival, price: staticPrice, result: staticPrice === null ? "No price" : accepted ? "A" : "R" });
    }
    staticResults[team.id] = { price: staticPrice, revenue: staticRevenue, accepts: staticAccepts };

    let dynamicRevenue = 0;
    let dynamicAccepts = 0;
    for (const v of valuations) {
      const price = latestDynamicPrice(team.id, v.arrival);
      const accepted = price !== null && v.value >= price;
      if (accepted) {
        dynamicAccepts += 1;
        dynamicRevenue += price;
      }
      dynamicRows.push({ teamId: team.id, team: team.name, arrival: v.arrival, price, result: price === null ? "No price" : accepted ? "A" : "R" });
    }
    dynamicResults[team.id] = { revenue: dynamicRevenue, accepts: dynamicAccepts };

    const postSub = latestSubmission(team.id, state.config.postRound, s => Number(s.lowPrice) > 0 && Number(s.highPrice) > 0 && Number.isFinite(Number(s.lowLimit)));
    const lowPrice = postSub ? Number(postSub.lowPrice) : null;
    const highPrice = postSub ? Number(postSub.highPrice) : null;
    const lowLimit = postSub ? Math.max(0, Math.floor(Number(postSub.lowLimit))) : null;
    let sold = 0;
    let lowSold = 0;
    let postRevenue = 0;
    let postAccepts = 0;
    for (const v of valuations) {
      const segment = segmentFor(v.value);
      const price = segment === "Low" ? lowPrice : highPrice;
      let result = "No price";
      if (price !== null) {
        if (sold >= Number(state.config.capacity)) result = "Full";
        else if (segment === "Low" && lowSold >= lowLimit) result = "Closed";
        else if (v.value >= price) {
          result = "A";
          sold += 1;
          postAccepts += 1;
          postRevenue += price;
          if (segment === "Low") lowSold += 1;
        } else {
          result = "R";
        }
      }
      postRows.push({ teamId: team.id, team: team.name, arrival: v.arrival, segment, price, result, sold });
    }
    postResults[team.id] = { lowPrice, highPrice, lowLimit, revenue: postRevenue, accepts: postAccepts, sold, lowSold };
  }

  const scoreboard = state.teams.map(team => {
    const s = staticResults[team.id];
    const d = dynamicResults[team.id];
    const p = postResults[team.id];
    return {
      teamId: team.id,
      team: team.name,
      staticRevenue: s.revenue,
      dynamicRevenue: d.revenue,
      postRevenue: p.revenue,
      totalRevenue: s.revenue + d.revenue + p.revenue,
      staticAccepts: s.accepts,
      dynamicAccepts: d.accepts,
      postAccepts: p.accepts,
      postSold: p.sold,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return { scoreboard, staticResults, dynamicResults, postResults, staticRows, dynamicRows, postRows };
}

function requireTeam(payload) {
  const team = state.teams.find(t => t.id === payload.teamId || t.name.toLowerCase() === String(payload.teamName || "").toLowerCase());
  if (!team || team.pin !== payload.pin) return null;
  return team;
}

function requireParticipant(payload) {
  const team = requireTeam(payload);
  if (team) return team;
  const studentName = String(payload.student || payload.studentName || "").trim().toLowerCase();
  if (!studentName) return null;
  const student = state.valuations.find(v => v.student.toLowerCase() === studentName);
  if (!student?.teamName) return null;
  return state.teams.find(t => t.name === student.teamName) || null;
}

function parseCsvRows(csv) {
  return csv.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(",").map(cell => cell.trim()));
}

function exportCsv() {
  const score = scoreGame();
  const rows = [
    ["Team", "Static Revenue", "Dynamic Revenue", "Postscreening Revenue", "Total Revenue", "Static Accepts", "Dynamic Accepts", "Postscreening Accepts", "Postscreening Sold"],
    ...score.scoreboard.map(r => [r.team, r.staticRevenue, r.dynamicRevenue, r.postRevenue, r.totalRevenue, r.staticAccepts, r.dynamicAccepts, r.postAccepts, r.postSold]),
    [],
    ["Submissions"],
    ["Timestamp", "Team", "Round", "Arrival", "Static Price", "Dynamic Price", "Low Price", "High Price", "Low Limit", "Notes"],
    ...state.submissions.map(s => [s.at, s.teamName, s.round, s.arrival ?? "", s.staticPrice ?? "", s.dynamicPrice ?? "", s.lowPrice ?? "", s.highPrice ?? "", s.lowLimit ?? "", s.notes ?? ""]),
  ];
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}

async function handleApi(req, res, reqUrl) {
  if (req.method === "GET" && reqUrl.pathname === "/api/public") return json(res, 200, publicState());

  if (req.method === "POST" && reqUrl.pathname === "/api/team/login") {
    const payload = await body(req);
    const team = requireTeam(payload);
    if (!team) return json(res, 401, { error: "Team name/PIN not recognized." });
    return json(res, 200, teamState(team));
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/student/login") {
    const payload = await body(req);
    const student = String(payload.student || "").trim().slice(0, 120);
    if (!student) return json(res, 400, { error: "Enter your name." });
    const valueProvided = payload.value !== undefined && payload.value !== "";
    const value = Number(payload.value);
    let record = state.valuations.find(v => v.student.toLowerCase() === student.toLowerCase());
    if (valueProvided) {
      if (!Number.isFinite(value) || value < 0) return json(res, 400, { error: "Enter a non-negative numeric valuation." });
      if (!state.config.valuationCollectionOpen && !record) return json(res, 403, { error: "Valuation collection is currently closed." });
      if (record) {
        record.at = new Date().toISOString();
        record.mode = String(payload.mode || record.mode || "").slice(0, 60);
        record.value = value;
      } else {
        record = {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          arrival: state.valuations.length + 1,
          student,
          mode: String(payload.mode || "").slice(0, 60),
          teamName: "",
          value,
        };
        state.valuations.push(record);
      }
      logEvent("student-check-in", { student: record.student, arrival: record.arrival });
      await saveState();
    }
    if (!record) return json(res, 404, { error: "Name not found. Submit your valuation first." });
    if (!record.teamName) {
      return json(res, 200, {
        assigned: false,
        student: record,
        config: safeConfig(),
        message: "You are checked in. Please wait for the instructor to assign teams.",
      });
    }
    const team = state.teams.find(t => t.name === record.teamName);
    if (!team) return json(res, 409, { error: "Your assigned team is no longer available. Ask the instructor to reassign teams." });
    return json(res, 200, { ...teamState(team), assigned: true, student: record });
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/team/submit") {
    if (!state.config.teamSubmissionsOpen) return json(res, 403, { error: "Team submissions are currently closed." });
    const payload = await body(req);
    const team = requireParticipant(payload);
    if (!team) return json(res, 401, { error: "Team not recognized. Enter your checked-in name after teams have been assigned." });
    const sub = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      teamId: team.id,
      teamName: team.name,
      round: payload.round || state.config.activeRound,
      arrival: payload.arrival === "" ? null : Number(payload.arrival || state.config.currentArrival),
      staticPrice: payload.staticPrice === "" ? null : Number(payload.staticPrice),
      dynamicPrice: payload.dynamicPrice === "" ? null : Number(payload.dynamicPrice),
      lowPrice: payload.lowPrice === "" ? null : Number(payload.lowPrice),
      highPrice: payload.highPrice === "" ? null : Number(payload.highPrice),
      lowLimit: payload.lowLimit === "" ? null : Number(payload.lowLimit),
      notes: String(payload.notes || "").slice(0, 500),
    };
    state.submissions.push(sub);
    logEvent("team-submission", { team: team.name, round: sub.round, arrival: sub.arrival });
    await saveState();
    return json(res, 200, teamState(team));
  }

  if (req.method === "POST" && reqUrl.pathname === "/api/valuation") {
    if (!state.config.valuationCollectionOpen) return json(res, 403, { error: "Valuation collection is currently closed." });
    const payload = await body(req);
    const value = Number(payload.value);
    if (!Number.isFinite(value) || value < 0) return json(res, 400, { error: "Enter a non-negative numeric valuation." });
    const student = String(payload.student || `Student ${state.valuations.length + 1}`).trim().slice(0, 120);
    const existing = state.valuations.find(v => v.student.toLowerCase() === student.toLowerCase());
    if (existing) {
      existing.at = new Date().toISOString();
      existing.mode = String(payload.mode || existing.mode || "").slice(0, 60);
      existing.value = value;
      logEvent("valuation-updated", { student: existing.student, arrival: existing.arrival });
    } else {
      const valuation = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        arrival: state.valuations.length + 1,
        student,
        mode: String(payload.mode || "").slice(0, 60),
        teamName: "",
        value,
      };
      state.valuations.push(valuation);
      logEvent("valuation-added", { student: valuation.student, arrival: valuation.arrival });
    }
    await saveState();
    return json(res, 200, { ok: true, valuationCount: state.valuations.length });
  }

  if (reqUrl.pathname.startsWith("/api/admin")) {
    if (!adminOk(reqUrl)) return json(res, 401, { error: "Invalid instructor code." });

    if (req.method === "GET" && reqUrl.pathname === "/api/admin/state") return json(res, 200, adminState());
    if (req.method === "GET" && reqUrl.pathname === "/api/admin/export.csv") return text(res, 200, exportCsv(), "text/csv; charset=utf-8");

    const payload = await body(req);

    if (req.method === "POST" && reqUrl.pathname === "/api/admin/config") {
      state.config = { ...state.config, ...payload };
      for (const key of ["capacity", "cutoff", "saleHorizonDays", "currentArrival"]) state.config[key] = Number(state.config[key]);
      logEvent("config-updated");
      await saveState();
      return json(res, 200, adminState());
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/admin/teams") {
      if (payload.regenerate) state.teams = makeTeams(Number(payload.count || state.teams.length));
      else if (Array.isArray(payload.teams)) state.teams = payload.teams.map(t => ({ id: t.id || crypto.randomUUID(), name: t.name, pin: t.pin || makePin(), members: t.members || "" }));
      logEvent("teams-updated", { count: state.teams.length });
      await saveState();
      return json(res, 200, adminState());
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/admin/valuations") {
      if (payload.action === "clear") state.valuations = [];
      if (payload.action === "shuffle") {
        state.valuations = state.valuations
          .map(v => ({ v, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map((x, i) => ({ ...x.v, arrival: i + 1 }));
      }
      if (payload.action === "randomAssign") {
        const shuffled = state.valuations
          .map(v => ({ v, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map(x => x.v);
        const teams = state.teams.map(t => ({ ...t, members: "" }));
        shuffled.forEach((student, i) => {
          const team = teams[i % teams.length];
          student.teamName = team.name;
        });
        for (const team of teams) {
          team.members = shuffled
            .filter(v => v.teamName === team.name)
            .map(v => v.student)
            .join(", ");
        }
        state.teams = teams;
      }
      if (payload.action === "import") {
        const rows = parseCsvRows(String(payload.csv || ""));
        const imported = rows
          .filter(row => Number.isFinite(Number(row.at(-1))))
          .map((row, i) => ({
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            arrival: state.valuations.length + i + 1,
            student: row[0] || `Imported ${i + 1}`,
            mode: row[1] || "",
            teamName: row.length > 2 ? row[2] : "",
            value: Number(row.at(-1)),
          }));
        state.valuations.push(...imported);
      }
      logEvent("valuations-updated", { action: payload.action, count: state.valuations.length });
      await saveState();
      return json(res, 200, adminState());
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/admin/reset") {
      if (payload.target === "submissions") state.submissions = [];
      if (payload.target === "all") state = defaultState();
      logEvent("reset", { target: payload.target });
      await saveState();
      return json(res, 200, adminState());
    }
  }

  return json(res, 404, { error: "Not found" });
}

function serveStatic(req, res, reqUrl) {
  const routePath = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, routePath));
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file)) return text(res, 404, "Not found");
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    if (reqUrl.pathname.startsWith("/api/")) return await handleApi(req, res, reqUrl);
    return serveStatic(req, res, reqUrl);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Customer Valuations Game running at http://${HOST}:${PORT}`);
  console.log(`Instructor code: ${ADMIN_CODE}`);
});
