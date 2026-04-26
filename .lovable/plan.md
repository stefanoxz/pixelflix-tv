## Resetar velocidade de reprodução ao trocar de canal/conteúdo

### Comportamento atual
A velocidade do player (0.5x a 2x) hoje é **persistida em `localStorage`** (`player.rate`). Isso faz com que, se o usuário escolher 1.5x num filme/canal, ao trocar pra outro conteúdo o novo player abra também em 1.5x. O usuário quer que **toda nova reprodução comece em 1x (normal)**.

### Mudança
No componente `src/components/Player.tsx`:

1. **Estado inicial sempre 1x**: trocar o `useState` da `playbackRate` para iniciar fixo em `1`, removendo a leitura do `localStorage`.
2. **Não persistir mais**: dentro de `setPlaybackRate`, remover a gravação em `localStorage.setItem("player.rate", …)`. A escolha vale só durante aquela sessão de reprodução.
3. **Reset ao trocar `src`**: adicionar um `useEffect` que, sempre que o `src` (URL do stream) mudar, força `playbackRate` de volta para `1` e aplica imediatamente ao elemento `<video>`. Isso garante reset tanto ao trocar de canal ao vivo (mesmo `<Player>` montado) quanto entre filmes/episódios (overlay reabre).
4. **Limpar chave antiga**: remover (uma vez) a chave `player.rate` que ficou salva em `localStorage` para usuários atuais, evitando que herdem a velocidade antiga.

### Resultado esperado
- Usuário escolhe 1.5x num canal → muda pra outro canal → volta automaticamente para 1x.
- Mesmo comportamento ao abrir um filme ou episódio depois de ter alterado a velocidade em outro conteúdo.
- O menu de velocidade continua funcionando normalmente durante a reprodução atual.

### Fora de escopo
Nenhuma alteração em fluxo de login, proxy, autenticação IPTV, banco de dados ou outros controles do player (volume, qualidade, motor HLS/MPEG-TS).