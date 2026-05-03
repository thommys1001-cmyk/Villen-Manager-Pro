import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/me`,
        { withCredentials: true }
      );
      setUser(data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
    setUser(data);
    return data;
  };

  const logout = async () => {
    await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`,
      {},
      { withCredentials: true }
    );
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};