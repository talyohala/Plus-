import React from 'react';

// אייקון וואטסאפ מקורי ורשמי
export const WhatsAppIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.52 3.449A11.96 11.96 0 0012 0a12 12 0 00-10.22 18.25L0 24l5.9-1.54a11.96 11.96 0 006.1 1.68h.005C18.625 24 24 18.623 24 12c0-3.199-1.243-6.205-3.48-8.551z" fill="#25D366"/>
    <path d="M19.14 16.59c-.31.88-1.8 1.65-2.51 1.74-.66.08-1.52.26-4.27-1.3-3.32-1.88-5.46-5.28-5.63-5.51-.16-.23-1.34-1.78-1.34-3.39 0-1.61.84-2.4 1.15-2.73.31-.33.68-.41.91-.41.23 0 .46.01.66.02.24.01.55-.09.85.52.33.82 1.13 2.76 1.23 2.98.1.22.16.48.04.7-.12.23-.18.37-.36.58-.18.21-.38.45-.54.62-.18.19-.38.4-.17.73.21.33.94 1.53 1.83 2.33 1.15 1.03 2.3 1.34 2.63 1.51.33.17.52.14.71-.08.2-.23.82-.96 1.04-1.28.22-.33.44-.27.75-.15.31.11 1.95.92 2.29 1.08.33.16.56.24.64.38.08.14.08.82-.23 1.7z" fill="#FFF"/>
  </svg>
);

export const EditIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
);

export const DeleteIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
);

// אייקון נעיצה סולידי ומעוצב
export const PinIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11V5.5c0-.83.67-1.5 1.5-1.5h.5V2H6v2h.5C7.33 4 8 4.67 8 5.5V11l-2 3v2h5v6l1 1 1-1v-6h5v-2l-2-3z" />
  </svg>
);

export const DownloadIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
);
