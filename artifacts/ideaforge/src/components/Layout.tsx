import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Sparkles, Clock, Download, Trash2, LogOut, ShieldAlert, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthGate';
import { toast } from '@/hooks/use-toast';

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, signOut, deleteAccount, exportAccountData } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportAccountData();
      toast({
        title: 'Data Export Complete',
        description: 'Your account profile and generated deliverables JSON archive has been downloaded.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not export account data. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast({
        title: 'Account Deleted',
        description: 'Your account and associated session data have been removed.',
      });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-primary"
            >
              <Sparkles className="w-6 h-6 text-primary fill-primary/20" />
              IdeaForge
            </Link>
            <nav className="flex items-center gap-5 text-sm font-bold uppercase tracking-wider" aria-label="Main navigation">
              <Link
                href="/"
                className={`transition-colors hover:text-primary ${
                  location === '/' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Generate
              </Link>
              <Link
                href="/history"
                className={`transition-colors hover:text-primary flex items-center gap-1.5 ${
                  location.startsWith('/history') ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Clock className="w-4 h-4" />
                History
              </Link>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-mono">
                <User className="w-3.5 h-3.5 text-primary" />
                {user.displayName || user.username}
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              className="text-xs font-mono"
              title="Export My Data (JSON)"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {isExporting ? 'Exporting...' : 'Export My Data (JSON)'}
            </Button>

            {!confirmDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete Account"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Account
              </Button>
            ) : (
              <div className="inline-flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded-md px-2 py-0.5">
                <span className="text-xs font-mono text-destructive font-bold mr-1">Confirm?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="h-6 px-2 text-xs font-mono"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="h-6 px-2 text-xs font-mono"
                >
                  Cancel
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-xs font-mono"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">{children}</main>

      <footer className="border-t bg-muted/20 py-4 px-4 text-xs text-muted-foreground">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <ShieldAlert className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>AI Deliverable Disclaimer:</strong> Generated PRDs, slide decks, financial charts, and web app prototypes are AI-generated drafts for ideation and require human verification.
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono shrink-0">
            <Link href="/privacy" className="underline hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline hover:text-primary">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export const Shell = Layout;
export default Layout;
