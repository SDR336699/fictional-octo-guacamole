import React from 'react';
import ReactDOM from 'react-dom/client';
import { initReactI18next, useTranslation } from 'react-i18next';
import i18n from 'i18next';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000' });

const resources = {
  fr: { translation: { title: 'Rent Pro - Gestion de location automobile', login: 'Connexion', dashboard: 'Tableau de bord' } },
  ar: { translation: { title: 'رينت برو - إدارة وكالات كراء السيارات', login: 'تسجيل الدخول', dashboard: 'لوحة التحكم' } },
  en: { translation: { title: 'Rent Pro - Car rental management', login: 'Login', dashboard: 'Dashboard' } }
};

void i18n.use(initReactI18next).init({ resources, lng: 'fr', fallbackLng: 'fr' });

function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = React.useState('');
  const [stats, setStats] = React.useState<any>(null);

  const login = async () => {
    try {
      await api.post('/auth/bootstrap');
    } catch {}
    const response = await api.post('/auth/login', { email: 'admin@rentpro.ma', password: 'Admin@123' });
    setToken(response.data.token);
  };

  React.useEffect(() => {
    if (!token) return;
    api.get('/dashboard', { headers: { Authorization: `Bearer ${token}` } }).then((res) => setStats(res.data));
  }, [token]);

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', margin: '2rem' }}>
      <h1>{t('title')}</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => i18n.changeLanguage('fr')}>FR</button>
        <button onClick={() => i18n.changeLanguage('ar')}>AR</button>
        <button onClick={() => i18n.changeLanguage('en')}>EN</button>
      </div>
      <button onClick={login} style={{ marginTop: 16 }}>{t('login')}</button>
      {stats && (
        <section>
          <h2>{t('dashboard')}</h2>
          <p>Clients: {stats.customers}</p>
          <p>Véhicules: {stats.vehicles}</p>
          <p>Locations: {stats.rentals}</p>
          <p>Contrats signés: {stats.signedContracts}</p>
          <p>Devise principale: MAD (د.م.)</p>
        </section>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
