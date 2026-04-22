

## Corrigir reprodução de canais, filmes e séries

### Causa raiz
O helper `proxyUrl()` em `src/services/iptv.ts` envia todo stream para uma VPS HTTP hardcoded (`http://82.197.65.169/stream-proxy/`). Como o preview/produção do app rodam em HTTPS, o navegador bloqueia silenciosamente a requisição (mixed content) — por isso o player fica eternamente em "Carregando stream..." e filmes/séries não abrem.

A edge function `stream-proxy` já existe, está deployada via HTTPS e tem allowlist de hosts + reescrita de playlist HLS pronta. Basta apontar o cliente pra ela.

### O que vou alterar

**Arquivo único: `src/services/iptv.ts`**

Trocar o `proxyUrl()` para usar a edge function:

```ts
export function proxyUrl(url: string): string {
  return `${FUNCTIONS_BASE}/stream-proxy?url=${encodeURIComponent(url)}`;
}
```

`FUNCTIONS_BASE` já é `${VITE_SUPABASE_URL}/functions/v1` (HTTPS), então o mixed content desaparece.

### Por que vai funcionar
- A edge `stream-proxy` consulta `allowed_servers`, então a DNS já cadastrada (`http://ubrutus.shop`) é liberada automaticamente.
- Para `.m3u8` (canais ao vivo), ela já reescreve cada segmento `.ts` para passar de novo pelo proxy — Hls.js consegue tocar.
- Para `.mp4` (filmes/episódios), faz passthrough com suporte a `Range` — o `<video>` nativo toca normalmente.
- O `Player.tsx` já detecta se a URL "já está proxiada" (`includes("/stream-proxy/")`) — vou manter esse guard funcionando ajustando o check pra `/stream-proxy?` (mais robusto, evita duplo-proxy independente de ter `/` no fim).

### O que NÃO muda
- Edge functions (já estão prontas).
- Banco / RLS / migrations.
- Player, páginas Live/Movies/Series — só passam a receber URLs HTTPS válidas.
- Filtro de formato (mp4/m3u8/mkv) continua funcionando igual.

### Resultado esperado
- **Canais ao vivo** (`.m3u8`): tocam direto no player Hls.js.
- **Filmes** (`.mp4`): tocam no `<video>` nativo, com seek/Range funcionando.
- **Séries**: idem filmes.
- **Formatos `.mkv/.avi/.mov`**: continuam mostrando o botão "Abrir em player externo" como já faz hoje.

