const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');

const app = express();
let latestQR = null;

// Puerto asignado por Render
const PORT = process.env.PORT || 3000;

// Carpeta persistente para la sesión (Render: /mnt/data es persistente)
const sessionPath = '/mnt/data/wwebjs_session';

// Crear la carpeta si no existe
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
    console.log(`✅ Carpeta de sesión creada en ${sessionPath}`);
}

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
app.get('/status', async (req, res) => {
    const conectado = await client.isConnected();
    res.send({ conectado });
});

app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));

// Inicializar cliente con sesión persistente
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento QR
client.on('qr', async qr => {
    try {
        latestQR = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            margin: 2,
            scale: 6
        });
        console.log('🔄 Nuevo QR generado. Escanéalo en la URL de Render.');
    } catch (err) {
        console.error('❌ Error generando QR:', err);
    }
});

// Bot listo
client.on('ready', () => {
    console.log('✅ Bot de WhatsApp listo y conectado.');
    latestQR = null; // QR ya no se necesita
});

// Reconexión automática si falla
client.on('disconnected', reason => {
    console.log('⚠ Desconectado:', reason);
    reconnect();
});

client.on('auth_failure', msg => {
    console.log('❌ Falló la autenticación:', msg);
    reconnect();
});

function reconnect() {
    console.log('🔄 Intentando reconectar en 10 segundos...');
    setTimeout(() => {
        client.destroy();
        client.initialize();
    }, 10000);
}

// Mensaje programado: 2:00 PM
cron.schedule('0 14 * * *', () => {
    let contactos = ['5215562259536']; 
    contactos.forEach(num => {
        client.sendMessage(`${num}@c.us`, '📢 Lalón Bombón, este es un mensaje programado a las 2:00 PM');
    });
    console.log('📤 Mensajes programados enviados a las 2:00 PM.');
});

// Inicializar cliente
client.initialize();
