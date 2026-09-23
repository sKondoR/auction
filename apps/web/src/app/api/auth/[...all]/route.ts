import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/shared/api";

export const { GET, POST } = toNextJsHandler(auth);
