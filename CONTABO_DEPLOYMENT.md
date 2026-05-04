# Guia de Deploy - Contabo VPS

O projeto **Vibe Premium WebPlayer** está pronto para ser hospedado na sua VPS. O sistema consiste em duas partes: o **Frontend (React)** e o **Proxy Server (Node.js)**.

## 1. Preparação da VPS
Certifique-se de que sua VPS tem o **Node.js (v18+)** e o **Nginx** instalados.

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (via NVM recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# Instalar PM2 (para manter o proxy rodando)
npm install -g pm2
```

## 2. Deploy do Proxy Server (Porta 3001)
O Proxy é essencial para o EPG e para evitar erros de CORS em alguns streams.

1. Copie a pasta `proxy-server` para a VPS.
2. Dentro da pasta na VPS, execute:
```bash
pm2 start index.cjs --name "vibe-proxy"
pm2 save
```

## 3. Deploy do Frontend (Vite)
Como o projeto usa React, você deve gerar os arquivos estáticos.

1. No seu computador local, execute:
   `npm run build`
2. Isso gerará uma pasta `dist`.
3. Envie o conteúdo da pasta `dist` para o diretório web da sua VPS (ex: `/var/www/vibeplayer`).

## 4. Configuração do Nginx
Você deve configurar o Nginx para servir o frontend e, opcionalmente, fazer um reverse proxy para o proxy-server se quiser usar HTTPS.

**Exemplo de configuração `/etc/nginx/sites-available/vibe`:**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    root /var/www/vibeplayer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para o EPG/API (Opcional se quiser usar a mesma porta 80)
    location /proxy/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 5. Notas Importantes
- **CORS**: O Proxy está configurado para aceitar requisições de qualquer origem.
- **Portas**: Certifique-se de que a porta **3001** (ou a que você escolher) está aberta no firewall da Contabo.
- **HTTPS**: Se usar SSL (Certbot/Let's Encrypt), lembre-se que o browser pode bloquear chamadas `http` para o proxy se o site for `https`. O ideal é usar o reverse proxy do Nginx acima para acessar o proxy via `https://seu-dominio.com/proxy/`.

---
O projeto passou no teste de build (`npm run build`) com sucesso e todas as referências ao nome antigo foram removidas.
