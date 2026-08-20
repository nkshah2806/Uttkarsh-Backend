const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const Parameter = require("../models/Parameter");
const VisitParameterResult = require("../models/VisitParameterResult");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const Report = require("../models/Report");
const { generateAutoAnalysis } = require("../services/analysisEngine");
const { generateReportHTML } = require("../services/pdfReportService");

// @desc Create a visit
// @route POST /api/v1/visits
exports.createVisit = async (req, res) => {
  try {
    const { patient_id, consultant_id } = req.body;
    const patient = await Patient.findById(patient_id);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    const visit = await Visit.create({
      patient_id,
      franchise_id: patient.franchise_id,
      consultant_id: consultant_id || req.user._id,
      status: "DATA_ENTRY",
    });

    return res.status(201).json({ success: true, data: visit });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Get visit by ID
// @route GET /api/v1/visits/:id
exports.getVisitById = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate("patient_id")
      .populate("franchise_id")
      .populate("consultant_id", "fullName email");
    if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

    const results = await VisitParameterResult.find({ visit_id: req.params.id }).populate(
      "parameter_id"
    );

    return res.json({ success: true, data: { visit, results } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Bulk upsert parameter results for a visit
// @route POST /api/v1/visits/:id/results
exports.saveVisitResults = async (req, res) => {
  try {
    const { results } = req.body; // array of { parameter_id, raw_value }
    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, message: "results must be an array" });
    }

    const paramIds = results.map((r) => r.parameter_id);
    const parameters = await Parameter.find({ _id: { $in: paramIds } });
    const paramMap = new Map(parameters.map((p) => [p._id.toString(), p]));

    const bulkOps = results.map((r) => {
      const p = paramMap.get(r.parameter_id.toString());
      let result_type = "NORMAL";
      if (p) {
        if (r.raw_value < p.normal_min) result_type = "LOW";
        else if (r.raw_value > p.normal_max) result_type = "HIGH";
      }

      return {
        updateOne: {
          filter: { visit_id: req.params.id, parameter_id: r.parameter_id },
          update: { raw_value: r.raw_value, result_type },
          upsert: true,
        },
      };
    });

    await VisitParameterResult.bulkWrite(bulkOps);
    await Visit.findByIdAndUpdate(req.params.id, { status: "REPORT_READY" });

    return res.json({ success: true, message: "Parameter results saved successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Bulk CSV import parameter mapping
// @route POST /api/v1/visits/:id/results/import
exports.importCSVResults = async (req, res) => {
  try {
    const { rows } = req.body; // array of { code, raw_value }
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: "rows must be an array" });
    }

    const codes = rows.map((r) => r.code ? r.code.toUpperCase() : "");
    const parameters = await Parameter.find({ code: { $in: codes } });
    const codeToParamMap = new Map(parameters.map((p) => [p.code, p]));

    const formattedResults = [];
    rows.forEach((r) => {
      if (!r.code) return;
      const p = codeToParamMap.get(r.code.toUpperCase());
      if (p) {
        formattedResults.push({
          parameter_id: p._id,
          raw_value: Number(r.raw_value),
        });
      }
    });

    req.body.results = formattedResults;
    return exports.saveVisitResults(req, res);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Auto report analysis
// @route GET /api/v1/visits/:id/auto-report
exports.getAutoReport = async (req, res) => {
  try {
    const analysis = await generateAutoAnalysis(req.params.id);
    return res.json({ success: true, data: analysis });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update consultant content selection overrides
// @route PATCH /api/v1/visits/:id/selected-content
exports.updateSelectedContent = async (req, res) => {
  try {
    const { selections } = req.body; // array of { parameter_master_content_id, is_selected }
    if (!Array.isArray(selections)) {
      return res.status(400).json({ success: false, message: "selections must be an array" });
    }

    const bulkOps = selections.map((s) => ({
      updateOne: {
        filter: {
          visit_id: req.params.id,
          parameter_master_content_id: s.parameter_master_content_id,
        },
        update: { is_selected: Boolean(s.is_selected) },
        upsert: true,
      },
    }));

    await VisitSelectedContent.bulkWrite(bulkOps);
    return res.json({ success: true, message: "Content selections updated" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Generate PDF / HTML Report
// @route POST /api/v1/visits/:id/generate-pdf
exports.generatePDF = async (req, res) => {
  try {
    const { lang } = req.body; // 'hi' or 'en'
    const selectedLang = lang === "hi" ? "hi" : "en";
    const html = await generateReportHTML(req.params.id, selectedLang);

    const report = await Report.create({
      visit_id: req.params.id,
      language: selectedLang,
      generated_by: req.user._id,
    });

    await Visit.findByIdAndUpdate(req.params.id, { status: "SHARED" });

    return res.json({ success: true, report_id: report._id, html });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc WhatsApp Share link generator
// @route POST /api/v1/reports/:id/share/whatsapp
exports.shareWhatsApp = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate({
      path: "visit_id",
      populate: { path: "patient_id" },
    });
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const patient = report.visit_id.patient_id;
    const phone = patient.mobile.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hello ${patient.name}, your Quantum Machine Health Analysis Report is ready. Please view your report online or contact your consultant.`
    );

    const whatsappUrl = `https://wa.me/91${phone}?text=${message}`;
    return res.json({ success: true, whatsappUrl });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
