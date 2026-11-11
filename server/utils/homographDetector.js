
const { URL } = require("url");

// Detect internationalized domain names containing non-ASCII characters
function detectHomograph(input) {
    let hostname;

    try {
        hostname = new URL(input).hostname.toLowerCase();
    } catch (error) {
        return {
            detected: false,
            message: "Invalid URL"
        };
    }

    // Remove www prefix
    hostname = hostname.replace(/^www\./, "");

    // Convert domain to ASCII (Punycode)
    const asciiDomain = new URL(`http://${hostname}`).hostname;

    // Check for Punycode prefix
    if (asciiDomain.split(".").some((part) => part.startsWith("xn--"))) {
        return {
            detected: true,
            message: "Possible homograph attack detected",
            suspiciousDomain: hostname,
            asciiDomain
        };
    }

    return {
        detected: false,
        message: "No obvious homograph characters detected"
    };
}

module.exports = detectHomograph;
