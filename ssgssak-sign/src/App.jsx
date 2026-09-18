import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams, Navigate } from 'react-router-dom';
import Admin from './Admin';
import Sign from './Sign';
import Landing from './Landing';
import './App.css';

function Navigation() {
  const location = useLocation();
  
  // Extract schoolId from the path if present (e.g., /myschool or /myschool/admin)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const schoolId = pathParts.length > 0 ? pathParts[0] : null;

  // Don't show navigation on the landing page
  if (!schoolId) {
    return null;
  }

  return (
    <nav className="nav-bar">
      <Link 
        to={`/${schoolId}`} 
        className={`nav-link ${location.pathname === `/${schoolId}` ? 'active' : ''}`}
      >
        선생님 서명하기
      </Link>
      <Link 
        to={`/${schoolId}/admin`} 
        className={`nav-link ${location.pathname === `/${schoolId}/admin` ? 'active' : ''}`}
      >
        관리자 페이지
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="glass-container">
        <Navigation />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/:schoolId" element={<Sign />} />
          <Route path="/:schoolId/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <footer className="footer-copyright">
        저작권: &copy; 2026 Hyunsil_ORION. All rights reserved.
      </footer>
    </Router>
  );
}

export default App;
