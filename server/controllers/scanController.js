
const analyzeURL = require("../utils/urlAnalyzer");
const Scan = require("../models/Scan");

// Scan a website and save the result
const scanWebsite = async (req, res) => {
    console.log("UPDATED SCAN CONTROLLER CALLED");

    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({
            error: "Please provide a valid website URL"
        });
    }

    const website = url.trim();
    const result = analyzeURL(website);

    try {
        const newScan = new Scan({
            website: website,
            status: result.status,
            score: result.score,
            reasons: result.reasons
        });

        await newScan.save();

        return res.status(200).json({
            website: website,
            analysis: result,
            message: "Scan result saved successfully"
        });

    } catch (error) {
        console.error("Database Save Error:", error.message);

        return res.status(500).json({
            error: "Scan completed, but failed to save the result"
        });
    }
};

// Get scan history
const getScanHistory = async (req, res) => {
    try {
        const scans = await Scan.find()
            .sort({ scannedAt: -1 })
            .limit(50);

        return res.status(200).json({
            count: scans.length,
            scans: scans
        });

    } catch (error) {
        console.error("Scan History Error:", error.message);

        return res.status(500).json({
            error: "Failed to fetch scan history"
        });
    }
};

// Clear all scan history
const clearScanHistory = async (req, res) => {
    try {
        const result = await Scan.deleteMany({});

        return res.status(200).json({
            message: "Scan history cleared successfully",
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error("Clear History Error:", error.message);

        return res.status(500).json({
            error: "Failed to clear scan history"
        });
    }
};

// Export controller functions
module.exports = {
    scanWebsite,
    getScanHistory,
    clearScanHistory
};
