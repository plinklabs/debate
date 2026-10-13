import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DebateConfig } from '../model/config';
import { setSideLabel, setTopicText } from '../model/edit';
import { GRAFFITI_PRESET, KARL_POPPER_PRESET, standardRubric } from '../model/presets';
import { initialState, type AppState } from '../model/reducer';
import { newDebate } from '../model/session';
import type { ConfigIssue, ConfigResult } from '../model/validate';
import { renderWithI18n } from '../test/i18n';
import { graffitiWithJury } from '../test/playedSession';
import type { Incoming, IncomingSource } from './incoming';
import { SharedSetupScreen } from './SharedSetupScreen';

const english = GRAFFITI_PRESET.build('en');
const LINK: IncomingSource = { kind: 'link' };

function show(
  result: ConfigResult | null,
  {
    source = LINK,
    state = initialState(english),
    locale = 'en',
  }: { source?: IncomingSource; state?: AppState; locale?: 'en' | 'nl' } = {},
) {
  const onUse = vi.fn<(config: DebateConfig) => void>();
  const onClose = vi.fn<() => void>();
  const incoming: Incoming = { source, result };
  renderWithI18n(
    <SharedSetupScreen incoming={incoming} state={state} onUse={onUse} onClose={onClose} />,
    { locale },
  );
  return { onUse, onClose };
}

const ok = (config: DebateConfig): ConfigResult => ({ ok: true, config });
const broken = (...issues: ConfigIssue[]): ConfigResult => ({ ok: false, issues });

/** The app with debate 1 on t1, a vote counted, and debate 2 on t2 with only names. */
function withResults(): AppState {
  return {
    config: english,
    session: {
      current: null,
      debates: [
        {
          ...newDebate('d1', 't1', english.format),
          teams: { pro: ['Ann', 'Bert', ''], con: ['Dirk', 'Eva', ''] },
          records: { 'vote-before': { type: 'vote-before', votes: { pro: 12, con: 9 } } },
        },
        newDebate('d2', 't2', english.format),
      ],
    },
  };
}

