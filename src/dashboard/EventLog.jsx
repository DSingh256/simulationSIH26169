import React, { useRef, useEffect } from 'react';
import { useSimStore } from '../store/simStore';

export default function EventLog() {
  const events = useSimStore(s => s.eventLog);
  const scrollRef = useRef();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Event Log</span>
        <button style={{ 
          background: 'none', border: '1px solid var(--border-subtle)', 
          color: 'var(--text-muted)', fontSize: '9px', borderRadius: '2px', cursor: 'pointer' 
        }} onClick={() => useSimStore.setState({ eventLog: [] })}>Clear</button>
      </div>
      
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', marginTop: 10, paddingRight: 4 }}>
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
