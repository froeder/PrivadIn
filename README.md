# PrivadIn

Sistema web gamificado para registrar pontuacoes de uma competicao entre amigos baseada em "cagar durante o horario de trabalho".

## Stack

- React + Vite + TypeScript
- TailwindCSS
- Firebase Authentication
- Firestore em tempo real com `onSnapshot`
- Firebase Hosting
- PWA instalavel

## Rodando localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env` na raiz usando `.env.example` como base:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_DAILY_LOG_LIMIT=8
```

## Firebase

1. Crie um projeto no Firebase.
2. Ative Authentication com provedor Email/Senha.
3. Crie os usuarios manualmente no Firebase Authentication.
4. Ative Firestore.
5. Publique as regras:

```bash
firebase deploy --only firestore:rules
```

6. Para transformar alguem em admin, edite o documento em `users/{uid}` e mude `role` para `admin`.

O app cria automaticamente o documento do usuario em `users` no primeiro login.

## Collections

### `users`

- `uid`
- `name`
- `email`
- `avatar`
- `role`
- `totalPoints`
- `weeklyPoints`
- `currentDailyStreak`
- `currentWeeklyStreak`
- `bestStreak`
- `createdAt`
- `firstLogAt`
- `lastLogAt`

### `poop_logs`

- `userId`
- `userName`
- `createdAt`
- `points`
- `isWeeklyActive`

## Funcionalidades

- Login com Firebase Authentication
- Dashboard com ranking geral em tempo real
- Top 3 com medalhas
- Ranking semanal separado
- Registro com cooldown anti-fraude de 15 minutos
- Limite diario configuravel por `VITE_DAILY_LOG_LIMIT`
- Historico pessoal com totais diario e semanal
- Estatisticas, grafico semanal e ranking por horario comercial
- Conquistas
- Modo admin para reset semanal, remocao de registros e ajuste de pontos
- Confetes, toasts e som opcional mutavel
- Layout responsivo para celular

## Deploy no Firebase Hosting

```bash
npm run build
firebase deploy
```

O arquivo `firebase.json` ja aponta o Hosting para `dist` e usa rewrite para SPA.
