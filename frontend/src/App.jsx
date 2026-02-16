import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function App() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">📊</span>
          <div>
            <div className="brand-title">Result Analytics</div>
            <div className="brand-subtitle">DSCE Batch Insights</div>
          </div>
        </div>
        <nav className="nav">
          <NavItem to="/" label="Dashboard" currentPath={location.pathname} />
          <NavItem
            to="/health"
            label="API Health"
            currentPath={location.pathname}
          />
          <NavItem
            to="/analyze"
            label="Analyze Results"
            currentPath={location.pathname}
          />
        </nav>
        <div className="api-base">
          <div className="api-base-label">Backend URL</div>
          <div className="api-base-value">{API_BASE_URL}</div>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/analyze" element={<AnalyzeResultsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({ to, label, currentPath }) {
  const isActive = currentPath === to

  return (
    <NavLink
      to={to}
      className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
    >
      {label}
    </NavLink>
  )
}

function Dashboard() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Welcome</h1>
        <p>
          Use this interface to call your FastAPI backend, monitor its health,
          and run batch result analytics for DSCE students.
        </p>
      </header>

      <div className="cards-grid">
        <div className="card card-highlight">
          <h2>API Health</h2>
          <p>Quickly verify that the backend server is up and reachable.</p>
          <NavLink to="/health" className="card-button">
            Go to Health Page
          </NavLink>
        </div>
        <div className="card card-highlight">
          <h2>Analyze Results</h2>
          <p>
            Enter department and year to automatically fetch all students' results
            and get toppers, lowest performers, averages and more.
          </p>
          <NavLink to="/analyze" className="card-button">
            Go to Analytics
          </NavLink>
        </div>
      </div>
    </section>
  )
}

function HealthPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchHealth = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE_URL}/health`)
      if (!res.ok) {
        throw new Error(`Status ${res.status}`)
      }
      const data = await res.json()
      setStatus(data.status ?? 'unknown')
    } catch (err) {
      setError(err.message || 'Failed to reach backend')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusClass =
    status === 'ok' ? 'pill pill-success' : status ? 'pill pill-warn' : ''

  return (
    <section className="page">
      <header className="page-header">
        <h1>API Health</h1>
        <p>Ping the FastAPI backend and see its current status.</p>
      </header>

      <div className="card">
        <div className="health-row">
          <div>
            <div className="label">Current status</div>
            {loading && <div className="muted">Checking...</div>}
            {!loading && status && (
              <span className={statusClass}>{status}</span>
            )}
            {!loading && error && (
              <span className="pill pill-error">Error</span>
            )}
          </div>
          <button onClick={fetchHealth} disabled={loading}>
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
        {error && <p className="error-text">Error: {error}</p>}
      </div>
    </section>
  )
}

function AnalyzeResultsPage() {
  const [dept, setDept] = useState('CS')
  const [year, setYear] = useState('23')
  const [delaySeconds, setDelaySeconds] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(`${API_BASE_URL}/analyze-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dept,
          year,
          delay_seconds: Number(delaySeconds),
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(
          `Backend error (${res.status}): ${
            text || res.statusText || 'Unknown error'
          }`,
        )
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  const summary = data?.summary
  const topper = data?.topper
  const lowest = data?.lowest

  return (
    <section className="page">
      <header className="page-header">
        <h1>Analyze Results</h1>
        <p>
          Enter department and year to automatically fetch and analyze all students' results.
          View toppers, lowest performers, averages, percentiles and SGPA distribution.
        </p>
      </header>

      <div className="layout-two-columns">
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2 className="card-title">Batch Parameters</h2>

          <div className="form-grid">
            <div className="field">
              <label>Department Code</label>
              <input
                type="text"
                value={dept}
                onChange={(e) => setDept(e.target.value.toUpperCase())}
                maxLength={3}
                required
                placeholder="CS / CG / ET"
              />
            </div>

            <div className="field">
              <label>Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                maxLength={2}
                required
                placeholder="23"
              />
            </div>

            <div className="field">
              <label>
                Delay between requests (seconds)
                <span className="label-hint">(to avoid blocking server)</span>
              </label>
              <input
                type="number"
                step="0.25"
                min={0}
                max={3}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
          {error && <p className="error-text">Error: {error}</p>}
          {loading && (
            <p className="muted small">
              Automatically fetching all students' results from the university server.
              This may take a while as we scan through all roll numbers...
            </p>
          )}
        </form>

        <div className="results-column">
          {!data && !loading && (
            <div className="card empty-state">
              <h2>No data yet</h2>
              <p>Submit the form to see analytics for a batch.</p>
            </div>
          )}

          {data && (
            <>
              <div className="card">
                <h2 className="card-title">Summary</h2>
                <div className="summary-grid">
                  <SummaryItem
                    label="Total Students"
                    value={summary.total_students}
                  />
                  <SummaryItem
                    label="Average SGPA"
                    value={summary.average_sgpa}
                  />
                  <SummaryItem
                    label="Median SGPA"
                    value={summary.median_sgpa}
                  />
                  <SummaryItem
                    label="Std Dev"
                    value={summary.std_dev_sgpa}
                  />
                  <SummaryItem label="Min SGPA" value={summary.min_sgpa} />
                  <SummaryItem label="Max SGPA" value={summary.max_sgpa} />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">Percentiles</h2>
                <div className="summary-grid">
                  <SummaryItem
                    label="25th percentile"
                    value={summary.percentiles.p25}
                  />
                  <SummaryItem
                    label="50th percentile"
                    value={summary.percentiles.p50}
                  />
                  <SummaryItem
                    label="75th percentile"
                    value={summary.percentiles.p75}
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">SGPA Distribution</h2>
                <DistributionChart distribution={summary.distribution} />
              </div>

              <div className="card">
                <h2 className="card-title">Top & Lowest Performers</h2>
                <div className="two-columns">
                  <PerformerList
                    title="Top 5"
                    items={data.top_performers}
                    highlight="high"
                  />
                  <PerformerList
                    title="Lowest 5"
                    items={data.lowest_performers}
                    highlight="low"
                  />
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">All Students ({data.results?.length || 0})</h2>
                <AllStudentsTable students={data.results || []} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
    </div>
  )
}

function DistributionChart({ distribution }) {
  const entries = Object.entries(distribution || {})
  if (!entries.length) return <p className="muted">No distribution data.</p>

  const maxCount = Math.max(...entries.map(([, v]) => v)) || 1

  return (
    <div className="dist-chart">
      {entries.map(([label, count]) => {
        const width = `${(count / maxCount) * 100 || 5}%`
        return (
          <div key={label} className="dist-row">
            <span className="dist-label">{label}</span>
            <div className="dist-bar-wrapper">
              <div className="dist-bar" style={{ width }} />
            </div>
            <span className="dist-count">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function PerformerList({ title, items, highlight }) {
  if (!items?.length) {
    return (
      <div>
        <h3>{title}</h3>
        <p className="muted small">No data.</p>
      </div>
    )
  }

  return (
    <div>
      <h3>{title}</h3>
      <table className={`perf-table perf-table-${highlight}`}>
        <thead>
          <tr>
            <th>USN</th>
            <th>Name</th>
            <th>SGPA</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.usn}>
              <td>{s.usn}</td>
              <td>{s.name}</td>
              <td>{s.sgpa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AllStudentsTable({ students }) {
  const [sortBy, setSortBy] = useState('sgpa')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchTerm, setSearchTerm] = useState('')

  if (!students?.length) {
    return <p className="muted">No students found.</p>
  }

  const filtered = students.filter(
    (s) =>
      s.usn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]

    if (sortBy === 'sgpa') {
      aVal = Number(aVal)
      bVal = Number(bVal)
    } else {
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    }
  })

  const rankedStudents = sorted.map((student, index) => {
    let rank = index + 1
    if (index > 0 && sorted[index - 1].sgpa === student.sgpa) {
      const firstWithSameSGPA = sorted.findIndex(
        (s) => s.sgpa === student.sgpa
      )
      rank = firstWithSameSGPA + 1
    }
    return { ...student, rank }
  })

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getSGPAColor = (sgpa) => {
    if (sgpa >= 9.0) return 'sgpa-excellent'
    if (sgpa >= 8.0) return 'sgpa-great'
    if (sgpa >= 7.0) return 'sgpa-good'
    if (sgpa >= 6.0) return 'sgpa-average'
    return 'sgpa-low'
  }

  const getPDFUrl = (usn) => {
    return `http://14.99.184.178:8080/birt/frameset?__report=mydsi/exam/Exam_Result_Sheet_dsce.rptdesign&__format=pdf&USN=${usn}`
  }

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇 1'
    if (rank === 2) return '🥈 2'
    if (rank === 3) return '🥉 3'
    return rank
  }

  return (
    <div className="all-students-container">
      <div className="table-controls">
        <input
          type="text"
          placeholder="Search by USN or Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="table-info">
          Showing {sorted.length} of {students.length} students
        </div>
      </div>

      <div className="table-wrapper">
        <table className="all-students-table">
          <thead>
            <tr>
              <th className="rank-header">Rank</th>
              <th className="sortable" onClick={() => handleSort('usn')}>
                USN
              </th>
              <th className="sortable" onClick={() => handleSort('name')}>
                Name
              </th>
              <th className="sortable" onClick={() => handleSort('sgpa')}>
                SGPA
              </th>
            </tr>
          </thead>

          <tbody>
            {rankedStudents.map((student, idx) => {
              const isSpecial = student.usn === "1DS23ET057"

              return (
                <tr
                  key={student.usn}
                  className={idx % 2 === 0 ? 'even-row' : 'odd-row'}
                >
                  {/* Rank */}
                  <td
                    className={`rank-cell ${
                      isSpecial ? 'special-pink' : ''
                    }`}
                  >
                    {getRankDisplay(student.rank)}
                  </td>

                  {/* USN */}
                  <td className="usn-cell">{student.usn}</td>

                  {/* Name */}
                  <td
                    className={`name-cell ${
                      isSpecial ? 'special-pink' : ''
                    }`}
                  >
                   <a
  href={getPDFUrl(student.usn)}
  target="_blank"
  rel="noopener noreferrer"
  className="name-link"
>
  {student.name}
  {student.usn === "1DS23ET057" && (
    <span className="special-heart"> ❤️</span>
  )}
</a>
                  </td>

                  {/* SGPA */}
                  <td
                    className={`sgpa-cell ${getSGPAColor(
                      student.sgpa
                    )} ${isSpecial ? 'special-pink' : ''}`}
                  >
                    {student.sgpa}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default App
