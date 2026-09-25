const analyticsService = require('../services/analyticsService');
const heatmapService = require('../services/heatmapService');
const insightsService = require('../services/insightsService');
const selfServicePortalService = require('../services/selfServicePortalService');
const teamLeaderPerformanceService = require('../services/teamLeaderPerformanceService');
const advancedReportService = require('../services/advancedReportService');
const { getEffectiveOrgId } = require('../utils/organizationScope');

const getTargetOrgId = (req) => {
  return getEffectiveOrgId(req);
};

// 1. Executive KPIs
const getExecutiveKpis = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const data = await analyticsService.getExecutiveDashboardKpis(orgId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('getExecutiveKpis error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Executive 30-Day Trends
const getExecutiveTrends = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const days = parseInt(req.query.days, 10) || 30;
    const trends = await analyticsService.getExecutiveTrends(orgId, days);
    res.json({ success: true, trends });
  } catch (err) {
    console.error('getExecutiveTrends error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Attendance Heatmap
const getHeatmap = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const { view, userId, department, startDate, endDate } = req.query;
    const heatmap = await heatmapService.getAttendanceHeatmap({
      organizationId: orgId,
      view: view || 'company',
      userId,
      department,
      startDate,
      endDate
    });
    res.json({ success: true, ...heatmap });
  } catch (err) {
    console.error('getHeatmap error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. AI Workforce Insights
const getInsights = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const insights = await insightsService.generateWorkforceInsights(orgId);
    res.json({ success: true, insights });
  } catch (err) {
    console.error('getInsights error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Dismiss Insight
const dismissInsight = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    await insightsService.dismissInsight(req.params.id, orgId);
    res.json({ success: true, message: 'Insight dismissed successfully' });
  } catch (err) {
    console.error('dismissInsight error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Employee Self-Service Dashboard
const getSelfService = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const data = await selfServicePortalService.getEmployeeSelfServiceData(req.user.id, orgId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('getSelfService error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Team Leader Performance View
const getTeamPerformance = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const data = await teamLeaderPerformanceService.getTeamPerformance(req.user.id, orgId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('getTeamPerformance error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 8. Department Performance Analytics
const getDepartmentAnalytics = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const departments = await analyticsService.getDepartmentAnalytics(orgId);
    res.json({ success: true, departments });
  } catch (err) {
    console.error('getDepartmentAnalytics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 9. Productivity Metrics
const getProductivityMetrics = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const { period } = req.query;
    const metrics = await analyticsService.getProductivityMetrics(orgId, period || 'MONTHLY');
    res.json({ success: true, metrics });
  } catch (err) {
    console.error('getProductivityMetrics error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 10. Predictive Alerts
const getPredictiveAlerts = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const alerts = await insightsService.getPredictiveAlerts(orgId);
    res.json({ success: true, alerts });
  } catch (err) {
    console.error('getPredictiveAlerts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 11. Advanced Reports
const getReport = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const { reportType, startDate, endDate, department } = req.query;
    const report = await advancedReportService.generateAdvancedReport({
      organizationId: orgId,
      reportType,
      startDate,
      endDate,
      department
    });
    res.json({ success: true, report });
  } catch (err) {
    console.error('getReport error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 12. Export Report (CSV or Excel)
const exportReport = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'Organization ID is required' });

    const { reportType, startDate, endDate, department, format = 'csv' } = req.query;
    const report = await advancedReportService.generateAdvancedReport({
      organizationId: orgId,
      reportType,
      startDate,
      endDate,
      department
    });

    if (format === 'excel') {
      const excelHtml = advancedReportService.exportReportToExcel(report);
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType.toLowerCase()}_report.xls"`);
      return res.send(excelHtml);
    }

    const csvData = advancedReportService.exportReportToCsv(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType.toLowerCase()}_report.csv"`);
    res.send(csvData);
  } catch (err) {
    console.error('exportReport error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getExecutiveKpis,
  getExecutiveTrends,
  getHeatmap,
  getInsights,
  dismissInsight,
  getSelfService,
  getTeamPerformance,
  getDepartmentAnalytics,
  getProductivityMetrics,
  getPredictiveAlerts,
  getReport,
  exportReport
};
