class SpeechRecognitionApp {
    constructor() {
        this.socket = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isConnected = false;
        this.transcriptions = [];
        this.recordingStartTime = null;
        this.totalRecordingTime = 0;
        
        // DOM 요소들
        this.elements = {
            websocketUrl: document.getElementById('websocket-url'),
            connectBtn: document.getElementById('connect-btn'),
            startRecording: document.getElementById('start-recording'),
            stopRecording: document.getElementById('stop-recording'),
            clearTranscriptions: document.getElementById('clear-transcriptions'),
            connectionStatus: document.getElementById('connection-status'),
            recordingStatus: document.getElementById('recording-status'),
            transcriptionsContainer: document.getElementById('transcriptions-container'),
            transcriptionsList: document.getElementById('transcriptions-list'),
            emptyState: document.getElementById('empty-state'),
            transcriptionCount: document.getElementById('transcription-count'),
            totalRecordingTime: document.getElementById('total-recording-time'),
            totalSentences: document.getElementById('total-sentences'),
            totalCharacters: document.getElementById('total-characters'),
            alertContainer: document.getElementById('alert-container'),
            exportModal: new bootstrap.Modal(document.getElementById('exportModal')),
            exportText: document.getElementById('export-text'),
            copyText: document.getElementById('copy-text')
        };
        
        this.initializeEventListeners();
        this.updateUI();
    }
    
