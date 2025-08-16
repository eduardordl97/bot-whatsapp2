const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json()); // Para recibir JSON en POST

let latestQR = null;
const PORT = process.env.PORT || 3000;
const sessionPath = '/tmp/wwebjs_session';
if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
const PREFIJO = "521";
let conectado = false;

// -----------------
// Configuración de autenticación básica
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

// -----------------
// Endpoints protegidos
app.get('/', (req, res) => {
    if (latestQR) {
        res.send(`<h1>Escanea este código QR:</h1><img src="${latestQR}" style="width:300px;height:300px"/>`);
    } else {
        res.send('<h1>Bot activo o sesión ya vinculada.</h1>');
    }
});

app.get('/status', (req, res) => res.send({ conectado }));

// POST para actualizar lista Kaelus TV
let listaKaelus = [];
app.post('/update-kaelus', basicAuth, (req, res) => {
    listaKaelus = req.body;
    console.log("✅ Lista Kaelus actualizada:", listaKaelus);
    res.send({ ok: true, length: listaKaelus.length });
});

// POST para programar mensajes dinámicos
let mensajesProgramados = [];

app.post('/schedule-message', basicAuth, (req, res) => {
    const { contactos, mensaje, minuto, hora, dia, mes } = req.body;
    if (!contactos || !mensaje) 
        return res.status(400).send({ ok: false, error: "Faltan datos" });

    // Construir string de cron
    const cronStr = `${minuto || '*'} ${hora || '*'} ${dia || '*'} ${mes || '*'} *`;

    // Programar el mensaje
    cron.schedule(cronStr, () => {
        const now = new Date();
        const fechaFormateada = now.toLocaleDateString('es-MX');

        contactos.forEach(c => {
            // Reemplazar placeholders
            const textoFinal = mensaje
                .replace(/{nombre}/g, c.nombre)
                .replace(/{fecha}/g, fechaFormateada);

            client.sendMessage(PREFIJO + c.numero + '@c.us', textoFinal);
        });

        console.log(`📤 Mensaje enviado a ${contactos.length} contactos a las ${hora}:${minuto}`);
    }, { timezone: "America/Mexico_City" });

    // Guardar info en memoria
    mensajesProgramados.push({ contactos, mensaje, cron: cronStr });
    res.send({ ok: true, total: mensajesProgramados.length });
});


// -----------------
// Inicializar cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] }
});

client.on('qr', async qr => {
    latestQR = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', type: 'image/png', margin: 2, scale: 6 });
    console.log('🔄 Nuevo QR generado.');
});

client.on('ready', () => { console.log('✅ Bot listo'); latestQR = null; conectado = true; });
client.on('disconnected', () => { conectado = false; reconnect(); });
client.on('auth_failure', () => { conectado = false; reconnect(); });

function reconnect() {
    setTimeout(() => { client.destroy(); client.initialize(); }, 10000);
}

// -----------------
// Crons existentes (Kaelus, Spotify, YouTube)...
// Puedes incluir aquí el código que ya tenías de tus crons fijos

client.initialize();
app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));
