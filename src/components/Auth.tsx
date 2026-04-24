import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PASSWORD_KEY = 'pp-auth';
const CORRECT = 'pipeline2024';

const GREETINGS = [
  "Kanospace načítaný. Skús dnes nepokaziť produkciu.",
  "Vitaj. Poďme konečne spraviť nejakú robotu",
  "Tento text je úplne zbytočný",
  "Stano pozýva na pivo",
  "Jak sa hovorí, Jebem na to neska už",
];

interface AuthProps {
  onAuthenticated: () => void;
}

export function Auth({ onAuthenticated }: AuthProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === CORRECT) {
      localStorage.setItem(PASSWORD_KEY, 'true');
      const quote = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      setGreeting(quote);
      setTimeout(() => onAuthenticated(), 1500);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => setError(false), 2000);
      setValue('');
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-50">
      <AnimatePresence mode="wait">
        {greeting ? (
          <motion.div
            key="greeting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center px-8 max-w-sm"
          >
            <p className="text-white text-lg font-medium leading-relaxed">{greeting}</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm px-6"
          >
            <div className="mb-8 text-center">
              <div className="text-2xl font-semibold text-white tracking-tight mb-1">Kanospace</div>
              <div className="text-sm text-[#666]">Enter password to continue</div>
            </div>
            <motion.form
              onSubmit={handleSubmit}
              animate={shake ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <input
                type="password"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="Password"
                autoFocus
                className={`w-full bg-[#161616] border rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] outline-none transition-all ${
                  error ? 'border-red-500/60' : 'border-[#2a2a2a] focus:border-[#444]'
                }`}
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-xs mt-2 text-center"
                >
                  Incorrect password
                </motion.p>
              )}
              <button
                type="submit"
                className="w-full mt-3 bg-white text-black text-sm font-medium py-3 rounded-xl hover:bg-[#e5e5e5] transition-colors"
              >
                Continue
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useAuth() {
  const stored = localStorage.getItem(PASSWORD_KEY);
  return stored === 'true';
}
