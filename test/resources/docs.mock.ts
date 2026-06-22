import type { DiagramJob } from "../../scripts/diagrams/diagram-types.ts";
import { diagramPaths } from "./docs.constants.ts";

export const diagramJobs: DiagramJob[] = [
  {
    input: diagramPaths.projectOverview,
    output: diagramPaths.projectOverview.replace(/\.mmd$/, ".svg"),
  },
  {
    input: diagramPaths.projectDiagram,
    output: diagramPaths.projectDiagram.replace(/\.mmd$/, ".svg"),
  },
  {
    input: diagramPaths.nestedDiagram,
    output: diagramPaths.nestedDiagram.replace(/\.mmd$/, ".svg"),
  },
];
