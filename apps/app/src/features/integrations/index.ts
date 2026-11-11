import { invoke } from '@tauri-apps/api/core';
export type GoogleMode = 'real' | 'sandbox';
export type GoogleAction = { kind: 'mail'; to: string; subject: string; body: string } | { kind: 'event'; summary: string; start: string; end: string };
export interface GooglePreview { id: string; action: GoogleAction; mode: GoogleMode }
export interface GoogleResult { id: string; verified: boolean; acknowledged?: boolean; sandbox: boolean }
export interface IntegrationContext { mode: GoogleMode; connected: boolean; scopes: readonly string[]; contextTrust: 'untrusted'; }
export const scopes = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar.events.owned'] as const;
export class GoogleAdapter {
  constructor(readonly mode: GoogleMode = 'sandbox') {}
  connect(clientId: string, clientSecret: string) { return invoke('google_connect', { clientId, clientSecret }); }
  disconnect() { return invoke('google_disconnect'); }
  preview(action: GoogleAction): Promise<GooglePreview> { return invoke('google_preview', { action, sandbox: this.mode === 'sandbox' }); }
  confirm(previewId: string): Promise<GoogleResult> { return invoke('google_confirm', { previewId }); }
}
