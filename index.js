const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');

const app = express();
let latestQR = null;

// Puerto asignado por Render
const PORT = process.env.PORT || 3000;

// Carpeta temporal para la sesión (Render Free)
const sessionPath = '/tmp/wwebjs_session';

// Crear carpeta temporal si no existe
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log(`✅ Carpeta de sesión creada en ${sessionPath}`);
}

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
    latestQR = null; // QR ya no se necesita
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

// Manejar errores de Puppeteer como ProtocolError
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
// ✅ MENSAJES PROGRAMADOS
// ---------------------------------------------------------------------

// 1. Mensaje diario de tibieza → todos los días a las 16:10 hrs
// cron.schedule('10 17 * * *', () => {
//     let contactos = ['5215562259536', '5215612083803','5215569661253','5215512928235','5215561723812']; 
//     const now = new Date();
//     const horaActual = now.toLocaleTimeString('es-MX', {
//         timeZone: 'America/Mexico_City',
//         hour: '2-digit',
//         minute: '2-digit',
//         hour12: true
//     });
//     contactos.forEach(num => {
//         client.sendMessage(`${num}@c.us`, `🚨 ¡Alerta de tibieza! 🥶\n\n` +
//                 `Hey, son las ⏰ ${horaActual} y tú sigues todo tibio 🔥\n` +
//                 `¡No te duermas, es hora de apoyar al Cruz Azul! ⚡😎`);
//     });
//     console.log('📤 Mensajes programados enviados (tibieza).');
// });

// ---------------------------------------------------------------------
// 2. Turnos de Spotify → cada 26 de mes a las 17:00 hrs
// ---------------------------------------------------------------------

// Lista de personas y su orden
const spotifyTurnos = ["Memo", "Eduardo", "Miguel", "Jacobo", "Mando", "Mike"];

// Números asociados a cada persona
const numerosSpotify = {
    "Memo": "5215569661253",
    "Eduardo": "5215562259536",
    "Miguel": "5215512928235",
    "Jacobo": "5215561723812",
    "Mando": "5215610776151",
    "Mike": "5215512928235"
};

// Fecha base: 26 de julio 2025 → Memo
const fechaBase = new Date("2025-07-16");

// Función para obtener quién paga este mes
function obtenerTurnoSpotify() {
    const hoy = new Date();
    const diffMeses = (hoy.getFullYear() - fechaBase.getFullYear()) * 12 +
                      (hoy.getMonth() - fechaBase.getMonth());
    const indiceTurno = diffMeses % spotifyTurnos.length;
    return spotifyTurnos[indiceTurno];
}

// Cron job
cron.schedule('0 18 26 * *', () => {
    const persona = obtenerTurnoSpotify();
    const numero = numerosSpotify[persona];

    if (numero) {
        client.sendMessage(`${numero}@c.us`,
            `🎵 ¡Hey ${persona}! 😎\n\n` +
            `Este mes te toca ser el *héroe de Spotify* 💳🤑\n` +
            `No olvides pagar antes del día 28 para que todos sigamos escuchando 🟢🎧\n` +
            `¡Tú puedes! 💪✨`
        );
        console.log(`📤 Mensaje de Spotify enviado a ${persona}`);
    } else {
        console.log("⚠ No se encontró número para", persona);
    }
});

// Recordatorio mensual YouTube Premium
cron.schedule('0 18 4 * *', () => {  
    const listaYoutube = [
        { nombre: "Eduardo", numero: "5215562259536" },
        { nombre: "Mando", numero: "5215610776151" },
        { nombre: "Serch", numero: "5215612083803" }
    ];

    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });

    listaYoutube.forEach(contacto => {
        const mensaje = `📺🟥 ¡Hey ${contacto.nombre}! 😎\n\n` +
                        `Hoy es *${fecha}* y toca el pago de *YouTube Premium* 💳🎶\n\n` +
                        `Porfa no lo olvides para que todos sigamos disfrutando sin anuncios 🚀🔥\n\n` +
                        `¡Gracias crack! 🙌`;

        client.sendMessage(`${contacto.numero}@c.us`, mensaje);
        console.log(`📩 Recordatorio de YouTube Premium enviado a ${contacto.nombre}`);
    });
}, {
    timezone: "America/Mexico_City"
});
// ---------------------------------------------------------------------
// Recordatorios de Kaelus TV según vencimiento individual
// Lista de usuarios Kaelus TV
const listaKaelus = [
    { nombre: "Eduardo", numero: "5215562259536", vencimiento: 18 },
    { nombre: "Benito Fornica", numero: "5215544726563", vencimiento: 16 }
];

// Cron job todos los días a las 12:05 p.m. CDMX → 18:05 UTC en Render
cron.schedule('20 18 * * *', async () => { 
  try {
    const now = new Date();
    const diaHoy = parseInt(now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit' }));

    console.log("⏰ Ejecutando cron Kaelus:", diaHoy);

    for (const usuario of listaKaelus) {
      if (diaHoy === usuario.vencimiento) {
        const fechaFormateada = now.toLocaleDateString('es-MX', { 
            timeZone: 'America/Mexico_City', 
            day: 'numeric', 
            month: 'long' 
        });

        const mensaje = `🍿 Hola ${usuario.nombre}! 🙌\n\n` +
                        `Hoy es *${fechaFormateada}* y vence tu suscripción *Kaelus TV* 📺✨\n\n` +
                        `Con Kaelus TV sigues disfrutando de series, películas y televisión sin interrupciones 🎬🔥\n\n` +
                        `¡No olvides realizar tu pago para seguir disfrutando de tus beneficios! 💳😉`;

        console.log(`➡️ Enviando mensaje a ${usuario.numero}`);
        await client.sendMessage(usuario.numero + '@c.us', mensaje);
      }
    }

    console.log("✅ Proceso de revisión completado.");
  } catch (err) {
    console.error("❌ Error en cron Kaelus:", err);
  }
}, {
    timezone: "America/Mexico_City"
});


// Inicializar cliente
client.initialize();
