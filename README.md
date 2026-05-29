# PrivadIn

Sistema web gamificado para registrar pontuações de uma competição entre amigos baseada em "cagar durante o horário de trabalho".

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

Se o `nvm use 20` não encontrar a versão, instale antes:

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
3. Em `General`, role até `Your apps`.
4. Crie um app Web com o ícone `</>`, se ainda não existir.
5. Copie os valores do snippet `firebaseConfig`.

Use exatamente os valores mostrados no Console, inclusive `storageBucket`.

## Firebase

### Checklist rápido

1. Crie um projeto no Firebase.
2. Crie um app Web e preencha o `.env`.
3. Ative `Authentication` com provedor `Email/Password`.
4. Crie o `Cloud Firestore`.
5. Rode o app localmente.
6. Crie o primeiro usuário.
7. Promova esse usuário para admin no Firestore.

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

O app usa `Cloud Firestore`, não `Realtime Database`.

#### 4. Rodar o app

```bash
nvm use 20
npm install
npm run dev
```

#### 5. Criar o primeiro usuário

Você pode:

- criar o usuário manualmente em `Authentication > Users`, ou
- tentar entrar pelo app e usar o fluxo de solicitação/aprovacao

#### 6. Transformar um usuário em admin

Depois do primeiro login, o app cria automaticamente o documento do usuário em `users/{uid}`.

Para promover esse usuário:

1. Abra `Firestore Database`
2. Va na colecao `users`
3. Abra o documento do usuário
4. Altere `role` para `admin`

#### 7. Configurar cooldown pelo painel admin

O cooldown de registro comeca com valor padrão de `15` minutos.

Depois que existir um admin, esse valor pode ser alterado pela página `Admin` e fica persistido no Firestore em `app_settings/global`.

### Observacoes importantes

- Este projeto não esta configurado para Firebase Emulator.
- O Firestore fica vazio até o app criar documentos.
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
- Limite diário configuravel por `VITE_DAILY_LOG_LIMIT`
- Histórico pessoal com totais diário e semanal
- Estatísticas, gráfico semanal e ranking por horário comercial
- Conquistas
- Perfil com apelido e avatar DiceBear customizado
- Modo admin para reset semanal, remoção de registros, ajuste de pontos e configuração de cooldown
- Fluxo de solicitação de acesso com código aprovado por admin
- Auditoria das ações administrativas
- Confetes, toasts e som opcional mutavel
- Layout responsivo para celular

## Deploy no Firebase Hosting

```bash
nvm use 20
npm run build
firebase deploy
```

O arquivo `firebase.json` já aponta o Hosting para `dist` e usa rewrite para SPA.
