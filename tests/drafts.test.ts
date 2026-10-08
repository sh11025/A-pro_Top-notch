import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraft, type Audience, type Scenario } from '../src/drafts';

const examples: Record<Scenario, Record<string, string>> = {
  leave: { dates: '10월 21일 ~ 22일', kind: '오전 반차', startTime: '09:00', endTime: '13:00', handoff: '진행 업무를 팀에 공유했습니다.' },
  report: { topic: '캠페인 보고', progress: '초안을 마쳤습니다.', outcome: '검토 3건을 반영했습니다.', next: '금요일 최종본 공유', issue: '예산 검토가 필요합니다.' },
  schedule: { topic: '기획 회의', dates: '10월 21일 14:00', alternatives: '10월 22일 오전', details: '온라인으로 진행 가능합니다.' },
  request: { item: '회의 자료', purpose: '전략 회의 준비', deadline: '10월 24일', details: 'PDF 형식이면 좋겠습니다.' },
};

test('모든 상황에서 제목, 이메일, 메신저 문구를 생성한다', () => {
  for (const scenario of Object.keys(examples) as Scenario[]) {
    const draft = buildDraft(scenario, 'manager', examples[scenario]);
    assert.ok(draft.subject.length > 0, `${scenario} subject`);
    assert.ok(draft.email.length > 0, `${scenario} email`);
    assert.ok(draft.chat.length > 0, `${scenario} chat`);
  }
});

test('휴가 유형, 시간차, 인수인계 정보를 입력한 대로 반영한다', () => {
  const draft = buildDraft('leave', 'manager', examples.leave);
  assert.match(draft.email, /오전 반차/);
  assert.match(draft.email, /09:00 ~ 13:00/);
  assert.match(draft.email, /진행 업무를 팀에 공유했습니다\./);
  assert.equal(draft.subject, '[휴가 신청] 10월 21일 ~ 22일');
});

test('보고서의 결과, 다음 계획, 이슈를 각각 구분한다', () => {
  const draft = buildDraft('report', 'manager', examples.report);
  assert.match(draft.email, /주요 결과: 검토 3건을 반영했습니다\./);
  assert.match(draft.email, /다음 계획: 금요일 최종본 공유/);
  assert.match(draft.email, /이슈 및 요청 사항: 예산 검토가 필요합니다\./);
});

test('일정 대안과 자료 요청 기한을 중복 표현 없이 포함한다', () => {
  const schedule = buildDraft('schedule', 'colleague', examples.schedule);
  assert.match(schedule.email, /대체 가능 일정은 10월 22일 오전입니다\./);
  const request = buildDraft('request', 'external', examples.request);
  assert.match(request.email, /요청 자료: 회의 자료/);
  assert.match(request.email, /필요 시점: 10월 24일까지/);
  assert.doesNotMatch(request.chat, /회의 자료 자료/);
  assert.doesNotMatch(request.chat, /까지까지/);
});

test('수신자에 따라 인사와 격식이 달라진다', () => {
  const manager = buildDraft('leave', 'manager', examples.leave);
  const peer = buildDraft('leave', 'colleague', examples.leave);
  const external = buildDraft('leave', 'external', examples.leave);
  assert.match(manager.email, /^안녕하세요\./);
  assert.match(peer.email, /^안녕하세요!/);
  assert.match(external.email, /^안녕하십니까\./);
  assert.match(external.email, /검토 후 회신/);
  assert.match(external.email, /드림$/);
});

test('간결·기본·정중 말투가 입력 사실을 유지하면서 달라진다', () => {
  const normal = buildDraft('report', 'manager', examples.report, 'normal');
  const short = buildDraft('report', 'manager', examples.report, 'short');
  const formal = buildDraft('report', 'manager', examples.report, 'formal');
  assert.notEqual(normal.email, short.email);
  assert.notEqual(normal.email, formal.email);
  for (const draft of [normal, short, formal]) assert.match(draft.email, /초안을 마쳤습니다\./);
});

test('입력하지 않은 사실을 템플릿이 만들지 않고, 수신자 유형은 모두 지원한다', () => {
  const audiences: Audience[] = ['manager', 'colleague', 'external'];
  for (const audience of audiences) {
    const draft = buildDraft('request', audience, { item: '접근 권한 목록' });
    assert.match(draft.email, /접근 권한 목록/);
    assert.doesNotMatch(draft.email, /기한|수요일|김OO/);
  }
});
