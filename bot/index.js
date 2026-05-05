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

const ayudaTexto = () =>
  `ℹ️ *Ayuda*\n\n` +
  `Envía una URL de Freepik y recibirás el archivo.\n\n` +
  `*Comandos:*\n` +
  `/start — Inicio\n` +
  `/descargar — Ir a descargar\n` +
  `/creditos — Ver tu saldo\n` +
  `/micuenta — Ver tu cuenta\n` +
  `/historial — Tus movimientos\n` +
  `/topcreditos — Ranking global\n` +
  `/estado — Ver tus estadísticas\n` +
  `/ayuda — Esta ayuda\n\n` +
  `*Botones del menú:*\n` +
  `🎨 Descargar — Cómo usar\n` +
  `💰 Créditos — Ver planes\n` +
  `📊 Mi Cuenta — Tus estadísticas\n\n` +
  `*Costo:* ${CREDITOS_POR_DESCARGA} créditos por descarga\n\n` +
  `Para recargar contacta al administrador.`;

async function enviarInicio(chatId, nombre, creditos) {
  return bot.sendMessage(chatId,
    `👋 *¡Hola ${nombre}!*\n\n` +
    `🎨 *Bot Descargador de Freepik*\n\n` +
    `💛 *Créditos:* ${creditos}\n\n` +
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
    `/micuenta — Ver tu cuenta\n` +
    `/historial — Tus movimientos\n` +
    `/topcreditos — Ranking global\n` +
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
}

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

    await enviarInicio(msg.chat.id, nombre, usuario.creditos);
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

// ── /micuenta (y /mi cuenta) ────────────────────────────────
bot.onText(/\/(?:mi\s*cuenta|micuenta)\b/i, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarCuenta(msg.chat.id, usuario);
  } catch (err) { console.error('/micuenta error:', err.message); }
});

// ── /historial ───────────────────────────────────────────────
bot.onText(/\/historial\b/i, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarHistorialUsuario(msg.chat.id, usuario);
  } catch (err) { console.error('/historial error:', err.message); }
});

// ── /topcreditos o /topusuarios ──────────────────────────────
bot.onText(/\/(?:topcreditos|topusuarios)\b/i, async (msg) => {
  try {
    await mostrarTopCreditos(msg.chat.id);
  } catch (err) { console.error('/topcreditos error:', err.message); }
});

// ── /ayuda ────────────────────────────────────────────────────
bot.onText(/\/ayuda/, async (msg) => {
  bot.sendMessage(msg.chat.id, ayudaTexto(), md());

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

const KB_CUENTA = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '⬅️ Volver', callback_data: 'volver_inicio' }],
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
  const [[perfil]] = await pool.query(
    `SELECT telegram_id, first_name, last_name, username
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [usuario.id]
  );

  const [[stats]] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(estado='exitoso') AS exitosas,
      SUM(estado='fallido') AS fallidas,
      COALESCE(SUM(creditos_usados), 0) AS gastados
    FROM descargas WHERE usuario_id = ?`,
    [usuario.id]
  );

  const [[ventana]] = await pool.query(
    `SELECT
      SUM(fecha >= DATE_SUB(NOW(), INTERVAL 1 MINUTE) AND estado = 'exitoso') AS exitosas_minuto,
      SUM(fecha >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)) AS total_minuto,
      SUM(fecha >= DATE_SUB(NOW(), INTERVAL 1 HOUR) AND estado = 'exitoso') AS exitosas_hora,
      SUM(fecha >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) AS total_hora,
      SUM(DATE(fecha) = CURDATE() AND estado = 'exitoso') AS exitosas_hoy,
      SUM(DATE(fecha) = CURDATE()) AS total_hoy
     FROM descargas
     WHERE usuario_id = ?`,
    [usuario.id]
  );

  const nombre = [perfil?.first_name, perfil?.last_name].filter(Boolean).join(' ') || 'Usuario';
  const total = Number(stats?.total || 0);
  const minEx = Number(ventana?.exitosas_minuto || 0);
  const minTot = Number(ventana?.total_minuto || 0);
  const horaEx = Number(ventana?.exitosas_hora || 0);
  const horaTot = Number(ventana?.total_hora || 0);
  const hoyEx = Number(ventana?.exitosas_hoy || 0);
  const hoyTot = Number(ventana?.total_hoy || 0);

  await bot.sendMessage(chatId,
    `👤 *${nombre}*\n` +
    `🆔 \`${perfil?.telegram_id || '-'}\`\n\n` +
    `🟢 *CRÉDITOS:* *${usuario.creditos}*\n\n` +
    `📈 *ESTADÍSTICAS*\n\n` +
    `📦 Total descargas: *${total}*\n` +
    `⏱ Último minuto: *${minEx}/${minTot}*\n` +
    `🕒 Última hora: *${horaEx}/${horaTot}*\n` +
    `📅 Hoy: *${hoyEx}/${hoyTot}*\n\n` +
    `💸 Créditos gastados: *${Number(stats?.gastados || 0)}*`,
    { parse_mode: 'Markdown', ...KB_CUENTA }
  );
}

