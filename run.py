#!/usr/bin/env python3
"""
Flask 애플리케이션 실행 스크립트
"""

import os
import sys
from app import create_app

def main():
    """메인 함수"""
    
    # 환경 변수에서 설정 가져오기
    config_name = os.environ.get('FLASK_ENV', 'development')
    
    # 애플리케이션 생성
    app = create_app(config_name)
    
    # 개발 서버 실행
    print("=" * 50)
    print("🎤 실시간 음성 인식 서버 시작")
    print("=" * 50)
    print(f"환경: {config_name}")
    print(f"디버그 모드: {app.config['DEBUG']}")
    print(f"호스트: {app.config['HOST']}")
    print(f"포트: {app.config['PORT']}")
    print(f"Whisper 모델: {app.config['WHISPER_MODEL']}")
    print(f"접속 URL: http://{app.config['HOST']}:{app.config['PORT']}")
    print("서버를 중지하려면 Ctrl+C를 누르세요.")
    print("=" * 50)
    
    try:
        app.run(
            host=app.config['HOST'],
            port=app.config['PORT'],
            debug=app.config['DEBUG'],
            use_reloader=True,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n서버를 종료합니다...")
    except Exception as e:
        print(f"서버 실행 중 오류 발생: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
