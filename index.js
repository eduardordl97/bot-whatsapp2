const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json()); // Para recibir JSON en POST

let latestQR = null;

// Puerto asignado por Render
const PORT = process.env.PORT || 3000;

// Carpeta temporal para la sesión (Render Free)
const sessionPath = '/tmp/wwebjs_session';
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log(`✅ Carpeta de sesión creada en ${sessionPath}`);
}

// Prefijo global para todos los números
const PREFIJO = "521";

// Estado de conexión
let conectado = false;

// Página principal: muestra QR mientras no haya sesión
app.get('/', async (req, res) => {
    if (latestQR) {
        res.send(`
            <h1>Escanea este código QR:</h1>
            <img src="${latestQR}" alt="QR WhatsApp" style="width:300px;height:300px"/>
        `);
    } else {
        res.send('<h1>Bot activo o sesión ya vinculada.</h1>');
    }
});

// Endpoint para verificar estado de la sesión
app.get('/status', (req, res) => {
    res.send({ conectado });
});

// Endpoint POST para actualizar lista Kaelus TV en caliente
let listaKaelus = []; // Inicialmente vacía
app.post('/update-kaelus', (req, res) => {
    listaKaelus = req.body;
    console.log("✅ Lista Kaelus actualizada:", listaKaelus);
    res.send({ ok: true, length: listaKaelus.length });
});

app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));

// Inicializar cliente con sesión temporal
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ]
    }
});

// Evento QR
client.on('qr', async qr => {
    if (!latestQR) {
        try {
            latestQR = await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                margin: 2,
                scale: 6
            });
            console.log('🔄 Nuevo QR generado.');
        } catch (err) {
            console.error('❌ Error generando QR:', err);
        }
    }
});

// Bot listo
client.on('ready', () => {
    console.log('✅ Bot de WhatsApp listo y conectado.');
    latestQR = null;
    conectado = true;
});

// Reconexión automática
client.on('disconnected', reason => {
    console.log('⚠ Desconectado:', reason);
    conectado = false;
    reconnect();
});

client.on('auth_failure', msg => {
    console.log('❌ Falló la autenticación:', msg);
    conectado = false;
    reconnect();
});

process.on('unhandledRejection', (reason, promise) => {
    if (reason?.message?.includes('Execution context was destroyed')) {
        console.log('⚠ ProtocolError detectado, reiniciando cliente...');
        reconnect();
    } else {
        console.error('Unhandled rejection:', reason);
    }
});

function reconnect() {
    console.log('🔄 Intentando reconectar en 10 segundos...');
    conectado = false;
    setTimeout(() => {
        client.destroy();
        client.initialize();
    }, 10000);
}

// ---------------------------------------------------------------------
// 1️⃣ Cron Kaelus TV (vencimiento individual)
// Todos los días a las 14:55 CDMX
cron.schedule('55 14 * * *', async () => {
    try {
        const now = new Date();
        const diaHoy = parseInt(now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit' }));
        console.log("⏰ Ejecutando cron Kaelus TV. Día de hoy:", diaHoy);

        for (const usuario of listaKaelus) {
            if (diaHoy === usuario.vencimiento) {
                const fechaFormateada = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
                const mensaje = `🍿 Hola ${usuario.nombre}! 🙌\n\n` +
                                `Hoy es *${fechaFormateada}* y vence tu suscripción *Kaelus TV* 📺✨\n` +
                                `Con Kaelus TV sigues disfrutando de series, películas y televisión sin interrupciones 🎬🔥\n` +
                                `¡No olvides realizar tu pago para seguir disfrutando de tus beneficios! 💳😉`;

                console.log(`➡️ Enviando mensaje a ${usuario.nombre}`);
                await client.sendMessage(PREFIJO + usuario.numero + '@c.us', mensaje);
            }
        }

        console.log("✅ Proceso de Kaelus TV completado.");
    } catch (err) {
        console.error("❌ Error en cron Kaelus TV:", err);
    }
}, { timezone: "America/Mexico_City" });

// ---------------------------
// 2️⃣ Turnos Spotify
const spotifyTurnos = ["Memo", "Eduardo", "Miguel", "Jacobo", "Mando", "Mike"];
const numerosSpotify = {
    "Memo": "5569661253",
    "Eduardo": "5562259536",
    "Miguel": "5512928235",
    "Jacobo": "5561723812",
    "Mando": "5610776151",
    "Mike": "5512928235"
};
const fechaBase = new Date("2025-07-16");

function obtenerTurnoSpotify() {
    const hoy = new Date();
    const diffMeses = (hoy.getFullYear() - fechaBase.getFullYear()) * 12 +
                      (hoy.getMonth() - fechaBase.getMonth());
    const indiceTurno = diffMeses % spotifyTurnos.length;
    return spotifyTurnos[indiceTurno];
}

// Cron a las 12:00 CDMX el día 26 de cada mes
cron.schedule('0 12 26 * *', () => {
    const persona = obtenerTurnoSpotify();
    const numero = numerosSpotify[persona];

    if (numero) {
        client.sendMessage(PREFIJO + numero + '@c.us',
            `🎵 ¡Hey ${persona}! 😎\n\n` +
            `Este mes te toca ser el *héroe de Spotify* 💳🤑\n` +
            `No olvides pagar antes del día 28 para que todos sigamos escuchando 🟢🎧\n` +
            `¡Tú puedes! 💪✨`
        );
        console.log(`📤 Mensaje de Spotify enviado a ${persona}`);
    } else {
        console.log("⚠ No se encontró número para", persona);
    }
}, { timezone: "America/Mexico_City" });

// ---------------------------
// 3️⃣ YouTube Premium
const listaYoutube = [
    { nombre: "Eduardo", numero: "5562259536" },
    { nombre: "Mando", numero: "5610776151" },
    { nombre: "Serch", numero: "5612083803" }
];

// Cron a las 12:00 CDMX el día 4 de cada mes
cron.schedule('0 12 4 * *', () => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX');

    listaYoutube.forEach(contacto => {
        const mensaje = `📺🟥 ¡Hey ${contacto.nombre}! 😎\n\n` +
                        `Hoy es *${fecha}* y toca el pago de *YouTube Premium* 💳🎶\n\n` +
                        `Porfa no lo olvides para que todos sigamos disfrutando sin anuncios 🚀🔥\n\n` +
                        `¡Gracias crack! 🙌`;

        client.sendMessage(PREFIJO + contacto.numero + '@c.us', mensaje);
        console.log(`📩 Recordatorio de YouTube Premium enviado a ${contacto.nombre}`);
    });
}, { timezone: "America/Mexico_City" });

// Inicializar cliente
client.initialize();
