import { useGameStore } from '../../state/useGameStore';

export function EventScreen() {
  const event = useGameStore((s) => s.event);
  const eventResult = useGameStore((s) => s.eventResult);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const leaveEvent = useGameStore((s) => s.leaveEvent);
  const run = useGameStore((s) => s.run);
  if (!event || !run) return null;

  return (
    <div className="panel center" style={{ maxWidth: 620, margin: '4vh auto 0' }}>
      <h2>{event.title}</h2>
      <p className="muted" style={{ fontSize: 16 }}>{event.text}</p>

      {!eventResult ? (
        <div className="col" style={{ marginTop: 18 }}>
          {event.choices.map((c, i) => {
            const disabled = c.enabled ? !c.enabled(run) : false;
            return (
              <button
                key={i}
                className="btn"
                disabled={disabled}
                onClick={() => resolveEvent(i)}
              >
                {c.label}
                {disabled && <span className="muted"> — not enough</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="col" style={{ marginTop: 18 }}>
          <div className="toast">{eventResult}</div>
          <button className="btn primary" onClick={leaveEvent}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
