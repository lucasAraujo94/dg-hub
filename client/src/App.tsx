import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Router as WouterRouter, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { AppBootGate } from "./components/AppBootGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const NotFound = lazy(() => import("@/pages/NotFound"));
const Home = lazy(() => import("@/pages/Home"));
const Campeonatos = lazy(() => import("@/pages/Campeonatos"));
const Ranking = lazy(() => import("@/pages/Ranking"));
const Perfil = lazy(() => import("@/pages/Perfil"));
const Chat = lazy(() => import("@/pages/Chat"));
const Admin = lazy(() => import("@/pages/Admin"));
const Cadastro = lazy(() => import("@/pages/Cadastro"));
const Login = lazy(() => import("@/pages/Login"));
const Aniversariantes = lazy(() => import("@/pages/Aniversariantes"));
const PerfilPublico = lazy(() => import("@/pages/PerfilPublico"));
const TemplateBatchComposer = lazy(() => import("@/pages/TemplateBatchComposer"));

if (typeof document !== "undefined") {
  const existingLink = document.querySelector('link[data-dg-fonts="true"]');
  if (!existingLink) {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap";
    link.rel = "stylesheet";
    link.dataset.dgFonts = "true";
    document.head.appendChild(link);
  }
}

function RouteFallback() {
  return (
    <div className="safe-shell min-h-screen px-4 py-8">
      <div className="container">
        <Card className="glass-panel mx-auto max-w-xl p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            <div>
              <p className="text-sm font-medium text-white">Carregando tela</p>
              <p className="mt-1 text-sm text-white/65">
                Preparando a proxima etapa da aplicacao.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/campeonatos"} component={Campeonatos} />
        <Route path={"/ranking"} component={Ranking} />
        <Route path={"/perfil"} component={Perfil} />
        <Route path={"/chat"} component={Chat} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/login"} component={Login} />
        <Route path={"/cadastro"} component={Cadastro} />
        <Route path={"/perfil/:id"} component={PerfilPublico} />
        <Route path={"/aniversariantes"} component={Aniversariantes} />
        <Route path={"/compositor-lote"} component={TemplateBatchComposer} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <AppBootGate>
            <Toaster />
            <WouterRouter hook={useHashLocation}>
              <Router />
            </WouterRouter>
          </AppBootGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
