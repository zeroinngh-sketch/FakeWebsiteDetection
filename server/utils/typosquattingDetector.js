
const { URL } = require("url");

// List of trusted popular domains
const trustedDomains = [
    "google.com",
    "amazon.com",
    "paypal.com",
    "facebook.com",
    "microsoft.com",
    "apple.com",
    "instagram.com",
    "netflix.com",
    "youtube.com"
];

// Calculate similarity using Levenshtein distance
function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Detect typosquatting
function detectTyposquatting(input) {
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

    const domainParts = hostname.split(".");
    const domain = domainParts.length >= 2
        ? domainParts.slice(-2).join(".")
        : hostname;

    for (const trustedDomain of trustedDomains) {
        if (domain === trustedDomain) {
            return {
                detected: false,
                message: "Domain matches a trusted domain"
            };
        }

        const distance = levenshteinDistance(domain, trustedDomain);

        if (distance > 0 && distance <= 2) {
            return {
                detected: true,
                message: "Possible typosquatting detected",
                suspiciousDomain: domain,
                similarTo: trustedDomain,
                distance
            };
        }
    }

    return {
        detected: false,
        message: "No obvious typosquatting detected"
    };
}

module.exports = detectTyposquatting;
