import { memo } from "react";
import { Star, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { proxyImageUrl, type LiveStream, type IptvCredentials } from "@/services/iptv";
import { Button } from "@/components/ui/button";
import { useChannelEpg } from "@/hooks/useEpgNow";
import { EpgNowNext } from "./EpgNowNext";
import { EpgTimeline } from "./EpgTimeline";

interface Props {
  channel: LiveStream | null;
  creds: IptvCredentials;
  favorite: boolean;
  onToggleFavorite: () => void;
  className?: string;
}

/**
 * Painel abaixo do player com logo, nome, "agora/próximo" + timeline EPG.
 * Compacto no mobile, expandido no desktop.
 */
export const PlayerInfoBar = memo(function PlayerInfoBar({
  channel,
  creds,
  favorite,
  onToggleFavorite,
  className,
}: Props) {
  const hasEpg = !!channel?.epg_channel_id;
  const { data: epg } = useChannelEpg(creds, channel?.stream_id ?? null, hasEpg);

  if (!channel) return null;

  return (
    <div
      className={cn(
        "rounded-lg bg-card border border-border/50 p-4 space-y-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded bg-secondary overflow-hidden flex items-center justify-center">
          {channel.stream_icon ? (
            <img
              src={proxyImageUrl(channel.stream_icon)}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          ) : (
            <Tv className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold truncate">{channel.name}</h2>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              #{channel.num}
            </span>
          </div>
          <EpgNowNext epg={epg} noEpg={!hasEpg} variant="full" className="mt-2" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          className={cn("shrink-0", favorite && "text-amber-400")}
        >
          <Star className={cn("h-5 w-5", favorite && "fill-current")} />
        </Button>
      </div>

      {hasEpg && epg && epg.length > 1 && (
        <EpgTimeline epg={epg} className="hidden sm:block" />
      )}
    </div>
  );
});
