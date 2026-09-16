import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Admin from './Admin';
import Sign from './Sign';
import './App.css';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="nav-bar">
      <Link 
        to="/" 
        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
      >
        선생님 서명하기
      </Link>
      <Link 
        to="/admin" 
        className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
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
          <Route path="/" element={<Sign />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
