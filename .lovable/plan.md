
## Plano — cartão de diagnóstico no player e correção do “carregando infinito” nos canais ao vivo

### Diagnóstico confirmado
O problema não está só na UI do spinner. No `Player` atual ainda existem dois erros de fluxo que explicam por que o ao vivo continua “carregando”:

1. **`MANIFEST_PARSED` está sendo tratado como playback iniciado**
   - Hoje `engagedRef.current = true` é marcado cedo demais.
   - Isso desarma o watchdog antes do primeiro frame real.
   - Resultado: o canal pode nunca tocar e mesmo assim o player não entra no estado correto de falha.

2. **Sequência do HLS ainda é frágil**
   - O código faz `hls.loadSource(...)` antes de `hls.attachMedia(...)`.
   - Em canais instáveis isso pode causar corrida de eventos e deixar o player preso em estado parcial.

### O que será implementado

#### 1. `src/components/Player.tsx` — máquina de diagnóstico explícita
Criar estado de diagnóstico separado do overlay principal:

- `connecting`
- `playback_started`
- `stall_timeout`
- `codec_incompatible`
- `stream_error`

Também adicionar:
- `lastReason`
- `playbackStartedRef`
- `manifestReadyRef`
- `stallSinceRef`
- `retryNonce`

Regra principal:
- **Só considerar “Reprodução iniciada” após `playing` ou `loadeddata`**
- `MANIFEST_PARSED` passa a significar apenas **manifest carregado**, não reprodução real

#### 2. `src/components/Player.tsx` — corrigir bootstrap do HLS
Trocar o fluxo para o padrão seguro:

```ts
const hls = new Hls(HLS_CONFIG);
hls.attachMedia(video);
hls.once(Hls.Events.MEDIA_ATTACHED, () => {
  hls.loadSource(safeSrc);
});
```

Ajustes adicionais:
- `MANIFEST_PARSED` não encerra mais o diagnóstico nem o timeout inicial
- o timeout inicial só é limpo no primeiro `playing` ou `loadeddata`

#### 3. `src/components/Player.tsx` — watchdog real contra carregamento infinito
Implementar dois timers distintos:

**a) Timeout de bootstrap**
- Se não houver `playing`/`loadeddata` em até 12s:
  - status = `stall_timeout`
  - `loading = false`
  - `lastReason = "sem reprodução após 12s"` ou último detalhe HLS/vídeo disponível

**b) Timeout de stall após manifest**
- Se o player entrar em `waiting`/`stalled` e não se recuperar em 8s:
  - status = `stall_timeout`
  - mostrar motivo do último erro HLS/vídeo
  - parar o spinner infinito

Com isso, nenhum canal poderá ficar eternamente em `loading=true`.

#### 4. `src/components/Player.tsx` — cartão pequeno de diagnóstico no player
Adicionar um cartão compacto, não-bloqueante, no canto inferior direito do player com:

- Status:
  - `Reprodução iniciada`
  - `Stall timeout`
  - `Codec incompatível`
  - opcionalmente `Conectando`
- Motivo do último erro:
  - `BUFFER_STALLED_ERROR`
  - `manifest carregado, mas sem frames`
  - `MEDIA_ERR_DECODE`
  - `MEDIA_ERR_SRC_NOT_SUPPORTED`
  - mensagem retornada do backend/HLS quando existir

Formato visual:
- pequeno
- sem ocupar a tela toda
- sempre visível enquanto houver `src`
- cor por estado:
  - verde = reprodução iniciada
  - amarelo = stall timeout
  - vermelho = codec incompatível / erro

#### 5. `src/components/Player.tsx` — mapear erros corretamente
Melhorar o tratamento de erro do HLS e do `<video>`:

**HLS**
- guardar sempre o último `data.type` e `data.details`, mesmo quando o erro não for fatal
- quando houver `MEDIA_ERROR` com cara de codec/decode, trocar diagnóstico para `codec_incompatible`
- quando houver `NETWORK_ERROR`/`BUFFER_STALLED_ERROR`, alimentar `lastReason`

**Video element**
- mapear:
  - `MEDIA_ERR_DECODE` → `Codec incompatível`
  - `MEDIA_ERR_SRC_NOT_SUPPORTED` → `Codec incompatível`
  - demais códigos → `stream_error`
- parar de sobrescrever tudo com mensagem genérica
- manter ações úteis:
  - abrir externamente
  - copiar link
  - tentar novamente

#### 6. `src/components/Player.tsx` — consertar retry de verdade
O `handleRetry` atual não força um novo setup com segurança.

Será trocado por:
- `retryNonce` no estado
- efeito principal dependente de `retryNonce`
- botão “Tentar novamente” realmente recria a sessão do player e reinicia o HLS do zero

#### 7. `src/pages/Live.tsx` — forçar remount limpo ao trocar canal
Adicionar `key` estável no `Player` com base no canal ativo, por exemplo:
- `activeChannel?.stream_id`
- e opcionalmente a URL final

Isso garante:
- teardown completo por canal
- nenhum estado residual de um canal anterior contaminando o próximo
- troca mais previsível no ao vivo

#### 8. Telemetria de diagnóstico
Aproveitar `reportStreamEvent` já existente para registrar transições relevantes:
- `diagnostic_status_change`
- `stall_timeout`
- `codec_incompatible`
- `playback_started`

Sem mudar backend agora; apenas enviar `meta` mais útil do frontend para facilitar depuração posterior.

### Resultado esperado
Depois dessa refatoração:

- o player **não ficará mais preso indefinidamente em “Conectando…”**
- canais que realmente tocarem mostrarão **“Reprodução iniciada”**
- canais que travarem passarão para **“Stall timeout”** com motivo
- canais com problema de codec mostrarão **“Codec incompatível”** com a causa
- a troca entre canais ao vivo ficará mais estável por causa do remount limpo e do bootstrap HLS corrigido

### Arquivos a alterar
- `src/components/Player.tsx`
- `src/pages/Live.tsx`

### Validação
Após aplicar:
1. abrir um canal que funciona → deve exibir `Reprodução iniciada`
2. abrir um canal que hoje fica só carregando → deve sair do spinner e virar `Stall timeout`
3. abrir um canal com decode ruim / codec incompatível → deve mostrar `Codec incompatível`
4. clicar em “Tentar novamente” → deve reinicializar o player de fato
5. trocar de canal ao vivo → o novo canal deve montar limpo, sem herdar estado do anterior
