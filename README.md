# JalDrishti: Urban Flood Nowcasting System
### Rainfall and Drainage-Based Street-Level Flood Risk Prediction

An advanced civic-tech full-stack web platform combining real-time rainfall data (Automated Weather Stations and Doppler radar feeds) with subsurface stormwater drainage network telemetry (carrying capacity, blockage percentage, and silt accumulation) to estimate and predict street-level flood risk in metropolitan cities.

---

## 🌊 System Architecture & Key Capabilities

**JalDrishti (जल दृष्टि)** delivers hyper-localized, street-level flood intelligence to empower citizens, ward maintenance engineers, and municipal emergency commanders. By evaluating the hydrodynamic balance between precipitation runoff and effective drainage capacity, the system classifies streets into standardized risk bands (**Green: Low**, **Yellow: Moderate**, **Orange: High**, and **Red: Severe/Critical**) with explainable hydrologic rationales for every assessment.

### Key Capabilities:
1. **Dual Specialized Portals**:
   - 🛡️ **EOC Commander Portal**: Disaster operations dashboard, live radar/AWS telemetry, interactive GIS flood map, subsurface drainage maintenance registry, municipal triage with heavy diesel pump allocation, and rule-based alert evaluation.
   - 👥 **Public Citizen Portal**: Real-time emergency broadcast ticker, live road clearance checker (Safe vs. Submerged), crowdsourced flood reporting with water-depth indicators, and 24x7 disaster helplines (1533 / 1077 / 112).
2. **Direct Emergency Alert Broadcasting**:
   - EOC Commanders can immediately push detected alerts or compose custom public advisory bulletins directly to citizens via SMS and the Public Portal.
3. **Location-Specific Hydro-Informatics & Native PDF Export**:
   - Select any monitored corridor to generate and download an official **Executive PDF Dossier** containing catchment topography, hydraulic deficit, silt meters, and certified EOC sign-off stamps.
4. **Physical Hydrologic Engine (+ Optional C Engine)**:
   - Evaluates runoff flow $Q = C \times I \times A$ against net drainage capacity $D_{\text{eff}} = D_{\text{nom}} \times (1 - \text{Blockage}\%)$.
5. **Multi-Metro Monitored Demonstration Networks**:
   - **Bengaluru** (Silk Board Junction Underpass, Bellandur Ecospace, Manyata Tech Park, Majestic, Koramangala)
   - **Chennai** (Velachery Bypass Road Basin, T. Nagar Usman Road, Koyambedu)
   - **Hyderabad** (Tolichowki Flyover Underpass, Hitec City Cyber Towers, Gachibowli ORR)
   - **Pune** (Shivajinagar Sancheti Underpass, Swargate Chowk, Hinjewadi)

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Leaflet GIS Maps, Lucide Icons |
| **Backend API** | Python 3.10+, Flask, SQLite (ANSI SQL-92 schema), Jinja2 |
| **Hydrologic Engine** | Python Physical Rational Formula + Optional C Extension (`c_engine/`) |
| **PDF Reporting** | Pure-Python Vector PDF 1.4 Generator (Zero C-dependencies) |
| **Public Forwarding** | Cloudflare Quick Tunnels (`cloudflared`) |

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional)
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database & seed demonstration data
python seed_data.py

# Start Flask API server
python app.py
```
Backend runs on `http://127.0.0.1:5000`.

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install npm packages
npm install

# Build static bundle for Flask production serving
npm run build

# Or start Vite dev server for local hot-reloading
npm run dev
```

### 3. Unified Production Serving
When `npm run build` is executed, the Flask backend automatically serves both the compiled single-page application and REST APIs unified on `http://127.0.0.1:5000`.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── app.py                   # Main Flask REST API & SPA static server
│   ├── database.py              # SQLite connection helper & schema init
│   ├── risk_engine.py           # Physical hydrologic scoring calculation
│   ├── pdf_generator.py         # Pure-Python PDF 1.4 vector dossier generator
│   ├── seed_data.py             # Database seed script for demonstration metros
│   ├── c_engine/                # Optional C acceleration module
│   │   ├── flood_calc.c         # C implementation of hydrologic formula
│   │   └── compile_engine.bat   # MSVC DLL compilation script
│   └── sql/
│       ├── schema.sql           # SQL DDL table schema definitions
│       └── seed_data.sql        # Demonstration seeds & initial telemetry
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main application router & portal switcher
│   │   ├── context/AppContext.tsx# Global state management (city, portal, role)
│   │   ├── api/client.ts        # Type-safe REST client for backend endpoints
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx       # EOC Executive Command Dashboard
│   │   │   ├── PublicPortalPage.tsx    # Citizen Safety & Broadcast Portal
│   │   │   ├── RainfallPage.tsx        # Rainfall telemetry & Radar nowcasts
│   │   │   ├── FloodMapPage.tsx        # Interactive Leaflet GIS flood map
│   │   │   ├── StreetRiskAnalysisPage.tsx # Street-level rational explainability
│   │   │   ├── DrainagePage.tsx        # Subsurface stormwater network registry
│   │   │   ├── AlertsPage.tsx          # Rule alert dispatch & public broadcast
│   │   │   ├── MunicipalResponsePage.tsx# Triage, QRT & heavy diesel pumps
│   │   │   └── AnalyticsPage.tsx       # Hydro-informatics & location PDF export
│   │   └── components/                 # Modals, Navbar, Sidebar, Badges
│   ├── package.json
│   └── vite.config.ts
├── start_public_link.bat        # 1-click startup script with Cloudflare tunnel
├── .gitignore
└── README.md
```

---

## 📄 License & Disclaimer

This project is built for municipal disaster management demonstration, civil engineering planning, and civic hackathon showcases. Predictions reflect simulated hydrodynamic parameters.
