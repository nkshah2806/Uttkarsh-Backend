const VisitParameterResult = require("../models/VisitParameterResult");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const Parameter = require("../models/Parameter");

/**
 * Analyzes visit results, computes auto-selected Ayurvedic content based on priority,
 * and merges any explicit consultant selection overrides.
 */
exports.generateAutoAnalysis = async (visitId) => {
  // 1. Fetch all parameter results for this visit
  const results = await VisitParameterResult.find({ visit_id: visitId }).populate(
    "parameter_id"
  );

  const abnormalResults = results.filter(
    (r) => r.result_type === "LOW" || r.result_type === "HIGH"
  );

  const abnormalParamIds = abnormalResults.map((r) => r.parameter_id._id);

  // 2. Fetch all candidate master content items for these abnormal parameters
  const candidateContents = await ParameterMasterContent.find({
    parameter_id: { $in: abnormalParamIds },
    is_active: true,
  }).sort({ priority: 1, createdAt: 1 });

  // 3. Fetch existing consultant selection overrides for this visit
  const existingSelections = await VisitSelectedContent.find({ visit_id: visitId });
  const selectionMap = new Map();
  existingSelections.forEach((s) => {
    selectionMap.set(s.parameter_master_content_id.toString(), s.is_selected);
  });

  // 4. Map candidate content per parameter and content type
  const contentTypes = [
    "REPORT",
    "PROBLEM",
    "CAUSE",
    "PRECAUTION",
    "PATHYA",
    "PARHEJ",
    "MEDICINE",
    "DIET",
  ];

  const analyzedItems = [];

  for (const resItem of abnormalResults) {
    const param = resItem.parameter_id;
    const matchingCandidates = candidateContents.filter(
      (c) =>
        c.parameter_id.toString() === param._id.toString() &&
        c.result_type === resItem.result_type
    );

    const categorizedContent = {};
    contentTypes.forEach((cType) => {
      const typeCandidates = matchingCandidates.filter((c) => c.content_type === cType);
      
      categorizedContent[cType] = typeCandidates.map((c, index) => {
        const cIdStr = c._id.toString();
        // Priority auto-select: auto check top 2 items unless overridden by consultant
        let isSelected = index < 2;
        if (selectionMap.has(cIdStr)) {
          isSelected = selectionMap.get(cIdStr);
        }

        return {
          id: c._id,
          text_en: c.text_en,
          text_hi: c.text_hi,
          priority: c.priority,
          content_type: c.content_type,
          is_selected: isSelected,
        };
      });
    });

    analyzedItems.push({
      parameter: {
        id: param._id,
        code: param.code,
        name_en: param.name_en,
        name_hi: param.name_hi,
        unit: param.unit,
        normal_min: param.normal_min,
        normal_max: param.normal_max,
        category: param.category,
      },
      raw_value: resItem.raw_value,
      result_type: resItem.result_type,
      content: categorizedContent,
    });
  }

  return {
    visit_id: visitId,
    total_parameters: results.length,
    normal_count: results.length - abnormalResults.length,
    abnormal_count: abnormalResults.length,
    analyzed_items: analyzedItems,
  };
};
