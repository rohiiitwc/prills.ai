'use client';

import React from 'react';
import { AuthProvider } from '../lib/auth';
import { AuthGate } from './AuthGate';

export const ClientProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
};
