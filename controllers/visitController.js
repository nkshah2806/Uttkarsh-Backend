const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const Parameter = require("../models/Parameter");
const VisitParameterResult = require("../models/VisitParameterResult");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const Report = require("../models/Report");
const Medicine = require("../models/Medicine");
const { generateAutoAnalysis } = require("../services/analysisEngine");
const { generateReportHTML } = require("../services/pdfReportService");
const { isAdminUser } = require("../middleware/authMiddleware");

// Admins can access every record. Non-admin members may only access visits
// belonging to patients they personally registered (registered_by === user._id).
const canAccessVisit = (req, visit) => {
  if (!visit) return false;
  if (isAdminUser(req.user)) return true;
  const patient = visit.patient_id || {};
  const registeredById =
    patient.registered_by?._id?.toString() ||
    patient.registered_by?.toString();
  return registeredById === String(req.user._id);
};

// Loads a visit (with its patient's registered_by) and verifies the requesting
// user may access it. Returns the visit on success, or sends a 403/404 response
// and returns null when access is not permitted.
const loadOwnedVisit = async (req, res) => {
  const visit = await Visit.findById(req.params.id).populate({
    path: "patient_id",
    select: "name patient_code mobile registered_by",
    populate: { path: "registered_by", select: "_id fullName" },
  });
  if (!visit) {
    res.status(404).json({ success: false, message: "Visit not found" });
    return null;
  }
  if (!canAccessVisit(req, visit)) {
    res.status(403).json({
      success: false,
      message: "You are not authorized to access this visit",
    });
    return null;
  }
  return visit;
};

// @desc Create a visit
// @route POST /api/v1/visits
exports.createVisit = async (req, res) => {
  try {
    const { patient_id, consultant_id } = req.body;
    const patient = await Patient.findById(patient_id);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    // Non-admin members may only create visits for their own patients
    if (!isAdminUser(req.user)) {
      const registeredById =
        patient.registered_by?._id?.toString() ||
        patient.registered_by?.toString();
      if (registeredById !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to create a visit for this patient",
        });
      }
    }

    const visit = await Visit.create({
      patient_id,
      franchise_id: patient.franchise_id || req.user.franchise_id || null,
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
      .populate({
        path: "patient_id",
        populate: { path: "registered_by", select: "fullName email username role" },
      })
      .populate("consultant_id", "fullName email");
    if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

    if (!canAccessVisit(req, visit)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this visit",
      });
    }

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
    const ownedVisit = await loadOwnedVisit(req, res);
    if (!ownedVisit) return;

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
          update: { $set: { raw_value: r.raw_value, result_type } },
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

    const codes = rows.map((r) => (r.code ? r.code.toUpperCase() : ""));
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
    const ownedVisit = await loadOwnedVisit(req, res);
    if (!ownedVisit) return;

    const analysis = await generateAutoAnalysis(req.params.id);
    return res.json({ success: true, data: analysis });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update consultant content selection overrides, optional next visit date,
