## Objetivo

Permitir que cada cliente personalize o **nome de exibição** que aparece no app, com:

1. **Saudação dinâmica** no hero da Home: *"Bom dia/Boa tarde/Boa noite, [nome]"* — sem emoji.
2. **Modal de boas-vindas** no 1º acesso pedindo o nome (com botão "Pular").
3. **Edição posterior** em "Minha Conta".

Sem backend novo, sem afetar performance, funciona em qualquer dispositivo.

---

## Como vai funcionar

### 1. Saudação no hero (Highlights)

Texto pequeno e cinza claro acima do badge "Em destaque", no formato:

```
Boa noite, João
✨ Em destaque · Filme
Prova de Coragem
```

**Faixas de horário** (baseadas no relógio do próprio dispositivo):
- 05:00 às 11:59 → **Bom dia**
- 12:00 às 17:59 → **Boa tarde**
- 18:00 às 04:59 → **Boa noite**

Comportamento:
- Se o cliente cadastrou nome → "Boa noite, João"
- Se pulou o modal e não cadastrou → "Boa noite" (só a saudação, sem vírgula)
- A saudação é calculada no momento da renderização (custo zero, sem requisição)
- Não atualiza no meio da sessão se virar a hora — só ao navegar/recarregar (evita "salto" estranho)

### 2. Modal de boas-vindas (1º acesso)

Aparece **uma única vez**, logo após o login bem-sucedido (na Home), com:

- Título: *"Como podemos te chamar?"*
- Subtítulo: *"Esse nome aparecerá apenas no seu app, em saudações e na sua conta."*
- Input com placeholder *"Seu primeiro nome"* (foco automático)
- Botão primário: **Salvar**
- Botão secundário: **Pular**
- Limite: 20 caracteres, validação com zod (trim, sem HTML), feedback de erro inline

Comportamento:
- Salvar → guarda nome + marca "modal já visto" → fecha
- Pular → marca "modal já visto" → fecha (sem salvar nome). Cliente pode definir depois em Minha Conta.
- Fecha clicando fora ou ESC = mesmo que "Pular"
- Nunca mais aparece automaticamente nesse dispositivo (a menos que limpe dados)

### 3. Edição em Minha Conta

Na seção do avatar/cabeçalho da página `/account`:

- Mostra o nome de exibição abaixo (ou ao lado) do username técnico
- Botão discreto **"Editar nome"** (ícone de lápis)
- Ao clicar, abre o mesmo input inline (ou pequeno dialog)
- Permite definir, alterar ou **remover** o nome (botão "Limpar")
- Toast de sucesso ao salvar

### 4. Onde mais o nome aparece

- **Tooltip do avatar no header**: ao passar o mouse mostra "Olá, João" (ou só o username se não tiver nome).
- **Dropdown do avatar**: o nome de exibição vira o título principal, e o username vai pra subtítulo em cinza pequeno.
- **Tela de Conta**: nome em destaque no card do perfil, username embaixo discretamente.

---

## Detalhes técnicos

### Armazenamento

`localStorage` por dispositivo, chave isolada por username IPTV:
```
display_name:<username>     → "João"
display_name_seen:<username> → "1"   (flag do modal)
```

**Por quê localStorage e não banco:**
- Zero latência (sem requisição), sem custo de backend
- Cada dispositivo tem seu próprio apelido — desejável: no celular do filho pode ser "Pedro", no da esposa "Ana", mesmo login IPTV
- Sem migração, sem RLS, sem edge function
- Privado por dispositivo (ninguém vê o nome de ninguém)

### Arquivos a criar

- **`src/lib/displayName.ts`** — utilitário com `getDisplayName(username)`, `setDisplayName(username, name)`, `clearDisplayName(username)`, `hasSeenWelcomeModal(username)`, `markWelcomeModalSeen(username)`, `getGreeting()` (retorna "Bom dia"/"Boa tarde"/"Boa noite"), `useDisplayName(username)` (hook React).
- **`src/components/WelcomeNameDialog.tsx`** — modal usando `Dialog` do shadcn já existente, com input + zod validation + 2 botões.

### Arquivos a alterar

- **`src/pages/Highlights.tsx`** — adicionar `<p>` com saudação acima do bloco do badge "Em destaque" + montar `WelcomeNameDialog` com `open` controlado por `!hasSeenWelcomeModal(username)`.
- **`src/pages/Account.tsx`** — substituir o bloco do `<h2>{u.username}</h2>` por: nome de exibição (h2, grande) + username embaixo (texto pequeno cinza) + botão "Editar nome".
- **`src/components/Header.tsx`** — adicionar `title` no botão do avatar (tooltip nativo "Olá, João") + atualizar o `DropdownMenuLabel` pra mostrar nome de exibição como principal.

### Validação (zod)

```ts
const nameSchema = z.string()
  .trim()
  .min(1, "Digite um nome")
  .max(20, "Máximo 20 caracteres")
  .regex(/^[\p{L}\p{N}\s'.-]+$/u, "Use apenas letras, números e espaços");
```

Bloqueia HTML, scripts e caracteres especiais perigosos.

### Performance

- Saudação: 1 chamada `Date.getHours()` no render — nanossegundos
- localStorage: lido 1x no mount, armazenado em estado React
- Modal: lazy-rendered (só monta se `!hasSeen`)
- Zero requisição de rede, zero impacto em LCP/FCP

### Acessibilidade

- Modal com foco automático no input
- Botão "Pular" navegável por Tab
- ESC fecha (Radix Dialog cuida disso)
- Saudação tem aria-live="polite" pro leitor de tela anunciar uma vez

---

## O que NÃO muda

- Login, autenticação, fluxo IPTV
- Dados no Supabase (nada vai pro banco)
- Layout geral, cores, tipografia
- Avatar continua com o ícone de pessoa que acabamos de implementar
- Nada some — só adiciona personalização opcional
