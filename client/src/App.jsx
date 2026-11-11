
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

const quizQuestions = [
  {
    question: "What is phishing?",
    options: [
      "A computer hardware problem",
      "A fake attempt to steal personal information",
      "A type of antivirus",
      "A website design technique"
    ],
    answer: 1,
    explanation: "Phishing uses deceptive messages or websites to steal sensitive information."
  },
  {
    question: "Which URL looks most suspicious?",
    options: [
      "https://www.google.com",
      "https://www.microsoft.com",
      "https://paypa1-login-example.com",
      "https://www.wikipedia.org"
    ],
    answer: 2,
    explanation: "Attackers often use lookalike characters and misleading domain names."
  },
  {
    question: "What should you check before entering your password?",
    options: [
      "The website address",
      "The page background colour",
      "The number of images",
      "The font size"
    ],
    answer: 0,
    explanation: "Always verify the domain and make sure you are on the legitimate website."
  },
  {
    question: "What does HTTPS indicate?",
    options: [
      "The website is always safe",
      "The connection is encrypted",
      "The website cannot be fake",
      "The website has no advertisements"
    ],
    answer: 1,
    explanation: "HTTPS encrypts the connection, but does not guarantee trustworthiness."
  },
  {
    question: "What should you do with a suspicious link?",
    options: [
      "Open it immediately",
      "Enter your password",
      "Share it with everyone",
      "Avoid opening it and verify its source"
    ],
    answer: 3,
    explanation: "Avoid suspicious links and verify them through a trusted source."
  }
];

// Normalize and validate URLs before sending them to the backend.
function normalizeUrl(value) {
  let cleaned = value.trim().replace(/^["']|["']$/g, "");

  if (!cleaned) {
    throw new Error("Empty URL");
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }

  let parsed;

  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.hostname.includes(".") &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)
  ) {
    throw new Error("Please enter a valid website address");
  }

  return parsed.href;
}

