import { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from './firebase';
import { collection, doc, updateDoc, onSnapshot } from 'firebase/firestore';

export default function Sign() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [eventName, setEventName] = useState('');
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const sigCanvas = useRef({});

  useEffect(() => {
    // Listen to config
    const unsubConfig = onSnapshot(doc(db, "config", "appSettings"), (docSnap) => {
      if (docSnap.exists()) {
        setEventName(docSnap.data().eventName || '');
      }
    });

    // Listen to users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data());
      });
      usersData.sort((a, b) => a.id - b.id);
      setUsers(usersData);
    });

    return () => {
      unsubConfig();
      unsubUsers();
    };
  }, []);

  const handleClear = () => {
    sigCanvas.current.clear();
  };

  const currentUser = users.find(u => u.id.toString() === selectedUser);

  const handleSubmit = async () => {
    try {
      if (selectedEvents.length === 0) {
        alert('참여한 연수를 한 개 이상 선택해주세요!');
        return;
      }
      if (!selectedUser) {
        alert('이름을 선택해주세요!');
        return;
      }
      if (sigCanvas.current.isEmpty()) {
        alert('서명을 해주세요!');
        return;
      }

      // getTrimmedCanvas() 내부의 모듈(trim-canvas)이 Vite와 충돌해서 발생하는 오류를 피하기 위해 getCanvas() 사용
      const signData = sigCanvas.current.getCanvas().toDataURL('image/png');
      
      const newSignedEvents = { ...(currentUser.signedEvents || {}) };
      selectedEvents.forEach(ev => {
        newSignedEvents[ev] = signData;
      });

      const userRef = doc(db, "users", selectedUser);
      await updateDoc(userRef, { signedEvents: newSignedEvents });

      setSubmitted(true);
      alert('제출되었습니다.');
    } catch (error) {
      alert('제출 중 오류가 발생했습니다: ' + error.message);
      console.error(error);
    }
  };

  const eventsList = eventName ? eventName.split(/,|\n/).map(s => s.trim()).filter(Boolean) : [];
  
  // 현재 유저가 서명하지 않은 연수 목록
  const pendingEvents = currentUser ? eventsList.filter(ev => !(currentUser.signedEvents && currentUser.signedEvents[ev])) : [];
  const isAllSigned = currentUser && eventsList.length > 0 && pendingEvents.length === 0;

  const handleEventCheck = (ev) => {
    if (selectedEvents.includes(ev)) {
      setSelectedEvents(selectedEvents.filter(e => e !== ev));
    } else {
      setSelectedEvents([...selectedEvents, ev]);
    }
  };

  if (submitted) {
    return (
      <div className="glass-card flex-col flex-center" style={{textAlign: 'center'}}>
        <h1 style={{fontSize: '48px', margin: '0'}}>🎉</h1>
        <h2>서명이 완료되었습니다!</h2>
        <p>수고하셨습니다. 이제 칼퇴근(또는 다음 업무) 하셔도 좋습니다!</p>
        <button className="glass-button mt-4" onClick={() => {
          setSubmitted(false);
          setSelectedUser('');
          setSelectedEvents([]);
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
            setSelectedEvents([]);
            if(sigCanvas.current && sigCanvas.current.clear) sigCanvas.current.clear();
          }}
        >
          <option value="">이름을 선택하세요</option>
          {users.map(user => {
            const userPending = eventsList.filter(ev => !(user.signedEvents && user.signedEvents[ev]));
            const isUserAllSigned = eventsList.length > 0 && userPending.length === 0;
            return (
              <option key={user.id} value={user.id}>
                {user.name} {isUserAllSigned ? '(전체 서명완료)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {isAllSigned ? (
        <div className="mt-4" style={{textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px'}}>
          <p>✅ 모든 연수에 서명이 완료된 선생님입니다.</p>
        </div>
      ) : (
        <>
          {currentUser && eventsList.length > 0 && (
            <div className="flex-col mt-4">
              <label style={{fontWeight: 600}}>2. 서명할 연수 선택</label>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px'}}>
                {pendingEvents.map(ev => (
                  <label key={ev} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={selectedEvents.includes(ev)} 
                      onChange={() => handleEventCheck(ev)}
                      style={{width: '20px', height: '20px'}}
                    />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex-col mt-4">
            <label style={{fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
              <span>3. 서명 패드 (아래 빈칸에 서명하세요)</span>
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
