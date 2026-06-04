import React from 'react';

const TxOverlay = () => {
  const [state, setState] = React.useState({ visible: false, title: '', desc: '' });

  React.useEffect(() => {
    const showHandler = (e) => setState({ visible: true, title: e.detail.title, desc: e.detail.desc });
    const hideHandler = () => setState(prev => ({ ...prev, visible: false }));

    window.addEventListener('showTxOverlay', showHandler);
    window.addEventListener('hideTxOverlay', hideHandler);
    return () => {
      window.removeEventListener('showTxOverlay', showHandler);
      window.removeEventListener('hideTxOverlay', hideHandler);
    };
  }, []);

  return (
    <div id="tx-overlay" className={`modal-overlay ${state.visible ? '' : 'hidden'}`}>
      <div className="modal-content text-center">
        <div className="loader"></div>
        <h3 id="tx-status-title" style={{ marginTop: '1.5rem' }}>{state.title}</h3>
        <p id="tx-status-desc" style={{ color: 'var(--text-muted)' }}>{state.desc}</p>
      </div>
    </div>
  );
};

export default TxOverlay;
