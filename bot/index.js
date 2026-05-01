require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('Falta TELEGRAM_BOT_TOKEN en .env.local'); process.exit(1); }

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('Bot iniciado con polling...');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'telegram_bot',
  waitForConnections: true,
});

// ── Helpers ──────────────────────────────────────────────────
async function obtenerOCrearUsuario(msg) {
  const { id: telegram_id, username, first_name, last_name } = msg.from;
  const chat_id = msg.chat.id;

  const [[existente]] = await pool.query(
    'SELECT id, creditos, estado FROM usuarios WHERE telegram_id = ?',
    [telegram_id]
  );

  if (existente) {
    await pool.query(
      'UPDATE usuarios SET ultima_actividad = NOW() WHERE telegram_id = ?',
      [telegram_id]
    );
    return existente;
  }

  const [result] = await pool.query(
    'INSERT INTO usuarios (telegram_id, username, first_name, last_name, chat_id, creditos, estado) VALUES (?, ?, ?, ?, ?, 0, "activo")',
    [telegram_id, username || null, first_name, last_name || null, chat_id]
  );
  console.log(`Nuevo usuario registrado: ${first_name} (${telegram_id})`);
  return { id: result.insertId, creditos: 0, estado: 'activo' };
}

async function registrarDescarga(usuario_id, url, estado = 'pendiente') {
  const [result] = await pool.query(
    'INSERT INTO descargas (usuario_id, url_solicitada, estado, creditos_usados) VALUES (?, ?, ?, 5)',
    [usuario_id, url, estado]
  );
  return result.insertId;
}

async function actualizarDescarga(id, estado, nombre_archivo = null, tipo = null, mensaje_error = null) {
  await pool.query(
    'UPDATE descargas SET estado = ?, nombre_archivo = ?, tipo = ?, mensaje_error = ? WHERE id = ?',
    [estado, nombre_archivo, tipo, mensaje_error, id]
  );
}

async function descontarCreditos(usuario_id, cantidad) {
  await pool.query(
    'UPDATE usuarios SET creditos = creditos - ? WHERE id = ?',
    [cantidad, usuario_id]
  );
}

const CREDITOS_POR_DESCARGA = 5;
const PLANES_IMG = path.join(process.cwd(), 'public', 'planes.jpg');
const md = (extra = {}) => ({ parse_mode: 'Markdown', ...extra });

// ── Teclados ──────────────────────────────────────────────────
const KB_MAIN = {
  reply_markup: {
    keyboard: [
      ['🎨 Descargar', '💰 Créditos'],
      ['📊 Mi Cuenta', 'ℹ️ Ayuda'],
    ],
    resize_keyboard: true,
    persistent: true,
  },
};

const ADMIN_PHONE = '51918424284';
const ADMIN_TG = 'https://t.me/+51918424284';

function kbPlanes(plan = '') {
  const msg = encodeURIComponent(`Hola! Quiero comprar el plan ${plan} de créditos para el bot de Freepik.`);
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🥉 Básico', callback_data: 'plan_basico' }, { text: '🥈 Estándar', callback_data: 'plan_estandar' }],
        [{ text: '🥇 Premium', callback_data: 'plan_premium' }, { text: '💎 Pro', callback_data: 'plan_pro' }],
        [
          { text: '💬 WhatsApp', url: `https://wa.me/${ADMIN_PHONE}?text=${msg}` },
          { text: '✈️ Telegram', url: ADMIN_TG },
        ],
        [{ text: '⬅️ Volver', callback_data: 'volver_inicio' }],
      ],
    },
  };
}

