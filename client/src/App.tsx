import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Router as WouterRouter, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Import Google Fonts
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.href =
    "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

import Campeonatos from "./pages/Campeonatos";
import Ranking from "./pages/Ranking";
import Perfil from "./pages/Perfil";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import Cadastro from "./pages/Cadastro";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/campeonatos"} component={Campeonatos} />
      <Route path={"/ranking"} component={Ranking} />
      <Route path={"/perfil"} component={Perfil} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/login"} component={Login} />
      <Route path={"/cadastro"} component={Cadastro} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          {/* HashRouter resolve for GitHub Pages (evita 404 no refresh) */}
          <WouterRouter hook={useHashLocation}>
            <Router />
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
