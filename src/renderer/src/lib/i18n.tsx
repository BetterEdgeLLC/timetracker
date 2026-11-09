import { createContext, useContext, useEffect, useMemo } from 'react'
import { messages, type Messages } from '@shared/i18n'
import type { Language } from '@shared/types'

interface I18n {
  lang: Language
  m: Messages
}

const Context = createContext<I18n>({ lang: 'de', m: messages.de })

export function I18nProvider({
  language,
  children
}: {
  language: Language
  children: React.ReactNode
}): React.JSX.Element {
  const value = useMemo(() => ({ lang: language, m: messages[language] }), [language])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useI18n = (): I18n => useContext(Context)
