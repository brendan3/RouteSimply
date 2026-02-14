import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Search, MapPin, Calendar, Clock, Package, CheckCircle, Truck } from "lucide-react";
import { format } from "date-fns";
import logoUrl from "@assets/Untitled_design_(2)_1768856385164.png";

interface CustomerRoute {
  date: string;
  dayOfWeek: string | null;
  driverName: string | null;
  estimatedTime: number | null;
  stopSequence: number;
  status: string;
}

interface CustomerPortalData {
  customer: {
    name: string;
    address: string;
    serviceType: string | null;
  };
  upcomingRoutes: CustomerRoute[];
  nextDelivery: CustomerRoute | null;
}

export default function CustomerPortalPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data, isLoading, error } = useQuery<CustomerPortalData>({
    queryKey: ["/api/customer/lookup", submittedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/customer/lookup?q=${encodeURIComponent(submittedQuery)}`);
      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.message || "Customer not found");
      }
      return res.json();
    },
    enabled: !!submittedQuery,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logoUrl} alt="RouteSimply" className="h-8" />
          <span className="text-sm text-muted-foreground">Customer Portal</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Track Your Delivery</h1>
          <p className="text-muted-foreground">
            Enter your name or address to check your delivery schedule
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or address..."
              className="pl-10 h-12"
            />
          </div>
          <Button type="submit" className="h-12 px-6">
            Search
          </Button>
        </form>

        {/* Results */}
        {isLoading && (
          <LoadingSpinner className="py-16" text="Looking up your delivery info..." />
        )}

        {error && submittedQuery && (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-medium text-lg mb-1">No results found</h3>
            <p className="text-muted-foreground text-sm">
              We couldn't find any delivery information matching "{submittedQuery}". 
              Please check the spelling or contact your service provider.
            </p>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            {/* Customer info */}
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{data.customer.name}</h2>
                  <p className="text-sm text-muted-foreground">{data.customer.address}</p>
                  {data.customer.serviceType && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {data.customer.serviceType}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Next delivery */}
            {data.nextDelivery && (
              <Card className="p-6 border-primary/20 bg-primary/5">
                <h3 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Next Delivery
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {data.nextDelivery.dayOfWeek && (
                        <span className="capitalize">{data.nextDelivery.dayOfWeek}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {data.nextDelivery.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Stop #{data.nextDelivery.stopSequence}
                    </p>
                    {data.nextDelivery.driverName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Driver: {data.nextDelivery.driverName}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Upcoming schedule */}
            {data.upcomingRoutes.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Upcoming Schedule
                </h3>
                <div className="space-y-2">
                  {data.upcomingRoutes.map((route, i) => (
                    <Card key={i} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {route.stopSequence}
                        </div>
                        <div>
                          <p className="font-medium text-sm capitalize">
                            {route.dayOfWeek || route.date}
                          </p>
                          {route.driverName && (
                            <p className="text-xs text-muted-foreground">
                              {route.driverName}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant={route.status === "published" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {route.status === "published" ? "Confirmed" : "Scheduled"}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {data.upcomingRoutes.length === 0 && !data.nextDelivery && (
              <Card className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No upcoming deliveries scheduled.</p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-6 text-center text-sm text-muted-foreground">
        <p>Powered by RouteSimply</p>
      </footer>
    </div>
  );
}
