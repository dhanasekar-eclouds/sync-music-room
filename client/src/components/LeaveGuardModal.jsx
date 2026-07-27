import React, { useState } from 'react';

export default function LeaveGuardModal({ users, onTransfer, onLeaveAnyway, onCancel }) {
  const [selected, setSelected] = useState(users[0]?.id || '');

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>⚠️ You are the host</h2>
        <p>
          You must transfer host to someone before you leave, or the session ends for everyone.
        </p>

        {users.length > 0 && (
          <div className="modal-users">
            <label>Select new host:</label>
            {users.map(u => (
              <label key={u.id} className="modal-user-option">
                <input
                  type="radio"
                  name="newHost"
                  checked={selected === u.id}
                  onChange={() => setSelected(u.id)}
                />
                {u.nickname}
              </label>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          {users.length > 0 ? (
            <button className="btn btn-primary" onClick={() => onTransfer(selected)} disabled={!selected}>
              ✅ Transfer & Leave
            </button>
          ) : (
            <button className="btn btn-danger" onClick={onLeaveAnyway}>
              🚪 Leave (ends session)
            </button>
          )}
          <button className="btn btn-danger" onClick={onLeaveAnyway}>
            🚪 Leave Without Host
          </button>
        </div>
      </div>
    </div>
  );
}
