const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');

const app = express();
let latestQR = null;

// Página principal para mostrar QR
app.get('/', (req, res) => {
    if (latestQR) {
        res.send(`<h1>Escanea este código QR:</h1><img src="${latestQR}" />`);
    } else {
        res.send('<h1>Bot activo o esperando QR...</h1>');
    }
});

app.listen(3000, () => console.log('🌐 Servidor web iniciado en puerto 3000'));

// Inicializar cliente de WhatsApp con guardado de sesión
const client = new Client({
    authStrategy: new LocalAuth(), // guarda sesión para no pedir QR
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', async qr => {
    latestQR = await QRCode.toDataURL(qr); // convierte QR en imagen base64
    console.log('🔄 Nuevo QR generado. Escanéalo en la URL de Render.');
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp listo y conectado.');

    // Ejemplo: enviar mensaje todos los días a las 9:00 AM
    cron.schedule('0 9 * * *', () => {
        let contactos = ['5215562259536']; // números sin "+"
        contactos.forEach(num => {
            client.sendMessage(`${num}@c.us`, '📢 Aviso automático: ¡Buenos días!');
        });
        console.log('📤 Mensajes programados enviados.');
    });
});

client.on('disconnected', (reason) => {
    console.log('⚠ Bot desconectado:', reason);
});

client.initialize();
