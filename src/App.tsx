import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MessagesProvider } from "@/contexts/MessagesContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import MessageDetail from "./pages/MessageDetail";
import CreateMessage from "./pages/CreateMessage";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import AdminPanel from "./pages/AdminPanel";
import DirectorPanel from "./pages/DirectorPanel";
import Drafts from "./pages/Drafts";
import Archived from "./pages/Archived";
import NotFound from "./pages/NotFound";
import RegistrationStatus from "./pages/RegistrationStatus";

import { ThemeProvider } from "@/components/theme-provider";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 1000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null; // Изчаква се проверката на сесията
  if (!user) return <Navigate to="/login" replace />;
  if (user.registrationStatus !== 'approved') return <RegistrationStatus />;
  return <Layout>{children}</Layout>;
};

const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <ScrollToTop />
              <NotificationsProvider>
                <MessagesProvider>
                  <AuditLogProvider>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/messages/:id" element={<ProtectedRoute><MessageDetail /></ProtectedRoute>} />
                    <Route path="/create" element={<ProtectedRoute><CreateMessage /></ProtectedRoute>} />
                    <Route path="/edit/:id" element={<ProtectedRoute><CreateMessage /></ProtectedRoute>} />
                    <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
                    <Route path="/archived" element={<ProtectedRoute><Archived /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                    <Route path="/director" element={<ProtectedRoute><DirectorPanel /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AuditLogProvider>
              </MessagesProvider>
            </NotificationsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
