Polir o mini player (estado conectando)

Olhando a screenshot, dá para refinar três elementos visíveis:

1. **Barra de controles superior** (rewind, fast-forward, 1x, flag, X)
   - Hoje: 5 botões quadrados isolados, cada um com seu próprio fundo `bg-black/60`. Visual fragmentado.
   - Proposta: agrupar todos num único "pill" arredondado com glassmorphism (`bg-black/55 backdrop-blur-md ring-1 ring-white/5`), botões `ghost` redondos com hover `bg-white/10`, separadores verticais finos entre grupos (skip / speed / ações).

2. **Badge "Conectando" (canto inferior direito)**
   - Hoje: card retangular com borda tonal.
   - Proposta: mesma linguagem do pill (rounded-full, mesmo blur/ring), com dot pulsante (`animate-ping`) na cor do status. Fica coerente com a toolbar.

3. **Loader central "CONECTANDO..."**
   - Hoje: spinner + texto bem espaçado, fundo `bg-black` chapado.
   - Proposta: spinner com glow sutil (blur halo na cor primary), fundo gradiente do preto, tracking um pouco mais elegante, sem reticências.

4. **Botão "Logs" (canto inferior esquerdo)** — manter funcional, só harmonizar para usar o mesmo estilo `rounded-full` + glass dos demais elementos.

Arquivo afetado: `src/components/Player.tsx` (linhas ~2053–2270, blocos de controles, badge de status, loader e botão Logs). Sem mudança de comportamento — só CSS/markup visual.