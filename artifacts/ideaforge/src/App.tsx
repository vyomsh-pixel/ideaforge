import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import { AuthGate, LegalDocumentView } from '@/components/AuthGate';
import { Home } from '@/pages/Home';
import { History } from '@/pages/History';
import { Result } from '@/pages/Result';

const queryClient = new QueryClient();

function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LegalDocumentView type="privacy" />
    </div>
  );
}

function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LegalDocumentView type="terms" />
    </div>
  );
}

function Router() {
  return (
    <AuthGate>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/history" component={History} />
          <Route path="/generations/:id" component={Result} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;