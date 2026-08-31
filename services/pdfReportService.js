const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const MemberProfile = require("../models/MemberProfile");
const Disclaimer = require("../models/Disclaimer");
const SiteSettings = require("../models/SiteSettings");
const { generateAutoAnalysis } = require("./analysisEngine");

/**
 * Format a Date object or ISO string to DD/MM/YYYY format
 */
const formatDDMMYYYY = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Escape HTML special characters for safe output
 */
const escapeHTML = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Generate full HTML Report for a Visit
 */
exports.generateReportHTML = async (visitId, lang = "en", options = {}) => {
  const visit = await Visit.findById(visitId)
    .populate({
      path: "patient_id",
      populate: { path: "registered_by" },
    })
    .populate("consultant_id");

  if (!visit) throw new Error("Visit not found");

  const patient = visit.patient_id;
  const registeredBy = patient?.registered_by;

  // Next visit date from options, visit document, or snapshot
  const nextVisitDateRaw =
    options.next_visit_date !== undefined
      ? options.next_visit_date
      : visit.next_visit_date || visit.report_snapshot?.next_visit_date;

  const formattedNextVisitDate = formatDDMMYYYY(nextVisitDateRaw);

  // Update next_visit_date on visit if passed in options
  if (options.next_visit_date !== undefined) {
    visit.next_visit_date = options.next_visit_date ? new Date(options.next_visit_date) : null;
  }

  // Fetch Member Profile / Franchise info
  let memberProfile = null;
  if (registeredBy && registeredBy._id) {
    memberProfile = await MemberProfile.findOne({ user: registeredBy._id });
  }
  // Fetch SiteSettings for global branding fallback if needed
  const siteSettings = await SiteSettings.findOne({ key: "default_settings" });

  const franchise = {
    name:
      memberProfile?.store_name ||
      memberProfile?.member_name ||
      registeredBy?.fullName ||
      "",
    phone:
      memberProfile?.phone ||
      registeredBy?.phoneNumber ||
      registeredBy?.mobileNumber ||
      siteSettings?.footer?.phone ||
      "",
    email:
      registeredBy?.email ||
      siteSettings?.footer?.email ||
      "",
    address:
      memberProfile?.address ||
      (memberProfile?.city ? `${memberProfile.city}, ${memberProfile.state}` : "") ||
      siteSettings?.footer?.address ||
      "",
    logo_url: memberProfile?.store_logo || memberProfile?.logo_url || "",
  };

  const consultant = visit.consultant_id || {
    fullName: registeredBy?.fullName || "Wellness Consultant",
    email: registeredBy?.email || "",
  };

  // Fetch Active Disclaimer or fallback to visit snapshot or default
  let disclaimer = null;
  const activeDisclaimerDoc = await Disclaimer.findOne({ is_active: true });

  if (activeDisclaimerDoc) {
    disclaimer = {
      _id: activeDisclaimerDoc._id,
      title: activeDisclaimerDoc.title,
      content: activeDisclaimerDoc.content,
      content_hi: activeDisclaimerDoc.content_hi,
    };
  } else if (visit.report_snapshot?.disclaimer?.content) {
    disclaimer = visit.report_snapshot.disclaimer;
  } else {
    disclaimer = {
      title: "",
      content: "",
      content_hi: "",
    };
  }

  const isHindi = lang === "hi";

  const labels = {
    title: isHindi
      ? "क्वांटम रेज़ोनेंस वेलनेस मूल्यांकन रिपोर्ट"
      : "QUANTUM RESONANCE WELLNESS ASSESSMENT REPORT",
    patientInfo: isHindi ? "रोगी जनसांख्यिकी एवं विवरण" : "Patient Demographics & Vitals",
    patientCode: isHindi ? "क्लाइंट आईडी / कोड" : "Client ID",
    name: isHindi ? "रोगी का नाम" : "Full Name",
    ageGender: isHindi ? "आयु / लिंग" : "Age / Gender",
    mobile: isHindi ? "मोबाइल नंबर" : "Mobile Phone",
    weightHeight: isHindi ? "वजन / ऊंचाई" : "Weight / Height",
    address: isHindi ? "पता" : "Address",
    date: isHindi ? "जांच दिनांक" : "Scan Date",
    consultant: isHindi ? "वेलनेस परामर्शदाता" : "Wellness Consultant",
    summary: isHindi ? "ध्यान देने योग्य वेलनेस मापदंड" : "Wellness Parameters Requiring Attention",
    parameter: isHindi ? "मापदंड विवरण" : "Parameter Evaluated",
    value: isHindi ? "प्राप्त मान" : "Observed Value",
    range: isHindi ? "संदर्भ सीमा*" : "Reference Range*",
    status: isHindi ? "मूल्यांकन स्थिति" : "Assessment Status",
    detailedAnalysis: isHindi
      ? "चयनित वेलनेस सूचना एवं आयुर्वेदिक जीवनशैली मार्गदर्शन"
      : "Selected Wellness Information & Ayurvedic Lifestyle Guidance",
    nextVisitTitle: isHindi ? "सुझाई गई वेलनेस पुनर्मूल्यांकन तिथि" : "Suggested Wellness Reassessment Date",
    nextVisitLabel: isHindi ? "Suggested Wellness Reassessment Date" : "Suggested Wellness Reassessment Date",
    disclaimerHeading: isHindi ? "अस्वीकरण (Disclaimer)" : "Disclaimer",
    footerNote: isHindi
      ? "उत्कर्ष क्वांटम वेलनेस प्रणाली द्वारा तैयार गोपनीय वेलनेस मूल्यांकन रिपोर्ट।"
      : "Confidential Wellness Assessment Report · Generated by Utkarsh Quantum Resonance System",
    page: isHindi ? "पृष्ठ" : "Page",
  };

  // Get auto analysis with current selection states
  const autoAnalysis = await generateAutoAnalysis(visitId);
  const abnormalResults = autoAnalysis.analyzed_items || [];

  // Filter sections and items to ONLY those where is_selected === true
  const filteredParameters = abnormalResults
    .map((item) => {
      const validSections = (item.sections || [])
        .map((sec) => {
          const selectedItems = (sec.items || []).filter((it) => it.is_selected === true);
          return {
            ...sec,
            items: selectedItems,
          };
        })
        .filter((sec) => sec.items.length > 0);

      return {
        parameter: item.parameter,
        raw_value: item.raw_value,
        result_type: item.result_type,
        sections: validSections,
      };
    })
    .filter((p) => p.sections.length > 0);

  // Format disclaimer paragraphs
  const rawDisclaimerText = isHindi && disclaimer.content_hi
    ? disclaimer.content_hi
    : disclaimer.content || "";

  const disclaimerParagraphs = rawDisclaimerText
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean);

  const formattedScanDate = formatDDMMYYYY(visit.visit_date || visit.createdAt);

  const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(labels.title)} - ${escapeHTML(patient?.name || "Patient")}</title>
  <style>
    @page {
      size: A4;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.45;
      font-size: 12px;
    }

    /* Print-specific controls: consistent page margins, no browser header/footer whitespace */
    @media print {
      @page {
        size: A4;
        margin: 10mm 12mm 12mm 12mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      h1, h2, h3, h4, .section-heading, .guidance-section-title, .param-header {
        page-break-after: avoid;
        break-after: avoid;
      }
      .bullet-list li {
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
      }
      .disclaimer-page {
        page-break-before: always;
        break-before: page;
      }
    }

    /* Professional Top Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #4338ca;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo-seal {
      width: 52px;
      height: 52px;
      border-radius: 10px;
      background: linear-gradient(135deg, #4338ca, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 900;
      font-size: 22px;
      letter-spacing: -1px;
      box-shadow: 0 2px 6px rgba(67, 56, 202, 0.25);
      flex-shrink: 0;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 700;
      color: #312e81;
      letter-spacing: -0.3px;
      margin: 0;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 3px;
      font-weight: 500;
    }
    .brand-contact {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
    }
    .report-main-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e1b4b;
      margin: 0;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .report-badge {
      display: inline-block;
      margin-top: 3px;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #3730a3;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }
    .report-ref {
      font-size: 10px;
      color: #64748b;
      margin-top: 3px;
      font-family: monospace;
    }

    /* Patient Demographics Card */
    .patient-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .patient-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 16px;
      font-size: 11.5px;
    }
    .field-label {
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      margin-bottom: 1px;
    }
    .field-val {
      font-weight: 600;
      color: #1e293b;
    }
    .field-val-highlight {
      color: #4338ca;
      font-family: monospace;
      font-weight: 700;
    }

    /* Summary Table */
    .section-heading {
      font-size: 12.5px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      page-break-after: avoid;
      break-after: avoid;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    .summary-table thead {
      display: table-header-group;
    }
    .summary-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .summary-table th {
      background: #eef2ff;
      color: #312e81;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #c7d2fe;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.4px;
    }
    .summary-table td {
      padding: 6.5px 10px;
      border: 1px solid #e2e8f0;
    }
    .summary-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 9.5px;
      letter-spacing: 0.3px;
    }
    .badge-HIGH { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .badge-LOW { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-NORMAL { background: #dcfce7; color: #166534; border: 1px solid #86efac; }

    /* Detailed Parameter Analysis Block */
    .param-block {
      margin-bottom: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      /* Let large blocks flow across pages to avoid big blank gaps */
      page-break-inside: auto;
      break-inside: auto;
    }
    .param-header {
      background: #f1f5f9;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
      break-after: avoid;
    }
    .param-body {
      padding: 8px 14px 4px;
    }
    .param-body .guidance-section-title {
      margin-top: 6px;
    }
    .param-body .bullet-list:last-child {
      margin-bottom: 8px;
    }
    @media print {
      /* Keep header attached to its content and keep each section title with its list */
      .param-header {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .guidance-section-title {
        page-break-after: avoid;
        break-after: avoid;
      }
      .guidance-section-title + .bullet-list {
        page-break-before: avoid;
        break-before: avoid;
      }
    }
    .param-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #1e293b;
    }
    .param-code-pill {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      color: #4338ca;
      background: #e0e7ff;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 6px;
    }
    .guidance-section-title {
      font-size: 11px;
      font-weight: 700;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-top: 8px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .guidance-section-title:first-child {
      margin-top: 0;
    }
    .bullet-list {
      margin: 0 0 8px 16px;
      padding: 0;
    }
    .bullet-list li {
      margin-bottom: 3.5px;
      color: #334155;
      line-height: 1.4;
      font-size: 11.5px;
    }

    /* Suggested Wellness Reassessment Date Banner */
    .next-visit-box {
      margin: 18px 0;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f5f3ff, #ede9fe);
      border: 1.5px solid #c4b5fd;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }
    .next-visit-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .next-visit-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #6d28d9;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: bold;
    }
    .next-visit-label {
      font-size: 11px;
      font-weight: 700;
      color: #5b21b6;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .next-visit-subtext {
      font-size: 10px;
      color: #6d28d9;
      margin-top: 2px;
    }
    .next-visit-value {
      font-size: 14px;
      font-weight: 800;
      color: #4c1d95;
      background: #ffffff;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid #ddd6fe;
      letter-spacing: 0.3px;
    }

    /* Dedicated Disclaimer Page */
    .disclaimer-page {
      page-break-before: always;
      padding-top: 8px;
    }
    .disclaimer-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 22px 26px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .disclaimer-header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fee2e2;
      color: #991b1b;
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 10px;
      border-radius: 9999px;
      border: 1px solid #fecaca;
      margin-bottom: 12px;
    }
    .disclaimer-heading {
      font-size: 18px;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 8px 0;
      letter-spacing: -0.2px;
    }
    .disclaimer-title-sub {
      font-size: 12.5px;
      font-weight: 700;
      color: #4338ca;
      margin-bottom: 16px;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .disclaimer-body {
      font-size: 11px;
      line-height: 1.6;
      color: #334155;
    }
    .disclaimer-paragraph {
      margin-bottom: 12px;
      text-align: justify;
      white-space: pre-line;
    }
    .disclaimer-signature-row {
      margin-top: 30px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10.5px;
      color: #64748b;
    }
    .signature-line {
      width: 180px;
      border-top: 1px solid #94a3b8;
      text-align: center;
      padding-top: 4px;
      font-weight: 600;
      color: #334155;
    }

    /* Page Footer */
    .report-footer {
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- ==================== REPORT MAIN BODY ==================== -->

  <!-- Top Professional Header -->
  <div class="report-header">
    <div class="header-brand">
      ${franchise.logo_url
      ? `<img src="${franchise.logo_url}" alt="Logo" style="height: 48px; max-width: 120px; object-fit: contain;" />`
      : `<div class="brand-logo-seal">UQ</div>`
    }
      <div>
        <h1 class="brand-title">${escapeHTML(franchise.name)}</h1>
        <div class="brand-contact">
          ${escapeHTML(franchise.address)}
        </div>
        <div class="brand-contact">
          ${franchise.phone ? 'Tel: ' + escapeHTML(franchise.phone) : ''}
        </div>
      </div>
    </div>
    <div class="header-meta">
      <div class="report-main-title">${escapeHTML(labels.title)}</div>
      <div class="report-badge">SESSION RECORD</div>
      <div class="report-ref">${labels.date}: ${formattedScanDate}</div>
    </div>
  </div>

  <!-- Patient Demographics & Consultation Block -->
  <div class="patient-card">
    <div class="patient-grid">
      <div>
        <div class="field-label">${escapeHTML(labels.patientCode)}</div>
        <div class="field-val field-val-highlight">${escapeHTML(patient?.patient_code || '-')}</div>
      </div>
      <div>
        <div class="field-label">${escapeHTML(labels.name)}</div>
        <div class="field-val">${escapeHTML(patient?.name || '-')}</div>
      </div>
      <div>
        <div class="field-label">${escapeHTML(labels.ageGender)}</div>
        <div class="field-val">${escapeHTML(patient?.age || '-')} Yrs / ${escapeHTML(patient?.gender || '-')}</div>
      </div>
      <div>
        <div class="field-label">${escapeHTML(labels.mobile)}</div>
        <div class="field-val">${escapeHTML(patient?.mobile || '-')}</div>
      </div>
      <div>
        <div class="field-label">${escapeHTML(labels.weightHeight)}</div>
        <div class="field-val">
          ${patient?.weight ? patient.weight + ' ' + (patient.weight_unit || 'kg') : '-'} / 
          ${patient?.height ? patient.height + ' ' + (patient.height_unit || 'cm') : '-'}
        </div>
      </div>
      <div>
        <div class="field-label">${escapeHTML(labels.consultant)}</div>
        <div class="field-val">${escapeHTML(consultant?.fullName || 'Wellness Consultant')}</div>
      </div>
    </div>
  </div>

  <!-- Wellness Parameters Requiring Attention Table -->
  <div class="section-heading">
    <span>${escapeHTML(labels.summary)} (${abnormalResults.length})</span>
    <span style="font-size: 10px; color: #64748b; font-weight: 500;">System-Generated Assessment Values</span>
  </div>
  <table class="summary-table">
    <thead>
      <tr>
        <th style="width: 42%;">${escapeHTML(labels.parameter)}</th>
        <th style="width: 18%;">${escapeHTML(labels.value)}</th>
        <th style="width: 24%;">${escapeHTML(labels.range)}</th>
        <th style="width: 16%; text-align: center;">${escapeHTML(labels.status)}</th>
      </tr>
    </thead>
    <tbody>
      ${abnormalResults.length === 0
      ? `<tr><td colspan="4" style="text-align: center; color: #166534; padding: 14px; font-weight: 600; background: #f0fdf4;">All evaluated cellular parameters are within standard baseline physiological ranges.</td></tr>`
      : abnormalResults
        .map(
          (r) => `
        <tr>
          <td>
            <span class="param-code-pill">${escapeHTML(r.parameter.code)}</span>
            <strong>${escapeHTML(isHindi ? r.parameter.name_hi || r.parameter.name_en : r.parameter.name_en)}</strong>
          </td>
          <td><strong>${r.raw_value}</strong> ${escapeHTML(r.parameter.unit || '')}</td>
          <td>${r.parameter.normal_min} – ${r.parameter.normal_max} ${escapeHTML(r.parameter.unit || '')}</td>
          <td style="text-align: center;">
            <span class="badge badge-${r.result_type}">${r.result_type}</span>
          </td>
        </tr>
      `
        )
        .join("")
    }
    </tbody>
  </table>

  <!-- Detailed Wellness & Ayurvedic Guidance Sections (Selected Content Only) -->
  ${filteredParameters.length > 0
      ? `<div style="font-weight: 700; font-size: 13px; color: #1e293b; margin: 20px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">
          ${escapeHTML(labels.detailedAnalysis)}
        </div>`
      : ""
    }

  ${filteredParameters
      .map((item) => {
        const p = item.parameter;
        return `
      <div class="param-block">
        <div class="param-header">
          <div>
            <span class="param-code-pill">${escapeHTML(p.code)}</span>
            <span class="param-name">${escapeHTML(isHindi ? p.name_hi || p.name_en : p.name_en)}</span>
            <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">(${escapeHTML(p.category || 'General')})</span>
          </div>
          <div>
            <span class="badge badge-${item.result_type}">${item.result_type} · ${item.raw_value} ${escapeHTML(p.unit || '')}</span>
          </div>
        </div>
        <div class="param-body">
          ${item.sections
            .map((sec) => `
              <div class="guidance-section-title">
                <span>▸</span> ${escapeHTML(isHindi ? sec.title_hi || sec.title_en : sec.title_en)}
              </div>
              <ul class="bullet-list">
                ${sec.items
                .map(
                  (bullet) => `
                  <li style="${bullet.level > 1 ? 'margin-left: 14px; list-style-type: circle;' : ''}">
                    ${escapeHTML(isHindi ? bullet.text_hi || bullet.text_en : bullet.text_en)}
                  </li>
                `
                )
                .join("")}
              </ul>
            `)
            .join("")}
        </div>
      </div>
    `;
      })
      .join("")}

  <!-- Suggested Wellness Reassessment Date Section (Only if date is provided) -->
  ${formattedNextVisitDate
      ? `
    <div class="next-visit-box">
      <div class="next-visit-left">
        <div class="next-visit-icon">📅</div>
        <div>
          <div class="next-visit-label">${escapeHTML(labels.nextVisitTitle)}:</div>
          <div class="next-visit-subtext">Please schedule your wellness reassessment on or before this date.</div>
        </div>
      </div>
      <div>
        <span class="next-visit-value">${formattedNextVisitDate}</span>
      </div>
    </div>
  `
      : ""
    }

  <!-- Main Report Page Footer -->
  <div class="report-footer">
    <div>${escapeHTML(labels.footerNote)}</div>
    <div>Visit Ref: #${visitId.toString().slice(-6).toUpperCase()}</div>
  </div>


  <!-- ==================== DEDICATED DISCLAIMER PAGE ==================== -->
  <div class="disclaimer-page">
    
    <!-- Disclaimer Page Header -->
    <div class="report-header" style="margin-bottom: 20px;">
      <div class="header-brand">
        ${franchise.logo_url
      ? `<img src="${franchise.logo_url}" alt="Logo" style="height: 40px; max-width: 100px; object-fit: contain;" />`
      : `<div class="brand-logo-seal" style="width: 44px; height: 44px; font-size: 18px;">UQ</div>`
    }
        <div>
          <h2 class="brand-title" style="font-size: 15px;">${escapeHTML(franchise.name)}</h2>
        </div>
      </div>
      <div class="header-meta">
        <div class="report-badge" style="background: #fee2e2; color: #991b1b;">LEGAL & MEDICAL NOTICE</div>
        <div class="report-ref">Client ID: ${escapeHTML(patient?.patient_code || '-')}</div>
      </div>
    </div>

    <!-- Disclaimer Content Card -->
    <div class="disclaimer-card">
      <div class="disclaimer-header-badge">
        <span>⚠</span> ${escapeHTML(labels.disclaimerHeading)}
      </div>
      <h2 class="disclaimer-heading">${escapeHTML(labels.disclaimerHeading)}</h2>
      <div class="disclaimer-title-sub">${escapeHTML(disclaimer.title || "")}</div>

      <div class="disclaimer-body">
        ${disclaimerParagraphs
      .map((para) => `<p class="disclaimer-paragraph">${escapeHTML(para)}</p>`)
      .join("")}
      </div>

      <!-- Signature and Verification Seal Row -->
      <div class="disclaimer-signature-row">
        <div>
          <div><strong>Wellness Assessment Center:</strong> ${escapeHTML(franchise.name)}</div>
          <div><strong>Wellness Consultant:</strong> ${escapeHTML(consultant?.fullName || "Wellness Consultant")}</div>
          <div><strong>Verification Code:</strong> ${visitId.toString().slice(-8).toUpperCase()}</div>
        </div>
        <div class="signature-line">
          Authorized Signatory / Stamp
        </div>
      </div>
    </div>

    <!-- Final Disclaimer Page Footer -->
    <div class="report-footer" style="margin-top: 24px;">
      <div>${escapeHTML(labels.footerNote)}</div>
      <div>Visit Ref: #${visitId.toString().slice(-6).toUpperCase()} · Final Page</div>
    </div>

  </div>

</body>
</html>
  `;

  // Persist updated snapshot & next_visit_date to visit document
  await Visit.findByIdAndUpdate(visitId, {
    next_visit_date: visit.next_visit_date,
    disclaimer_id: disclaimer._id || null,
    report_snapshot: {
      finalized_at: new Date(),
      language: lang,
      parameters: filteredParameters,
      next_visit_date: visit.next_visit_date,
      disclaimer: {
        title: disclaimer.title,
        content: disclaimer.content,
        content_hi: disclaimer.content_hi || "",
      },
      report_html: html,
    },
  });

  return html;
};
