import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function Sign() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [eventName, setEventName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const sigCanvas = useRef({});

  useEffect(() => {
    const savedEvent = localStorage.getItem('ssgssak_event');
    const savedUsers = localStorage.getItem('ssgssak_users');
    if (savedEvent) setEventName(savedEvent);
    if (savedUsers) setUsers(JSON.parse(savedUsers));
  }, []);

  const handleClear = () => {
    sigCanvas.current.clear();
  };

  const handleSubmit = () => {
    if (!selectedUser) {
      alert('이름을 선택해주세요!');
      return;
    }
    if (sigCanvas.current.isEmpty()) {
      alert('서명을 해주세요!');
      return;
    }

    const signData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    
    const updatedUsers = users.map(u => {
      if (u.id.toString() === selectedUser) {
        return { ...u, signed: true, signData };
      }
      return u;
    });

    setUsers(updatedUsers);
    localStorage.setItem('ssgssak_users', JSON.stringify(updatedUsers));
    setSubmitted(true);
  };

  const currentUser = users.find(u => u.id.toString() === selectedUser);

  if (submitted) {
    return (
      <div className="glass-card flex-col flex-center" style={{textAlign: 'center'}}>
        <h1 style={{fontSize: '48px', margin: '0'}}>🎉</h1>
        <h2>서명이 완료되었습니다!</h2>
        <p>수고하셨습니다. 이제 칼퇴근(또는 다음 업무) 하셔도 좋습니다!</p>
        <button className="glass-button mt-4" onClick={() => {
          setSubmitted(false);
          setSelectedUser('');
        }}>다른 사람 서명하기</button>
      </div>
    );
  }

  return (
    <div className="glass-card flex-col">
      <h2 style={{ whiteSpace: 'pre-wrap' }}>📝 {eventName || '연수 서명'}</h2>
      
      <div className="flex-col">
        <label style={{fontWeight: 600}}>1. 본인 이름 선택</label>
        <select 
          className="glass-select" 
          value={selectedUser} 
          onChange={(e) => {
            setSelectedUser(e.target.value);
            if(sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear();
          }}
        >
          <option value="">이름을 선택하세요</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.name} {user.signed ? '(서명완료)' : ''}
            </option>
          ))}
        </select>
      </div>

      {currentUser && currentUser.signed ? (
        <div className="mt-4" style={{textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px'}}>
          <p>✅ 이미 서명이 완료된 선생님입니다.</p>
        </div>
      ) : (
        <>
          <div className="flex-col mt-4">
            <label style={{fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
              <span>2. 서명 패드 (아래 빈칸에 서명하세요)</span>
              <button 
                onClick={handleClear} 
                style={{background: 'none', border: 'none', color: '#ff758c', cursor: 'pointer', textDecoration: 'underline'}}
              >
                지우기
              </button>
            </label>
            <div className="signature-pad-container">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{width: 500, height: 200, className: 'sigCanvas', style: { width: '100%', height: '200px' }}} 
              />
            </div>
          </div>
          <button className="glass-button mt-4" onClick={handleSubmit}>제출하기 🚀</button>
        </>
      )}
    </div>
  );
}
