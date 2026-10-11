import { callGemini } from "./gemini.js";
import { callOpenRouter } from "./openrouter.js";
import { logger } from "../logger.js";

export type OutputType = "doc" | "ppt" | "charts" | "webapp";

const JSON_SYSTEM_INSTRUCTION =
  "You are IdeaForge AI, an expert academic project architect. Return ONLY valid JSON matching the requested schema with no markdown wrapper or extra commentary.";

function escapeBackticks(value: string): string {
  return value.replace(/```/g, "\\`\\`\\`");
}

// Resilient JSON extraction — handles fenced blocks, prose before/after, and raw JSON
export function extractJson(text: string): unknown {
  // 1. Try fenced code blocks (```json ... ``` or ``` ... ```)
  const fenceMatches = [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)];
  for (const m of fenceMatches) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      /* try next */
    }
  }

  // 2. Try extracting the outermost { } object
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd + 1));
    } catch {
      /* continue */
    }
  }

  // 3. Try the whole trimmed text
  try {
    return JSON.parse(text.trim());
  } catch {
    /* continue */
  }

  throw new Error("Could not extract valid JSON from AI model response");
}

function hasConfiguredAIProvider(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim(),
  );
}

// Try Gemini first for text; if API call OR JSON parse fails, fall back to OpenRouter
async function callAIWithParse(
  prompt: string,
  systemInstruction = JSON_SYSTEM_INSTRUCTION,
): Promise<unknown> {
  let geminiText: string | null = null;
  try {
    geminiText = await callGemini(prompt, systemInstruction);
    return extractJson(geminiText);
  } catch (geminiErr) {
    logger.warn(
      { err: geminiErr, hadText: geminiText !== null },
      "Gemini stage failed, falling back to OpenRouter",
    );
    const orText = await callOpenRouter(prompt, systemInstruction);
    return extractJson(orText);
  }
}

// ─── Deterministic Fallback Deliverable Generator ────────────────────────────

function deriveTitle(idea: string): string {
  const cleaned = idea.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 56) return cleaned;
  return `${cleaned.slice(0, 53).trim()}...`;
}

