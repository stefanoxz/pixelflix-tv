import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Monitor } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Modal centralizado que convida o usuário a instalar o SuperTech como app.
 *
 * Comportamento:
 *  - Aparece automaticamente após ~3s no primeiro acesso, **somente** se:
 *      • o app NÃO está rodando como instalado (standalone)
 *      • o usuário ainda não recusou definitivamente
 *      • E o navegador disparou `beforeinstallprompt` (Chrome/Edge/etc.)
 *        OU estamos em iOS (onde mostramos instruções manuais)
 *  - "Agora não" → esconde para sempre via localStorage.
 *  - "Instalar" → chama o prompt nativo do navegador (ou só fecha em iOS,
 *    com as instruções já visíveis na tela).
 */
export function InstallAppDialog() {
  const { canPrompt, isIos, installed, dismissed, promptInstall, dismissForever } =
    usePwaInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (installed || dismissed) return;
    // Em iOS, não há evento `beforeinstallprompt` — mostramos instruções
    // manuais. Em desktops/Android, esperamos o evento chegar.
    if (!canPrompt && !isIos) return;
    const t = window.setTimeout(() => setOpen(true), 3000);
    return () => window.clearTimeout(t);
  }, [canPrompt, isIos, installed, dismissed]);

  const handleInstall = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      // Se o usuário aceitou, o evento `appinstalled` fechará o estado.
      // Se rejeitou no prompt nativo, respeitamos e escondemos para sempre.
      if (outcome === "dismissed") dismissForever();
    }
    setOpen(false);
  };

  const handleDecline = () => {
    dismissForever();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDecline()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Instalar SuperTech como aplicativo
          </DialogTitle>
          <DialogDescription className="text-center">
            Tenha o SuperTech sempre à mão: ícone na sua tela, abre em janela
            própria sem barra do navegador e atualiza automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isIos && !canPrompt ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como instalar no iPhone/iPad:</p>
            <ol className="space-y-2">
              <li className="flex gap-2">
                <span className="font-semibold text-primary">1.</span>
                <span className="flex items-center gap-1">
                  Toque em <Share className="inline h-4 w-4" /> (Compartilhar) na
                  barra do Safari
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary">2.</span>
                <span className="flex items-center gap-1">
                  Escolha <Plus className="inline h-4 w-4" /> &quot;Adicionar à
                  Tela de Início&quot;
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-primary">3.</span>
                <span>Confirme em &quot;Adicionar&quot;</span>
              </li>
            </ol>
          </div>
        ) : (
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Acesso rápido pelo menu iniciar / área de trabalho</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Janela dedicada, sem distrações do navegador</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>Atualizações automáticas, sem reinstalar</span>
            </li>
          </ul>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" onClick={handleDecline} className="sm:flex-1">
            Agora não
          </Button>
          {!isIos || canPrompt ? (
            <Button onClick={handleInstall} className="sm:flex-1">
              <Download className="mr-2 h-4 w-4" />
              Instalar app
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)} className="sm:flex-1">
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
