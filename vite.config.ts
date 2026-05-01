import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'assets/*.png'],
      manifest: {
        name: 'Vibe Premium WebPlayer',
        short_name: 'Vibe',
        description: 'Assista canais ao vivo, filmes e séries',
        theme_color: '#000000',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query"],
  },
  // Sem `manualChunks`: o agrupamento manual anterior quebrava a ordem de
  // inicialização dos chunks ESM em produção (React aparecia como undefined
  // dentro de libs que faziam `React.createContext(...)` no topo do módulo,
  // resultando em tela preta no domínio publicado). Deixar o Vite/Rollup
  // gerar o split automaticamente garante que o React seja avaliado antes
  // de qualquer dependência que o consuma. As páginas continuam em chunks
  // separados via `import()` dinâmico no código.
}));