async function mostrarHistorialUsuario(chatId, usuario) {
  const [rows] = await pool.query(
    `SELECT delta, tipo, DATE_FORMAT(fecha_raw, '%Y-%m-%d') AS fecha
     FROM (
       SELECT r.creditos AS delta, 'admin_add' AS tipo, r.fecha AS fecha_raw
       FROM recargas r
       WHERE r.usuario_id = ?

       UNION ALL

       SELECT -d.creditos_usados AS delta, 'usage' AS tipo, d.fecha AS fecha_raw
       FROM descargas d
       WHERE d.usuario_id = ? AND d.estado = 'exitoso'
     ) t
     ORDER BY fecha_raw DESC
     LIMIT 12`,
    [usuario.id, usuario.id]
  );

  if (!rows.length) {
    return bot.sendMessage(
      chatId,
      `📜 HISTORIAL\n\nAún no tienes movimientos de créditos.`,
      { ...KB_CUENTA }
    );
  }

  const lineas = rows.map((r) => {
    const delta = Number(r.delta || 0);
    const signo = delta >= 0 ? '+' : '';
    return `${signo}${delta} | ${r.tipo} | ${r.fecha}`;
  });

  return bot.sendMessage(
    chatId,
    `📜 HISTORIAL\n\n${lineas.join('\n')}\n\nSaldo actual: ${usuario.creditos}`,
    { ...KB_CUENTA }
  );
}

async function mostrarTopCreditos(chatId) {
  const [rows] = await pool.query(
    `SELECT
      u.id,
      CONCAT(IFNULL(u.first_name, 'Usuario'), IFNULL(CONCAT(' ', u.last_name), '')) AS nombre,
      COALESCE(SUM(CASE WHEN r.creditos > 0 THEN r.creditos ELSE 0 END), 0) AS total_creditos
     FROM usuarios u
     JOIN recargas r ON r.usuario_id = u.id
     GROUP BY u.id, u.first_name, u.last_name
     HAVING total_creditos > 0
     ORDER BY total_creditos DESC
     LIMIT 10`
  );

  if (!rows.length) {
    return bot.sendMessage(
      chatId,
      `🏆 TOP USUARIOS\n\nAún no hay recargas registradas.`,
      { ...KB_CUENTA }
    );
  }

  const podio = ['🥇', '🥈', '🥉'];
  const lineas = rows.map((r, idx) => {
    const badge = podio[idx] || `${idx + 1}.`;
    const nombre = (r.nombre || 'Usuario').trim();
    return `${badge} ${nombre} | ${Number(r.total_creditos)} créditos`;
  });

  return bot.sendMessage(
    chatId,
    `🏆 TOP USUARIOS\n\n📊 Por créditos adquiridos\n\n${lineas.join('\n')}`,
    { ...KB_CUENTA }
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
    return bot.sendMessage(chatId, ayudaTexto(), { parse_mode: 'Markdown', ...KB_NAV });
  }

  if (data === 'volver_inicio') {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      const nombre = query.from.first_name;
      return enviarInicio(chatId, nombre, usuario.creditos);
    } catch (e) { console.error('volver_inicio error:', e.message); }
  }

  if (data === 'regresar_inicio_total') {
    try {
      const usuario = await obtenerOCrearUsuario(query.message);
      const nombre = query.from.first_name;
      return enviarInicio(chatId, nombre, usuario.creditos);
    } catch (e) { console.error('volver_inicio error:', e.message); }
  }
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
