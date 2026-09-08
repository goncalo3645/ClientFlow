# ClientFlow Backend API

API REST para o sistema de gestão de clientes (CRM) ClientFlow.

## Stack Tecnológica

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Base de Dados**: PostgreSQL
- **ORM**: Prisma
- **Autenticação**: JWT + Refresh Tokens
- **Validação**: Zod
- **Segurança**: Helmet, bcryptjs

## Instalação e Setup

### Pré-requisitos
- Node.js >= 18
- PostgreSQL database
- npm ou yarn

### Passos de instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais da base de dados

# Gerar Prisma Client
npm run prisma:generate

# Correr migrações (cria tabelas na BD)
npm run prisma:migrate

# Iniciar servidor em modo desenvolvimento
npm run dev
```

## Variáveis de Ambiente

| Variável | Descrição | Valor Padrão |
|----------|-----------|--------------|
| DATABASE_URL | Connection string PostgreSQL | - |
| JWT_SECRET | Chave secreta para JWT | - |
| JWT_EXPIRES_IN | Expiração do access token | 15m |
| REFRESH_TOKEN_EXPIRES_IN | Expiração do refresh token | 7d |
| PORT | Porta do servidor | 3001 |
| FRONTEND_URL | URL do frontend (CORS) | http://localhost:5173 |

## Endpoints da API

### Autenticação
- `POST /api/auth/register` - Registar novo utilizador
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Perfil do utilizador

### Clientes
- `GET /api/clients` - Listar clientes (com filtros e paginação)
- `GET /api/clients/:id` - Obter cliente por ID
- `POST /api/clients` - Criar cliente
- `PUT /api/clients/:id` - Atualizar cliente
- `DELETE /api/clients/:id` - Eliminar cliente

### Contactos
- `GET /api/contacts` - Listar contactos
- `POST /api/contacts` - Criar contacto
- `DELETE /api/contacts/:id` - Eliminar contacto

### Notas
- `GET /api/notes` - Listar notas
- `POST /api/notes` - Criar nota
- `PUT /api/notes/:id` - Atualizar nota
- `DELETE /api/notes/:id` - Eliminar nota

### Tarefas
- `GET /api/tasks` - Listar tarefas
- `POST /api/tasks` - Criar tarefa
- `PUT /api/tasks/:id` - Atualizar tarefa
- `DELETE /api/tasks/:id` - Eliminar tarefa

### Dashboard
- `GET /api/dashboard` - Visão geral do dashboard

### Estatísticas
- `GET /api/stats` - Estatísticas detalhadas

## Scripts Disponíveis

```bash
npm run dev          # Modo desenvolvimento (nodemon)
npm run build        # Compilar TypeScript
npm run start        # Iniciar servidor produção
npm run prisma:generate   # Gerar Prisma Client
npm run prisma:migrate    # Correr migrações (dev)
npm run prisma:studio     # Abrir Prisma Studio
```

## Estrutura de Pastas

```
src/
├── server.ts           # Entry point
├── middleware/         # Middleware (auth, etc.)
├── routes/             # Routes da API
├── services/           # Serviços (Prisma client)
└── utils/              # Utilitários (auth helpers)
prisma/
├── schema.prisma       # Schema da base de dados
└── migrations/         # Migrações da BD
```

## Segurança

- Passwords encriptadas com bcrypt
- JWT tokens com expiração curta (15 min)
- Refresh tokens armazenados na BD
- Rate limiting por IP
- CORS configurado
- Helmet para headers de segurança
- Validação de inputs com Zod

## License

ISC
