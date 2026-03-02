const express = require("express");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(cors());

let negocios = [];

// 📌 Cargar CSV
fs.createReadStream("./conjunto_de_datos/denue_inegi_21_.csv")
    .pipe(csv())
    .on("data", (row) => {
        row.codigo_act = String(row.codigo_act || "").trim();
        negocios.push(row);
    })
    .on("end", () => {
        console.log("CSV cargado. Total negocios:", negocios.length);
    });

// 📌 Fórmula Haversine
function distancia(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 📌 Endpoint
app.get("/api/denue", (req, res) => {

    const lat = req.query.lat;
    const lng = req.query.lng;
    const radio = parseInt(req.query.radio) || 500;
    const codigo = req.query.codigo;

    console.log("Codigo recibido:", codigo);
    console.log("Lat:", lat, "Lng:", lng);

    if (!lat || !lng) {
        return res.status(400).json({ error: "Faltan coordenadas" });
    }

    const resultados = negocios.filter(n => {

        const latNeg = parseFloat(n.latitud);
        const lonNeg = parseFloat(n.longitud);

        if (!latNeg || !lonNeg) return false;

        const d = distancia(
            parseFloat(lat),
            parseFloat(lng),
            latNeg,
            lonNeg
        );

        if (d > radio) return false;

        if (codigo) {
            return n.codigo_act === codigo;
        }

        return true;
    });

    res.json({
        total: resultados.length,
        negocios: resultados.slice(0, 50)
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor corriendo en puerto", PORT);
});
