'use client';
import {createContext,useContext,useEffect,useState,Dispatch,SetStateAction} from 'react';
import type {Transaction} from '@/lib/statement';
type Workspace={rows:Transaction[];setRows:Dispatch<SetStateAction<Transaction[]>>;currency:string;setCurrency:Dispatch<SetStateAction<string>>;signedIn:boolean;setSignedIn:Dispatch<SetStateAction<boolean>>;sessionReady:boolean;storageStatus:string;setStorageStatus:Dispatch<SetStateAction<string>>};
const Context=createContext<Workspace|null>(null);
export function WorkspaceProvider({children}:{children:React.ReactNode}){
 const [rows,setRows]=useState<Transaction[]>([]),[currency,setCurrency]=useState('AUD'),[signedIn,setSignedIn]=useState(false),[sessionReady,setReady]=useState(false),[storageStatus,setStorageStatus]=useState('Not saved to Azure');
 useEffect(()=>{let active=true;fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setSignedIn(data.authenticated===true);}).catch(()=>{}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 return <Context.Provider value={{rows,setRows,currency,setCurrency,signedIn,setSignedIn,sessionReady,storageStatus,setStorageStatus}}>{children}</Context.Provider>;
}
export function useWorkspace(){const value=useContext(Context);if(!value)throw new Error('Workspace provider missing');return value;}