// ── /start ────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    const nombre = msg.from.first_name;

    if (usuario.estado === 'baneado') {
      return bot.sendMessage(msg.chat.id,
        `⛔ *Cuenta suspendida*\n\nContacta al soporte si crees que es un error.`,
        md()
      );
    }

    await bot.sendMessage(msg.chat.id,
      `👋 *¡Hola ${nombre}!*\n\n` +
      `🎨 *Bot Descargador de Freepik*\n\n` +
      `💛 *Créditos:* ${usuario.creditos}\n\n` +
      `📌 *¿Cómo usar?*\n` +
      `1️⃣ Copia un link de Freepik\n` +
      `2️⃣ Pégalo aquí\n` +
      `3️⃣ ¡Recibe tu archivo!\n\n` +
      `💡 Cada descarga usa *${CREDITOS_POR_DESCARGA}* créditos\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Comandos disponibles:*\n` +
      `/descargar — Ir a descargar\n` +
      `/creditos — Ver tu saldo\n` +
      `/estado — Ver tus estadísticas\n` +
      `/ayuda — Ver ayuda`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['🎨 Descargar', '💰 Créditos'],
            ['📊 Mi Cuenta', 'ℹ️ Ayuda'],
          ],
          resize_keyboard: true,
          persistent: true,
        },
      }
    );
  } catch (err) {
    console.error('/start error:', err.message);
    bot.sendMessage(msg.chat.id, '❌ Error al iniciar. Intenta de nuevo.');
  }
});

// ── /creditos ─────────────────────────────────────────────────
bot.onText(/\/creditos/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarDetallePlan(msg.chat.id, 'plan_premium', usuario.creditos);
  } catch (err) { console.error('/creditos error:', err.message); }
});

// ── /descargar ────────────────────────────────────────────────
bot.onText(/\/descargar/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarDescargar(msg.chat.id, usuario.creditos);
  } catch (err) { console.error('/descargar error:', err.message); }
});

// ── /estado ───────────────────────────────────────────────────
bot.onText(/\/estado/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarCuenta(msg.chat.id, usuario);
  } catch (err) { console.error('/estado error:', err.message); }
});

// ── /ayuda ────────────────────────────────────────────────────
bot.onText(/\/ayuda/, async (msg) => {
  bot.sendMessage(msg.chat.id,
    `ℹ️ *Ayuda*\n\n` +
    `Envía una URL de Freepik y recibirás el archivo.\n\n` +
    `*Comandos:*\n` +
    `/start — Inicio\n` +
    `/creditos — Ver tu saldo\n` +
    `/estado — Ver tus estadísticas\n` +
    `/ayuda — Esta ayuda\n\n` +
    `*Botones del menú:*\n` +
    `🎨 Descargar — Cómo usar\n` +
    `💰 Créditos — Ver planes\n` +
    `📊 Mi Cuenta — Tus estadísticas\n\n` +
    `*Costo:* ${CREDITOS_POR_DESCARGA} créditos por descarga\n\n` +
    `Para recargar contacta al administrador.`,
    md()
  );
});

const KB_NAV = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🎨 Ir a Descargar', callback_data: 'nav_descargar' },
        { text: '💰 Ver Planes', callback_data: 'nav_creditos' },
      ],
      [
        { text: '📊 Mi Estado', callback_data: 'nav_estado' },
        { text: 'ℹ️ Ayuda', callback_data: 'nav_ayuda' },
      ],
    ],
  },
};

// ── Menú Descargar ────────────────────────────────────────────
async function mostrarDescargar(chatId, creditosUsuario = null) {
  const saldo = creditosUsuario !== null
    ? `💛 *Tu saldo:* ${creditosUsuario} créditos\n💡 *Costo por descarga:* ${CREDITOS_POR_DESCARGA} créditos\n\n`
    : '';
  await bot.sendMessage(chatId,
    `╔═══════════════════════════╗\n` +
    `║  🎨 DESCARGAR RECURSO  ║\n` +
    `╚═══════════════════════════╝\n\n` +
    saldo +
    `📎 Envíame un link de Freepik\n\n` +
    `┌─────────────────────────\n` +
    `│ Ejemplo:\n` +
    `│ magnific.se/free-vector/...\n` +
    `└─────────────────────────\n\n` +
    `Pégalo aquí y recibe tu archivo`,
    { parse_mode: 'Markdown', ...KB_NAV }
  );
}

