"use client";

import { useEffect, useState } from "react";

// Bannière "Installer l'app" : capte l'événement d'installation (Android/desktop)
// et affiche une instruction dédiée sur iPhone (où l'install est manuelle).
export default function InstallHint() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Déjà installée ? on n'affiche rien.
    const standalone =
      window.navigator.standalone ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (standalone) return;

    if (localStorage.getItem("onzia-install-dismissed") === "1") return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIos(isIos);

    if (isIos) {
      setVisible(true); // pas d'event sur iOS -> on montre l'instruction
      return;
    }

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem("onzia-install-dismissed", "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="install-hint">
      <span className="install-ico">📲</span>
      <div className="install-text">
        <b>Installer OnziA</b>
        {ios ? (
          <small>
            Appuie sur <b>Partager</b> puis <b>Sur l&apos;écran d&apos;accueil</b>{" "}
            pour l&apos;utiliser comme une app (et activer les notifications).
          </small>
        ) : (
          <small>Ajoute OnziA à ton appareil pour un accès rapide.</small>
        )}
      </div>
      {!ios && deferred && (
        <button className="install-btn" onClick={install}>
          Installer
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
