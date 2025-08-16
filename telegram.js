const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ======== Configuración del bot ========
const token = '8417137357:AAEWmHKUa4hkN7WqdeTtxu0bT5V0PlvBwNk';
const bot = new TelegramBot(token, { polling: true });

// ======== Contactos generales (mensajes horarios) ========
const contactosGenerales = [
    { "nombre": "Eduardo", "id": 1034833893 }
    // { "nombre": "Memo", "id": 1591483148 },
    // { "nombre": "Miguel", "id": 6520635694 },
    // { "nombre": "Jacob", "id": 5437780923 },
    // { "nombre": "Serch", "id": 2097823501 }
    
];

// ======== Contactos Spotify (rotación mensual) ========
const contactosSpotify = [
    { "nombre": "Jacob", "id": 5437780923 },
    { "nombre": "Mando", "id": 1034833893 },
    { "nombre": "Miguel", "id": 6520635694 },
    { "nombre": "Mike", "id": 6520635694 },
    { "nombre": "Eduardo", "id": 1034833893 },
    { "nombre": "Memo", "id": 1591483148 }
];

// ======== Función para enviar mensaje personalizado a todos los contactos generales ========
function enviarMensajePersonalizado(textoBase) {
    contactosGenerales.forEach(contacto => {
        const mensaje = `Hola ${contacto.nombre}, ${textoBase}\n`;
        bot.sendMessage(contacto.id, mensaje);
    });
    console.log('📤 Mensajes personalizados enviados a todos los contactos generales');
}

// ======== Función para enviar recordatorio de Spotify según turno ========
const ordenSpotify = ["Memo", "Eduardo", "Miguel", "Jacob", "Mando", "Mike"];
let indiceSpotify = 0;

function enviarSpotify() {
    const persona = ordenSpotify[indiceSpotify];
    const contacto = contactosSpotify.find(c => c.nombre === persona);

    if (contacto) {
        const mensaje = `🎵 ¡Hey ${contacto.nombre}! 😎\n\n` +
                        `Este mes te toca ser el **héroe de Spotify** 🤑\n` +
                        `No olvides pagar antes del 28 para que todos sigamos escuchando 🎶\n` +
                        `¡Tú puedes! 💪✨`;

        bot.sendMessage(contacto.id, mensaje, { parse_mode: 'Markdown' });
        console.log(`✅ Mensaje divertido de Spotify enviado a ${contacto.nombre} (${contacto.id})`);
    } else {
        console.log(`❌ No se encontró el contacto ${persona} en la lista de Spotify`);
    }

    // Actualizar índice para el próximo mes
    indiceSpotify = (indiceSpotify + 1) % ordenSpotify.length;
}

// ======== Mensajes programados ========

// Mensaje cada hora a contactos generales
cron.schedule('0 * * * *', () => {
    const now = new Date();
    const horaActual = now.toLocaleTimeString('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // formato 12 horas con AM/PM
    });

    enviarMensajePersonalizado(`\n🚨 ¡Alerta de tibieza! 🥶\n\n` +
                `Hey, son las ⏰ ${horaActual} y tú sigues todo tibio 🔥\n` +
                `¡No te duermas, es hora de chaquetiarse! ⚡😎`);

    console.log(`⏰ Mensaje enviado a todos los contactos generales a las ${horaActual}`);
});


// Mensaje de Spotify cada 26 del mes a las 10:00 AM CDMX
cron.schedule('0 10 26 * *', () => {
    const now = new Date();
    const horaActual = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' });

    console.log(`⏰ Ejecutando recordatorio de Spotify a las ${horaActual}`);
    enviarSpotify();
}, {
    scheduled: true,
    timezone: "America/Mexico_City"
});

// ======== Mensaje de bienvenida y mostrar chat ID ========
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const nombre = msg.chat.first_name || 'Sin nombre';

    bot.sendMessage(chatId, '¡Hola! Bot iniciado y listo para enviar mensajes mensuales.');

    console.log(`👤 Usuario que envió /start: ${nombre} (ID: ${chatId})`);
});

// ======== Servidor web para verificar estado ========
app.get('/status', (req, res) => {
    res.send({
        status: 'Bot activo',
        contactosGenerales: contactosGenerales.length,
        contactosSpotify: contactosSpotify.length
    });
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🌐 Servidor web iniciado en puerto ${PORT}`));
