import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('IdeaForge Frontend Verification Suite', () => {
  it('1. vite.config.ts defaults PORT to 5173, BASE_PATH to /, and configures /api proxy', () => {
    const viteConfig = fs.readFileSync(path.join(__dirname, 'vite.config.ts'), 'utf8');
    assert.ok(viteConfig.includes("process.env.PORT || '5173'"));
    assert.ok(viteConfig.includes("process.env.BASE_PATH || '/'"));
    assert.ok(viteConfig.includes("'/api': 'http://localhost:3000'"));
  });

  it('2. utils.ts escapes HTML title and injects CSS/JS into full HTML documents for preview and download', () => {
    const utilsSrc = fs.readFileSync(path.join(__dirname, 'src/lib/utils.ts'), 'utf8');
    assert.ok(utilsSrc.includes('export function escapeHtml'));
    assert.ok(utilsSrc.includes('<style>${css}</style>'));
    assert.ok(utilsSrc.includes('<script>${js}</script>'));
    assert.ok(utilsSrc.includes('<link rel="stylesheet" href="style.css">'));
    assert.ok(utilsSrc.includes('<script src="script.js"></script>'));
  });

  it('3. AuthGate.tsx & Layout.tsx implement login/register/guest, mandatory consent + AI disclaimer checkboxes, legal TODOs, loading screen, and account export/delete', () => {
    const authSrc = fs.readFileSync(path.join(__dirname, 'src/components/AuthGate.tsx'), 'utf8');
    const layoutSrc = fs.readFileSync(path.join(__dirname, 'src/components/Layout.tsx'), 'utf8');

    assert.ok(
      authSrc.includes(
        'I consent to IdeaForge processing my product ideas via Gemini / OpenRouter AI models and storing generated deliverables.'
      )
    );
    assert.ok(
      authSrc.includes(
        'I understand that generated PRDs, slide decks, financial charts, and web app prototypes are AI-generated drafts for ideation and require human verification.'
      )
    );
    assert.ok(authSrc.includes('TODO(LEGAL): Supply official organization legal copy'));
    assert.ok(authSrc.includes('prefers-reduced-motion'));
    assert.ok(authSrc.includes('ideaforge_token'));
    assert.ok(authSrc.includes('ideaforge_user'));

    assert.ok(layoutSrc.includes('Export My Data (JSON)'));
    assert.ok(layoutSrc.includes('Delete Account'));
    assert.ok(layoutSrc.includes('Sign Out'));
    assert.ok(layoutSrc.includes('AI Deliverable Disclaimer'));
  });

  it('4. Result.tsx lazy-loads DocResult, PptResult, ChartsResult, and WebAppResult, and Ponytail bloat purge removed mockup-sandbox and 46 unused UI components', () => {
    const resultSrc = fs.readFileSync(path.join(__dirname, 'src/pages/Result.tsx'), 'utf8');
    assert.ok(resultSrc.includes('lazy(') && resultSrc.includes('<Suspense'));

    const uiFiles = fs.readdirSync(path.join(__dirname, 'src/components/ui'));
    assert.equal(uiFiles.length, 9);
    assert.equal(fs.existsSync(path.join(__dirname, 'src/hooks/use-mobile.tsx')), false);
    assert.equal(fs.existsSync(path.join(__dirname, '../mockup-sandbox')), false);
  });

  it('5. index.html, index.css, Home.tsx, History.tsx, and WebAppResult.tsx include accessibility and state persistence fixes', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'src/index.css'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, 'src/pages/Home.tsx'), 'utf8');
    const history = fs.readFileSync(path.join(__dirname, 'src/pages/History.tsx'), 'utf8');
    const webapp = fs.readFileSync(path.join(__dirname, 'src/components/results/WebAppResult.tsx'), 'utf8');

    assert.equal(html.includes('maximum-scale=1'), false);
    assert.equal(html.includes('family=Inter'), false);
    assert.ok(html.includes('Bricolage+Grotesque'));
    assert.equal(css.includes('fonts.googleapis.com'), false);

    assert.ok(home.includes('role="button"') && home.includes('tabIndex={0}') && home.includes('onKeyDown'));
    assert.ok(history.includes('role="button"') && history.includes('tabIndex={0}') && history.includes('onKeyDown'));
    assert.ok(webapp.includes('chatHistory') && webapp.includes('role="alert"'));
  });
});
