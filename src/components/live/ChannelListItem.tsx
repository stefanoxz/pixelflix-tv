import { memo } from "react";
import { Star, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl, type LiveStream } from "@/services/iptv";
import { EpgNowNext } from "./EpgNowNext";
import { useChannelEpg } from "@/hooks/useEpgNow";
import type { IptvCredentials } from "@/services/iptv";
import { SafeImage } from "@/components/SafeImage";

interface Props {
  channel: LiveStream;
  active: boolean;
  favorite: boolean;
  onSelect: (channel: LiveStream) => void;
  onToggleFavorite: (id: number) => void;
  creds: IptvCredentials;
  /** Carrega EPG só pra itens visíveis (controlado pelo parent). */
  loadEpg: boolean;
}

/**
 * Item da lista de canais com logo, nome, badge de favorito e EPG agora/próximo.
 * Memoizado por props pra evitar re-renders quando o tick atualiza globalmente.
 */
export const ChannelListItem = memo(function ChannelListItem({
  channel,
  active,
  favorite,
  onSelect,
  onToggleFavorite,
  creds,
  loadEpg,
}: Props) {
  const hasEpg = !!channel.epg_channel_id;
  const { data: epg } = useChannelEpg(creds, loadEpg && hasEpg ? channel.stream_id : null, hasEpg);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 p-3 border-b border-border/30 cursor-pointer transition-smooth",
        active
          ? "bg-primary/15 border-l-4 border-l-primary"
          : "border-l-4 border-l-transparent hover:bg-secondary/50",
      )}
      onClick={() => onSelect(channel)}
    >
      <div className="h-10 w-10 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
        {channel.stream_icon ? (
          <SafeImage
            src={proxyImageUrl(channel.stream_icon)}
            alt=""
            loading="lazy"
            decoding="async"
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        ) : (
          <Tv className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              active ? "text-primary" : "text-foreground",
            )}
          >
            {channel.name}
          </p>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
            #{channel.num}
          </span>
        </div>
        <EpgNowNext epg={epg} noEpg={!hasEpg} variant="compact" className="mt-1" />
      </div>

      <button
        type="button"
        aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(channel.stream_id);
        }}
        className={cn(
          "shrink-0 p-1.5 rounded transition-smooth",
          favorite
            ? "text-amber-400 opacity-100"
            : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-amber-400",
        )}
      >
        <Star className={cn("h-4 w-4", favorite && "fill-current")} />
      </button>
    </div>
  );
});
