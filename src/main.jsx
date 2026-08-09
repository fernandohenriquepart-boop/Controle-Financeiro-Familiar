import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Sem isso, quem já tem o app aberto (ou instalado como PWA) fica preso na
// versão que carregou até fechar e abrir de novo manualmente: o novo
// service worker chega a instalar e assumir sozinho (skipWaiting +
// clients.claim no sw.js), mas a página já carregada em memória não recarrega
// pra buscar o HTML/JS novo — precisa desse listener de "trocou o
// controller, recarrega" pra terminar a atualização.
if ('serviceWorker' in navigator) {
  let hasReloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloaded) return
    hasReloaded = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // O navegador só confere se há versão nova do próprio sw.js de vez em
      // quando por conta própria — força a checagem sempre que o app volta a
      // ficar visível (ex: reabrir o PWA que ficou em segundo plano no
      // celular). Mas isso só ajuda quando o sw.js muda entre deploys, o que
      // é raro — a maioria das atualizações troca só o código do app.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      })
    }).catch(() => {})
  })
}

// Pega o caso comum (deploy trocou o app, não o sw.js): compara o HTML da
// página com o que está publicado agora sempre que o app volta a ficar
// visível — se mudou, é porque saiu uma versão nova, então recarrega sozinho
// em vez de deixar quem tem o PWA aberto preso na versão antiga.
let loadedHtml = null
fetch('/', { cache: 'no-store' })
  .then((r) => r.text())
  .then((html) => {
    loadedHtml = html
  })
  .catch(() => {})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !loadedHtml) return
  fetch('/', { cache: 'no-store' })
    .then((r) => r.text())
    .then((latestHtml) => {
      if (latestHtml !== loadedHtml) window.location.reload()
    })
    .catch(() => {})
})
