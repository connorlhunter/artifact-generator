import { removePath } from "./bun-native-fs.ts";
import { repoDirs } from "./script-constants.ts";

await removePath(repoDirs.dist);
