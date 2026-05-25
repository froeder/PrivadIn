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

O projeto funciona melhor com `Node 20`.

```bash
nvm use 20
npm install
cp .env.example .env
npm run dev
```

Se o `nvm use 20` nao encontrar a versao, instale antes:

```bash
nvm install 20
nvm use 20
```

Preencha o arquivo `.env` com as credenciais do seu app Web no Firebase:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_DAILY_LOG_LIMIT=8
```

### Onde pegar os valores do `.env`

No Firebase Console:

1. Abra o projeto.
2. Va em `Project settings`.
3. Em `General`, role ate `Your apps`.
4. Crie um app Web com o icone `</>`, se ainda nao existir.
5. Copie os valores do snippet `firebaseConfig`.

Use exatamente os valores mostrados no Console, inclusive `storageBucket`.

## Firebase

### Checklist rapido

1. Crie um projeto no Firebase.
2. Crie um app Web e preencha o `.env`.
3. Ative `Authentication` com provedor `Email/Password`.
4. Crie o `Cloud Firestore`.
5. Rode o app localmente.
6. Crie o primeiro usuario.
7. Promova esse usuario para admin no Firestore.

### Passo a passo

#### 1. Criar projeto e app Web

Crie o projeto no Firebase Console e depois adicione um app Web para obter as credenciais do `.env`.

#### 2. Ativar Authentication

No Firebase Console:

- Va em `Authentication`
- Abra `Sign-in method`
- Ative `Email/Password`

#### 3. Criar o Firestore

No Firebase Console:

- Va em `Firestore Database`
- Clique em `Create database`
- Escolha `Production mode`

O app usa `Cloud Firestore`, nao `Realtime Database`.

#### 4. Rodar o app

```bash
nvm use 20
npm install
npm run dev
```

#### 5. Criar o primeiro usuario

Voce pode:

- criar o usuario manualmente em `Authentication > Users`, ou
- tentar entrar pelo app e usar o fluxo de solicitacao/aprovacao

#### 6. Transformar um usuario em admin

Depois do primeiro login, o app cria automaticamente o documento do usuario em `users/{uid}`.

Para promover esse usuario:

1. Abra `Firestore Database`
2. Va na colecao `users`
3. Abra o documento do usuario
4. Altere `role` para `admin`

#### 7. Configurar cooldown pelo painel admin

O cooldown de registro comeca com valor padrao de `15` minutos.

Depois que existir um admin, esse valor pode ser alterado pela pagina `Admin` e fica persistido no Firestore em `app_settings/global`.

### Observacoes importantes

- Este projeto nao esta configurado para Firebase Emulator.
- O Firestore fica vazio ate o app criar documentos.
- As colecoes aparecem automaticamente conforme o app e os admins usam o sistema.

## Collections

### `users`

- `uid`
- `name`
- `nickname`
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

- `id`
- `userId`
- `userName`
- `createdAt`
- `points`
- `isWeeklyActive`

### `admin_audit_logs`

- `action`
- `adminId`
- `adminName`
- `targetUserId`
- `targetUserName`
- `delta`
- `points`
- `removedLogId`
- `createdAt`
- `description`

### `registration_requests`

- `email`
- `name`
- `approvalCode`
- `status`
- `createdAt`
- `usedAt`
- `claimedBy`

### `registration_attempts`

- `email`
- `status`
- `createdAt`
- `approvalCodeProvided`
- `requestId`
- `message`

### `app_settings/global`

- `cooldownMinutes`
- `updatedAt`
- `updatedBy`

## Funcionalidades

- Login com Firebase Authentication
- Dashboard com ranking geral em tempo real
- Top 3 com medalhas
- Ranking semanal separado
- Registro com cooldown anti-fraude configuravel pelo admin
- Limite diario configuravel por `VITE_DAILY_LOG_LIMIT`
- Historico pessoal com totais diario e semanal
- Estatisticas, grafico semanal e ranking por horario comercial
- Conquistas
- Perfil com apelido e avatar DiceBear customizado
- Modo admin para reset semanal, remocao de registros, ajuste de pontos e configuracao de cooldown
- Fluxo de solicitacao de acesso com codigo aprovado por admin
- Auditoria das acoes administrativas
- Confetes, toasts e som opcional mutavel
- Layout responsivo para celular

## Deploy no Firebase Hosting

```bash
nvm use 20
npm run build
firebase deploy
```

O arquivo `firebase.json` ja aponta o Hosting para `dist` e usa rewrite para SPA.
