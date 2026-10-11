import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Send, Bot, User, Code2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useTweakGeneration, getGetGenerationQueryKey, Generation } from '@workspace/api-client-react';
import { buildWebAppDownloadHtml, buildWebAppPreviewHtml } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface WebAppResultProps {
  generation: Generation;
}

interface TweakChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function WebAppResult({ generation }: WebAppResultProps) {
  const storageKey = `ideaforge_tweaks_${generation.id}`;
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [chatMessage, setChatMessage] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [isTweaking, setIsTweaking] = useState(false);
  const [tweakError, setTweakError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<TweakChatEntry[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const tweakGeneration = useTweakGeneration();

  const result = generation.result as any;
  const html = result?.html || '';
  const css = result?.css || '';
  const js = result?.js || '';
  const title = result?.title || generation.title || 'webapp';

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [chatHistory, storageKey]);

  useEffect(() => {
    if (!html) return;

    const fullHtml = buildWebAppPreviewHtml(html, css, js, title);
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setIframeUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [html, css, js, title]);

  const handleDownload = async () => {
    try {
      const zip = new JSZip();

      zip.file('index.html', buildWebAppDownloadHtml(html, css, js, title));
      if (css) zip.file('style.css', css);
      if (js) zip.file('script.js', js);
      if (result?.readme) zip.file('README.md', result.readme);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate ZIP archive.';
      setTweakError(message);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: message,
      });
    }
  };

  const handleTweak = (e: React.FormEvent) => {
    e.preventDefault();
    const promptText = chatMessage.trim();
    if (!promptText || isTweaking) return;

    setTweakError(null);
    setIsTweaking(true);
    setPendingPrompt(promptText);

    const userEntry: TweakChatEntry = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, userEntry]);
    setChatMessage('');

    tweakGeneration.mutate(
      { id: generation.id, data: { message: promptText } },
      {
        onSuccess: (updatedGen) => {
          queryClient.setQueryData(getGetGenerationQueryKey(generation.id), updatedGen);
          const assistantEntry: TweakChatEntry = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `Applied update: "${promptText}". The live preview has been refreshed.`,
            timestamp: new Date().toISOString(),
          };
          setChatHistory((prev) => [...prev, assistantEntry]);
          setPendingPrompt(null);
          setIsTweaking(false);
        },
        onError: (err) => {
          const description =
            err instanceof Error ? err.message : 'Could not apply the requested tweak. Please try again.';
          setTweakError(description);
          setPendingPrompt(null);
          setIsTweaking(false);
          toast({
            variant: 'destructive',
            title: 'Tweak Failed',
            description,
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="bg-muted/30 border-b px-4 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider font-mono">Live Preview</h3>
          </div>
          <Button onClick={handleDownload} size="sm" variant="outline" className="font-bold shrink-0">
            <Download className="w-4 h-4 lg:mr-2" />
            <span className="hidden lg:inline">Download ZIP</span>
          </Button>
        </div>

        <div className="flex-1 bg-white relative">
          {isTweaking && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <div className="bg-card shadow-xl rounded-xl p-6 flex flex-col items-center max-w-sm text-center border">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <h4 className="font-display font-bold text-lg mb-1">Applying Changes...</h4>
                <p className="text-sm text-muted-foreground">The AI is rewriting the code to match your instructions.</p>
              </div>
            </div>
          )}
          {iframeUrl ? (
            <iframe
              src={iframeUrl}
              className="w-full h-full border-none"
              title="Web App Preview"
              sandbox="allow-scripts"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              Generating preview...
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col shrink-0 bg-muted/10 h-[400px] lg:h-auto">
        <div className="border-b px-4 py-3 shrink-0 flex items-center gap-2 bg-muted/30">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm font-display tracking-tight text-foreground">Tweak Generation</h3>
        </div>

        {tweakError && (
          <div
            role="alert"
            className="mx-4 mt-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{tweakError}</span>
          </div>
        )}

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                <p>I've built the initial prototype based on your idea. You can interact with it on the left.</p>
                <p className="mt-2">Want to change something? Just tell me what to do. For example:</p>
                <ul className="mt-2 list-disc list-inside text-muted-foreground space-y-1 ml-1">
                  <li>"Make the header blue"</li>
                  <li>"Add a dark mode toggle"</li>
                  <li>"Make the buttons rounded"</li>
                </ul>
              </div>
            </div>

            {chatHistory.map((msg) =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex gap-3 flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-sm max-w-[85%]">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm max-w-[85%]">
                    {msg.content}
                  </div>
                </div>
              )
            )}

            {isTweaking && pendingPrompt && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
                <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3 text-xs font-mono text-muted-foreground shadow-sm">
                  Synthesizing changes for "{pendingPrompt}"...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background shrink-0">
          <form onSubmit={handleTweak} className="flex gap-2">
            <Input
              aria-label="Describe changes to tweak the web app"
              placeholder="e.g. Change the primary color to red..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              disabled={isTweaking}
              className="flex-1 bg-card border-2 focus-visible:ring-0 focus-visible:border-primary"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send tweak instruction"
              disabled={isTweaking || !chatMessage.trim()}
              className="shrink-0 bg-primary hover:bg-primary/90"
            >
              {isTweaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default WebAppResult;
