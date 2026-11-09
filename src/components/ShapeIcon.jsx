import React from 'react';

export default function ShapeIcon({ shapeId }) {
  switch (shapeId) {
    case 'cylinder':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v14c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
        </svg>
      );
    case 'cube':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
        </svg>
      );
    case 'wedge':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12,3 21,20 3,20" />
        </svg>
      );
    case 'sphere':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="10" r="6.5" />
          <path d="M7 20h10M9 17h6" />
        </svg>
      );
    case 'token':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <ellipse cx="12" cy="12" rx="9" ry="4.5" />
          <path d="M3 12v3c0 2.5 4 4.5 9 4.5s9-2 9-4.5v-3" />
        </svg>
      );
    case 'box':
    default:
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="2.5" width="12" height="19" rx="2" />
        </svg>
      );
  }
}
