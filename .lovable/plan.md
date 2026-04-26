
# Validação no formulário de login IPTV

Adicionar validação client-side robusta nos dois fluxos de login (usuário/senha e URL M3U) **antes** de chamar a edge function, com mensagens de erro inline (em vez de só `toast`), uso de `zod` (já instalado no projeto) e indicadores visuais nos campos.

---

## Implementação

### 1. Schemas zod (em `src/pages/Login.tsx`)

```ts
const credsSchema = z.object({
  username: z.string()
    .trim()
    .min(1, "Informe o usuário")
    .max(120, "Usuário muito longo (máx. 120)")
    .regex(/^[^\s]+$/, "Usuário não pode conter espaços"),
  password: z.string()
    .min(1, "Informe a senha")
    .max(200, "Senha muito longa (máx. 200)"),
});

const m3uSchema = z.string()
  .trim()
  .min(1, "Cole a URL M3U")
  .max(2000, "URL muito longa (máx. 2000 caracteres)")
  .refine(
    (v) => /^https?:\/\//i.test(v) || /[a-z0-9.-]+\.[a-z]{2,}/i.test(v),
    "URL precisa conter um endereço (ex.: http://servidor.com/...)"
  );
```

### 2. Estado de erros por campo

Substituir os `toast.error("Preencha…")` ad-hoc por um state `errors: { username?, password?, m3u? }` e renderizar a mensagem **abaixo do campo** com ícone `AlertCircle` (acessível via `aria-invalid` e `aria-describedby`).

### 3. Fluxo de validação

**Aba Usuário/senha** (`handleSubmitCreds`):
- `e.preventDefault()`
- Roda `credsSchema.safeParse({ username, password })`
- Se falhar: popula `errors`, foca primeiro campo inválido, **não** chama `iptvLogin`
- Se passar: limpa `errors` e segue o fluxo atual

**Aba M3U** (`handleSubmitM3u`):
- `e.preventDefault()`
- Roda `m3uSchema.safeParse(m3uUrl)` — valida formato/comprimento básico
- Se passar mas `parseM3uUrl()` retornar `null`: erro inline mais específico ("Não foi possível extrair usuário/senha — verifique o formato `get.php` ou `/playlist/usuario/senha`")
- Se tudo OK: limpa `errors` e segue o fluxo atual

### 4. UX dos campos

- **Limpar erro ao digitar**: `onChange` reseta `errors[campo]` para esconder a mensagem assim que o usuário começa a corrigir.
- **`aria-invalid={!!errors.x}`** + **`aria-describedby="x-error"`** nos `<Input>`/`<Textarea>`.
- Borda vermelha quando inválido: classe condicional `errors.x && "border-destructive focus-visible:ring-destructive"`.
- Mensagem de erro: `<p id="x-error" className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3"/>{errors.x}</p>`

### 5. Validação preventiva no submit do formulário HTML

- Adicionar `noValidate` no `<form>` (queremos só nossa validação, não a nativa do browser que conflita visualmente).
- Manter `disabled={loading}` no botão para evitar duplo-submit.

### 6. Não tocar no fluxo de sucesso

A validação **só intercepta antes** do `performLogin`/`iptvLoginM3u`. O resto (anonymous sign-in, `setSession`, navegação para `/sync`, `maybeWarnConnectionLimit`) continua igual.

---

## Arquivo afetado

- `src/pages/Login.tsx` — único arquivo editado.

## Não muda

- `src/services/iptv.ts` (edge call) — a edge já tem suas próprias validações server-side.
- `src/lib/parseM3uUrl.ts` — continua sendo a fonte da verdade pro parsing detalhado.
- Schemas de banco / RLS.

---

## Por que dessa forma

- **Zod** garante regras declarativas e mensagens consistentes (já é o padrão do projeto via `react-hook-form`/`@hookform/resolvers`).
- **Erros inline** dão feedback imediato no contexto do campo, em vez de toasts que somem rápido — padrão de apps modernos de login.
- **Limites de tamanho** previnem payloads gigantes / abuso (defense-in-depth, mesmo com `maxLength` já no input).
- **Trim no username** evita bugs comuns (espaço acidental colado do clipboard).
- **Validação client-side não substitui a server-side** — a edge function `iptv-login` continua autoritativa.
