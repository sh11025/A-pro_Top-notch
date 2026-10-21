# 💼 일잘러 문장 (WorkTone)

<div align="center">

**한국 직장인을 위한 스마트 비즈니스 문구 작성 솔루션**  
상황과 수신자만 고르면 이메일과 사내 메신저 문구를 0초 만에 완성합니다.  
로그인과 데이터베이스가 필요 없는 **Zero-Retention (개인정보 무보관)** 기반의 안전한 업무 비서입니다.

<br/>

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero--Storage-success?style=flat-square&logo=shield&logoColor=white)](#-보안--개인정보-보호-원칙)
[![License](https://img.shields.io/badge/License-Private-lightgrey?style=flat-square)](#)

<br/>

[✨ 핵심 기능](#-핵심-기능-인포그래픽) •
[🗺️ 시스템 구조](#-시스템-아키텍처--데이터-흐름) •
[🔄 사용 워크플로우](#-3단계-ux-사용-흐름) •
[🚀 빠른 시작](#-빠른-시작-quick-start) •
[🤖 AI 제공자 연동](#-ai-제공자-설정) •
[🛡️ 보안 및 배포 가이드](#-보안--배포-점검-체크리스트)

</div>

---

## 📸 화면 미리보기

GPT 브라우저 및 로컬 환경에서 실행되는 실제 첫 화면입니다. 직관적인 카드형 UI로 누구나 즉시 작성할 수 있습니다.

<div align="center">
  <img src="docs/screenshots/home.jpg" alt="일잘러 문장 첫 화면" width="820" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12);" />
</div>

---

## 📊 핵심 기능 인포그래픽

| 구분 | 주요 특징 | 상세 설명 | 기대 효과 |
| :---: | :--- | :--- | :--- |
| **⚡ 0초 즉시 생성** | **로컬 템플릿 엔진** | API 키나 외부 서버 없이도 정교한 알고리즘으로 즉시 초안 작성 | 대기 시간 제로, 비용 발생 없음 |
| **🤖 하이브리드 AI** | **선택형 LLM 다듬기** | GPT, Claude, Gemini 및 OpenAI 호환 커스텀 모델 연동 지원 | 상황에 맞는 고품질 문장 리라이팅 |
| **👥 맞춤형 수신자/톤** | **4단계 톤 앤 매너** | 상사 · 동료 · 외부 업체별 말투 및 정중함 수준(간결/기본/부드럽게/매우 정중) | 비즈니스 매너 실수 원천 방지 |
| **📬 듀얼 채널 최적화** | **이메일 & 메신저** | 이메일(제목/본문 분리)과 업무 메신저(슬랙, 잔디, 카카오톡) 맞춤 생성 | 채널별 복사-붙여넣기 편의성 극대화 |
| **🛡️ Zero-Retention** | **개인정보 완벽 보호** | 브라우저 로컬 저장소 및 서버 DB에 입력값 보관 일체 없음 | 기업 내 민감 정보 유출 방지 |

---

## 🗺️ 시스템 아키텍처 & 데이터 흐름

이 프로젝트는 **프라이버시 우선(Privacy-First)** 구조로 설계되어 있습니다. 기본 템플릿 엔진은 브라우저 내부에서 100% 동작하며, AI 다듬기 기능을 선택한 경우에만 로컬 프록시 서버를 통해 최소한의 검증된 데이터만 외부 LLM으로 안전하게 전달됩니다.

```mermaid
flowchart TB
    subgraph Client["🖥️ 브라우저 클라이언트 (React + Vite)"]
        UI["🎨 사용자 UI\n(상황 선택 / 정보 입력 / 문구 확인)"]
        LocalEngine["⚡ 클라이언트 템플릿 엔진\n(drafts.ts / No-Network)"]
        StateMem["🧠 브라우저 휘발성 메모리\n(새로고침 시 자동 소멸, DB/LocalStorage 저장 없음)"]
    end

    subgraph Backend["🛡️ 로컬 보안 프록시 서버 (Express / Node.js)"]
        Guard["🔒 보안 게이트웨이\n(APP_ACCESS_TOKEN & CORS & IP Rate Limit 검증)"]
        UsageTracker["📊 일일 사용량 제어\n(1~500회 제한 / .ai-usage.json)"]
        EnvStore["🔑 환경설정 & 비밀키 보관\n(.env.local / 비공개 저장)"]
    end

    subgraph ExternalLLM["🌐 외부 AI 제공자 (선택 시에만 호출)"]
        OpenAI["🟢 OpenAI GPT\n(gpt-6-luna)"]
        Claude["🟣 Anthropic Claude\n(claude-haiku-5-5)"]
        Gemini["🔵 Google Gemini\n(gemini-3.8-flash)"]
        Custom["⚪ OpenAI 호환 커스텀 API"]
    end

    %% 기본 플로우
    UI -->|"1. 템플릿 즉시 생성 (기본 모드)"| LocalEngine
    LocalEngine -->|"초안 렌더링"| UI
    UI -.->|"입력값 유지 (세션 내)"| StateMem

    %% AI 다듬기 플로우
    UI ==>|"2. AI 다듬기 요청 (명시적 동의 시)"| Guard
    Guard --> UsageTracker
    UsageTracker -->|"키 매핑 & 프록시 요청"| EnvStore
    EnvStore ==>|"3. 문구 정제 요청 (민감정보 필터링)"| ExternalLLM
    ExternalLLM ==>|"다듬어진 문구 반환"| Guard
    Guard ==>|"최종 문구 전달"| UI

    %% 스타일 정의
    classDef clientStyle fill:#e3f2fd,stroke:#1e88e5,stroke-width:2px,color:#0d47a1;
    classDef serverStyle fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#4a148c;
    classDef llmStyle fill:#fff3e0,stroke:#fb8c00,stroke-width:2px,color:#e65100;
    
    class UI,LocalEngine,StateMem clientStyle;
    class Guard,UsageTracker,EnvStore serverStyle;
    class OpenAI,Claude,Gemini,Custom llmStyle;
```

---

## 🔄 3단계 UX 사용 흐름

복잡한 설정 없이 3단계만 거치면 실무에 바로 사용할 수 있는 문구가 완성됩니다.

```mermaid
flowchart LR
    Step1["📋 Step 1\n상황 선택"] --> Step2["✏️ Step 2\n정보 입력 & 톤 조절"] --> Step3["🚀 Step 3\n문구 확인 & 복사"]

    subgraph S1["상황 카테고리"]
        A1["🏖️ 연차 · 반차 · 병가"]
        A2["📊 일일 · 주간 업무 보고"]
        A3["🤝 미팅 · 회의 일정 조율"]
        A4["📁 업무 자료 · 검토 요청"]
    end

    subgraph S2["입력 옵션"]
        B1["수신자: 상사 / 동료 / 외부업체"]
        B2["말투: 간결 / 기본 / 부드럽게 / 정중하게"]
        B3["필수 정보 (일시, 사유, 목적 등)"]
        B4["선택: AI로 한 번 더 다듬기"]
    end

    subgraph S3["결과 활용"]
        C1["📧 이메일 탭 (제목 / 본문 개별 복사)"]
        C2["💬 메신저 탭 (슬랙/잔디/카톡 문구 복사)"]
        C3["🪄 원클릭 재조정 (더 정중하게/짧게/부드럽게)"]
        C4["↩️ 이전 초안 롤백 복구"]
    end

    Step1 --- S1
    Step2 --- S2
    Step3 --- S3
```

---

## ⚙️ 하이브리드 생성 시퀀스

사용자가 문구를 요청했을 때 동작하는 순서도입니다. AI 서버 장애 시에도 기본 템플릿으로 자동 Fallback되어 업무가 중단되지 않습니다.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 사용자
    participant UI as 🖥️ 웹 프론트엔드
    participant Template as ⚡ 템플릿 엔진 (Local)
    participant Server as 🛡️ 백엔드 프록시 (Express)
    participant AI as 🤖 외부 LLM API

    User->>UI: 상황 선택 및 필수 정보 입력
    
    alt 1. 기본 모드 (AI 다듬기 비활성화)
        UI->>Template: 입력 데이터 기반 규칙 매핑
        Template-->>UI: 0초 만에 이메일/메신저 초안 생성
        UI-->>User: 결과 화면 표시
    else 2. AI 다듬기 모드 (AI 사용 체크)
        UI->>User: 발송 전 확인 팝업 (제공자 및 전송 항목 안내)
        User->>UI: 전송 승인
        UI->>Server: 다듬기 요청 (POST /api/ai/draft)
        
        alt 호출 한도 초과 or 인증 실패
            Server-->>UI: 오류 응답 (429/401)
            UI->>Template: 템플릿 Fallback 발동
            Template-->>UI: 안전한 기본 문구 반환
            UI-->>User: 안내 토스트와 함께 기본 초안 표시
        else 정상 처리
            Server->>AI: 비즈니스 톤 정제 요청
            AI-->>Server: 다듬어진 문구 응답
            Server-->>UI: 완성된 문구 반환
            UI-->>User: AI 추천 문구 표시
        end
    end

    User->>UI: [원클릭 복사] 또는 [톤 미세조정 요청]
```

---

## 🚀 빠른 시작 (Quick Start)

### 사전 요구 사항
- **Node.js**: v20.0.0 이상
- **npm**: v10.0.0 이상

### 1. 설치 및 프론트엔드 실행
기본 템플릿 기능은 프론트엔드만 실행해도 **즉시 100% 사용 가능**합니다.

```bash
# 의존성 설치
npm install

# 프론트엔드 개발 서버 시작 (기본 포트: 5173)
npm run dev
```
> 브라우저에서 `http://127.0.0.1:5173`으로 접속합니다. (로컬 단독 접속 허용)

### 2. AI 다듬기 서버 실행 (선택 사항)
LLM을 통한 문구 고도화가 필요한 경우, 새 터미널 창을 열고 API 서버를 실행합니다.

```bash
# AI 보안 프록시 서버 실행 (기본 포트: 3001)
npm run server
```

---

## 🤖 AI 제공자 설정

우측 상단 **[AI 설정]** 모달에서 원하는 AI 엔진을 연동할 수 있습니다.

| AI 제공자 | 기본 엔드포인트 URL | 기본 권장 모델 | 특징 |
| :--- | :--- | :--- | :--- |
| **OpenAI (GPT)** | `https://api.openai.com/v1/chat/completions` | `gpt-6-luna` | 가장 대중적이며 표준적인 업무 문체 |
| **Anthropic (Claude)** | `https://api.anthropic.com/v1/messages` | `claude-haiku-5-5` | 자연스럽고 맥락을 살린 부드러운 표현 |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | `gemini-3.8-flash` | 빠른 응답 속도와 정확한 정보 전달 |
| **커스텀 API** | 사용자 직접 입력 (`/chat/completions` 필수) | 사용자 지정 | 사내 구축형 모델 또는 vLLM/Ollama 호환 엔드포인트 |

> [!NOTE]
> 커스텀 API는 OpenAI 호환 Chat Completions 규격을 따라야 하며 엔드포인트가 `/chat/completions`로 끝나야 합니다.

### 설정 및 검증 3단계
1. **제공자 및 모델 선택**: API Key를 입력하고 원하는 엔진을 지정합니다.
2. **연결 테스트 (`Test Connection`)**: 외부 제공자로 짧은 핑을 전송하여 키 유효성을 확인합니다. (일일 호출 한도 1회 차감)
3. **설정 저장**: 설정이 성공하면 로컬 `.env.local` 파일에만 안전하게 기록됩니다. 언제든지 **[키 삭제]** 버튼으로 초기화할 수 있습니다.

---

## 🛡️ 보안 & 배포 점검 체크리스트

### 핵심 보안 아키텍처

```
[ 브라우저 ]  ──(메모리 유지 / No LocalStorage)──
     │
     ▼
[ 프록시 서버 ] ──(127.0.0.1 로컬 바인딩 / 외부 노출 차단)──
     │
     ▼
[ .env.local ]  ──(Git 커밋 제외 / 서버 계정 로컬에만 보관)──
```

> [!IMPORTANT]
> **Zero-Retention 원칙**: 본 애플리케이션은 사용자가 입력한 업무 내용, 일정, 사유를 브라우저의 `localStorage`, `IndexedDB` 또는 서버 데이터베이스에 영구 보관하지 않습니다.

### 📋 안전한 운영 및 배포 체크리스트

- [ ] **로컬 인터페이스 바인딩**: AI 프록시 서버는 기본적으로 `127.0.0.1`에 바인딩되어 외부 임의 접근을 차단합니다.
- [ ] **비밀키 파일 보호**: `.env.local` 파일은 `.gitignore`에 등록되어 커밋되지 않습니다. 절대 외부에 공유하거나 공용 레포지토리에 올리지 마세요.
- [ ] **출처 검증 (CORS)**: 외부 배포 시 `FRONTEND_ORIGIN`에 프론트엔드의 정확한 도메인을 지정하세요.
- [ ] **접근 토큰 설정**: 외부 노출이 필요한 경우 32자 이상의 임의 `APP_ACCESS_TOKEN`을 설정하고 사용자에게 안전하게 전달하세요. (앱 화면에서 요구되며 브라우저 메모리에만 유지)
- [ ] **호출 상한 및 비용 방어**:
  - 일일 호출 상한(1~500회)이 `.ai-usage.json` 파일에 날짜별(KST)로 기록됩니다.
  - IP별 분당 요청 제한(Rate Limit)이 기본 적용됩니다.
- [ ] **HTTPS 리버스 프록시**: 프로덕션 배포 시 Nginx/Caddy 등의 리버스 프록시 뒤에 배치하고 HTTPS를 강제하세요.
- [ ] **무로그 원칙**: 서버 로그에 민감한 사용자 입력 본문이나 API 키가 남지 않도록 설계되어 있습니다.

---

## 🧪 테스트 및 프로덕션 빌드

자동화 테스트를 통해 템플릿 생성 로직과 수신자별 문체 분기 규칙의 무결성을 검증합니다.

```bash
# 단위 테스트 실행 (템플릿 및 수신자별 표현 검증)
npm test

# 프로덕션 빌드 (TypeScript 컴파일 & Vite 번들링)
npm run build

# 프로덕션 빌드 미리보기
npm run preview
```

---

<div align="center">

Made with ❤️ for Korean Professionals  
업무 효율을 극대화하고 이메일 스트레스를 줄여보세요!

</div>
