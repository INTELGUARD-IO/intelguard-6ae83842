import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Indicators from "./pages/Indicators";
import Threats from "./pages/Threats";
import FeedTokens from "./pages/FeedTokens";
import System from "./pages/System";
import IngestSources from "./pages/IngestSources";
import Monitoring from "./pages/Monitoring";
import NetworkStatus from "./pages/NetworkStatus";
import Validators from "./pages/Validators";
import TestHome from "./pages/TestHome";
import TestCloudflare from "./pages/TestCloudflare";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/test/home" element={<TestHome />} />
          <Route path="/test/cloudflare" element={<TestCloudflare />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/indicators" element={<Indicators />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/feed-tokens" element={<FeedTokens />} />
            <Route path="/system" element={<System />} />
            <Route path="/ingest-sources" element={<IngestSources />} />
            <Route path="/validators" element={<Validators />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/network-status" element={<NetworkStatus />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
