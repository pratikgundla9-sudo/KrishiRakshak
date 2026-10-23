/**
 * ========================================================================================
 * KrishiRakshak — ALL-IN-ONE UNIFIED SERVER (Frontend + Backend + WebSockets)
 * ========================================================================================
 * Serves the full-stack React Command Center, real-time Socket.IO telemetry bridge,
 * and REST orchestration API on a SINGLE unified port (Default: 5000).
 *
 * Capabilities:
 *  1. Serves compiled React + Leaflet production frontend from ./dist
 *  2. Ingests unified rover telemetry at POST /api/telemetry
 *  3. Exposes historical interventions at GET /api/history
 *  4. Relays manual operator drive & actuator overrides at POST /api/manual-control
 *  5. Broadcasts real-time events over Socket.IO to connected browsers
 *  6. Client-side SPA routing fallback to ./dist/index.html
 * ========================================================================================
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const ESP32_BASE_URL = process.env.ESP32_URL || 'http://192.168.4.1';
const DIST_PATH = path.join(__dirname, 'dist');

// Preloaded foliar anomaly image library for instant map popup rendering
let sampleImages = {};
try {
  const imgPath = path.join(__dirname, 'sample_images.json');
  if (fs.existsSync(imgPath)) {
    sampleImages = JSON.parse(fs.readFileSync(imgPath, 'utf8'));
    console.log(`[INIT] Loaded ${Object.keys(sampleImages).length} foliar snapshot reference patterns.`);
  }
} catch (e) {
  console.log('[INIT] Notice: sample_images.json could not be loaded:', e.message);
}

const app = express();
const server = http.createServer(app);

// Socket.IO with permissive CORS for external clients
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Support base64 image snapshots

// Serve compiled static frontend assets
app.use(express.static(DIST_PATH));

// ========================================================================================
// IN-MEMORY TELEMETRY STORE (Seed Data with High Agronomic Realism)
// ========================================================================================
const telemetryHistory = [
  {
    id: "ROV-849102",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    state: "ACTION_COMPLETED",
    gps: { latitude: 18.524560, longitude: 73.858220, accuracy: 1.8, altitude: 562.4 },
    visual: { detected_class: "yellow_leaves", confidence: 88.5, bbox: [160, 120, 480, 360] },
    soil: { moisture: 22.4, temperature: 26.8, ec: 1240, ph: 6.82, nitrogen: 48, phosphorus: 36, potassium: 180 },
    correlation: {
      diagnosis: "Water Stress (Leaf chlorosis + sub-30% VWC soil moisture)",
      action_taken: "Triggered Pump 1 (Irrigation Water) for 4.0 seconds",
      pump_triggered: 1,
      pump_duration_sec: 4,
      marker_color: "yellow"
    },
    image_data: sampleImages["yellow_leaves"] || null
  },
  {
    id: "ROV-849208",
    timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
    state: "ACTION_COMPLETED",
    gps: { latitude: 18.524710, longitude: 73.858340, accuracy: 1.6, altitude: 562.8 },
    visual: { detected_class: "yellow_leaves", confidence: 91.2, bbox: [140, 100, 500, 380] },
    soil: { moisture: 42.1, temperature: 25.1, ec: 1120, ph: 7.15, nitrogen: 18, phosphorus: 32, potassium: 165 },
    correlation: {
      diagnosis: "Nitrogen Deficiency (Interveinal chlorosis + sub-25mg/kg Nitrogen)",
      action_taken: "Triggered Pump 2 (Liquid Fertilizer) for 3.0 seconds",
      pump_triggered: 2,
      pump_duration_sec: 3,
      marker_color: "orange"
    },
    image_data: sampleImages["nitrogen_deficiency"] || null
  },
  {
    id: "ROV-849315",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    state: "ACTION_COMPLETED",
    gps: { latitude: 18.524880, longitude: 73.858480, accuracy: 2.1, altitude: 563.1 },
    visual: { detected_class: "disease_spots", confidence: 94.0, bbox: [180, 140, 460, 340] },
    soil: { moisture: 46.5, temperature: 24.3, ec: 1280, ph: 6.45, nitrogen: 52, phosphorus: 38, potassium: 195 },
    correlation: {
      diagnosis: "Fungal / Bacterial Blight Lesions detected",
      action_taken: "NO AUTO SPRAY — Logged high-priority farmer alert on dashboard",
      pump_triggered: null,
      pump_duration_sec: 0,
      marker_color: "red"
    },
    image_data: sampleImages["disease_spots"] || null
  }
];

// Current rover live status tracker
let currentRoverState = {
  status: "MOVING", // 'MOVING' | 'STOPPED_INSPECTING' | 'ACTION_COMPLETED'
  motion: "FORWARD",
  currentGps: { latitude: 18.524950, longitude: 73.858540, accuracy: 1.5, timestamp: Date.now() },
  lastEventId: "ROV-849315",
  activePump: null,
  pumpRemainingSec: 0,
  probePosition: "UP",
  esp32Connected: false,
  totalInterventions: telemetryHistory.length
};

let lastExternalTelemetryTime = 0;

// ========================================================================================
// REST API ROUTES
// ========================================================================================

/**
 * POST /api/telemetry
 * Ingests unified rover event compiled by smartphone_agent.py
 */
