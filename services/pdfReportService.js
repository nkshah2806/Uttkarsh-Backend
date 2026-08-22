const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const MemberProfile = require("../models/MemberProfile");
const VisitParameterResult = require("../models/VisitParameterResult");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const Parameter = require("../models/Parameter");
const User = require("../models/User");

exports.generateReportHTML = async (visitId, lang = "en") => {
  const visit = await Visit.findById(visitId)
    .populate({
      path: "patient_id",
      populate: { path: "registered_by" },
    })
    .populate("consultant_id");

  if (!visit) throw new Error("Visit not found");

  const patient = visit.patient_id;
  const registeredBy = patient?.registered_by;

  let memberProfile = null;
  if (registeredBy && registeredBy._id) {
    memberProfile = await MemberProfile.findOne({ user: registeredBy._id });
  }

  const franchise = {
    name:
      memberProfile?.store_name ||
      memberProfile?.member_name ||
      registeredBy?.fullName ||
      "UTKARSH QUANTUM HEALTH",
    phone:
      memberProfile?.phone ||
      registeredBy?.phoneNumber ||
      registeredBy?.mobileNumber ||
      "",
    address:
      memberProfile?.address ||
      (memberProfile?.city ? `${memberProfile.city}, ${memberProfile.state}` : "") ||
      "Healthcare Center",
    logo_url: "",
  };
  const consultant = visit.consultant_id || { fullName: "Specialist Consultant" };

  const results = await VisitParameterResult.find({ visit_id: visitId }).populate(
    "parameter_id"
  );

  const selectedEntries = await VisitSelectedContent.find({
    visit_id: visitId,
    is_selected: true,
  }).populate("parameter_master_content_id");

  const selectedContentIds = selectedEntries.map(
    (e) => e.parameter_master_content_id._id
  );

  const masterContents = await ParameterMasterContent.find({
    _id: { $in: selectedContentIds },
  }).populate("parameter_id");

  const abnormalResults = results.filter((r) => r.result_type !== "NORMAL");

  const isHindi = lang === "hi";

  const labels = {
    title: isHindi ? "क्वांटम स्वास्थ्य विश्लेषण रिपोर्ट" : "QUANTUM HEALTH ANALYSIS REPORT",
    patientInfo: isHindi ? "रोगी विवरण" : "Patient Details",
    patientCode: isHindi ? "रोगी कोड" : "Patient ID",
    name: isHindi ? "नाम" : "Full Name",
    ageGender: isHindi ? "आयु / लिंग" : "Age / Gender",
    mobile: isHindi ? "मोबाइल" : "Mobile",
    date: isHindi ? "दिनांक" : "Visit Date",
    consultant: isHindi ? "परामर्शदाता" : "Consultant",
    summary: isHindi ? "असामान्य मापदंड सारांश" : "Abnormal Parameters Summary",
    parameter: isHindi ? "मापदंड" : "Parameter",
    value: isHindi ? "मान" : "Value",
    range: isHindi ? "सामान्य सीमा" : "Normal Range",
    status: isHindi ? "स्थिति" : "Status",
    problem: isHindi ? "मुख्य समस्याएं" : "Health Problems Identified",
    cause: isHindi ? "संभावित कारण" : "Possible Causes",
    precaution: isHindi ? "सावधानियां" : "Precautions",
    pathya: isHindi ? "पथ्य (क्या खाएं)" : "Pathya (Do's)",
    parhej: isHindi ? "परहेज (क्या न खाएं)" : "Parhej (Don'ts)",
    medicine: isHindi ? "आयुर्वेदिक औषधि सुझाव" : "Ayurvedic Medicine Suggestions",
    diet: isHindi ? "आहार सारणी" : "Diet Chart & Lifestyle",
  };

  const groupContent = (type) => {
    return masterContents
      .filter((c) => c.content_type === type)
      .map((c) => (isHindi ? c.text_hi : c.text_en));
  };

  const problems = groupContent("PROBLEM");
  const causes = groupContent("CAUSE");
  const precautions = groupContent("PRECAUTION");
  const pathya = groupContent("PATHYA");
  const parhej = groupContent("PARHEJ");
  const medicines = groupContent("MEDICINE");
  const diet = groupContent("DIET");

  const html = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${labels.title} - ${patient.name}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 20px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 15px; }
    .brand img { max-height: 60px; }
    .title { font-size: 22px; font-weight: 700; color: #4338ca; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; }
    .label { font-weight: 600; color: #475569; }
    .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    .table th { background: #e0e7ff; color: #3730a3; font-weight: 600; }
    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-weight: 600; font-size: 11px; }
    .status-HIGH { background: #ffe4e6; color: #e11d48; }
    .status-LOW { background: #fef3c7; color: #d97706; }
    .status-NORMAL { background: #dcfce7; color: #15803d; }
    .section-header { font-size: 16px; font-weight: 700; color: #312e81; margin-top: 25px; margin-bottom: 10px; border-left: 4px solid #4f46e5; padding-left: 10px; }
    .bullet-list { margin: 5px 0 15px 20px; padding: 0; }
    .bullet-list li { margin-bottom: 6px; line-height: 1.5; font-size: 13.5px; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${franchise.logo_url ? `<img src="${franchise.logo_url}" />` : ''}
      <div>
        <h1 class="title">${franchise.name || 'UTKARSH QUANTUM HEALTH'}</h1>
        <div class="subtitle">${franchise.address || ''} • ${franchise.phone || ''}</div>
      </div>
    </div>
    <div style="text-align: right;">
      <h2 style="font-size: 16px; margin: 0; color: #475569;">${labels.title}</h2>
      <div class="subtitle">${new Date(visit.visit_date).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="card">
    <h3 style="margin-top:0; color:#334155; font-size:15px;">${labels.patientInfo}</h3>
    <div class="grid-2">
      <div><span class="label">${labels.patientCode}:</span> ${patient.patient_code}</div>
      <div><span class="label">${labels.name}:</span> <strong>${patient.name}</strong></div>
      <div><span class="label">${labels.ageGender}:</span> ${patient.age} Yrs / ${patient.gender}</div>
      <div><span class="label">${labels.mobile}:</span> ${patient.mobile}</div>
      <div><span class="label">${labels.consultant}:</span> ${consultant.fullName}</div>
      <div><span class="label">${labels.date}:</span> ${new Date(visit.visit_date).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="section-header">${labels.summary} (${abnormalResults.length} Flagged)</div>
  <table class="table">
    <thead>
      <tr>
        <th>${labels.parameter}</th>
        <th>${labels.value}</th>
        <th>${labels.range}</th>
        <th>${labels.status}</th>
      </tr>
    </thead>
    <tbody>
      ${
        abnormalResults.length === 0
          ? `<tr><td colspan="4" style="text-align:center; color:#16a34a;">All parameters within normal limits</td></tr>`
          : abnormalResults
              .map(
                (r) => `
        <tr>
          <td><strong>${isHindi ? r.parameter_id.name_hi : r.parameter_id.name_en}</strong> (${r.parameter_id.code})</td>
          <td>${r.raw_value} ${r.parameter_id.unit}</td>
          <td>${r.parameter_id.normal_min} - ${r.parameter_id.normal_max} ${r.parameter_id.unit}</td>
          <td><span class="status-badge status-${r.result_type}">${r.result_type}</span></td>
        </tr>
      `
              )
              .join("")
      }
    </tbody>
  </table>

  ${
    problems.length > 0
      ? `<div class="section-header">${labels.problem}</div><ul class="bullet-list">${problems.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    causes.length > 0
      ? `<div class="section-header">${labels.cause}</div><ul class="bullet-list">${causes.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    precautions.length > 0
      ? `<div class="section-header">${labels.precaution}</div><ul class="bullet-list">${precautions.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    pathya.length > 0
      ? `<div class="section-header">${labels.pathya}</div><ul class="bullet-list">${pathya.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    parhej.length > 0
      ? `<div class="section-header">${labels.parhej}</div><ul class="bullet-list">${parhej.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    medicines.length > 0
      ? `<div class="section-header">${labels.medicine}</div><ul class="bullet-list">${medicines.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }
  ${
    diet.length > 0
      ? `<div class="section-header">${labels.diet}</div><ul class="bullet-list">${diet.map((p) => `<li>${p}</li>`).join("")}</ul>`
      : ""
  }

  <div class="footer">
    <div>Generated by Utkarsh Quantum Analysis System</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>
  `;

  return html;
};
