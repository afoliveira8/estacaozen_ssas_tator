
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import session from 'express-session';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import bcrypt from 'bcrypt';

dayjs.extend(utc);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// DB init
let db;
async function initDB() {
  db = await open({ filename: path.join(__dirname, 'data.db'), driver: sqlite3.Database });
  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      birth_date TEXT,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free', -- free|standard|premium_custom
      plan_since TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      question TEXT,
      card_key TEXT,
      card_name_pt TEXT,
      upright INTEGER,
      sign TEXT,
      reading_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}
await initDB();

// Tarot Deck (22 Arcanos Maiores) — PT-BR
const TAROT = [
  { key: '00-louco', name: 'O Louco', img: '/img/cards/00-louco.jpg', upright: 'novos começos, espontaneidade, fé', reversed: 'imprudência, risco sem plano, ingenuidade' },
  { key: '01-mago', name: 'O Mago', img: '/img/cards/01-mago.jpg', upright: 'vontade, iniciativa, comunicação', reversed: 'manipulação, truques, dispersão' },
  { key: '02-sacerdotisa', name: 'A Sacerdotisa', img: '/img/cards/02-sacerdotisa.jpg', upright: 'intuição, silêncio, mistério', reversed: 'bloqueio intuitivo, segredos, ilusão' },
  { key: '03-imperatriz', name: 'A Imperatriz', img: '/img/cards/03-imperatriz.jpg', upright: 'nutrição, beleza, abundância', reversed: 'excesso, dependência, estagnação' },
  { key: '04-imperador', name: 'O Imperador', img: '/img/cards/04-imperador.jpg', upright: 'estrutura, liderança, segurança', reversed: 'rigidez, controle, autoritarismo' },
  { key: '05-papa', name: 'O Papa', img: '/img/cards/05-papa.jpg', upright: 'tradição, sabedoria, aconselhamento', reversed: 'dogma, rebeldia vazia, superficialidade' },
  { key: '06-enamorados', name: 'Os Enamorados', img: '/img/cards/06-enamorados.jpg', upright: 'escolhas, conexão, valores', reversed: 'dúvida, desalinhamento, tentação' },
  { key: '07-carruagem', name: 'O Carro', img: '/img/cards/07-carro.jpg', upright: 'foco, vitória, direção', reversed: 'impulsividade, descontrole, atraso' },
  { key: '08-forca', name: 'A Forca', img: '/img/cards/08-forca.jpg', upright: 'coragem, domínio interno, gentileza', reversed: 'dúvida, impaciência, explosões' },
  { key: '09-eremita', name: 'O Eremita', img: '/img/cards/09-eremita.jpg', upright: 'busca interior, análise, pausa', reversed: 'isolamento, fuga, teimosia' },
  { key: '10-roda', name: 'A Roda da Fortuna', img: '/img/cards/10-roda.jpg', upright: 'ciclos, sorte, virada', reversed: 'resistência, repetição, instabilidade' },
  { key: '11-justica', name: 'A Justica', img: '/img/cards/11-justica.jpg', upright: 'equilíbrio, verdade, causa-efeito', reversed: 'injustiça, viés, desequilíbrio' },
  { key: '12-enforcado', name: 'O Enforcado', img: '/img/cards/12-enforcado.jpg', upright: 'nova perspectiva, entrega, pausa', reversed: 'estagnação, sacrifício inútil, teimosia' },
  { key: '13-morte', name: 'A Morte', img: '/img/cards/13-morte.jpg', upright: 'fim necessário, transformação, renascimento', reversed: 'apego, medo da mudança, atraso' },
  { key: '14-temperanca', name: 'A Temperanca', img: '/img/cards/14-temperanca.jpg', upright: 'equilíbrio, síntese, paciência', reversed: 'excesso, desequilíbrio, pressa' },
  { key: '15-diabo', name: 'O Diabo', img: '/img/cards/15-diabo.jpg', upright: 'desejo, materialidade, contrato', reversed: 'libertação, consciência, novos limites' },
  { key: '16-torre', name: 'A Torre', img: '/img/cards/16-torre.jpg', upright: 'ruptura, revelação, despertar', reversed: 'medo do colapso, dano contido, reconstrução' },
  { key: '17-estrela', name: 'A Estrela', img: '/img/cards/17-estrela.jpg', upright: 'esperança, cura, propósito', reversed: 'descrença, cansaço, foco difuso' },
  { key: '18-lua', name: 'A Lua', img: '/img/cards/18-lua.jpg', upright: 'emoção, sonhos, sensibilidade', reversed: 'confusão, ansiedade, ilusão' },
  { key: '19-sol', name: 'O Sol', img: '/img/cards/19-sol.jpg', upright: 'clareza, sucesso, vitalidade', reversed: 'ego, cansaço, atrasos' },
  { key: '20-julgamento', name: 'O Julgamento', img: '/img/cards/20-julgamento.jpg', upright: 'chamado, perdão, segunda chance', reversed: 'auto-crítica, culpa, adiamento' },
  { key: '21-mundo', name: 'O Mundo', img: '/img/cards/21-mundo.jpg', upright: 'conclusão, expansão, viagem', reversed: 'ciclo aberto, revisão, limites' }
];