    initializeEventListeners() {
        // 연결 버튼
        this.elements.connectBtn.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });
        
        // 녹음 버튼들
        this.elements.startRecording.addEventListener('click', () => this.startRecording());
        this.elements.stopRecording.addEventListener('click', () => this.stopRecording());
        this.elements.clearTranscriptions.addEventListener('click', () => this.clearTranscriptions());
        
        // 복사 버튼
        this.elements.copyText.addEventListener('click', () => this.copyToClipboard());
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                if (!this.isRecording) {
                    this.startRecording();
                } else {
                    this.stopRecording();
                }
            }
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.exportTranscriptions();
            }
        });
        
        // 통계 업데이트 타이머
        setInterval(() => this.updateRecordingTime(), 1000);
    }
    
    connect() {
        const url = this.elements.websocketUrl.value.trim();
        if (!url) {
            this.showAlert('WebSocket URL을 입력하세요.', 'warning');
            return;
        }
        
        this.updateConnectionStatus('connecting', '연결 중...');
        this.elements.connectBtn.disabled = true;
        
        try {
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                this.isConnected = true;
                this.updateConnectionStatus('connected', '연결됨');
                this.elements.connectBtn.textContent = '연결 해제';
                this.elements.connectBtn.className = 'btn btn-outline-danger w-100';
                this.elements.connectBtn.disabled = false;
                this.elements.startRecording.disabled = false;
                this.showAlert('서버에 연결되었습니다.', 'success');
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.error) {
                        this.showAlert(`오류: ${data.error}`, 'danger');
                    } else {
                        this.addTranscription(data);
                    }
                } catch (e) {
                    // 단순 텍스트인 경우
                    this.addTranscription({
                        text: event.data,
                        timestamp: new Date().toISOString(),
                        language: 'unknown'
                    });
                }
            };
            
            this.socket.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', '연결 끊김');
                this.elements.connectBtn.textContent = '연결';
                this.elements.connectBtn.className = 'btn btn-outline-primary w-100';
                this.elements.connectBtn.disabled = false;
                this.elements.startRecording.disabled = true;
                this.elements.stopRecording.disabled = true;
                if (this.isRecording) {
                    this.stopRecording();
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                this.showAlert('WebSocket 연결 오류가 발생했습니다.', 'danger');
                this.elements.connectBtn.disabled = false;
            };
            
        } catch (error) {
            this.showAlert(`연결 실패: ${error.message}`, 'danger');
            this.elements.connectBtn.disabled = false;
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
        if (this.isRecording) {
            this.stopRecording();
        }
    }
    
    async startRecording() {
        if (!this.isConnected) {
            this.showAlert('먼저 서버에 연결하세요.', 'warning');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.sendAudioData();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start(1000); // 1초마다 데이터 수집
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.updateRecordingStatus();
            this.updateUI();
            
        } catch (error) {
            console.error('마이크 접근 오류:', error);
            this.showAlert('마이크 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.', 'danger');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            if (this.recordingStartTime) {
                this.totalRecordingTime += Date.now() - this.recordingStartTime;
                this.recordingStartTime = null;
            }
            this.updateRecordingStatus();
            this.updateUI();
        }
    }
    
    sendAudioData() {
        if (this.audioChunks.length === 0) return;
        
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = () => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(reader.result);
            }
        };
        
        reader.readAsArrayBuffer(audioBlob);
    }
    
    addTranscription(data) {
        const transcription = {
            id: Date.now() + Math.random(),
            text: data.text,
            timestamp: data.timestamp || new Date().toISOString(),
            language: data.language || 'unknown'
        };
        
        this.transcriptions.push(transcription);
        this.renderTranscription(transcription);
        this.updateStatistics();
        this.elements.emptyState.style.display = 'none';
    }
    
    renderTranscription(transcription) {
        const transcriptionEl = document.createElement('div');
        transcriptionEl.className = 'transcription-item p-3 mb-3';
        transcriptionEl.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge transcription-language">${this.getLanguageName(transcription.language)}</span>
                <small class="transcription-meta">${this.formatTimestamp(transcription.timestamp)}</small>
            </div>
            <div class="transcription-text">${transcription.text}</div>
            <div class="mt-2">
                <button class="btn btn-sm btn-outline-primary me-2" onclick="app.copyTranscription('${transcription.id}')">
                    <i class="fas fa-copy"></i> 복사
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="app.deleteTranscription('${transcription.id}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
            </div>
        `;
        
        this.elements.transcriptionsList.appendChild(transcriptionEl);
        this.elements.transcriptionsContainer.scrollTop = this.elements.transcriptionsContainer.scrollHeight;
    }
    
    copyTranscription(id) {
        const transcription = this.transcriptions.find(t => t.id == id);
        if (transcription) {
            navigator.clipboard.writeText(transcription.text).then(() => {
                this.showAlert('텍스트가 클립보드에 복사되었습니다.', 'success');
            });
        }
    }
    
    deleteTranscription(id) {
        this.transcriptions = this.transcriptions.filter(t => t.id != id);
        this.renderAllTranscriptions();
        this.updateStatistics();
    }
    
    clearTranscriptions() {
        if (this.transcriptions.length === 0) return;
        
        if (confirm('모든 인식 결과를 삭제하시겠습니까?')) {
            this.transcriptions = [];
            this.elements.transcriptionsList.innerHTML = '';
            this.elements.emptyState.style.display = 'block';
            this.updateStatistics();
            this.showAlert('모든 인식 결과가 삭제되었습니다.', 'info');
        }
    }
    
    renderAllTranscriptions() {
        this.elements.transcriptionsList.innerHTML = '';
        this.transcriptions.forEach(transcription => {
            this.renderTranscription(transcription);
        });
        
        if (this.transcriptions.length === 0) {
            this.elements.emptyState.style.display = 'block';
        }
    }
    
    exportTranscriptions() {
        if (this.transcriptions.length === 0) {
            this.showAlert('내보낼 내용이 없습니다.', 'warning');
            return;
        }
        
        const text = this.transcriptions.map(t => 
            `[${this.formatTimestamp(t.timestamp)}] ${t.text}`
        ).join('\n\n');
        
        this.elements.exportText.value = text;
        this.elements.exportModal.show();
    }
    
    copyToClipboard() {
        this.elements.exportText.select();
        navigator.clipboard.writeText(this.elements.exportText.value).then(() => {
            this.showAlert('텍스트가 클립보드에 복사되었습니다.', 'success');
            this.elements.exportModal.hide();
        }).catch(() => {
            // Fallback for older browsers
            document.execCommand('copy');
            this.showAlert('텍스트가 클립보드에 복사되었습니다.', 'success');
            this.elements.exportModal.hide();
        });
    }
    
    updateConnectionStatus(status, text) {
        const statusEl = this.elements.connectionStatus;
        const icon = statusEl.querySelector('i');
        
        // 모든 상태 클래스 제거
        statusEl.classList.remove('status-connected', 'status-disconnected', 'status-connecting');
        icon.classList.remove('fa-circle', 'fa-spinner', 'fa-spin', 'text-success', 'text-danger', 'text-warning');
        
        switch (status) {
            case 'connected':
                statusEl.classList.add('status-connected');
                icon.classList.add('fa-circle', 'text-success');
                break;
            case 'disconnected':
                statusEl.classList.add('status-disconnected');
                icon.classList.add('fa-circle', 'text-danger');
                break;
            case 'connecting':
                statusEl.classList.add('status-connecting');
                icon.classList.add('fa-spinner', 'fa-spin', 'text-warning');
                break;
        }
        
        statusEl.childNodes[1].textContent = ' ' + text;
    }
    
    updateRecordingStatus() {
        const statusEl = this.elements.recordingStatus;
        const icon = statusEl.querySelector('i');
        
        if (this.isRecording) {
            statusEl.className = 'badge bg-danger fs-6 recording-pulse';
            statusEl.innerHTML = '<i class="fas fa-circle me-1"></i>녹음 중';
        } else {
            statusEl.className = 'badge bg-secondary fs-6';
            statusEl.innerHTML = '<i class="fas fa-circle me-1"></i>대기 중';
        }
    }
    
    updateRecordingTime() {
        let totalTime = this.totalRecordingTime;
        if (this.isRecording && this.recordingStartTime) {
            totalTime += Date.now() - this.recordingStartTime;
        }
        
        const minutes = Math.floor(totalTime / 60000);
        const seconds = Math.floor((totalTime % 60000) / 1000);
        this.elements.totalRecordingTime.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateStatistics() {
        this.elements.transcriptionCount.textContent = `${this.transcriptions.length}개`;
        this.elements.totalSentences.textContent = this.transcriptions.length;
        
        const totalChars = this.transcriptions.reduce((sum, t) => sum + t.text.length, 0);
        this.elements.totalCharacters.textContent = totalChars;
    }
    
    updateUI() {
        // 버튼 상태 업데이트
        this.elements.startRecording.disabled = !this.isConnected || this.isRecording;
        this.elements.stopRecording.disabled = !this.isRecording;
        this.elements.clearTranscriptions.disabled = this.transcriptions.length === 0;
        
        // 녹음 버튼 스타일
        if (this.isRecording) {
            this.elements.startRecording.classList.add('recording-active');
        } else {
            this.elements.startRecording.classList.remove('recording-active');
        }
    }
    
    showAlert(message, type = 'info') {
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        this.elements.alertContainer.appendChild(alertEl);
        
        // 자동으로 제거 (5초 후)
        setTimeout(() => {
            if (alertEl.parentNode) {
                alertEl.remove();
            }
        }, 5000);
    }
    
    getLanguageName(code) {
        const languages = {
            'ko': '한국어',
            'en': 'English',
            'ja': '日本語',
            'zh': '中文',
            'unknown': '자동감지'
        };
        return languages[code] || code;
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// 애플리케이션 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SpeechRecognitionApp();
    
    // 전역 함수들 (HTML에서 호출용)
    window.copyTranscription = (id) => app.copyTranscription(id);
    window.deleteTranscription = (id) => app.deleteTranscription(id);
    
    // 단축키 도움말 표시
    console.log('🎤 음성 인식 앱 단축키:');
    console.log('Ctrl + R: 녹음 시작/중지');
    console.log('Ctrl + E: 텍스트 내보내기');
});
