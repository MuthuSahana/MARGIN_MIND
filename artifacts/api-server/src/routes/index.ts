import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marginmindRouter from "./marginmind";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marginmindRouter);

export default router;
