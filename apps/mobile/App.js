import React, { useState } from 'react';
import { Button, SafeAreaView, Text, View } from 'react-native';
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:4000' });

export default function App() {
  const [dashboard, setDashboard] = useState(null);

  const loadDashboard = async () => {
    try {
      await api.post('/auth/bootstrap');
    } catch {}
    const login = await api.post('/auth/login', { email: 'admin@rentpro.ma', password: 'Admin@123' });
    const stats = await api.get('/dashboard', { headers: { Authorization: `Bearer ${login.data.token}` } });
    setDashboard(stats.data);
  };

  return (
    <SafeAreaView style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Rent Pro Mobile</Text>
      <Text>Gestion synchronisée avec la plateforme web.</Text>
      <Button title="Charger tableau de bord" onPress={loadDashboard} />
      {dashboard && (
        <View style={{ marginTop: 20 }}>
          <Text>Clients: {dashboard.customers}</Text>
          <Text>Véhicules: {dashboard.vehicles}</Text>
          <Text>Locations: {dashboard.rentals}</Text>
          <Text>Contrats signés: {dashboard.signedContracts}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
