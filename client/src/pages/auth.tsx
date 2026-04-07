import React, { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, KeyRound, Shield, Loader2, Home, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/supabase-db";
import generatedImage from "@assets/generated_images/minimalist_architectural_abstract_background_in_blue_and_white.png";

const residentSchema = z.object({
  communityCode: z.string().min(1, "Community code is required"),
  buildingNumber: z.string().min(1, "Building number is required"),
  unitNumber: z.string().min(1, "Unit number is required"),
  accessCode: z.string().min(4, "Access code must be at least 4 characters"),
});

const securitySchema = z.object({
  communityCode: z.string().min(1, "Community code is required"),
  password: z.string().min(1, "Password is required"),
});

const adminSchema = z.object({
  communityCode: z.string().min(1, "Community code is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const residentForm = useForm<z.infer<typeof residentSchema>>({
    resolver: zodResolver(residentSchema),
	mode: "onChange",
    defaultValues: { communityCode: "", buildingNumber: "", unitNumber: "", accessCode: "" },
  });

  const securityForm = useForm<z.infer<typeof securitySchema>>({
    resolver: zodResolver(securitySchema),
	mode: "onChange",
    defaultValues: { communityCode: "", password: "" },
  });
  
  const adminForm = useForm<z.infer<typeof adminSchema>>({
  resolver: zodResolver(adminSchema),
  mode: "onChange",
  defaultValues: { communityCode: "", password: "" },
  });

  const onResidentSubmit = async (data: z.infer<typeof residentSchema>) => {
    setIsLoading(true);

    try {
      const result = await api.loginResident(
        data.communityCode,
        data.buildingNumber,
        data.unitNumber,
        data.accessCode
      );

      if (result) {
        localStorage.setItem("userType", "resident");
        localStorage.setItem("communityId", result.community.id);
        localStorage.setItem("communityCode", result.community.code);
        localStorage.setItem("communityName", result.community.name);
        localStorage.setItem("unitId", result.unit.id);
        localStorage.setItem("unitNumber", result.unit.number);
        localStorage.setItem("buildingNumber", result.unit.buildingNumber || "");

        toast({
          title: "Welcome back",
          description: `${result.community.name} • Building ${result.unit.buildingNumber}, Unit ${result.unit.number}`,
        });

        setLocation("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Invalid community code, building, unit, or access code",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSecuritySubmit = async (data: z.infer<typeof securitySchema>) => {
    setIsLoading(true);

    try {
      const result = await api.loginSecurity(data.communityCode, data.password);

      if (result) {
        localStorage.setItem("userType", "security");
        localStorage.setItem("communityId", result.community.id);
        localStorage.setItem("communityCode", result.community.code);
        localStorage.setItem("communityName", result.community.name);

        toast({
          title: "Security Access Granted",
          description: `Welcome to ${result.community.name}`,
        });

        setLocation("/security");
      } else {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Invalid community code or security password",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onAdminSubmit = async (data: z.infer<typeof adminSchema>) => {
	  setIsLoading(true);

	  try {
		const result = await api.loginAdmin(data.communityCode, data.password);

		if (result) {
		  localStorage.setItem("userType", "admin");
		  localStorage.setItem("communityId", result.community.id);
		  localStorage.setItem("communityCode", result.community.code);
		  localStorage.setItem("communityName", result.community.name);

		  toast({
			title: "Admin Access Granted",
			description: `Welcome to ${result.community.name}`,
		  });

		  setLocation("/admin");
		} else {
		  toast({
			variant: "destructive",
			title: "Access Denied",
			description: "Invalid community code or admin password",
		  });
		}
	  } catch (error) {
		toast({
		  variant: "destructive",
		  title: "Error",
		  description: error instanceof Error ? error.message : "Something went wrong",
		});
	  } finally {
		setIsLoading(false);
	  }
	};

  const Branding = () => (
    <div className="flex flex-col">
      <h1 className="text-3xl font-display font-bold tracking-tight uppercase">ParkingPass</h1>
      <span className="text-sm font-medium tracking-[0.2em] text-primary/80 uppercase">Community Visitor Access</span>
    </div>
  );

	const residentValues = residentForm.watch();
	const securityValues = securityForm.watch();
	const adminValues = adminForm.watch();

	const isResidentReady =
	  !!residentValues.communityCode?.trim() &&
	  !!residentValues.buildingNumber?.trim() &&
	  !!residentValues.unitNumber?.trim() &&
	  !!residentValues.accessCode?.trim() &&
	  residentForm.formState.isValid;

	const isSecurityReady =
	  !!securityValues.communityCode?.trim() &&
	  !!securityValues.password?.trim() &&
	  securityForm.formState.isValid;

	const isAdminReady =
	  !!adminValues.communityCode?.trim() &&
	  !!adminValues.password?.trim() &&
	  adminForm.formState.isValid;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-primary/5 text-primary-foreground">
        <div className="absolute inset-0 z-0">
          <img src={generatedImage} alt="Background" className="w-full h-full object-cover opacity-100" />
          <div className="absolute inset-0 bg-primary/80 mix-blend-multiply" />
        </div>

        <div className="relative z-10 text-white">
          <Branding />
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold mb-4 font-display text-white">Secure Visitor Management</h1>
          <p className="text-lg text-blue-100">
            Manage guest parking passes for your community. Residents can create passes and security can verify them in real time.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center justify-center mb-8 text-primary">
            <Branding />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to manage parking passes</p>
          </div>

          <Tabs defaultValue="resident" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="resident">Resident</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
			  <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="resident">
              <Card className="border-none shadow-none">
                <CardContent className="p-0">
                  <Form {...residentForm}>
                    <form onSubmit={residentForm.handleSubmit(onResidentSubmit)} className="space-y-4">
                      <FormField
                        control={residentForm.control}
                        name="communityCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Community Code</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <MapPinned className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="PROMENADE"
                                  className="pl-9 uppercase"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={residentForm.control}
                          name="buildingNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Building #</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input placeholder="1" className="pl-9" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={residentForm.control}
                          name="unitNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit #</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input placeholder="101" className="pl-9" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={residentForm.control}
                        name="accessCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Code</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input type="password" placeholder="••••" className="pl-9" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={isLoading || !isResidentReady}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    <p>Enter your community code, building, unit, and resident access code.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="border-none shadow-none">
                <CardContent className="p-0">
                  <Form {...securityForm}>
                    <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-4">
                      <FormField
                        control={securityForm.control}
                        name="communityCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Community Code</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <MapPinned className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="PROMENADE"
                                  className="pl-9 uppercase"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={securityForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Security Password</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input type="password" placeholder="••••••••" className="pl-9" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={isLoading || !isSecurityReady}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Access Security Panel"}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    <p>For demo: Community code <strong>PROMENADE</strong>, password <strong>admin123</strong></p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
			
			<TabsContent value="admin">
			  <Card className="border-none shadow-none">
				<CardContent className="p-0">
				  <Form {...adminForm}>
					<form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
					  <FormField
						control={adminForm.control}
						name="communityCode"
						render={({ field }) => (
						  <FormItem>
							<FormLabel>Community Code</FormLabel>
							<FormControl>
							  <div className="relative">
								<MapPinned className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input
								  placeholder="PROMENADE"
								  className="pl-9 uppercase"
								  {...field}
								  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
								/>
							  </div>
							</FormControl>
							<FormMessage />
						  </FormItem>
						)}
					  />

					  <FormField
						control={adminForm.control}
						name="password"
						render={({ field }) => (
						  <FormItem>
							<FormLabel>Admin Password</FormLabel>
							<FormControl>
							  <div className="relative">
								<KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input type="password" placeholder="••••••••" className="pl-9" {...field} />
							  </div>
							</FormControl>
							<FormMessage />
						  </FormItem>
						)}
					  />

					  <Button type="submit" className="w-full" disabled={isLoading || !isAdminReady}>
						{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Access Admin Panel"}
					  </Button>
					</form>
				  </Form>

				  <div className="mt-4 text-center text-sm text-muted-foreground">
					<p>Admin access for community configuration and management.</p>
				  </div>
				</CardContent>
			  </Card>
			</TabsContent>
          </Tabs>
        </div>
      </div>
    </div>	
);
}
