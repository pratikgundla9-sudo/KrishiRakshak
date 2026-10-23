# 🌾 KrishiRakshak — All-in-One Autonomous Field Rover System
### *Synchronized Distributed Architecture (ESP32 Node + Smartphone Edge Vision + Unified Web Command Center)*

KrishiRakshak integrates edge computer vision, in-situ 7-in-1 NPK Modbus soil telemetry, precision liquid actuators, and full manual robotics locomotion control into a single unified platform.

---

## 🚀 Quick Start (All-in-One in ONE Click)

### Option 1: Double-Click Launcher (Windows)
Double-click **`start_all_in_one.bat`** in this directory.  
It automatically starts the unified server and opens **`http://localhost:5000`** in your default web browser.

### Option 2: Terminal Command
```bash
npm start
```
Or directly with Node.js:
```bash
node server.js
```
The server will be live at:
- **Unified Web Dashboard**: [http://localhost:5000](http://localhost:5000)
- **REST Telemetry API**: `http://localhost:5000/api/telemetry`
- **Manual Control Relay**: `http://localhost:5000/api/manual-control`
- **Real-time WebSockets**: `ws://localhost:5000`

---

## 🕹️ Manual Robot Control (Locomotion & Actuators)

Manual control is available from two interfaces:
1. **Dedicated Robot Control Console** (Click `Robot Control` in sidebar):
   - **Tactile D-Pad**: `FWD`, `REV`, `LEFT`, `RIGHT`, `STOP`.
   - **Keyboard Navigation**:
     - `W` or `Arrow Up`: Drive Forward
     - `S` or `Arrow Down`: Drive Reverse
     - `A` or `Arrow Left`: Turn Left
     - `D` or `Arrow Right`: Turn Right
     - `Spacebar`: Emergency Stop
   - **7-in-1 Soil Sensor Linear Actuator**:
     - `Probe Down`: Deploys the sensor probe into the ground.
     - `Probe Up`: Retracts the sensor probe to safe travel clearance.
   - **Dual Actuator Relays**:
     - `Pump 1: Drip` (Irrigation Water)
     - `Pump 2: Spray` (Liquid NPK Fertilizer / Foliar)
   - **Live Hardware Bus**: Battery voltage, solar power, and motor state.
2. **In-Dashboard Quick Override Pad** (On `Rover Mission Sync` screen):
   - Directional drive buttons and actuator overrides embedded directly under the Leaflet mission map.

---

## 🤖 3-Node Distributed Hardware Architecture

```
+---------------------------------------------------------------------------------------------------------+
|                                        SHARED WI-FI NETWORK                                             |
|                                     (SoftAP: KrishiRakshak_Rover)                                       |
+---------------------------------------------------------------------------------------------------------+
             |                                              |                                   |
             v                                              v                                   v
+-----------------------------+        +----------------------------------------+        +-----------------------------+
|    NODE A: ESP32 HARDWARE   | <----> |      NODE B: SMARTPHONE AGENT          | ---->  |   NODE C: ALL-IN-ONE WEB    |
|     (http://192.168.4.1)    |        |        (smartphone_agent.py)           |        |        (server.js:5000)     |
|                             |        |                                        |        |                             |
| * L298N 4WD Motor Driver    |        | * Downward Furrow Camera Stream        |        | * Serves React SPA (dist/)  |
| * RS-485 Modbus 7-in-1 NPK  |        | * YOLOv8 Edge Vision (3-frame debounce)|        | * Socket.IO Real-time Sync  |
| * Linear Actuator Probe     |        | * GPS Geotagging & State Machine       |        | * Leaflet Multi-Color Pins  |
| * Dual 12V Relays (Pumps)   |        | * Cross-Correlation Decision Engine    |        | * Dual Visual vs Soil Panel |
| * REST HTTP Control Server  |        | * Sequential ESP32 HTTP Orchestration  |        | * Full Manual Robot Control |
+-----------------------------+        +----------------------------------------+        +-----------------------------+
```

### 🧠 Cross-Correlation Decision Matrix:
| Visual Symptom | In-Situ 7-in-1 Soil Metric | Autonomous Rover Diagnosis | Executed Actuation | Map Marker |
| :--- | :--- | :--- | :--- | :--- |
| `yellow_leaves` | Soil Moisture < 30% | **Water Stress** | Activates Pump 1 (Water) for 4.0s | 🟡 Yellow |
| `yellow_leaves` | Nitrogen < 25 mg/kg | **Nitrogen Deficiency** | Activates Pump 2 (Fertilizer) for 3.0s | 🟠 Orange |
| `disease_spots` | — | **Fungal / Bacterial Blight** | NO AUTO SPRAY — Logged High Alert | 🔴 Red |
| `pest_holes` | — | **Pest / Insect Chewing** | NO AUTO SPRAY — Logged High Alert | 🔴 Red |

---

## 📱 Node B: Smartphone Edge Vision Client

To start the smartphone vision agent on the rover:
```bash
# Standard interactive GUI mode:
python smartphone_agent.py

# Headless / Background service mode (no GUI window, safe on servers & Windows background):
python smartphone_agent.py --headless

# Test with synthetic furrow canopy pipeline (even if physical camera unplugged):
python smartphone_agent.py --mock-camera
```
- DirectShow backend (`CAP_DSHOW`) prevents Windows MSMF camera initialization hangs.
- Generates and transmits authentic agronomic leaf snapshots with geotagged coordinates.
- Automatically debounces anomalies across 3 frames (>= 70% confidence).
- Coordinates stop, probe deployment, Modbus reading, pump actuation, and resumption with the ESP32.
- POSTs unified telemetry directly to `http://localhost:5000/api/telemetry`.

---

## ⚡ Autonomous Demonstration Simulation Mode
If the server is started standalone (`start_all_in_one.bat` or `node server.js`) without physical hardware or the Python client connected:
- The unified server continuously advances rover coordinates along the crop furrow every 2.5s.
- Every ~26s, the server simulates an autonomous inspection cycle: halts the rover, deploys the 7-in-1 probe, correlates soil metrics with leaf imagery, triggers the appropriate 12V pump, and resumes navigation.
- All map intervention markers populate immediately with high-resolution foliar photo snapshots when clicked.
- Whenever a live client (such as `smartphone_agent.py`) connects and sends telemetry, the server yields to the edge client automatically.

---

## 🔌 Node A: ESP32 Hardware Node

1. Open **`esp32_firmware.ino`** in Arduino IDE or PlatformIO.
2. Select board: **ESP32 Dev Module**.
3. Upload to your ESP32 board.
4. The ESP32 hosts its own SoftAP Wi-Fi network:
   - **SSID**: `KrishiRakshak_Rover`
   - **Password**: `krishi1234`
   - **IP**: `http://192.168.4.1`
