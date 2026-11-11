import { useEffect, useState, type ReactNode } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { api, type StateSnapshot } from '../../api';
import { SettingsPanel } from '../settings';
import './panel.css';
export function DesktopControls() { return <section className="vp-controls"><button disabled={!isTauri()} onClick={()=>void invoke('panel_window',{action:'show'})}>Floating voice panel</button><SettingsPanel /></section>; }
export function FloatingPanel({ children }: {children?: ReactNode}) {
 const [snapshot,setSnapshot]=useState<StateSnapshot|null>(null); const [error,setError]=useState('');
 useEffect(()=>{let active=true; const poll=()=>api.getState().then(s=>{if(active)setSnapshot(s)}).catch(e=>{if(active)setError(String(e))}); void poll(); const timer=setInterval(()=>void poll(),700);return()=>{active=false;clearInterval(timer)}},[]);
 const state=snapshot?.state ?? 'idle';
 return <main className="vp-panel"><header><strong>voicela</strong><button aria-label="Hide voice panel" onClick={()=>void invoke('panel_window',{action:'hide'})}>Hide</button></header><p role="status">{state==='awaiting-approval'?'Approval needed':state==='completed'?'Success':state==='thinking'||state==='transcribing'?'Processing':state}</p>{error&&<p role="alert">{error}</p>}{snapshot?.pending_approval&&<div><p>{snapshot.pending_approval.intent}</p><button onClick={()=>void api.approveTool(snapshot.pending_approval!.id,true).catch(e=>setError(String(e)))}>Approve</button><button onClick={()=>void api.approveTool(snapshot.pending_approval!.id,false).catch(e=>setError(String(e)))}>Decline</button></div>}<label>Mode <select aria-label="Voice mode" onChange={e=>void invoke("panel_voice",{action:e.target.value})}><option value="assistant">Assistant</option><option value="dictation">Dictation</option><option value="edit">Edit</option></select></label><button onClick={()=>void invoke("panel_voice",{action:"toggle"}).catch(e=>setError(String(e)))}>Start / pause listening</button>{children}<button onClick={()=>void invoke('panel_window',{action:'main'})}>Open workspace</button></main>;
}