app.post('/api/telemetry', (req, res) => {
  const payload = req.body;

  if (!payload || !payload.id || !payload.gps || !payload.visual || !payload.soil || !payload.correlation) {
    return res.status(400).json({ error: "Invalid telemetry payload structure. Missing required sub-objects." });
  }

  // Record in chronological history
  lastExternalTelemetryTime = Date.now();
  telemetryHistory.unshift(payload);
  currentRoverState.lastEventId = payload.id;
  currentRoverState.currentGps = payload.gps;
  currentRoverState.totalInterventions = telemetryHistory.length;
  currentRoverState.status = payload.state || "ACTION_COMPLETED";

  if (payload.correlation && payload.correlation.pump_triggered) {
    currentRoverState.activePump = payload.correlation.pump_triggered;
    currentRoverState.pumpRemainingSec = payload.correlation.pump_duration_sec || 3;
  }

  // Broadcast to all connected Web Command Dashboards via WebSocket
  io.emit('ROVER_TELEMETRY', payload);
  io.emit('ROVER_STATE_CHANGE', {
    state: currentRoverState.status,
    gps: currentRoverState.currentGps,
    activePump: currentRoverState.activePump,
    pumpRemainingSec: currentRoverState.pumpRemainingSec,
    totalInterventions: currentRoverState.totalInterventions
  });

  console.log(`[TELEMETRY INGESTED] ID: ${payload.id} | Class: ${payload.visual.detected_class} | Diagnosis: ${payload.correlation.diagnosis}`);

  return res.status(200).json({
    success: true,
    message: "Telemetry processed and broadcasted successfully.",
    id: payload.id
  });
});

/**
 * GET /api/history
 * Returns historical intervention points for continuous field mapping
 */
app.get('/api/history', (req, res) => {
  return res.status(200).json({
    total: telemetryHistory.length,
    events: telemetryHistory,
    currentState: currentRoverState
  });
});

/**
 * POST /api/manual-control
 * Relay override endpoint from Web Dashboard to ESP32
 */
app.post('/api/manual-control', async (req, res) => {
  const { command, pumpId, durationSec } = req.body;
  console.log(`[MANUAL OVERRIDE] Received command: '${command}' (Pump: ${pumpId}, Duration: ${durationSec}s)`);

  let esp32Url = null;
  if (command === 'stop') {
    esp32Url = `${ESP32_BASE_URL}/stop`;
    currentRoverState.status = "STOPPED_INSPECTING";
    currentRoverState.motion = "STOPPED";
  } else if (command === 'resume' || command === 'forward') {
    esp32Url = `${ESP32_BASE_URL}/forward`;
    currentRoverState.status = "MOVING";
    currentRoverState.motion = "FORWARD";
  } else if (command === 'backward') {
    esp32Url = `${ESP32_BASE_URL}/backward`;
    currentRoverState.status = "MOVING";
    currentRoverState.motion = "BACKWARD";
  } else if (command === 'left') {
    esp32Url = `${ESP32_BASE_URL}/left`;
    currentRoverState.status = "MOVING";
    currentRoverState.motion = "TURNING_LEFT";
  } else if (command === 'right') {
    esp32Url = `${ESP32_BASE_URL}/right`;
    currentRoverState.status = "MOVING";
    currentRoverState.motion = "TURNING_RIGHT";
  } else if (command === 'probe_down') {
    esp32Url = `${ESP32_BASE_URL}/probe?action=down`;
    currentRoverState.probePosition = "DOWN";
  } else if (command === 'probe_up') {
    esp32Url = `${ESP32_BASE_URL}/probe?action=up`;
    currentRoverState.probePosition = "UP";
  } else if (command === 'pump') {
    esp32Url = `${ESP32_BASE_URL}/pump?id=${pumpId}&duration=${durationSec}`;
    currentRoverState.activePump = pumpId;
    currentRoverState.pumpRemainingSec = durationSec;
  } else if (command === 'pump1_off' || command === 'pump2_off') {
    const pId = command === 'pump1_off' ? 1 : 2;
    esp32Url = `${ESP32_BASE_URL}/pump?id=${pId}&duration=0`;
    if (currentRoverState.activePump === pId) {
      currentRoverState.activePump = null;
      currentRoverState.pumpRemainingSec = 0;
    }
  }

  // Forward to physical ESP32 if available
  let esp32Acknowledged = false;
  if (esp32Url) {
    try {
      const resp = await fetch(esp32Url, { method: 'GET', signal: AbortSignal.timeout(1500) });
      esp32Acknowledged = resp.ok;
    } catch {
      esp32Acknowledged = false;
    }
  }

  // Broadcast state change to all dashboards
  io.emit('MANUAL_OVERRIDE', {
    command,
    pumpId,
    durationSec,
    esp32Acknowledged,
    state: currentRoverState.status,
    motion: currentRoverState.motion,
    probePosition: currentRoverState.probePosition,
    timestamp: Date.now()
  });

  return res.status(200).json({
    success: true,
    command,
    esp32Acknowledged,
    simulated: !esp32Acknowledged,
    currentState: currentRoverState
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    service: "KrishiRakshak All-in-One Rover Command Server",
    status: "HEALTHY",
    uptime_sec: Math.floor(process.uptime()),
    connected_clients: io.engine.clientsCount
  });
});