// ── Menú Créditos / Planes ────────────────────────────────────
async function mostrarPlanes(chatId) {
  const caption =
    `╔═══════════════════════════╗\n` +
    `║  🛒 PLANES DE CRÉDITOS  ║\n` +
    `╚═══════════════════════════╝\n\n` +
    `💡 5 créditos = 1 descarga\n\n` +
    `═════════════════════════\n` +
    `🥉 Básico\n` +
    `═════════════════════════\n` +
    `💵 Precio: $1.50 USD (S/.5)\n` +
    `🎫 Créditos: 30\n` +
    `📝 Ideal para probar el servicio\n\n` +
    `═════════════════════════\n` +
    `🥈 Estándar ⭐\n` +
    `═════════════════════════\n` +
    `💵 Precio: $3 USD (S/.10)\n` +
    `🎫 Créditos: 100\n` +
    `📝 El más popular\n\n` +
    `═════════════════════════\n` +
    `🥇 Premium\n` +
    `═════════════════════════\n` +
    `💵 Precio: $6 USD (S/.20)\n` +
    `🎫 Créditos: 250 +25\n` +
    `📝 +25 créditos de regalo\n\n` +
    `═════════════════════════\n` +
    `💎 Profesional\n` +
    `═════════════════════════\n` +
    `💵 Precio: $12 USD (S/.40)\n` +
    `🎫 Créditos: 600 +100\n` +
    `📝 +100 créditos de regalo\n\n` +
    `💬 ¿Cómo comprar?\n` +
    `Selecciona un plan y contacta a un admin`;

  const mkPlanBtn = (key) => {
    const p = PLANES[key];
    const msg = encodeURIComponent(`Hola! Quiero comprar el ${p.nombre} (${p.precio}) para el bot de Freepik.`);
    return { text: `${p.emoji} ${p.nombre.replace('PLAN ','')}`, url: `https://t.me/+${ADMIN_PHONE}?text=${msg}` };
  };

  await bot.sendPhoto(chatId, PLANES_IMG, {
    caption,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🥉 Básico', callback_data: 'plan_basico' }, { text: '🥈 Estándar', callback_data: 'plan_estandar' }],
        [{ text: '🥇 Premium', callback_data: 'plan_premium' }, { text: '💎 Pro', callback_data: 'plan_pro' }],
        [{ text: '⬅️ Volver', callback_data: 'plan_premium' }],
      ],
    },
  });
}

// ── Mi Cuenta ─────────────────────────────────────────────────
async function mostrarCuenta(chatId, usuario) {
  const [[stats]] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(estado='exitoso') AS exitosas,
      SUM(estado='fallido') AS fallidas,
      COALESCE(SUM(creditos_usados), 0) AS gastados
    FROM descargas WHERE usuario_id = ?`,
    [usuario.id]
  );

  await bot.sendMessage(chatId,
    `╔═══════════════════════════╗\n` +
    `║  📊 MI CUENTA  ║\n` +
    `╚═══════════════════════════╝\n\n` +
    `💳 *Créditos disponibles:* ${usuario.creditos}\n` +
    `📥 *Descargas disponibles:* ~${Math.floor(usuario.creditos / CREDITOS_POR_DESCARGA)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📈 *HISTORIAL*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `� Total descargas: *${stats.total}*\n` +
    `✅ Exitosas: *${stats.exitosas ?? 0}*\n` +
    `❌ Fallidas: *${stats.fallidas ?? 0}*\n` +
    `💸 Créditos gastados: *${stats.gastados}*`,
    { parse_mode: 'Markdown', ...KB_NAV }
  );
}

