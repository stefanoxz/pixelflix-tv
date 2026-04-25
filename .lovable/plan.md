# Plano executado — Otimização de performance Filmes/Séries

- gcTime 24h global + persistência via PersistQueryClientProvider (apenas catálogo)
- staleTime 30min nos useQuery de vod-cats/vod-streams/series-cats/series
- Skeleton (18 cards) no PosterGrid quando isLoading && vazio
- Prefetch silencioso do catálogo no boot via IptvContext
- iptv-categories: 3 UAs, 1 attempt cada (retries reduzidos)
