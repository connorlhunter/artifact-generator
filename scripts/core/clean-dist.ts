import { removePath } from "./file-system.ts";
import { repoDirs } from "./script-constants.ts";

await removePath(repoDirs.dist);
