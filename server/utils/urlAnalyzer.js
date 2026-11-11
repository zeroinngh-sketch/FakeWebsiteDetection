
const { URL } = require("url");
const net = require("net");

const detectTyposquatting = require("./typosquattingDetector");
const detectHomograph = require("./homographDetector");

function analyzeURL(input) {
    const reasons = [];
    let score = 0;

    // Check whether input is valid
    if (typeof input !== "string" || !input.trim()) {
        return {
            status: "Invalid",
            score: 0,
            reasons: ["Please provide a website URL"]
        };
    }

    let parsedURL;

    try {
        parsedURL = new URL(input.trim());
    } catch (error) {
        return {
            status: "Invalid",
            score: 0,
            reasons: ["Invalid website URL"]
        };
    }

    // Allow only HTTP and HTTPS
    if (!["http:", "https:"].includes(parsedURL.protocol)) {
        return {
            status: "Invalid",
            score: 0,
            reasons: ["Only HTTP and HTTPS URLs are supported"]
        };
    }

    const hostname = parsedURL.hostname.toLowerCase();

    // Check HTTPS
    if (parsedURL.protocol !== "https:") {
        score += 15;
        reasons.push("Website does not use HTTPS");
    }

    // Check suspicious keywords in hostname and URL path
    const suspiciousKeywords = [
        "login",
        "verify",
        "secure",
        "account",
        "update",
        "banking",
        "password",
        "signin"
    ];

    const searchableURL = (
        hostname + parsedURL.pathname + parsedURL.search
    ).toLowerCase();

    suspiciousKeywords.forEach((keyword) => {
        if (searchableURL.includes(keyword)) {
            score += 10;
            reasons.push(`Suspicious keyword found: ${keyword}`);
        }
    });

    // Check whether hostname is an IP address
    if (net.isIP(hostname)) {
        score += 30;
        reasons.push("Website uses an IP address instead of a domain name");
    }

    // Check number of subdomains
    const parts = hostname.split(".");

    if (net.isIP(hostname) === 0 && parts.length > 3) {
        score += 15;
        reasons.push("Unusually many subdomains");
    }

    // Check suspicious URL shorteners
    const shorteners = [
        "bit.ly",
        "tinyurl.com",
        "t.co",
        "is.gd",
        "cutt.ly",
        "rb.gy"
    ];

    if (shorteners.includes(hostname)) {
        score += 20;
        reasons.push("Website uses a URL shortening service");
    }

    // Check for @ symbol in URL
    if (parsedURL.username || parsedURL.password) {
        score += 20;
        reasons.push("URL contains embedded username or password information");
    }

    // Check for suspicious hyphens in hostname
const hasPunycode = hostname
    .split(".")
    .some((part) => part.startsWith("xn--"));

if (hostname.includes("-") && !hasPunycode) {
    score += 10;
    reasons.push("Domain contains hyphens");
}

    // Check for typosquatting
    const typoResult = detectTyposquatting(input);

    if (typoResult.detected) {
        score += 40;
        reasons.push(
            `Possible typosquatting: ${typoResult.suspiciousDomain} is similar to ${typoResult.similarTo}`
        );
    }

    // Check for homograph attacks
    const homographResult = detectHomograph(input);

    if (homographResult.detected) {
        score += 40;
        reasons.push(
            `Possible homograph attack detected: ${homographResult.asciiDomain}`
        );
    }

    // Limit score to 100
    score = Math.min(score, 100);

    // Determine risk status
    let status;

    if (score >= 50) {
        status = "High Risk";
    } else if (score >= 20) {
        status = "Suspicious";
    } else {
        status = "Low Risk";
    }

    return {
        status,
        score,
        reasons
    };
}

module.exports = analyzeURL;

