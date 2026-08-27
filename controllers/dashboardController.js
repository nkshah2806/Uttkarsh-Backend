const Patient = require("../models/Patient");
const User = require("../models/User");
const Visit = require("../models/Visit");
const Report = require("../models/Report");
const Parameter = require("../models/Parameter");
const Franchise = require("../models/Franchise");
const VisitParameterResult = require("../models/VisitParameterResult");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const startOfDay = (d = new Date()) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
};

const startOfWeek = (d = new Date()) => {
    const date = startOfDay(d);
    const day = date.getDay(); // 0 = Sunday
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday-based week
    date.setDate(diff);
    return date;
};

const startOfMonth = (d = new Date()) => {
    return new Date(d.getFullYear(), d.getMonth(), 1);
};

const formatDayKey = (date) => {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const day = String(ist.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const formatDayLabel = (date) => {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    return `${String(ist.getUTCDate()).padStart(2, "0")} ${MONTH_NAMES[ist.getUTCMonth()]}`;
};

const fillDailySeries = (rawMap, daySeries) =>
    daySeries.map((d) => ({
        date: formatDayKey(d),
        label: formatDayLabel(d),
        count: rawMap.get(formatDayKey(d)) || 0,
    }));

// @desc Get dashboard overview (role + franchise scoped)
// @route GET /api/dashboard/overview
exports.getOverview = async (req, res) => {
    try {
        const user = req.user;
        const isAdmin =
            Boolean(user.isAdmin) ||
            ["SUPER_ADMIN", "ADMIN"].includes(user.role);
        const scope = req.franchiseFilter || {};
        const isAdminScope = !scope || Object.keys(scope).length === 0;

        // Visit/Report records do not carry `registered_by` (they reference the
        // patient), so translate the member scope to scoped patient ids first.
        const scopedPatientIds = isAdminScope
            ? []
            : await Patient.find(scope).distinct("_id");
        const visitScope = isAdminScope ? {} : { patient_id: { $in: scopedPatientIds } };

        const now = new Date();
        const dayStart = startOfDay(now);
        const weekStart = startOfWeek(now);
        const monthStart = startOfMonth(now);
        const tomorrowStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        // Reports do not carry patient/franchise data, so resolve scoped visit ids first.
        let scopeVisitIds = [];
        if (!isAdminScope) {
            scopeVisitIds = await Visit.find(visitScope).distinct("_id");
        }
        const reportBase = isAdminScope
            ? {}
            : { visit_id: { $in: scopeVisitIds } };

        // ---------------- Summary counts ----------------
        const [
            totalPatients,
            patientsToday,
            patientsThisWeek,
            patientsThisMonth,
            totalVisits,
            totalReports,
            reportsToday,
            reportsThisWeek,
            reportsThisMonth,
            overdueFollowUps,
            upcomingFollowUps,
        ] = await Promise.all([
            Patient.countDocuments(scope),
            Patient.countDocuments({ ...scope, createdAt: { $gte: dayStart } }),
            Patient.countDocuments({ ...scope, createdAt: { $gte: weekStart } }),
            Patient.countDocuments({ ...scope, createdAt: { $gte: monthStart } }),
            Visit.countDocuments(visitScope),
            Report.countDocuments(reportBase),
            Report.countDocuments({ ...reportBase, generated_at: { $gte: dayStart } }),
            Report.countDocuments({ ...reportBase, generated_at: { $gte: weekStart } }),
            Report.countDocuments({ ...reportBase, generated_at: { $gte: monthStart } }),
            Visit.countDocuments({
                ...visitScope,
                next_visit_date: { $gte: new Date(0), $lt: dayStart },
            }),
            Visit.countDocuments({ ...visitScope, next_visit_date: { $gte: dayStart, $lt: tomorrowStart } }),
        ]);

        // Visit status breakdown
        const visitStatusAgg = await Visit.aggregate([
            { $match: visitScope },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const visitStatusMap = {};
        visitStatusAgg.forEach((s) => (visitStatusMap[s._id] = s.count));
        const pendingVisits = visitStatusMap["DATA_ENTRY"] || 0;
        const reportReadyVisits = visitStatusMap["REPORT_READY"] || 0;
        const sharedVisits = visitStatusMap["SHARED"] || 0;

        // ---------------- Trends (last 7 days) ----------------
        const daysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        daysAgo.setHours(0, 0, 0, 0);

        const [patientTrendRaw, reportTrendRaw] = await Promise.all([
            Patient.aggregate([
                { $match: { ...scope, createdAt: { $gte: daysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Report.aggregate([
                { $match: { ...reportBase, generated_at: { $gte: daysAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$generated_at", timezone: "Asia/Kolkata" },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const patientTrendMap = new Map(patientTrendRaw.map((r) => [r._id, r.count]));
        const reportTrendMap = new Map(reportTrendRaw.map((r) => [r._id, r.count]));
        const daySeries = [];
        for (let i = 6; i >= 0; i--) {
            daySeries.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
        }
        const patientTrend = fillDailySeries(patientTrendMap, daySeries);
        const reportTrend = fillDailySeries(reportTrendMap, daySeries);

        // ---------------- Monthly trends (last 6 months) ----------------
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const [patientMonthlyRaw, reportMonthlyRaw] = await Promise.all([
            Patient.aggregate([
                { $match: { ...scope, createdAt: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Kolkata" },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Report.aggregate([
                { $match: { ...reportBase, generated_at: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m", date: "$generated_at", timezone: "Asia/Kolkata" },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const patientMonthlyMap = new Map(patientMonthlyRaw.map((r) => [r._id, r.count]));
        const reportMonthlyMap = new Map(reportMonthlyRaw.map((r) => [r._id, r.count]));
        const monthSeries = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ist = new Date(d.getTime() + IST_OFFSET_MS);
            const key = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
            monthSeries.push({ key, label: MONTH_NAMES[d.getMonth()] });
        }
        const patientMonthlyTrend = monthSeries.map((m) => ({
            month: m.label,
            count: patientMonthlyMap.get(m.key) || 0,
        }));
        const reportMonthlyTrend = monthSeries.map((m) => ({
            month: m.label,
            count: reportMonthlyMap.get(m.key) || 0,
        }));

        // ---------------- Parameter result distribution ----------------
        const resultMatch = isAdminScope ? {} : { visit_id: { $in: scopeVisitIds } };
        const resultAgg = await VisitParameterResult.aggregate([
            { $match: resultMatch },
            { $group: { _id: "$result_type", count: { $sum: 1 } } },
        ]);
        const resultMap = { NORMAL: 0, LOW: 0, HIGH: 0 };
        resultAgg.forEach((r) => {
            if (r._id in resultMap) resultMap[r._id] = r.count;
        });
        const resultDistribution = [
            { name: "Normal", value: resultMap.NORMAL, color: "#10b981" },
            { name: "Low", value: resultMap.LOW, color: "#f59e0b" },
            { name: "High", value: resultMap.HIGH, color: "#ef4444" },
        ];

        // ---------------- Lists ----------------
        const [recentPatients, recentReports, pendingVisitsList, upcomingFollowUpsList] =
            await Promise.all([
                Patient.find(scope)
                    .populate("registered_by", "fullName")
                    .sort({ createdAt: -1 })
                    .limit(6),
                Report.find(reportBase)
                    .sort({ generated_at: -1 })
                    .limit(6)
                    .populate({
                        path: "visit_id",
                        select: "status patient_id",
                        populate: { path: "patient_id", select: "name patient_code mobile" },
                    }),
                Visit.find({ ...visitScope, status: { $in: ["DATA_ENTRY", "REPORT_READY"] } })
                    .sort({ createdAt: -1 })
                    .limit(6)
                    .populate("patient_id", "name patient_code mobile"),
                Visit.find({ ...visitScope, next_visit_date: { $gte: dayStart } })
                    .sort({ next_visit_date: 1 })
                    .limit(6)
                    .populate("patient_id", "name patient_code mobile"),
            ]);

        const serialize = (docs) =>
            (docs || []).map((d) => (typeof d.toObject === "function" ? d.toObject() : d));

        const recentPatientsData = serialize(recentPatients).map((p) => ({
            _id: p._id,
            patient_code: p.patient_code,
            name: p.name,
            mobile: p.mobile,
            gender: p.gender,
            age: p.age,
            createdAt: p.createdAt,
            registered_by: p.registered_by?.fullName || null,
        }));

        const recentReportsData = serialize(recentReports).map((r) => ({
            _id: r._id,
            language: r.language,
            generated_at: r.generated_at || r.createdAt,
            visit_id: r.visit_id?._id || null,
            visit_status: r.visit_id?.status || null,
            patient: r.visit_id?.patient_id
                ? {
                    _id: r.visit_id.patient_id._id,
                    name: r.visit_id.patient_id.name,
                    patient_code: r.visit_id.patient_id.patient_code,
                    mobile: r.visit_id.patient_id.mobile,
                }
                : null,
        }));

        const pendingVisitsData = serialize(pendingVisitsList).map((v) => ({
            _id: v._id,
            status: v.status,
            visit_date: v.visit_date || v.createdAt,
            createdAt: v.createdAt,
            patient: v.patient_id
                ? {
                    _id: v.patient_id._id,
                    name: v.patient_id.name,
                    patient_code: v.patient_id.patient_code,
                    mobile: v.patient_id.mobile,
                }
                : null,
        }));

        const upcomingFollowUpsData = serialize(upcomingFollowUpsList).map((v) => ({
            _id: v._id,
            status: v.status,
            next_visit_date: v.next_visit_date,
            patient: v.patient_id
                ? {
                    _id: v.patient_id._id,
                    name: v.patient_id.name,
                    patient_code: v.patient_id.patient_code,
                    mobile: v.patient_id.mobile,
                }
                : null,
        }));

        // ---------------- Recent activity timeline ----------------
        const activities = [];
        recentPatientsData.forEach((p) =>
            activities.push({
                _id: `p_${p._id}`,
                type: "patient_created",
                title: "New patient registered",
                description: `${p.name} (${p.patient_code})`,
                timestamp: p.createdAt,
                patient_id: p._id,
            })
        );
        recentReportsData.forEach((r) =>
            activities.push({
                _id: `r_${r._id}`,
                type: "report_generated",
                title: "Report generated",
                description: r.patient
                    ? `${r.patient.name} (${r.patient.patient_code})`
                    : "Patient report",
                timestamp: r.generated_at,
                visit_id: r.visit_id,
                patient_id: r.patient?._id || null,
                report_id: r._id,
                language: r.language,
            })
        );
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recentActivities = activities.slice(0, 10);

        // ---------------- Admin-only stats ----------------
        let admin = null;
        if (isAdmin) {
            const [
                totalUsers,
                totalMembers,
                activeMembers,
                totalFranchises,
                activeFranchises,
                totalParameters,
                publishedParameters,
                roleDist,
                categoryAgg,
                nodeAgg,
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isAdmin: { $ne: true } }),
                User.countDocuments({ isAdmin: { $ne: true }, isActive: true }),
                Franchise.countDocuments(),
                Franchise.countDocuments({ status: "ACTIVE" }),
                Parameter.countDocuments(),
                Parameter.countDocuments({ status: "PUBLISHED" }),
                User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
                Parameter.aggregate([
                    { $group: { _id: "$category", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]),
                Parameter.aggregate([
                    { $project: { nodes: { $size: { $ifNull: ["$parsed_nodes_en", []] } } } },
                    { $group: { _id: null, total: { $sum: "$nodes" } } },
                ]),
            ]);

            admin = {
                totalUsers,
                totalMembers,
                activeMembers,
                inactiveMembers: totalMembers - activeMembers,
                totalFranchises,
                activeFranchises,
                totalParameters,
                publishedParameters,
                totalContentNodes: nodeAgg.length ? nodeAgg[0].total : 0,
                roleDistribution: roleDist.map((r) => ({ role: r._id || "UNASSIGNED", count: r.count })),
                parameterCategories: categoryAgg.map((c) => ({ category: c._id, count: c.count })),
            };
        }

        return res.json({
            success: true,
            data: {
                role: user.role,
                isAdmin,
                scope: scope.franchise_id || null,
                summary: {
                    totalPatients,
                    patientsToday,
                    patientsThisWeek,
                    patientsThisMonth,
                    totalVisits,
                    pendingVisits,
                    reportReadyVisits,
                    sharedVisits,
                    totalReports,
                    reportsToday,
                    reportsThisWeek,
                    reportsThisMonth,
                    overdueFollowUps,
                    upcomingFollowUps,
                },
                charts: {
                    patientTrend,
                    reportTrend,
                    patientMonthlyTrend,
                    reportMonthlyTrend,
                    resultDistribution,
                },
                lists: {
                    recentPatients: recentPatientsData,
                    recentReports: recentReportsData,
                    pendingVisits: pendingVisitsData,
                    upcomingFollowUps: upcomingFollowUpsData,
                    recentActivities,
                },
                admin,
            },
        });
    } catch (error) {
        console.error("Dashboard overview error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