// Simple zodiac by month/day (tropical)
function zodiacFrom(dateISO) {
  if (!dateISO) return null;
  const d = dayjs(dateISO);
  const m = d.month()+1, day = d.date();
  const z = [
    ['Capricornio', (m===12 && day>=22)||(m===1 && day<=19)],
    ['Aquario', (m===1 && day>=20)||(m===2 && day<=18)],
    ['Peixes', (m===2 && day>=19)||(m===3 && day<=20)],
    ['Aries', (m===3 && day>=21)||(m===4 && day<=19)],
    ['Touro', (m===4 && day>=20)||(m===5 && day<=20)],
    ['Gemeos', (m===5 && day>=21)||(m===6 && day<=20)],
    ['Cancer', (m===6 && day>=21)||(m===7 && day<=22)],
    ['Leao', (m===7 && day>=23)||(m===8 && day<=22)],
    ['Virgem', (m===8 && day>=23)||(m===9 && day<=22)],
    ['Libra', (m===9 && day>=23)||(m===10 && day<=22)],
    ['Escorpiao', (m===10 && day>=23)||(m===11 && day<=21)],
    ['Sagitario', (m===11 && day>=22)||(m===12 && day<=21)]
  ];
  const found = z.find(([name, cond])=>cond);
  return found ? found[0] : null;
}

function weeklyKey(d=dayjs()) {
  // returns "YYYY-WW"
  const week = d.isoWeek ? d.isoWeek() : Math.ceil((d.dayOfYear ? d.dayOfYear() : d.diff(d.startOf('year'), 'day')+1)/7);
  const ww = String(week).padStart(2,'0');
  return `${d.year()}-${ww}`;
}

// Auth helpers
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.email !== (process.env.ADMIN_EMAIL || 'admin@estacaozen.com.br')) {
    return res.status(403).send('Acesso restrito.');
  }
  next();
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo-super-seguro',
  resave: false,
  saveUninitialized: false
}));

// Middleware to expose user to views
app.use((req,res,next)=>{
  res.locals.user = req.session.user || null;
  next();
});

// HOME
app.get('/', (req, res) => {
  res.render('home');
});

// PLANS
app.get('/planos', (req, res) => {
  res.render('planos');
});

// LGPD
app.get('/lgpd', (req, res) => {
  res.render('lgpd');
});

// LOGIN + REGISTER
app.get('/login', (req,res)=> res.render('login'));
app.get('/registrar', (req,res)=> res.render('register'));

