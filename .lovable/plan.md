# Pop-up de instalação do app no primeiro acesso

## O que o cliente vai ver

Cerca de **3 segundos depois de abrir** pixelflix-tv.lovable.app pela primeira vez, aparece um modal centralizado bonito com:

- Ícone de monitor + título "Instalar SuperTech como aplicativo"
- Descrição curta dos benefícios (ícone na tela, janela própria, atualização automática)
- Dois botões: **"Agora não"** (cinza) e **"Instalar app"** (azul, com ícone de download)

Ao clicar **Instalar app** → dispara o prompt nativo do navegador ("Instalar SuperTech?") → cliente confirma → app aparece no menu iniciar/área de trabalho instantaneamente.

Ao clicar **Agora não** → modal fecha e **nunca mais aparece** (sua escolha).

## Casos especiais tratados

- **iPhone/iPad (Safari):** o iOS não tem botão de instalação automática. Em vez de pedir clique, o modal mostra um passo a passo visual: "Toque em Compartilhar → Adicionar à Tela de Início → Adicionar". Botão "Entendi" fecha.
- **App já instalado:** o modal nunca aparece (detecta `display-mode: standalone`).
- **Navegador incompatível** (Firefox desktop, etc.): nada aparece — não tem como instalar, então não polui a tela.
- **Cliente já recusou antes:** localStorage lembra; nunca mais aparece (mesmo limpando cache do site, só some se ele limpar dados completos do navegador).
- **Cliente aceitou no prompt nativo:** evento `appinstalled` marca como instalado.

## Arquivos

### 1. `src/hooks/usePwaInstall.ts` (novo)
Hook que encapsula toda a lógica:
- Captura o evento `beforeinstallprompt` (Chrome/Edge/Brave/Opera/Samsung Internet)
- Detecta iOS via user agent
- Detecta se já está rodando standalone
- Persiste recusa em `localStorage` com chave `supertech-pwa-install-dismissed`
- Expõe: `canPrompt`, `isIos`, `installed`, `dismissed`, `promptInstall()`, `dismissForever()`

### 2. `src/components/InstallAppDialog.tsx` (novo)
Modal usando o `Dialog` do shadcn (já no projeto). Auto-abre após 3s se as condições forem atendidas. Conteúdo varia entre desktop/Android (lista de benefícios + botão Instalar) e iOS (passo a passo visual).

### 3. `src/App.tsx` — adicionar uma linha
Inserir `<InstallAppDialog />` dentro do `<TooltipProvider>` para ficar disponível em todas as rotas (público + privado), antes do `<BrowserRouter>`.

## Detalhe técnico importante

O método `prompt()` do `BeforeInstallPromptEvent` **só pode ser chamado em resposta a um clique do usuário** (política do Chrome). Por isso o modal mostra o botão "Instalar app" — quando ele clica, aí chamamos `deferredPrompt.prompt()`. Não dá pra abrir o prompt nativo direto sem interação.

## Onde testar

Igual ao PWA básico: **só funciona na URL publicada** (`pixelflix-tv.lovable.app`), não no preview do Lovable. Para testar você publica e abre num Chrome/Edge anônimo. Lembre-se: se você já instalou ou já recusou antes, vai precisar limpar `localStorage.removeItem("supertech-pwa-install-dismissed")` no console pra ver de novo.

## Fora do escopo

- Botão de instalação fixo no header (fica só o auto-popup; se quiser adicionar depois, basta usar o mesmo hook em qualquer componente)
- Notificações push
- Re-aparecer após N dias (você pediu "esconder pra sempre")
