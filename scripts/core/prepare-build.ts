import { cp } from "node:fs/promises";
import { removePath } from "./file-system.ts";
import { repoDirs } from "./script-constants.ts";

await removePath(repoDirs.dist);
await cp("resources/pdf-fonts", `${repoDirs.dist}/resources/pdf-fonts`, { recursive: true });
