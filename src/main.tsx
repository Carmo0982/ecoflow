import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { crearRepositorio } from './lib/repositorio/crear';
import './index.css';

const raiz = createRoot(document.getElementById('root')!);

crearRepositorio().then(
  (repositorio) =>
    raiz.render(
      <StrictMode>
        <App repositorio={repositorio} />
      </StrictMode>,
    ),
  () => raiz.render(<p style={{ padding: 24 }}>No se pudo iniciar EcoFlow. Recarga la página.</p>),
);
