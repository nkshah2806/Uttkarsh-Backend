const VisitParameterResult = require("../models/VisitParameterResult");
const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const VisitSelectedContent = require("../models/VisitSelectedContent");

/**
 * Analyzes visit results, computes candidate content items from both
 * the new AST parsed nodes and legacy Master Content, and merges consultant overrides.
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

  // 2. Fetch legacy candidate contents for fallback compatibility
  const candidateContents = await ParameterMasterContent.find({
    parameter_id: { $in: abnormalParamIds },
    is_active: true,
  }).sort({ priority: 1, createdAt: 1 });

  // 3. Fetch existing consultant selection overrides for this visit
  const existingSelections = await VisitSelectedContent.find({ visit_id: visitId });
  const selectionMap = new Map();
  existingSelections.forEach((s) => {
    if (s.node_id && s.parameter_id) {
      selectionMap.set(`${s.parameter_id.toString()}_${s.node_id}`, s.is_selected);
    } else if (s.node_id) {
      selectionMap.set(s.node_id, s.is_selected);
    }

    if (s.parameter_master_content_id) {
      selectionMap.set(s.parameter_master_content_id.toString(), s.is_selected);
      if (s.parameter_id) {
        selectionMap.set(`${s.parameter_id.toString()}_${s.parameter_master_content_id.toString()}`, s.is_selected);
      }
    }
  });

  const analyzedItems = [];

  for (const resItem of abnormalResults) {
    const param = resItem.parameter_id;
    if (!param) continue;

    const paramIdStr = param._id.toString();

    // Check if new parsed_nodes exist for this parameter
    const hasParsedNodesEn = param.parsed_nodes_en && param.parsed_nodes_en.length > 0;
    const hasParsedNodesHi = param.parsed_nodes_hi && param.parsed_nodes_hi.length > 0;

    let structuredSections = [];

    if (hasParsedNodesEn || hasParsedNodesHi) {
      // Use rich hierarchical nodes
      const enNodes = param.parsed_nodes_en || [];
      const hiNodes = param.parsed_nodes_hi || [];

      // Map Hindi nodes by orderIndex or id for dual-language lookup
      const hiMap = new Map();
      hiNodes.forEach((hn) => {
        hiMap.set(hn.id, hn);
        hiMap.set(String(hn.orderIndex), hn);
      });

      // Group into sections
      let currentSection = null;

      enNodes.forEach((node) => {
        const hiEquivalent = hiMap.get(node.id) || hiMap.get(String(node.orderIndex));
        const hiText = hiEquivalent ? hiEquivalent.content : node.content;

        if (node.level === 0 || node.nodeType === "section") {
          currentSection = {
            id: node.id,
            unique_key: `${paramIdStr}_${node.id}`,
            parameter_id: paramIdStr,
            nodeType: "section",
            title_en: node.content,
            title_hi: hiText,
            categoryType: node.categoryType || "REPORT",
            orderIndex: node.orderIndex,
            items: [],
          };
          structuredSections.push(currentSection);
        } else {
          if (!currentSection) {
            currentSection = {
              id: `sec_default_${paramIdStr}`,
              unique_key: `${paramIdStr}_sec_default_${paramIdStr}`,
              parameter_id: paramIdStr,
              nodeType: "section",
              title_en: "Overview",
              title_hi: "अवलोकन",
              categoryType: "REPORT",
              orderIndex: 0,
              items: [],
            };
            structuredSections.push(currentSection);
          }

          const lookupKey1 = `${paramIdStr}_${node.id}`;
          let isSelected = node.defaultSelected !== false;
          if (selectionMap.has(lookupKey1)) {
            isSelected = selectionMap.get(lookupKey1);
          }

          currentSection.items.push({
            id: node.id,
            unique_key: `${paramIdStr}_${node.id}`,
            parameter_id: paramIdStr,
            parentId: currentSection.id,
            nodeType: node.nodeType,
            text_en: node.content,
            text_hi: hiText,
            level: node.level || 1,
            isSelectable: node.isSelectable !== false,
            categoryType: node.categoryType || currentSection.categoryType,
            orderIndex: node.orderIndex,
            is_selected: isSelected,
          });
        }
      });
    } else {
      // Legacy Fallback mapping
      const matchingCandidates = candidateContents.filter(
        (c) =>
          c.parameter_id.toString() === paramIdStr &&
          c.result_type === resItem.result_type
      );

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

      contentTypes.forEach((cType, secIdx) => {
        const typeCandidates = matchingCandidates.filter((c) => c.content_type === cType);
        if (typeCandidates.length === 0) return;

        const secId = `sec_legacy_${cType.toLowerCase()}_${paramIdStr}`;
        const secItems = typeCandidates.map((c, index) => {
          const cIdStr = c._id.toString();
          const lookupKey = `${paramIdStr}_${cIdStr}`;
          let isSelected = index < 2; // Auto-select top 2 by default
          if (selectionMap.has(lookupKey)) {
            isSelected = selectionMap.get(lookupKey);
          } else if (selectionMap.has(cIdStr)) {
            isSelected = selectionMap.get(cIdStr);
          }

          return {
            id: cIdStr,
            unique_key: `${paramIdStr}_${cIdStr}`,
            parameter_id: paramIdStr,
            parentId: secId,
            nodeType: "bullet",
            text_en: c.text_en,
            text_hi: c.text_hi,
            priority: c.priority,
            level: 1,
            isSelectable: true,
            categoryType: c.content_type,
            orderIndex: index + 1,
            is_selected: isSelected,
          };
        });

        structuredSections.push({
          id: secId,
          unique_key: `${paramIdStr}_${secId}`,
          parameter_id: paramIdStr,
          nodeType: "section",
          title_en: cType,
          title_hi: cType,
          categoryType: cType,
          orderIndex: secIdx + 1,
          items: secItems,
        });
      });
    }

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
        version: param.version || 1,
      },
      raw_value: resItem.raw_value,
      result_type: resItem.result_type,
      sections: structuredSections,
      // Retain legacy categorizedContent for older components if needed
      content: mapSectionsToLegacyContent(structuredSections),
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

function mapSectionsToLegacyContent(sections) {
  const map = {
    REPORT: [],
    PROBLEM: [],
    CAUSE: [],
    PRECAUTION: [],
    PATHYA: [],
    PARHEJ: [],
    MEDICINE: [],
    DIET: [],
  };

  sections.forEach((sec) => {
    const cat = sec.categoryType || "REPORT";
    if (!map[cat]) map[cat] = [];
    sec.items.forEach((item) => {
      map[cat].push({
        id: item.id,
        text_en: item.text_en,
        text_hi: item.text_hi,
        priority: item.priority || 1,
        content_type: cat,
        is_selected: item.is_selected,
      });
    });
  });

  return map;
}
