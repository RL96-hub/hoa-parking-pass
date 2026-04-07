import React from "react";
import { useLocation } from "wouter";
import { LogOut, Home, Car, Settings, ShieldCheck, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
  userType: "resident" | "security" | "admin" | "public";
  userName?: string;
  onLogout?: () => void;
}

export function Layout({ children, userType, userName, onLogout }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    if (onLogout) onLogout();
    toast({ title: "Logged out", description: "See you next time!" });
    setLocation("/");
  };

  const Branding = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col ${className}`}>
      <h1 className="text-xl font-display font-bold tracking-tight uppercase text-primary">Promenade Shores</h1>
      <span className="text-[0.65rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">At Doral</span>
    </div>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="py-4 mb-4">
        <Branding />
        {userName && <p className="text-sm text-muted-foreground mt-2">Unit: {userName}</p>}
      </div>

      <nav className="space-y-2 flex-1">
        {userType === "resident" && (
          <>
            <Button 
              variant={location === "/dashboard" ? "secondary" : "ghost"} 
              className="w-full justify-start gap-2"
              onClick={() => setLocation("/dashboard")}
            >
              <Home className="w-4 h-4" /> Dashboard
            </Button>
            <Button 
              variant={location === "/vehicles" ? "secondary" : "ghost"} 
              className="w-full justify-start gap-2"
              onClick={() => setLocation("/vehicles")}
            >
              <Car className="w-4 h-4" /> My Vehicles
            </Button>
          </>
        )}

		{userType === "security" && (
		  <>
			<Button 
			  variant={location === "/security" ? "secondary" : "ghost"} 
			  className="w-full justify-start gap-2"
			  onClick={() => setLocation("/security")}
			>
			  <ShieldCheck className="w-4 h-4" /> Overview
			</Button>
		  </>
		)}

        {userType === "admin" && (
          <>
            <Button 
              variant={location === "/admin" ? "secondary" : "ghost"} 
              className="w-full justify-start gap-2"
              onClick={() => setLocation("/admin")}
            >
              <ShieldCheck className="w-4 h-4" /> Overview
            </Button>
            <Button 
              variant={location === "/admin/units" ? "secondary" : "ghost"} 
              className="w-full justify-start gap-2"
              onClick={() => setLocation("/admin/units")}
            >
              <Home className="w-4 h-4" /> Units
            </Button>
          </>
        )}
      </nav>

      {userType !== "public" && (
        <div className="pt-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> Log Out
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden border-b bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Branding />
        {userType !== "public" && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80%] sm:w-[300px]">
              <NavContent />
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Desktop Sidebar */}
      {userType !== "public" && (
        <div className="hidden md:block w-64 border-r bg-card p-6 h-screen sticky top-0">
          <NavContent />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
