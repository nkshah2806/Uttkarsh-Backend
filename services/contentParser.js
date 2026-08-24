/**
 * Quantum Parameter Content Parser & AST Engine
 * 
 * Automatically parses raw multi-line unstructured/markdown-style text
 * into a structured hierarchy of ParameterContentNodes with deterministic IDs,
 * parent-child links, node types, depth levels, and selectable flags.
 */

// Node Types
const NODE_TYPES = {
  SECTION: "section",
  HEADING: "heading",
  SUB_HEADING: "subHeading",
  BULLET: "bullet",
  SUB_BULLET: "subBullet",
  PARAGRAPH: "paragraph",
  RECOMMENDATION: "recommendation",
  PRECAUTION: "precaution",
  OBSERVATION: "observation",
  RISK: "risk",
  BENEFIT: "benefit",
  DIET: "diet",
  NOTE: "note",
};

/**
 * Normalizes text lines and trims whitespace
 */
function cleanLine(line) {
  return line.replace(/[\r\t]+/g, " ").trim();
}

/**
 * Determine category tag from text / heading keywords
 */
function inferCategoryTag(title) {
  const upper = (title || "").toUpperCase();
  if (
    upper.includes("PROBLEM") ||
    upper.includes("ISSUE") ||
    upper.includes("FINDING") ||
    upper.includes("OBSERVATION") ||
    upper.includes("SYMPTOM") ||
    upper.includes("लक्षण") ||
    upper.includes("समस्या")
  ) {
    return "PROBLEM";
  }
  if (
    upper.includes("CAUSE") ||
    upper.includes("FACTOR") ||
    upper.includes("REASON") ||
    upper.includes("ETIOLOGY") ||
    upper.includes("कारण") ||
    upper.includes("हेतु")
  ) {
    return "CAUSE";
  }
  if (
    upper.includes("PRECAUTION") ||
    upper.includes("WARNING") ||
    upper.includes("RISK") ||
    upper.includes("सावधानी") ||
    upper.includes("चेतावनी")
  ) {
    return "PRECAUTION";
  }
  if (
    upper.includes("YOGA") ||
    upper.includes("PRANAYAM") ||
    upper.includes("ASANA") ||
    upper.includes("EXERCISE") ||
    upper.includes("योग") ||
    upper.includes("प्राणायाम") ||
    upper.includes("आसन")
  ) {
    return "YOGA";
  }
  if (
    upper.includes("PATHYA") ||
    upper.includes("DO'S") ||
    upper.includes("DOS") ||
    upper.includes("RECOMMEND") ||
    upper.includes("EAT") ||
    upper.includes("पथ्य") ||
    upper.includes("क्या खाएं")
  ) {
    return "PATHYA";
  }
  if (
    upper.includes("APATHYA") ||
    upper.includes("PARHEJ") ||
    upper.includes("DON'T") ||
    upper.includes("DONTS") ||
    upper.includes("AVOID") ||
    upper.includes("अपथ्य") ||
    upper.includes("परहेज") ||
    upper.includes("क्या न खाएं")
  ) {
    return "PARHEJ";
  }
  if (
    upper.includes("AYURVED") ||
    upper.includes("SOLUTION") ||
    upper.includes("REMEDY") ||
    upper.includes("MEDICINE") ||
    upper.includes("HERB") ||
    upper.includes("AUSHADH") ||
    upper.includes("SUPPLEMENT") ||
    upper.includes("उपचार") ||
    upper.includes("औषध") ||
    upper.includes("समाधान")
  ) {
    return "MEDICINE";
  }
  if (
    upper.includes("DIET") ||
    upper.includes("AAHAR") ||
    upper.includes("LIFESTYLE") ||
    upper.includes("MEAL") ||
    upper.includes("आहार") ||
    upper.includes("दिनचर्या")
  ) {
    return "DIET";
  }
  if (
    upper.includes("DEFINITION") ||
    upper.includes("OVERVIEW") ||
    upper.includes("INTRODUCTION") ||
    upper.includes("REPORT") ||
    upper.includes("अवलोकन")
  ) {
    return "REPORT";
  }
  return "GENERAL";
}

/**
 * Identifies if a line is a section or heading
 */
