export async function removePlanAndChildren({
  planModel,
  childModels,
  userId,
  planId,
  session,
}) {
  const plan = await planModel.findOneAndDelete(
    { _id: planId, userId },
    { session },
  );
  if (!plan) return false;

  const filter = { userId, planId };
  for (const model of childModels) await model.deleteMany(filter, { session });
  return true;
}
