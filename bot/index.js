require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

// ============================================================
// CONFIGURACIÓN
// ============================================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('Falta TELEGRAM_BOT_TOKEN en .env.local'); process.exit(1); }

const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY || '';
const FREEPIK_BASE_URL = process.env.FREEPIK_BASE_URL || 'https://api.freepik.com/v1';
const MAX_TELEGRAM_BYTES = 49 * 1024 * 1024;
const FREEPIK_TIMEOUT_MS = Number(process.env.FREEPIK_TIMEOUT_MS || 30000);
const CREDITOS_POR_DESCARGA = 5;
const WELCOME_CREDITS = 5;
const PLANES_IMG = path.join(process.cwd(), 'public', 'planes.jpg');
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
const ADMIN_PHONE = process.env.ADMIN_PHONE || '51918424284';
const ADMIN_TG = process.env.ADMIN_TG || 'tuadmin';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '51918424284';

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('🤖 Bot iniciado con polling...');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'telegram_bot',
  waitForConnections: true,
  connectionLimit: 10,
});

const html = (extra = {}) => ({ parse_mode: 'HTML', ...extra });
const md = (extra = {}) => ({ parse_mode: 'Markdown', ...extra });

// ============================================================
// FUNCIONES DE BASE DE DATOS
// ============================================================

async function obtenerOCrearUsuario(msg) {
  const from = msg.from || msg.chat;
  const { id: telegram_id, username, first_name, last_name } = from;
  const chat_id = msg.chat ? msg.chat.id : telegram_id;

  const [[existente]] = await pool.query(
    'SELECT id, creditos, estado FROM usuarios WHERE telegram_id = ?',
    [telegram_id]
  );

  if (existente) {
    await pool.query('UPDATE usuarios SET ultima_actividad = NOW() WHERE id = ?', [existente.id]).catch(() => {});
    return existente;
  }

  const [result] = await pool.query(
    'INSERT INTO usuarios (telegram_id, username, first_name, last_name, chat_id, creditos, estado) VALUES (?, ?, ?, ?, ?, ?, "activo")',
    [telegram_id, username || null, first_name, last_name || null, chat_id, WELCOME_CREDITS]
  );
  console.log(`👤 Nuevo usuario: ${first_name} (${telegram_id})`);
  return { id: result.insertId, creditos: WELCOME_CREDITS, estado: 'activo' };
}

async function obtenerUsuarioPorTelegramId(telegramId) {
  const [[row]] = await pool.query(
    'SELECT id, telegram_id, username, first_name, last_name, creditos, estado FROM usuarios WHERE telegram_id = ?',
    [telegramId]
  );
  return row || null;
}

async function registrarDescarga(usuario_id, url, estado = 'pendiente') {
  const [result] = await pool.query(
    'INSERT INTO descargas (usuario_id, url_solicitada, estado, creditos_usados) VALUES (?, ?, ?, ?)',
    [usuario_id, url, estado, CREDITOS_POR_DESCARGA]
  );
  return result.insertId;
}

async function actualizarDescargaFinal(id, estado, nombre_archivo = null, tipo = null, tamano_mb = null, mensaje_error = null) {
  await pool.query(
    'UPDATE descargas SET estado = ?, nombre_archivo = ?, tipo = ?, tamano_mb = ?, mensaje_error = ? WHERE id = ?',
    [estado, nombre_archivo, tipo, tamano_mb, mensaje_error, id]
  );
}

async function descontarCreditos(usuario_id, cantidad) {
  await pool.query('UPDATE usuarios SET creditos = creditos - ? WHERE id = ?', [cantidad, usuario_id]);
}

async function sumarCreditos(usuario_id, cantidad) {
  await pool.query('UPDATE usuarios SET creditos = creditos + ? WHERE id = ?', [cantidad, usuario_id]);
}

async function setCreditos(usuario_id, cantidad) {
  await pool.query('UPDATE usuarios SET creditos = ? WHERE id = ?', [cantidad, usuario_id]);
}

async function registrarRecarga(usuario_id, creditos, creditos_antes, creditos_despues, metodo, nota) {
  await pool.query(
    'INSERT INTO recargas (usuario_id, creditos, creditos_antes, creditos_despues, metodo, nota, fecha) VALUES (?, ?, ?, ?, ?, ?, NOW())',
    [usuario_id, creditos, creditos_antes, creditos_despues, metodo, nota]
  );
}

async function esAdmin(telegramId) {
  return ADMIN_IDS.includes(Number(telegramId));
}

// ============================================================
// UTILIDADES FREEPIK
// ============================================================

function esUrlRecursoValido(url) {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    const host = hostname.toLowerCase();
    const dominios = ['freepik.com', 'freepik.es', 'freepik.de', 'freepik.fr', 'magnific.com', 'magnific.ai', 'magnific.se', 'magnific.cc'];
    return dominios.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}

function extraerResourceId(url) {
  const patrones = [/_(\d+)\.htm/i, /\/(\d+)\.htm/i, /[_/](\d{6,})(?:\.|$)/i];
  for (const patron of patrones) {
    const match = url.match(patron);
    if (match) return match[1];
  }
  return null;
}

function sanitizarNombreArchivo(filename) {
  const base = path.basename(filename || 'freepik_recurso.zip');
  return base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '.').slice(0, 200);
}

async function getJsonFreepik(endpoint) {
  if (!FREEPIK_API_KEY) throw new Error('FREEPIK_API_KEY no configurada en .env.local');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FREEPIK_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${FREEPIK_BASE_URL}${endpoint}`, {
      headers: { 'x-freepik-api-key': FREEPIK_API_KEY, 'Accept-Language': 'es-ES' },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`Timeout Freepik API (${FREEPIK_TIMEOUT_MS}ms)`);
    throw err;
  } finally { clearTimeout(timeout); }
  if (!res.ok) {
    if (res.status === 404) throw new Error('Recurso no encontrado en Freepik API');
    if (res.status === 402) throw new Error('Créditos insuficientes en Freepik API');
    const text = await res.text();
    throw new Error(`Freepik API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data || json;
}

async function obtenerInfoRecurso(resourceId) {
  return getJsonFreepik(`/resources/${resourceId}`);
}

async function obtenerInfoDescarga(resourceId) {
  return getJsonFreepik(`/resources/${resourceId}/download`);
}

async function descargarArchivoTemporal(url, nombreSugerido) {
  const safeName = sanitizarNombreArchivo(nombreSugerido);
  const tmpPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmpPath));
  const stat = await fsp.stat(tmpPath);
  return { filePath: tmpPath, fileName: safeName, sizeBytes: Number(stat.size || 0) };
}

// ============================================================
// PLANES
// ============================================================

const PLANES = {
  plan_basico:   { emoji: '🥉', nombre: 'PLAN BÁSICO',       precio: '$1.50 USD (S/.5)',  creditos: 30,  bonus: 0,   descargas: 6,   porCredito: '$0.050', desc: 'Ideal para probar el servicio' },
  plan_estandar: { emoji: '🥈', nombre: 'PLAN ESTÁNDAR ⭐',  precio: '$3 USD (S/.10)',    creditos: 100, bonus: 0,   descargas: 20,  porCredito: '$0.030', desc: 'El más popular' },
  plan_premium:  { emoji: '🥇', nombre: 'PLAN PREMIUM',      precio: '$6 USD (S/.20)',    creditos: 250, bonus: 25,  descargas: 55,  porCredito: '$0.022', desc: '+25 créditos de regalo' },
  plan_pro:      { emoji: '💎', nombre: 'PLAN PROFESIONAL',  precio: '$12 USD (S/.40)',   creditos: 600, bonus: 100, descargas: 140, porCredito: '$0.017', desc: '+100 créditos de regalo' },
};

