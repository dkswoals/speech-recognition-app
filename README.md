# 🎤 실시간 음성 인식 웹 애플리케이션

Flask와 Whisper AI를 활용한 실시간 음성 인식 웹 애플리케이션입니다.

## 📖 프로젝트 소개

브라우저에서 실시간으로 음성을 텍스트로 변환하는 웹 애플리케이션입니다. WebSocket을 통해 실시간 통신하며, OpenAI Whisper 모델을 사용해 높은 정확도의 음성 인식을 제공합니다.

### 주요 기능
- 🎯 **실시간 음성 인식**: WebSocket 기반 실시간 음성-텍스트 변환
- 🌐 **다국어 지원**: 한국어, 영어 등 자동 언어 감지
- 📱 **반응형 웹**: 데스크톱/모바일 환경 지원
- 📊 **통계 기능**: 녹음 시간, 문장 수, 글자 수 통계
- 💾 **텍스트 관리**: 복사, 삭제, 내보내기 기능

### 기술 스택
- **Backend**: Python, Flask, WebSocket, faster-whisper
- **Frontend**: HTML5, Bootstrap 5, JavaScript
- **AI Model**: OpenAI Whisper

## 🚀 설치 가이드

### 시스템 요구사항
- Python 3.8 이상
- 4GB RAM 이상 (Whisper 모델용)
- 마이크가 있는 환경

### 설치 과정

1. **저장소 클론**
```bash
git clone https://github.com/your-username/speech-recognition-app.git
cd speech-recognition-app
```

2. **가상환경 생성**
```bash
# Windows
python -m venv venv
.\venv\Scripts\Activate.ps1

# macOS/Linux  
python3 -m venv venv
source venv/bin/activate
```

3. **의존성 설치**
```bash
pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install flask flask-cors flask-sock python-dotenv gunicorn
pip install faster-whisper librosa numpy soundfile
```

4. **환경 설정**
```bash
cp .env.example .env
# 필요시 .env 파일 수정
```

5. **실행**
```bash
python run.py
```

## 🎯 사용법

### 기본 사용

1. **서버 시작**
   ```bash
   python run.py
   ```

2. **웹 브라우저 접속**
   - http://localhost:5000

3. **음성 인식**
   - "연결" 버튼 클릭
   - "녹음 시작" 버튼으로 음성 인식 시작
   - 실시간으로 음성이 텍스트로 변환됨

4. **결과 관리**
   - 개별 텍스트 복사/삭제
   - "내용 지우기"로 전체 삭제
   - `Ctrl+E`로 전체 텍스트 내보내기

### 키보드 단축키
- `Ctrl + R`: 녹음 시작/중지
- `Ctrl + E`: 텍스트 내보내기

### 프로덕션 배포
```bash
gunicorn --config gunicorn_config.py app:app
```

## 📖 API 문서

### REST API

#### `GET /health`
서버 상태 확인
```json
{
  "status": "healthy",
  "message": "서버가 정상 작동 중입니다.",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "whisper_model": "base"
}
```

#### `GET /api/config`
클라이언트 설정 정보
```json
{
  "websocket_url": "ws://localhost:5000/audio",
  "max_file_size": 16777216,
  "whisper_model": "base"
}
```

### WebSocket API

#### `WS /audio`
실시간 음성 인식

**요청**: Binary audio data (WebM format)

**응답**: 
```json
{
  "text": "인식된 텍스트",
  "language": "ko", 
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**오류 응답**:
```json
{
  "error": "음성을 인식할 수 없습니다."
}
```

### 환경 설정

`.env` 파일 주요 설정:
```bash
FLASK_ENV=development      # development/production
FLASK_HOST=127.0.0.1      # 호스트 주소
FLASK_PORT=5000           # 포트 번호
WHISPER_MODEL=base        # tiny/base/small/medium/large
SECRET_KEY=your-secret    # 보안 키 (프로덕션에서 변경 필수)
```

### Whisper 모델 옵션
| 모델 | 크기 | 속도 | 정확도 | 권장 용도 |
|------|------|------|--------|-----------|
| tiny | 39MB | 빠름 | 보통 | 테스트 |
| base | 74MB | 보통 | 좋음 | **일반 사용** |
| small | 244MB | 보통 | 좋음 | 고품질 |
| medium | 769MB | 느림 | 우수 | 전문 용도 |
| large | 1550MB | 매우 느림 | 최고 | 최고 품질 |
