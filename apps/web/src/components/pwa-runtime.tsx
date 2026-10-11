"use client";
import{useEffect,useState}from"react";
import{syncOfflineWorkspace}from"../lib/offline-client";

export function PwaRuntime({workspaceId}:{workspaceId?:string}){
 const[update,setUpdate]=useState<ServiceWorkerRegistration|null>(null),[offline,setOffline]=useState(false);
 useEffect(()=>{if(!("serviceWorker"in navigator))return;let active=true;navigator.serviceWorker.register("/sw.js",{scope:"/"}).then(reg=>{if(!active)return;if(reg.waiting)setUpdate(reg);reg.addEventListener("updatefound",()=>{const w=reg.installing;if(w)w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)setUpdate(reg)})})}).catch(()=>undefined);const online=()=>{setOffline(false);if(workspaceId)void syncOfflineWorkspace(workspaceId).catch(()=>undefined)},off=()=>setOffline(true);setOffline(!navigator.onLine);addEventListener("online",online);addEventListener("offline",off);const q=()=>{if(workspaceId&&navigator.onLine)void syncOfflineWorkspace(workspaceId).catch(()=>undefined)};const sw=(event:MessageEvent)=>{if(event.data?.type==="NEXOSOPHY_SYNC_REQUESTED")q()};addEventListener("nexosophy:offline-queue",q);navigator.serviceWorker.addEventListener("message",sw);return()=>{active=false;removeEventListener("online",online);removeEventListener("offline",off);removeEventListener("nexosophy:offline-queue",q);navigator.serviceWorker.removeEventListener("message",sw)}},[workspaceId]);
 function activate(){update?.waiting?.postMessage({type:"SKIP_WAITING"});location.reload()}
 if(!offline&&!update)return null;
 return <div className="pwa-runtime" role="status">{offline?<span>Offline · encrypted local changes will sync when connectivity returns.</span>:null}{update?<button type="button" onClick={activate}>Update Nexosophy</button>:null}</div>
}