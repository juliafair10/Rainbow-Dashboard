function threadHasLabel_(thread, labelName) {
  const labels = thread.getLabels();

  for (let i = 0; i < labels.length; i++) {
    if (labels[i].getName() === labelName) {
      return true;
    }
  }

  return false;
}
function applyInsuranceIntakeLabels_(thread, labelPlan) {
  const result = {
    success: true,
    added: [],
    removed: [],
    warnings: [],
    error: ''
  };

  try {
    const labelsToAdd = dedupeLabelNames_((labelPlan && labelPlan.add) || []);
    const labelsToRemove = dedupeLabelNames_((labelPlan && labelPlan.remove) || []);

    labelsToAdd.forEach(function(labelName) {
      if (!labelName) {
        return;
      }

      let label = GmailApp.getUserLabelByName(labelName);

      if (!label) {
        label = GmailApp.createLabel(labelName);
        result.warnings.push('Created missing Gmail label: ' + labelName);
      }

      thread.addLabel(label);
      result.added.push(labelName);
    });

    labelsToRemove.forEach(function(labelName) {
      if (!labelName) {
        return;
      }

      const label = GmailApp.getUserLabelByName(labelName);

      if (!label) {
        result.warnings.push('Skipped missing Gmail label removal: ' + labelName);
        return;
      }

      thread.removeLabel(label);
      result.removed.push(labelName);
    });
  } catch (error) {
    result.success = false;
    result.error = error.message;
  }

  return result;
}

function dedupeLabelNames_(labelNames) {
  const seen = {};
  const deduped = [];

  (labelNames || []).forEach(function(labelName) {
    const normalized = String(labelName || '').trim();

    if (!normalized || seen[normalized]) {
      return;
    }

    seen[normalized] = true;
    deduped.push(normalized);
  });

  return deduped;
}