// ── Procesar URL ──────────────────────────────────────────────
async function procesarUrl(msg, usuario, url) {
  if (usuario.creditos < CREDITOS_POR_DESCARGA) {
    return bot.sendMessage(msg.chat.id,
      `💳 *Sin créditos suficientes*\n\n` +
      `Tienes *${usuario.creditos}* créditos y se necesitan *${CREDITOS_POR_DESCARGA}*.\n\n` +
      `Usa 💰 *Créditos* para ver los planes.`,
      md()
    );
  }

  const procesando = await bot.sendMessage(msg.chat.id, `⏳ *Procesando descarga...*`, md());
  const descargaId = await registrarDescarga(usuario.id, url, 'pendiente');

  // ── Aquí va la lógica real de descarga ──
  setTimeout(async () => {
    try {
      await descontarCreditos(usuario.id, CREDITOS_POR_DESCARGA);
      await actualizarDescarga(descargaId, 'exitoso', 'archivo_ejemplo.zip', 'Vector');

      bot.editMessageText(
        `✅ *Descarga completada*\n\n` +
        `📁 Archivo: \`archivo_ejemplo.zip\`\n` +
        `📦 Tipo: Vector\n` +
        `💳 Créditos usados: *${CREDITOS_POR_DESCARGA}*\n` +
        `💰 Saldo restante: *${usuario.creditos - CREDITOS_POR_DESCARGA}*`,
        { chat_id: msg.chat.id, message_id: procesando.message_id, parse_mode: 'Markdown' }
      );
      console.log(`✅ Descarga ${descargaId} exitosa — usuario ${usuario.id}`);
    } catch (e) {
      await actualizarDescarga(descargaId, 'fallido', null, null, e.message);
      bot.editMessageText(
        `❌ *Error en la descarga*\n\nNo se descontaron créditos. Intenta de nuevo.`,
        { chat_id: msg.chat.id, message_id: procesando.message_id, parse_mode: 'Markdown' }
      );
      console.error(`❌ Descarga ${descargaId} fallida:`, e.message);
    }
  }, 2000);
}

// ── Manejador de mensajes ─────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text) return;
  const texto = msg.text.trim();
  if (texto.startsWith('/')) return;

  try {
    const usuario = await obtenerOCrearUsuario(msg);

    if (usuario.estado === 'baneado') {
      return bot.sendMessage(msg.chat.id, `⛔ Tu cuenta está suspendida.`, md());
    }

    if (texto === '🎨 Descargar') return mostrarDescargar(msg.chat.id, usuario.creditos);
    if (texto === '💰 Créditos') {
      return mostrarDetallePlan(msg.chat.id, 'plan_premium', usuario.creditos);
    }
    if (texto === '📊 Mi Cuenta') return mostrarCuenta(msg.chat.id, usuario);
    if (texto === 'ℹ️ Ayuda') {
      return bot.sendMessage(msg.chat.id,
        `ℹ️ *Ayuda*\n\n` +
        `Envía una URL de Freepik y recibirás el archivo.\n\n` +
        `*Comandos:*\n` +
        `/start — Inicio\n\n` +
        `*Botones:*\n` +
        `🎨 Descargar — Cómo usar\n` +
        `💰 Créditos — Ver planes\n` +
        `📊 Mi Cuenta — Tus estadísticas\n\n` +
        `*Costo:* ${CREDITOS_POR_DESCARGA} créditos por descarga`,
        md()
      );
    }

    const esUrl = texto.startsWith('http://') || texto.startsWith('https://');
    if (esUrl) return procesarUrl(msg, usuario, texto);

    bot.sendMessage(msg.chat.id,
      `❓ No entendí eso.\n\nEnvíame una URL de Freepik o usa los botones del menú.`,
      md()
    );
  } catch (err) {
    console.error('Error en mensaje:', err.message);
    bot.sendMessage(msg.chat.id, '❌ Error. Intenta de nuevo.');
  }
});

const PLANES = {
  plan_basico: {
    emoji: '🥉', nombre: 'PLAN BÁSICO',
    precio: '$1.50 USD (S/.5)', creditos: 30, bonus: 0,
    descargas: 6, porCredito: '$0.050',
    desc: 'Ideal para probar el servicio',
  },
  plan_estandar: {
    emoji: '🥈', nombre: 'PLAN ESTÁNDAR ⭐',
    precio: '$3 USD (S/.10)', creditos: 100, bonus: 0,
    descargas: 20, porCredito: '$0.030',
    desc: 'El más popular',
  },
  plan_premium: {
    emoji: '🥇', nombre: 'PLAN PREMIUM',
    precio: '$6 USD (S/.20)', creditos: 250, bonus: 25,
    descargas: 275, porCredito: '$0.022',
    desc: '+25 créditos de regalo',
  },
  plan_pro: {
    emoji: '💎', nombre: 'PLAN PROFESIONAL',
    precio: '$12 USD (S/.40)', creditos: 600, bonus: 100,
    descargas: 700, porCredito: '$0.017',
    desc: '+100 créditos de regalo',
  },
};

