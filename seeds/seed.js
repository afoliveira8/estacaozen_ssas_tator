
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = await open({ filename: path.join(__dirname, '..', 'data.db'), driver: sqlite3.Database });

await db.exec(`DELETE FROM users; DELETE FROM readings;`);

const adminPass = await bcrypt.hash('TroqueEstaSenha123!', 10);
await db.run(`INSERT INTO users (email, full_name, birth_date, password_hash, plan, plan_since) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)`,
  ['admin@estacaozen.com.br', 'Admin', '1990-01-01', adminPass, 'premium_custom']
);

console.log('Seed concluído. Admin: admin@estacaozen.com.br / TroqueEstaSenha123!');
process.exit(0);
