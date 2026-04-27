import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IptvProvider } from "@/context/IptvContext";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import Login from "./pages/Login";

// Lazy boot: tudo que não é necessário para pintar o /login fica fora do
// bundle inicial. Isso ataca o "tela travada no logo" depois de publicar
// (sem cache de bundle no navegador).
const Sonner = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })),
);
const InstallAppDialog = lazy(() =>
  import("@/components/InstallAppDialog").then((m) => ({
    default: m.InstallAppDialog,
  })),
);

// Sync agora é lazy. Para evitar o flash do Suspense na transição
// login→sync, o Login dispara `preloadSync()` em paralelo com a chamada
// da edge de login.
const syncLoader = () => import("./pages/Sync");
const Sync = lazy(syncLoader);
export const preloadSync = syncLoader;

// Lazy-load non-landing routes to reduce initial bundle size.
// Each route exposes a `preload*` helper so the Sync screen can prefetch
// the JS chunks in parallel with the data fetches — eliminating the
// Suspense fallback flash on the first navigation after sync.
const indexLoader = () => import("./pages/Index.tsx");
const liveLoader = () => import("./pages/Live");
const moviesLoader = () => import("./pages/Movies");
const seriesLoader = () => import("./pages/Series");
const accountLoader = () => import("./pages/Account");

const Index = lazy(indexLoader);
const Live = lazy(liveLoader);
const Movies = lazy(moviesLoader);
const SeriesPage = lazy(seriesLoader);
const Account = lazy(accountLoader);
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminResetPassword = lazy(() => import("./pages/AdminResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

export const preloadIndex = indexLoader;
export const preloadLive = liveLoader;
export const preloadMovies = moviesLoader;
export const preloadSeries = seriesLoader;
export const preloadAccount = accountLoader;

const RouteFallback = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const WithChrome = ({ children }: { children: React.ReactNode }) => (
  <>
    <Header />
    <main className="pb-bottom-nav">{children}</main>
    <BottomNav />
  </>
);

const App = () => (
  <IptvProvider>
    <TooltipProvider>
      {/* Toasters/InstallDialog ficam atrás de Suspense fallback={null}
          para não bloquearem o primeiro paint do /login. */}
      <Suspense fallback={null}>
        <Toaster />
        <Sonner position="top-right" theme="dark" />
        <InstallAppDialog />
      </Suspense>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/reset-password" element={<AdminResetPassword />} />
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <Admin />
                </AdminProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <WithChrome><Index /></WithChrome>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sync"
              element={
                <ProtectedRoute>
                  <Sync />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live"
              element={
                <ProtectedRoute>
                  <WithChrome><Live /></WithChrome>
                </ProtectedRoute>
              }
            />
            <Route
              path="/movies"
              element={
                <ProtectedRoute>
                  <WithChrome><Movies /></WithChrome>
                </ProtectedRoute>
              }
            />
            <Route
              path="/series"
              element={
                <ProtectedRoute>
                  <WithChrome><SeriesPage /></WithChrome>
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <WithChrome><Account /></WithChrome>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </IptvProvider>
);

export default App;