function captionPlan(p, creditosUsuario = null) {
  const total = p.creditos + p.bonus;
  return (
    `╔═══════════════════════════╗\n` +
    `║ ${p.emoji} ${p.nombre}\n` +
    `╚═══════════════════════════╝\n\n` +
    (creditosUsuario !== null ? `💛 Tus créditos actuales: ${creditosUsuario}\n\n` : '') +
    `💵 Precio: ${p.precio}\n` +
    `🎫 Créditos: ${total}\n` +
    `📊 Descargas: ~${p.descargas} recursos\n` +
    `💰 Por crédito: ${p.porCredito}\n` +
    (p.bonus > 0 ? `🎁 BONUS: +${p.bonus} créditos extra\n` : '') +
    `\n📝 ${p.desc}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💳 MÉTODOS DE PAGO\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `  • PayPal\n` +
    `  • Yape / Plin\n` +
    `  • Transferencia\n` +
    `  • Crypto (USDT)\n\n` +
    `📩 Contacta a un admin para comprar`
  );
}

async function mostrarDetallePlan(chatId, planKey, creditosUsuario) {
  const p = PLANES[planKey];
  await bot.sendPhoto(chatId, PLANES_IMG, {
    caption: captionPlan(p, creditosUsuario),
    parse_mode: 'Markdown',
    ...kbDetallePlan(planKey),
  });
}

function kbDetallePlan(planKey) {
  const p = PLANES[planKey];
  const msgTg = encodeURIComponent(`Hola! Quiero comprar el ${p.nombre} (${p.precio}) para el bot de Freepik.`);
  const msgWa = encodeURIComponent(`Hola! Quiero comprar el ${p.nombre} (${p.precio}) para el bot de Freepik.`);
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎨 Descargar', callback_data: 'nav_descargar' },
          { text: '📊 Mi Estado', callback_data: 'nav_estado' },
        ],
        [
          { text: '📲 WhatsApp', url: `https://wa.me/${ADMIN_PHONE}?text=${msgWa}` },
          { text: '✈️ Telegram', url: `https://t.me/+${ADMIN_PHONE}?text=${msgTg}` },
        ],
        [{ text: '⬅️ Ver todos los planes', callback_data: 'ver_planes' }],
      ],
    },
  };
}

// ── Callback inline ───────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  await bot.answerCallbackQuery(query.id);

  if (PLANES[data]) {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      return mostrarDetallePlan(chatId, data, usuario.creditos);
    } catch (e) { return mostrarDetallePlan(chatId, data, null); }
  }

  if (data === 'ver_planes') {
    try {
      return mostrarPlanes(chatId);
    } catch (e) { console.error('ver_planes error:', e.message); }
  }

  if (data === 'nav_descargar') {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      return mostrarDescargar(chatId, usuario.creditos);
    } catch(e) { return mostrarDescargar(chatId); }
  }
  if (data === 'nav_creditos') return mostrarPlanes(chatId);
  if (data === 'nav_estado') {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      return mostrarCuenta(chatId, usuario);
    } catch (e) { console.error('nav_estado error:', e.message); }
  }
  if (data === 'nav_ayuda') {
    return bot.sendMessage(chatId,
      `ℹ️ *Ayuda*\n\n` +
      `Envía una URL de Freepik y recibirás el archivo.\n\n` +
      `*Botones:*\n` +
      `🎨 Descargar — Cómo usar\n` +
      `💰 Créditos — Ver planes\n` +
      `📊 Estado — Tus estadísticas\n\n` +
      `*Costo:* ${CREDITOS_POR_DESCARGA} créditos por descarga\n\n` +
      `Para recargar contacta al administrador.`,
      { parse_mode: 'Markdown', ...KB_NAV }
    );
  }

  if (data === 'volver_inicio') {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      const nombre = query.from.first_name;
      bot.sendMessage(chatId,
        `👋 *¡Hola ${nombre}!*\n\n💛 *Créditos:* ${usuario.creditos}\n\nEnvíame una URL de Freepik.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              ['🎨 Descargar', '💰 Créditos'],
              ['📊 Mi Cuenta', 'ℹ️ Ayuda'],
            ],
            resize_keyboard: true,
            persistent: true,
          },
        }
      );
    } catch (e) { console.error('volver_inicio error:', e.message); }
  }
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
