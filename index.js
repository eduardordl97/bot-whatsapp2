const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

// --------------------
// Configuración básica
// --------------------
let latestQR = null;
const PORT = process.env.PORT || 3000;
const sessionPath = '/tmp/wwebjs_session';
if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
const PREFIJO = "521";
let conectado = false;

// --------------------
// Autenticación básica
// --------------------
const BASIC_USER = "admin";
const BASIC_PASS = "ABCdef123";

function basicAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Restricted Area"');
        return res.status(401).send('No autorizado');
    }
    const base64Credentials = auth.split(' ')[1];
    const [user, pass] = Buffer.from(base64Credentials, 'base64').toString('ascii').split(':');
    if (user !== BASIC_USER || pass !== BASIC_PASS) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Restricted Area"');
        return res.status(401).send('No autorizado');
    }
    next();
}

// --------------------
// Estado & QR
// --------------------
app.get('/', (req, res) => {
    if (latestQR) {
        res.send(`<h1>Escanea este código QR:</h1><img src="${latestQR}" style="width:300px;height:300px"/>`);
    } else {
        res.send('<h1>Bot activo o sesión ya vinculada.</h1>');
    }
});
app.get('/status', (req, res) => res.send({ conectado }));

// --------------------
// Kaelus TV
// --------------------
let listaKaelus = [];
app.post('/update-kaelus', basicAuth, (req, res) => {
    listaKaelus = req.body;
    console.log("✅ Lista Kaelus actualizada:", listaKaelus);
    res.send({ ok: true, length: listaKaelus.length });
});

// --------------------
// Mensajes dinámicos
// --------------------
let mensajesProgramados = [];
let scheduledJobs = [];

app.post('/schedule-message', basicAuth, (req, res) => {
    const mensajes = Array.isArray(req.body) ? req.body : [req.body];

    mensajes.forEach(msg => {
        const { titulo, mensaje, contactos, minuto, hora, dia, mes, diaSemana, timezone } = msg;
        const cronExpr = `${minuto || '*'} ${hora || '*'} ${dia || '*'} ${mes || '*'} ${diaSemana || '*'}`;

        const job = cron.schedule(cronExpr, () => {
            const fechaHoy = new Date().toLocaleDateString('es-MX', { timeZone: timezone || "America/Mexico_City" });

            contactos.forEach(c => {
                const textoFinal = mensaje
                    .replace(/{nombre}/g, c.nombre)
                    .replace(/{fecha}/g, fechaHoy);
                client.sendMessage(PREFIJO + c.numero + '@c.us', textoFinal);
                console.log(`📤 [${titulo}] Mensaje enviado a ${c.nombre}`);
            });
        }, { timezone: timezone || "America/Mexico_City" });

        scheduledJobs.push(job);
        mensajesProgramados.push({ titulo, mensaje, contactos, cron: cronExpr, timezone });
        console.log(`✅ [${titulo}] Cron registrado: ${cronExpr} (${timezone})`);
    });

    res.send({ ok: true, total: mensajesProgramados.length });
});

app.get('/messages', basicAuth, (req, res) => res.send(mensajesProgramados));

app.post('/clear-messages', basicAuth, (req, res) => {
    scheduledJobs.forEach(job => job.stop());
    scheduledJobs = [];
    mensajesProgramados = [];
    console.log("🗑️ Todos los mensajes programados han sido eliminados.");
    res.send({ ok: true });
});

// --------------------
// WhatsApp Client
// --------------------
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-extensions','--disable-gpu']
    }
});

client.on('qr', async qr => {
    latestQR = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', type: 'image/png', margin: 2, scale: 6 });
    console.log('🔄 Nuevo QR generado.');
});
client.on('ready', () => { console.log('✅ Bot listo'); latestQR = null; conectado = true; });
client.on('disconnected', () => { conectado = false; reconnect(); });
client.on('auth_failure', () => { conectado = false; reconnect(); });

function reconnect() {
    console.log("🔄 Reconectando en 10s...");
    setTimeout(() => { client.destroy(); client.initialize(); }, 10000);
}

// --------------------
// CRON FIJOS
// --------------------

// 1️⃣ Kaelus TV - diario a las 12:00 CDMX
cron.schedule('0 12 * * *', async () => {
    try {
        const now = new Date();
        const diaHoy = parseInt(now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit' }));
        for (const usuario of listaKaelus) {
            if (diaHoy === usuario.vencimiento) {
                const fechaFormateada = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
                const mensaje = `🍿 Hola ${usuario.nombre}! 🙌\n\n` +
                                `Hoy es *${fechaFormateada}* y vence tu suscripción *Kaelus TV* 📺✨\n` +
                                `¡No olvides realizar tu pago! 💳😉`;
                await client.sendMessage(PREFIJO + usuario.numero + '@c.us', mensaje);
                console.log(`➡️ [Kaelus TV] Enviado a ${usuario.nombre}`);
            }
        }
    } catch (err) {
        console.error("❌ Error en Kaelus:", err);
    }
}, { timezone: "America/Mexico_City" });

// 2️⃣ Spotify - día 26 de cada mes a las 12:00 CDMX
const spotifyTurnos = ["Memo", "Eduardo", "Miguel", "Jacobo", "Mando", "Mike"];
const numerosSpotify = {
    "Memo": "5569661253", "Eduardo": "5562259536", "Miguel": "5512928235",
    "Jacobo": "5561723812", "Mando": "5610776151", "Mike": "5512928235"
};
const fechaBase = new Date("2025-07-16");

function obtenerTurnoSpotify() {
    const hoy = new Date();
    const diffMeses = (hoy.getFullYear() - fechaBase.getFullYear()) * 12 + (hoy.getMonth() - fechaBase.getMonth());
    return spotifyTurnos[diffMeses % spotifyTurnos.length];
}
cron.schedule('0 12 26 * *', () => {
    const persona = obtenerTurnoSpotify();
    const numero = numerosSpotify[persona];
    if (numero) {
        client.sendMessage(PREFIJO + numero + '@c.us',
            `🎵 ¡Hey ${persona}! 😎\n\nEste mes te toca pagar *Spotify* 💳🤑\n` +
            `No olvides hacerlo antes del día 28 🟢🎧`);
        console.log(`📤 [Spotify] Mensaje enviado a ${persona}`);
    }
}, { timezone: "America/Mexico_City" });

// 3️⃣ YouTube Premium - día 4 de cada mes a las 12:00 CDMX
const listaYoutube = [
    { nombre: "Eduardo", numero: "5562259536" },
    { nombre: "Mando", numero: "5610776151" },
    { nombre: "Serch", numero: "5612083803" }
];
cron.schedule('0 12 4 * *', () => {
    const fecha = new Date().toLocaleDateString('es-MX');
    listaYoutube.forEach(c => {
        const mensaje = `📺🟥 ¡Hey ${c.nombre}! 😎\n\n` +
                        `Hoy es *${fecha}* y toca el pago de *YouTube Premium* 💳🎶\n` +
                        `Porfa no lo olvides 🚀🔥`;
        client.sendMessage(PREFIJO + c.numero + '@c.us', mensaje);
        console.log(`📩 [YouTube] Enviado a ${c.nombre}`);
    });
}, { timezone: "America/Mexico_City" });

// --------------------
// Iniciar
// --------------------
client.initialize();
app.listen(PORT, () => console.log(`🌐 Servidor web en puerto ${PORT}`));
