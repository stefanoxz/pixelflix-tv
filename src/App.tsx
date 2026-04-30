import { useState } from 'react';
import './App.css';

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Reiniciado</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Todo o conteúdo anterior foi removido. O sistema está pronto para uma nova implementação.
        </p>
        <div className="flex justify-center">
          <div className="h-1 w-20 bg-primary rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default App;
