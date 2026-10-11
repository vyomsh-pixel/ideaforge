import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCreateGeneration, GenerationInputOutputType } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FileText, Presentation, BarChart3, Globe, Sparkles, Zap, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const OUTPUT_TYPES = [
  { id: 'doc', title: 'Document', icon: FileText, desc: 'A structured markdown document with sections and formatting.' },
  { id: 'ppt', title: 'Presentation', icon: Presentation, desc: 'A slide deck with key points, layouts, and speaker notes.' },
  { id: 'charts', title: 'Data & Charts', icon: BarChart3, desc: 'Visualized data concepts with interactive Recharts.' },
  { id: 'webapp', title: 'Web App', icon: Globe, desc: 'A functional, tweakable HTML/JS/CSS prototype.' }
] as const;

const LOADING_STEPS = [
  "Initializing neural pathways...",
  "Analyzing concept viability...",
  "Structuring deliverables...",
  "Synthesizing content...",
  "Polishing final output...",
  "Almost there..."
];

export function Home() {
  const [, setLocation] = useLocation();
  const [idea, setIdea] = useState('');
  const [outputType, setOutputType] = useState<typeof OUTPUT_TYPES[number]['id']>('doc');
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  
  const createGeneration = useCreateGeneration();
  
  const [loadingStep, setLoadingStep] = useState(0);
  
  useEffect(() => {
    if (!createGeneration.isPending) return;
    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [createGeneration.isPending]);

  const handleGenerate = () => {
    if (idea.trim().length < 10) return;
    setErrorAlert(null);
    setLoadingStep(0);
    createGeneration.mutate({ data: { idea, outputType } }, {
      onSuccess: (data) => {
        setLocation(`/generations/${data.id}`);
      },
      onError: (error) => {
        const description = error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';
        setErrorAlert(description);
        toast({
          variant: 'destructive',
          title: 'Generation failed',
          description,
        });
      },
    });
  };

  if (createGeneration.isPending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-secondary/30" role="status" aria-live="polite">
        <div className="max-w-md w-full flex flex-col items-center text-center space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
            <Sparkles className="w-16 h-16 text-primary relative animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-display font-bold animate-pulse">Forging Idea...</h2>
            <p className="text-muted-foreground font-mono text-sm h-6 transition-all duration-300">
              &gt; {LOADING_STEPS[loadingStep]}
            </p>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
              style={{ width: `${Math.max(10, (loadingStep / (LOADING_STEPS.length - 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="container px-4 py-12 max-w-4xl flex-1 flex flex-col w-full">
        <div className="space-y-4 mb-10 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight">
            What are you <span className="text-primary">building?</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Dump your raw, unorganized project idea below. We'll forge it into a ready-to-use deliverable in seconds.
          </p>
        </div>

        <div className="space-y-8 max-w-3xl mx-auto w-full">
          {errorAlert && (
            <div
              role="alert"
              className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Could Not Forge Deliverable</h4>
                <p className="mt-0.5">{errorAlert}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label htmlFor="raw-idea-input" className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              1. The Raw Idea
            </label>
            <Textarea
              id="raw-idea-input"
              className="min-h-[200px] text-lg p-6 font-sans resize-y shadow-sm font-medium border-2 focus-visible:border-primary focus-visible:ring-0"
              placeholder="e.g. A marketplace where students can trade leftover dining hall meal swipes. Need an app prototype..."
              value={idea}
              onChange={e => setIdea(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              2. The Deliverable
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="group" aria-label="Select deliverable type">
              {OUTPUT_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = outputType === type.id;
                const selectType = () => setOutputType(type.id as GenerationInputOutputType);
                return (
                  <Card 
                    key={type.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`p-5 cursor-pointer transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'border-primary shadow-md bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/50'}`}
                    onClick={selectType}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectType();
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg font-display">{type.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-snug">{type.desc}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="pt-6">
            <Button 
              size="lg" 
              className="w-full text-lg h-16 font-bold tracking-wide shadow-lg hover:shadow-xl transition-all font-display uppercase"
              onClick={handleGenerate}
              disabled={idea.trim().length < 10}
            >
              <Zap className="w-5 h-5 mr-2 fill-current" />
              Forge Deliverable
              <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 font-mono">
              Takes ~20-30s. Powered by advanced neural synthesis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
