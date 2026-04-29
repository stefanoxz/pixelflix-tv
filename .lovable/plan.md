## Problema

No painel **Admin → Diagnóstico de endpoint**, na seção "Resolução automática → Candidatos funcionais", o botão **Aplicar** (ao lado de cada DNS sugerido, ex.: `http://xc.s-dns.org`) não persiste nada. Hoje ele só faz:

```ts
const applyCandidate = (base: string) => {
  setServerUrl(base);              // troca o campo do próprio painel
  setResolveResult(null);
  toast.success("URL aplicada — clique em 'Executar diagnóstico' para revalidar.");
};
```

Ou seja: o admin vê o toast, o campo de URL muda, mas **nada é salvo** em `allowed_servers`, nada vai para o login dos usuários, nenhum DNS bloqueado é desmarcado. Por isso parece que "não acontece nada".

A action `allow_server` já existe no `admin-api` (faz `upsert` em `allowed_servers` + audit log) — basta o botão chamá-la.

## O que vai mudar

### 1. `src/components/admin/EndpointTestPanel.tsx`

Transformar `applyCandidate` em uma ação real:

- Tornar `async`, com estado `applyingCandidate: string | null` para mostrar loading no botão certo.
- Chamar `invokeAdminApi("allow_server", { server_url: base, label: <derivado do host>, notes: "Aplicado via diagnóstico automático" })`.
- Em caso de sucesso:
  - `setServerUrl(base)` (mantém comportamento atual de preencher o campo).
  - Toast de sucesso: "DNS X salvo como servidor autorizado. Usuários já podem usá-lo no login.".
  - Se `data.warning` vier preenchido (Cloudflare 404), mostrar `toast.warning(data.warning)`.
  - Disparar callback opcional `onServerApplied?: (url: string) => void` (já passável pelo Admin) para invalidar listas de DNS no painel pai.
- Em caso de erro: `toast.error(err.message)`.
- No JSX dos cards de candidatos (linha ~803), trocar o botão por:
  ```tsx
  <Button
    size="sm"
    onClick={() => applyCandidate(c.base)}
    disabled={applyingCandidate === c.base}
  >
    {applyingCandidate === c.base ? "Aplicando…" : "Aplicar"}
  </Button>
  ```

### 2. `src/components/admin/ClientDiagnosticsPanel.tsx`

O botão "Aplicar" da linha 206 (sugestão automática de DNS para um cliente específico) tem o mesmo problema — verificar e aplicar o mesmo padrão: chamar `allow_server` via `invokeAdminApi` em vez de só mexer em estado local.

### 3. `src/pages/Admin.tsx`

Passar um `onServerApplied` para `EndpointTestPanel` que invalide a lista de servidores permitidos / blocked DNS exibida na aba Stats/Servers, para que o novo DNS apareça imediatamente na tabela sem precisar recarregar a página.

## Não vai mudar

- Backend: `allow_server` já faz tudo que precisa (upsert, audit, sondagem Cloudflare).
- Fluxo de login: como `allowed_servers` já é a fonte de verdade do `iptv-login`, salvar via "Aplicar" automaticamente faz com que os usuários passem a usar o novo DNS.
- Lógica de "Definitive Deletion" implementada na rodada anterior.

## Resultado esperado

Ao clicar **Aplicar** em um candidato (ex.: `http://xc.s-dns.org`):
1. Botão mostra "Aplicando…".
2. Backend faz upsert em `allowed_servers` + audit log.
3. Toast "DNS xc.s-dns.org salvo como servidor autorizado".
4. Lista de servidores no Admin é atualizada.
5. Próximo login dos usuários já considera esse DNS.
