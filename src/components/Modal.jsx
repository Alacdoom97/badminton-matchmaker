import React,{useEffect,useRef} from 'react';
import {Icon} from './Icon.jsx';
let nextId=0;
export function Modal({title,onClose,children,wide=false,busy=false}){
  const ref=useRef(null),titleId=useRef(`dialog-title-${++nextId}`);
  useEffect(()=>{const dialog=ref.current,previous=document.activeElement;dialog.showModal();return()=>{dialog.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();else document.getElementById('main-content')?.focus();};},[]);
  return <dialog ref={ref} className={`modal ${wide?'modal-wide':''}`} aria-labelledby={titleId.current} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="modal-heading"><h2 id={titleId.current}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><Icon name="close"/></button></div>
    {children}
  </dialog>;
}
