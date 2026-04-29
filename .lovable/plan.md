Você está certo: o problema principal não é só “escolher DNS errada”. O fluxo atual também está expondo usuário e senha no F12 porque o navegador tenta acessar diretamente URLs como:

```text
https://celerisvip.top/player_api.php?username=...&password=...
```

Isso é ruim por três motivos:

1. aparece no console/rede do navegador;
2. envia a mesma credencial para várias DNS antes de achar a certa;
3. gera vários erros CORS/404/521 até cair na DNS correta.

A correção prioritária é mudar o login para ser 100% pelo backend, sem tentativa direta pelo navegador.

## Plano de correção

### 1. Desativar login direto pelo navegador
Vou remover o fluxo “browser-first” do login.

Hoje o app faz assim:

```text
Login -> pega todas as DNS autorizadas -> navegador tenta DNS 1, DNS 2, DNS 3... -> fallback backend
```

Vou mudar para:

```text
Login -> chama backend seguro -> backend testa DNS -> navegador recebe só sucesso/erro
```

Com isso:

- usuário/senha deixam de aparecer em URLs de DNS IPTV no console do navegador;
- o navegador não faz mais GET direto para `player_api.php` de várias DNS;
- os erros CORS/404/521 deixam de poluir o console do cliente;
- as credenciais só trafegam para a função de backend do próprio sistema.

Observação: no F12 ainda poderá aparecer uma chamada para a função de login do próprio sistema, porque qualquer formulário web precisa enviar usuário/senha para autenticar. Mas não aparecerá mais usuário/senha sendo enviado para várias DNS externas.

### 2. Adicionar campo opcional de DNS no login por usuário/senha
Na tela de login, vou adicionar um campo opcional:

```text
DNS / Servidor
Usuário
Senha
```

Se o usuário preencher a DNS:

- o backend tenta somente aquela DNS;
- não varre as outras;
- se a DNS não estiver autorizada, bloqueia com mensagem clara.

Se o usuário não preencher:

- o backend ainda pode tentar as DNS autorizadas, mas sem expor isso no navegador;
- vou melhorar a ordem de tentativa para priorizar histórico do usuário quando existir.

### 3. Melhorar escolha automática quando não houver DNS informada
Quando o usuário digitar só usuário/senha, vou ajustar o backend para ordenar candidatas assim:

1. DNS onde esse mesmo usuário já logou com sucesso recentemente;
2. DNS que estão saudáveis/funcionando;
3. demais DNS autorizadas.

Assim, mesmo sem preencher DNS, diminui bastante a chance de escolher uma errada.

### 4. Fazer “Remover DNS” apagar definitivamente
Na área **Admin -> DNS / Servidores**, vou alterar a ação de remover.

Ao apagar uma DNS, o backend vai limpar:

- DNS autorizada (`allowed_servers`);
- catálogo de DNS bloqueados/sugeridos relacionado (`blocked_dns_servers`);
- falhas automáticas (`blocked_dns_failures`);
- diagnósticos dessa DNS;
- eventos de stream dessa DNS quando identificáveis;
- registros de login daquela DNS que alimentam pendências/estatísticas.

Isso evita que uma DNS removida continue aparecendo como bloqueada, pendente, com erro ou candidata indireta.

### 5. Ajustar textos da interface
Vou trocar os textos para deixar claro:

- “Remover DNS” -> “Apagar definitivamente”;
- aviso dizendo que também limpa erros e pendências daquela DNS;
- no catálogo de DNS bloqueados, a lixeira também será tratada como exclusão definitiva, não como “descartar para voltar depois”.

### 6. Corrigir aviso de preload do logo
Esse aviso:

```text
logo-supertech.webp was preloaded but not used
```

não é o problema principal, mas vou limpar também. Vou revisar o preload do logo para usar `as="image"` corretamente ou remover o preload se não for necessário.

### 7. Revisar warnings de ref no admin
Os warnings:

```text
Function components cannot be given refs
```

não causam o vazamento das credenciais, mas vou revisar `AdminProtectedRoute`, `RouteFallback` e a composição de rotas para remover esse ruído do console.

## Arquivos envolvidos

- `src/services/iptv.ts`
  - remover/desativar tentativas diretas do navegador;
  - fazer login sempre via backend;
  - impedir URLs externas com `username/password` no console.

- `supabase/functions/iptv-login/index.ts`
  - melhorar ordenação das DNS candidatas;
  - priorizar histórico por usuário;
  - continuar validando allowlist no backend.

- `src/pages/Login.tsx`
  - adicionar campo opcional de DNS;
  - enviar DNS ao backend quando preenchida;
  - ajustar mensagens de erro.

- `supabase/functions/admin-api/index.ts`
  - transformar remoção de DNS em limpeza definitiva;
  - limpar registros relacionados à DNS removida.

- `src/pages/Admin.tsx`
  - ajustar botão/modal para “Apagar definitivamente”.

- `src/components/admin/BlockedDnsPanel.tsx`
  - ajustar lixeira e mensagens para exclusão definitiva.

- `index.html` / componentes de rota, se necessário
  - corrigir preload do logo e warnings de ref.

## Resultado esperado

Depois da implementação:

- o F12 não mostrará mais várias URLs IPTV com usuário e senha;
- o login não ficará batendo em várias DNS pelo navegador;
- quando informar a DNS, só ela será testada;
- DNS apagada será removida de verdade do sistema e dos erros relacionados;
- o console ficará bem mais limpo na VPS.