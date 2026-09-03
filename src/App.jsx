import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navigation from './components/Navigation';
import CommandCenter from './pages/CommandCenter';
import TransactionExplorer from './pages/TransactionExplorer';
import JourneyVisualizer from './pages/JourneyVisualizer';
import SimulationLab from './pages/SimulationLab';
import PolicyWorkbench from './pages/PolicyWorkbench';
import AuditExplorer from './pages/AuditExplorer';
import SystemSettings from './pages/SystemSettings';

export default function App() {
  const [activeTab, setActiveTab] = useState('command-center');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Enterprise Header / Navigation */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Page Content with Smooth Motion Transitions */}
      <main style={{ flex: 1, paddingBottom: '48px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
          >
            {activeTab === 'command-center' && <CommandCenter onNavigate={setActiveTab} />}
            {activeTab === 'transactions' && <TransactionExplorer />}
            {activeTab === 'journey' && <JourneyVisualizer />}
            {activeTab === 'simulation' && <SimulationLab />}
            {activeTab === 'policy' && <PolicyWorkbench />}
            {activeTab === 'audit' && <AuditExplorer />}
            {activeTab === 'settings' && <SystemSettings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
