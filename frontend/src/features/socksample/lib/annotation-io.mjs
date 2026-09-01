const REQUIRED = ["id", "tool", "x", "y"];
export function serializeAnnotations(annotations, context) {
  return JSON.stringify({ version: 1, context, annotations }, null, 2);
}
export function parseAnnotations(raw, expectedContext) {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!value || value.version !== 1 || !Array.isArray(value.annotations)) throw new Error("标注文件格式不正确");
  if (expectedContext && JSON.stringify(value.context) !== JSON.stringify(expectedContext)) throw new Error("标注文件与当前股票或周期不匹配");
  if (value.annotations.some((item) => REQUIRED.some((key) => item[key] === undefined) || !Number.isFinite(item.x) || !Number.isFinite(item.y))) throw new Error("标注数据不完整");
  return value.annotations;
}

