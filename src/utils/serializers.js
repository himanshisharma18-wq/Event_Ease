// Converts a mongoose document (or lean object) into a client-safe object by
// dropping internal/ownership fields.
export function toPublic(record, hidden = ["userId", "__v"]) {
  const value =
    typeof record?.toObject === "function"
      ? record.toObject()
      : { ...record };
  for (const field of hidden) delete value[field];
  return value;
}
