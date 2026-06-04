import React from 'react';

const ToastContainer = () => {
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    const handler = (e) => {
      const id = Date.now();
      const newToast = { id, message: e.detail.message, type: e.detail.type || 'default' };
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    };

    window.addEventListener('showToast', handler);
    return () => window.removeEventListener('showToast', handler);
  }, []);

  return (
    <div id="toast-container" className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
