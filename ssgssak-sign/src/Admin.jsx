import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';

export default function Admin() {
  const [eventName, setEventName] = useState('');
  const [users, setUsers] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

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
      // 정렬: id 순으로
      usersData.sort((a, b) => a.id - b.id);
      setUsers(usersData);
    });

    return () => {
      unsubConfig();
      unsubUsers();
    };
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const names = data
        .map(row => row[0])
        .filter(name => name && typeof name === 'string' && name.trim() !== '' && name !== '이름' && name !== '성명');
      
      const newUsers = names.map((name, index) => ({
        id: index + 1,
        name: name.trim(),
        signedEvents: {}
      }));

      try {
        // 기존 유저 데이터 지우기
        const querySnapshot = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        
        querySnapshot.forEach((document) => {
          batch.delete(document.ref);
        });

        // 새 유저 데이터 추가
        newUsers.forEach((u) => {
          const docRef = doc(collection(db, "users"), u.id.toString());
          batch.set(docRef, u);
        });

        await batch.commit();
        alert(`${newUsers.length}명의 명단이 Firestore에 업로드 되었습니다!`);
      } catch (error) {
        console.error("업로드 중 오류 발생:", error);
        alert("업로드 중 오류가 발생했습니다.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['이름'], ['홍길동'], ['김철수']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "명단양식");
    XLSX.writeFile(wb, "선생님_명단_양식.xlsx");
  };

  const saveEvent = async () => {
    try {
      await setDoc(doc(db, "config", "appSettings"), { eventName });
      alert('연수 정보가 저장되었습니다!');
    } catch (error) {
      console.error(error);
      alert('저장 실패!');
    }
  };

  const exportResults = async () => {
    try {
      const eventsList = eventName.split(/,|\n/).map(s => s.trim()).filter(Boolean);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('서명결과');

      // 서명 이미지가 잘 보이도록 기본 행 높이 설정
      worksheet.properties.defaultRowHeight = 60;

      // 헤더 설정
      const columns = [{ header: '이름', key: 'name', width: 20 }];
      eventsList.forEach(ev => {
        columns.push({ header: ev, key: ev, width: 25 });
      });
      worksheet.columns = columns;

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 각 선생님 데이터 및 이미지 삽입
      users.forEach((u, rowIndex) => {
        const row = worksheet.addRow({ name: u.name });
        row.alignment = { vertical: 'middle', horizontal: 'center' };

        eventsList.forEach((ev, colIndex) => {
          if (u.signedEvents && u.signedEvents[ev]) {
            // Base64 이미지를 엑셀 워크북에 추가
            const imageId = workbook.addImage({
              base64: u.signedEvents[ev],
              extension: 'png',
            });
            
            // 이미지를 특정 셀 위치에 넣기 (tl: Top-Left 좌표)
            // col 0 = 이름, col 1 = 첫번째 이벤트 (0-indexed)
            // row 0 = 헤더, row 1 = 첫번째 선생님 (0-indexed)
            worksheet.addImage(imageId, {
              tl: { col: colIndex + 1, row: rowIndex + 1 },
              ext: { width: 140, height: 60 } // 셀 크기에 맞게 이미지 크기 조정
            });
          } else {
            // 서명이 없는 경우 텍스트 삽입 (getCell은 1-indexed)
            row.getCell(colIndex + 2).value = '미완료'; 
          }
        });
      });

      // 파일 다운로드
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), '서명결과.xlsx');
    } catch (error) {
      console.error(error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const clearData = async () => {
    if(confirm('정말 모든 데이터를 초기화 하시겠습니까?')) {
      try {
        await setDoc(doc(db, "config", "appSettings"), { eventName: '' });
        const querySnapshot = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        querySnapshot.forEach((document) => {
          batch.delete(document.ref);
        });
        await batch.commit();
        alert('모든 데이터가 초기화되었습니다.');
      } catch(error) {
        console.error(error);
        alert('초기화 실패');
      }
    }
  };

  const eventsList = eventName.split(/,|\n/).map(s => s.trim()).filter(Boolean);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'happy2026') {
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
        <h2>3. 실시간 서명 현황 ({users.length}명)</h2>
        <div className="user-list">
          {users.map(user => (
            <div key={user.id} className="user-item" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}>
              <span style={{fontWeight: 'bold'}}>{user.name} 선생님</span>
              <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                {eventsList.map(ev => {
                  const isSigned = user.signedEvents && user.signedEvents[ev];
                  return (
                    <span key={ev} className={`status-badge ${isSigned ? 'status-done' : 'status-pending'}`} style={{fontSize: '11px', padding: '4px 8px'}}>
                      {ev}: {isSigned ? '완료' : '미완료'}
                    </span>
                  );
                })}
              </div>
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
