## Objetivo

Polir a personalização do nome no mobile — vários elementos ficaram grandes/desproporcionais em telas estreitas (390px). Sem mudar lógica, só ajustar tamanhos, espaçamentos e layout responsivo.

---

## Problemas identificados no mobile

1. **Saudação no hero** está com `text-sm` (14px) + peso médio = muito pesada visualmente acima do título já grande.
2. **Modal de boas-vindas** tem ícone gigante (h-12), padding generoso e dois botões empilhados que ocupam quase metade da tela.
3. **Edição de nome em /account**: input + botão "Salvar" + botão "Cancelar" lado a lado em 390px ficam espremidos. Texto "Remover nome personalizado" também é longo.
4. **Avatar do perfil em /account**: círculo `h-16 w-16` + ícone `h-7 w-7` está OK, mas pode ficar mais sutil em mobile.

---

## Ajustes propostos

### Hero (Highlights)
- Saudação: `text-[11px]` em mobile (era `text-sm`), uppercase com tracking sutil, opacity reduzida (`text-muted-foreground/70`). Em desktop continua `text-sm` normal.
- Resultado: vira uma linha discreta tipo "BOA NOITE, JOÃO" — quase um eyebrow, sem competir com o título do filme.

### Modal de boas-vindas
- Ícone do círculo: `h-10 w-10` em mobile (era `h-12`).
- Título: `text-base` em mobile (era `text-xl`).
- Padding interno reduzido (`p-4` em mobile vs `p-6` desktop).
- Hint "Máx. 20 caracteres..." só aparece em desktop (esconde em mobile pra economizar espaço).
- Botões "Pular" + "Salvar" empilhados em mobile mas com altura menor (`h-9`).

### Edição de nome em /account
- Em mobile: layout empilhado (input em cima, botões embaixo lado a lado em 50/50). Em desktop: tudo em linha.
- Input: `text-base` em mobile (era `text-lg`).
- Botões "Salvar" e "Cancelar": ícones apenas em mobile, com label só em desktop. Mais discretos, mais compactos.
- "Remover nome personalizado" → encurtar pra "Remover nome".
- Botão de editar (lápis): manter como está, já é discreto.

### Avatar grande em /account
- Mobile: `h-14 w-14` com ícone `h-6 w-6` (era `h-16 w-16` com `h-7 w-7`). Desktop continua `h-20 w-20`.
- Reduz o "peso" visual do card de perfil em mobile.

---

## Detalhes técnicos

**Arquivos alterados:**
- `src/pages/Highlights.tsx` — só a classe da saudação (1 linha).
- `src/components/WelcomeNameDialog.tsx` — tamanhos do ícone, título, padding, botões.
- `src/pages/Account.tsx` — bloco de edição (input + botões), avatar grande, label do botão remover.

**Não muda:**
- Lógica do localStorage, validação zod, hook useDisplayName.
- Comportamento de salvar/pular/cancelar.
- Header (já estava bem em mobile).
- Saudação dinâmica por horário.

**Erro `removeChild` do React/Radix nos logs:**
Provavelmente causado pelo `key={featured?.id}` do hero re-montando enquanto o Dialog faz portal. Vou estabilizar movendo o `WelcomeNameDialog` pra fora do bloco rotativo (já está no nível raiz do componente, mas vou confirmar a renderização condicional pra evitar mount/unmount no meio da transição).

---

## Performance

Zero impacto. São só ajustes de classes Tailwind responsivas (`text-xs md:text-sm`, `h-10 md:h-12`, etc.). Nenhuma lógica nova, nenhum re-render extra.
