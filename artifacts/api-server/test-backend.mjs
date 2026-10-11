import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
delete process.env.DATABASE_URL;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENROUTER_API_KEY;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enable importing .ts source files with .js specifiers in Node 24+ even before bundling
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateTs = path.resolve(
        parentDir,
        specifier.replace(/\.js$/, ".ts"),
      );
      if (fs.existsSync(candidateTs)) {
        return { url: pathToFileURL(candidateTs).href, shortCircuit: true };
      }
      const candidateIndexTs = path.resolve(parentDir, specifier, "index.ts");
      if (fs.existsSync(candidateIndexTs)) {
        return {
          url: pathToFileURL(candidateIndexTs).href,
          shortCircuit: true,
        };
      }
    }
    if (specifier === "pino") {
      return {
        url: "data:text/javascript,export default () => ({ info(){}, warn(){}, error(){} });",
        shortCircuit: true,
      };
    }
    if (specifier === "@google/genai") {
      return {
        url: "data:text/javascript,export class GoogleGenAI {}",
        shortCircuit: true,
      };
    }
    if (specifier === "express") {
      return {
        url: "data:text/javascript,export function Router() { const routes = []; return { routes, post(p,h){routes.push({m:'POST',p,h})}, get(p,h){routes.push({m:'GET',p,h})}, delete(p,h){routes.push({m:'DELETE',p,h})}, use(){} }; } export default () => ({ use(){}, listen(){} });",
        shortCircuit: true,
      };
    }
    if (specifier === "drizzle-orm") {
      return {
        url: "data:text/javascript,export const eq = () => ({}); export const desc = () => ({}); export const sql = () => ({});",
        shortCircuit: true,
      };
    }
    if (specifier === "@workspace/db") {
      return {
        url: "data:text/javascript,export const isDbConfigured = false; export const db = {}; export const generationsTable = {};",
        shortCircuit: true,
      };
    }
    if (specifier === "@workspace/api-zod") {
      return {
        url: `data:text/javascript,
          export const createGenerationBodyIdeaMin = 10;
          export const createGenerationBodyIdeaMax = 5000;
          export const tweakGenerationBodyMessageMax = 1000;
          export const CreateGenerationBody = {
            safeParse(v) {
              if (!v || typeof v.idea !== 'string' || v.idea.length < 10 || v.idea.length > 5000) {
                return { success: false, error: { message: 'Invalid idea length' } };
              }
              if (!['doc', 'ppt', 'charts', 'webapp'].includes(v.outputType)) {
                return { success: false, error: { message: 'Invalid outputType' } };
              }
              return { success: true, data: { idea: v.idea, outputType: v.outputType } };
            }
          };
          export const TweakGenerationBody = {
            safeParse(v) {
              if (!v || typeof v.message !== 'string' || v.message.length < 1 || v.message.length > 1000) {
                return { success: false, error: { message: 'Invalid message length' } };
              }
              return { success: true, data: { message: v.message } };
            }
          };
          export const GetGenerationParams = { safeParse(v) { return { success: true, data: { id: Number(v?.id) } }; } };
          export const DeleteGenerationParams = GetGenerationParams;
          export const TweakGenerationParams = GetGenerationParams;
        `,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  extractJson,
  buildFallbackDeliverable,
  runGenerationPipeline,
  tweakWebapp,
} = await import("./src/lib/ai/pipeline.ts");

const authRouterModule = await import("./src/routes/auth.ts");
const { createAuthToken, verifyAuthToken, hashPassword, verifyPassword } =
  authRouterModule;

const generationsModule = await import("./src/routes/generations/index.ts");
const { MAX_IDEA_LENGTH, MAX_MESSAGE_LENGTH } = generationsModule;

const { CreateGenerationBody, TweakGenerationBody } = await import(
  "@workspace/api-zod"
);

describe("IdeaForge Automated Backend Test Suite", () => {
  test("1. extractJson parses fenced blocks, prose-wrapped JSON, and raw JSON accurately", () => {
    const fenced =
      'Here is your plan:\n```json\n{"title":"Smart Study","sections":[1,2]}\n```\nDone!';
    assert.deepEqual(extractJson(fenced), {
      title: "Smart Study",
      sections: [1, 2],
    });

    const proseWrapped =
      'Sure! {"title":"Solar Tracker","ok":true} Hope this helps.';
    assert.deepEqual(extractJson(proseWrapped), {
      title: "Solar Tracker",
      ok: true,
    });

    const raw = '{"title":"Clean JSON","count":3}';
    assert.deepEqual(extractJson(raw), { title: "Clean JSON", count: 3 });

    assert.throws(
      () => extractJson("not valid json at all"),
      /Could not extract valid JSON/,
    );
  });

  test("2. auth password hashing (scrypt) and HMAC-SHA256 Bearer token creation/verification", () => {
    const hash = hashPassword("super-secret-123");
    assert.equal(verifyPassword("super-secret-123", hash), true);
    assert.equal(verifyPassword("wrong-password", hash), false);

    const mockUser = {
      id: 42,
      username: "alex",
      displayName: "Alex Rivera",
      consentAccepted: true,
      createdAt: new Date().toISOString(),
    };

    const token = createAuthToken(mockUser);
    const verified = verifyAuthToken(token);
    assert.ok(verified);
    assert.equal(verified.sub, 42);
    assert.equal(verified.username, "alex");
    assert.equal(verified.displayName, "Alex Rivera");

    // Reject tampered signature
    const [payloadB64] = token.split(".");
    assert.equal(verifyAuthToken(`${payloadB64}.tamperedSignature`), null);

    // Reject expired token
    const expiredToken = createAuthToken(mockUser, -1000);
    assert.equal(verifyAuthToken(expiredToken), null);
  });

  test("3. input length bounds enforce idea <= 5000 and message <= 1000", () => {
    assert.equal(MAX_IDEA_LENGTH, 5000);
    assert.equal(MAX_MESSAGE_LENGTH, 1000);

    // Idea bounds: 10..5000 chars
    assert.equal(
      CreateGenerationBody.safeParse({ idea: "Too short", outputType: "doc" })
        .success,
      false,
    );
    assert.equal(
      CreateGenerationBody.safeParse({
        idea: "A valid student project idea for campus sustainability tracking",
        outputType: "doc",
      }).success,
      true,
    );
    assert.equal(
      CreateGenerationBody.safeParse({
        idea: "x".repeat(5001),
        outputType: "doc",
      }).success,
      false,
    );

    // Tweak message bounds: 1..1000 chars
    assert.equal(
      TweakGenerationBody.safeParse({ message: "" }).success,
      false,
    );
    assert.equal(
      TweakGenerationBody.safeParse({ message: "Add a dark mode toggle" })
        .success,
      true,
    );
    assert.equal(
      TweakGenerationBody.safeParse({ message: "m".repeat(1001) }).success,
      false,
    );
  });

  test("4. deterministic fallback deliverable structure for all 4 output types (doc, ppt, charts, webapp)", async () => {
    const idea = "Campus food waste reduction and redistribution platform";

    // doc
    const docOut = buildFallbackDeliverable(idea, "doc");
    assert.ok(docOut.title);
    assert.ok(Array.isArray(docOut.plan.sections));
    assert.ok(docOut.plan.sections.length >= 4);
    assert.equal(typeof docOut.result.content, "string");
    assert.ok(docOut.result.content.includes("# "));

    // ppt
    const pptOut = buildFallbackDeliverable(idea, "ppt");
    assert.ok(pptOut.title);
    assert.ok(Array.isArray(pptOut.plan.slideOutline));
    assert.ok(Array.isArray(pptOut.result.slides));
    assert.ok(pptOut.result.slides.length >= 5);

    // charts
    const chartsOut = buildFallbackDeliverable(idea, "charts");
    assert.ok(chartsOut.title);
    assert.ok(Array.isArray(chartsOut.plan.charts));
    assert.ok(Array.isArray(chartsOut.result.charts));
    assert.ok(chartsOut.result.charts.length >= 3);
    assert.ok(Array.isArray(chartsOut.result.charts[0].config.labels));
    assert.ok(Array.isArray(chartsOut.result.charts[0].config.datasets));

    // webapp + pipeline + tweak
    const statuses = [];
    const webappOut = await runGenerationPipeline(idea, "webapp", async (s) => {
      statuses.push(s);
    });
    assert.deepEqual(statuses, ["planning", "generating"]);
    assert.ok(webappOut.title);
    assert.ok(Array.isArray(webappOut.plan.features));
    assert.equal(typeof webappOut.result.html, "string");
    assert.ok(webappOut.result.html.includes("<!DOCTYPE html>"));
    assert.equal(typeof webappOut.result.css, "string");
    assert.equal(typeof webappOut.result.js, "string");
    assert.equal(typeof webappOut.result.readme, "string");

    const tweaked = await tweakWebapp(
      webappOut.result,
      "Add ```code``` snippet support and dark theme toggle",
    );
    assert.ok(tweaked.readme.includes("Applied Tweak"));
  });

  test("5. route handlers for auth, account export/delete, and generations execute end-to-end", async () => {
    const authRouter = authRouterModule.default;
    const genRouter = generationsModule.default;

    function invokeRoute(router, method, pathStr, { body = {}, headers = {}, params = {} } = {}) {
      const route = router.routes.find((r) => r.m === method && r.p === pathStr);
      assert.ok(route, `Route ${method} ${pathStr} should exist`);
      return new Promise((resolve) => {
        let statusCode = 200;
        const resHeaders = {};
        const req = {
          body,
          headers,
          params,
          log: { error() {}, warn() {}, info() {} },
        };
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          setHeader(k, v) {
            resHeaders[k.toLowerCase()] = v;
          },
          json(payload) {
            resolve({ status: statusCode, body: payload, headers: resHeaders });
          },
          sendStatus(code) {
            resolve({ status: code, body: null, headers: resHeaders });
          },
        };
        Promise.resolve(route.h(req, res)).catch((err) => {
          resolve({ status: 500, body: { error: String(err) }, headers: resHeaders });
        });
      });
    }

    // Register
    const reg = await invokeRoute(authRouter, "POST", "/auth/register", {
      body: {
        username: "vyom_dev",
        password: "securePassword123",
        displayName: "Vyom Dev",
        consentAccepted: true,
      },
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.body.token);
    assert.equal(reg.body.user.username, "vyom_dev");

    // Login
    const login = await invokeRoute(authRouter, "POST", "/auth/login", {
      body: { username: "vyom_dev", password: "securePassword123" },
    });
    assert.equal(login.status, 200);
    const authHeader = { authorization: `Bearer ${login.body.token}` };

    // Me
    const me = await invokeRoute(authRouter, "GET", "/auth/me", {
      headers: authHeader,
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.displayName, "Vyom Dev");

    // Oversized idea rejected with 400
    const badGen = await invokeRoute(genRouter, "POST", "/generations", {
      body: { idea: "a".repeat(5001), outputType: "doc" },
    });
    assert.equal(badGen.status, 400);

    // Valid webapp generation
    const created = await invokeRoute(genRouter, "POST", "/generations", {
      body: {
        idea: "Real-time study group scheduler with calendar heatmap",
        outputType: "webapp",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "done");

    // Stats consistency (total equals sum of byType)
    const stats = await invokeRoute(genRouter, "GET", "/generations/stats");
    assert.equal(stats.status, 200);
    assert.equal(stats.body.total, 1);
    assert.equal(stats.body.byType.webapp, 1);

    // Export account data
    const exported = await invokeRoute(authRouter, "GET", "/account/export", {
      headers: authHeader,
    });
    assert.equal(exported.status, 200);
    assert.equal(exported.body.user.username, "vyom_dev");
    assert.equal(exported.body.generations.length, 1);

    // Delete account
    const deleted = await invokeRoute(authRouter, "DELETE", "/account", {
      headers: authHeader,
    });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.status, "deleted");

    // Token invalidated after account deletion
    const meAfter = await invokeRoute(authRouter, "GET", "/auth/me", {
      headers: authHeader,
    });
    assert.equal(meAfter.status, 401);
  });
});