function textoPlanesCompleto() {
  return (
    '╔═══════════════════════════╗\n' +
    '║  🛒 <b>PLANES DE CRÉDITOS</b>  ║\n' +
    '╚═══════════════════════════╝\n\n' +
    '💡 <i>5 créditos = 1 descarga</i>\n\n' +
    '═════════════════════════\n' +
    '🥉 <b>Básico</b>\n' +
    '═════════════════════════\n' +
    '💵 Precio: <b>$1.50 USD (S/.5)</b>\n' +
    '🎫 Créditos: 30\n' +
    '📝 <i>Ideal para probar el servicio</i>\n\n' +
    '═════════════════════════\n' +
    '🥈 <b>Estándar</b> ⭐\n' +
    '═════════════════════════\n' +
    '💵 Precio: <b>$3 USD (S/.10)</b>\n' +
    '🎫 Créditos: 100\n' +
    '📝 <i>El más popular</i>\n\n' +
    '═════════════════════════\n' +
    '🥇 <b>Premium</b>\n' +
    '═════════════════════════\n' +
    '💵 Precio: <b>$6 USD (S/.20)</b>\n' +
    '🎫 Créditos: 250 <b>+25</b>\n' +
    '📝 <i>+25 créditos de regalo</i>\n\n' +
    '═════════════════════════\n' +
    '💎 <b>Profesional</b>\n' +
    '═════════════════════════\n' +
    '💵 Precio: <b>$12 USD (S/.40)</b>\n' +
    '🎫 Créditos: 600 <b>+100</b>\n' +
    '📝 <i>+100 créditos de regalo</i>\n\n' +
    '💬 <b>¿Cómo comprar?</b>\n' +
    'Selecciona un plan y contacta a un admin'
  );
}

function textoPlanDetalle(p) {
  const total = p.creditos + p.bonus;
  const bonusLine = p.bonus > 0 ? `\n🎁 <b>BONUS:</b> +${p.bonus} créditos extra` : '';
  return (
    `╔═══════════════════════════╗\n` +
    `║ ${p.emoji} <b>PLAN ${p.nombre.replace('PLAN ', '')}</b>\n` +
    `╚═══════════════════════════╝\n\n` +
    `💵 <b>Precio:</b> ${p.precio}\n` +
    `🎫 <b>Créditos:</b> ${total}\n` +
    `📊 <b>Descargas:</b> ~${p.descargas} recursos\n` +
    `💰 <b>Por crédito:</b> ${p.porCredito}` +
    bonusLine + `\n\n` +
    `📝 <i>${p.desc}</i>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💳 <b>MÉTODOS DE PAGO</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `  • PayPal\n` +
    `  • Yape / Plin\n` +
    `  • Transferencia\n` +
    `  • Crypto (USDT)\n\n` +
    `📩 <i>Contacta a un admin para comprar</i>`
  );
}

function kbDetallePlan(planKey) {
  const p = PLANES[planKey];
  const msg = encodeURIComponent(`Hola! Quiero comprar el ${p.nombre} (${p.precio}) para el bot de Freepik.`);
  return {
    inline_keyboard: [
      [
        { text: '📲 WhatsApp', url: `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}` },
        { text: '✈️ Telegram', url: `https://t.me/${ADMIN_TG}?text=${msg}` },
      ],
      [{ text: '⬅️ Ver todos los planes', callback_data: 'buy' }],
    ],
  };
}

function kbInlineMenu() {
  return {
    inline_keyboard: [
      [
        { text: '📥 Descargar', callback_data: 'help' },
        { text: '💰 Créditos', callback_data: 'credits' },
      ],
      [
        { text: '🛒 Comprar', callback_data: 'buy' },
        { text: '📊 Mi cuenta', callback_data: 'stats' },
      ],
      [
        { text: 'ℹ️ Info', callback_data: 'info' },
      ],
    ],
  };
}

// ============================================================
// TECLADO PRINCIPAL (reply keyboard)
// ============================================================

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

// ============================================================
// TEXTOS Y RESPUESTAS
// ============================================================

function textoAyuda() {
  return (
    '╔═══════════════════════════╗\n' +
    '║      ❓ <b>AYUDA</b>      ║\n' +
    '╚═══════════════════════════╝\n\n' +
    '📦 <b>DESCARGAS</b>\n' +
    '┌─────────────────────────\n' +
    '│ 🎨 Vectores (AI, EPS, SVG)\n' +
    '│ 📷 Fotos (JPG, PNG)\n' +
    '│ 🖼️ PSD (Photoshop)\n' +
    '└─────────────────────────\n\n' +
    '💳 <b>CRÉDITOS</b>\n' +
    '┌─────────────────────────\n' +
    `│ ${CREDITOS_POR_DESCARGA} créditos = 1 descarga\n` +
    '│ /creditos → Ver saldo\n' +
    '│ /comprar → Recargar\n' +
    '└─────────────────────────\n\n' +
    '📋 <b>COMANDOS</b>\n' +
    '┌─────────────────────────\n' +
    '│ /start — Inicio\n' +
    '│ /menu — Menú principal\n' +
    '│ /creditos — Ver saldo\n' +
    '│ /comprar — Comprar créditos\n' +
    '│ /stats — Estadísticas\n' +
    '│ /info — Mi perfil\n' +
    '│ /historial — Historial\n' +
    '│ /topusers — Ranking\n' +
    '│ /help — Esta ayuda\n' +
    '└─────────────────────────'
  );
}

