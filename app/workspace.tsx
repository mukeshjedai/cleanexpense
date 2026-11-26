'use client';
import {createContext,useContext,useEffect,useState,Dispatch,SetStateAction} from 'react';
import type {Transaction} from '@/lib/statement';
type Workspace={rows:Transaction[];setRows:Dispatch<SetStateAction<Transaction[]>>;currency:string;setCurrency:Dispatch<SetStateAction<string>>;signedIn:boolean;setSignedIn:Dispatch<SetStateAction<boolean>>;sessionReady:boolean;loadingSaved:boolean;storageStatus:string;setStorageStatus:Dispatch<SetStateAction<string>>};
const Context=createContext<Workspace|null>(null);
export function WorkspaceProvider({children}:{children:React.ReactNode}){
 const [rows,setRows]=useState<Transaction[]>([]),[currency,setCurrency]=useState('AUD'),[signedIn,setSignedIn]=useState(false),[sessionReady,setReady]=useState(false),[storageStatus,setStorageStatus]=useState('No saved data loaded');
 const [loadingSaved,setLoadingSaved]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setSignedIn(data.authenticated===true);}).catch(()=>{}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!signedIn)return;let active=true;setLoadingSaved(true);setStorageStatus('Loading saved transactions…');
  fetch('/api/transactions',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load saved transactions.');if(!active)return;if(data.saved){setRows(data.saved.transactions);setCurrency(data.saved.currency);setStorageStatus('Loaded automatically from '+(data.storage||'storage'));}else setStorageStatus('No saved transactions yet.');}).catch(error=>{if(active)setStorageStatus(error instanceof Error?error.message:'Automatic load failed. Use Load saved data to retry.');}).finally(()=>{if(active)setLoadingSaved(false);});
  return()=>{active=false;};
 },[signedIn]);
 return <Context.Provider value={{rows,setRows,currency,setCurrency,signedIn,setSignedIn,sessionReady,loadingSaved,storageStatus,setStorageStatus}}>{children}</Context.Provider>;
}
export function useWorkspace(){const value=useContext(Context);if(!value)throw new Error('Workspace provider missing');return value;}