app.post('/registrar', async (req,res)=>{
  const { email, full_name, birth_date, password } = req.body;
  if (!email || !password) return res.render('register', { error: 'Preencha e-mail e senha.' });
  const hash = await bcrypt.hash(password, 10);
  try {
    await db.run('INSERT INTO users (email, full_name, birth_date, password_hash, plan_since) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [email, full_name, birth_date, hash]);
  } catch (e) {
    return res.render('register', { error: 'E-mail já cadastrado.' });
  }
  res.redirect('/login?ok=1');
});

app.post('/login', async (req,res)=>{
  const { email, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email=?', [email]);
  if (!user) return res.render('login', { error: 'Credenciais inválidas.' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.render('login', { error: 'Credenciais inválidas.' });
  req.session.user = { id: user.id, email: user.email, full_name: user.full_name, birth_date: user.birth_date, plan: user.plan };
  res.redirect('/membro');
});

app.post('/logout', (req,res)=>{
  req.session.destroy(()=> res.redirect('/'));
});

// MEMBER AREA
app.get('/membro', requireAuth, async (req,res)=>{
  const user = await db.get('SELECT * FROM users WHERE id=?', [req.session.user.id]);
  const history = await db.all('SELECT * FROM readings WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [user.id]);
  res.render('member', { u: user, history });
});

// UPGRADE
app.get('/upgrade', requireAuth, (req,res)=> res.redirect('/planos'));

// PAYMENT PLACEHOLDER
app.post('/checkout/standard', requireAuth, (req,res)=>{
  // Here you would create a checkout session with your gateway (e.g., MercadoPago, Stripe)
  // For now, just simulate
  res.render('checkout', { message: 'Redirecionando para o gateway de pagamento...', plan: 'standard' });
});

// ADMIN PORTAL (toggle plan)
app.get('/admin', requireAdmin, async (req,res)=>{
  const users = await db.all('SELECT id,email,full_name,plan,plan_since FROM users ORDER BY created_at DESC');
  res.render('admin', { users });
});

app.post('/admin/plan', requireAdmin, async (req,res)=>{
  const { user_id, plan } = req.body;
  await db.run('UPDATE users SET plan=?, plan_since=CURRENT_TIMESTAMP WHERE id=?', [plan, user_id]);
  res.redirect('/admin');
});

// CONSULTATION: handle form and display result
function drawRandomCard() {
  const card = TAROT[Math.floor(Math.random()*TAROT.length)];
  const upright = Math.random() >= 0.5;
  return { ...card, upright };
}

function classifyTopic(question='') {
  const q = (question||'').toLowerCase();
  if (q.match(/amor|relaciona|paix|casament|namor/)) return 'amor';
  if (q.match(/trabalho|carreir|emprego|profiss|negoci|dinhei|finan/)) return 'trabalho';
  if (q.match(/saud|corpo|ansiedad|energia|bem-estar|doen/)) return 'saude';
  return 'geral';
}

function craftReading({ question, birth_date, card, sign }) {
  const topic = classifyTopic(question);
  const meanings = card.upright ? card.upright : card.reversed;
  const isUp = card.upright;
  const tone = isUp ? 'positivo' : 'de alerta';
  const lens = topic==='amor' ? 'relacionamentos' : topic==='trabalho' ? 'trabalho e projetos' : topic==='saude' ? 'saúde e energia' : 'seu momento';
  const brief = isUp
    ? 'há abertura para avanço, mantenha clareza e pequenas ações consistentes.'
    : 'revise expectativas, ajuste limites e evite decisões por impulso.';
  return `Para ${lens}, ${card.name} (${isUp ? 'direita' : 'invertida'}) indica ${meanings}. Em ${sign}, foque no essencial: ${brief} Responda à pergunta com objetividade esta semana e observe sinais sutis.`;
}

async function canUserDraw(userId, plan) {
  const start = dayjs().startOf('week').toISOString();
  const end = dayjs().endOf('week').toISOString();
  const count = await db.get('SELECT COUNT(*) as c FROM readings WHERE user_id=? AND created_at BETWEEN ? AND ?', [userId, start, end]);
  if (plan === 'free') return count.c < 1;
  if (plan === 'standard') return count.c < 3;
  return true; // premium_custom managed manually
}

app.post('/consultar', async (req,res)=>{
  const { question, full_name, birth_date } = req.body;
  // If logged in, enforce weekly quota based on plan
  let user = null;
  if (req.session.user) {
    user = await db.get('SELECT * FROM users WHERE id=?', [req.session.user.id]);
    const ok = await canUserDraw(user.id, user.plan);
    if (!ok) {
      return res.render('result', { blocked:true, question, full_name, birth_date, card:null, sign:null, reading:null });
    }
  }
  const sign = zodiacFrom(birth_date);
  const card = drawRandomCard();
  const reading_text = craftReading({ question, birth_date, card, sign });
  if (user) {
    await db.run('INSERT INTO readings (user_id, question, card_key, card_name_pt, upright, sign, reading_text) VALUES (?,?,?,?,?,?,?)', [
      user.id, question, card.key, card.name, card.upright ? 1 : 0, sign, reading_text
    ]);
  }
  res.render('result', { blocked:false, question, full_name, birth_date, card, sign, reading: reading_text });
});

// VIEWS
app.get('/sobre', (req,res)=> res.render('sobre'));

// 404
app.use((req,res)=> res.status(404).render('404'));

app.listen(PORT, ()=> {
  console.log(`EstacaoZen Tarot SaaS rodando em http://localhost:${PORT}`);
});