//       selected medicines and an optional note
// @route PATCH /api/v1/visits/:id/selected-content
exports.updateSelectedContent = async (req, res) => {
  try {
    const ownedVisit = await loadOwnedVisit(req, res);
    if (!ownedVisit) return;

    const { selections, next_visit_date, medicines, note, parameter_medicines } = req.body;

    if (next_visit_date !== undefined) {
      await Visit.findByIdAndUpdate(req.params.id, {
        next_visit_date: next_visit_date ? new Date(next_visit_date) : null,
      });
    }

    // Persist medicine selection + optional note on the visit. Each selected
    // medicine stores a snapshot of its master data so later edits or
    // deactivations never alter previously generated reports.
    if (medicines !== undefined || note !== undefined) {
      const visitUpdate = {};

      if (medicines !== undefined && Array.isArray(medicines)) {
        const medicineIds = [...new Set(medicines.map((m) => String(m?._id || m)))].filter(Boolean);
        let medicineSnapshot = [];

        if (medicineIds.length > 0) {
          const found = await Medicine.find({ _id: { $in: medicineIds } });
          const foundMap = new Map(found.map((m) => [String(m._id), m]));
          // Preserve the order chosen by the consultant
          medicineSnapshot = medicineIds
            .map((id) => foundMap.get(id))
            .filter(Boolean)
            .map((m) => ({
              medicine_id: m._id,
              name_snapshot: m.name || "",
              details_snapshot: m.details || "",
              dosage_snapshot: m.dosage || "",
            }));
        }

        visitUpdate.medicines = medicineSnapshot;
      }

      if (note !== undefined) {
        visitUpdate.medicine_note = typeof note === "string" ? note.trim() : "";
      }

      await Visit.findByIdAndUpdate(req.params.id, visitUpdate);
    }

    // Persist point-wise (per-parameter) medicine selection + note. Each entry
    // carries the parameter_id and a list of medicine ids/objects plus an
    // optional note. Snapshots are resolved from the Medicine master so later
    // edits/deactivations never alter previously generated reports.
    if (parameter_medicines !== undefined && Array.isArray(parameter_medicines)) {
      const resolvedParameterMedicines = [];

      for (const entry of parameter_medicines) {
        if (!entry || !entry.parameter_id) continue;

        const rawMeds = Array.isArray(entry.medicines) ? entry.medicines : [];
        const medicineIds = [...new Set(rawMeds.map((m) => String(m?._id || m)))].filter(Boolean);
        let medicineSnapshot = [];

        if (medicineIds.length > 0) {
          const found = await Medicine.find({ _id: { $in: medicineIds } });
          const foundMap = new Map(found.map((m) => [String(m._id), m]));
          // Preserve the order chosen by the consultant
          medicineSnapshot = medicineIds
            .map((id) => foundMap.get(id))
            .filter(Boolean)
            .map((m) => ({
              medicine_id: m._id,
              name_snapshot: m.name || "",
              details_snapshot: m.details || "",
              dosage_snapshot: m.dosage || "",
            }));
        }

        if (medicineSnapshot.length === 0 && !entry.note) continue;

        resolvedParameterMedicines.push({
          parameter_id: entry.parameter_id,
          medicines: medicineSnapshot,
          note: typeof entry.note === "string" ? entry.note.trim() : "",
        });
      }

      await Visit.findByIdAndUpdate(req.params.id, {
        parameter_medicines: resolvedParameterMedicines,
      });
    }

    if (Array.isArray(selections)) {
      const bulkOps = selections.map((s) => {
        const isSelected = Boolean(s.is_selected);

        if (s.node_id) {
          const filter = {
            visit_id: req.params.id,
            node_id: s.node_id,
          };
          if (s.parameter_id) {
            filter.parameter_id = s.parameter_id;
          }

          return {
            updateOne: {
              filter,
              update: {
                $set: {
                  visit_id: req.params.id,
                  parameter_id: s.parameter_id,
                  node_id: s.node_id,
                  is_selected: isSelected,
                },
              },
              upsert: true,
            },
          };
        } else {
          // Legacy parameter_master_content_id format
          const filter = {
            visit_id: req.params.id,
            parameter_master_content_id: s.parameter_master_content_id,
          };
          if (s.parameter_id) {
            filter.parameter_id = s.parameter_id;
          }

          return {
            updateOne: {
              filter,
              update: {
                $set: {
                  visit_id: req.params.id,
                  parameter_id: s.parameter_id,
                  parameter_master_content_id: s.parameter_master_content_id,
                  is_selected: isSelected,
                },
              },
              upsert: true,
            },
          };
        }
      });

      if (bulkOps.length > 0) {
        await VisitSelectedContent.bulkWrite(bulkOps);
      }
    }

    return res.json({ success: true, message: "Selections and visit details updated successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Generate PDF / HTML Report
// @route POST /api/v1/visits/:id/generate-pdf
exports.generatePDF = async (req, res) => {
  try {
    const ownedVisit = await loadOwnedVisit(req, res);
    if (!ownedVisit) return;

    const { lang, next_visit_date } = req.body; // 'hi' or 'en'
    const selectedLang = lang === "hi" ? "hi" : "en";

    const html = await generateReportHTML(req.params.id, selectedLang, {
      next_visit_date,
    });

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
      populate: { path: "patient_id", populate: { path: "registered_by" } },
    });
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    if (!canAccessVisit(req, report.visit_id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to share this report",
      });
    }

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

// @desc Get comprehensive detailed report breakdown for a visit (evaluated parameters + selected guidance)
// @route GET /api/v1/visits/:id/detailed-report
exports.getDetailedReport = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate({
        path: "patient_id",
        populate: { path: "registered_by", select: "fullName email username role phoneNumber mobileNumber" },
      })
      .populate("consultant_id", "fullName email username role");

    if (!visit) return res.status(404).json({ success: false, message: "Visit not found" });

    if (!canAccessVisit(req, visit)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this visit",
      });
    }

    // Fetch all evaluated parameters with their master info
    const rawResults = await VisitParameterResult.find({ visit_id: req.params.id })
      .populate("parameter_id")
      .sort({ createdAt: 1 });

    const parameters = rawResults.map((r) => {
      const p = r.parameter_id;
      return {
        _id: r._id,
        parameter_id: p?._id,
        code: p?.code,
        name: p?.name,
        name_hi: p?.name_hi,
        category: p?.category || "General Health",
        normal_min: p?.normal_min,
        normal_max: p?.normal_max,
        unit: p?.unit || "",
        raw_value: r.raw_value,
        result_type: r.result_type, // 'NORMAL', 'LOW', 'HIGH'
      };
    });

    // Fetch auto analysis with current selected items
    const autoAnalysis = await generateAutoAnalysis(req.params.id);

    // Summary counts
    const totalCount = parameters.length;
    const normalCount = parameters.filter((p) => p.result_type === "NORMAL").length;
    const lowCount = parameters.filter((p) => p.result_type === "LOW").length;
    const highCount = parameters.filter((p) => p.result_type === "HIGH").length;
    const abnormalCount = lowCount + highCount;

    let selectedPointsCount = 0;
    (autoAnalysis.analyzed_items || []).forEach((item) => {
      (item.sections || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          if (it.is_selected) selectedPointsCount++;
        });
      });
    });

    const reports = await Report.find({ visit_id: req.params.id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        visit,
        patient: visit.patient_id,
        consultant: visit.consultant_id,
        parameters,
        abnormal_analysis: autoAnalysis.analyzed_items || [],
        summary: {
          total: totalCount,
          normal: normalCount,
          low: lowCount,
          high: highCount,
          abnormal: abnormalCount,
          selected_points_count: selectedPointsCount,
        },
        reports,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
