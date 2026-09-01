import React from 'react';
import { CheckCircle2, ShieldAlert, AlertTriangle, Clock } from 'lucide-react';

export default function DecisionBadge({ decision }) {
  if (decision === 'APPROVE') {
    return (
      <span className="badge badge-approved">
        <CheckCircle2 size={13} />
        APPROVE
      </span>
    );
  }
  if (decision === 'BLOCK') {
    return (
      <span className="badge badge-blocked">
        <ShieldAlert size={13} />
        BLOCK
      </span>
    );
  }
  if (decision === 'REQUIRE_CONFIRMATION') {
    return (
      <span className="badge badge-review">
        <AlertTriangle size={13} />
        CONFIRMATION REQ
      </span>
    );
  }
  return (
    <span className="badge badge-neutral">
      <Clock size={13} />
      {decision || 'PENDING'}
    </span>
  );
}
