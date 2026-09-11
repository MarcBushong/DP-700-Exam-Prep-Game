import { useState } from 'react';
import { Copy, Download, Hammer, LockKeyhole } from 'lucide-react';
import { credentials } from '../features/dungeons/catalog';
import { getDungeonPackage } from '../features/dungeons/packages';
import { useGame } from '../features/quiz/context';
import { downloadFile } from '../services/export';
import { DateStamp, LearnLink, PageHeading } from '../components/common';
import {
  createGenerationRequest,
  downloadGenerationRequest,
  parseDifficultyMix,
} from '../features/dungeons/generation';

export function ForgePage() {
  const { selectedCredentialId } = useGame();
  const [credentialId, setCredentialId] = useState(selectedCredentialId);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [count, setCount] = useState('25');
  const [mix, setMix] = useState('advanced');
  const [message, setMessage] = useState('');
  const dungeon = getDungeonPackage(credentialId);
  const credential = credentials.find(
    (item) => item.credentialId === credentialId,
  );
  const taxonomy = dungeon?.taxonomy;
  const mapped = Boolean(credential?.isVerified && taxonomy?.domains.length);
  const countValid =
    /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= 250;
  const commands = [
    `npm run objectives:refresh -- --exam ${credentialId}`,
    `npm run questions:generate -- --exam ${credentialId} --count ${countValid ? count : '25'} --difficulty ${mix}${objectives.length ? ` --floors ${objectives.join(',')}` : ''}`,
    '# Copilot + MCP authoring and independent review happen between generation and verification.',
    `npm run questions:verify -- --exam ${credentialId} --reviews src/content/exams/${credentialId}/verification-reviews.json`,
    `npm run questions:validate -- --exam ${credentialId}`,
    `npm run questions:duplicates -- --exam ${credentialId}`,
    `npm run questions:coverage -- --exam ${credentialId}`,
    `npm run questions:report -- --exam ${credentialId}`,
  ].join('\n');
  return (
    <div className="forge-page">
      <PageHeading
        title="The encounter forge."
        description="A maintainer’s workbench. Request new encounters; never manufacture certainty."
      />
      <section className="forge-principle">
        <Hammer size={38} aria-hidden="true" />
        <div>
          <h2>A request is not a verified question.</h2>
          <p>
            The browser prepares a local authoring request. It does not call an
            AI service, retrieve new evidence, generate facts, or verify
            answers. Actual Copilot authoring, MCP documentation retrieval, and
            a separate independent review are required.
          </p>
        </div>
      </section>
      <div className="forge-layout">
        <section className="panel setup-section">
          <h2>Describe the work</h2>
          <div className="field">
            <label htmlFor="forge-dungeon">Dungeon to extend</label>
            <select
              id="forge-dungeon"
              value={credentialId}
              onChange={(event) => {
                setCredentialId(event.target.value);
                setObjectives([]);
                setMessage('');
              }}
            >
              {credentials.map((item) => (
                <option key={item.credentialId} value={item.credentialId}>
                  {item.examCode ?? item.credentialId} · {item.dungeonName}
                  {!item.isVerified ? ' · Unverified' : ''}
                </option>
              ))}
            </select>
          </div>
          {!mapped ? (
            <p className="notice warning">
              <LockKeyhole size={17} aria-hidden="true" /> Sealed forge: no
              verified objective map is available. Retrieve and independently
              validate the official identity and objectives first. No objectives
              have been inferred.
            </p>
          ) : (
            <>
              <fieldset className="topic-field">
                <legend>Floors · official objectives</legend>
                <p className="field-help">
                  No selection requests every documented floor.
                </p>
                {taxonomy?.domains.map((domain) => (
                  <label className="check-label" key={domain.id}>
                    <input
                      type="checkbox"
                      checked={objectives.includes(domain.id)}
                      onChange={() =>
                        setObjectives((previous) =>
                          previous.includes(domain.id)
                            ? previous.filter((id) => id !== domain.id)
                            : [...previous, domain.id],
                        )
                      }
                    />
                    {domain.title}
                  </label>
                ))}
              </fieldset>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="forge-count">Candidate target (1–250)</label>
                  <input
                    id="forge-count"
                    type="number"
                    min="1"
                    max="250"
                    step="1"
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                    aria-invalid={!countValid}
                  />
                  {!countValid && (
                    <p className="error-text">
                      Enter a whole number from 1 to 250.
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="forge-difficulty">Difficulty mix</label>
                  <select
                    id="forge-difficulty"
                    value={mix}
                    onChange={(event) => setMix(event.target.value)}
                  >
                    <option value="advanced">Advanced</option>
                    <option value="advanced:60,expert:40">
                      60% Advanced · 40% Expert
                    </option>
                    <option value="expert">Expert</option>
                    <option value="mix">Mixed difficulties</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="beginner">Beginner</option>
                  </select>
                </div>
              </div>
              <p className="field-help">
                Targets are requests, not quotas. Unsupported or ambiguous
                candidates stay outside gameplay, even if the final count is
                lower.
              </p>
            </>
          )}
          <button
            className="button primary"
            disabled={!mapped || !countValid}
            onClick={() => {
              if (!credential || !taxonomy) return;
              try {
                const request = createGenerationRequest(credential, taxonomy, {
                  requestId: crypto.randomUUID(),
                  authorId: 'unassigned-maintainer',
                  requestedCount: Number(count),
                  createdAt: new Date().toISOString(),
                  ...parseDifficultyMix(mix),
                  objectiveDomains: objectives.length ? objectives : undefined,
                });
                const file = downloadGenerationRequest(request);
                downloadFile(file.content, file.fileName, file.mimeType);
                setMessage(
                  'Authoring request downloaded with an unassigned maintainer. It contains no generated or verified questions.',
                );
              } catch {
                setMessage(
                  'Request download unavailable. Check the fields and try again in a browser that allows local downloads.',
                );
              }
            }}
          >
            <Download size={17} aria-hidden="true" /> Download request
          </button>
        </section>
        <section className="forge-commands">
          <h2>Continue with a maintainer agent</h2>
          <p>
            Run from the repository root with the downloaded request as your
            brief. Scaffolding is not an AI model. Review records must be
            independently authored, never generated to bypass a gate.
          </p>
          {mapped ? (
            <>
              <pre tabIndex={0} aria-label="Maintainer commands">
                <code>{commands}</code>
              </pre>
              <button
                className="button secondary"
                disabled={!countValid}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(commands);
                    setMessage(
                      'Commands copied. Independent review remains required.',
                    );
                  } catch {
                    setMessage(
                      'Clipboard unavailable. Select and copy the commands above.',
                    );
                  }
                }}
              >
                <Copy size={17} aria-hidden="true" /> Copy commands
              </button>
            </>
          ) : (
            <p className="notice">
              Commands remain locked until an authoritative objective map is
              checked in.
            </p>
          )}
          <ol className="forge-checklist">
            <li>Retrieve current official evidence.</li>
            <li>Author original, answerable candidates.</li>
            <li>Independently re-check every option.</li>
            <li>Inspect duplicate and quality warnings.</li>
            <li>Promote only complete, verified, nonstale records.</li>
          </ol>
          {credential?.lastGroundedAt && (
            <p className="small muted">
              Current snapshot:{' '}
              <DateStamp value={credential.lastGroundedAt} precise />. This is
              not a new retrieval.
            </p>
          )}
          {credential?.officialUrls.studyGuide && (
            <LearnLink href={credential.officialUrls.studyGuide}>
              Read the official objective map
            </LearnLink>
          )}
        </section>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
