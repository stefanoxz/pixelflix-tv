## Diagnóstico

A mensagem **"Servidor IPTV não respondeu. Verifique a DNS ou porta da URL."** vem do fluxo de login IPTV quando o backend tenta conectar no servidor cadastrado `http://bkpac.cc` e recebe falha de rede.

Pelos dados reais do projeto:

- `bkpac.cc` está cadastrado no admin como DNS autorizada.
- O teste de DNS retorna repetidamente:
  - `state: offline`
  - `reason: rst`
  - `error: network`
- A função de login registra `proxy_enabled=false`.
- Isso indica que o servidor IPTV está resetando a conexão do IP do backend.
- Não é erro de senha, nem de player, nem de preflight HEAD.

## Plano de correção real

### 1. Não alterar o player nem stream-proxy agora

Não fazer as mudanças do prompt anterior porque o código atual já não usa `/api/stream-proxy`, não tem `STREAM_OFFLINE_PREFLIGHT` e não faz `HEAD` no Player.

### 2. Configurar saída via proxy brasileiro

Usar o suporte já implementado no projeto para `IPTV_PROXY_URL`.

O valor precisa ser uma URL de proxy HTTP/HTTPS com IP brasileiro, por exemplo:

```text
http://usuario:senha@host:porta
```

ou, se não tiver autenticação:

```text
http://host:porta
```

Depois de configurado, `iptv-login` e `check-server` passarão a mostrar `proxy_enabled=true`.

### 3. Testar novamente a DNS Black

Depois do secret configurado:

1. Rodar o ping no admin para `http://bkpac.cc`.
2. Confirmar que deixa de retornar `reason: rst`.
3. Fazer login com as credenciais IPTV.
4. Entrar em `/live` e testar um canal.

### 4. Só investigar player se o login passar

Se o login passar e o canal ainda não tocar, aí sim investigar:

- chamadas `stream-token`
- chamadas `stream-proxy`
- logs do painel Terminal do Player
- erros HLS.js
- erro 520 real, se aparecer

## Por que não usar fila/job aqui

A arquitetura de fila não resolve este caso, porque o problema não é timeout longo. É bloqueio de rede por origem: o servidor encerra a conexão quando ela vem do IP do backend. Uma fila continuaria tentando a partir do mesmo IP bloqueado e falharia igual.

## Resultado esperado

Após configurar `IPTV_PROXY_URL` com proxy brasileiro:

- `check-server` deve parar de retornar `rst` para `bkpac.cc`.
- `iptv-login` deve conseguir validar usuário/senha.
- O app poderá carregar categorias/canais.
- A investigação do player só será necessária se houver erro depois do login funcionar.