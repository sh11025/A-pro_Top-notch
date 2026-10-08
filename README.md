# 일잘러 문장 (WorkTone)

> 한국 직장인을 위한 상황별 맞춤 업무 문구 작성 도구

로그인이나 데이터베이스 없이 브라우저에서 바로 사용할 수 있는 업무 문구 작성기입니다.  
연차 신청, 업무 보고, 일정 조율, 자료 요청 등 다양한 업무 상황에 맞추어 **이메일**과 **사내 메신저(슬랙/잔디/카카오톡 등)** 문구를 원클릭으로 생성합니다. 필요 시 사용자의 선택에 따라 AI(OpenAI, Claude, Gemini, 커스텀 모델)를 통한 문구 다듬기를 지원합니다.

---

## 📸 화면 미리보기

![일잘러 문장 첫 화면](docs/screenshots/home.jpg)

---

## ✨ 핵심 기능

- **3단계 간편 프로세스**: 상황 선택 → 핵심 정보 입력 → 문구 확인 및 복사
- **상황별 템플릿 지원**:
  - 🏖️ **휴가/병가 신청**: 연차, 반차, 시간차, 병가 등 인수인계 사항 포함
  - 📊 **업무 보고**: 진행 상황, 주요 결과, 다음 계획, 이슈 및 요청 사항
  - 📅 **일정 조율**: 미팅/회의 희망 일정 및 대체 가능 일정 조율
  - 📁 **자료 요청**: 요청 자료, 사용 목적, 마감 기한 지정
- **수신자 및 말투(톤) 맞춤 설정**:
  - 수신자: 상사 / 동료 / 외부 파트너
  - 말투: 기본 / 간결하게 / 부드럽게 / 매우 정중하게
- **채널별 문구 제공**: 이메일(제목/본문) 및 메신저용 요약 문구 분리 생성
- **다양한 AI 제공자 연동**: OpenAI (GPT), Anthropic (Claude), Google (Gemini), OpenAI 호환 커스텀 API
- **철저한 개인정보 보호**:
  - 입력 데이터는 브라우저 스토리지나 DB에 영구 저장되지 않음
  - API 키는 프론트엔드에 노출되지 않고 로컬 프록시 서버(`.env.local`)에서만 안전하게 관리

---

## 🛠 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Lucide React
- **Backend / Proxy**: Express, Node.js (tsx), dotenv, cors
- **Testing**: Node.js 내장 test runner (`tsx --test`)
- **Deployment**: GitHub Pages (GitHub Actions)

---

## 📁 프로젝트 구조

```text
├── .github/workflows/deploy.yml # GitHub Pages 자동 배포 워크플로
├── docs/screenshots/            # 스크린샷 이미지
├── server/                      # AI 프록시 및 사용량 제한 서버
│   └── index.ts                 # Express 기반 보안 API 프록시
├── src/                         # 프론트엔드 소스코드
│   ├── App.tsx                  # 메인 UI 및 3단계 흐름 제어
│   ├── drafts.ts                # 오프라인 규칙 기반 문구 생성 엔진
│   ├── main.tsx                 # React 엔트리포인트
│   ├── style.css                # 메인 스타일시트
│   └── ai-settings.css          # AI 설정 모달 스타일
├── tests/                       # 템플릿 생성 로직 단위 테스트
│   └── drafts.test.ts
├── vite.config.ts               # Vite 설정 (base: '/A-pro_Top-notch/')
└── package.json
```

---

## 🚀 빠른 시작

### 1. 설치
Node.js 20 이상 환경에서 의존성을 설치합니다:
```bash
npm install
```

### 2. 템플릿 모드로 실행 (프론트엔드 전용)
API 키나 별도 서버 없이 순수 브라우저 템플릿 모드로 실행합니다:
```bash
npm run dev
```
- 기본 접속 주소: `http://127.0.0.1:5173`

### 3. AI 연동 모드로 실행 (선택 사항)
AI 문구 다듬기 기능을 사용하려면 별도 터미널에서 로컬 보안 프록시 서버를 실행합니다:
```bash
# 터미널 1: AI 프록시 서버 실행
npm run server

# 터미널 2: 프론트엔드 실행
npm run dev
```
1. 웹 화면 우측 상단의 **AI 설정** 버튼을 클릭합니다.
2. 사용할 AI 제공자(OpenAI, Claude, Gemini, 커스텀)를 선택하고 API 키를 입력합니다.
3. **연결 테스트** 성공 후 **설정 저장**을 누르면 로컬 `.env.local`에 안전하게 보관됩니다.

---

## 🌐 GitHub Pages 배포

이 저장소는 GitHub Actions를 통해 GitHub Pages에 자동으로 배포되도록 구성되어 있습니다.

1. 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
2. `main` 브랜치에 변경 사항이 푸시되면 `.github/workflows/deploy.yml`이 자동으로 실행되어 정적 빌드 결과물을 배포합니다.
3. **주의사항**:
   - GitHub Pages 정적 호스팅 환경에서는 기본 **템플릿 문구 작성 기능**이 완벽하게 동작합니다.
   - AI 다듬기 기능은 정적 사이트에 API 키를 노출하지 않기 위해 외부 HTTPS 보안 API 서버가 별도로 필요합니다.

---

## 🔒 보안 및 사용량 관리 정책

- **API 키 분리 보호**: API 키는 브라우저 저장소(LocalStorage/Cookie)에 저장되지 않으며, `.env.local`에만 보관되어 Git 추적에서 제외됩니다.
- **일일 호출량 제한**: AI 설정에서 하루 호출 한도(1~500회)를 설정할 수 있으며, 일자별 호출 통계(`.ai-usage.json`) 및 IP별 요청 제한을 지원합니다.
- **사전 확인 절차**: AI 다듬기 요청 시 실제 전송되는 프롬프트 항목과 제공자를 사용자에게 확인받은 후 요청을 전송합니다.

---

## 🧪 테스트 및 빌드

```bash
# 템플릿 및 표현식 단위 테스트
npm test

# 프로덕션 빌드 검증
npm run build
```
