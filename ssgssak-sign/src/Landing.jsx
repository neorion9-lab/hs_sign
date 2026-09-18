import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const [schoolId, setSchoolId] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (schoolId.trim()) {
      navigate(`/${schoolId.trim()}`);
    }
  };

  return (
    <div className="glass-card flex-col flex-center" style={{textAlign: 'center', minHeight: '400px'}}>
      <h1 style={{fontSize: '64px', margin: '0 0 20px 0'}}>🏫</h1>
      <h2>우리 학교 전자서명 입장하기</h2>
      <p style={{fontSize: '15px', color: 'rgba(255,255,255,0.8)', marginBottom: '30px'}}>
        부여받은 학교 코드(영문/숫자)를 입력해주세요.
      </p>
      
      <form onSubmit={handleJoin} className="flex-col" style={{width: '100%', maxWidth: '350px', margin: '0 auto'}}>
        <input 
          type="text" 
          className="glass-input" 
          placeholder="학교 코드 (예: myschool)" 
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} 
          style={{textAlign: 'center', fontSize: '20px', fontWeight: 'bold', padding: '15px'}}
        />
        <button type="submit" className="glass-button mt-4" style={{fontSize: '18px', padding: '15px'}}>
          입장하기 🚀
        </button>
      </form>
    </div>
  );
}
