# IPTV Project - Setup Local

Este guia ajudará você a rodar o projeto IPTV no seu computador local.

## Pré-requisitos

- **Node.js**: Versão 18 ou superior. [Download aqui](https://nodejs.org/).
- **Git**: Para clonar o repositório.

## Passo a Passo

### 1. Clonar o Repositório

Se você ainda não clonou, use o comando:
```bash
git clone <url-do-repositorio>
cd <nome-da-pasta>
```

### 2. Instalar Dependências

Utilize o npm para instalar as bibliotecas necessárias:
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente

1. Copie o arquivo `.env.example` para um novo arquivo chamado `.env`:
   ```bash
   cp .env.example .env
   ```
2. Abra o arquivo `.env` e preencha as variáveis:
   - `VITE_SUPABASE_URL`: Já preenchido (URL do Supabase).
   - `VITE_SUPABASE_ANON_KEY`: Você encontra no painel do Supabase em Project Settings > API.
   - `VITE_SUPABASE_PROJECT_ID`: Já preenchido.

### 4. Rodar o Projeto

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```
O projeto estará disponível em `http://localhost:5173`.

## Estrutura do Projeto

- `/src`: Código fonte do frontend (React + Tailwind).
- `/supabase`: Configurações e Edge Functions.
- `public/`: Arquivos estáticos.

## Notas Adicionais

- **Edge Functions**: Para rodar as funções do Supabase localmente, você precisará da [Supabase CLI](https://supabase.com/docs/guides/cli).
- **CORS**: Se encontrar problemas de CORS localmente, verifique as configurações no painel do Supabase.
