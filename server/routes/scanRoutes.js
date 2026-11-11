
const express = require("express");
const router = express.Router();

const {
    scanWebsite,
    getScanHistory,
    clearScanHistory
} = require("../controllers/scanController");

console.log("SCAN ROUTES LOADED");

router.post("/scan", scanWebsite);
router.get("/history", getScanHistory);
router.delete("/history", clearScanHistory);

module.exports = router;
