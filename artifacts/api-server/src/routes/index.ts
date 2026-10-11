import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth.js";
import generationsRouter from "./generations/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(generationsRouter);

export default router;
