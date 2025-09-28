# Estação Zen — Tarot SaaS (Node.js + Express + SQLite)

> MVP completo com login, planos, tirada semanal (Free), 3 tiradas semanais (Standard), histórico, LGPD e portal admin para upgrade manual.

## Requisitos
- Node.js 18+
- npm

## Como rodar
```bash
npm install
npm run seed   # cria admin e zera dados
npm run dev
# abra http://localhost:3000
```

## Credenciais admin
- E-mail: admin@estacaozen.com.br
- Senha: TroqueEstaSenha123! (altere em production + defina ADMIN_EMAIL e SESSION_SECRET)

## Imagens de cartas
Coloque as imagens do baralho Rider‑Waite‑Smith (domínio público) em `public/img/cards/` com estes nomes:
```
00-louco.jpg
01-mago.jpg
02-sacerdotisa.jpg
...
21-mundo.jpg
```
Você pode começar só com Arcanos Maiores e adicionar os Menores depois.

## Gateway de pagamento
- Integre Mercado Pago, Stripe ou outro no endpoint `POST /checkout/standard`.
- Trate o webhook de confirmação para executar o update de plano no banco **ou** use o portal `/admin` para ativação manual rápida.

## Limites por plano (semana ISO)
- Free: 1 tirada/semana
- Standard: 3 tiradas/semana
- Premium: gerenciado manualmente

## LGPD
Página em `/lgpd` com política básica. Ajuste conforme seu jurídico.

## Deploy no Lovable
- Crie um novo projeto Node/Express.
- Suba estes arquivos, configure variáveis de ambiente:
  - `SESSION_SECRET` (obrigatório em produção)
  - `ADMIN_EMAIL` (e-mail que acessa /admin)
- Configure build: `npm install` + `npm run start`.
- Certifique-se de que a pasta `public/` é servida como estático.
