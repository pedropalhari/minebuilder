'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR for Three.js component within a client component
const MinecraftBuilder = dynamic(
  () => import('./MinecraftBuilder'),
  { ssr: false, loading: () => <div className="w-full h-screen flex items-center justify-center">Loading 3D environment...</div> }
);

function ClientWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return <MinecraftBuilder />;
}

export default ClientWrapper; 