function App() {
  const [page, setPage] = useState("Dashboard");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch(`${API}/history`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load history");
      }

      setHistory(data.scans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const totalScans = history.length;

  const safeScans = history.filter(
    item => item.status === "Low Risk"
  ).length;

  const suspiciousScans = history.filter(
    item => item.status !== "Low Risk"
  ).length;

  // SINGLE WEBSITE SCANNER
  const scanWebsite = async (event) => {
    if (event) event.preventDefault();

    if (!url.trim()) {
      setError("Please enter a website URL.");
      return;
    }

    let website;

    try {
      website = normalizeUrl(url);
    } catch (err) {
      setError(err.message);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API}/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: website })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setResult(data);
      await loadHistory();

    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  // FIXED BULK URL SCANNER
  const runBulkScan = async () => {
    setError("");

    const rawUrls = bulkUrls
      .split(/[\r\n,;]+/)
      .map(item => item.trim())
      .filter(Boolean);

    const uniqueUrls = [...new Set(
      rawUrls.map(item => item.toLowerCase())
    )];

    if (!uniqueUrls.length) {
      setError("Enter at least one website URL.");
      return;
    }

    if (uniqueUrls.length > 20) {
      setError("Maximum 20 URLs per bulk scan.");
      return;
    }

    setBulkResults([]);
    setBulkProgress(0);
    setBulkLoading(true);

    const completed = [];

    for (let i = 0; i < uniqueUrls.length; i++) {
      const originalUrl = rawUrls.find(
        item => item.toLowerCase() === uniqueUrls[i]
      );

      let website;

      try {
        website = normalizeUrl(originalUrl);
      } catch (err) {
        completed.push({
          website: originalUrl,
          status: "Invalid",
          error: err.message
        });

        setBulkResults([...completed]);
        setBulkProgress(
          Math.round(((i + 1) / uniqueUrls.length) * 100)
        );

        continue;
      }

      try {
        const response = await fetch(`${API}/scan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: website
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Scan failed");
        }

        completed.push(data);

      } catch (err) {
        completed.push({
          website,
          status: "Scan Failed",
          error: err.message
        });
      }

      setBulkResults([...completed]);

      setBulkProgress(
        Math.round(((i + 1) / uniqueUrls.length) * 100)
      );
    }

    await loadHistory();
    setBulkLoading(false);
  };

  // CSV / TXT UPLOAD
  const uploadBulkFile = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setBulkUrls(String(reader.result || ""));
      setError("");
    };

    reader.onerror = () => {
      setError("Could not read the uploaded file.");
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  // CLEAR HISTORY
  const clearHistory = async () => {
    if (!window.confirm("Are you sure you want to delete all scan history?")) {
      return;
    }

    try {
      const response = await fetch(`${API}/history`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not clear history");
      }

      setHistory([]);
      setResult(null);
      setBulkResults([]);
      setError("");

    } catch (err) {
      setError(err.message);
    }
  };

  // REPORT DATA
  const reportItems = useMemo(() => {
    const items = [];

    if (result) items.push(result);

    bulkResults.forEach(item => items.push(item));

    return items;
  }, [result, bulkResults]);

  const downloadReport = () => {
    if (!reportItems.length) {
      setError("There are no scan results to include in a report.");
      return;
    }

    setError("");
    window.print();
  };

  // QUIZ
  const quizScore = quizQuestions.filter(
    (question, index) => quizAnswers[index] === question.answer
  ).length;

  const navItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Website Scanner", icon: "⌕" },
    { name: "Bulk URL Scanner", icon: "▱" },
    { name: "Scan History", icon: "◷" },
    { name: "Reports", icon: "▤" },
    { name: "Security Quiz", icon: "♜" },
    { name: "About Project", icon: "ⓘ" }
  ];

  const goTo = (name) => {
    setPage(name);
    setError("");
  };

  const statusClass = (status) => {
    if (status === "Low Risk") return "safe";
    if (status === "Invalid") return "invalid";
    return "danger";
  };

  // DISPLAY SCAN RESULT
  const renderResult = (item, index) => {
    const status = item.analysis?.status || item.status || "Scan Failed";
    const score = item.analysis?.score ?? item.score ?? 0;
    const reasons = item.analysis?.reasons || item.reasons || [];

    return (
      <div className="result-card" key={item._id || `${item.website}-${index}`}>
        <div className="result-top">
          <div>
            <span className="eyebrow">SCAN RESULT</span>
            <h3>{item.website}</h3>
          </div>

          <span className={`status ${statusClass(status)}`}>
            {status}
          </span>
        </div>

        {item.error ? (
          <p className="error-text">{item.error}</p>
        ) : (
          <>
            <div className="score-line">
              <span>Risk score</span>
              <strong>{score}/100</strong>
            </div>

            <div className="score-track">
              <div
                className="score-fill"
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>

            <h4>Detection reasons</h4>

            {reasons.length ? (
              <ul className="reason-list">
                {reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No suspicious indicators detected.</p>
            )}
          </>
        )}
      </div>
    );
  };

  // DASHBOARD
  const renderDashboard = () => (
    <>
      <section className="welcome">
        <div>
          <span className="eyebrow">CYBERSECURITY CONTROL CENTER</span>
          <h1>Welcome to <span>SecureScan</span> 👋</h1>
          <p>Your platform to detect fake, phishing and suspicious websites.</p>

          <button
            className="primary-btn"
            onClick={() => goTo("Website Scanner")}
          >
            ⌕ Start Website Scan
          </button>
        </div>

        <div className="hero-shield">🛡️</div>
      </section>

      <section className="stats-grid">
        <StatCard icon="◎" title="Total Scans" value={totalScans} color="blue" />
        <StatCard icon="✓" title="Safe Websites" value={safeScans} color="green" />
        <StatCard icon="⚠" title="Suspicious Scans" value={suspiciousScans} color="orange" />
        <StatCard icon="▤" title="Reports Ready" value={reportItems.length} color="purple" />
      </section>

      <div className="dashboard-grid">
        <section className="panel quick-panel">
          <PanelTitle
            icon="⚡"
            title="Quick Scan"
            subtitle="Check a website before visiting it."
          />

          <form className="scan-form" onSubmit={scanWebsite}>
            <input
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder="https://example.com"
            />

            <button className="primary-btn" disabled={loading}>
              {loading ? "Scanning..." : "⌕ Scan Website"}
            </button>
          </form>

          <div className="quick-actions">
            <button className="outline-btn" onClick={() => goTo("Bulk URL Scanner")}>
              ▱ Bulk Scan URLs
            </button>

            <button className="outline-btn" onClick={() => goTo("Reports")}>
              ↓ View Reports
            </button>
          </div>
        </section>

        <section className="panel">
          <PanelTitle
            icon="◉"
            title="Risk Overview"
            subtitle="Based on saved scan results."
          />

          <div className="risk-overview">
            <div className="risk-number">
              <strong>
                {totalScans
                  ? Math.round((safeScans / totalScans) * 100)
                  : 0}%
              </strong>
              <span>Low Risk</span>
            </div>

            <div className="risk-legend">
              <p><i className="dot green-dot" /> Safe <b>{safeScans}</b></p>
              <p><i className="dot orange-dot" /> Suspicious <b>{suspiciousScans}</b></p>
            </div>
          </div>
        </section>
      </div>

      {result && (
        <section className="panel">
          <PanelTitle icon="✓" title="Latest Scan Result" />
          {renderResult(result, 0)}
        </section>
      )}

      <section className="panel">
        <div className="section-heading">
          <PanelTitle icon="◷" title="Recent Scans" subtitle="Your latest website checks." />
          <button className="text-btn" onClick={() => goTo("Scan History")}>
            View all →
          </button>
        </div>

        <HistoryTable scans={history.slice(0, 5)} statusClass={statusClass} />
      </section>
    </>
  );

  // SINGLE SCANNER PAGE
  const renderScanner = () => (
    <section className="panel page-panel">
      <PanelTitle
        icon="⌕"
        title="Website Scanner"
        subtitle="Analyze a URL for phishing and suspicious indicators."
      />

      <form className="scan-form large-form" onSubmit={scanWebsite}>
        <input
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="Enter website URL (e.g. https://example.com)"
        />

        <button className="primary-btn" disabled={loading}>
          {loading ? "Analyzing..." : "⌕ Analyze Website"}
        </button>
      </form>

      {loading && <p className="muted">Analyzing website. Please wait...</p>}

      {result && renderResult(result, 0)}
    </section>
  );

  // BULK SCANNER PAGE
  const renderBulk = () => (
    <section className="panel page-panel">
      <PanelTitle
        icon="▱"
        title="Bulk URL Scanner"
        subtitle="Scan up to 20 websites in one operation."
      />

      <textarea
        className="bulk-textarea"
        value={bulkUrls}
        onChange={event => setBulkUrls(event.target.value)}
        placeholder={"google.com\nexample.com\ngooogle.com\n192.168.1.1/login"}
      />

      <div className="bulk-controls">
        <label className="upload-btn">
          ↑ Upload CSV / TXT

          <input
            type="file"
            accept=".csv,.txt"
            onChange={uploadBulkFile}
          />
        </label>

        <button
          className="primary-btn"
          onClick={runBulkScan}
          disabled={bulkLoading}
        >
          {bulkLoading ? "Scanning..." : "Start Bulk Scan"}
        </button>
      </div>

      {bulkLoading && (
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Scanning websites</span>
            <b>{bulkProgress}%</b>
          </div>

          <div className="score-track">
            <div
              className="score-fill"
              style={{ width: `${bulkProgress}%` }}
            />
          </div>
        </div>
      )}

      {bulkResults.length > 0 && (
        <>
          <div className="section-heading">
            <h3>Bulk Scan Results ({bulkResults.length})</h3>

            <button
              className="outline-btn"
              onClick={downloadReport}
            >
              ↓ Print Bulk Report
            </button>
          </div>

          {bulkResults.map(renderResult)}
        </>
      )}
    </section>
  );

  // HISTORY PAGE
  const renderHistory = () => (
    <section className="panel page-panel">
      <div className="section-heading">
        <PanelTitle
          icon="◷"
          title="Scan History"
          subtitle="Previously scanned websites saved in MongoDB."
        />

        <button className="danger-btn" onClick={clearHistory}>
          Clear History
        </button>
      </div>

      {historyLoading ? (
        <p className="muted">Loading history...</p>
      ) : (
        <HistoryTable scans={history} statusClass={statusClass} />
      )}
    </section>
  );

  // REPORTS PAGE
  const renderReports = () => (
    <section className="panel page-panel">
      <PanelTitle
        icon="▤"
        title="Scan Reports"
        subtitle="Prepare printable PDF reports from your scan results."
      />

      <div className="report-summary">
        <div>
          <span>Latest single scan</span>
          <strong>{result ? "Available" : "No report yet"}</strong>
        </div>

        <div>
          <span>Bulk scan results</span>
          <strong>{bulkResults.length} results</strong>
        </div>

        <div>
          <span>Saved scan history</span>
          <strong>{history.length} records</strong>
        </div>
      </div>

      <div className="report-preview">
        <div className="report-icon">PDF</div>

        <div>
          <h3>Website Security Scan Report</h3>
          <p>Includes scan URLs, risk status, scores and detection reasons.</p>
        </div>
      </div>

      <button className="primary-btn" onClick={downloadReport}>
        ↓ Print / Save Scan Report as PDF
      </button>

      <p className="muted small-note">
        In the print window, choose "Save as PDF" as the destination.
      </p>
    </section>
  );

  // QUIZ PAGE
  const renderQuiz = () => (
    <section className="panel page-panel">
      <PanelTitle
        icon="♜"
        title="Security Awareness Quiz"
        subtitle="Test your knowledge of phishing and online safety."
      />

      <div className="quiz-progress">
        {Object.keys(quizAnswers).length} of {quizQuestions.length} answered
      </div>

      {quizQuestions.map((question, index) => (
        <div className="quiz-question" key={index}>
          <h3>{index + 1}. {question.question}</h3>

          <div className="quiz-options">
            {question.options.map((option, optionIndex) => (
              <label
                className={`quiz-option ${
                  quizSubmitted && optionIndex === question.answer
                    ? "correct-option"
                    : ""
                }`}
                key={optionIndex}
              >
                <input
                  type="radio"
                  name={`question-${index}`}
                  checked={quizAnswers[index] === optionIndex}
                  disabled={quizSubmitted}
                  onChange={() =>
                    setQuizAnswers(prev => ({
                      ...prev,
                      [index]: optionIndex
                    }))
                  }
                />

                {option}
              </label>
            ))}
          </div>

          {quizSubmitted && (
            <p className="explanation">
              {quizAnswers[index] === question.answer
                ? "✓ Correct. "
                : "✕ Incorrect. "}
              {question.explanation}
            </p>
          )}
        </div>
      ))}

      {!quizSubmitted ? (
        <button
          className="primary-btn"
          onClick={() => setQuizSubmitted(true)}
          disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
        >
          Submit Answers
        </button>
      ) : (
        <div className="quiz-result">
          <h2>Your score: {quizScore} / {quizQuestions.length}</h2>

          <p>
            {quizScore >= 4
              ? "Excellent! You understand online safety."
              : "Keep learning and stay alert online."}
          </p>

          <button
            className="outline-btn"
            onClick={() => {
              setQuizAnswers({});
              setQuizSubmitted(false);
            }}
          >
            Retake Quiz
          </button>
        </div>
      )}
    </section>
  );

  // ABOUT PAGE
  const renderAbout = () => (
    <section className="panel page-panel about-panel">
      <div className="about-emblem">🛡️</div>

      <span className="eyebrow">PROJECT OVERVIEW</span>

      <h1>Fake Website Detection Tool</h1>

      <p className="about-lead">
        A cybersecurity application designed to identify suspicious
        websites and help users make safer decisions online.
      </p>

      <div className="about-cards">
        <div><h3>Frontend</h3><p>React.js</p></div>
        <div><h3>Backend</h3><p>Node.js & Express.js</p></div>
        <div><h3>Database</h3><p>MongoDB</p></div>
        <div>
          <h3>Detection</h3>
          <p>URL analysis, phishing indicators, typosquatting and homograph checks.</p>
        </div>
      </div>

      <p className="muted">
        This tool provides heuristic risk indicators. A Low Risk result
        does not guarantee that a website is safe.
      </p>
    </section>
  );

  const pageContent = {
    Dashboard: renderDashboard,
    "Website Scanner": renderScanner,
    "Bulk URL Scanner": renderBulk,
    "Scan History": renderHistory,
    Reports: renderReports,
    "Security Quiz": renderQuiz,
    "About Project": renderAbout
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-shield">🛡</div>

          <div>
            <strong>SecureScan</strong>
            <span>Fake Website Detection</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navItems.map(item => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => goTo(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span>✦ SECURITY TIP</span>
          <strong>Think before you click.</strong>
          <p>
            Always verify a website address before sharing personal information.
          </p>
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar">U</div>

          <div>
            <strong>Security User</strong>
            <span>Welcome back!</span>
          </div>

          <span className="online-dot" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / </span>
            <strong>{page}</strong>
          </div>

          <div className="topbar-right">
            <span className="system-status">
              <i /> System Online
            </span>

            <span className="topbar-shield">◆</span>
          </div>
        </header>

        <div className="content-area">
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {pageContent[page]()}
        </div>

        <footer className="main-footer">
          SecureScan · Fake Website Detection Tool · Stay safe online.
        </footer>
      </main>

      {/* PRINT REPORT */}
      <div className="print-only">
        <h1>SecureScan — Website Security Report</h1>

        <p>Generated: {new Date().toLocaleString()}</p>

        <hr />

        {reportItems.map((item, index) => (
          <div className="print-entry" key={index}>
            <h2>{item.website}</h2>

            <p>
              Status: {item.analysis?.status || item.status || "Scan failed"}
            </p>

            <p>
              Risk score: {item.analysis?.score ?? item.score ?? "N/A"}/100
            </p>

            <p>
              Detection reasons: {
                (item.analysis?.reasons || item.reasons || []).join("; ") ||
                "No suspicious indicators detected."
              }
            </p>

            {item.error && <p>Error: {item.error}</p>}

            <hr />
          </div>
        ))}
      </div>
    </div>
  );
}

// STATISTICS CARD
function StatCard({ icon, title, value, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>

      <div className="stat-decoration">⌁</div>
    </div>
  );
}

// PANEL TITLE
function PanelTitle({ icon, title, subtitle }) {
  return (
    <div className="panel-title">
      <div className="panel-icon">{icon}</div>

      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

// HISTORY TABLE
function HistoryTable({ scans, statusClass }) {
  if (!scans.length) {
    return (
      <p className="empty-state">
        No scan records yet. Start by scanning a website.
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Website</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Scanned At</th>
          </tr>
        </thead>

        <tbody>
          {scans.map((scan, index) => (
            <tr key={scan._id || index}>
              <td className="website-cell">{scan.website}</td>

              <td>
                <span className={`status ${statusClass(scan.status)}`}>
                  {scan.status}
                </span>
              </td>

              <td>{scan.score}/100</td>

              <td>
                {scan.scannedAt
                  ? new Date(scan.scannedAt).toLocaleString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
