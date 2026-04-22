
## Corrigir de verdade a reprodução de canais, filmes e séries

### O que está realmente quebrado agora
Os dados mostram que o problema não está mais no login em si:

- `iptv-login` está retornando `200` e há logins com sucesso.
- O erro atual acontece depois, no carregamento do stream.
- A função `stream-proxy` está respondendo `403` e `502` para URLs de live e VOD.
- O frontend ainda monta URLs de mídia de forma incompleta.

### Causas raiz confirmadas
1. **O app ignora `server_info` do login**
   - O login recebe `server_info` com protocolo e portas do servidor IPTV.
   - Hoje o app salva só `server_url` e monta streams como `http://dominio/live/...` / `movie/...` / `series/...`.
   - Isso pode apontar para a porta/protocolo errado para mídia, mesmo que `player_api.php` funcione.

2. **O proxy está barrando redirecionamentos do stream**
   - Há respostas `403` em `stream-proxy` para URLs válidas de mídia.
   - Isso indica que o servidor IPTV provavelmente redireciona o arquivo para outro host/CDN, e a função atual bloqueia esse host final.

3. **Ainda existe risco de duplo proxy**
   - Algumas telas continuam passando URL já proxiada para o `Player`, enquanto o `Player` também tenta proteger/proxiar.
   - Já apareceu chamada aninhada para `/stream-proxy?url=https://.../stream-proxy?...`.

4. **O filtro de compatibilidade está incompleto**
   - Ele só existe em Séries.
   - E decide só pela extensão (`container_extension`), sem considerar `direct_source` ou a URL real final.
   - Assim, conteúdo que poderia abrir no navegador pode ser marcado errado, e vice-versa.

---

## O que vou alterar

### 1) Salvar a configuração correta do servidor após o login
**Arquivos:**
- `src/pages/Login.tsx`
- `src/context/IptvContext.tsx`
- `src/services/iptv.ts`

**Mudança:**
- Persistir também `server_info` na sessão IPTV.
- Criar um helper central para resolver a base correta do stream usando:
  - `server_info.server_protocol`
  - `server_info.url`
  - `server_info.port` / `server_info.https_port`
- Manter fallback para `server_url` atual quando necessário.

**Resultado:**
Os links de live, filme e episódio passam a ser montados com o endpoint real de mídia, e não apenas com a DNS cadastrada.

---

### 2) Reescrever a geração das URLs de reprodução
**Arquivo:**
- `src/services/iptv.ts`

**Mudança:**
- Centralizar a montagem de URL em helpers únicos, usando a base resolvida do stream.
- Para live/VOD, preferir `direct_source` quando ele vier preenchido e for válido.
- Para séries, usar a base correta + episode id + extensão, com fallback seguro.

**Resultado:**
O player deixa de depender de URLs montadas “no escuro”.

---

### 3) Remover o pré-proxy das páginas e deixar o `Player` controlar isso sozinho
**Arquivos:**
- `src/pages/Live.tsx`
- `src/pages/Movies.tsx`
- `src/pages/Series.tsx`
- `src/components/Player.tsx`

**Mudança:**
- Passar sempre a **URL bruta** para o `Player`.
- O `Player` será o único ponto responsável por aplicar `proxyUrl(...)`.
- Ajustar a detecção de URL já proxiada para evitar qualquer duplo-encaminhamento.

**Resultado:**
Fluxo mais previsível e sem chamadas aninhadas para a mesma função.

---

### 4) Corrigir a função `stream-proxy` para o cenário real dos streams
**Arquivo:**
- `supabase/functions/stream-proxy/index.ts`

**Mudança:**
- Manter a proteção anti-SSRF.
- Permitir redirecionamentos seguros quando o stream sair do host inicial para:
  - mesma família/domínio esperado, ou
  - hosts explicitamente derivados/autorizados a partir do stream original.
- Registrar melhor o motivo do bloqueio em erro/redirect proibido.

**Resultado:**
Se o servidor IPTV entregar o vídeo por CDN, o stream deixa de morrer com `403`.

---

### 5) Fazer o filtro “abre no navegador” funcionar de verdade
**Arquivos:**
- `src/services/iptv.ts`
- `src/pages/Movies.tsx`
- `src/pages/Series.tsx`

**Mudança:**
- Basear a compatibilidade na estratégia real de playback:
  - URL final/raw URL
  - extensão
  - `direct_source` quando existir
- Aplicar o mesmo critério em filmes e séries.
- Continuar exibindo “Abrir em player externo” para formatos realmente externos (`mkv`, `avi`, `mov` etc.).

**Resultado:**
O filtro passa a separar corretamente o que toca no navegador e o que precisa de player externo.

---

### 6) Ajuste secundário de UI
**Arquivo:**
- `src/components/MediaCard.tsx`

**Mudança:**
- Converter `MediaCard` para `forwardRef` se necessário, para eliminar o warning atual de ref no `SeriesPage`.

**Resultado:**
Remove o warning de console e evita comportamento estranho em componentes Radix/Tooltip.

---

## Como vou validar
1. Fazer login novamente e garantir que a sessão salve `server_info`.
2. Testar:
   - 1 canal ao vivo (`.m3u8`)
   - 1 filme (`.mp4`)
   - 1 episódio de série
3. Confirmar que:
   - o `Player` recebe URL bruta
   - só existe um proxy por reprodução
   - `stream-proxy` não retorna mais `403` para redirecionamento legítimo
   - o filtro mostra corretamente o que abre no navegador
4. Se algum stream específico ainda redirecionar para host totalmente externo e não confiável, vou endurecer a regra com allowlist derivada sem abrir brecha de segurança.

---

## Resultado esperado
- Canais deixam de ficar presos em “Carregando stream...”.
- Filmes e séries passam a abrir com a base/protocolo/porta corretos.
- Conteúdo compatível toca no navegador.
- Conteúdo incompatível mostra corretamente a ação de abrir em player externo.
- O problema deixa de ser “login funciona mas nada reproduz”.
