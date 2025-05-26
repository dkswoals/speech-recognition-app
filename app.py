import os
import tempfile
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_sock import Sock
from faster_whisper import WhisperModel  # 변경된 부분
from config import config

def create_app(config_name=None):
    """Flask 애플리케이션 팩토리"""
    
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # 설정 초기화
    config[config_name].init_app(app)
    
    # 확장 초기화
    CORS(app)
    sock = Sock(app)
    
    # 로깅 설정
    setup_logging(app)
    
    # Whisper 모델 로드
    app.whisper_model = load_whisper_model(app.config['WHISPER_MODEL'])
    
    # 라우트 등록
    register_routes(app, sock)
    
    return app

def setup_logging(app):
    """로깅 설정"""
    if not app.debug:
        # 파일 핸들러 설정
        log_file = os.path.join(app.config['LOG_FOLDER'], 'app.log')
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(getattr(logging, app.config['LOG_LEVEL']))
        app.logger.addHandler(file_handler)
        app.logger.setLevel(getattr(logging, app.config['LOG_LEVEL']))
        
    app.logger.info('음성 인식 애플리케이션 시작')

def load_whisper_model(model_name):
    """faster-whisper 모델 로드"""
    try:
        print(f"faster-whisper 모델 '{model_name}' 로드 중...")
        # faster-whisper는 다른 방식으로 모델을 로드합니다
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        print("faster-whisper 모델 로드 완료")
        return model
    except Exception as e:
        print(f"faster-whisper 모델 로드 실패: {e}")
        # fallback으로 tiny 모델 시도
        print("Fallback으로 'tiny' 모델 로드 중...")
        return WhisperModel("tiny", device="cpu", compute_type="int8")

def register_routes(app, sock):
    """라우트 등록"""
    
    @app.route('/')
    def index():
        """메인 페이지"""
        return render_template('index.html')
    
    @app.route('/health')
    def health_check():
        """헬스 체크 엔드포인트"""
        return jsonify({
            "status": "healthy",
            "message": "서버가 정상 작동 중입니다.",
            "timestamp": datetime.now().isoformat(),
            "whisper_model": app.config['WHISPER_MODEL']
        })
    
    @app.route('/api/config')
    def get_config():
        """클라이언트 설정 정보 제공"""
        return jsonify({
            "websocket_url": f"ws://{app.config['HOST']}:{app.config['PORT']}/audio",
            "max_file_size": app.config['MAX_CONTENT_LENGTH'],
            "whisper_model": app.config['WHISPER_MODEL']
        })
    
    @sock.route('/audio')
    def handle_audio(ws):
        """WebSocket을 통한 실시간 오디오 처리"""
        app.logger.info("WebSocket 연결 시작")
        client_info = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
        app.logger.info(f"클라이언트 연결: {client_info}")
        
        try:
            while True:
                # 오디오 데이터 수신
                data = ws.receive()
                if data is None:
                    break
                
                app.logger.info(f"오디오 데이터 수신: {len(data)} bytes")
                
                # 임시 파일에 오디오 데이터 저장
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_file.write(data)
                    temp_filename = temp_file.name
                
                try:
                    # faster-whisper로 음성 인식 수행 (API가 다름)
                    segments, info = app.whisper_model.transcribe(
                        temp_filename,
                        language='ko'  # 한국어 우선 인식
                    )
                    
                    # 모든 세그먼트의 텍스트를 합침
                    transcribed_text = " ".join([segment.text for segment in segments]).strip()
                    
                    if transcribed_text:
                        app.logger.info(f"인식된 텍스트: {transcribed_text}")
                        # 결과를 JSON 형태로 전송
                        response = {
                            "text": transcribed_text,
                            "language": info.language,
                            "timestamp": datetime.now().isoformat()
                        }
                        ws.send(jsonify(response).data.decode())
                    else:
                        ws.send('{"error": "음성을 인식할 수 없습니다."}')
                        
                except Exception as e:
                    error_msg = f'음성 인식 오류: {str(e)}'
                    app.logger.error(error_msg)
                    ws.send(f'{{"error": "{error_msg}"}}')
                    
                finally:
                    # 임시 파일 정리
                    if os.path.exists(temp_filename):
                        os.remove(temp_filename)
                        
        except Exception as e:
            app.logger.error(f"WebSocket 처리 오류: {str(e)}")
        finally:
            app.logger.info("WebSocket 연결 종료")
    
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({"error": "페이지를 찾을 수 없습니다."}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"서버 내부 오류: {error}")
        return jsonify({"error": "서버 내부 오류가 발생했습니다."}), 500

# 애플리케이션 인스턴스 생성 (개발용)
app = create_app()

if __name__ == '__main__':
    app.run(
        host=app.config['HOST'], 
        port=app.config['PORT'], 
        debug=app.config['DEBUG']
    )