function checkHeading(line, indent) {
  // 1. Markdown headings: # Heading, ## Section, ### Sub-heading
  const mdMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (mdMatch) {
    const level = mdMatch[1].length;
    return {
      isHeading: true,
      text: mdMatch[2].trim(),
      level: level === 1 ? 0 : level === 2 ? 0 : 1,
      type: level <= 2 ? NODE_TYPES.SECTION : NODE_TYPES.SUB_HEADING,
    };
  }

  // 2. Numbered Section headings: e.g. "1. Definition", "2. Possible Factors", "Section 1: Overview"
  const numberedMatch = line.match(/^(\d+|[IVXLCDM]+|[A-Z])[\.\:\)]\s+([A-Z0-9\s\/\-\(\)\,\&]{3,})$/i);
  if (numberedMatch && indent === 0) {
    const title = numberedMatch[2].trim();
    // Verify it doesn't look like a long sentence / bullet
    if (title.length < 80 && !title.endsWith(".")) {
      return {
        isHeading: true,
        text: `${numberedMatch[1]}. ${title}`,
        level: 0,
        type: NODE_TYPES.SECTION,
      };
    }
  }

  // 3. Explicit section header with colon: "Definition:", "Possible Factors:", "Recommendations:"
  const colonMatch = line.match(/^([A-Za-z0-9\s\/\-\(\)\,\&]{3,40})\:$/);
  if (colonMatch && indent === 0) {
    return {
      isHeading: true,
      text: colonMatch[1].trim(),
      level: 0,
      type: NODE_TYPES.SECTION,
    };
  }

  // 4. All-Caps Title line (e.g. "DEFINITION", "POSSIBLE FACTORS", "AYURVEDIC RECOMMENDATIONS")
  const words = line.split(/\s+/);
  const isAllUpper = line === line.toUpperCase() && words.length <= 6 && line.length >= 3 && line.length < 60 && !/[0-9\.\,\;\:]$/.test(line);
  if (isAllUpper && indent === 0 && !line.startsWith("-") && !line.startsWith("*")) {
    return {
      isHeading: true,
      text: line.trim(),
      level: 0,
      type: NODE_TYPES.SECTION,
    };
  }

  return { isHeading: false };
}

/**
 * Identifies bullet and sub-bullet items
 */
function checkBullet(rawLine) {
  const leadingSpaces = rawLine.match(/^(\s*)/)[1].length;
  const isIndented = leadingSpaces >= 2;
  const trimmed = rawLine.trim();

  // Standard bullet prefixes: *, -, +, •, ⁃, ▪, ▫, →, ✔, ✓
  const bulletSymbolMatch = trimmed.match(/^[\*\-\+\•\⁃\▪\▫\→\✔\✓]\s+(.+)$/);
  if (bulletSymbolMatch) {
    return {
      isBullet: true,
      text: bulletSymbolMatch[1].trim(),
      isSubBullet: isIndented,
      level: isIndented ? 2 : 1,
    };
  }

  // Sub-numbered bullets: e.g. "1.1 Item", "a) Item", "i. Item", "1) Item"
  const subNumMatch = trimmed.match(/^(\d+\.\d+|[a-z]\)|\([a-z]\)|[ivx]+\.|\d+\))\s+(.+)$/i);
  if (subNumMatch) {
    return {
      isBullet: true,
      text: subNumMatch[2].trim(),
      prefix: subNumMatch[1],
      isSubBullet: true,
      level: 2,
    };
  }

  // Standard numbered bullet: e.g. "1. High viscosity may affect blood flow."
  const numBulletMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
  if (numBulletMatch) {
    return {
      isBullet: true,
      text: numBulletMatch[2].trim(),
      prefix: numBulletMatch[1],
      isSubBullet: isIndented,
      level: isIndented ? 2 : 1,
    };
  }

  return {
    isBullet: false,
    text: trimmed,
    isIndented,
  };
}

/**
 * Parse raw multi-line content into structured AST nodes
 * 
 * @param {string} rawContent - The multi-line text pasted by Admin
 * @param {string} [language='en'] - 'en' or 'hi'
 * @returns {Array<Object>} Array of ParameterContentNode objects
 */
