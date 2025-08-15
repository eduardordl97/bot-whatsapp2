const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');

// Express para mantener el servidor activo
const app = express();
app.get('/', (req, res) => res.send('Bot de WhatsApp activo'));
app.listen(3000, () => console.log('Servidor web iniciado'));

// Inicializar cliente de WhatsApp
const client = new Client();

client.on('qr', qr => {
    console.log('Escanea este código QR para conectar el bot:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot listo para enviar mensajes');

    // Programar un envío cada día a las 1:00 PM
    cron.schedule('0 13 * * *', () => {
        let contactos = ['5215562259536']; // Números sin "+"
        contactos.forEach(num => {
            client.sendMessage(`${num}@c.us`, 'Aviso automático 📢');
        });
    });
});

client.initialize();
