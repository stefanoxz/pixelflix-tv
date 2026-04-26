Plano para resolver a mensagem “Limite de telas atingido” sem quebrar a experiência:

1. Ajustar a resposta da função de categorias IPTV
   - Manter HTTP 200 para `MAX_CONNECTIONS`, como já foi parcialmente feito.
   - Incluir `fallback: true` e dados estruturados (`code`, `error`) para o app saber que é erro controlado, não falha fatal.
   - Aplicar o mesmo padrão para outros erros externos do painel, evitando 429/500 propagado para o navegador.

2. Ajustar o cliente para tratar `MAX_CONNECTIONS` como estado de interface
   - Em vez de lançar erro que pode acionar runtime error/tela branca, detectar `code: MAX_CONNECTIONS`.
   - Exibir mensagem amigável: “Esta conta atingiu o limite de telas. Aguarde alguns minutos ou feche sessões abertas.”
   - Permitir retry manual sem travar a rota.

3. Reduzir ainda mais chamadas simultâneas ao painel
   - Garantir que sync, prefetch e páginas não disparem catálogo em paralelo.
   - Manter fila global com concorrência 1 para APIs IPTV.
   - Evitar chamadas duplicadas para `get_vod_streams` e `get_series` enquanto uma sincronização já está em andamento.

4. Melhorar retry/backoff
   - Para `MAX_CONNECTIONS`, usar espera maior e mais realista antes de tentar de novo.
   - Evitar muitas tentativas rápidas, porque isso pode manter a conta presa no limite do painel.

5. Validar
   - Testar a função `iptv-categories` diretamente.
   - Confirmar que ela responde 200 com `{ code: "MAX_CONNECTIONS", fallback: true }` quando o painel bloqueia.
   - Rodar build para garantir que o app compila.

Detalhe técnico:
- A origem do erro é o painel IPTV externo, não o app em si.
- A correção não “remove” o limite real da conta, mas impede tela branca e reduz a chance de o próprio app criar conexões simultâneas demais.