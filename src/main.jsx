import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = {failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <main className="app-loading"><h1>Something interrupted the rally.</h1><p>Your saved setup has not been deliberately cleared. Reload the page to try again.</p><button className="button primary" onClick={()=>window.location.reload()}>Reload planner</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
