let sequence = 0;

export function nextTestRequestId(prefix = "test"): string {
  sequence += 1;
  return `${prefix}-${sequence.toString().padStart(4, "0")}`;
}
