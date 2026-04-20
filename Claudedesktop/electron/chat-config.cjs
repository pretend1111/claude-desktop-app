function isClaudeFamilyModel(modelId) {
  return /^claude-/i.test(String(modelId || '').trim());
}

function resolveRequestedModelForMode({ modelId, userMode, hasProvider }) {
  const normalizedModelId = String(modelId || '').trim() || 'claude-sonnet-4-6';
  const effectiveUserMode = userMode === 'selfhosted' ? 'selfhosted' : 'clawparrot';

  if (effectiveUserMode === 'clawparrot' && !isClaudeFamilyModel(normalizedModelId)) {
    return {
      modelId: 'claude-sonnet-4-6',
      fallbackApplied: true,
      error: null,
    };
  }

  if (effectiveUserMode === 'selfhosted' && !hasProvider && !isClaudeFamilyModel(normalizedModelId)) {
    return {
      modelId: normalizedModelId,
      fallbackApplied: false,
      error: `No enabled self-hosted provider found for model "${normalizedModelId}".`,
    };
  }

  return {
    modelId: normalizedModelId,
    fallbackApplied: false,
    error: null,
  };
}

module.exports = {
  isClaudeFamilyModel,
  resolveRequestedModelForMode,
};
