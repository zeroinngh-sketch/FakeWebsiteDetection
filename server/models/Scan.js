
const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema({
    website: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    reasons: {
        type: [String],
        default: []
    },
    scannedAt: {
        type: Date,
        default: Date.now
    }
});

const Scan = mongoose.model("Scan", scanSchema);

module.exports = Scan;