describe('a shared setup', () => {
  it('says it is being read, and can be left meanwhile', () => {
    const { onClose } = show(null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Reading the setup…');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows its topics, its format and its sides before it is used', () => {
    const shared = setTopicText(english, 't2', 'Homework should be banned.');
    show(ok(shared));

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Use this setup?');
    expect(heading).toHaveFocus();
    expect(screen.getByText(/comes from a link/)).toHaveTextContent(
      'This setup comes from a link. Nothing changes until you choose to use it.',
    );

    const topics = screen.getByRole('region', { name: 'Topics' });
    expect(
      within(topics)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(shared.topics.map((topic) => topic.text));

    const format = screen.getByRole('region', { name: 'Format' });
    const spec = (term: string) =>
      within(format).getByText(term, { selector: 'dt' }).nextElementSibling;
    expect(spec('Total time')).toHaveTextContent('10 minutes');
    expect(spec('Steps')).toHaveTextContent('10');
    expect(spec('Students per team')).toHaveTextContent('2 to 3');
    expect(spec('For the topic')).toHaveTextContent('FOR');
    expect(spec('Against the topic')).toHaveTextContent('AGAINST');
    const steps = within(format)
      .getAllByRole('list')
      .find((list) => list.tagName === 'OL');
    expect(
      within(steps!)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Vote before',
      'OpeningSpeech · FOR · 1 min',
      'OpeningSpeech · AGAINST · 1 min',
      'Short consultationConsultation · 1 min',
      'RebuttalSpeech · FOR · 1 min 30 sec',
      'RebuttalSpeech · AGAINST · 1 min 30 sec',
      'Free round1 min 30 sec per team',
      'Closing statementSpeech · AGAINST · 30 sec',
      'Closing statementSpeech · FOR · 30 sec',
      'Vote after',
    ]);
    // Nothing here is about debates: there are none.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('names a step without a title by its kind', () => {
    const steps = english.format.steps.map((step) =>
      step.id === 'consultation' ? { ...step, label: '' } : step,
    );
    show(ok({ ...english, format: { ...english.format, steps } }));
    expect(screen.getByText('Consultation')).toHaveClass(/stepName/);
  });

  it('says which file it comes from', () => {
    show(ok(english), { source: { kind: 'file', name: 'graffiti.json' } });
    expect(
      screen.getByText(
        'This setup comes from the file “graffiti.json”. Nothing changes until you choose to use it.',
      ),
    ).toBeInTheDocument();
  });

  it('is used, or left alone', () => {
    const { onUse, onClose } = show(ok(english));
    const use = screen.getByRole('button', { name: 'Use this setup' });
    expect(use.className).toMatch(/primary/);
    fireEvent.click(use);
    expect(onUse).toHaveBeenCalledWith(english);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says what happens to the debates here, before it replaces their setup', () => {
    const shared = setSideLabel(
      setTopicText(
        { ...english, topics: english.topics.filter((topic) => topic.id !== 't2') },
        't1',
        'Homework should be banned.',
      ),
      'pro',
      'PRO',
    );
    show(ok(shared), { state: withResults() });

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(
      'There are 2 debates in this browser, and one already has results. They stay, but follow this setup from now on:',
    );
    expect(
      within(note)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Debate 1 will be about “Homework should be banned.”',
      'Debate 2 loses its topic: this setup does not have it.',
      'The format changes: a step this format does not have drops out of the results, and a new duration changes the time that was planned.',
    ]);
  });

  it('says nothing about the debates when it leaves them as they are', () => {
    show(ok({ ...english, topics: [...english.topics, { id: 't6', text: 'One more.' }] }), {
      state: withResults(),
    });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('does not mention the format to debates without results', () => {
    const state: AppState = {
      config: english,
      session: { current: null, debates: [newDebate('d1', 't1', english.format)] },
    };
    show(ok(setTopicText(setSideLabel(english, 'pro', 'PRO'), 't1', 'Other.')), { state });
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(
      'There is one debate in this browser. It stays, but follows this setup from now on:',
    );
    expect(within(note).getAllByRole('listitem')).toHaveLength(1);
  });

  it('in Dutch', () => {
    show(ok(GRAFFITI_PRESET.build('nl')), { state: withResults(), locale: 'nl' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Deze opzet gebruiken?');
    expect(screen.getByRole('note')).toHaveTextContent(
      'Er zijn 2 debatten in deze browser, en één ervan heeft al resultaten. Ze blijven, maar volgen vanaf nu deze opzet:',
    );
    expect(screen.getByText('Vrije ronde')).toBeInTheDocument();
    expect(screen.getByText('1 min 30 sec per team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deze opzet gebruiken' })).toBeInTheDocument();
  });
});

describe('a shared setup with the steps and prep time of #8', () => {
  it('shows the prep time of each team, and which side asks in a cross-examination', () => {
    const popper = KARL_POPPER_PRESET.build('en');
    const steps = [
      ...popper.format.steps.slice(0, 2),
      { id: 'questions', type: 'audience-questions', label: '', seconds: 600 } as const,
    ];
    show(ok({ ...popper, format: { ...popper.format, steps } }));
    const format = screen.getByRole('region', { name: 'Format' });
    const spec = (term: string) =>
      within(format).getByText(term, { selector: 'dt' }).nextElementSibling;
    expect(spec('Prep time')).toHaveTextContent('4 min per team');
    // 6 + 3 + 10 minutes of steps, and 4 minutes for each team.
    expect(spec('Total time')).toHaveTextContent('27 minutes');
    const list = within(format)
      .getAllByRole('list')
      .find((candidate) => candidate.tagName === 'OL');
    expect(
      within(list!)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'ConstructiveSpeech · AFFIRMATIVE · 6 min',
      'Cross-examinationNEGATIVE asks · 3 min',
      'Audience questions10 min',
    ]);
  });

  it('shows no prep time for a format without a bank', () => {
    show(ok(english));
    const format = screen.getByRole('region', { name: 'Format' });
    expect(within(format).queryByText('Prep time')).not.toBeInTheDocument();
  });

  it('says where a broken prep-time bank is', () => {
    show(
      broken({
        code: 'out-of-range',
        path: ['format', 'prepTime', 'secondsPerTeam'],
        value: 0,
        min: 1,
        max: 3600,
      }),
    );
    expect(within(screen.getByRole('alert')).getByRole('listitem')).toHaveTextContent(
      'Prep time: 0 is not between 1 and 3,600.',
    );
  });
});

describe('a shared setup that cannot be used', () => {
  it('says what is wrong with a link, and where', () => {
    const { onClose } = show(
      broken(
        { code: 'empty', path: ['topics', 2, 'text'] },
        {
          code: 'out-of-range',
          path: ['format', 'steps', 1, 'seconds'],
          value: 0,
          min: 1,
          max: 3600,
        },
        { code: 'empty', path: ['format', 'sides', 'con'] },
        { code: 'team-size-order', path: ['format', 'teamSize'], min: 4, max: 2 },
        { code: 'too-few', path: ['topics'], count: 0, min: 1 },
        { code: 'missing-field', path: ['version'] },
      ),
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('This link cannot be used');
    expect(heading).toHaveFocus();
    expect(screen.getByText('It does not hold a setup that this app can read.')).toBeVisible();
    const alert = screen.getByRole('alert');
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Topic 3: This cannot be empty.',
      'Step 2: 0 is not between 1 and 3,600.',
      'Against the topic: This cannot be empty.',
      'Students per team: The smallest team size (4) is larger than the largest (2).',
      'Topics: Too few: 0, at least 1.',
      'Version: This field is missing.',
    ]);
    expect(screen.queryByRole('button', { name: 'Use this setup' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to the app' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says what is wrong with the link itself, or with a file', () => {
    show(broken({ code: 'invalid-link', path: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link is damaged or incomplete. Copy the whole link again, or ask for a new one.',
    );
  });

  it('says so when a newer version of the app made it', () => {
    show(broken({ code: 'newer-version', path: ['version'], found: 2, supported: 1 }), {
      source: { kind: 'file', name: 'next-year.json' },
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This file cannot be used');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Version: This setup was made with a newer version of the app (version 2; this one reads up to version 1). Reload the page to get the latest version.',
    );
  });

  it('lists ten problems at most, and counts the rest', () => {
    const issues = Array.from({ length: 14 }, (_, index): ConfigIssue => ({
      code: 'empty',
      path: ['topics', index, 'text'],
    }));
    show(broken(...issues));
    expect(within(screen.getByRole('alert')).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('And 4 more problems.')).toBeInTheDocument();
  });

  it('in Dutch', () => {
    show(broken({ code: 'too-large', path: [] }), { locale: 'nl' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Deze link is niet bruikbaar',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Dit is te groot voor een opzet.');
    expect(screen.getByRole('button', { name: 'Verder naar de app' })).toBeInTheDocument();
  });
});

describe('a shared setup with a jury rubric (#10)', () => {
  /** The format's lists: the steps, then the rubric's criteria. */
  const lists = (region = 'Format') =>
    within(screen.getByRole('region', { name: region }))
      .getAllByRole('list')
      .filter((candidate) => candidate.tagName === 'OL')
      .map((list) =>
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      );

  it('shows the rubric, its criteria with their weights, and the jury step', () => {
    const config = graffitiWithJury();
    const rubric = config.format.rubric;
    if (rubric === undefined) throw new Error('no rubric');
    show(
      ok({
        ...config,
        format: {
          ...config.format,
          rubric: {
            ...rubric,
            criteria: rubric.criteria.map((criterion) =>
              criterion.id === 'rebuttal' ? { ...criterion, weight: 2 } : criterion,
            ),
          },
        },
      }),
    );
    const format = screen.getByRole('region', { name: 'Format' });
    expect(
      within(format).getByText('Jury rubric', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('4 criteria, 1 to 4, per team');
    expect(within(format).getByRole('heading', { name: 'Criteria' })).toBeInTheDocument();
    const [steps, criteria] = lists();
    expect(steps.at(-1)).toBe('Jury');
    expect(criteria).toEqual([
      'Content and arguments',
      'Rebuttalcounts 2×',
      'Evidence and examples',
      'Delivery',
    ]);
  });

  it('says when it scores each student, in Dutch', () => {
    const config = graffitiWithJury('student');
    show(
      ok({
        ...config,
        format: { ...config.format, rubric: { ...standardRubric('nl'), scope: 'student' } },
      }),
      {
        locale: 'nl',
      },
    );
    const format = screen.getByRole('region', { name: 'Debatvorm' });
    expect(
      within(format).getByText('Beoordelingsraster', { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('4 criteria, 1 tot 4, per leerling');
    expect(lists('Debatvorm')[0].at(-1)).toBe('Juryoordeel');
  });

  it('shows no rubric for a format without one', () => {
    show(ok(english));
    const format = screen.getByRole('region', { name: 'Format' });
    expect(within(format).queryByText('Jury rubric')).not.toBeInTheDocument();
    expect(lists()).toHaveLength(1);
  });

  it('says where a broken rubric is, and a jury step without one', () => {
    show(
      broken(
        { code: 'scale-order', path: ['format', 'rubric', 'scale'], min: 4, max: 1 },
        {
          code: 'out-of-range',
          path: ['format', 'rubric', 'criteria', 2, 'weight'],
          value: 0,
          min: 1,
          max: 10,
        },
        { code: 'duplicate-id', path: ['format', 'rubric', 'criteria', 3, 'id'], id: 'content' },
        { code: 'unknown-scope', path: ['format', 'rubric', 'scope'], scope: 'class' },
        { code: 'jury-without-rubric', path: ['format', 'steps', 10] },
      ),
    );
    expect(
      within(screen.getByRole('alert'))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Jury rubric: The lowest score (4) is not below the highest (1).',
      'Criterion 3: 0 is not between 1 and 10.',
      'Criterion 4: The id “content” is used more than once.',
      'Jury rubric: There is no way of scoring called “class”: a rubric scores per “team” or per “student”.',
      'Step 11: A “Jury” step needs a rubric to score on: add one, or remove the step.',
    ]);
  });
});
