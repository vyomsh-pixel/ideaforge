import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, generationsTable, isDbConfigured } from "@workspace/db";
import {
  CreateGenerationBody,
  GetGenerationParams,
  DeleteGenerationParams,
  TweakGenerationParams,
  TweakGenerationBody,
} from "@workspace/api-zod";
import { runGenerationPipeline, tweakWebapp } from "../../lib/ai/pipeline.js";
import { getAuthenticatedUser } from "../auth.js";

const router: IRouter = Router();

export const MAX_IDEA_LENGTH = 5000;
export const MAX_MESSAGE_LENGTH = 1000;

interface GenerationRow {
  id: number;
  userId?: number | null;
  outputType: string;
  status: string;
  idea: string;
  title: string | null;
  plan: unknown;
  result: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const fallbackStore: GenerationRow[] = [];
let nextFallbackId = 1;

export function getFallbackGenerations(userId?: number | null) {
  if (userId != null) {
    return fallbackStore
      .filter((g) => g.userId === userId || g.userId == null)
      .map(toResponse);
  }
  return fallbackStore.map(toResponse);
}

export function clearFallbackGenerations(userId?: number | null) {
  if (userId != null) {
    const remaining = fallbackStore.filter((g) => g.userId !== userId);
    fallbackStore.length = 0;
    fallbackStore.push(...remaining);
    return;
  }
  fallbackStore.length = 0;
}

// POST /generations — create + run pipeline synchronously
router.post("/generations", async (req, res): Promise<void> => {
  const rawIdea = req.body?.idea;
  if (typeof rawIdea === "string" && rawIdea.length > MAX_IDEA_LENGTH) {
    res
      .status(400)
      .json({ error: `Idea must be ${MAX_IDEA_LENGTH} characters or fewer` });
    return;
  }

  const parsed = CreateGenerationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { idea, outputType } = parsed.data;
  if (idea.length > MAX_IDEA_LENGTH) {
    res
      .status(400)
      .json({ error: `Idea must be ${MAX_IDEA_LENGTH} characters or fewer` });
    return;
  }

  const user = getAuthenticatedUser(req);
  const userId = user ? user.id : null;

  // Fallback in-memory mode when DB is not configured in local dev
  if (!isDbConfigured) {
    const now = new Date();
    const memGen: GenerationRow = {
      id: nextFallbackId++,
      userId,
      outputType,
      status: "pending",
      idea,
      title: null,
      plan: null,
      result: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    fallbackStore.unshift(memGen);

    try {
      const { title, plan, result } = await runGenerationPipeline(
        idea,
        outputType as "doc" | "ppt" | "charts" | "webapp",
        async (status) => {
          memGen.status = status;
          memGen.updatedAt = new Date();
        },
      );
      memGen.status = "done";
      memGen.title = title;
      memGen.plan = plan;
      memGen.result = result;
      memGen.updatedAt = new Date();
      res.status(201).json(toResponse(memGen));
    } catch (err) {
      req.log.error({ err }, "Generation pipeline failed");
      memGen.status = "error";
      memGen.errorMessage = "Generation failed";
      memGen.updatedAt = new Date();
      res.status(500).json({ error: "Generation failed. Please try again." });
    }
    return;
  }

  let gen: typeof generationsTable.$inferSelect;
  try {
    [gen] = await db
      .insert(generationsTable)
      .values({ idea, outputType, status: "pending", userId })
      .returning();
  } catch (dbErr) {
    req.log.error({ err: dbErr }, "Failed to insert generation record");
    res.status(500).json({ error: "Failed to initialize generation" });
    return;
  }

  try {
    // Run two-stage AI pipeline with live status updates
    const { title, plan, result } = await runGenerationPipeline(
      idea,
      outputType as "doc" | "ppt" | "charts" | "webapp",
      async (status) => {
        await db
          .update(generationsTable)
          .set({ status, updatedAt: new Date() })
          .where(eq(generationsTable.id, gen.id));
      },
    );

    // Update to done
    const [done] = await db
      .update(generationsTable)
      .set({
        status: "done",
        title,
        plan: plan as Record<string, unknown>,
        result: result as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(generationsTable.id, gen.id))
      .returning();

    res.status(201).json(toResponse(done));
  } catch (err) {
    req.log.error({ err }, "Generation pipeline failed");
    try {
      await db
        .update(generationsTable)
        .set({
          status: "error",
          errorMessage: "Generation pipeline failed",
          updatedAt: new Date(),
        })
        .where(eq(generationsTable.id, gen.id));
    } catch (updateErr) {
      req.log.error({ err: updateErr }, "Failed to record generation error status");
    }

    res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

// GET /generations — list recent 20
router.get("/generations", async (req, res): Promise<void> => {
  const user = getAuthenticatedUser(req);
  if (!isDbConfigured) {
    const list = user
      ? fallbackStore.filter((g) => g.userId === user.id || g.userId == null)
      : fallbackStore;
    res.json(list.slice(0, 20).map(toResponse));
    return;
  }

  try {
    const gens = user
      ? await db
          .select()
          .from(generationsTable)
          .where(eq(generationsTable.userId, user.id))
          .orderBy(desc(generationsTable.createdAt))
          .limit(20)
      : await db
          .select()
          .from(generationsTable)
          .orderBy(desc(generationsTable.createdAt))
          .limit(20);

    res.json(gens.map(toResponse));
  } catch (err) {
    req.log.error({ err }, "Failed to list generations");
    res.json(fallbackStore.slice(0, 20).map(toResponse));
  }
});

// GET /generations/stats
router.get("/generations/stats", async (req, res): Promise<void> => {
  const byType = { doc: 0, ppt: 0, charts: 0, webapp: 0 } as Record<
    string,
    number
  >;

  if (!isDbConfigured) {
    const doneRows = fallbackStore.filter((g) => g.status === "done");
    for (const row of doneRows) {
      byType[row.outputType] = (byType[row.outputType] ?? 0) + 1;
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentCount = doneRows.filter(
      (g) => g.createdAt.getTime() > cutoff,
    ).length;
    res.json({
      total: doneRows.length,
      byType,
      recentCount,
    });
    return;
  }

  try {
    const [[total], byTypeRows, [recent]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(generationsTable)
        .where(eq(generationsTable.status, "done")),
      db
        .select({
          outputType: generationsTable.outputType,
          count: sql<number>`count(*)::int`,
        })
        .from(generationsTable)
        .where(eq(generationsTable.status, "done"))
        .groupBy(generationsTable.outputType),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(generationsTable)
        .where(
          sql`${generationsTable.status} = 'done' AND ${generationsTable.createdAt} > now() - interval '24 hours'`,
        ),
    ]);

    for (const row of byTypeRows) {
      byType[row.outputType] = row.count;
    }

    res.json({
      total: total?.count ?? 0,
      byType,
      recentCount: recent?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch generation stats");
    res.json({ total: 0, byType, recentCount: 0 });
  }
});

// GET /generations/:id
router.get("/generations/:id", async (req, res): Promise<void> => {
  const params = GetGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (!isDbConfigured) {
    const found = fallbackStore.find((g) => g.id === params.data.id);
    if (!found) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
    res.json(toResponse(found));
    return;
  }

  try {
    const [gen] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, params.data.id));

    if (!gen) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }

    res.json(toResponse(gen));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch generation");
    res.status(500).json({ error: "Failed to load generation" });
  }
});

// DELETE /generations/:id
router.delete("/generations/:id", async (req, res): Promise<void> => {
  const params = DeleteGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = getAuthenticatedUser(req);

  if (!isDbConfigured) {
    const idx = fallbackStore.findIndex((g) => g.id === params.data.id);
    if (idx === -1) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
    const target = fallbackStore[idx];
    if (target.userId != null && (!user || target.userId !== user.id)) {
      res.status(403).json({ error: "Forbidden: You cannot delete another user's generation" });
      return;
    }
    fallbackStore.splice(idx, 1);
    res.sendStatus(204);
    return;
  }

  try {
    const [existing] = await db
      .select({ id: generationsTable.id, userId: generationsTable.userId })
      .from(generationsTable)
      .where(eq(generationsTable.id, params.data.id));

    if (!existing) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }

    if (existing.userId != null && (!user || existing.userId !== user.id)) {
      res.status(403).json({ error: "Forbidden: You cannot delete another user's generation" });
      return;
    }

    await db
      .delete(generationsTable)
      .where(eq(generationsTable.id, params.data.id));

    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Failed to delete generation");
    res.status(500).json({ error: "Failed to delete generation" });
  }
});

// POST /generations/:id/tweak
router.post("/generations/:id/tweak", async (req, res): Promise<void> => {
  const params = TweakGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rawMessage = req.body?.message;
  if (
    typeof rawMessage === "string" &&
    rawMessage.length > MAX_MESSAGE_LENGTH
  ) {
    res.status(400).json({
      error: `Tweak message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
    });
    return;
  }

  const body = TweakGenerationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { message } = body.data;
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Tweak message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
    });
    return;
  }

  if (!isDbConfigured) {
    const memGen = fallbackStore.find((g) => g.id === params.data.id);
    if (!memGen) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
    if (memGen.outputType !== "webapp") {
      res
        .status(400)
        .json({ error: "Tweaking is only supported for webapp generations" });
      return;
    }
    if (memGen.status !== "done" || !memGen.result) {
      res.status(400).json({ error: "Generation is not complete yet" });
      return;
    }
    try {
      const currentResult = memGen.result as {
        title?: string;
        html?: string;
        css?: string;
        js?: string;
        readme?: string;
      };
      memGen.result = await tweakWebapp(currentResult, message);
      memGen.updatedAt = new Date();
      res.json(toResponse(memGen));
    } catch (err) {
      req.log.error({ err }, "Tweak failed");
      res.status(500).json({ error: "Failed to apply tweak" });
    }
    return;
  }

  let gen: typeof generationsTable.$inferSelect | undefined;
  try {
    [gen] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, params.data.id));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch generation for tweak");
    res.status(500).json({ error: "Failed to load generation" });
    return;
  }

  if (!gen) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  if (gen.outputType !== "webapp") {
    res
      .status(400)
      .json({ error: "Tweaking is only supported for webapp generations" });
    return;
  }

  if (gen.status !== "done" || !gen.result) {
    res.status(400).json({ error: "Generation is not complete yet" });
    return;
  }

  const currentResult = gen.result as {
    title?: string;
    html?: string;
    css?: string;
    js?: string;
    readme?: string;
  };

  try {
    const updatedResult = await tweakWebapp(currentResult, message);

    const [updated] = await db
      .update(generationsTable)
      .set({
        result: updatedResult,
        updatedAt: new Date(),
      })
      .where(eq(generationsTable.id, gen.id))
      .returning();

    res.json(toResponse(updated));
  } catch (err) {
    req.log.error({ err }, "Tweak failed");
    res.status(500).json({ error: "Failed to apply tweak" });
  }
});

function toResponse(gen: GenerationRow) {
  return {
    id: gen.id,
    outputType: gen.outputType,
    status: gen.status,
    idea: gen.idea,
    title: gen.title,
    plan: gen.plan,
    result: gen.result,
    errorMessage: gen.errorMessage,
    createdAt: gen.createdAt.toISOString(),
    updatedAt: gen.updatedAt.toISOString(),
  };
}

export default router;
