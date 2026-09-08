import React, { useRef, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

export default function EventLog() {
  const events = useSimStore(s => s.eventLog);
  const scrollRef = useRef();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="col-section-label">
        <span>Events</span>
        <button style={{ 
          background: 'none', border: '1px solid var(--border)', 
          color: 'var(--text-muted)', fontSize: '8px', borderRadius: '2px', cursor: 'pointer', padding: '2px 6px'
        }} onClick={() => useSimStore.setState({ eventLog: [] })}>Clear</button>
      </div>
      
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', maxHeight: 240, paddingRight: 4 }}>
        {events.map((evt, i) => (
          <div key={i} className="event-log-entry">
            <span className="timestamp">[{evt.time}]</span>
            <span className="message">{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
