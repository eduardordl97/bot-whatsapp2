const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ======== Configuración del bot ========
const token = '8417137357:AAEWmHKUa4hkN7WqdeTtxu0bT5V0PlvBwNk';
const bot = new TelegramBot(token, { polling: true });

// ======== JSON de contactos dentro del código ========
const contactos = [
    { "nombre": "Eduardo", "id": 1034833893 },
    { "nombre": "Memo", "id": 1591483148 }
    // { "nombre": "Carlos", "id": 192837465 }
];

// ======== Función para enviar mensaje personalizado a todos los contactos ========
function enviarMensajePersonalizado(textoBase) {
    contactos.forEach(contacto => {
        const mensaje = `Hola ${contacto.nombre}, ${textoBase}`;
        bot.sendMessage(contacto.id, mensaje);
    });
    console.log('📤 Mensajes personalizados enviados a todos los contactos del JSON interno');
}

// ======== Mensaje de bienvenida y mostrar chat ID ========
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const nombre = msg.chat.first_name || 'Sin nombre';

    bot.sendMessage(chatId, '¡Hola! Bot iniciado y listo para enviar mensajes mensuales.');

    // Mostrar en consola el chat ID de quien envió /start
    console.log(`👤 Usuario que envió /start: ${nombre} (ID: ${chatId})`);
});

// ======== Mensajes programados ========
// Ejemplo: enviar mensaje el día 15 de cada mes a las 3:00 PM
cron.schedule('0 * * * *', () => {
    const now = new Date();
    const horaActual = now.toLocaleTimeString(); // HH:MM:SS

    enviarMensajePersonalizado(`este es un recordatorio automático de que son las ${horaActual}, mi todo tibio 🥶`);

    console.log(`⏰ Mensaje enviado a todos los contactos a las ${horaActual}`);
});


// ======== Servidor web para verificar estado ========
app.get('/status', (req, res) => {
    res.send({ status: 'Bot activo', contactos: contactos.length, lista: contactos });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));
