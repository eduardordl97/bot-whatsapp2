const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const cron = require('node-cron');
const express = require('express');

const app = express();
let latestQR = null;

// Página principal para mostrar QR
app.get('/', async (req, res) => {
    if (latestQR) {
        // Genera HTML con la imagen en base64
        res.send(`
            <h1>Escanea este código QR Lalo:</h1>
            <img src="${latestQR}" alt="QR WhatsApp" style="width:300px;height:300px"/>
        `);
    } else {
        res.send('<h1>Bot activo o esperando QR...</h1>');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));

// Inicializar cliente de WhatsApp con guardado de sesión
const client = new Client({
    authStrategy: new LocalAuth(), 
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento QR
client.on('qr', async qr => {
    try {
        // Genera base64 optimizado
        latestQR = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'H', // mejor corrección de errores
            type: 'image/png',
            margin: 2,                 // margen más limpio
            scale: 6                   // tamaño de imagen más grande
        });
        console.log('🔄 Nuevo QR generado. Escanéalo en la URL de Render.');
    } catch (err) {
        console.error('❌ Error generando QR:', err);
    }
});

// Bot listo
client.on('ready', () => {
    console.log('✅ Bot de WhatsApp listo y conectado.');

    cron.schedule('20 14 * * *', () => {
        let contactos = ['5215562259536']; 
        contactos.forEach(num => {
            client.sendMessage(`${num}@c.us`, '📢 Aviso automático: ¡Buenas tardes Laloko, son las 2:20 p.m.!');
        });
        console.log('📤 Mensajes programados enviados.');
    });
});

// Bot desconectado
client.on('disconnected', (reason) => {
    console.log('⚠ Bot desconectado:', reason);
});

client.initialize();