export function buildFallbackDeliverable(
  idea: string,
  outputType: OutputType,
): PipelineResult {
  const shortTitle = deriveTitle(idea);

  if (outputType === "doc") {
    const title = `${shortTitle} — Project Specification`;
    const plan = {
      title,
      summary: `Comprehensive academic and technical specification for: ${idea}`,
      sections: [
        {
          heading: "Executive Summary & Problem Statement",
          keyPoints: [
            "Core user pain points and motivation",
            "Target stakeholders and measurable objectives",
            "Scope boundaries and success criteria",
          ],
        },
        {
          heading: "System Architecture & Data Model",
          keyPoints: [
            "Modular client-server architecture",
            "Core entities, relationships, and validation rules",
            "Security, privacy, and resilience controls",
          ],
        },
        {
          heading: "Implementation Roadmap",
          keyPoints: [
            "Phase 1: Core prototype and data pipeline",
            "Phase 2: Interactive UI and workflow automation",
            "Phase 3: Testing, benchmarking, and deployment",
          ],
        },
        {
          heading: "Evaluation & Risk Mitigation",
          keyPoints: [
            "Key performance indicators and user testing protocol",
            "Technical risks and fallback strategies",
            "Future extensibility",
          ],
        },
      ],
    };
    const content = [
      `# ${title}`,
      "",
      `> **Project Brief:** ${idea}`,
      "",
      "## 1. Executive Summary & Problem Statement",
      `This document outlines the design, architecture, and implementation plan for **${shortTitle}**. The project addresses critical workflow inefficiencies by combining structured data modeling with an intuitive user interface.`,
      "",
      "### Key Objectives",
      "- Deliver a responsive, accessible user experience with clear feedback loops.",
      "- Enforce strict input validation, privacy-by-design, and resilient error recovery.",
      "- Provide measurable insights and exportable deliverables for academic evaluation.",
      "",
      "## 2. System Architecture & Data Model",
      "The system follows a clean three-tier architecture:",
      "1. **Presentation Layer:** Responsive web interface with real-time state updates.",
      "2. **Application Layer:** RESTful API services with schema validation and authentication.",
      "3. **Persistence Layer:** Relational storage with structured JSON metadata.",
      "",
      "## 3. Implementation Roadmap",
      "- **Milestone 1 (Weeks 1–2):** Requirements validation, wireframing, and schema design.",
      "- **Milestone 2 (Weeks 3–4):** Core backend API implementation and frontend integration.",
      "- **Milestone 3 (Weeks 5–6):** End-to-end testing, accessibility audit, and final presentation.",
      "",
      "## 4. Evaluation & Risk Mitigation",
      "| Metric | Target | Verification Method |",
      "| :--- | :--- | :--- |",
      "| Response Latency | < 200ms P95 | Automated API benchmark |",
      "| Test Coverage | > 90% core paths | Unit & integration test suite |",
      "| Usability Score | > 4.5 / 5.0 | Peer walkthrough evaluation |",
    ].join("\n");

    return { title, plan, result: { title, content } };
  }

  if (outputType === "ppt") {
    const title = `${shortTitle} — Pitch & Architecture Deck`;
    const slides = [
      {
        id: 1,
        title,
        layout: "title",
        content: `Transforming "${idea}" into a ready-to-launch academic solution`,
        bullets: ["Problem & Opportunity", "Architecture & Demo", "Impact & Roadmap"],
        notes: "Welcome the audience and introduce the core project vision.",
      },
      {
        id: 2,
        title: "Problem Statement",
        layout: "bullets",
        content: "Why existing approaches fall short for users today",
        bullets: [
          "Fragmented tools increase cognitive load and slow execution",
          "Lack of actionable metrics makes progress difficult to verify",
          "Students and teams need an integrated, privacy-first workflow",
        ],
        notes: "Emphasize the real-world pain point motivating this project.",
      },
      {
        id: 3,
        title: "Proposed Solution",
        layout: "bullets",
        content: `How ${shortTitle} solves the core challenge`,
        bullets: [
          "Streamlined end-to-end workflow tailored to the user journey",
          "Real-time visual feedback and structured deliverable export",
          "Built-in validation and resilient offline-ready fallback design",
        ],
        notes: "Walk through the primary value proposition.",
      },
      {
        id: 4,
        title: "System Architecture",
        layout: "two-column",
        content: "Clean separation between interactive frontend, validated API, and storage",
        bullets: [
          "Frontend: React + TypeScript + Tailwind CSS",
          "Backend: Express REST API + Zod validation",
          "Storage: PostgreSQL + Drizzle ORM with export support",
        ],
        notes: "Highlight technical choices and why they ensure reliability.",
      },
      {
        id: 5,
        title: "Roadmap & Conclusion",
        layout: "bullets",
        content: "Execution milestones and measurable outcomes",
        bullets: [
          "Phase 1: Core MVP & schema validation completed",
          "Phase 2: User testing and performance optimization",
          "Phase 3: Final deployment and open-source documentation",
        ],
        notes: "Conclude with key takeaways and invite questions.",
      },
    ];
    const plan = {
      title,
      theme: "dark tech",
      slideOutline: slides.map((s) => ({
        title: s.title,
        bulletPoints: s.bullets,
        notes: s.notes,
      })),
    };
    return { title, plan, result: { title, slides } };
  }

  if (outputType === "charts") {
    const title = `${shortTitle} — Analytics & Impact Visualizations`;
    const charts = [
      {
        name: "Projected Adoption & Active Users",
        type: "line" as const,
        description: "Monthly active users across the initial 6-month rollout",
        xAxis: "Month",
        yAxis: "Active Users",
        config: {
          labels: ["Month 1", "Month 2", "Month 3", "Month 4", "Month 5", "Month 6"],
          datasets: [
            { label: "Active Users", data: [120, 280, 510, 890, 1340, 1950] },
          ],
        },
      },
      {
        name: "Task Completion Time Reduction (Minutes)",
        type: "bar" as const,
        description: "Comparison of manual baseline vs. automated workflow",
        xAxis: "Workflow Stage",
        yAxis: "Minutes",
        config: {
          labels: ["Planning", "Drafting", "Data Analysis", "Review & Export"],
          datasets: [
            { label: "Baseline (Manual)", data: [95, 140, 85, 60] },
            { label: "With Project Solution", data: [25, 40, 20, 15] },
          ],
        },
      },
      {
        name: "Resource Allocation by Module",
        type: "doughnut" as const,
        description: "Engineering effort distribution across system components",
        xAxis: "Component",
        yAxis: "Percentage",
        config: {
          labels: ["Core Engine", "Interactive UI", "Security & Privacy", "Testing & QA"],
          datasets: [{ label: "Effort %", data: [35, 30, 20, 15] }],
        },
      },
    ];
    const plan = {
      title,
      context: `Quantitative impact and performance projections for ${idea}`,
      charts: charts.map(({ name, type, description, xAxis, yAxis }) => ({
        name,
        type,
        description,
        xAxis,
        yAxis,
      })),
    };
    return {
      title,
      plan,
      result: {
        title,
        description: `Data story and impact benchmarks for: ${idea}`,
        charts: charts.map(({ name, type, description, config }) => ({
          name,
          type,
          description,
          config,
        })),
      },
    };
  }

  // webapp
  const title = `${shortTitle} — Interactive Workspace`;
  const plan = {
    title,
    tagline: `Interactive web application for: ${idea}`,
    description: `A self-contained, responsive web application designed around "${idea}" with live task tracking, metric cards, and instant filtering.`,
    features: [
      "Interactive item creator with priority tagging",
      "Live progress metrics and completion counter",
      "Search and status filter controls",
      "Responsive dark-mode interface",
    ],
    pages: ["Dashboard: overview metrics, interactive tracker, and activity log"],
    colorScheme: "deep slate with indigo and emerald accents, modern minimal",
    targetUser: "Students, researchers, and project teams",
  };

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { background: #0f172a; color: #f8fafc; padding: 2rem; line-height: 1.5; }
    .container { max-width: 880px; margin: 0 auto; }
    header { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #1e293b; }
    h1 { font-size: 1.6rem; color: #e2e8f0; margin-bottom: 0.35rem; }
    p.sub { color: #94a3b8; font-size: 0.95rem; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1rem; }
    .card .label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }
    .card .val { font-size: 1.5rem; font-weight: 700; color: #38bdf8; margin-top: 0.25rem; }
    .controls { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; }
    input { flex: 1; padding: 0.65rem 0.9rem; border-radius: 0.5rem; border: 1px solid #334155; background: #0f172a; color: #f8fafc; }
    button { padding: 0.65rem 1.2rem; border-radius: 0.5rem; border: none; background: #6366f1; color: white; font-weight: 600; cursor: pointer; }
    button:hover { background: #4f46e5; }
    ul { list-style: none; display: grid; gap: 0.6rem; }
    li { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid #334155; }
    li.done span { text-decoration: line-through; color: #64748b; }
  `.trim();

  const js = `
    const items = [
      { text: "Define core project scope & requirements", done: true },
      { text: "Validate prototype workflow with test data", done: false },
      { text: "Review performance metrics & export report", done: false }
    ];
    function render() {
      const list = document.getElementById("item-list");
      list.innerHTML = "";
      items.forEach((item, idx) => {
        const li = document.createElement("li");
        if (item.done) li.className = "done";
        const span = document.createElement("span");
        span.textContent = item.text;
        const btn = document.createElement("button");
        btn.textContent = item.done ? "Undo" : "Complete";
        btn.onclick = () => { items[idx].done = !items[idx].done; render(); };
        li.append(span, btn);
        list.appendChild(li);
      });
      const doneCount = items.filter(i => i.done).length;
      document.getElementById("total-count").textContent = String(items.length);
      document.getElementById("done-count").textContent = String(doneCount);
      document.getElementById("rate-val").textContent = items.length ? Math.round((doneCount / items.length) * 100) + "%" : "0%";
    }
    document.getElementById("add-btn").addEventListener("click", () => {
      const input = document.getElementById("new-item");
      const val = input.value.trim();
      if (!val) return;
      items.unshift({ text: val, done: false });
      input.value = "";
      render();
    });
    render();
  `.trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <p class="sub">${idea}</p>
    </header>
    <div class="stats">
      <div class="card"><div class="label">Total Tasks</div><div class="val" id="total-count">3</div></div>
      <div class="card"><div class="label">Completed</div><div class="val" id="done-count">1</div></div>
      <div class="card"><div class="label">Completion Rate</div><div class="val" id="rate-val">33%</div></div>
    </div>
    <div class="controls">
      <input id="new-item" type="text" placeholder="Add a new milestone or action item..." />
      <button id="add-btn">Add Item</button>
    </div>
    <ul id="item-list"></ul>
  </div>
  <script>${js}</script>
</body>
</html>`;

  const readme = `# ${title}\n\n## Overview\nInteractive web application generated for: **${idea}**.\n\n## How to Use\n1. Open the HTML file directly in any modern browser.\n2. Add new action items and toggle completion states to update live metrics.`;

  return {
    title,
    plan,
    result: { title, html, css, js, readme },
  };
}

// ─── Planner prompts ────────────────────────────────────────────────────────

function getPlannerPrompt(idea: string, outputType: OutputType): string {
  const base = `You are an expert academic project planner. A student has this project idea:\n"${idea}"\n\n`;

  const formats: Record<OutputType, string> = {
    doc: `${base}Create a detailed document plan. Return ONLY valid JSON in exactly this format:
{
  "title": "descriptive document title",
  "summary": "one-sentence overview of the document",
  "sections": [
    { "heading": "section title", "keyPoints": ["point 1", "point 2", "point 3"] }
  ]
}
Plan 5-8 meaningful sections. Be specific and practical for this project idea.`,

    ppt: `${base}Create a slide deck plan. Return ONLY valid JSON in exactly this format:
{
  "title": "presentation title",
  "theme": "brief style/color direction e.g. 'dark tech', 'bright academic', 'minimal corporate'",
  "slideOutline": [
    { "title": "slide title", "bulletPoints": ["bullet 1", "bullet 2", "bullet 3"], "notes": "speaker notes" }
  ]
}
Plan 8-12 slides including title slide, agenda, content slides, and conclusion. Be specific.`,

    charts: `${base}Create a data visualization plan. Return ONLY valid JSON in exactly this format:
{
  "title": "visualization set title",
  "context": "one-sentence description of what these charts illustrate",
  "charts": [
    { "name": "chart title", "type": "bar|line|pie|doughnut", "description": "what this chart shows and why it matters", "xAxis": "what the x-axis represents", "yAxis": "what the y-axis represents" }
  ]
}
Plan 3-5 meaningful charts that tell a data story about this project. Choose chart types that make sense for the data.`,

    webapp: `${base}Create a web app blueprint. Return ONLY valid JSON in exactly this format:
{
  "title": "app name",
  "tagline": "one-sentence value proposition",
  "description": "2-3 sentence app description",
  "features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "pages": ["page name: what it does"],
  "colorScheme": "describe primary color and overall aesthetic e.g. 'deep blue with white accents, modern minimal'",
  "targetUser": "who uses this app and why"
}
Be creative and specific. The app must be implementable in vanilla HTML/CSS/JS.`,
  };

  return formats[outputType];
}

// ─── Generator prompts ───────────────────────────────────────────────────────

function getGeneratorPrompt(
  plan: unknown,
  idea: string,
  outputType: OutputType,
): string {
  const planStr = JSON.stringify(plan, null, 2);
  const base = `You are an expert at generating complete, ready-to-submit student project deliverables.\n\nOriginal idea: "${idea}"\n\nPlan:\n${planStr}\n\n`;

  const formats: Record<OutputType, string> = {
    doc: `${base}Write the COMPLETE document in Markdown. Include all sections with detailed, substantive content — this must be ready to submit. Be thorough, specific, and professional.
Return ONLY valid JSON in exactly this format:
{
  "title": "document title",
  "content": "# Title\\n\\n## Section\\n\\nContent here..."
}
The content field must be a complete Markdown document with proper headings, paragraphs, and detail. Use \\n for newlines inside the JSON string.`,

    ppt: `${base}Generate the complete slide deck content. Each slide should have compelling, concise content.
Return ONLY valid JSON in exactly this format:
{
  "title": "presentation title",
  "slides": [
    { "id": 1, "title": "slide title", "layout": "title|bullets|content|two-column", "content": "main content or subtitle for title slides", "bullets": ["bullet 1", "bullet 2"], "notes": "speaker notes" }
  ]
}
Generate all slides from the plan. Use layout: "title" for the opening slide, "bullets" for bullet-point slides, "content" for prose slides. Make content specific and substantial.`,

    charts: `${base}Generate complete Chart.js-compatible data for all charts. Make data realistic and meaningful for the project topic.
Return ONLY valid JSON in exactly this format:
{
  "title": "visualization title",
  "description": "what story these charts tell",
  "charts": [
    {
      "name": "chart title",
      "type": "bar|line|pie|doughnut",
      "description": "what this shows",
      "config": {
        "labels": ["label1", "label2", "label3"],
        "datasets": [
          { "label": "dataset name", "data": [10, 20, 30] }
        ]
      }
    }
  ]
}
Generate all charts from the plan with realistic numeric data. For pie/doughnut charts, datasets should have one dataset with data summing to 100 or a meaningful total.`,

    webapp: `${base}Generate a COMPLETE, FUNCTIONAL vanilla HTML/CSS/JS web application. This must work when the HTML file is opened directly in a browser — no build step, no frameworks, no external dependencies (except CDN links if needed for specific libraries like Chart.js).

Requirements:
- Modern, polished design matching the colorScheme in the plan
- Fully functional interactive features
- Mobile-responsive
- All CSS inline in a <style> tag or separate field
- All JS inline in a <script> tag or separate field
- Include a detailed README explaining how to use and extend it

Return ONLY valid JSON in exactly this format:
{
  "title": "app name",
  "html": "<!DOCTYPE html>\\n<html>...",
  "css": "/* CSS here - can be empty string if styles are inline in HTML */",
  "js": "/* JS here - can be empty string if scripts are inline in HTML */",
  "readme": "# App Name\\n\\n## How to Use\\n\\n..."
}
Make the HTML complete and self-contained. Use \\n for newlines in JSON strings. The app must be impressive and fully functional.`,
  };

  return formats[outputType];
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

export interface PipelineResult {
  title: string;
  plan: unknown;
  result: unknown;
}

export type OnStatusUpdate = (
  status: "planning" | "generating",
) => Promise<void>;

export async function tweakWebapp(
  currentResult: {
    title?: string;
    html?: string;
    css?: string;
    js?: string;
    readme?: string;
  },
  message: string,
): Promise<Record<string, unknown>> {
  const safeHtml = escapeBackticks(currentResult.html ?? "");
  const safeCss = escapeBackticks(currentResult.css ?? "");
  const safeJs = escapeBackticks(currentResult.js ?? "");

  if (!hasConfiguredAIProvider()) {
    return {
      ...currentResult,
      readme: `${currentResult.readme ?? "# Web App"}\n\n### Applied Tweak\n- ${message}`,
    };
  }

  const prompt = `You are a web developer. A student has a vanilla HTML/CSS/JS web app and wants to make a change.

Current app title: "${currentResult.title ?? ""}"

Current HTML:
\`\`\`html
${safeHtml}
\`\`\`

Current CSS:
\`\`\`css
${safeCss}
\`\`\`

Current JS:
\`\`\`javascript
${safeJs}
\`\`\`

The student's requested change: "${escapeBackticks(message)}"

Apply the change and return the updated app. Return ONLY valid JSON in exactly this format:
{
  "title": "app name",
  "html": "complete updated HTML",
  "css": "updated CSS",
  "js": "updated JS",
  "readme": "updated README"
}
Keep all existing functionality intact — only apply the requested change. Use \\n for newlines in JSON strings.`;

  try {
    return (await callAIWithParse(
      prompt,
      JSON_SYSTEM_INSTRUCTION,
    )) as Record<string, unknown>;
  } catch (err) {
    logger.warn({ err }, "AI tweak failed, applying deterministic fallback tweak");
    return {
      ...currentResult,
      readme: `${currentResult.readme ?? "# Web App"}\n\n### Applied Tweak\n- ${message}`,
    };
  }
}

export async function runGenerationPipeline(
  idea: string,
  outputType: OutputType,
  onStatus?: OnStatusUpdate,
): Promise<PipelineResult> {
  await onStatus?.("planning");

  if (!hasConfiguredAIProvider()) {
    logger.info(
      { outputType },
      "No AI provider keys configured; using deterministic fallback deliverable",
    );
    await onStatus?.("generating");
    return buildFallbackDeliverable(idea, outputType);
  }

  try {
    // Stage 1: Plan
    logger.info({ outputType }, "Stage 1: Running planner");
    const plannerPrompt = getPlannerPrompt(idea, outputType);
    const plan = (await callAIWithParse(
      plannerPrompt,
      JSON_SYSTEM_INSTRUCTION,
    )) as Record<string, unknown>;
    const planTitle = (plan.title as string) ?? "Project";

    // Stage 2: Generate
    logger.info({ outputType, planTitle }, "Stage 2: Running generator");
    await onStatus?.("generating");
    const generatorPrompt = getGeneratorPrompt(plan, idea, outputType);
    const result = (await callAIWithParse(
      generatorPrompt,
      JSON_SYSTEM_INSTRUCTION,
    )) as Record<string, unknown>;
    const resultTitle = (result.title as string) ?? planTitle;

    return { title: resultTitle, plan, result };
  } catch (err) {
    logger.warn(
      { err, outputType },
      "AI provider pipeline failed; using deterministic fallback deliverable",
    );
    await onStatus?.("generating");
    return buildFallbackDeliverable(idea, outputType);
  }
}
