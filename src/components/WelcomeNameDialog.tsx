import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import {
  displayNameSchema,
  setDisplayName,
  markWelcomeModalSeen,
} from "@/lib/displayName";

interface Props {
  username: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de boas-vindas no 1º acesso. Pede um nome amigável (opcional) pra
 * personalizar a saudação. Marca como "visto" tanto no Salvar quanto no Pular,
 * pra nunca mais aparecer automaticamente nesse dispositivo.
 *
 * Design responsivo: compacto em mobile (390px), respiro maior em desktop.
 */
export function WelcomeNameDialog({ username, open, onClose }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Foco automático no input quando abrir
  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      // pequeno delay pro Radix terminar a animação
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSkip = () => {
    markWelcomeModalSeen(username);
    onClose();
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const result = displayNameSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    setDisplayName(username, result.data);
    markWelcomeModalSeen(username);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Fechar por ESC/click-fora = mesmo comportamento de "Pular"
        if (!next) handleSkip();
      }}
    >
      <DialogContent className="sm:max-w-[420px] p-6 sm:p-8 gap-5 glass-card border-white/10 shadow-2xl">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-center mb-1">
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow ring-2 ring-primary/30">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-base sm:text-xl">
            Como podemos te chamar?
          </DialogTitle>
          <DialogDescription className="text-center text-xs sm:text-sm leading-snug">
            Esse nome aparecerá apenas no seu app, em saudações e na sua conta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Seu primeiro nome"
            maxLength={20}
            autoComplete="given-name"
            aria-invalid={!!error}
            aria-describedby={error ? "name-error" : undefined}
            className="h-10"
          />
          {error && (
            <p id="name-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <p className="hidden sm:block text-[11px] text-muted-foreground text-center">
            Máx. 20 caracteres · pode editar depois em Minha Conta
          </p>

          <DialogFooter className="flex-row gap-2 pt-1 sm:pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="flex-1 sm:flex-initial h-9"
            >
              Pular
            </Button>
            <Button
              type="submit"
              className="flex-1 sm:flex-initial h-9 bg-gradient-primary shadow-glow"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
