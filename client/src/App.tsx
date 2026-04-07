import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import ResidentDashboard from "@/pages/resident-dashboard";
import ResidentVehicles from "@/pages/resident-vehicles";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminUnits from "@/pages/admin-units";
import SecurityDashboardPage from "@/pages/security-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/dashboard" component={ResidentDashboard} />
      <Route path="/vehicles" component={ResidentVehicles} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/units" component={AdminUnits} />
	  <Route path="/security" component={SecurityDashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
