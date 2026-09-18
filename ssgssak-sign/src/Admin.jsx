import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';

export default function Admin() {
  const [eventDate, setEventDate] = useState('');
  const [eventItems, setEventItems] = useState([{ id: Date.now(), name: '', date: '' }]);
  const eventItemsRef = useRef([{ id: Date.now(), name: '', date: '' }]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportEvents, setSelectedExportEvents] = useState([]);

  useEffect(() => {
    // Load config once to prevent overwriting user typing
    const loadConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, "config", "appSettings"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedEventName = data.eventName || '';
          const loadedEventDates = data.eventDates || {};
          
          setEventDate(data.eventDate || '');
          
          const names = loadedEventName.split(/,|\n/).map(s => s.trim()).filter(Boolean);
          const newItems = names.map((name, index) => ({
            id: Date.now() + index,
            name: name,
            date: loadedEventDates[name] || data.eventDate || ''
          }));
          
          if (newItems.length > 0) {
            setEventItems(newItems);
            eventItemsRef.current = newItems;
          }
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadConfig();

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
      unsubUsers();
    };
  }, []);

  const saveToFirebase = async (items = eventItemsRef.current) => {
    try {
      const names = items.map(item => item.name.trim()).filter(Boolean);
      const eventNameString = names.join(', ');
      
      const datesObj = {};
      items.forEach(item => {
        if (item.name.trim()) {
          datesObj[item.name.trim()] = item.date;
        }
      });

      await setDoc(doc(db, "config", "appSettings"), { 
        eventName: eventNameString, 
        eventDate, 
        eventDates: datesObj 
      }, { merge: true });
    } catch (error) {
      console.error("Auto-save failed", error);
    }
  };

  // 자동 저장 (타이핑 후 1.5초 뒤 자동 저장)
  useEffect(() => {
    if (!isLoaded) return; 

    const timer = setTimeout(() => {
      saveToFirebase(eventItemsRef.current);
    }, 1500);
    return () => clearTimeout(timer);
  }, [eventItems, eventDate, isLoaded]);

  const eventsList = eventItems.map(item => item.name.trim()).filter(Boolean);
  const derivedEventDates = {};
  eventItems.forEach(item => {
    if (item.name.trim()) derivedEventDates[item.name.trim()] = item.date;
  });

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

  const exportSelectedResults = async () => {
    if (selectedExportEvents.length === 0) {
      alert('내보낼 연수를 선택해주세요.');
      return;
    }
    
    try {
      for (const ev of selectedExportEvents) {
        const workbook = new ExcelJS.Workbook();
        // 엑셀 시트 이름에는 금지된 문자가 있을 수 있으므로 안전하게 변환하거나 자르기
        const safeSheetName = ev.replace(/[\]\[*?:\/\\]/g, '').substring(0, 31) || '서명결과';
        const worksheet = workbook.addWorksheet(safeSheetName);

        worksheet.properties.defaultRowHeight = 60;

        const columns = [
          { header: '이름', key: 'name', width: 20 },
          { header: '연수날짜', key: 'date', width: 20 },
          { header: ev, key: ev, width: 25 }
        ];
        worksheet.columns = columns;

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        users.forEach((u, rowIndex) => {
          // 해당 연수의 개별 날짜 가져오기 (없으면 예전 공통 날짜 사용)
          const dateForEvent = derivedEventDates[ev] || eventDate || '';
          const row = worksheet.addRow({ name: u.name, date: dateForEvent });
          row.alignment = { vertical: 'middle', horizontal: 'center' };

          if (u.signedEvents && u.signedEvents[ev]) {
            const imageId = workbook.addImage({
              base64: u.signedEvents[ev],
              extension: 'png',
            });
            worksheet.addImage(imageId, {
              tl: { col: 2.15, row: rowIndex + 1.1 }, // 가로/세로 오프셋을 주어 가운데 정렬처럼 보이게 함
              ext: { width: 140, height: 50 },
              editAs: 'oneCell'
            });
          } else {
            row.getCell(3).value = '미완료'; 
          }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const safeFileName = ev.replace(/[<>:"/\\|?*]/g, '_');
        saveAs(new Blob([buffer]), `${safeFileName}_서명결과.xlsx`);
      }
      setIsExportModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  const handleExportEventCheck = (ev) => {
    if (selectedExportEvents.includes(ev)) {
      setSelectedExportEvents(selectedExportEvents.filter(e => e !== ev));
    } else {
      setSelectedExportEvents([...selectedExportEvents, ev]);
    }
  };

  const clearData = async () => {
    if(confirm('정말 서명 데이터를 모두 초기화 하시겠습니까? (선생님 명단과 연수 정보는 그대로 유지됩니다)')) {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        querySnapshot.forEach((document) => {
          batch.update(document.ref, { signedEvents: {} });
        });
        await batch.commit();
        alert('모든 서명 내역이 초기화되었습니다.');
      } catch(error) {
        console.error(error);
        alert('초기화 실패');
      }
    }
  };



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
        <p style={{fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px'}}>
          ※ 콤마(,)는 사용할 수 없습니다. 입력 내용은 1.5초 뒤 자동으로 저장됩니다.
        </p>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          {eventItems.map((item, index) => (
            <div key={item.id} style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px'}}>
              <input 
                type="text"
                className="glass-input"
                style={{flex: 1, padding: '8px 12px', fontSize: '15px'}}
                placeholder="연수 이름"
                value={item.name}
                onChange={(e) => {
                  const val = e.target.value.replace(/,/g, ''); // 콤마 방지
                  const newItems = [...eventItems];
                  newItems[index].name = val;
                  setEventItems(newItems);
                  eventItemsRef.current = newItems;
                }}
                onBlur={() => saveToFirebase()}
              />
              <input 
                type="date"
                className="glass-input"
                style={{width: 'auto', padding: '8px 12px', fontSize: '15px'}}
                value={item.date}
                onChange={(e) => {
                  const newItems = [...eventItems];
                  newItems[index].date = e.target.value;
                  setEventItems(newItems);
                  eventItemsRef.current = newItems;
                }}
                onBlur={() => saveToFirebase()}
              />
              <button 
                onClick={() => {
                  const newItems = eventItems.filter(i => i.id !== item.id);
                  setEventItems(newItems);
                  eventItemsRef.current = newItems;
                  saveToFirebase(newItems);
                }}
                style={{background: 'none', border: 'none', color: '#ff758c', cursor: 'pointer', fontSize: '16px', padding: '4px 8px'}}
                title="삭제"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button 
          className="glass-button" 
          style={{marginTop: '12px', background: 'rgba(255,255,255,0.2)'}} 
          onClick={() => {
            const newItems = [...eventItems, { id: Date.now(), name: '', date: '' }];
            setEventItems(newItems);
            eventItemsRef.current = newItems;
          }}
        >
          ➕ 연수 추가
        </button>
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

      <div className="flex-col mt-4">
        <button className="glass-button" style={{width: '100%', background: '#23d5ab'}} onClick={() => {
          setSelectedExportEvents([...eventsList]);
          setIsExportModalOpen(true);
        }}>엑셀로 내보내기</button>
      </div>

      <div className="flex-col mt-4">
        <h2>4. 데이터 관리</h2>
        <p style={{fontSize: '13px', color: '#ff758c', marginBottom: '8px'}}>※ 서명 내역만 깨끗하게 초기화되며, 선생님 명단과 연수 정보는 유지됩니다.</p>
        <button className="glass-button" style={{background: 'rgba(255, 100, 100, 0.2)'}} onClick={clearData}>모든 서명 내역 초기화 (명단 유지)</button>
      </div>

      {isExportModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="glass-card flex-col" style={{width: '90%', maxWidth: '400px', background: 'rgba(30, 30, 40, 0.9)'}}>
            <h2>📥 엑셀 내보내기 선택</h2>
            <p style={{fontSize: '14px', marginBottom: '10px'}}>다운로드할 연수를 선택하세요. 각각의 파일로 다운로드됩니다.</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto'}}>
              {eventsList.map(ev => (
                <label key={ev} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                  <input 
                    type="checkbox" 
                    checked={selectedExportEvents.includes(ev)} 
                    onChange={() => handleExportEventCheck(ev)}
                    style={{width: '20px', height: '20px'}}
                  />
                  {ev}
                </label>
              ))}
            </div>
            <div style={{display: 'flex', gap: '10px', marginTop: '16px'}}>
              <button className="glass-button" style={{flex: 1, background: 'rgba(255,255,255,0.2)'}} onClick={() => setIsExportModalOpen(false)}>취소</button>
              <button className="glass-button" style={{flex: 1, background: '#23d5ab'}} onClick={exportSelectedResults}>다운로드</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
