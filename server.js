const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(__dirname));

let negocios = [];
let csvCargado = false;

const CSV_PATH = path.join(__dirname, "conjunto_de_datos", "denue_inegi_21_.csv");

// ============================
// CARGAR CSV
// ============================
if (fs.existsSync(CSV_PATH)) {
    fs.createReadStream(CSV_PATH)
        .pipe(csv())
        .on("data", (row) => {
            const lat = parseFloat(row.latitud);
            const lng = parseFloat(row.longitud);

            if (isNaN(lat) || isNaN(lng)) return;

            const negocio = {
                nombre: row.nom_estab?.trim() || "SIN NOMBRE",
                codigo_act: String(row.codigo_act || "").trim(),
                latitud: lat,
                longitud: lng,
                direccion: `${row.nom_vial || ""} ${row.numero_ext || ""}, ${row.nom_col || ""}`
                    .replace(/\s+/g, " ")
                    .trim()
            };

            negocios.push(negocio);
        })
        .on("end", () => {
            csvCargado = true;
            console.log("✅ CSV cargado correctamente");
            console.log("Total negocios:", negocios.length);
        })
        .on("error", (err) => {
            console.error("❌ Error leyendo CSV:", err.message);
        });
} else {
    console.error("❌ No se encontró el CSV en la ruta:", CSV_PATH);
}

// ============================
// FUNCIÓN DISTANCIA (Haversine)
// ============================
function distancia(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metros
    const toRad = x => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================
// API DENUE
// ============================
app.get("/api/denue", (req, res) => {

    if (!csvCargado) {
        return res.status(503).json({ error: "CSV aún cargando, intenta en unos segundos." });
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radio = parseFloat(req.query.radio) || 500;
    const codigo = req.query.codigo?.trim();

    // 🔥 VALIDACIÓN CORRECTA
    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Coordenadas inválidas" });
    }

    const resultados = negocios.filter(n => {
        const d = distancia(lat, lng, n.latitud, n.longitud);
        if (d > radio) return false;

        if (codigo) {
            return n.codigo_act === codigo;
        }

        return true;
    });

    res.json({
        total: resultados.length,
        negocios: resultados.slice(0, 100)
    });
});

// ============================
// API CONEXIÓN ML (FLASK)
// ============================
app.post("/api/ml", async (req, res) => {
    try {
        const response = await axios.post(
            "http://127.0.0.1:5001/predecir",
            req.body,
            { timeout: 5000 }
        );

        res.json(response.data);

    } catch (error) {
        console.error("❌ Error ML:", error.message);
        res.status(500).json({ error: "Error conectando con el servidor ML" });
    }
});

// ============================
// INICIAR SERVIDOR
// ============================
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
