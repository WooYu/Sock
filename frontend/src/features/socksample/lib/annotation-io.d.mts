export type Annotation = {
  id: number;
  tool: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  price?: number;
  label?: string;
  hidden?: boolean;
  [key: string]: unknown;
};

export function serializeAnnotations(
  annotations: ReadonlyArray<Annotation>,
  context: Record<string, unknown>,
): string;

export function parseAnnotations(
  raw: string | unknown,
  expectedContext?: Record<string, unknown>,
): Annotation[];
