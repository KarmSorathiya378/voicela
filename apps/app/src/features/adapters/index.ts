import { invoke } from '@tauri-apps/api/core';
import { api, type RunResponse } from '../../api';
export interface AccessibleContent { binding: string; text: string; trust: 'untrusted'; source: 'windows-uia' }
export interface AppPolicy { allowed: string[]; excluded: string[] }
export const adapter = {
 readSelectedText: () => invoke<AccessibleContent>('adapter_read', { selection: true }),
 readAccessibleContent: () => invoke<AccessibleContent>('adapter_read', { selection: false }),
 applyText: (binding: string, text: string): Promise<RunResponse> => invoke<RunResponse>('adapter_action',{binding,action:'type',target:text}),
 act: (binding: string, action: 'click'|'scroll'|'key', target: string) => invoke<RunResponse>('adapter_action',{binding,action,target}),
 launch: (app: string) => api.runTool({tool:'open_app',input:{app}}, 'Launch application'),
 getPolicy: () => invoke<AppPolicy>('get_app_policy'),
 setPolicy: (value: AppPolicy) => invoke<void>('set_app_policy', {value}),
};
