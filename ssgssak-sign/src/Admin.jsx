import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function Admin() {
  const [eventName, setEventName] = useState('');
  const [users, setUsers] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    // Load from local storage
    const savedEvent = localStorage.getItem('ssgssak_event');
    const savedUsers = localStorage.getItem('ssgssak_users');
    if (savedEvent) setEventName(savedEvent);
    if (savedUsers) setUsers(JSON.parse(savedUsers));
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      // Assuming first column is the name
      const names = data
        .map(row => row[0])
        .filter(name => name && typeof name === 'string' && name.trim() !== '' && name !== '이름' && name !== '성명');
      
      const newUsers = names.map((name, index) => ({
        id: index + 1,
        name: name.trim(),
        signed: false,
        signData: null
      }));

      setUsers(newUsers);
      localStorage.setItem('ssgssak_users', JSON.stringify(newUsers));
      alert(`${newUsers.length}명의 명단이 업로드 되었습니다!`);
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['이름'], ['홍길동'], ['김철수']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "명단양식");
    XLSX.writeFile(wb, "선생님_명단_양식.xlsx");
  };

  const saveEvent = () => {
    localStorage.setItem('ssgssak_event', eventName);
    alert('연수 정보가 저장되었습니다!');
  };

  const exportResults = () => {
    const data = users.map(u => ({
      '이름': u.name,
      '서명상태': u.signed ? '완료' : '미완료'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "서명결과");
    XLSX.writeFile(wb, `${eventName || '연수'}_서명결과.xlsx`);
  };

  const clearData = () => {
    if(confirm('정말 모든 데이터를 초기화 하시겠습니까?')) {
      localStorage.removeItem('ssgssak_event');
      localStorage.removeItem('ssgssak_users');
      setEventName('');
      setUsers([]);
    }
  };

  const signedCount = users.filter(u => u.signed).length;

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'gaewon2026') {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다!');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-card flex-col flex-center" style={{textAlign: 'center', minHeight: '300px'}}>
        <h2>🔒 관리자 인증</h2>
        <form onSubmit={handleLogin} className="flex-col" style={{width: '100%', maxWidth: '300px', margin: '0 auto'}}>
          <input 
            type="password" 
            className="glass-input" 
            placeholder="비밀번호를 입력하세요" 
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button type="submit" className="glass-button mt-4">접속하기</button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-card flex-col">
      <h1>👑 관리자 대시보드</h1>
      
      <div className="flex-col">
        <h2>1. 연수 정보 설정</h2>
        <textarea 
          className="glass-input" 
          placeholder="연수명을 입력하세요 (여러 개일 경우 쉼표(,)나 엔터로 구분해 주세요!)" 
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          rows="3"
        />
        <button className="glass-button" onClick={saveEvent}>연수 정보 저장</button>
      </div>

      <div className="flex-col mt-4">
        <h2>2. 명단 업로드 (Excel)</h2>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <p style={{fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: 0}}>* 엑셀의 첫 번째 열(A열)에 이름이 쭉~ 적혀있어야 해요!</p>
          <button onClick={downloadTemplate} style={{background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px'}}>양식 다운로드</button>
        </div>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={handleFileUpload} 
          style={{color: 'white', marginTop: '8px'}}
        />
      </div>

      <div className="flex-col mt-4">
        <h2>3. 실시간 서명 현황 ({signedCount} / {users.length})</h2>
        <div className="user-list">
          {users.map(user => (
            <div key={user.id} className="user-item">
              <span>{user.name} 선생님</span>
              <span className={`status-badge ${user.signed ? 'status-done' : 'status-pending'}`}>
                {user.signed ? '서명 완료' : '미완료'}
              </span>
            </div>
          ))}
          {users.length === 0 && <p style={{textAlign: 'center', padding: '20px'}}>아직 업로드된 명단이 없습니다.</p>}
        </div>
      </div>

      <div className="flex-col mt-4" style={{flexDirection: 'row', gap: '10px'}}>
        <button className="glass-button" style={{flex: 1, background: '#23d5ab'}} onClick={exportResults}>엑셀로 내보내기</button>
        <button className="glass-button" style={{flex: 1, background: 'rgba(255,255,255,0.2)'}} onClick={clearData}>초기화</button>
      </div>
    </div>
  );
}