function parseContent(rawContent, language = "en") {
  if (!rawContent || typeof rawContent !== "string") {
    return [];
  }

  const rawLines = rawContent.split(/\r?\n/);
  const nodes = [];

  let currentSectionId = null;
  let currentSectionTitle = "General Findings";
  let currentSectionCategory = "REPORT";
  let currentParentId = null;
  let sectionIndex = 0;
  let itemCounter = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const cleaned = cleanLine(rawLine);
    if (!cleaned) continue; // Skip empty lines

    const leadingSpaces = (rawLine.match(/^(\s*)/) || ["", ""])[1].length;
    const headingCheck = checkHeading(cleaned, leadingSpaces);

    if (headingCheck.isHeading) {
      sectionIndex++;
      const secId = `sec_${sectionIndex}`;
      currentSectionId = secId;
      currentSectionTitle = headingCheck.text;
      currentSectionCategory = inferCategoryTag(headingCheck.text);
      currentParentId = secId;

      nodes.push({
        id: secId,
        parentId: null,
        nodeType: headingCheck.type || NODE_TYPES.SECTION,
        content: headingCheck.text,
        orderIndex: nodes.length + 1,
        level: 0,
        isSelectable: false, // Section header itself acts as a group selector
        categoryType: currentSectionCategory,
        childrenCount: 0,
      });
      continue;
    }

    // It's a bullet or paragraph
    const bulletCheck = checkBullet(rawLine);
    itemCounter++;

    // If no section has been defined yet, create a default "Overview" section
    if (!currentSectionId) {
      sectionIndex++;
      currentSectionId = `sec_${sectionIndex}`;
      currentSectionTitle = language === "hi" ? "अवलोकन" : "Overview";
      currentSectionCategory = "REPORT";
      currentParentId = currentSectionId;

      nodes.push({
        id: currentSectionId,
        parentId: null,
        nodeType: NODE_TYPES.SECTION,
        content: currentSectionTitle,
        orderIndex: nodes.length + 1,
        level: 0,
        isSelectable: false,
        categoryType: currentSectionCategory,
        childrenCount: 0,
      });
    }

    const parentSec = nodes.find((n) => n.id === currentSectionId);
    if (parentSec) {
      parentSec.childrenCount = (parentSec.childrenCount || 0) + 1;
    }

    if (bulletCheck.isBullet) {
      const isSub = bulletCheck.isSubBullet || bulletCheck.level === 2;
      const nodeId = `node_${sectionIndex}_${itemCounter}`;

      let nodeType = isSub ? NODE_TYPES.SUB_BULLET : NODE_TYPES.BULLET;
      // Refine node type based on section category
      if (currentSectionCategory === "PRECAUTION") nodeType = NODE_TYPES.PRECAUTION;
      else if (currentSectionCategory === "PATHYA" || currentSectionCategory === "PARHEJ" || currentSectionCategory === "DIET") nodeType = NODE_TYPES.DIET;
      else if (currentSectionCategory === "MEDICINE") nodeType = NODE_TYPES.RECOMMENDATION;

      nodes.push({
        id: nodeId,
        parentId: currentParentId,
        nodeType: isSub ? NODE_TYPES.SUB_BULLET : nodeType,
        content: bulletCheck.text,
        orderIndex: nodes.length + 1,
        level: isSub ? 2 : 1,
        isSelectable: true,
        defaultSelected: true,
        categoryType: currentSectionCategory,
      });
    } else {
      // Paragraph line under current section
      const nodeId = `para_${sectionIndex}_${itemCounter}`;
      nodes.push({
        id: nodeId,
        parentId: currentParentId,
        nodeType: NODE_TYPES.PARAGRAPH,
        content: cleaned,
        orderIndex: nodes.length + 1,
        level: 1,
        isSelectable: true,
        defaultSelected: true,
        categoryType: currentSectionCategory,
      });
    }
  }

  return nodes;
}

/**
 * Validate raw content formatting and provide helpful feedback
 */
function validateContent(rawContent) {
  const diagnostics = {
    isValid: true,
    totalLines: 0,
    sectionsCount: 0,
    bulletsCount: 0,
    subBulletsCount: 0,
    paragraphsCount: 0,
    warnings: [],
    errors: [],
  };

  if (!rawContent || !rawContent.trim()) {
    diagnostics.isValid = false;
    diagnostics.errors.push("Content is empty. Please enter or paste parameter content.");
    return diagnostics;
  }

  const nodes = parseContent(rawContent);
  diagnostics.totalLines = rawContent.split(/\r?\n/).filter((l) => l.trim()).length;
  diagnostics.sectionsCount = nodes.filter((n) => n.nodeType === NODE_TYPES.SECTION || n.level === 0).length;
  diagnostics.bulletsCount = nodes.filter((n) => n.level === 1 && n.isSelectable).length;
  diagnostics.subBulletsCount = nodes.filter((n) => n.level === 2 && n.isSelectable).length;
  diagnostics.paragraphsCount = nodes.filter((n) => n.nodeType === NODE_TYPES.PARAGRAPH).length;

  if (diagnostics.sectionsCount === 0 && diagnostics.bulletsCount === 0) {
    diagnostics.isValid = false;
    diagnostics.errors.push("Could not identify any structured sections or bullet points.");
  }

  if (diagnostics.sectionsCount > 0 && diagnostics.bulletsCount === 0 && diagnostics.paragraphsCount === 0) {
    diagnostics.warnings.push("Only headings were detected. Consider adding bullet points under each heading.");
  }

  // Check for duplicate lines
  const textSet = new Set();
  nodes.forEach((n) => {
    if (n.isSelectable) {
      const lower = n.content.toLowerCase();
      if (textSet.has(lower)) {
        diagnostics.warnings.push(`Duplicate item detected: "${n.content.slice(0, 40)}..."`);
      } else {
        textSet.add(lower);
      }
    }
  });

  return { ...diagnostics, nodes };
}

module.exports = {
  NODE_TYPES,
  parseContent,
  validateContent,
  inferCategoryTag,
};
