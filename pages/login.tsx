import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';

import { PasswordLoginForm } from '../components/PasswordLoginForm';
import logoAcontrans from '../assets/branding/grupo-acontrans-logo-transparent.png';

import styles from './login.module.css';

type BorderFrame = {
  path: string;
  viewBox: string;
};

function buildRoundedRectPath(width: number, height: number, radius: number, inset: number) {
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  const maxRadius = Math.min((x1 - x0) / 2, (y1 - y0) / 2);
  const r = Math.max(0, Math.min(radius - inset, maxRadius));
  const n = (value: number) => Number(value.toFixed(2));

  if (r <= 0) {
    return `M ${n(x0)} ${n(y0)} H ${n(x1)} V ${n(y1)} H ${n(x0)} Z`;
  }

  return [
    `M ${n(x0 + r)} ${n(y0)}`,
    `H ${n(x1 - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y0 + r)}`,
    `V ${n(y1 - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x1 - r)} ${n(y1)}`,
    `H ${n(x0 + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x0)} ${n(y1 - r)}`,
    `V ${n(y0 + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x0 + r)} ${n(y0)}`
  ].join(' ');
}

export default function Login() {
  const authSurfaceRef = useRef<HTMLElement | null>(null);
  const [borderFrame, setBorderFrame] = useState<BorderFrame | null>(null);

  useEffect(() => {
    const alreadyDark = document.body.classList.contains('dark');

    if (!alreadyDark) {
      document.body.classList.add('dark');
    }

    return () => {
      if (!alreadyDark) {
        document.body.classList.remove('dark');
      }
    };
  }, []);

  useEffect(() => {
    const container = authSurfaceRef.current;
    if (!container) {
      return;
    }

    const syncBorderFrame = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      const computedStyle = window.getComputedStyle(container);
      const radius = Number.parseFloat(computedStyle.borderTopLeftRadius) || 0;
      const inset = 1.25;
      const nextFrame: BorderFrame = {
        viewBox: `0 0 ${width} ${height}`,
        path: buildRoundedRectPath(width, height, radius, inset)
      };

      setBorderFrame((currentFrame) => {
        if (
          currentFrame?.viewBox === nextFrame.viewBox &&
          currentFrame?.path === nextFrame.path
        ) {
          return currentFrame;
        }
        return nextFrame;
      });
    };

    syncBorderFrame();

    const resizeObserver = new ResizeObserver(() => {
      syncBorderFrame();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Login - Portal de Compras</title>
      </Helmet>

      <main className={styles.viewport}>
        <div className={styles.stack}>
          <img
            src={logoAcontrans}
            alt="Logo do Grupo Acontrans"
            className={styles.logo}
          />

          <section
            ref={authSurfaceRef}
            className={styles.authSurface}
            aria-label="Tela de login"
          >
            <h1 className={styles.title}>Portal de Compras</h1>
            <PasswordLoginForm className={styles.form} />
            <svg
              className={styles.energyBorder}
              viewBox={borderFrame?.viewBox ?? '0 0 1 1'}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {borderFrame ? (
                <>
                  <path className={styles.energyTrack} d={borderFrame.path} />
                  <path className={styles.energyLine} d={borderFrame.path} pathLength={1} />
                </>
              ) : null}
            </svg>
          </section>
        </div>
      </main>
    </div>
  );
}
