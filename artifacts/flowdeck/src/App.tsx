import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { FloatingTaskProvider } from "@/lib/floating-task-context";
import { UnsavedGuardProvider } from "@/lib/unsaved-guard";
import { FloatingTask } from "@/components/floating-task";
import { Shell } from "@/components/shell";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Recuperar from "@/pages/recuperar";
import Profile from "@/pages/profile";
import Dashboard from "@/pages/dashboard";
import AdminDashboard from "@/pages/admin";
import Project from "@/pages/project";
import Mindmaps from "@/pages/mindmaps";
import MindmapEditor from "@/pages/mindmap-editor";
import Notes from "@/pages/notes";
import NoteEditor from "@/pages/note-editor";
import Subscriptions from "@/pages/subscriptions";
import PaymentMethods from "@/pages/payment-methods";
import SubscriptionCategories from "@/pages/subscription-categories";
import Graph from "@/pages/graph";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false, wide = false, allowBoth = false }: { component: any, adminOnly?: boolean, wide?: boolean, allowBoth?: boolean }) {
  const { data: user, isLoading } = useGetCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading || !user) return;
    if (allowBoth) return;
    if (adminOnly && user.role !== "admin") {
      setLocation("/");
    } else if (!adminOnly && user.role === "admin") {
      setLocation("/admin");
    }
  }, [user, isLoading, adminOnly, allowBoth, setLocation]);

  return (
    <Shell wide={wide}>
      <Component />
    </Shell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/recuperar" component={Recuperar} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} allowBoth />
      </Route>
      <Route path="/projects/:projectId">
        <ProtectedRoute component={Project} wide />
      </Route>
      <Route path="/mindmaps">
        <ProtectedRoute component={Mindmaps} />
      </Route>
      <Route path="/mindmaps/:mindmapId">
        <ProtectedRoute component={MindmapEditor} />
      </Route>
      <Route path="/notes">
        <ProtectedRoute component={Notes} />
      </Route>
      <Route path="/notes/:noteId">
        <ProtectedRoute component={NoteEditor} />
      </Route>
      <Route path="/subscriptions">
        <ProtectedRoute component={Subscriptions} />
      </Route>
      <Route path="/subscriptions/payment-methods">
        <ProtectedRoute component={PaymentMethods} />
      </Route>
      <Route path="/subscriptions/categories">
        <ProtectedRoute component={SubscriptionCategories} />
      </Route>
      <Route path="/graph">
        <ProtectedRoute component={Graph} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <WorkspaceProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <UnsavedGuardProvider>
                <FloatingTaskProvider>
                  <Router />
                  <FloatingTask />
                </FloatingTaskProvider>
              </UnsavedGuardProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </WorkspaceProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
