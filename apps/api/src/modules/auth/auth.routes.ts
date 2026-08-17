import { Router } from "express";

import { asyncHandler } from "../../lib/http.js";
import { requireAuth } from "../../middleware/auth.js";
import { login, logout, me, signup } from "./auth.controller.js";

export const authRouter: Router = Router();

authRouter.post("/signup", asyncHandler(signup));
authRouter.post("/login", asyncHandler(login));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", requireAuth, asyncHandler(me));