// ========================================================================================
// CLIENT-SIDE SPA ROUTING FALLBACK
// ========================================================================================
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    return res.sendFile(path.join(DIST_PATH, 'index.html'));
  }
  next();
});

// ========================================================================================
// WEBSOCKET CLIENT CONNECTION HANDLING
// ========================================================================================
io.on('connection', (socket) => {
  console.log(`[WEBSOCKET] Client connected. Socket ID: ${socket.id} (Total: ${io.engine.clientsCount})`);

  socket.emit('ROVER_INIT', {
    currentState: currentRoverState,
    history: telemetryHistory
  });

  socket.on('disconnect', () => {
    console.log(`[WEBSOCKET] Client disconnected: ${socket.id}`);
  });
});

// Periodic Heartbeat & Pump Countdown Timer
setInterval(() => {
  if (currentRoverState.activePump && currentRoverState.pumpRemainingSec > 0) {
    currentRoverState.pumpRemainingSec -= 1;
    if (currentRoverState.pumpRemainingSec <= 0) {
      currentRoverState.activePump = null;
    }
    io.emit('PUMP_TICK', {
      activePump: currentRoverState.activePump,
      remainingSec: currentRoverState.pumpRemainingSec
    });
  }
}, 1000);

// ========================================================================================
// AUTONOMOUS ROVER FURROW NAVIGATION & AG-SIMULATION LOOP
// ========================================================================================
// 1. Smooth furrow locomotion update (every 2.5s)
setInterval(() => {
  if (currentRoverState.status === "MOVING") {
    // Advance coordinates along furrow
    currentRoverState.currentGps.latitude = +(currentRoverState.currentGps.latitude + 0.000008).toFixed(6);
    currentRoverState.currentGps.longitude = +(currentRoverState.currentGps.longitude + (Math.random() - 0.48) * 0.000003).toFixed(6);
    currentRoverState.currentGps.timestamp = Date.now();

    io.emit('ROVER_STATE_CHANGE', {
      state: currentRoverState.status,
      gps: currentRoverState.currentGps,
      activePump: currentRoverState.activePump,
      pumpRemainingSec: currentRoverState.pumpRemainingSec,
      totalInterventions: currentRoverState.totalInterventions
    });
  }
}, 2500);

