import type { DiagramJob } from "../../scripts/diagrams/diagram-types.ts";
import { diagramMetadata, diagramOutputPaths, diagramPaths } from "./docs.constants.ts";

export const diagramJobs: DiagramJob[] = [
  {
    input: diagramPaths.projectOverview,
    output: diagramOutputPaths.projectOverview,
    ...diagramMetadata.projectOverview,
  },
  {
    input: diagramPaths.projectDiagram,
    output: diagramOutputPaths.projectDiagram,
    ...diagramMetadata.projectDiagram,
  },
  {
    input: diagramPaths.nestedDiagram,
    output: diagramOutputPaths.nestedDiagram,
    ...diagramMetadata.nestedDiagram,
  },
];
