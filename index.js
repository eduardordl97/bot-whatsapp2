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

// Mensaje programado cada hora en punto
cron.schedule('0 * * * *', () => {
    let contactos = ['5215562259536']; 
    contactos.forEach(num => {
        client.sendMessage(`${num}@c.us`, '📢 Aviso automático:\n ¡Buenas tardes Laloko, Arriba el azul.!');
    });
    console.log('📤 Mensajes programados enviados.');
});

// Inicializar cliente
client.initialize();
