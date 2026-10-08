export type Scenario = 'leave' | 'report' | 'schedule' | 'request';
export type Audience = 'manager' | 'colleague' | 'external';
export type Fields = Record<string, string>;
export type Draft = { subject: string; email: string; chat: string };
export type Tone = 'normal' | 'formal' | 'short' | 'soft';

const scenarios: Record<Scenario, { title: string; emailSubject: string }> = {
  leave: { title: '휴가 신청', emailSubject: '[휴가 신청]' },
  report: { title: '업무 보고', emailSubject: '[업무 보고]' },
  schedule: { title: '일정 조율', emailSubject: '[일정 조율]' },
  request: { title: '자료 요청', emailSubject: '[자료 요청]' },
};

const trim = (value?: string) => value?.trim() || '';
const until = (value: string) => value.endsWith('까지') ? value : `${value}까지`;
const dateText = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
};

export function buildDraft(scenario: Scenario, audience: Audience, fields: Fields, tone: Tone = 'normal'): Draft {
  const external = audience === 'external';
  const peer = audience === 'colleague';
  const greeting = external ? '안녕하십니까.' : peer ? '안녕하세요!' : '안녕하세요.';
  const closing = external
    ? tone === 'short' ? '확인 부탁드립니다. 감사합니다.' : '검토 후 회신 부탁드리며, 추가로 필요한 사항이 있으시면 말씀해 주시기 바랍니다. 감사합니다.'
    : peer ? '확인 부탁드려요. 감사합니다!' : '확인 부탁드립니다. 감사합니다.';
  const sign = external ? '드림' : '올림';
  const dates = trim(fields.dates);
  const item = trim(fields.item);
  const topic = trim(fields.topic);
  const progress = trim(fields.progress);
  const next = trim(fields.next);
  const issue = trim(fields.issue);
  const reason = trim(fields.reason);
  const handoff = trim(fields.handoff);
  const alternative = trim(fields.alternatives);
  const kind = trim(fields.kind) || '휴가';

  const bodyMap: Record<Scenario, string> = {
    leave: `${kind}를 신청드리고자 합니다.\n\n• 일정: ${dates}${fields.startTime && fields.endTime ? `\n• 시간: ${trim(fields.startTime)} ~ ${trim(fields.endTime)}` : ''}${reason ? `\n• 사유: ${reason}` : ''}${handoff ? `\n• 업무 인수인계: ${handoff}` : ''}`,
    report: `「${topic}」 진행 상황을 공유드립니다.\n\n${progress}${trim(fields.outcome) ? `\n\n주요 결과: ${trim(fields.outcome)}` : ''}${next ? `\n\n다음 계획: ${next}` : ''}${issue ? `\n\n이슈 및 요청 사항: ${issue}` : ''}`,
    schedule: `${topic} 관련하여 일정을 조율하고자 연락드립니다.\n\n희망 일정은 ${dates}입니다.${alternative ? `\n대체 가능 일정은 ${alternative}입니다.` : ''}${trim(fields.details) ? `\n${trim(fields.details)}` : ''} 가능하신 시간을 알려주시면 감사하겠습니다.`,
    request: `다음 자료를 요청드리고자 합니다.\n\n• 요청 자료: ${item}${trim(fields.purpose) ? `\n• 요청 목적: ${trim(fields.purpose)}` : ''}${trim(fields.deadline) ? `\n• 필요 시점: ${until(dateText(trim(fields.deadline)))}` : ''}${trim(fields.details) ? `\n\n${trim(fields.details)}` : ''}\n\n공유 가능 여부를 알려주시면 감사하겠습니다.`,
  };

  let body = bodyMap[scenario];
  if (tone === 'short') {
    body = scenario === 'leave' ? `${kind} 신청드립니다.\n${dates}${fields.startTime && fields.endTime ? ` · ${trim(fields.startTime)}~${trim(fields.endTime)}` : ''}${reason ? ` · 사유: ${reason}` : ''}${handoff ? `\n인수인계: ${handoff}` : ''}`
      : scenario === 'report' ? `${topic}: ${progress}${trim(fields.outcome) ? `\n결과: ${trim(fields.outcome)}` : ''}${next ? `\n다음 계획: ${next}` : ''}${issue ? `\n요청 사항: ${issue}` : ''}`
      : scenario === 'schedule' ? `${topic} 일정 조율 부탁드립니다. 희망 일정은 ${dates}입니다.${alternative ? ` 대체 일정은 ${alternative}입니다.` : ''}${trim(fields.details) ? ` ${trim(fields.details)}` : ''}`
      : `${item} 공유 부탁드립니다.${trim(fields.purpose) ? ` ${trim(fields.purpose)}에 필요합니다.` : ''}${trim(fields.deadline) ? ` ${until(dateText(trim(fields.deadline)))} 부탁드립니다.` : ''}${trim(fields.details) ? ` ${trim(fields.details)}` : ''}`;
  }
  if (tone === 'soft') body = body.replace(/신청드리고자 합니다/g, '신청드리려고 합니다').replace(/요청드리고자 합니다/g, '부탁드리고 싶습니다').replace(/조율하고자 연락드립니다/g, '조율을 부탁드리려고 연락드렸습니다');
  if (tone === 'formal') body = body.replace(/신청드리고자 합니다/g, '신청드리고자 하오니 검토하여 주시면 감사하겠습니다').replace(/공유드립니다/g, '공유하여 드립니다');

  const subjectDetail = scenario === 'leave' ? dates : scenario === 'report' || scenario === 'schedule' ? topic : item;
  const subjectPrefix = scenario === 'leave' && kind === '병가' ? '[병가 신청]' : scenarios[scenario].emailSubject;
  const subject = `${subjectPrefix}${subjectDetail ? ` ${subjectDetail}` : ''}`;
  let chat = scenario === 'leave' ? `${dates} ${kind} 사용 가능할까요?${fields.startTime && fields.endTime ? ` ${trim(fields.startTime)}~${trim(fields.endTime)} 시간입니다.` : ''}${reason ? ` ${reason} 사유입니다.` : ''}${handoff ? ` 업무는 ${handoff} 해두겠습니다.` : ''}`
    : scenario === 'report' ? `${topic} 진행 상황 공유드립니다. ${progress}${trim(fields.outcome) ? ` 주요 결과는 ${trim(fields.outcome)}입니다.` : ''}${next ? ` 다음 계획은 ${next}입니다.` : ''}${issue ? ` ${issue}` : ''}`
      : scenario === 'schedule' ? `${topic} 일정 조율 가능하실까요? ${dates} 중 괜찮은 시간 알려주시면 감사하겠습니다.${alternative ? ` 대체 일정은 ${alternative}도 가능합니다.` : ''}${trim(fields.details) ? ` ${trim(fields.details)}` : ''}`
        : `${item} 공유 가능하실까요?${trim(fields.purpose) ? ` ${trim(fields.purpose)}에 필요합니다.` : ''}${trim(fields.deadline) ? ` ${until(dateText(trim(fields.deadline)))} 부탁드려도 될까요?` : ''}${trim(fields.details) ? ` ${trim(fields.details)}` : ''}`;
  if (external) chat = `${greeting}\n${chat}\n감사합니다.`;
  else if (!peer) chat = `${greeting}\n${chat}\n확인 부탁드립니다. 감사합니다.`;
  const email = [greeting, body, closing, `\n${sign}`].filter(Boolean).join('\n\n');
  return { subject, email, chat };
}
