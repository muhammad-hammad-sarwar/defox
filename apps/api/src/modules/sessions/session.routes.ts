import { Router } from "express";

import { asyncHandler } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  getOneSession,
  getSessions,
  postSession,
  removeSession,
} from "./session.controller.js";

export const sessionRouter: Router = Router();
sessionRouter.use(requireAuth);
sessionRouter.post("/", asyncHandler(postSession));
sessionRouter.get("/", asyncHandler(getSessions));
sessionRouter.get("/:sessionId", asyncHandler(getOneSession));
sessionRouter.delete("/:sessionId", asyncHandler(removeSession));