// 2. Autonomous field inspection sequence if no external edge client is connected
let autoSimStep = 0;
setInterval(() => {
  // If smartphone edge agent is posting telemetry, yield to edge client
  if (Date.now() - lastExternalTelemetryTime < 45000) return;
  if (currentRoverState.status !== "MOVING") return;

  autoSimStep++;
  const scenarioType = autoSimStep % 4;

  let visualClass = "yellow_leaves";
  let confidence = 89.4;
  let soil = { moisture: 21.5, temperature: 26.2, ec: 1210, ph: 6.80, nitrogen: 50, phosphorus: 35, potassium: 175 };
  let diagnosis = "Water Stress (Leaf chlorosis + sub-30% VWC soil moisture)";
  let actionTaken = "Triggered Pump 1 (Irrigation Water) for 4.0 seconds";
  let pumpId = 1;
  let pumpDuration = 4;
  let markerColor = "yellow";
  let imgKey = "yellow_leaves";

  if (scenarioType === 1) {
    visualClass = "yellow_leaves";
    confidence = 92.1;
    soil = { moisture: 41.2, temperature: 25.4, ec: 1140, ph: 7.10, nitrogen: 17, phosphorus: 30, potassium: 160 };
    diagnosis = "Nitrogen Deficiency (Interveinal chlorosis + sub-25mg/kg Nitrogen)";
    actionTaken = "Triggered Pump 2 (Liquid Fertilizer) for 3.0 seconds";
    pumpId = 2;
    pumpDuration = 3;
    markerColor = "orange";
    imgKey = "nitrogen_deficiency";
  } else if (scenarioType === 2) {
    visualClass = "disease_spots";
    confidence = 95.0;
    soil = { moisture: 47.0, temperature: 24.1, ec: 1290, ph: 6.50, nitrogen: 54, phosphorus: 39, potassium: 190 };
    diagnosis = "Fungal / Bacterial Blight Lesions detected";
    actionTaken = "NO AUTO SPRAY — Logged high-priority farmer alert on dashboard";
    pumpId = null;
    pumpDuration = 0;
    markerColor = "red";
    imgKey = "disease_spots";
  } else if (scenarioType === 3) {
    visualClass = "pest_holes";
    confidence = 88.0;
    soil = { moisture: 38.5, temperature: 25.0, ec: 1180, ph: 6.70, nitrogen: 46, phosphorus: 34, potassium: 180 };
    diagnosis = "Pest / Insect Chewing Damage detected";
    actionTaken = "NO AUTO SPRAY — Flagged sector for targeted organic repellent";
    pumpId = null;
    pumpDuration = 0;
    markerColor = "red";
    imgKey = "pest_holes";
  }

  // Phase A: Anomaly detected! Halt rover & Deploy NPK probe down
  currentRoverState.status = "STOPPED_INSPECTING";
  currentRoverState.probePosition = "DOWN";
  io.emit('ROVER_STATE_CHANGE', {
    state: currentRoverState.status,
    gps: currentRoverState.currentGps,
    probePosition: currentRoverState.probePosition
  });
  console.log(`[AUTONOMOUS SIM] Anomaly detected: ${visualClass}. Rover halted and probe lowered.`);

  // Phase B: After 2.5s probe insertion -> In-situ Soil Correlation & Actuation
  setTimeout(() => {
    const eventId = `ROV-${Math.floor(100000 + Math.random() * 900000)}`;
    const eventPayload = {
      id: eventId,
      timestamp: new Date().toISOString(),
      state: "ACTION_COMPLETED",
      gps: { ...currentRoverState.currentGps },
      visual: {
        detected_class: visualClass,
        confidence,
        bbox: [160, 120, 480, 360]
      },
      soil,
      correlation: {
        diagnosis,
        action_taken: actionTaken,
        pump_triggered: pumpId,
        pump_duration_sec: pumpDuration,
        marker_color: markerColor
      },
      image_data: sampleImages[imgKey] || null
    };

    telemetryHistory.unshift(eventPayload);
    currentRoverState.lastEventId = eventId;
    currentRoverState.status = "ACTION_COMPLETED";
    currentRoverState.totalInterventions = telemetryHistory.length;
    currentRoverState.activePump = pumpId;
    currentRoverState.pumpRemainingSec = pumpDuration;

    io.emit('ROVER_TELEMETRY', eventPayload);
    io.emit('ROVER_STATE_CHANGE', {
      state: currentRoverState.status,
      gps: currentRoverState.currentGps,
      activePump: currentRoverState.activePump,
      pumpRemainingSec: currentRoverState.pumpRemainingSec,
      totalInterventions: currentRoverState.totalInterventions
    });
    console.log(`[AUTONOMOUS SIM] Soil correlated: ${diagnosis}. Action: ${actionTaken}`);

    // Phase C: Retract probe up and resume locomotion after liquid delivery / inspection
    const waitSec = (pumpDuration || 1) + 2;
    setTimeout(() => {
      currentRoverState.probePosition = "UP";
      currentRoverState.status = "MOVING";
      currentRoverState.activePump = null;
      currentRoverState.pumpRemainingSec = 0;
      io.emit('ROVER_STATE_CHANGE', {
        state: currentRoverState.status,
        gps: currentRoverState.currentGps,
        probePosition: currentRoverState.probePosition
      });
      console.log(`[AUTONOMOUS SIM] Probe retracted. Rover resumed furrow navigation.`);
    }, waitSec * 1000);

  }, 2500);

}, 26000);

// Start All-in-One Server
server.listen(PORT, () => {
  console.log("\n==================================================================");
  console.log(`  🌾 KrishiRakshak — ALL-IN-ONE ROVER COMMAND SYSTEM`);
  console.log(`  Frontend Dashboard:  http://localhost:${PORT}`);
  console.log(`  REST API Endpoints:  http://localhost:${PORT}/api/telemetry`);
  console.log(`  WebSocket Server:    ws://localhost:${PORT}`);
  console.log("==================================================================\n");
});
