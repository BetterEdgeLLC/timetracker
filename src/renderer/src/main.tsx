import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import './styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <App />
    <Toaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--color-raised)',
          border: '1px solid var(--color-line-strong)',
          color: 'var(--color-ink)',
          fontFamily: 'var(--font-sans)'
        }
      }}
    />
  </MotionConfig>
)