async function enviarInicio(chatId, nombre, creditos) {
  const statusEmoji = creditos > 10 ? '🟢' : creditos > 0 ? '🟡' : '🔴';
  return bot.sendMessage(chatId,
    `👋 <b>¡Hola ${nombre}!</b>\n\n` +
    `🎨 <b>Bot Descargador de Freepik</b>\n\n` +
    `${statusEmoji} <b>Créditos disponibles:</b> ${creditos}\n\n` +
    `📌 <b>¿Cómo usar?</b>\n` +
    `1️⃣ Copia un link de Freepik\n` +
    `2️⃣ Pégalo aquí directamente\n` +
    `3️⃣ ¡Recibe tu archivo!\n\n` +
    `💡 Cada descarga usa <b>${CREDITOS_POR_DESCARGA}</b> créditos\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 <b>COMANDOS DISPONIBLES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `/menu — 📱 Menú principal\n` +
    `/creditos — 💰 Ver mi saldo\n` +
    `/comprar — 🛒 Comprar créditos\n` +
    `/stats — 📊 Mis estadísticas\n` +
    `/info — ℹ️ Mi perfil completo\n` +
    `/historial — 📜 Historial de créditos\n` +
    `/topusers — 🏆 Ranking de usuarios\n` +
    `/help — ❓ Ayuda detallada`,
    {
      parse_mode: 'HTML',
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

// ============================================================
// FUNCIONES DE VISUALIZACIÓN
// ============================================================

async function mostrarDescargar(chatId, creditosUsuario = null) {
  const saldoLine = creditosUsuario !== null
    ? `💛 <b>Tu saldo:</b> ${creditosUsuario} créditos\n💡 <b>Costo:</b> ${CREDITOS_POR_DESCARGA} créditos/descarga\n\n`
    : '';
  await bot.sendMessage(chatId,
    '╔═══════════════════════════╗\n' +
    '║  🎨 <b>DESCARGAR RECURSO</b>  ║\n' +
    '╚═══════════════════════════╝\n\n' +
    saldoLine +
    '📎 Envíame un link de Freepik\n\n' +
    '┌─────────────────────────\n' +
    '│ Formatos soportados:\n' +
    '│ 🎨 Vectores (AI, EPS, SVG)\n' +
    '│ 📷 Fotos (JPG, PNG)\n' +
    '│ 🖼️ PSD (Photoshop)\n' +
    '└─────────────────────────\n\n' +
    'Pégalo aquí y recibe tu archivo 📥',
    html()
  );
}

async function mostrarPlanes(chatId) {
  const caption = textoPlanesCompleto();
  const inline_keyboard = [
    [{ text: '🥉 Básico', callback_data: 'plan_basico' }, { text: '🥈 Estándar', callback_data: 'plan_estandar' }],
    [{ text: '🥇 Premium', callback_data: 'plan_premium' }, { text: '💎 Pro', callback_data: 'plan_pro' }],
    [{ text: '⬅️ Volver', callback_data: 'menu' }],
  ];
  if (fs.existsSync(PLANES_IMG)) {
    await bot.sendPhoto(chatId, PLANES_IMG, { caption, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
  } else {
    await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: { inline_keyboard } });
  }
}

async function mostrarDetallePlan(chatId, planKey) {
  const p = PLANES[planKey];
  if (!p) return;
  const caption = textoPlanDetalle(p);
  const reply_markup = { inline_keyboard: kbDetallePlan(planKey) };
  if (fs.existsSync(PLANES_IMG)) {
    await bot.sendPhoto(chatId, PLANES_IMG, { caption, parse_mode: 'HTML', reply_markup });
  } else {
    await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup });
  }
}

async function mostrarCuenta(chatId, usuario) {
  const [[perfil]] = await pool.query(
    'SELECT telegram_id, first_name, last_name, username FROM usuarios WHERE id = ? LIMIT 1',
    [usuario.id]
  );
  const [[stats]] = await pool.query(
    'SELECT COUNT(*) AS total, SUM(estado="exitoso") AS exitosas, COALESCE(SUM(creditos_usados),0) AS gastados FROM descargas WHERE usuario_id = ?',
    [usuario.id]
  );
  const [[hoy]] = await pool.query(
    'SELECT COUNT(*) AS total_hoy, SUM(estado="exitoso") AS exitosas_hoy FROM descargas WHERE usuario_id = ? AND DATE(fecha) = CURDATE()',
    [usuario.id]
  );

  const nombre = [perfil?.first_name, perfil?.last_name].filter(Boolean).join(' ') || 'Usuario';
  const creds = Number(usuario.creditos || 0);
  const maxBar = 100;
  const blocks = Math.min(10, Math.floor((Math.min(creds, maxBar) / maxBar) * 10));
  const bar = '█'.repeat(blocks) + '░'.repeat(10 - blocks);
  const statusEmoji = creds > 10 ? '🟢' : creds > 0 ? '🟡' : '🔴';

  await bot.sendMessage(chatId,
    '╔═══════════════════════════╗\n' +
    '║    📊 <b>MI CUENTA</b>    ║\n' +
    '╚═══════════════════════════╝\n\n' +
    `${statusEmoji} <b>CRÉDITOS</b>\n` +
    `<code>[${bar}]</code> ${creds}\n\n` +
    '📈 <b>ESTADÍSTICAS</b>\n' +
    '┌─────────────────────────\n' +
    `│ 📥 Total descargas: <b>${Number(stats?.total || 0)}</b>\n` +
    `│ ✅ Exitosas: <b>${Number(stats?.exitosas || 0)}</b>\n` +
    `│ 💸 Créditos usados: <b>${Number(stats?.gastados || 0)}</b>\n` +
    `│ 📅 Hoy: <b>${Number(hoy?.exitosas_hoy || 0)}/${Number(hoy?.total_hoy || 0)}</b>\n` +
    '└─────────────────────────',
    html({ reply_markup: { inline_keyboard: [[{ text: '🛒 Comprar créditos', callback_data: 'buy' }, { text: '⬅️ Volver', callback_data: 'menu' }]] } })
  );
}

async function mostrarInfo(chatId, usuario, fromUser) {
  const [[perfil]] = await pool.query(
    'SELECT telegram_id, first_name, last_name, username, estado, creditos, creado_en FROM usuarios WHERE id = ? LIMIT 1',
    [usuario.id]
  );
  const [[dlStats]] = await pool.query(
    'SELECT COUNT(*) AS total, COALESCE(SUM(creditos_usados), 0) AS gastados FROM descargas WHERE usuario_id = ? AND estado = "exitoso"',
    [usuario.id]
  );
  const [[recargaStats]] = await pool.query(
    'SELECT COALESCE(SUM(creditos), 0) AS total_recargado FROM recargas WHERE usuario_id = ? AND creditos > 0',
    [usuario.id]
  );
  const adminUser = await esAdmin(fromUser.id);
  const username_display = perfil?.username ? `@${perfil.username}` : '—';
  const statusIcons = { activo: '✅', inactivo: '⏸️', baneado: '🚫' };
  const statusIcon = statusIcons[perfil?.estado] || '❓';
  const fechaReg = perfil?.creado_en ? String(perfil.creado_en).slice(0, 10) : '—';
  const creds = Number(perfil?.creditos || 0);
  const credEmoji = creds > 10 ? '🟢' : creds > 0 ? '🟡' : '🔴';

  await bot.sendMessage(chatId,
    '╔═══════════════════════════╗\n' +
    '║    ℹ️ <b>MI PERFIL</b>    ║\n' +
    '╚═══════════════════════════╝\n\n' +
    `👤 <b>${perfil?.first_name || ''} ${perfil?.last_name || ''}</b>\n` +
    `📛 ${username_display}\n` +
    `🆔 <code>${perfil?.telegram_id}</code>\n\n` +
    '📋 <b>CUENTA</b>\n' +
    '┌─────────────────────────\n' +
    `│ ${statusIcon} Estado: <b>${perfil?.estado}</b>\n` +
    `│ ${credEmoji} Créditos: <b>${creds}</b>\n` +
    `│ 📥 Descargas exitosas: <b>${Number(dlStats?.total || 0)}</b>\n` +
    `│ � Créditos usados: <b>${Number(dlStats?.gastados || 0)}</b>\n` +
    `│ � Total recargado: <b>${Number(recargaStats?.total_recargado || 0)}</b>\n` +
    `│ 📅 Miembro desde: <b>${fechaReg}</b>\n` +
    `│ 👑 Admin: <b>${adminUser ? 'Sí' : 'No'}</b>\n` +
    '└─────────────────────────',
    html({ reply_markup: { inline_keyboard: [[{ text: '📊 Ver estadísticas', callback_data: 'stats' }, { text: '⬅️ Volver', callback_data: 'menu' }]] } })
  );
}

async function mostrarCreditos(chatId, usuario) {
  const creds = Number(usuario.creditos || 0);
  const statusEmoji = creds > 10 ? '🟢' : creds > 0 ? '🟡' : '🔴';
  const statusText = creds > 50 ? 'Excelente' : creds > 10 ? 'Bien' : creds > 0 ? 'Bajo' : 'Vacío';
  const warning = creds < CREDITOS_POR_DESCARGA ? '⚠️ <i>¡Recarga pronto!</i>' : '✅ <i>Listo para descargar</i>';

  const [[dlStats]] = await pool.query(
    'SELECT COUNT(*) AS total FROM descargas WHERE usuario_id = ? AND estado = "exitoso"',
    [usuario.id]
  );

  await bot.sendMessage(chatId,
    '💰 <b>MIS CRÉDITOS</b>\n\n' +
    `${statusEmoji} Estado: <b>${statusText}</b>\n` +
    `💳 <b>${creds}</b> créditos disponibles\n\n` +
    `📥 Descargas: <b>${Number(dlStats?.total || 0)}</b>\n` +
    `💸 Costo: ${CREDITOS_POR_DESCARGA}/descarga\n\n` +
    warning,
    html({
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Comprar créditos', callback_data: 'buy' }, { text: '📜 Historial', callback_data: 'credit_history' }],
          [{ text: '⬅️ Volver', callback_data: 'menu' }],
        ],
      },
    })
  );
}

async function mostrarHistorial(chatId, usuario) {
  const [rows] = await pool.query(
    `SELECT delta, tipo, DATE_FORMAT(fecha_raw, '%Y-%m-%d') AS fecha
     FROM (
       SELECT r.creditos AS delta, r.metodo AS tipo, r.fecha AS fecha_raw FROM recargas r WHERE r.usuario_id = ?
       UNION ALL
       SELECT -d.creditos_usados AS delta, 'descarga' AS tipo, d.fecha AS fecha_raw FROM descargas d WHERE d.usuario_id = ? AND d.estado = 'exitoso'
     ) t ORDER BY fecha_raw DESC LIMIT 12`,
    [usuario.id, usuario.id]
  );

  if (!rows.length) {
    return bot.sendMessage(chatId,
      '📜 <b>HISTORIAL</b>\n\nNo tienes transacciones aún.',
      html({ reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'menu' }]] } })
    );
  }

  const lineas = rows.map((r) => {
    const delta = Number(r.delta || 0);
    const signo = delta >= 0 ? '➕' : '➖';
    return `${signo} <b>${Math.abs(delta)}</b> │ ${r.tipo} │ ${r.fecha}`;
  });

  return bot.sendMessage(chatId,
    '📜 <b>HISTORIAL</b>\n\n' + lineas.join('\n'),
    html({ reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'credits' }]] } })
  );
}

async function mostrarTopUsers(chatId) {
  const [rows] = await pool.query(
    `SELECT u.first_name, u.last_name, u.username,
       COUNT(d.id) AS total_descargas
     FROM usuarios u
     LEFT JOIN descargas d ON d.usuario_id = u.id AND d.estado = 'exitoso'
     GROUP BY u.id ORDER BY total_descargas DESC LIMIT 10`
  );

  if (!rows.length) {
    return bot.sendMessage(chatId,
      '╔═══════════════════════════╗\n║   🏆 <b>TOP USUARIOS</b>   ║\n╚═══════════════════════════╝\n\nNo hay usuarios registrados.',
      html()
    );
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lineas = rows.map((u, i) => {
    const medal = medals[i] || `${i + 1}.`;
    const nombre = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 12);
    return `${medal} <b>${nombre}</b> │ ${u.total_descargas} descargas`;
  });

  return bot.sendMessage(chatId,
    '╔═══════════════════════════╗\n║   🏆 <b>TOP USUARIOS</b>   ║\n╚═══════════════════════════╝\n\n📊 <b>Por descargas</b>\n────────────────────────\n' + lineas.join('\n'),
    html()
  );
}

// ============================================================
// PANEL ADMIN
// ============================================================

async function mostrarPanelAdmin(chatId) {
  const [[totUsers]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
  const [[activos]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "activo"');
  const [[pendientes]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "inactivo"');
  const [[baneados]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "baneado"');
  const [[totDl]] = await pool.query('SELECT COUNT(*) AS total FROM descargas');
  const [[totCreds]] = await pool.query('SELECT COALESCE(SUM(creditos), 0) AS total FROM usuarios');

  await bot.sendMessage(chatId,
    '╔═══════════════════════════╗\n' +
    '║   🔧 <b>PANEL ADMIN</b>   ║\n' +
    '╚═══════════════════════════╝\n\n' +
    '📊 <b>RESUMEN</b>\n' +
    '┌─────────────────────────\n' +
    `│ 👥 Usuarios: <b>${totUsers.total}</b>\n` +
    `│ ✅ Activos: <b>${activos.total}</b>\n` +
    `│ ⏸️ Inactivos: <b>${pendientes.total}</b>\n` +
    `│ 🚫 Baneados: <b>${baneados.total}</b>\n` +
    '├─────────────────────────\n' +
    `│ 📥 Descargas: <b>${totDl.total}</b>\n` +
    `│ 💰 Créditos en sistema: <b>${Number(totCreds.total)}</b>\n` +
    '└─────────────────────────',
    html({
      reply_markup: {
        inline_keyboard: [
          [
            { text: `⏸️ Inactivos (${pendientes.total})`, callback_data: 'admin_pending' },
            { text: '👥 Usuarios', callback_data: 'admin_users' },
          ],
          [
            { text: '📋 Descargas', callback_data: 'admin_logs' },
            { text: '🏆 Top Users', callback_data: 'admin_top' },
          ],
          [{ text: '🔄 Actualizar', callback_data: 'admin_refresh' }],
        ],
      },
    })
  );
}

async function notificarAdminsNuevoUsuario(usuario) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Aprobar', callback_data: `approve_${usuario.telegram_id}` },
        { text: '❌ Rechazar', callback_data: `reject_${usuario.telegram_id}` },
      ],
      [{ text: '🚫 Bloquear', callback_data: `block_${usuario.telegram_id}` }],
    ],
  };
  const usernameDisplay = usuario.username ? `@${usuario.username}` : '—';
  const mensaje =
    '╔═══════════════════════════╗\n' +
    '║  🆕 <b>NUEVA SOLICITUD</b>  ║\n' +
    '╚═══════════════════════════╝\n\n' +
    `👤 <b>${usuario.first_name || ''} ${usuario.last_name || ''}</b>\n` +
    `📛 ${usernameDisplay}\n` +
    `🆔 <code>${usuario.telegram_id}</code>\n\n` +
    '❓ <i>¿Qué deseas hacer?</i>';

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.sendMessage(adminId, mensaje, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (e) {
      console.error(`Error notificando admin ${adminId}:`, e.message);
    }
  }
}

// ============================================================
// PROCESAMIENTO DE URL (DESCARGA)
// ============================================================

async function procesarUrl(msg, usuario, url) {
  if (!esUrlRecursoValido(url)) {
    return bot.sendMessage(msg.chat.id,
      '❌ <b>URL no válida</b>\n\n' +
      'Solo se aceptan links de:\n' +
      '• freepik.com\n' +
      '• magnific.com / magnific.ai / magnific.se\n\n' +
      '<i>No se descontaron créditos.</i>',
      html()
    );
  }

  if (Number(usuario.creditos) < CREDITOS_POR_DESCARGA) {
    return bot.sendMessage(msg.chat.id,
      `💳 <b>Sin créditos suficientes</b>\n\nTienes <b>${usuario.creditos}</b> créditos y se necesitan <b>${CREDITOS_POR_DESCARGA}</b>.\n\nUsa /comprar para ver los planes.`,
      html({ reply_markup: { inline_keyboard: [[{ text: '🛒 Comprar créditos', callback_data: 'buy' }]] } })
    );
  }

  const procesando = await bot.sendMessage(msg.chat.id, '⏳ <b>Procesando descarga...</b>', html());
  const descargaId = await registrarDescarga(usuario.id, url, 'pendiente');
  let tmpFile = null;

  try {
    const resourceId = extraerResourceId(url);
    if (!resourceId) throw new Error('No se pudo extraer el ID del recurso desde la URL');

    const recurso = await obtenerInfoRecurso(resourceId);
    const tipo = recurso?.image?.type || 'recurso';

    const infoDescarga = await obtenerInfoDescarga(resourceId);
    const signedUrl = infoDescarga?.url || infoDescarga?.signed_url;
    const filename = infoDescarga?.filename || `freepik_${resourceId}.zip`;

    if (!signedUrl) throw new Error('Freepik no devolvió una URL de descarga válida');

    const resHead = await fetch(signedUrl, { method: 'HEAD' });
    const contentLength = parseInt(resHead.headers.get('content-length') || '0', 10);
    const sizeMb = contentLength / (1024 * 1024);

    await bot.editMessageText(
      `⏳ <b>Descargando...</b>\n\n` +
      `📦 ${recurso?.title || 'Recurso'}\n` +
      `📁 ${filename}\n` +
      `📊 Tamaño: ~${sizeMb.toFixed(1)} MB\n\n` +
      `⏳ Espera pacientemente...`,
      { chat_id: msg.chat.id, message_id: procesando.message_id, parse_mode: 'HTML' }
    );

    tmpFile = await descargarArchivoTemporal(signedUrl, filename);

    if (tmpFile.sizeBytes >= MAX_TELEGRAM_BYTES) throw new Error('El archivo supera el límite de 50MB de Telegram');

    await bot.sendDocument(msg.chat.id, tmpFile.filePath);

    const creditosBefore = Number(usuario.creditos);
    await descontarCreditos(usuario.id, CREDITOS_POR_DESCARGA);
    const creditosAfter = creditosBefore - CREDITOS_POR_DESCARGA;

    await registrarRecarga(usuario.id, -CREDITOS_POR_DESCARGA, creditosBefore, creditosAfter, 'bot', `Descarga: ${filename}`);

    const tamanoMb = Number((tmpFile.sizeBytes / (1024 * 1024)).toFixed(2));
    await actualizarDescargaFinal(descargaId, 'exitoso', tmpFile.fileName, tipo, tamanoMb, null);

    await bot.editMessageText(
      `✅ <b>Descarga completada</b>\n\n` +
      `📁 ${tmpFile.fileName}\n` +
      `📦 Tipo: ${tipo}\n` +
      `💾 Tamaño: ${tamanoMb} MB\n` +
      `💳 Créditos usados: <b>${CREDITOS_POR_DESCARGA}</b>\n` +
      `💰 Saldo restante: <b>${creditosAfter}</b>`,
      { chat_id: msg.chat.id, message_id: procesando.message_id, parse_mode: 'HTML' }
    );

    console.log(`✅ Descarga ${descargaId} exitosa — usuario ${usuario.id}`);
  } catch (e) {
    await actualizarDescargaFinal(descargaId, 'fallido', null, null, null, e.message);
    await bot.editMessageText(
      `❌ <b>Error en la descarga</b>\n\n` +
      `📋 ${e.message}\n\n` +
      `✅ <b>Tus créditos NO fueron descontados.</b>\n` +
      `💰 Saldo intacto: <b>${usuario.creditos}</b>`,
      { chat_id: msg.chat.id, message_id: procesando.message_id, parse_mode: 'HTML' }
    );
    console.error(`❌ Descarga ${descargaId} fallida:`, e.message);
  } finally {
    if (tmpFile?.filePath) { try { await fsp.unlink(tmpFile.filePath); } catch {} }
  }
}

// ============================================================
// CONFIGURACIÓN DE COMANDOS DEL BOT
// ============================================================

bot.setMyCommands([
  { command: 'start',    description: '🚀 Iniciar el bot' },
  { command: 'menu',     description: '📱 Ver menú principal' },
  { command: 'creditos', description: '💰 Ver mis créditos' },
  { command: 'comprar',  description: '🛒 Comprar créditos' },
  { command: 'stats',    description: '📊 Mis estadísticas' },
  { command: 'info',     description: 'ℹ️ Mi perfil' },
  { command: 'historial',description: '📜 Historial de créditos' },
  { command: 'topusers', description: '🏆 Ranking de usuarios' },
  { command: 'help',     description: '❓ Ver ayuda' },
]).catch((e) => console.error('Error registrando comandos:', e.message));

// ============================================================
// HANDLERS DE COMANDOS — USUARIOS
// ============================================================

bot.onText(/^\/start/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    if (usuario.estado === 'baneado') {
      return bot.sendMessage(msg.chat.id, '⛔ <b>Cuenta suspendida</b>\n\nContacta al soporte si crees que es un error.', html());
    }
    await enviarInicio(msg.chat.id, msg.from.first_name, usuario.creditos);
  } catch (err) {
    console.error('/start error:', err.message);
    bot.sendMessage(msg.chat.id, '❌ Error al iniciar. Intenta de nuevo.');
  }
});

bot.onText(/^\/menu/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await bot.sendMessage(msg.chat.id,
      '⚡ <b>Acceso rápido:</b>',
      html({ reply_markup: kbInlineMenu() })
    );
  } catch (err) { console.error('/menu error:', err.message); }
});

bot.onText(/^\/help/, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, textoAyuda(),
      html({ reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'menu' }]] } })
    );
  } catch (err) { console.error('/help error:', err.message); }
});

bot.onText(/^\/stats/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarCuenta(msg.chat.id, usuario);
  } catch (err) { console.error('/stats error:', err.message); }
});

bot.onText(/^\/info/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarInfo(msg.chat.id, usuario, msg.from);
  } catch (err) { console.error('/info error:', err.message); }
});

bot.onText(/^\/creditos/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarCreditos(msg.chat.id, usuario);
  } catch (err) { console.error('/creditos error:', err.message); }
});

bot.onText(/^\/comprar/, async (msg) => {
  try {
    await mostrarPlanes(msg.chat.id);
  } catch (err) { console.error('/comprar error:', err.message); }
});

bot.onText(/^\/historial/, async (msg) => {
  try {
    const usuario = await obtenerOCrearUsuario(msg);
    await mostrarHistorial(msg.chat.id, usuario);
  } catch (err) { console.error('/historial error:', err.message); }
});

bot.onText(/^\/topusers/, async (msg) => {
  try {
    await mostrarTopUsers(msg.chat.id);
  } catch (err) { console.error('/topusers error:', err.message); }
});

// ============================================================
// HANDLERS DE COMANDOS — ADMIN
// ============================================================

bot.onText(/^\/admin/, async (msg) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos de administrador.');
    await mostrarPanelAdmin(msg.chat.id);
  } catch (err) { console.error('/admin error:', err.message); }
});

bot.onText(/^\/pending/, async (msg) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    const [rows] = await pool.query(
      'SELECT telegram_id, first_name, last_name, username, creado_en FROM usuarios WHERE estado = "inactivo" LIMIT 10'
    );

    if (!rows.length) {
      return bot.sendMessage(msg.chat.id,
        '╔═══════════════════════════╗\n║   ⏳ <b>PENDIENTES</b>   ║\n╚═══════════════════════════╝\n\n✅ No hay usuarios pendientes.',
        html()
      );
    }

    await bot.sendMessage(msg.chat.id,
      `╔═══════════════════════════╗\n║   ⏳ <b>PENDIENTES</b>   ║\n╚═══════════════════════════╝\n\n` +
      '📋 <b>' + rows.length + '</b> solicitudes\n────────────────────────',
      html()
    );

    for (const u of rows) {
      const usernameDisplay = u.username ? `@${u.username}` : '—';
      await bot.sendMessage(msg.chat.id,
        `👤 <b>${u.first_name || ''} ${u.last_name || ''}</b>\n` +
        `├ 📛 ${usernameDisplay}\n` +
        `├ 🆔 <code>${u.telegram_id}</code>\n` +
        `└ 📅 ${String(u.creado_en || '').slice(0, 16)}`,
        html({
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Aprobar', callback_data: `approve_${u.telegram_id}` },
                { text: '❌ Rechazar', callback_data: `reject_${u.telegram_id}` },
              ],
              [{ text: '🚫 Bloquear', callback_data: `block_${u.telegram_id}` }],
            ],
          },
        })
      );
    }
  } catch (err) { console.error('/pending error:', err.message); }
});

bot.onText(/^\/users(?:\s+(\w+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    const filtro = match[1] ? match[1].toLowerCase() : null;
    const estadoMap = { activo: 'activo', inactivo: 'inactivo', baneado: 'baneado', blocked: 'baneado', inactive: 'inactivo' };
    let query = 'SELECT first_name, last_name, username, creditos, estado FROM usuarios';
    const params = [];
    if (filtro && estadoMap[filtro]) {
      query += ' WHERE estado = ?';
      params.push(estadoMap[filtro]);
    }
    query += ' ORDER BY creditos DESC LIMIT 20';

    const [rows] = await pool.query(query, params);
    if (!rows.length) {
      return bot.sendMessage(msg.chat.id, '╔═══════════════════════════╗\n║     👥 <b>USUARIOS</b>     ║\n╚═══════════════════════════╝\n\n📋 No hay usuarios.', html());
    }

    const statusIcons = { activo: '✅', inactivo: '⏸️', baneado: '🚫' };
    const usersText = rows.map((u) => {
      const icon = statusIcons[u.estado] || '❓';
      const username = u.username ? `@${u.username}` : '—';
      return `${icon} ${(u.first_name || '').slice(0, 12)} │ ${username} │ ${u.creditos}cr`;
    }).join('\n');

    await bot.sendMessage(msg.chat.id,
      '╔═══════════════════════════╗\n' +
      '║     👥 <b>USUARIOS</b>     ║\n' +
      '╚═══════════════════════════╝\n\n' +
      `📋 Mostrando <b>${rows.length}</b>\n` +
      '────────────────────────\n' +
      `<code>${usersText}</code>\n\n` +
      '💡 <code>/users activo|inactivo|baneado</code>',
      html()
    );
  } catch (err) { console.error('/users error:', err.message); }
});

bot.onText(/^\/recentlogs/, async (msg) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    const [rows] = await pool.query(
      `SELECT d.estado, d.fecha, d.nombre_archivo, u.username, u.first_name
       FROM descargas d
       LEFT JOIN usuarios u ON u.id = d.usuario_id
       ORDER BY d.fecha DESC LIMIT 10`
    );

    if (!rows.length) {
      return bot.sendMessage(msg.chat.id,
        '╔═══════════════════════════╗\n║   📋 <b>DESCARGAS</b>   ║\n╚═══════════════════════════╝\n\nNo hay descargas registradas.',
        html()
      );
    }

    const logsText = rows.map((l, i) => {
      const status = l.estado === 'exitoso' ? '✅' : '❌';
      const timestamp = String(l.fecha || '').slice(0, 16);
      const uname = l.username ? `@${l.username}` : (l.first_name || 'N/A');
      const title = (l.nombre_archivo || 'N/A').slice(0, 25);
      return `${status} <b>${i + 1}.</b> ${timestamp}\n    👤 ${uname} │ ${title}`;
    }).join('\n');

    await bot.sendMessage(msg.chat.id,
      '╔═══════════════════════════╗\n' +
      '║   📋 <b>DESCARGAS</b>   ║\n' +
      '╚═══════════════════════════╝\n\n' +
      '🕐 <b>Últimas 10</b>\n' +
      '────────────────────────\n' + logsText,
      html()
    );
  } catch (err) { console.error('/recentlogs error:', err.message); }
});

bot.onText(/^\/darcreditos(?:\s+(\d+)\s+(\d+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    if (!match[1] || !match[2]) {
      return bot.sendMessage(msg.chat.id,
        '╔═══════════════════════════╗\n║  💰 <b>DAR CRÉDITOS</b>  ║\n╚═══════════════════════════╝\n\n📌 <b>Uso:</b>\n<code>/darcreditos [ID] [cantidad]</code>\n\n📝 <b>Ejemplo:</b>\n<code>/darcreditos 123456789 100</code>',
        html()
      );
    }

    const targetId = parseInt(match[1], 10);
    const cantidad = parseInt(match[2], 10);
    if (cantidad <= 0) return bot.sendMessage(msg.chat.id, '❌ La cantidad debe ser positiva.');

    const targetUser = await obtenerUsuarioPorTelegramId(targetId);
    if (!targetUser) return bot.sendMessage(msg.chat.id, `❌ Usuario ${targetId} no encontrado.`);

    const creditosBefore = Number(targetUser.creditos);
    await sumarCreditos(targetUser.id, cantidad);
    const creditosAfter = creditosBefore + cantidad;
    await registrarRecarga(targetUser.id, cantidad, creditosBefore, creditosAfter, 'admin', `Agregado por admin ${msg.from.id}`);

    await bot.sendMessage(msg.chat.id,
      '╔═══════════════════════════╗\n║    ✅ <b>COMPLETADO</b>    ║\n╚═══════════════════════════╝\n\n' +
      `👤 <b>${targetUser.first_name}</b>\n🆔 <code>${targetId}</code>\n\n` +
      '┌─────────────────────────\n' +
      `│ ➕ Agregados: <b>${cantidad}</b>\n` +
      `│ 💰 Nuevo saldo: <b>${creditosAfter}</b>\n` +
      '└─────────────────────────',
      html()
    );

    try {
      await bot.sendMessage(targetId,
        '╔═══════════════════════════╗\n║  🎉 <b>CRÉDITOS RECIBIDOS</b>  ║\n╚═══════════════════════════╝\n\n' +
        `➕ Se agregaron <b>${cantidad}</b> créditos\n💰 Tu saldo: <b>${creditosAfter}</b>`,
        html()
      );
    } catch {}

    console.log(`💰 Admin ${msg.from.id} agregó ${cantidad} créditos a ${targetId}`);
  } catch (err) { console.error('/darcreditos error:', err.message); }
});

bot.onText(/^\/quitarcreditos(?:\s+(\d+)\s+(\d+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    if (!match[1] || !match[2]) {
      return bot.sendMessage(msg.chat.id,
        '╔═══════════════════════════╗\n║  💸 <b>QUITAR CRÉDITOS</b>  ║\n╚═══════════════════════════╝\n\n📌 <b>Uso:</b>\n<code>/quitarcreditos [ID] [cantidad]</code>\n\n📝 <b>Ejemplo:</b>\n<code>/quitarcreditos 123456789 50</code>',
        html()
      );
    }

    const targetId = parseInt(match[1], 10);
    const cantidad = parseInt(match[2], 10);
    if (cantidad <= 0) return bot.sendMessage(msg.chat.id, '❌ La cantidad debe ser positiva.');

    const targetUser = await obtenerUsuarioPorTelegramId(targetId);
    if (!targetUser) return bot.sendMessage(msg.chat.id, `❌ Usuario ${targetId} no encontrado.`);

    const creditosBefore = Number(targetUser.creditos);
    const creditosAfter = Math.max(0, creditosBefore - cantidad);
    await setCreditos(targetUser.id, creditosAfter);
    await registrarRecarga(targetUser.id, -(creditosBefore - creditosAfter), creditosBefore, creditosAfter, 'admin', `Removido por admin ${msg.from.id}`);

    await bot.sendMessage(msg.chat.id,
      '╔═══════════════════════════╗\n║    ✅ <b>COMPLETADO</b>    ║\n╚═══════════════════════════╝\n\n' +
      `👤 <b>${targetUser.first_name}</b>\n🆔 <code>${targetId}</code>\n\n` +
      '┌─────────────────────────\n' +
      `│ ➖ Removidos: <b>${cantidad}</b>\n` +
      `│ 💰 Nuevo saldo: <b>${creditosAfter}</b>\n` +
      '└─────────────────────────',
      html()
    );
    console.log(`💸 Admin ${msg.from.id} quitó ${cantidad} créditos a ${targetId}`);
  } catch (err) { console.error('/quitarcreditos error:', err.message); }
});

bot.onText(/^\/setcreditos(?:\s+(\d+)\s+(\d+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    if (!match[1] || !match[2]) {
      return bot.sendMessage(msg.chat.id,
        '╔═══════════════════════════╗\n║  🔧 <b>ESTABLECER CRÉDITOS</b>  ║\n╚═══════════════════════════╝\n\n📌 <b>Uso:</b>\n<code>/setcreditos [ID] [cantidad]</code>\n\n📝 <b>Ejemplo:</b>\n<code>/setcreditos 123456789 100</code>',
        html()
      );
    }

    const targetId = parseInt(match[1], 10);
    const cantidad = parseInt(match[2], 10);
    if (cantidad < 0) return bot.sendMessage(msg.chat.id, '❌ La cantidad no puede ser negativa.');

    const targetUser = await obtenerUsuarioPorTelegramId(targetId);
    if (!targetUser) return bot.sendMessage(msg.chat.id, `❌ Usuario ${targetId} no encontrado.`);

    const creditosBefore = Number(targetUser.creditos);
    await setCreditos(targetUser.id, cantidad);
    await registrarRecarga(targetUser.id, cantidad - creditosBefore, creditosBefore, cantidad, 'admin', `Establecido por admin ${msg.from.id}`);

    await bot.sendMessage(msg.chat.id,
      '╔═══════════════════════════╗\n║    ✅ <b>COMPLETADO</b>    ║\n╚═══════════════════════════╝\n\n' +
      `👤 <b>${targetUser.first_name}</b>\n🆔 <code>${targetId}</code>\n\n` +
      '┌─────────────────────────\n' +
      `│ 📊 Anterior: <b>${creditosBefore}</b>\n` +
      `│ 💰 Nuevo: <b>${cantidad}</b>\n` +
      '└─────────────────────────',
      html()
    );
    console.log(`💰 Admin ${msg.from.id} estableció ${cantidad} créditos a ${targetId}`);
  } catch (err) { console.error('/setcreditos error:', err.message); }
});

bot.onText(/^\/blockuser(?:\s+(\d+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    if (!match[1]) {
      return bot.sendMessage(msg.chat.id,
        '📌 Uso: /blockuser <user_id>\n\nEjemplo: /blockuser 123456789'
      );
    }

    const targetId = parseInt(match[1], 10);
    await pool.query('UPDATE usuarios SET estado = "baneado" WHERE telegram_id = ?', [targetId]);
    await bot.sendMessage(msg.chat.id, `🚫 Usuario ${targetId} bloqueado.`);
    console.log(`🚫 Admin ${msg.from.id} bloqueó a ${targetId}`);
  } catch (err) { console.error('/blockuser error:', err.message); }
});

bot.onText(/^\/unblockuser(?:\s+(\d+))?/, async (msg, match) => {
  try {
    const adminOk = await esAdmin(msg.from.id);
    if (!adminOk) return bot.sendMessage(msg.chat.id, '❌ No tienes permisos.');

    if (!match[1]) {
      return bot.sendMessage(msg.chat.id,
        '📌 Uso: /unblockuser <user_id>\n\nEjemplo: /unblockuser 123456789'
      );
    }

    const targetId = parseInt(match[1], 10);
    await pool.query('UPDATE usuarios SET estado = "activo" WHERE telegram_id = ?', [targetId]);
    await bot.sendMessage(msg.chat.id, `✅ Usuario ${targetId} desbloqueado y activo.`);
    console.log(`✅ Admin ${msg.from.id} desbloqueó a ${targetId}`);
  } catch (err) { console.error('/unblockuser error:', err.message); }
});

// ============================================================
// HANDLER DE MENSAJES (teclado y URLs)
// ============================================================

bot.on('message', async (msg) => {
  if (!msg.text) return;
  const texto = msg.text.trim();
  if (texto.startsWith('/')) return;

  try {
    const usuario = await obtenerOCrearUsuario(msg);

    if (usuario.estado === 'baneado') {
      return bot.sendMessage(msg.chat.id, '⛔ Tu cuenta está suspendida.', html());
    }

    if (texto === '🎨 Descargar') return mostrarDescargar(msg.chat.id, usuario.creditos);
    if (texto === '💰 Créditos')  return mostrarCreditos(msg.chat.id, usuario);
    if (texto === '📊 Mi Cuenta') return mostrarCuenta(msg.chat.id, usuario);
    if (texto === 'ℹ️ Ayuda')    return bot.sendMessage(msg.chat.id, textoAyuda(), html({ reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'menu' }]] } }));

    const esUrl = texto.startsWith('http://') || texto.startsWith('https://');
    if (esUrl) return procesarUrl(msg, usuario, texto);

    bot.sendMessage(msg.chat.id,
      '❓ No entendí eso.\n\nEnvíame una URL de <b>Freepik</b> o <b>Magnific</b>\n(freepik.com / magnific.ai / magnific.se)\n\nO usa los botones del menú.',
      html()
    );
  } catch (err) {
    console.error('Error en mensaje:', err.message);
    bot.sendMessage(msg.chat.id, '❌ Error. Intenta de nuevo.');
  }
});

// ============================================================
// CALLBACK QUERIES (botones inline)
// ============================================================

bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const fromUser = query.from;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  try {
    // ── Acciones de admin sobre usuarios ──────────────────────────────
    const adminAction = data.match(/^(approve|reject|block)_(\d+)$/);
    if (adminAction) {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const action = adminAction[1];
      const targetId = parseInt(adminAction[2], 10);
      const targetUser = await obtenerUsuarioPorTelegramId(targetId);

      if (!targetUser) {
        return bot.editMessageText('❌ Usuario no encontrado.', { chat_id: chatId, message_id: msgId });
      }

      if (action === 'approve') {
        if (targetUser.estado === 'activo') {
          return bot.editMessageText(
            `⚠️ <b>Usuario ya activo</b>\n\n👤 ${targetUser.first_name}\n🆔 <code>${targetId}</code>`,
            { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
          );
        }
        await pool.query('UPDATE usuarios SET estado = "activo" WHERE telegram_id = ?', [targetId]);
        const creditosBefore = Number(targetUser.creditos);
        await sumarCreditos(targetUser.id, WELCOME_CREDITS);
        await registrarRecarga(targetUser.id, WELCOME_CREDITS, creditosBefore, creditosBefore + WELCOME_CREDITS, 'admin', 'Créditos de bienvenida');
        await bot.editMessageText(
          `✅ <b>Usuario aprobado</b>\n\n👤 ${targetUser.first_name}\n🆔 <code>${targetId}</code>\n🎁 +${WELCOME_CREDITS} créditos de bienvenida`,
          { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
        );
        try {
          await bot.sendMessage(targetId,
            `✅ <b>¡Tu acceso ha sido aprobado!</b>\n\n🎁 Has recibido <b>${WELCOME_CREDITS} créditos</b> de bienvenida.\n\nYa puedes usar el bot. Envía un link de Freepik para descargar.`,
            html()
          );
        } catch {}

      } else if (action === 'reject') {
        await pool.query('UPDATE usuarios SET estado = "inactivo" WHERE telegram_id = ?', [targetId]);
        await bot.editMessageText(
          `❌ <b>Usuario desactivado</b>\n\n👤 ${targetUser.first_name}\n🆔 <code>${targetId}</code>`,
          { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
        );
        try { await bot.sendMessage(targetId, '❌ Tu acceso ha sido desactivado.'); } catch {}

      } else if (action === 'block') {
        await pool.query('UPDATE usuarios SET estado = "baneado" WHERE telegram_id = ?', [targetId]);
        await bot.editMessageText(
          `🚫 <b>Usuario bloqueado</b>\n\n👤 ${targetUser.first_name}\n🆔 <code>${targetId}</code>`,
          { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' }
        );
      }

      console.log(`👑 Admin ${fromUser.id} ejecutó ${action} sobre ${targetId}`);
      return;
    }

    // ── Callbacks de usuario ───────────────────────────────────────────
    const usuario = await obtenerOCrearUsuario(query.message.hasOwnProperty('from')
      ? query.message
      : { from: fromUser, chat: query.message.chat });

    if (data === 'menu') {
      return bot.editMessageText('⚡ <b>Acceso rápido:</b>', {
        chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kbInlineMenu()
      });
    }

    if (data === 'help') {
      return bot.editMessageText(textoAyuda(), {
        chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'menu' }]] }
      });
    }

    if (data === 'stats') {
      const [[stats]] = await pool.query(
        'SELECT COUNT(*) AS total, SUM(estado="exitoso") AS exitosas, COALESCE(SUM(creditos_usados),0) AS gastados FROM descargas WHERE usuario_id = ?',
        [usuario.id]
      );
      const [[hoy]] = await pool.query(
        'SELECT COUNT(*) AS total_hoy, SUM(estado="exitoso") AS exitosas_hoy FROM descargas WHERE usuario_id = ? AND DATE(fecha) = CURDATE()',
        [usuario.id]
      );
      const creds = Number(usuario.creditos || 0);
      const blocks = Math.min(10, Math.floor((Math.min(creds, 100) / 100) * 10));
      const bar = '█'.repeat(blocks) + '░'.repeat(10 - blocks);
      const statusEmoji = creds > 10 ? '🟢' : creds > 0 ? '🟡' : '🔴';

      return bot.editMessageText(
        '╔═══════════════════════════╗\n║    📊 <b>MI CUENTA</b>    ║\n╚═══════════════════════════╝\n\n' +
        `${statusEmoji} <b>CRÉDITOS</b>\n<code>[${bar}]</code> ${creds}\n\n` +
        '📈 <b>ESTADÍSTICAS</b>\n┌─────────────────────────\n' +
        `│ 📥 Total: <b>${Number(stats?.total || 0)}</b>\n` +
        `│ ✅ Exitosas: <b>${Number(stats?.exitosas || 0)}</b>\n` +
        `│ 📅 Hoy: <b>${Number(hoy?.exitosas_hoy || 0)}/${Number(hoy?.total_hoy || 0)}</b>\n` +
        '└─────────────────────────',
        {
          chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🔄 Actualizar', callback_data: 'stats' }, { text: '⬅️ Volver', callback_data: 'menu' }]] }
        }
      );
    }

    if (data === 'info') {
      const [[perfil]] = await pool.query(
        'SELECT telegram_id, first_name, last_name, username, estado, creditos, creado_en FROM usuarios WHERE id = ? LIMIT 1',
        [usuario.id]
      );
      const [[dlStats]] = await pool.query('SELECT COUNT(*) AS total FROM descargas WHERE usuario_id = ? AND estado = "exitoso"', [usuario.id]);
      const adminUser = await esAdmin(fromUser.id);
      const username_display = perfil?.username ? `@${perfil.username}` : '—';
      const statusIcons = { activo: '✅', inactivo: '⏸️', baneado: '🚫' };
      const statusIcon = statusIcons[perfil?.estado] || '❓';

      return bot.editMessageText(
        '╔═══════════════════════════╗\n║    ℹ️ <b>MI PERFIL</b>    ║\n╚═══════════════════════════╝\n\n' +
        `👤 <b>${perfil?.first_name || ''} ${perfil?.last_name || ''}</b>\n📛 ${username_display}\n\n` +
        '📋 <b>DATOS</b>\n┌─────────────────────────\n' +
        `│ 🆔 <code>${perfil?.telegram_id}</code>\n` +
        `│ ${statusIcon} Estado: ${perfil?.estado}\n` +
        `│ 💰 Créditos: <b>${perfil?.creditos}</b>\n` +
        `│ 📥 Descargas: <b>${Number(dlStats?.total || 0)}</b>\n` +
        `│ 👑 Admin: ${adminUser ? 'Sí' : 'No'}\n` +
        '└─────────────────────────',
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'menu' }]] } }
      );
    }

    if (data === 'credits') {
      const creds = Number(usuario.creditos || 0);
      const statusEmoji = creds > 10 ? '🟢' : creds > 0 ? '🟡' : '🔴';
      const statusText = creds > 50 ? 'Excelente' : creds > 10 ? 'Bien' : creds > 0 ? 'Bajo' : 'Vacío';
      const warning = creds < CREDITOS_POR_DESCARGA ? '⚠️ <i>¡Recarga pronto!</i>' : '✅ <i>Listo para descargar</i>';
      const [[dlStats]] = await pool.query('SELECT COUNT(*) AS total FROM descargas WHERE usuario_id = ? AND estado = "exitoso"', [usuario.id]);

      return bot.editMessageText(
        '💰 <b>MIS CRÉDITOS</b>\n\n' +
        `${statusEmoji} Estado: <b>${statusText}</b>\n💳 <b>${creds}</b> créditos disponibles\n\n` +
        `📥 Descargas: <b>${Number(dlStats?.total || 0)}</b>\n💸 Costo: ${CREDITOS_POR_DESCARGA}/descarga\n\n` + warning,
        {
          chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: '🛒 Comprar créditos', callback_data: 'buy' }, { text: '📜 Historial', callback_data: 'credit_history' }],
            [{ text: '⬅️ Volver', callback_data: 'menu' }],
          ]}
        }
      );
    }

    if (data === 'credit_history') {
      const [rows] = await pool.query(
        `SELECT delta, tipo, DATE_FORMAT(fecha_raw, '%Y-%m-%d') AS fecha
         FROM (
           SELECT r.creditos AS delta, r.metodo AS tipo, r.fecha AS fecha_raw FROM recargas r WHERE r.usuario_id = ?
           UNION ALL
           SELECT -d.creditos_usados AS delta, 'descarga' AS tipo, d.fecha AS fecha_raw FROM descargas d WHERE d.usuario_id = ? AND d.estado = 'exitoso'
         ) t ORDER BY fecha_raw DESC LIMIT 10`,
        [usuario.id, usuario.id]
      );

      const histText = rows.length
        ? rows.map((r) => {
            const delta = Number(r.delta || 0);
            return `${delta >= 0 ? '➕' : '➖'} <b>${Math.abs(delta)}</b> │ ${r.tipo} │ ${r.fecha}`;
          }).join('\n')
        : 'No tienes transacciones aún.';

      return bot.editMessageText(
        '📜 <b>HISTORIAL</b>\n\n' + histText,
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'credits' }]] } }
      );
    }

    if (data === 'buy') {
      const caption = textoPlanesCompleto();
      const inline_keyboard = [
        [{ text: '🥉 Básico', callback_data: 'plan_basico' }, { text: '🥈 Estándar', callback_data: 'plan_estandar' }],
        [{ text: '🥇 Premium', callback_data: 'plan_premium' }, { text: '💎 Pro', callback_data: 'plan_pro' }],
        [{ text: '⬅️ Volver', callback_data: 'menu' }],
      ];
      try {
        await query.message.delete();
      } catch {}
      if (fs.existsSync(PLANES_IMG)) {
        await bot.sendPhoto(chatId, PLANES_IMG, { caption, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
      } else {
        await bot.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: { inline_keyboard } });
      }
      return;
    }

    if (data.startsWith('plan_') && PLANES[data]) {
      const p = PLANES[data];
      const caption = textoPlanDetalle(p);
      const reply_markup = { inline_keyboard: kbDetallePlan(data) };
      if (query.message.photo) {
        return bot.editMessageCaption(caption, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup });
      } else {
        return bot.editMessageText(caption, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup });
      }
    }

    // ── Callbacks de admin ─────────────────────────────────────────────
    if (data === 'admin_pending') {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const [pending] = await pool.query('SELECT telegram_id, first_name FROM usuarios WHERE estado = "inactivo" LIMIT 5');
      if (!pending.length) {
        return bot.editMessageText(
          '╔═══════════════════════════╗\n║   ⏳ <b>PENDIENTES</b>   ║\n╚═══════════════════════════╝\n\n✅ No hay usuarios pendientes.',
          { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver al panel', callback_data: 'admin_refresh' }]] } }
        );
      }
      const lineas = pending.map((u) => `👤 ${u.first_name} │ <code>${u.telegram_id}</code>`);
      return bot.editMessageText(
        '╔═══════════════════════════╗\n║   ⏳ <b>PENDIENTES</b>   ║\n╚═══════════════════════════╝\n\n' + lineas.join('\n') + '\n\n<i>Usa /pending para ver todos</i>',
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'admin_refresh' }]] } }
      );
    }

    if (data === 'admin_users') {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const [[totUsers]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
      const [[activos]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "activo"');
      const [[pendientes]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "inactivo"');
      const [[baneados]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "baneado"');

      return bot.editMessageText(
        '╔═══════════════════════════╗\n║    👥 <b>USUARIOS</b>    ║\n╚═══════════════════════════╝\n\n' +
        '📊 <b>ESTADÍSTICAS</b>\n┌─────────────────────────\n' +
        `│ 📋 Total: <b>${totUsers.total}</b>\n│ ✅ Activos: <b>${activos.total}</b>\n│ ⏸️ Inactivos: <b>${pendientes.total}</b>\n│ 🚫 Baneados: <b>${baneados.total}</b>\n` +
        '└─────────────────────────\n\n<i>Usa /users para lista completa</i>',
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'admin_refresh' }]] } }
      );
    }

    if (data === 'admin_logs') {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const [logs] = await pool.query(
        'SELECT d.estado, d.fecha, u.first_name FROM descargas d LEFT JOIN usuarios u ON u.id = d.usuario_id ORDER BY d.fecha DESC LIMIT 5'
      );

      const logsText = logs.length
        ? logs.map((l) => `📥 ${(l.first_name || '?').slice(0, 10)} │ ${String(l.fecha || '').slice(11, 16)}`).join('\n')
        : 'No hay descargas registradas.';

      return bot.editMessageText(
        '╔═══════════════════════════╗\n║   📋 <b>DESCARGAS</b>   ║\n╚═══════════════════════════╝\n\n' + logsText + '\n\n<i>Usa /recentlogs para más</i>',
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'admin_refresh' }]] } }
      );
    }

    if (data === 'admin_top') {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const [topUsers] = await pool.query(
        'SELECT u.first_name, COUNT(d.id) AS total FROM usuarios u LEFT JOIN descargas d ON d.usuario_id = u.id AND d.estado = "exitoso" GROUP BY u.id ORDER BY total DESC LIMIT 5'
      );
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const lineas = topUsers.map((u, i) => `${medals[i] || '▫️'} ${(u.first_name || '?').slice(0, 12)} │ ${u.total}`);

      return bot.editMessageText(
        '╔═══════════════════════════╗\n║   🏆 <b>TOP USUARIOS</b>   ║\n╚═══════════════════════════╝\n\n' + lineas.join('\n') + '\n\n<i>Usa /topusers para más</i>',
        { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'admin_refresh' }]] } }
      );
    }

    if (data === 'admin_refresh') {
      const adminOk = await esAdmin(fromUser.id);
      if (!adminOk) { await bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos', show_alert: true }); return; }

      const [[totUsers]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
      const [[activos]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "activo"');
      const [[pendientes]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "inactivo"');
      const [[baneados]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios WHERE estado = "baneado"');
      const [[totDl]] = await pool.query('SELECT COUNT(*) AS total FROM descargas');
      const [[totCreds]] = await pool.query('SELECT COALESCE(SUM(creditos), 0) AS total FROM usuarios');

      await bot.editMessageText(
        '╔═══════════════════════════╗\n║   🔧 <b>PANEL ADMIN</b>   ║\n╚═══════════════════════════╝\n\n' +
        '📊 <b>RESUMEN</b>\n┌─────────────────────────\n' +
        `│ 👥 Usuarios: <b>${totUsers.total}</b>\n│ ✅ Activos: <b>${activos.total}</b>\n│ ⏸️ Inactivos: <b>${pendientes.total}</b>\n│ 🚫 Baneados: <b>${baneados.total}</b>\n` +
        '├─────────────────────────\n' +
        `│ 📥 Descargas: <b>${totDl.total}</b>\n│ 💰 Créditos: <b>${Number(totCreds.total)}</b>\n` +
        '└─────────────────────────',
        {
          chat_id: chatId, message_id: msgId, parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: `⏸️ Inactivos (${pendientes.total})`, callback_data: 'admin_pending' }, { text: '👥 Usuarios', callback_data: 'admin_users' }],
              [{ text: '📋 Descargas', callback_data: 'admin_logs' }, { text: '🏆 Top Users', callback_data: 'admin_top' }],
              [{ text: '🔄 Actualizar', callback_data: 'admin_refresh' }],
            ],
          },
        }
      );
      await bot.answerCallbackQuery(query.id, { text: '✅ Actualizado' });
      return;
    }

  } catch (err) {
    console.error('callback_query error:', err.message);
  }
});

// ============================================================
// POLLING ERROR HANDLER
// ============================================================

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

console.log('✅ Todos los handlers registrados correctamente.');
