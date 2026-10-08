import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clipboard, FileText, KeyRound, MessageCircle, RotateCcw, Settings2, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react';
import { buildDraft, type Audience, type Draft, type Fields, type Scenario, type Tone } from './drafts';

type Provider = 'openai' | 'claude' | 'gemini' | 'custom';
type AISettings = { configured: boolean; provider: Provider; apiUrl: string; model: string; dailyLimit: number; usedToday: number; accessRequired: boolean };
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiPath = (path: string) => `${apiBase}${path}`;
const providerDefaults: Record<Provider, { label: string; url: string; model: string }> = {
  openai: { label: 'GPT (OpenAI)', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-6-luna' },
  claude: { label: 'Claude (Anthropic)', url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-5-5' },
  gemini: { label: 'Gemini (Google)', url: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.8-flash' },
  custom: { label: '커스텀 API (OpenAI 호환)', url: '', model: '' },
};
const scenarios: { id: Scenario; title: string; desc: string; icon: string }[] = [
  { id: 'leave', title: '연차·병가 신청', desc: '휴가나 병가 일정을 전달할 때', icon: '🌿' },
  { id: 'report', title: '업무 보고', desc: '진행 상황과 결과를 공유할 때', icon: '📊' },
  { id: 'schedule', title: '일정 조율', desc: '회의·미팅 시간을 맞출 때', icon: '📅' },
  { id: 'request', title: '자료 요청', desc: '필요한 자료나 도움을 요청할 때', icon: '📎' },
];
const labelOf = (id: Scenario) => scenarios.find(item => item.id === id)!.title;
const audiences: { id: Audience; label: string; desc: string }[] = [
  { id: 'manager', label: '상사', desc: '정중하고 예의 있게' },
  { id: 'colleague', label: '동료', desc: '부드럽고 간결하게' },
  { id: 'external', label: '외부 회사', desc: '공식적이고 격식 있게' },
];
type Field = { key: string; label: string; placeholder: string; type?: string; multiline?: boolean; required?: boolean; requiredWhen?: { key: string; value: string }; options?: string[]; datePicker?: 'range' | 'datetime' | 'single' };
const fields: Record<Scenario, Field[]> = {
  leave: [{ key: 'dates', label: '휴가 날짜', placeholder: '예: 10월 21일 ~ 22일', required: true, datePicker: 'range' }, { key: 'kind', label: '휴가 종류', placeholder: '휴가 종류 선택', options: ['연차', '병가', '오전 반차', '오후 반차', '시간차'] }, { key: 'startTime', label: '시작 시간', placeholder: '09:00', type: 'time', requiredWhen: { key: 'kind', value: '시간차' } }, { key: 'endTime', label: '종료 시간', placeholder: '18:00', type: 'time', requiredWhen: { key: 'kind', value: '시간차' } }, { key: 'reason', label: '사유', placeholder: '예: 개인 일정 (간단히 입력해도 괜찮아요)' }, { key: 'handoff', label: '업무 인수인계', placeholder: '예: 진행 중인 업무와 담당자에게 공유한 내용을 적어 주세요', multiline: true }],
  report: [{ key: 'topic', label: '보고 주제', placeholder: '예: 10월 캠페인 진행 현황', required: true }, { key: 'progress', label: '진행 내용', placeholder: '주요 진행 상황을 적어 주세요', multiline: true, required: true }, { key: 'outcome', label: '성과·결과', placeholder: '수치나 완료한 결과가 있으면 입력해 주세요', multiline: true }, { key: 'next', label: '다음 계획', placeholder: '예: 이번 주 내 시안 확정 예정' }, { key: 'issue', label: '이슈 또는 요청 사항', placeholder: '예: 검토 의견이 필요합니다', multiline: true }],
  schedule: [{ key: 'dates', label: '희망 날짜·시간', placeholder: '예: 10월 21일 오후 또는 22일 오전', required: true, datePicker: 'datetime' }, { key: 'topic', label: '일정 목적', placeholder: '예: 신규 프로젝트 킥오프 미팅', required: true }, { key: 'alternatives', label: '대체 가능한 일정', placeholder: '예: 어려우시면 10월 23일 오전도 가능합니다' }, { key: 'details', label: '요청 내용', placeholder: '참석자나 함께 확인할 내용을 적어 주세요', multiline: true }],
  request: [{ key: 'item', label: '요청 자료', placeholder: '예: 3분기 매출 현황 자료', required: true }, { key: 'purpose', label: '요청 목적', placeholder: '예: 다음 주 전략 회의 준비' }, { key: 'deadline', label: '필요한 시점', placeholder: '예: 10월 24일', datePicker: 'single' }, { key: 'details', label: '추가 내용', placeholder: '형식, 범위 등 필요한 내용을 적어 주세요', multiline: true }],
};
export default function App() {
  const [scenario, setScenario] = useState<Scenario>('leave');
  const [audience, setAudience] = useState<Audience>('manager');
  const [values, setValues] = useState<Fields>({});
  const [step, setStep] = useState<'scenario' | 'details' | 'result'>('scenario');
  const [tab, setTab] = useState<'email' | 'chat'>('email');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previousDraft, setPreviousDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>('normal');
  const [useAI, setUseAI] = useState(false);
  const [aiConsentConfirmed, setAIConsentConfirmed] = useState(false);
  const [aiConfirmOpen, setAIConfirmOpen] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [apiConfigured, setApiConfigured] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<Provider>('openai');
  const [savedProvider, setSavedProvider] = useState<Provider>('openai');
  const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [model, setModel] = useState('gpt-6-luna');
  const [dailyLimit, setDailyLimit] = useState(50);
  const [usedToday, setUsedToday] = useState(0);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [serverToken, setServerToken] = useState('');
  const [serverAuthRequired, setServerAuthRequired] = useState(false);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [unlockingServer, setUnlockingServer] = useState(false);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const aiConfirmDialogRef = useRef<HTMLElement>(null);
  const authDialogRef = useRef<HTMLElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const generationTriggerRef = useRef<HTMLButtonElement>(null);
  const current = scenarios.find(x => x.id === scenario)!;
  useEffect(() => {
    fetch(apiPath('/api/access')).then(async res => {
      if (!res.ok) throw new Error('access unavailable');
      return await res.json() as { required: boolean };
    }).then(access => {
      setServerAuthRequired(access.required);
      if (access.required) return;
      fetch(apiPath('/api/settings')).then(async res => {
        if (!res.ok) throw new Error('settings unavailable');
        return await res.json() as AISettings;
      }).then(applySettings).catch(() => setApiConfigured(false));
    }).catch(() => setApiConfigured(false));
  }, []);
  const applySettings = (settings: AISettings) => {
    setApiConfigured(settings.configured); setProvider(settings.provider); setSavedProvider(settings.provider); setApiUrl(settings.apiUrl); setModel(settings.model); setDailyLimit(settings.dailyLimit); setUsedToday(settings.usedToday);
  };
  const requiredFields = fields[scenario].filter(field => field.required || (field.requiredWhen && values[field.requiredWhen.key] === field.requiredWhen.value));
  const formatPickerDate = (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(year, month - 1, day));
  };
  const updateValues = (key: string, value: string) => setValues(currentValues => ({ ...currentValues, [key]: value }));
  const closeAIConfirm = () => { setAIConfirmOpen(false); window.requestAnimationFrame(() => generationTriggerRef.current?.focus()); };
  const confirmAIAndGenerate = () => {
    setAIConsentConfirmed(true); setAIConfirmOpen(false);
    void generate(tone, false, true);
  };
  const authHeaders = (): Record<string, string> => serverToken ? { 'X-App-Token': serverToken } : {};
  const unlockServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setUnlockingServer(true); setAccessMessage('');
    try {
      const response = await fetch(apiPath('/api/settings'), { headers: { 'X-App-Token': accessCodeInput } });
      const settings = await response.json() as AISettings & { error?: string };
      if (!response.ok) throw new Error(settings.error || '접근 코드를 확인해 주세요.');
      setServerToken(accessCodeInput); setAccessCodeInput(''); setServerAuthRequired(false); applySettings(settings);
    } catch (error) { setAccessMessage(error instanceof Error && error.message.includes('Failed to fetch') ? '서버에 연결할 수 없습니다.' : error instanceof Error ? error.message : '접속하지 못했습니다.'); }
    finally { setUnlockingServer(false); }
  };
  const saveApiSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSavingSettings(true); setSettingsError(false); setSettingsMessage('');
    try {
      const response = await fetch(apiPath('/api/settings'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ apiKey, provider, apiUrl, model, dailyLimit }) });
      const result = await response.json() as AISettings & { error?: string };
      if (!response.ok) throw new Error(result.error || '설정을 저장하지 못했어요.');
      applySettings(result);
      setApiKey(''); setUseAI(false); setAIConsentConfirmed(false); setSettingsError(false); setSettingsMessage('설정을 서버의 .env.local 파일에 저장했습니다. API 키는 화면에 보관하지 않습니다.');
    } catch (error) {
      setSettingsError(true);
      setSettingsMessage(error instanceof Error && error.message.includes('Failed to fetch') ? 'AI 서버에 연결할 수 없어요. 별도 터미널에서 npm run server를 실행해 주세요.' : error instanceof Error ? error.message : '설정을 저장하지 못했어요.');
    } finally { setSavingSettings(false); }
  };
  const removeApiKey = async () => {
    setSavingSettings(true); setSettingsError(false); setSettingsMessage('');
    try {
      const response = await fetch(apiPath('/api/settings'), { method: 'DELETE', headers: authHeaders() });
      const result = await response.json() as AISettings & { error?: string };
      if (!response.ok) throw new Error(result.error || 'API 설정을 삭제하지 못했어요.');
      applySettings(result); setApiKey(''); setUseAI(false); setAIConsentConfirmed(false); setSettingsMessage('저장된 API 키를 서버 설정에서 삭제했습니다. 템플릿 작성은 계속 사용할 수 있어요.');
    } catch (error) {
      setSettingsError(true); setSettingsMessage(error instanceof Error ? error.message : 'API 설정을 삭제하지 못했어요.');
    } finally { setSavingSettings(false); }
  };
  const testConnection = async () => {
    setTestingConnection(true); setSettingsError(false); setSettingsMessage('');
    try {
      const response = await fetch(apiPath('/api/settings/test'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ apiKey, provider, apiUrl, model }) });
      const result = await response.json() as { ok?: boolean; provider?: string; error?: string; usedToday?: number };
      if (typeof result.usedToday === 'number') setUsedToday(result.usedToday);
      if (!response.ok) throw new Error(result.error || '연결 테스트에 실패했습니다.');
      setSettingsMessage(`${result.provider || providerDefaults[provider].label} API 연결에 성공했습니다.`);
    } catch (error) {
      setSettingsError(true);
      setSettingsMessage(error instanceof Error && error.message.includes('Failed to fetch') ? 'AI 서버에 연결할 수 없어요. npm run server가 실행 중인지 확인해 주세요.' : error instanceof Error ? error.message : '연결 테스트에 실패했습니다.');
    } finally { setTestingConnection(false); }
  };
  const closeSettings = () => { setSettingsOpen(false); setApiKey(''); window.requestAnimationFrame(() => settingsTriggerRef.current?.focus()); };
  useEffect(() => {
    if (!settingsOpen && !aiConfirmOpen && !serverAuthRequired) return;
    const dialog = aiConfirmOpen ? aiConfirmDialogRef.current : settingsOpen ? settingsDialogRef.current : authDialogRef.current;
    window.requestAnimationFrame(() => dialog?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (aiConfirmOpen) closeAIConfirm(); else if (settingsOpen) closeSettings(); return; }
      if (event.key === 'Tab' && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, aiConfirmOpen, serverAuthRequired]);
  const generate = async (nextTone: Tone = tone, retry = false, aiApproved = false) => {
    if (apiConfigured && useAI && !aiConsentConfirmed && !aiApproved) { setAIConfirmOpen(true); return; }
    setLoading(true); setStatus(''); setAiError(false); setTone(nextTone);
    const fallback = buildDraft(scenario, audience, values, nextTone);
    try {
      if (apiConfigured && useAI) {
        const res = await fetch(apiPath('/api/generate'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ scenario: labelOf(scenario), audience, fields: values, tone: nextTone }) });
        if (!res.ok) { const errorResult = await res.json().catch(() => ({})) as { error?: string }; throw new Error(errorResult.error || 'AI 서버에 연결할 수 없습니다.'); }
        const result = await res.json() as Draft & { usedToday?: number };
        if (!result.email || !result.chat || !result.subject) throw new Error('AI 응답을 확인할 수 없습니다.');
        if (typeof result.usedToday === 'number') setUsedToday(result.usedToday);
        if (draft) setPreviousDraft(draft);
        setDraft(result); setStatus('기본 내용을 바탕으로 AI가 문장을 다듬었어요. 사실과 다른 내용이 없는지 확인해 주세요.');
      } else { if (draft) setPreviousDraft(draft); setDraft(fallback); setStatus(retry ? '기본 문구로 다시 작성했어요.' : '기본 템플릿으로 작성했어요. 필요한 내용을 자유롭게 수정해 보세요.'); }
      setStep('result');
    } catch (error) { if (draft) setPreviousDraft(draft); setDraft(fallback); setAiError(true); const reason = error instanceof Error ? error.message : '네트워크 상태를 확인해 주세요.'; setStatus(`AI 작성에 실패해 기본 문구를 보여드려요. ${reason} 입력 내용은 보존했습니다.`); setStep('result'); }
    finally { setLoading(false); }
  };
  const copy = async (kind: 'subject' | 'emailBody' | 'emailAll' | 'chat') => {
    if (!draft) return;
    const text = kind === 'subject' ? draft.subject : kind === 'emailBody' ? draft.email : kind === 'emailAll' ? `제목: ${draft.subject}\n\n${draft.email}` : draft.chat;
    try { await navigator.clipboard.writeText(text); setCopied(kind); window.setTimeout(() => setCopied(null), 1800); }
    catch { setStatus('복사할 수 없어요. 문구를 선택해 직접 복사해 주세요.'); }
  };
  const adjust = (kind: 'formal' | 'short' | 'soft') => {
    if (!draft) return;
    const transform = (text: string) => {
      if (kind === 'formal') return text.replace(/안녕하세요!/g, '안녕하십니까.').replace(/부탁드려요/g, '부탁드립니다').replace(/감사합니다!/g, '감사합니다.');
      if (kind === 'soft') return text.replace(/확인 부탁드립니다\.?/g, audience === 'external' ? '확인 부탁드립니다.' : '확인 부탁드려요.').replace(/요청드리고자 합니다/g, '부탁드리고 싶습니다').replace(/신청드립니다\./g, '신청드리려고 합니다.');
      return text.replace(/귀사의 무궁한 발전을 기원합니다\.?\n*/g, '').replace(/신청드리고자 합니다/g, '신청드립니다').replace(/요청드리고자 합니다/g, '요청드립니다').replace(/공유드립니다/g, '공유합니다').replace(/확인 부탁드리며, 추가로 필요한 사항이 있으시면 편하게 말씀해 주시기 바랍니다\./g, '확인 부탁드립니다.').replace(/\n{3,}/g, '\n\n');
    };
    setPreviousDraft(draft); setDraft({ subject: draft.subject, email: transform(draft.email), chat: transform(draft.chat) });
    setTone(kind); setStatus(({ formal: '더 정중한 표현으로 바꿨어요.', short: '핵심 표현을 간결하게 다듬었어요.', soft: '한층 부드러운 표현으로 바꿨어요.' })[kind]);
  };
  const undoDraft = () => { if (!previousDraft) return; setDraft(previousDraft); setPreviousDraft(null); setStatus('이전 초안으로 되돌렸어요.'); setAiError(false); };
  const reset = () => { setStep('scenario'); setScenario('leave'); setAudience('manager'); setValues({}); setDraft(null); setPreviousDraft(null); setTab('email'); setTone('normal'); setStatus(''); setAiError(false); setUseAI(false); setAIConsentConfirmed(false); setCopied(null); setDateStart(''); setDateEnd(''); setDateTime(''); };

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); reset(); }}><span className="brand-icon"><WandSparkles size={19}/></span> 일잘러 문장</a><div className="header-actions"><span className="header-note"><ShieldCheck size={15}/> 앱은 입력 내용을 저장하지 않아요</span><button ref={settingsTriggerRef} className="settings-button" onClick={() => { setSettingsOpen(true); setSettingsMessage(''); }}><Settings2 size={15}/> AI 설정</button></div></header>
    <section className="hero"><span className="eyebrow"><Sparkles size={14}/> WORK TONE, MADE SIMPLE</span><h1>일하는 말도, <span>센스 있게.</span></h1><p>상황만 고르면 필요한 업무 문장을 완성해 드려요.</p></section>
    <div className="progress" role="group" aria-label="문구 작성 단계"><div className={`progress-item ${step === 'scenario' ? 'active' : 'done'}`} aria-current={step === 'scenario' ? 'step' : undefined}><span>1</span> 상황 선택</div><div className="progress-line"/><div className={`progress-item ${step === 'details' ? 'active' : step === 'result' ? 'done' : ''}`} aria-current={step === 'details' ? 'step' : undefined}><span>2</span> 정보 입력</div><div className="progress-line"/><div className={`progress-item ${step === 'result' ? 'active' : ''}`} aria-current={step === 'result' ? 'step' : undefined}><span>3</span> 문구 확인</div></div>
    {step !== 'result' ? <section className="workspace">
      {step === 'scenario' ? <><div className="section-heading"><div><span className="step-label">STEP 01</span><h2>어떤 문장이 필요하세요?</h2></div><span className="hint">상황을 선택해 주세요</span></div>
      <div className="scenario-grid">{scenarios.map(item => <button key={item.id} className={`scenario-card ${scenario === item.id ? 'selected' : ''}`} aria-pressed={scenario === item.id} onClick={() => { setScenario(item.id); setValues({}); setDateStart(''); setDateEnd(''); setDateTime(''); setUseAI(false); setTone('normal'); }}><span className="scenario-emoji">{item.icon}</span><span className="scenario-copy"><b>{item.title}</b><small>{item.desc}</small></span><span className="radio">{scenario === item.id && <i/>}</span></button>)}</div>
      <div className="form-footer"><span>상황에 맞는 입력 항목을 다음 단계에서 안내해 드려요.</span><button className="primary-button" onClick={() => setStep('details')}>다음 단계<ArrowRight size={17}/></button></div></> : <><div className="section-heading detail-heading"><button className="back-button" onClick={() => setStep('scenario')}><ArrowLeft size={16}/> 상황 변경</button><div><span className="step-label">STEP 02 · {current.icon} {current.title}</span><h2>필요한 내용을 알려주세요</h2></div></div>
      <div className="form-layout"><div className="fields-column">
      {fields[scenario].filter(field => !field.requiredWhen || values[field.requiredWhen.key] === field.requiredWhen.value).map(field => <div className="field" key={field.key}><div className="field-title"><span id={`field-${field.key}`}>{field.label}{(field.required || (field.requiredWhen && values[field.requiredWhen.key] === field.requiredWhen.value)) && <em>필수</em>}</span><small className="field-count">{(values[field.key] || '').length} / 2,400자</small></div>{field.options ? <select aria-labelledby={`field-${field.key}`} value={values[field.key] || ''} onChange={e => updateValues(field.key, e.target.value)}><option value="">{field.placeholder} (선택)</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : field.multiline ? <textarea aria-labelledby={`field-${field.key}`} maxLength={2400} value={values[field.key] || ''} placeholder={field.placeholder} onChange={e => updateValues(field.key, e.target.value)}/> : <input aria-labelledby={`field-${field.key}`} maxLength={2400} type={field.type || 'text'} value={values[field.key] || ''} placeholder={field.placeholder} onInput={e => field.type === 'time' && updateValues(field.key, e.currentTarget.value)} onChange={e => updateValues(field.key, e.target.value)}/>}
        {field.datePicker === 'range' && <fieldset className="date-picker"><legend>달력에서 휴가 기간 선택 (선택 사항)</legend><label>시작일<input type="date" aria-label="휴가 시작일" value={dateStart} onChange={e => { const next = e.target.value; const end = dateEnd && next && dateEnd < next ? '' : dateEnd; setDateStart(next); setDateEnd(end); updateValues('dates', [formatPickerDate(next), formatPickerDate(end)].filter(Boolean).join(' ~ ')); }}/></label><label>종료일<input type="date" aria-label="휴가 종료일" value={dateEnd} min={dateStart || undefined} onChange={e => { const next = e.target.value; setDateEnd(next); updateValues('dates', [formatPickerDate(dateStart), formatPickerDate(next)].filter(Boolean).join(' ~ ')); }}/></label></fieldset>}
        {field.datePicker === 'datetime' && <fieldset className="date-picker"><legend>달력에서 희망 일정 선택 (선택 사항)</legend><label>희망일<input type="date" aria-label="희망 일정 날짜" value={dateStart} onChange={e => { const next = e.target.value; setDateStart(next); updateValues('dates', next ? `${formatPickerDate(next)}${dateTime ? ` ${dateTime}` : ''}` : values.dates || ''); }}/></label><label>시간<input type="time" aria-label="희망 일정 시간" value={dateTime} onChange={e => { const next = e.target.value; setDateTime(next); updateValues('dates', dateStart ? `${formatPickerDate(dateStart)}${next ? ` ${next}` : ''}` : values.dates || ''); }}/></label></fieldset>}
        {field.datePicker === 'single' && <div className="date-picker single-date"><label htmlFor="deadline-picker">또는 달력에서 선택</label><input id="deadline-picker" type="date" aria-label="요청 자료 필요 날짜" value={dateEnd} onChange={e => { const next = e.target.value; setDateEnd(next); updateValues('deadline', formatPickerDate(next)); }}/></div>}
      </div>)}</div>
      <aside className="audience-panel"><div><span className="step-label">TO</span><h2>누구에게 보내나요?</h2><p>상대에 맞춰 말투를 조정할게요.</p></div><div className="audience-list">{audiences.map(person => <button key={person.id} className={`audience-option ${audience === person.id ? 'selected' : ''}`} onClick={() => setAudience(person.id)} aria-pressed={audience === person.id}><span><b>{person.label}</b><small>{person.desc}</small></span><span className="radio">{audience === person.id && <i/>}</span></button>)}</div><fieldset className="tone-selector"><legend>말투 강도</legend>{([{ value: 'short', label: '간결하게' }, { value: 'normal', label: '기본' }, { value: 'soft', label: '부드럽게' }, { value: 'formal', label: '매우 정중하게' }] as const).map(option => <label key={option.value}><input type="radio" name="tone-level" value={option.value} checked={tone === option.value} onChange={() => setTone(option.value)}/><span>{option.label}</span></label>)}</fieldset><div className="privacy-mini"><ShieldCheck size={16}/><span>고객 정보나 회사 기밀 등 민감한 내용은 입력하지 마세요.</span></div>{apiConfigured && <label className="ai-option"><input type="checkbox" checked={useAI} onChange={e => { setUseAI(e.target.checked); setAIConsentConfirmed(false); }}/><span><b>필요할 때 AI로 한 번 더 다듬기</b><small>선택하면 입력 내용을 {providerDefaults[provider].label}로 전송합니다. 전송 직전에 다시 확인합니다.</small></span></label>}</aside></div>
      <div className="form-footer"><span><i className="required-dot"/> 필수 항목을 입력해 주세요</span><button ref={generationTriggerRef} className="primary-button" disabled={loading || requiredFields.some(field => !values[field.key]?.trim())} onClick={() => generate()}>{loading ? '작성 중…' : '문구 만들기'}<ArrowRight size={17}/></button></div></>}
    </section> : <section className="workspace result-workspace"><div className="result-heading"><button className="back-button" onClick={() => setStep('details')}><ArrowLeft size={16}/> 내용 수정</button><div><span className="step-label">YOUR DRAFT</span><h2>{current.icon} {current.title} 문구</h2><p>받는 사람: {audiences.find(x => x.id === audience)?.label}</p></div></div>
      {status && <div className={`status ${aiError ? 'warn' : ''}`} role="status" aria-live="polite">{aiError ? <ShieldCheck size={16}/> : <Sparkles size={16}/>}<span>{status}</span>{aiError && <button onClick={() => generate(tone, true)}>AI 재시도</button>}</div>}
      <div className="result-card"><div className="result-tabs" role="group" aria-label="문구 형식"><button aria-pressed={tab === 'email'} className={tab === 'email' ? 'active' : ''} onClick={() => setTab('email')}><FileText size={16}/> 이메일</button><button aria-pressed={tab === 'chat'} className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}><MessageCircle size={16}/> 메신저</button><span className="draft-badge"><span/> 초안</span></div>
        {tab === 'email' && <label className="subject-row"><b>제목</b><input className="subject-editor" aria-label="이메일 제목" value={draft?.subject || ''} onChange={e => { if (draft) { setDraft({ ...draft, subject: e.target.value }); setPreviousDraft(null); setCopied(null); } }}/></label>}
        <textarea className="draft-editor" aria-label={tab === 'email' ? '이메일 문구' : '메신저 문구'} value={tab === 'email' ? draft?.email || '' : draft?.chat || ''} onChange={e => { if (draft) { setDraft({ ...draft, [tab]: e.target.value }); setPreviousDraft(null); setCopied(null); } }}/>
        <div className="card-bottom"><span>✎　보내기 전에 내용을 꼭 확인해 주세요.</span><div className="copy-actions">{tab === 'email' ? <><button className="copy-button" onClick={() => copy('subject')}>{copied === 'subject' ? <Check size={15}/> : <Clipboard size={15}/>} {copied === 'subject' ? '제목 복사 완료' : '제목 복사'}</button><button className="copy-button" onClick={() => copy('emailBody')}>{copied === 'emailBody' ? <Check size={15}/> : <Clipboard size={15}/>} {copied === 'emailBody' ? '본문 복사 완료' : '본문 복사'}</button><button className="copy-button" onClick={() => copy('emailAll')}>{copied === 'emailAll' ? <Check size={15}/> : <Clipboard size={15}/>} {copied === 'emailAll' ? '전체 복사 완료' : '이메일 전체 복사'}</button></> : <button className="copy-button" onClick={() => copy('chat')}>{copied === 'chat' ? <Check size={15}/> : <Clipboard size={15}/>} {copied === 'chat' ? '메신저 복사 완료' : '메신저 복사'}</button>}</div></div>
      </div>
      <div className="refine"><div className="refine-title"><WandSparkles size={16}/><b>이렇게 다듬어 볼까요?</b><span>원하는 톤을 선택하세요</span></div><div className="refine-buttons"><button onClick={() => adjust('formal')}>더 정중하게</button><button onClick={() => adjust('short')}>더 짧게</button><button onClick={() => adjust('soft')}>더 부드럽게</button>{previousDraft && <button onClick={undoDraft}>이전 초안 되돌리기</button>}<button className="regenerate" onClick={() => generate(tone, true)} disabled={loading}><RotateCcw size={14}/> 다시 생성</button><button onClick={() => { document.querySelector<HTMLTextAreaElement>('.draft-editor')?.focus(); setStatus('문구를 클릭해 바로 수정할 수 있어요.'); }}><ChevronDown size={14}/> 직접 수정</button></div></div>
      <div className="safety-note"><ShieldCheck size={17}/><span>발송 전 날짜·이름·사실관계를 확인해 주세요. 계약, 징계, 법적 분쟁 등 중요한 사안은 담당 부서의 검토를 권장합니다.</span></div>
    </section>}
    {settingsOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeSettings(); }}>
      <section ref={settingsDialogRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-modal-head"><div className="settings-modal-icon"><KeyRound size={18}/></div><div><h2 id="settings-title">AI API 설정</h2><p>{apiConfigured ? '현재 AI 서버가 설정되어 있어요.' : 'API 키를 연결하면 필요할 때 AI로 문구를 다듬을 수 있어요.'}</p></div><button className="close-settings" aria-label="설정 닫기" onClick={closeSettings}><X size={18}/></button></div>
        <form onSubmit={saveApiSettings}>
          <label className="settings-field"><span>AI 제공자</span><select value={provider} onChange={e => { const next = e.target.value as Provider; setProvider(next); setApiUrl(providerDefaults[next].url); setModel(providerDefaults[next].model); setApiKey(''); setSettingsMessage(''); setUseAI(false); setAIConsentConfirmed(false); }}>{Object.entries(providerDefaults).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label>
          <label className="settings-field"><span>API 키 {apiConfigured && provider === savedProvider && <small>(바꾸려면 새 키 입력)</small>}</span><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={apiConfigured && provider === savedProvider ? '키는 다시 표시되지 않습니다' : 'API 키 입력'} autoComplete="new-password" required={!apiConfigured || provider !== savedProvider}/></label>
          <label className="settings-field"><span>API 주소</span><input type="url" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://…" required/></label>
          <label className="settings-field"><span>모델 이름</span><input value={model} onChange={e => setModel(e.target.value)} placeholder="제공자 모델 ID" required/></label>
          <label className="settings-field"><span>하루 AI 호출 한도 <small>(연결 테스트 포함, 1~500회)</small></span><input type="number" min="1" max="500" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} required/></label>
          <div className="usage-counter">오늘 사용량 <b>{usedToday} / {dailyLimit}</b>회</div>
          <div className="key-security"><ShieldCheck size={16}/><span>키는 설정 서버로 전송되어 프로젝트의 .env.local 파일에 저장됩니다. 브라우저 저장소와 서버 응답에는 키를 남기지 않습니다. 외부 서버를 이용할 때는 HTTPS를 사용하고 .env.local을 공유하지 마세요.</span></div>
          {settingsMessage && <p className={`settings-message ${settingsError ? 'error' : ''}`} role="status">{settingsMessage}</p>}
          <div className="settings-actions">{apiConfigured && <button type="button" className="remove-settings" onClick={removeApiKey} disabled={savingSettings || testingConnection}>키 삭제</button>}<button type="button" className="cancel-settings" onClick={testConnection} disabled={testingConnection || savingSettings}>{testingConnection ? '테스트 중…' : '연결 테스트'}</button><button type="submit" className="primary-button" disabled={savingSettings || testingConnection}>{savingSettings ? '저장 중…' : '설정 저장'}</button></div>
        </form>
      </section>
    </div>}
    {aiConfirmOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeAIConfirm(); }}><section ref={aiConfirmDialogRef} className="settings-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="ai-confirm-title" aria-describedby="ai-confirm-description"><div className="settings-modal-head"><div className="settings-modal-icon"><ShieldCheck size={18}/></div><div><h2 id="ai-confirm-title">AI 제공자에게 입력을 전송할까요?</h2><p>{providerDefaults[provider].label}로 문장을 다듬습니다.</p></div></div><div id="ai-confirm-description" className="confirm-copy"><p><b>전송되는 정보</b><br/>{labelOf(scenario)}, 받는 사람 유형, 이 화면에 입력한 내용</p><p><b>저장 안내</b><br/>이 앱에는 입력을 보관하지 않지만, AI 제공자는 각자의 서비스 정책에 따라 요청을 처리합니다. 고객 정보·회사 기밀 등 민감한 내용은 보내지 마세요.</p></div><div className="settings-actions"><button type="button" className="cancel-settings" onClick={closeAIConfirm}>취소</button><button type="button" className="primary-button" onClick={confirmAIAndGenerate}>동의하고 전송</button></div></section></div>}
    {serverAuthRequired && <div className="modal-backdrop"><section ref={authDialogRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="access-title"><div className="settings-modal-head"><div className="settings-modal-icon"><ShieldCheck size={18}/></div><div><h2 id="access-title">서버 인증</h2><p>보호된 AI 서버를 사용하려면 접근 코드를 입력하세요.</p></div></div><form onSubmit={unlockServer}><label className="settings-field"><span>서버 접근 코드</span><input type="password" value={accessCodeInput} onChange={e => setAccessCodeInput(e.target.value)} autoComplete="current-password" required/></label>{accessMessage && <p className="settings-message error" role="alert">{accessMessage}</p>}<div className="settings-actions"><button className="primary-button" disabled={unlockingServer}>{unlockingServer ? '확인 중…' : '잠금 해제'}</button></div></form></section></div>}
    <footer>업무의 순간마다, 말은 더 편안하게 <span>© 일잘러 문장</span></footer>
  </main>;
}
